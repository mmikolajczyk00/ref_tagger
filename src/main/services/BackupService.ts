import { app, dialog, BrowserWindow } from 'electron'
import { createWriteStream, existsSync, promises as fs } from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { ZipArchive } from 'archiver'
import extract from 'extract-zip'
import { Result } from '../../shared/types/api'
import {
    BackupDomain,
    BackupLoadOptions,
    BackupManifest,
    BackupSaveOptions
} from '../../shared/types/models'
import { LocalDatabaseService, initDDL } from './LocalDatabaseService'
import { TaskManager } from './TaskManager'

const DOMAIN_TABLES: Record<BackupDomain, string> = {
    files: 'files',
    tags: 'tags',
    file_tags: 'file_tags',
    canvases: 'canvases',
    blacklists: 'blacklists',
    aliases: 'aliases'
}

const AUTOINCREMENT_TABLES = [
    'files',
    'tags',
    'canvases',
    'blacklists',
    'aliases',
    'blacklist_tags',
    'alias_tags'
]

export class BackupService {
    private tempDir: string | null = null

    constructor(
        private dbService: LocalDatabaseService,
        private taskManager: TaskManager
    ) {}

    // ---- path helpers ------------------------------------------------------

    private dbPath(): string {
        return this.dbService.dbPath
    }

    private storageRoot(): string {
        return this.dbService.fileStorage.getStorageRoot()
    }

    private mediaDir(): string {
        return this.dbService.fileStorage.getFilesDir()
    }

    private canvasesDir(): string {
        return path.join(this.storageRoot(), 'canvases')
    }

    // ---- domain validation -------------------------------------------------

    private normalizeDomains(domains: BackupDomain[]): BackupDomain[] {
        const set = new Set(domains)
        if (set.has('file_tags')) {
            set.add('files')
            set.add('tags')
        }
        if (set.has('canvases')) set.add('files')
        if (set.has('aliases')) set.add('tags')
        return [...set]
    }

    // ---- inspect -----------------------------------------------------------

    async inspect(win: BrowserWindow): Promise<Result<{ manifest: BackupManifest | null }>> {
        const result = await dialog.showOpenDialog(win, {
            filters: [{ name: 'RefSheeter Backup', extensions: ['zip'] }],
            properties: ['openFile']
        })
        if (result.canceled || result.filePaths.length === 0) {
            return { success: true, data: { manifest: null } }
        }

        const zipPath = result.filePaths[0]
        const tempDir = path.join(app.getPath('temp'), 'ref-sheeter-backup-' + crypto.randomUUID())
        await fs.mkdir(tempDir, { recursive: true })

        // Release any previously inspected backup.
        if (this.tempDir) {
            await fs.rm(this.tempDir, { recursive: true, force: true }).catch(() => {})
            this.tempDir = null
        }

        try {
            await extract(zipPath, { dir: tempDir })
        } catch (err) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to extract backup.'
            }
        }

        try {
            await this.validateExtractedEntries(tempDir)
            if (!existsSync(path.join(tempDir, 'db.sqlite'))) {
                throw new Error('Missing db.sqlite')
            }
            const manifest = await this.readManifest(tempDir)
            this.tempDir = tempDir
            return { success: true, data: { manifest } }
        } catch (err) {
            await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Not a valid backup'
            }
        }
    }

    private async readManifest(tempDir: string): Promise<BackupManifest> {
        const raw = await fs.readFile(path.join(tempDir, 'manifest.json'), 'utf-8')
        const manifest = JSON.parse(raw) as BackupManifest
        if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.domains)) {
            throw new Error('Invalid manifest')
        }
        return manifest
    }

    private async validateExtractedEntries(dir: string): Promise<void> {
        const entries = await this.listFiles(dir)
        for (const rel of entries) {
            if (rel.split(path.sep).some((part) => part === '..')) {
                throw new Error('Invalid entry path')
            }
            if (!this.isAllowedEntry(rel)) {
                throw new Error(`Unexpected entry in backup: ${rel}`)
            }
        }
    }

    private async listFiles(dir: string): Promise<string[]> {
        const out: string[] = []
        const walk = async (d: string) => {
            const names = await fs.readdir(d, { withFileTypes: true })
            for (const entry of names) {
                if (entry.isSymbolicLink()) throw new Error('Symlinks are not allowed in backups')
                const full = path.join(d, entry.name)
                if (entry.isDirectory()) {
                    await walk(full)
                } else {
                    out.push(path.relative(dir, full).split(path.sep).join('/'))
                }
            }
        }
        await walk(dir)
        return out
    }

    private isAllowedEntry(rel: string): boolean {
        if (rel === 'manifest.json' || rel === 'db.sqlite') return true
        if (/^files\/[^/]+$/.test(rel)) return true
        if (/^canvases\/canvas-\d+\.json$/.test(rel)) return true
        return false
    }

    // ---- save --------------------------------------------------------------

    async saveBackup(win: BrowserWindow, options: BackupSaveOptions): Promise<Result<void>> {
        const domains = this.normalizeDomains(options.domains)

        const dialogResult = await dialog.showSaveDialog(win, {
            filters: [{ name: 'RefSheeter Backup', extensions: ['zip'] }],
            defaultPath: 'refsheeter-backup-' + this.dateISO() + '.zip'
        })
        if (dialogResult.canceled || !dialogResult.filePath) {
            return { success: true, data: undefined }
        }

        const zipPath = dialogResult.filePath
        const taskId = this.taskManager.createTask('Save backup', win)
        this.dbService.lock()

        let snapshotPath = ''
        let manifestPath = ''
        try {
            snapshotPath = path.join(
                app.getPath('temp'),
                'ref-sheeter-snapshot-' + crypto.randomUUID() + '.sqlite'
            )
            const src = new Database(this.dbPath(), { readonly: true })
            try {
                await src.backup(snapshotPath)
            } finally {
                src.close()
            }

            const snap = new Database(snapshotPath)
            try {
                snap.pragma('foreign_keys = ON')
                const filters = this.buildSaveFilters(domains)
                snap.transaction(() => {
                    for (const sql of filters) snap.exec(sql)
                })()
            } finally {
                snap.close()
            }

            const domainCounts: Partial<Record<BackupDomain, number>> = {}
            const countDb = new Database(snapshotPath, { readonly: true })
            try {
                for (const domain of domains) {
                    domainCounts[domain] = this.countDomain(countDb, domain)
                }
            } finally {
                countDb.close()
            }

            const manifest: BackupManifest = {
                version: 1,
                createdAt: new Date().toISOString(),
                domains,
                domainCounts
            }
            manifestPath = path.join(
                app.getPath('temp'),
                'ref-sheeter-manifest-' + crypto.randomUUID() + '.json'
            )
            await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

            const totalBytes = await this.computeTotalBytes(snapshotPath, manifestPath, domains)

            await this.archiveBackup(
                zipPath,
                snapshotPath,
                manifestPath,
                domains,
                taskId,
                totalBytes
            )
        } catch (err) {
            this.taskManager.failTask(taskId, err instanceof Error ? err.message : 'Save failed')
            return { success: false, error: err instanceof Error ? err.message : 'Save failed' }
        } finally {
            await fs.rm(snapshotPath, { recursive: true, force: true }).catch(() => {})
            await fs.rm(manifestPath, { recursive: true, force: true }).catch(() => {})
            this.dbService.unlock()
        }

        this.taskManager.completeTask(taskId)
        return { success: true, data: undefined }
    }

    private buildSaveFilters(domains: BackupDomain[]): string[] {
        const has = (d: BackupDomain) => domains.includes(d)
        const sql: string[] = []
        sql.push('DELETE FROM files WHERE deleted = 1')
        if (!has('files')) {
            sql.push('DELETE FROM files')
            sql.push('DELETE FROM canvases')
        }
        if (!has('file_tags')) sql.push('DELETE FROM file_tags')
        if (!has('tags')) sql.push('DELETE FROM tags')
        if (!has('canvases')) sql.push('DELETE FROM canvases')
        if (!has('blacklists')) sql.push('DELETE FROM blacklists')
        if (!has('aliases')) sql.push('DELETE FROM aliases')
        return sql
    }

    private countDomain(db: Database.Database, domain: BackupDomain): number {
        const table = DOMAIN_TABLES[domain]
        const row = db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get() as { c: number }
        return row.c
    }

    private async sizeOf(p: string): Promise<number> {
        try {
            return (await fs.stat(p)).size
        } catch {
            return 0
        }
    }

    private async computeTotalBytes(
        snapshotPath: string,
        manifestPath: string,
        domains: BackupDomain[]
    ): Promise<number> {
        let total = (await fs.stat(snapshotPath)).size + (await fs.stat(manifestPath)).size

        const db = new Database(snapshotPath, { readonly: true })
        try {
            if (domains.includes('files')) {
                const rows = db.prepare('SELECT id, ext FROM files').all() as Array<{
                    id: number
                    ext: string
                }>
                for (const r of rows) {
                    total += await this.sizeOf(this.dbService.fileStorage.filePathFor(r.id, r.ext))
                    total += await this.sizeOf(this.dbService.fileStorage.thumbPathFor(r.id, r.ext))
                }
            }
            if (domains.includes('canvases')) {
                const rows = db.prepare('SELECT id FROM canvases').all() as Array<{ id: number }>
                for (const r of rows) {
                    total += await this.sizeOf(path.join(this.canvasesDir(), `canvas-${r.id}.json`))
                }
            }
        } finally {
            db.close()
        }

        return total
    }

    private archiveBackup(
        zipPath: string,
        snapshotPath: string,
        manifestPath: string,
        domains: BackupDomain[],
        taskId: string,
        totalBytes: number
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const output = createWriteStream(zipPath)
            const archive = new ZipArchive({ zlib: { level: 9 } })

            const closed = new Promise<void>((res, rej) => {
                output.on('close', res)
                output.on('error', rej)
            })

            archive.on('error', (err) => output.destroy(err))
            archive.on('progress', (data) => {
                if (totalBytes > 0) {
                    const pct = Math.min(
                        100,
                        Math.round((data.fs.processedBytes / totalBytes) * 100)
                    )
                    this.taskManager.updateProgress(taskId, pct)
                }
            })

            archive.pipe(output)

            archive.file(snapshotPath, { name: 'db.sqlite' })
            archive.file(manifestPath, { name: 'manifest.json' })

            const db = new Database(snapshotPath, { readonly: true })
            try {
                if (domains.includes('files')) {
                    const rows = db.prepare('SELECT id, ext FROM files').all() as Array<{
                        id: number
                        ext: string
                    }>
                    for (const r of rows) {
                        const fp = this.dbService.fileStorage.filePathFor(r.id, r.ext)
                        if (existsSync(fp)) {
                            archive.file(fp, { name: `files/${r.id}${r.ext}` })
                        }
                        const tp = this.dbService.fileStorage.thumbPathFor(r.id, r.ext)
                        if (existsSync(tp)) {
                            archive.file(tp, { name: `files/${r.id}${r.ext}_thumb.webp` })
                        }
                    }
                }
                if (domains.includes('canvases')) {
                    const rows = db.prepare('SELECT id FROM canvases').all() as Array<{
                        id: number
                    }>
                    for (const r of rows) {
                        const fp = path.join(this.canvasesDir(), `canvas-${r.id}.json`)
                        if (existsSync(fp)) {
                            archive.file(fp, { name: `canvases/canvas-${r.id}.json` })
                        }
                    }
                }
            } finally {
                db.close()
            }

            void archive
                .finalize()
                .then(() => closed)
                .then(resolve)
                .catch((err) => {
                    archive.abort()
                    reject(err)
                })
        })
    }

    // ---- load --------------------------------------------------------------

    async loadBackup(win: BrowserWindow, options: BackupLoadOptions): Promise<Result<void>> {
        if (!this.tempDir) {
            return { success: false, error: 'No backup selected.' }
        }
        if (options.mode === 'replace') {
            return this.loadReplace(win)
        }
        return this.loadAppend(win, options)
    }

    private async loadReplace(win: BrowserWindow): Promise<Result<void>> {
        if (!this.tempDir) return { success: false, error: 'No backup selected.' }
        this.dbService.lock()
        const taskId = this.taskManager.createTask('Load backup (replace)', win)
        try {
            await this.dbService.prismaDisconnect()

            const dbPath = this.dbPath()
            await fs.rm(dbPath, { force: true }).catch(() => {})
            await fs.rm(dbPath + '-wal', { force: true }).catch(() => {})
            await fs.rm(dbPath + '-shm', { force: true }).catch(() => {})
            await fs.copyFile(path.join(this.tempDir, 'db.sqlite'), dbPath)

            await this.wipeDir(this.mediaDir())
            await this.wipeDir(this.canvasesDir())
            await this.copyDirContents(path.join(this.tempDir, 'files'), this.mediaDir())
            await this.copyDirContents(path.join(this.tempDir, 'canvases'), this.canvasesDir())

            this.taskManager.completeTask(taskId)
            app.relaunch()
            app.exit()
            return { success: true, data: undefined }
        } catch (err) {
            this.taskManager.failTask(
                taskId,
                err instanceof Error ? err.message : 'Load backup failed'
            )
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Load backup failed'
            }
        } finally {
            this.dbService.unlock()
        }
    }

    private async wipeDir(dir: string): Promise<void> {
        await fs.rm(dir, { recursive: true, force: true }).catch(() => {})
        await fs.mkdir(dir, { recursive: true })
    }

    private async copyDirContents(src: string, dest: string): Promise<void> {
        await fs.mkdir(dest, { recursive: true })
        let entries: string[] = []
        try {
            entries = await fs.readdir(src)
        } catch {
            return
        }
        for (const name of entries) {
            const s = path.join(src, name)
            const d = path.join(dest, name)
            const stat = await fs.stat(s)
            if (stat.isDirectory()) {
                await this.copyDirContents(s, d)
            } else {
                await fs.copyFile(s, d)
            }
        }
    }

    private async copyFileIfExists(src: string, dest: string): Promise<boolean> {
        try {
            await fs.copyFile(src, dest)
            return true
        } catch {
            return false
        }
    }

    private async loadAppend(
        win: BrowserWindow,
        options: BackupLoadOptions
    ): Promise<Result<void>> {
        if (!this.tempDir) return { success: false, error: 'No backup selected.' }

        let manifest: BackupManifest
        try {
            manifest = await this.readManifest(this.tempDir)
        } catch {
            return { success: false, error: 'Not a valid backup' }
        }

        const manifestSet = new Set(manifest.domains)
        const domains = this.normalizeDomains(options.domains)
        for (const d of domains) {
            if (!manifestSet.has(d)) {
                return { success: false, error: `Domain '${d}' is not present in the backup.` }
            }
        }

        this.dbService.lock()
        const taskId = this.taskManager.createTask('Load backup (append)', win)

        const backupDbPath = path.join(this.tempDir, 'db.sqlite')
        const prisma = this.dbService.prismaClient

        let skippedRows = 0
        try {
            const backupDb = new Database(backupDbPath, { readonly: true })
            try {
                const total = this.countAppendSteps(backupDb, domains)
                let done = 0
                const bump = () => {
                    done++
                    const pct = total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0
                    this.taskManager.updateProgress(taskId, pct)
                }

                const fileMerge = new Map<number, number>()
                const tagMerge = new Map<number, number>()

                await prisma.$transaction(async (tx) => {
                    if (domains.includes('files')) {
                        const liveRows = await tx.file.findMany({
                            where: { deleted: false, sourceUrl: { not: null } },
                            select: { id: true, sourceUrl: true }
                        })
                        const urlToId = new Map(
                            liveRows
                                .filter((r) => r.sourceUrl !== null)
                                .map((r) => [r.sourceUrl as string, r.id])
                        )

                        const files = backupDb
                            .prepare(
                                `SELECT id, ext, file_name, media_type, source_url, created_at
                                 FROM files WHERE deleted = 0 ORDER BY created_at`
                            )
                            .all() as Array<{
                            id: number
                            ext: string
                            file_name: string
                            media_type: string
                            source_url: string | null
                            created_at: string
                        }>

                        for (const f of files) {
                            if (
                                options.skipSameSourceUrl &&
                                f.source_url !== null &&
                                urlToId.has(f.source_url)
                            ) {
                                fileMerge.set(f.id, urlToId.get(f.source_url)!)
                                bump()
                                continue
                            }

                            const created = await tx.file.create({
                                data: {
                                    ext: f.ext,
                                    fileName: f.file_name,
                                    mediaType: f.media_type,
                                    sourceUrl: f.source_url ?? null,
                                    createdAt: f.created_at
                                }
                            })

                            const copied = await this.copyFileIfExists(
                                path.join(this.tempDir!, 'files', `${f.id}${f.ext}`),
                                this.dbService.fileStorage.filePathFor(created.id, f.ext)
                            )
                            if (!copied) {
                                await tx.file.delete({ where: { id: created.id } })
                                skippedRows++
                                bump()
                                continue
                            }

                            await this.copyFileIfExists(
                                path.join(this.tempDir!, 'files', `${f.id}${f.ext}_thumb.webp`),
                                this.dbService.fileStorage.thumbPathFor(created.id, f.ext)
                            )

                            fileMerge.set(f.id, created.id)
                            bump()
                        }
                    }

                    if (domains.includes('tags')) {
                        const tags = backupDb
                            .prepare('SELECT id, name, color FROM tags')
                            .all() as Array<{ id: number; name: string; color: string }>
                        for (const t of tags) {
                            const existing = await tx.tag.findUnique({
                                where: { name: t.name },
                                select: { id: true }
                            })
                            if (existing) {
                                tagMerge.set(t.id, existing.id)
                            } else {
                                const created = await tx.tag.create({
                                    data: { name: t.name, color: t.color }
                                })
                                tagMerge.set(t.id, created.id)
                            }
                            bump()
                        }

                        const relations = backupDb
                            .prepare('SELECT parent_id, child_id FROM tag_relations')
                            .all() as Array<{ parent_id: number; child_id: number }>
                        for (const rel of relations) {
                            const newParent = tagMerge.get(rel.parent_id)
                            const newChild = tagMerge.get(rel.child_id)
                            if (newParent == null || newChild == null) continue
                            const existingRel = await tx.tagRelation.findUnique({
                                where: {
                                    parentId_childId: { parentId: newParent, childId: newChild }
                                },
                                select: { parentId: true }
                            })
                            if (!existingRel) {
                                await tx.tagRelation.create({
                                    data: { parentId: newParent, childId: newChild }
                                })
                            }
                            bump()
                        }
                    }

                    if (domains.includes('file_tags')) {
                        const links = backupDb
                            .prepare('SELECT file_id, tag_id FROM file_tags')
                            .all() as Array<{ file_id: number; tag_id: number }>
                        for (const ft of links) {
                            const newFile = fileMerge.get(ft.file_id)
                            const newTag = tagMerge.get(ft.tag_id)
                            if (newFile == null || newTag == null) {
                                bump()
                                continue
                            }
                            const existingLink = await tx.fileTag.findUnique({
                                where: { fileId_tagId: { fileId: newFile, tagId: newTag } },
                                select: { fileId: true }
                            })
                            if (!existingLink) {
                                await tx.fileTag.create({
                                    data: { fileId: newFile, tagId: newTag }
                                })
                            }
                            bump()
                        }
                    }

                    if (domains.includes('canvases') && domains.includes('files')) {
                        const existingNames = new Set(
                            (await tx.canvas.findMany({ select: { name: true } })).map(
                                (c) => c.name
                            )
                        )
                        const canvases = backupDb
                            .prepare('SELECT id, name, created_at, updated_at FROM canvases')
                            .all() as Array<{
                            id: number
                            name: string
                            created_at: string
                            updated_at: string
                        }>
                        for (const c of canvases) {
                            let name = c.name
                            if (options.skipSameName && existingNames.has(name)) {
                                bump()
                                continue
                            }
                            if (existingNames.has(name)) {
                                let i = 2
                                while (existingNames.has(`${c.name} (${i})`)) i++
                                name = `${c.name} (${i})`
                            }
                            existingNames.add(name)

                            const created = await tx.canvas.create({
                                data: {
                                    name,
                                    createdAt: c.created_at,
                                    updatedAt: c.updated_at
                                }
                            })

                            await this.rewriteCanvasJson(
                                path.join(this.tempDir!, 'canvases', `canvas-${c.id}.json`),
                                path.join(this.canvasesDir(), `canvas-${created.id}.json`),
                                fileMerge
                            )
                            bump()
                        }
                    }

                    if (domains.includes('blacklists')) {
                        const existingNames = new Set(
                            (await tx.blacklist.findMany({ select: { listName: true } })).map(
                                (b) => b.listName
                            )
                        )
                        const lists = backupDb
                            .prepare('SELECT id, list_name, created_at FROM blacklists')
                            .all() as Array<{ id: number; list_name: string; created_at: string }>
                        for (const b of lists) {
                            let name = b.list_name
                            if (options.skipSameName && existingNames.has(name)) {
                                bump()
                                continue
                            }
                            if (existingNames.has(name)) {
                                let i = 2
                                while (existingNames.has(`${b.list_name} (${i})`)) i++
                                name = `${b.list_name} (${i})`
                            }
                            existingNames.add(name)

                            const created = await tx.blacklist.create({
                                data: { listName: name, createdAt: b.created_at }
                            })

                            const tags = backupDb
                                .prepare('SELECT tag FROM blacklist_tags WHERE list_id = ?')
                                .all(b.id) as Array<{ tag: string }>
                            for (const t of tags) {
                                try {
                                    await tx.blacklistTag.create({
                                        data: { listId: created.id, tag: t.tag }
                                    })
                                } catch {
                                    // duplicate entry — ignore
                                }
                            }
                            bump()
                        }
                    }

                    if (domains.includes('aliases') && domains.includes('tags')) {
                        const liveTagNames = new Set(
                            (await tx.tag.findMany({ select: { name: true } })).map((t) => t.name)
                        )
                        const groups = backupDb
                            .prepare('SELECT id, real_tag, created_at FROM aliases')
                            .all() as Array<{ id: number; real_tag: string; created_at: string }>
                        for (const a of groups) {
                            const aliasStrings = backupDb
                                .prepare('SELECT tag FROM alias_tags WHERE alias_id = ?')
                                .all(a.id) as Array<{ tag: string }>

                            if (liveTagNames.has(a.real_tag)) {
                                if (options.skipSameName) {
                                    bump()
                                    continue
                                }
                                let alias = await tx.alias.findUnique({
                                    where: { realTag: a.real_tag },
                                    select: { id: true }
                                })
                                if (!alias) {
                                    alias = await tx.alias.create({
                                        data: { realTag: a.real_tag, createdAt: a.created_at }
                                    })
                                }
                                const existingAliasTags = new Set(
                                    (
                                        await tx.aliasTag.findMany({
                                            where: { aliasId: alias.id },
                                            select: { tag: true }
                                        })
                                    ).map((t) => t.tag)
                                )
                                for (const s of aliasStrings) {
                                    if (existingAliasTags.has(s.tag)) continue
                                    try {
                                        await tx.aliasTag.create({
                                            data: { aliasId: alias.id, tag: s.tag }
                                        })
                                    } catch {
                                        // duplicate — ignore
                                    }
                                    existingAliasTags.add(s.tag)
                                }
                            } else {
                                const created = await tx.alias.create({
                                    data: { realTag: a.real_tag, createdAt: a.created_at }
                                })
                                for (const s of aliasStrings) {
                                    try {
                                        await tx.aliasTag.create({
                                            data: { aliasId: created.id, tag: s.tag }
                                        })
                                    } catch {
                                        // duplicate — ignore
                                    }
                                }
                            }
                            bump()
                        }
                    }
                })

                this.resetAutoincrementCounters()
            } finally {
                backupDb.close()
            }
        } catch (err) {
            this.taskManager.failTask(
                taskId,
                err instanceof Error ? err.message : 'Load backup failed'
            )
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Load backup failed'
            }
        } finally {
            await fs.rm(this.tempDir, { recursive: true, force: true }).catch(() => {})
            this.tempDir = null
            this.dbService.unlock()
        }

        const warning =
            skippedRows > 0 ? `${skippedRows} file(s) were skipped (missing on disk).` : undefined
        this.taskManager.completeTask(taskId, warning)
        return { success: true, data: undefined }
    }

    private countAppendSteps(db: Database.Database, domains: BackupDomain[]): number {
        let total = 0
        const count = (sql: string): number => (db.prepare(sql).get() as { c: number }).c

        if (domains.includes('files'))
            total += count('SELECT COUNT(*) AS c FROM files WHERE deleted = 0')
        if (domains.includes('tags')) {
            total += count('SELECT COUNT(*) AS c FROM tags')
            total += count('SELECT COUNT(*) AS c FROM tag_relations')
        }
        if (domains.includes('file_tags')) total += count('SELECT COUNT(*) AS c FROM file_tags')
        if (domains.includes('canvases')) total += count('SELECT COUNT(*) AS c FROM canvases')
        if (domains.includes('blacklists')) total += count('SELECT COUNT(*) AS c FROM blacklists')
        if (domains.includes('aliases')) total += count('SELECT COUNT(*) AS c FROM aliases')
        return total
    }

    private resetAutoincrementCounters(): void {
        const db = new Database(this.dbPath())
        try {
            db.pragma('foreign_keys = ON')
            for (const table of AUTOINCREMENT_TABLES) {
                db.exec(
                    `UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id), 0) FROM ${table}) WHERE name = '${table}'`
                )
            }
        } finally {
            db.close()
        }
    }

    private async rewriteCanvasJson(
        src: string,
        dest: string,
        fileMerge: Map<number, number>
    ): Promise<void> {
        let raw: string
        try {
            raw = await fs.readFile(src, 'utf-8')
        } catch {
            return
        }
        let data: { elements?: Array<{ type?: string; fileId?: number }> }
        try {
            data = JSON.parse(raw)
        } catch {
            return
        }
        if (data && Array.isArray(data.elements)) {
            data.elements = data.elements.filter((el) => {
                if (el && el.type === 'media') {
                    const mapped = fileMerge.get(el.fileId as number)
                    if (mapped == null) return false
                    el.fileId = mapped
                }
                return true
            })
        }
        await fs.writeFile(dest, JSON.stringify(data, null, 2), 'utf-8')
    }

    // ---- purge -------------------------------------------------------------

    async purgeDatabase(win: BrowserWindow): Promise<Result<void>> {
        if (this.dbService.isLocked) {
            return { success: false, error: 'Database is locked' }
        }
        this.dbService.lock()
        const taskId = this.taskManager.createTask('Purge database', win)
        try {
            const db = new Database(this.dbPath())
            try {
                db.pragma('foreign_keys = ON')
                db.transaction(() => {
                    db.exec('DROP TABLE IF EXISTS file_tags')
                    db.exec('DROP TABLE IF EXISTS tag_relations')
                    db.exec('DROP TABLE IF EXISTS blacklist_tags')
                    db.exec('DROP TABLE IF EXISTS alias_tags')
                    db.exec('DROP TABLE IF EXISTS files')
                    db.exec('DROP TABLE IF EXISTS tags')
                    db.exec('DROP TABLE IF EXISTS canvases')
                    db.exec('DROP TABLE IF EXISTS blacklists')
                    db.exec('DROP TABLE IF EXISTS aliases')
                    db.exec(initDDL)
                })()
            } finally {
                db.close()
            }

            await this.wipeDir(this.mediaDir())
            await this.wipeDir(this.canvasesDir())

            this.taskManager.completeTask(taskId)
            return { success: true, data: undefined }
        } catch (err) {
            this.taskManager.failTask(taskId, err instanceof Error ? err.message : 'Purge failed')
            return { success: false, error: err instanceof Error ? err.message : 'Purge failed' }
        } finally {
            this.dbService.unlock()
        }
    }

    // ---- misc --------------------------------------------------------------

    private dateISO(): string {
        return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
    }
}

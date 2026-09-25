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
    BackupSaveOptions,
    FileConflict
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
        return this.loadAdvanced(win, options)
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

    private async loadAdvanced(
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
        for (const d of options.domains) {
            if (!manifestSet.has(d)) {
                return { success: false, error: `Domain '${d}' is not present in the backup.` }
            }
        }

        this.dbService.lock()
        const taskId = this.taskManager.createTask('Load backup (advanced)', win)

        const backupDbPath = path.join(this.tempDir, 'db.sqlite')
        const prisma = this.dbService.prismaClient

        const stats = {
            filesSkipped: 0,
            linksDropped: 0,
            canvasElementsDropped: 0,
            duplicateLiveFiles: 0
        }

        try {
            const backupDb = new Database(backupDbPath, { readonly: true })
            try {
                const total = this.countAdvancedSteps(backupDb, options)
                let done = 0
                const bump = () => {
                    done++
                    const pct = total > 0 ? Math.min(99, Math.round((done / total) * 100)) : 0
                    this.taskManager.updateProgress(taskId, pct)
                }

                const fileMerge = new Map<number, number>()
                const tagMerge = new Map<number, number>()
                // live ids of files created during this import
                const newFileIds = new Set<number>()
                // backup file id -> conflict outcome that rewrites tag links
                const conflictFileModes = new Map<number, FileConflict>()
                const replacedLiveFileIds = new Set<number>()
                const replacedTagIds = new Set<number>()
                // source_urls that already applied a conflict action this import
                const handledSourceUrls = new Set<string>()

                await prisma.$transaction(async (tx) => {
                    // ---- files ------------------------------------------------
                    if (options.domains.includes('files')) {
                        const liveRows = await tx.file.findMany({
                            where: { deleted: false, sourceUrl: { not: null } },
                            select: { id: true, sourceUrl: true },
                            orderBy: { id: 'asc' }
                        })
                        // source_url is not unique — the oldest live row wins; the
                        // extra live copies are left alone and counted in the warning
                        const urlToId = new Map<string, number>()
                        const urlCount = new Map<string, number>()
                        for (const r of liveRows) {
                            if (r.sourceUrl === null) continue
                            const n = (urlCount.get(r.sourceUrl) ?? 0) + 1
                            urlCount.set(r.sourceUrl, n)
                            if (n === 1) urlToId.set(r.sourceUrl, r.id)
                        }
                        for (const n of urlCount.values()) {
                            if (n > 1) stats.duplicateLiveFiles += n - 1
                        }

                        const files = backupDb
                            .prepare(
                                `SELECT id, ext, file_name, media_type, source_url, created_at
                                 FROM files WHERE deleted = 0 ORDER BY created_at, id`
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
                            const matchedLiveId =
                                f.source_url !== null ? urlToId.get(f.source_url) : undefined

                            // ---- conflict: same source_url, live non-deleted row ----
                            if (matchedLiveId != null) {
                                // several backup rows can share a URL/path — the first one
                                // applies the conflict action; later ones only map to the
                                // same live id and never create another row
                                if (f.source_url !== null && handledSourceUrls.has(f.source_url)) {
                                    fileMerge.set(f.id, matchedLiveId)
                                    bump()
                                    continue
                                }
                                if (f.source_url !== null) {
                                    handledSourceUrls.add(f.source_url)
                                }
                                if (options.fileConflict === 'skip') {
                                    fileMerge.set(f.id, matchedLiveId)
                                } else if (options.fileConflict === 'merge-tags') {
                                    fileMerge.set(f.id, matchedLiveId)
                                    conflictFileModes.set(f.id, 'merge-tags')
                                } else if (options.fileConflict === 'replace') {
                                    const liveRow = await tx.file.findUnique({
                                        where: { id: matchedLiveId },
                                        select: { id: true, ext: true }
                                    })
                                    if (!liveRow) {
                                        stats.filesSkipped++
                                        bump()
                                        continue
                                    }
                                    const ext = f.ext
                                    const newPath = this.dbService.fileStorage.filePathFor(
                                        matchedLiveId,
                                        ext
                                    )
                                    const oldPath = this.dbService.fileStorage.filePathFor(
                                        matchedLiveId,
                                        liveRow.ext
                                    )
                                    // Copy the new bytes to a temp path first; only after the
                                    // copy succeeds do we delete the old file and update the row.
                                    const tmpPath = path.join(
                                        app.getPath('temp'),
                                        'ref-sheeter-import-' + crypto.randomUUID()
                                    )
                                    const copied = await this.copyFileIfExists(
                                        path.join(this.tempDir!, 'files', `${f.id}${ext}`),
                                        tmpPath
                                    )
                                    if (!copied) {
                                        stats.filesSkipped++
                                        bump()
                                        continue
                                    }
                                    try {
                                        await fs.copyFile(tmpPath, newPath)
                                        // swap thumbs: clear the destination thumb first, then
                                        // write the backup's (so a replace with no backup thumb
                                        // does not keep the previous one)
                                        const thumbDest = this.dbService.fileStorage.thumbPathFor(
                                            matchedLiveId,
                                            ext
                                        )
                                        await fs.unlink(thumbDest).catch(() => {})
                                        await this.copyFileIfExists(
                                            path.join(
                                                this.tempDir!,
                                                'files',
                                                `${f.id}${ext}_thumb.webp`
                                            ),
                                            thumbDest
                                        )
                                        // Update the row before touching the old file — never
                                        // delete the old bytes while the row still points at it.
                                        await tx.file.update({
                                            where: { id: matchedLiveId },
                                            data: {
                                                ext,
                                                fileName: f.file_name,
                                                mediaType: f.media_type
                                            }
                                        })
                                        await fs.unlink(tmpPath).catch(() => {})
                                        if (oldPath !== newPath) {
                                            await fs.unlink(oldPath).catch(() => {})
                                            await fs
                                                .unlink(
                                                    this.dbService.fileStorage.thumbPathFor(
                                                        matchedLiveId,
                                                        liveRow.ext
                                                    )
                                                )
                                                .catch(() => {})
                                        }
                                        fileMerge.set(f.id, matchedLiveId)
                                        conflictFileModes.set(f.id, 'replace')
                                        replacedLiveFileIds.add(matchedLiveId)
                                    } catch {
                                        // copy failed — live file untouched, counted as a skip
                                        await fs.unlink(tmpPath).catch(() => {})
                                        fileMerge.delete(f.id)
                                        stats.filesSkipped++
                                    }
                                }
                                bump()
                                continue
                            }

                            // ---- no conflict (or source_url null) ----
                            if (!options.addFiles) {
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
                                stats.filesSkipped++
                                bump()
                                continue
                            }

                            await this.copyFileIfExists(
                                path.join(this.tempDir!, 'files', `${f.id}${f.ext}_thumb.webp`),
                                this.dbService.fileStorage.thumbPathFor(created.id, f.ext)
                            )

                            fileMerge.set(f.id, created.id)
                            newFileIds.add(created.id)
                            bump()
                        }
                    }

                    // ---- tags + tag_relations ---------------------------------
                    if (options.domains.includes('tags')) {
                        const tags = backupDb
                            .prepare('SELECT id, name, color FROM tags')
                            .all() as Array<{ id: number; name: string; color: string }>
                        for (const t of tags) {
                            const existing = await tx.tag.findUnique({
                                where: { name: t.name },
                                select: { id: true }
                            })
                            if (existing) {
                                // always id-mapped so file-tag links can resolve,
                                // even when "add tags" is OFF
                                tagMerge.set(t.id, existing.id)
                                if (options.replaceTags) {
                                    await tx.tag.update({
                                        where: { id: existing.id },
                                        data: { color: t.color }
                                    })
                                    replacedTagIds.add(existing.id)
                                }
                            } else if (options.addTags) {
                                const created = await tx.tag.create({
                                    data: { name: t.name, color: t.color }
                                })
                                tagMerge.set(t.id, created.id)
                            }
                            bump()
                        }

                        // replaced tags drop their live parent/child edges first, then
                        // the backup's mapped relations are (re)inserted below
                        for (const liveId of replacedTagIds) {
                            await tx.tagRelation.deleteMany({
                                where: { OR: [{ parentId: liveId }, { childId: liveId }] }
                            })
                        }

                        const relations = backupDb
                            .prepare('SELECT parent_id, child_id FROM tag_relations')
                            .all() as Array<{ parent_id: number; child_id: number }>
                        for (const rel of relations) {
                            const newParent = tagMerge.get(rel.parent_id)
                            const newChild = tagMerge.get(rel.child_id)
                            if (newParent == null || newChild == null) {
                                bump()
                                continue
                            }
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

                    // ---- file_tags (links) ------------------------------------
                    const wantNewFileLinks =
                        options.domains.includes('file_tags') && options.importFileLinks
                    if (wantNewFileLinks || conflictFileModes.size > 0) {
                        // strict-replaced files swap their tag links for the backup's
                        if (replacedLiveFileIds.size > 0) {
                            await tx.fileTag.deleteMany({
                                where: { fileId: { in: [...replacedLiveFileIds] } }
                            })
                        }

                        const backupTagNames = new Map(
                            (
                                backupDb.prepare('SELECT id, name FROM tags').all() as Array<{
                                    id: number
                                    name: string
                                }>
                            ).map((t) => [t.id, t.name])
                        )

                        const links = backupDb
                            .prepare('SELECT file_id, tag_id FROM file_tags')
                            .all() as Array<{ file_id: number; tag_id: number }>
                        for (const ft of links) {
                            const mappedFile = fileMerge.get(ft.file_id)
                            if (mappedFile == null) {
                                stats.linksDropped++
                                bump()
                                continue
                            }
                            // conflict outcomes are handled by the Files row; the File ↔ Tag
                            // links checkbox only covers newly added files
                            const conflictMode = conflictFileModes.get(ft.file_id)
                            const isNewFile = newFileIds.has(mappedFile)
                            if (conflictMode == null && !(isNewFile && wantNewFileLinks)) {
                                bump()
                                continue
                            }
                            // resolve the tag by name against the live DB — never create a
                            // tag just to satisfy a link
                            const tagName = backupTagNames.get(ft.tag_id)
                            if (tagName == null) {
                                stats.linksDropped++
                                bump()
                                continue
                            }
                            const liveTag = await tx.tag.findUnique({
                                where: { name: tagName },
                                select: { id: true }
                            })
                            if (!liveTag) {
                                stats.linksDropped++
                                bump()
                                continue
                            }
                            const existingLink = await tx.fileTag.findUnique({
                                where: {
                                    fileId_tagId: { fileId: mappedFile, tagId: liveTag.id }
                                },
                                select: { fileId: true }
                            })
                            if (!existingLink) {
                                await tx.fileTag.create({
                                    data: { fileId: mappedFile, tagId: liveTag.id }
                                })
                            }
                            bump()
                        }
                    }

                    // ---- canvases ----------------------------------------------
                    if (options.domains.includes('canvases')) {
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
                            const srcJson = path.join(
                                this.tempDir!,
                                'canvases',
                                `canvas-${c.id}.json`
                            )
                            const live = existingNames.has(c.name)
                                ? await tx.canvas.findUnique({
                                      where: { name: c.name },
                                      select: { id: true }
                                  })
                                : null

                            if (live) {
                                if (options.canvasConflict === 'skip') {
                                    bump()
                                    continue
                                }
                                if (options.canvasConflict === 'rename') {
                                    let i = 2
                                    while (existingNames.has(`${c.name} (${i})`)) i++
                                    const name = `${c.name} (${i})`
                                    existingNames.add(name)
                                    const created = await tx.canvas.create({
                                        data: {
                                            name,
                                            createdAt: c.created_at,
                                            updatedAt: c.updated_at
                                        }
                                    })
                                    stats.canvasElementsDropped += await this.rewriteCanvasJson(
                                        srcJson,
                                        path.join(this.canvasesDir(), `canvas-${created.id}.json`),
                                        fileMerge
                                    )
                                    bump()
                                    continue
                                }
                                // replace — keep id/name, overwrite the scene, bump updated_at
                                await tx.canvas.update({
                                    where: { id: live.id },
                                    data: { updatedAt: c.updated_at }
                                })
                                stats.canvasElementsDropped += await this.rewriteCanvasJson(
                                    srcJson,
                                    path.join(this.canvasesDir(), `canvas-${live.id}.json`),
                                    fileMerge
                                )
                                bump()
                                continue
                            }

                            if (!options.addCanvases) {
                                bump()
                                continue
                            }
                            const created = await tx.canvas.create({
                                data: {
                                    name: c.name,
                                    createdAt: c.created_at,
                                    updatedAt: c.updated_at
                                }
                            })
                            existingNames.add(c.name)
                            stats.canvasElementsDropped += await this.rewriteCanvasJson(
                                srcJson,
                                path.join(this.canvasesDir(), `canvas-${created.id}.json`),
                                fileMerge
                            )
                            bump()
                        }
                    }

                    // ---- blacklists --------------------------------------------
                    if (options.domains.includes('blacklists')) {
                        const existingNames = new Set(
                            (await tx.blacklist.findMany({ select: { listName: true } })).map(
                                (b) => b.listName
                            )
                        )
                        const lists = backupDb
                            .prepare('SELECT id, list_name, created_at FROM blacklists')
                            .all() as Array<{ id: number; list_name: string; created_at: string }>
                        for (const b of lists) {
                            const childTags = backupDb
                                .prepare('SELECT tag FROM blacklist_tags WHERE list_id = ?')
                                .all(b.id) as Array<{ tag: string }>
                            const live = existingNames.has(b.list_name)
                                ? await tx.blacklist.findUnique({
                                      where: { listName: b.list_name },
                                      select: { id: true }
                                  })
                                : null

                            if (live) {
                                if (options.blacklistConflict === 'skip') {
                                    bump()
                                    continue
                                }
                                if (options.blacklistConflict === 'rename') {
                                    let i = 2
                                    while (existingNames.has(`${b.list_name} (${i})`)) i++
                                    const name = `${b.list_name} (${i})`
                                    existingNames.add(name)
                                    const created = await tx.blacklist.create({
                                        data: { listName: name, createdAt: b.created_at }
                                    })
                                    for (const t of childTags) {
                                        try {
                                            await tx.blacklistTag.create({
                                                data: { listId: created.id, tag: t.tag }
                                            })
                                        } catch {
                                            // duplicate — ignore
                                        }
                                    }
                                    bump()
                                    continue
                                }
                                if (options.blacklistConflict === 'merge-tags') {
                                    const existingTags = new Set(
                                        (
                                            await tx.blacklistTag.findMany({
                                                where: { listId: live.id },
                                                select: { tag: true }
                                            })
                                        ).map((t) => t.tag)
                                    )
                                    for (const t of childTags) {
                                        if (existingTags.has(t.tag)) continue
                                        try {
                                            await tx.blacklistTag.create({
                                                data: { listId: live.id, tag: t.tag }
                                            })
                                        } catch {
                                            // duplicate — ignore
                                        }
                                        existingTags.add(t.tag)
                                    }
                                    bump()
                                    continue
                                }
                                // replace — swap the child tag strings
                                await tx.blacklistTag.deleteMany({ where: { listId: live.id } })
                                for (const t of childTags) {
                                    try {
                                        await tx.blacklistTag.create({
                                            data: { listId: live.id, tag: t.tag }
                                        })
                                    } catch {
                                        // duplicate — ignore
                                    }
                                }
                                bump()
                                continue
                            }

                            if (!options.addBlacklists) {
                                bump()
                                continue
                            }
                            const created = await tx.blacklist.create({
                                data: { listName: b.list_name, createdAt: b.created_at }
                            })
                            existingNames.add(b.list_name)
                            for (const t of childTags) {
                                try {
                                    await tx.blacklistTag.create({
                                        data: { listId: created.id, tag: t.tag }
                                    })
                                } catch {
                                    // duplicate — ignore
                                }
                            }
                            bump()
                        }
                    }

                    // ---- aliases ------------------------------------------------
                    if (options.domains.includes('aliases')) {
                        // conflict key: aliases.real_tag (@unique) — never the tags table
                        const groups = backupDb
                            .prepare('SELECT id, real_tag, created_at FROM aliases')
                            .all() as Array<{ id: number; real_tag: string; created_at: string }>
                        for (const a of groups) {
                            const aliasStrings = backupDb
                                .prepare('SELECT tag FROM alias_tags WHERE alias_id = ?')
                                .all(a.id) as Array<{ tag: string }>
                            const live = await tx.alias.findUnique({
                                where: { realTag: a.real_tag },
                                select: { id: true }
                            })

                            if (live) {
                                if (options.aliasConflict === 'skip') {
                                    bump()
                                    continue
                                }
                                if (options.aliasConflict === 'merge-tags') {
                                    const existingTags = new Set(
                                        (
                                            await tx.aliasTag.findMany({
                                                where: { aliasId: live.id },
                                                select: { tag: true }
                                            })
                                        ).map((t) => t.tag)
                                    )
                                    for (const s of aliasStrings) {
                                        if (existingTags.has(s.tag)) continue
                                        try {
                                            await tx.aliasTag.create({
                                                data: { aliasId: live.id, tag: s.tag }
                                            })
                                        } catch {
                                            // duplicate — ignore
                                        }
                                        existingTags.add(s.tag)
                                    }
                                    bump()
                                    continue
                                }
                                // replace — swap the alias tag strings
                                await tx.aliasTag.deleteMany({ where: { aliasId: live.id } })
                                for (const s of aliasStrings) {
                                    try {
                                        await tx.aliasTag.create({
                                            data: { aliasId: live.id, tag: s.tag }
                                        })
                                    } catch {
                                        // duplicate — ignore
                                    }
                                }
                                bump()
                                continue
                            }

                            if (!options.addAliases) {
                                bump()
                                continue
                            }
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

        const warningParts: string[] = []
        if (stats.filesSkipped > 0) {
            warningParts.push(
                `${stats.filesSkipped} file(s) skipped (backup file missing on disk or copy failed).`
            )
        }
        if (stats.linksDropped > 0) {
            warningParts.push(
                `${stats.linksDropped} file-tag link(s) dropped (file or tag not found).`
            )
        }
        if (stats.canvasElementsDropped > 0) {
            warningParts.push(
                `${stats.canvasElementsDropped} canvas media element(s) dropped (file not imported).`
            )
        }
        if (stats.duplicateLiveFiles > 0) {
            warningParts.push(
                `${stats.duplicateLiveFiles} duplicate live file(s) sharing a source_url were left untouched.`
            )
        }
        const warning = warningParts.length > 0 ? warningParts.join(' ') : undefined
        this.taskManager.completeTask(taskId, warning)
        return { success: true, data: undefined }
    }

    private countAdvancedSteps(db: Database.Database, options: BackupLoadOptions): number {
        let total = 0
        const count = (sql: string): number => (db.prepare(sql).get() as { c: number }).c
        const domains = options.domains

        if (domains.includes('files'))
            total += count('SELECT COUNT(*) AS c FROM files WHERE deleted = 0')
        if (domains.includes('tags')) {
            total += count('SELECT COUNT(*) AS c FROM tags')
            total += count('SELECT COUNT(*) AS c FROM tag_relations')
        }
        if (
            domains.includes('file_tags') &&
            (options.importFileLinks || options.fileConflict !== 'skip')
        )
            total += count('SELECT COUNT(*) AS c FROM file_tags')
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
    ): Promise<number> {
        let raw: string
        try {
            raw = await fs.readFile(src, 'utf-8')
        } catch {
            return 0
        }
        let data: { elements?: Array<{ type?: string; fileId?: number }> }
        try {
            data = JSON.parse(raw)
        } catch {
            return 0
        }
        let dropped = 0
        if (data && Array.isArray(data.elements)) {
            const elements: Array<{ type?: string; fileId?: number }> = []
            for (const el of data.elements) {
                if (el && el.type === 'media') {
                    const mapped = fileMerge.get(el.fileId as number)
                    if (mapped == null) {
                        dropped++
                        continue
                    }
                    el.fileId = mapped
                }
                elements.push(el)
            }
            data.elements = elements
        }
        await fs.writeFile(dest, JSON.stringify(data, null, 2), 'utf-8')
        return dropped
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

import path from 'path'
import { promises as fs } from 'fs'
import crypto from 'crypto'
import Database from 'better-sqlite3'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { Result } from '../../shared/types/api'
import {
    Canvas,
    CanvasSceneData,
    MediaFile,
    MediaFileSourceType,
    PaginatedCanvases,
    PaginatedMediaFiles,
    Tag,
    TagOperation,
    TagOperationResult,
    TagSearchQuery,
    UploadFilePayload
} from '../../shared/types/models'
import { CanvasService } from './CanvasService'
import { FileStorageService } from './FileStorageService'

const initDDL = `
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        source_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_tags (
        file_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        PRIMARY KEY (file_id, tag_id),
        FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_files_media_type ON files(media_type);

    CREATE TABLE IF NOT EXISTS tag_relations (
        parent_id INTEGER NOT NULL,
        child_id INTEGER NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (parent_id, child_id),
        FOREIGN KEY (parent_id) REFERENCES tags (id) ON DELETE CASCADE,
        FOREIGN KEY (child_id) REFERENCES tags (id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_tag_relations_parent ON tag_relations(parent_id);
    CREATE INDEX IF NOT EXISTS idx_tag_relations_child ON tag_relations(child_id);

    CREATE TABLE IF NOT EXISTS canvases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        data_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`

type FileRow = {
    id: number
    filePath: string
    fileName: string
    mediaType: string
    sourceUrl: string | null
    createdAt: Date
    tags: {
        fileId: number
        tagId: number
        tag: { id: number; name: string; color: string }
    }[]
}

function fileToResponse(f: FileRow) {
    return {
        id: f.id,
        fileName: f.fileName,
        filePath: f.filePath,
        mediaType: f.mediaType as MediaType,
        sourceUrl: f.sourceUrl ?? undefined,
        createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
        tags: f.tags.map((ft) => ({ id: ft.tag.id, name: ft.tag.name, color: ft.tag.color }))
    }
}

function filesToEntries(files: FileRow[]): Array<[number, MediaFile]> {
    return files.map((f) => [f.id, fileToResponse(f)])
}

function extFromPath(p: string | undefined): string {
    if (!p) return ''
    if (p.startsWith('http://') || p.startsWith('https://')) {
        try {
            return path.extname(new URL(p).pathname)
        } catch {
            return ''
        }
    }
    return path.extname(p)
}

function extFromFileName(name: string): string {
    return path.extname(name)
}

function extFromMediaType(mediaType: string): string {
    const map: Record<string, string> = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/svg+xml': '.svg',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'audio/mpeg': '.mp3',
        'audio/wav': '.wav',
        'audio/ogg': '.ogg'
    }
    return map[mediaType] ?? '.bin'
}

export class LocalDatabaseService {
    private prisma: PrismaClient
    private canvasService: CanvasService
    private fileStorage: FileStorageService

    constructor(dbFolderPath: string, fileRootDir: string) {
        const dbPath = path.join(dbFolderPath, 'ref-sheeter.sqlite')

        console.log(dbPath)

        const initDb = new Database(dbPath)
        initDb.pragma('journal_mode = WAL')
        initDb.pragma('foreign_keys = ON')
        initDb.exec(initDDL)

        try {
            initDb.exec('ALTER TABLE files ADD COLUMN source_url TEXT')
        } catch {
            // column already exists on existing databases — safe to ignore
        }

        initDb.close()

        const adapterFactory = new PrismaBetterSqlite3({ url: dbPath })
        this.prisma = new PrismaClient({ adapter: adapterFactory })

        this.canvasService = new CanvasService(this.prisma, path.join(dbFolderPath, 'canvases'))
        this.fileStorage = new FileStorageService(fileRootDir)
    }

    async getFilesPage(page: number, limit: number): Promise<Result<PaginatedMediaFiles>> {
        try {
            // Uncomment to clear all data:
            // const res = await this.prisma.file.deleteMany({})
            // const res2 = await this.prisma.tag.deleteMany({})
            // const res3 = await this.prisma.fileTag.deleteMany({})
            // const res4 = await this.prisma.canvas.deleteMany({})
            // console.log(res, res2, res3, res4)

            const skip = (page - 1) * limit
            const [files, total] = await Promise.all([
                this.prisma.file.findMany({
                    include: { tags: { include: { tag: true } } },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit
                }),
                this.prisma.file.count()
            ])
            return {
                success: true,
                data: {
                    data: filesToEntries(files),
                    total,
                    page,
                    limit
                }
            }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get files.'
            }
        }
    }

    async getFilesOfIds(ids: number[]): Promise<Result<Array<[number, MediaFile]>>> {
        try {
            const files = await this.prisma.file.findMany({
                where: { id: { in: ids } },
                include: { tags: { include: { tag: true } } }
            })
            return { success: true, data: filesToEntries(files) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get files by ids.'
            }
        }
    }

    async getFileOfId(id: number): Promise<Result<MediaFile>> {
        try {
            const file = await this.prisma.file.findUnique({
                where: { id },
                include: { tags: { include: { tag: true } } }
            })
            if (!file) {
                return { success: false, error: `File of id=${id} might not exist` }
            }
            return { success: true, data: fileToResponse(file) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get file.'
            }
        }
    }

    async insertFile(payload: UploadFilePayload): Promise<Result<{ id: number }>> {
        if (payload.source === MediaFileSourceType.LOCAL && !payload.filePath) {
            return { success: false, error: 'Local upload requires filePath.' }
        }
        if (payload.source === MediaFileSourceType.WEB && !payload.mediaUrl) {
            return { success: false, error: 'Web upload requires mediaUrl.' }
        }

        const ext =
            extFromPath(payload.filePath) ||
            extFromPath(payload.mediaUrl) ||
            extFromFileName(payload.fileName) ||
            extFromMediaType(payload.mediaType)

        const placeholder = `pending-${crypto.randomUUID()}`
        let row
        try {
            row = await this.prisma.file.create({
                data: {
                    filePath: placeholder,
                    fileName: payload.fileName,
                    mediaType: payload.mediaType,
                    sourceUrl: payload.sourceUrl ?? null
                }
            })
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to insert file record.'
            }
        }

        let stored: Result<{ storedPath: string }>
        if (payload.source === MediaFileSourceType.LOCAL && payload.filePath) {
            stored = await this.fileStorage.storeLocalFile(row.id, payload.filePath, ext)
        } else if (payload.source === MediaFileSourceType.WEB && payload.mediaUrl) {
            stored = await this.fileStorage.storeWebFile(row.id, payload.mediaUrl, ext)
        } else {
            stored = { success: false, error: 'Unknown source.' }
        }

        if (!stored.success) {
            await this.prisma.file.delete({ where: { id: row.id } }).catch(() => {})
            return { success: false, error: stored.error }
        }

        try {
            await this.prisma.file.update({
                where: { id: row.id },
                data: { filePath: stored.data.storedPath }
            })
        } catch (err) {
            await fs.unlink(stored.data.storedPath).catch(() => {})
            await this.prisma.file.delete({ where: { id: row.id } }).catch(() => {})
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to finalize file path.'
            }
        }

        return { success: true, data: { id: row.id } }
    }

    async processTagOperations(operations: TagOperation[]): Promise<Result<TagOperationResult>> {
        try {
            const affectedFileIds = [...new Set(operations.map((op) => op.fileId))]
            const changedTags: Tag[] = []

            for (const op of operations) {
                if (op.action === 'add' && op.tagName) {
                    const tag = await this.prisma.tag.upsert({
                        where: { name: op.tagName },
                        create: { name: op.tagName, color: '#FFF' },
                        update: {},
                        select: { id: true, name: true, color: true }
                    })
                    try {
                        await this.prisma.fileTag.create({
                            data: { fileId: op.fileId, tagId: tag.id }
                        })
                    } catch {
                        // ignore duplicate (INSERT OR IGNORE equivalent)
                    }
                    changedTags.push(tag)
                } else if (op.action === 'remove' && op.tagId) {
                    await this.prisma.fileTag.deleteMany({
                        where: { fileId: op.fileId, tagId: op.tagId }
                    })
                }
            }

            const files = await this.prisma.file.findMany({
                where: { id: { in: affectedFileIds } },
                include: { tags: { include: { tag: true } } }
            })

            return {
                success: true,
                data: {
                    files: files.map((file) => ({
                        id: file.id,
                        tags: file.tags.map((ft) => ft.tag)
                    })),
                    tags: changedTags
                }
            }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to update tags.'
            }
        }
    }

    async searchFiles(query: TagSearchQuery): Promise<Result<PaginatedMediaFiles>> {
        try {
            const { page = 1, limit = 50 } = query
            const offset = (page - 1) * limit

            const chips = await this.resolveSearchChips(query)

            const hasPositive =
                chips.requiredExactIds.length > 0 ||
                chips.requiredExpandedIds.length > 0 ||
                chips.normalIds.length > 0

            if (
                !hasPositive &&
                chips.excludedExactIds.length === 0 &&
                chips.excludedExpandedIds.length === 0
            ) {
                return this.getFilesPage(page, limit)
            }

            const { candidates, total } = await this.getCandidateFilesWithScores(
                chips,
                offset,
                limit
            )

            if (candidates.length === 0) {
                return {
                    success: true,
                    data: { data: [], total: 0, page, limit }
                }
            }

            const candidateIds = candidates.map((c) => c.id)
            const files = await this.prisma.file.findMany({
                where: { id: { in: candidateIds } },
                include: { tags: { include: { tag: true } } }
            })

            const fileById = new Map(files.map((f) => [f.id, f]))
            const orderedFiles = candidateIds
                .map((id) => fileById.get(id))
                .filter((f): f is FileRow => f !== undefined)

            return {
                success: true,
                data: {
                    data: filesToEntries(orderedFiles),
                    total,
                    page,
                    limit
                }
            }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to search files.'
            }
        }
    }

    async getAllTags(): Promise<Result<Tag[]>> {
        try {
            const tags = await this.prisma.tag.findMany({ orderBy: { name: 'asc' } })
            return { success: true, data: tags }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get all tags.'
            }
        }
    }

    async createTag(name: string, color: string): Promise<Result<Tag>> {
        try {
            const tag = await this.prisma.tag.create({
                data: { name, color }
            })
            return { success: true, data: tag }
        } catch (err: any) {
            if (err?.code === 'P2002') {
                return { success: false, error: 'Tag name already exists.' }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to create tag.'
            }
        }
    }

    async deleteTag(id: number): Promise<Result<void>> {
        try {
            await this.prisma.tag.delete({ where: { id } })
            return { success: true, data: undefined as void }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to delete tag.'
            }
        }
    }

    async updateTagName(id: number, name: string): Promise<Result<Tag>> {
        try {
            const tag = await this.prisma.tag.update({
                where: { id },
                data: { name }
            })
            return { success: true, data: tag }
        } catch (err: any) {
            if (err?.code === 'P2002') {
                return { success: false, error: 'Tag name already exists.' }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to rename tag.'
            }
        }
    }

    async updateTagColor(id: number, color: string): Promise<Result<Tag>> {
        try {
            const tag = await this.prisma.tag.update({
                where: { id },
                data: { color }
            })
            return { success: true, data: tag }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to update tag color.'
            }
        }
    }

    async getAllTagColors(): Promise<Result<string[]>> {
        try {
            const rows = await this.prisma.tag.findMany({
                distinct: ['color'],
                select: { color: true },
                orderBy: { color: 'asc' }
            })
            return { success: true, data: rows.map((r) => r.color) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get tag colors.'
            }
        }
    }

    async getDirectSubtagIds(parentId: number): Promise<Result<number[]>> {
        try {
            const rows = await this.prisma.tagRelation.findMany({
                where: { parentId },
                select: { childId: true }
            })
            return { success: true, data: rows.map((r) => r.childId) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get direct subtags.'
            }
        }
    }

    async getAllSubtagIds(parentId: number): Promise<Result<number[]>> {
        try {
            const rows = await this.prisma.$queryRaw<{ id: number }[]>`
                WITH RECURSIVE descendants(id) AS (
                    SELECT child_id AS id FROM tag_relations WHERE parent_id = ${parentId}
                    UNION
                    SELECT tr.child_id FROM tag_relations tr
                    JOIN descendants d ON tr.parent_id = d.id
                )
                SELECT id FROM descendants
            `
            return { success: true, data: rows.map((r) => r.id) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get all subtags.'
            }
        }
    }

    async getAllParentIds(childId: number): Promise<Result<number[]>> {
        try {
            const rows = await this.prisma.$queryRaw<{ id: number }[]>`
                WITH RECURSIVE ancestors(id) AS (
                    SELECT parent_id AS id FROM tag_relations WHERE child_id = ${childId}
                    UNION
                    SELECT tr.parent_id FROM tag_relations tr
                    JOIN ancestors a ON tr.child_id = a.id
                )
                SELECT id FROM ancestors
            `
            return { success: true, data: rows.map((r) => r.id) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get all parents.'
            }
        }
    }

    private async resolveChipsToIds(chips: string[]): Promise<number[]> {
        const unique = [...new Set(chips)]
        if (unique.length === 0) return []

        const nonWild: string[] = []
        const wild: string[] = []
        for (const chip of unique) {
            if (chip.includes('*')) {
                wild.push(chip)
            } else {
                nonWild.push(chip)
            }
        }

        const idSet = new Set<number>()

        if (nonWild.length > 0) {
            const ph = nonWild.map(() => '?').join(', ')
            const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
                `SELECT id FROM tags WHERE name IN (${ph})`,
                ...nonWild
            )
            for (const r of rows) idSet.add(r.id)
        }

        for (const chip of wild) {
            const likePattern = chip.replaceAll('*', '%')
            const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
                'SELECT id FROM tags WHERE name LIKE ?',
                likePattern
            )
            for (const r of rows) idSet.add(r.id)
        }

        return [...idSet]
    }

    private async resolveSearchChips(query: TagSearchQuery): Promise<{
        requiredExactIds: number[]
        requiredExpandedIds: number[]
        normalIds: number[]
        excludedExactIds: number[]
        excludedExpandedIds: number[]
    }> {
        const exactNames = [...new Set(query.requiredExactTags || [])]
        const exactSet = new Set(exactNames)

        const expandedNames = new Set<string>()
        for (const n of query.requiredExpandedTags || []) {
            if (!exactSet.has(n)) expandedNames.add(n)
        }

        const normalNames = new Set<string>()
        for (const n of query.normalTags || []) {
            if (!exactSet.has(n) && !expandedNames.has(n)) normalNames.add(n)
        }

        const excludedExactNames = [...new Set(query.excludedExactTags || [])]
        const excludedExactSet = new Set(excludedExactNames)

        const excludedExpandedNames = new Set<string>()
        for (const n of query.excludedExpandedTags || []) {
            if (!excludedExactSet.has(n)) excludedExpandedNames.add(n)
        }

        const [
            requiredExactIds,
            requiredExpandedIds,
            normalIds,
            excludedExactIds,
            excludedExpandedIds
        ] = await Promise.all([
            this.resolveChipsToIds([...exactNames]),
            this.resolveChipsToIds([...expandedNames]),
            this.resolveChipsToIds([...normalNames]),
            this.resolveChipsToIds([...excludedExactSet]),
            this.resolveChipsToIds([...excludedExpandedNames])
        ])

        return {
            requiredExactIds,
            requiredExpandedIds,
            normalIds,
            excludedExactIds,
            excludedExpandedIds
        }
    }

    private async getCandidateFilesWithScores(
        chips: {
            requiredExactIds: number[]
            requiredExpandedIds: number[]
            normalIds: number[]
            excludedExactIds: number[]
            excludedExpandedIds: number[]
        },
        offset: number,
        limit: number
    ): Promise<{
        candidates: Array<{ id: number; score: number }>
        total: number
    }> {
        const {
            requiredExactIds,
            requiredExpandedIds,
            normalIds,
            excludedExactIds,
            excludedExpandedIds
        } = chips

        const hasPositive =
            requiredExactIds.length > 0 || requiredExpandedIds.length > 0 || normalIds.length > 0
        const hasRequiredExact = requiredExactIds.length > 0
        const hasRequiredExpanded = requiredExpandedIds.length > 0
        const hasExcludedExact = excludedExactIds.length > 0
        const hasExcludedExpanded = excludedExpandedIds.length > 0

        const cteParts: string[] = []
        const params: unknown[] = []

        if (hasPositive) {
            const values: string[] = []
            for (const id of requiredExactIds) {
                values.push('(?, ?)')
                params.push(id, 'required_exact')
            }
            for (const id of requiredExpandedIds) {
                values.push('(?, ?)')
                params.push(id, 'required_expanded')
            }
            for (const id of normalIds) {
                values.push('(?, ?)')
                params.push(id, 'normal')
            }

            cteParts.push(`positive(literal_id, kind) AS (VALUES ${values.join(', ')})`)
            cteParts.push(`positive_exp(literal_id, expanded_id, distance) AS (
            SELECT literal_id, literal_id, 0 FROM positive
            UNION
            SELECT pe.literal_id, tr.parent_id, pe.distance + 1
            FROM positive_exp pe
            JOIN tag_relations tr ON tr.child_id = pe.expanded_id
            WHERE pe.distance < 100
        )`)
            cteParts.push(`file_positive_min(file_id, literal_id, min_dist) AS (
            SELECT ft.file_id, pe.literal_id, MIN(pe.distance)
            FROM file_tags ft
            JOIN positive_exp pe ON ft.tag_id = pe.expanded_id
            GROUP BY ft.file_id, pe.literal_id
        )`)
            cteParts.push(`file_scores(file_id, score) AS (
            SELECT
                fpm.file_id,
                SUM(CASE
                    WHEN fpm.min_dist = 0 THEN 10
                    WHEN fpm.min_dist = 1 THEN 5
                    ELSE 1
                END) AS score
            FROM file_positive_min fpm
            GROUP BY fpm.file_id
        )`)

            if (hasRequiredExact) {
                cteParts.push(`required_exact_matches(file_id) AS (
                SELECT DISTINCT fpm.file_id
                FROM file_positive_min fpm
                JOIN positive p ON p.literal_id = fpm.literal_id
                WHERE p.kind = 'required_exact' AND fpm.min_dist = 0
            )`)
            }
            if (hasRequiredExpanded) {
                cteParts.push(`required_expanded_matches(file_id) AS (
                SELECT DISTINCT fpm.file_id
                FROM file_positive_min fpm
                JOIN positive p ON p.literal_id = fpm.literal_id
                WHERE p.kind = 'required_expanded'
            )`)
            }
        }

        if (hasExcludedExact) {
            const values = excludedExactIds.map(() => '(?)').join(', ')
            cteParts.push(`excluded_exact(file_id) AS (
            SELECT DISTINCT ft.file_id FROM file_tags ft
            WHERE ft.tag_id IN (${values})
        )`)
            params.push(...excludedExactIds)
        }

        if (hasExcludedExpanded) {
            const values = excludedExpandedIds.map(() => '(?)').join(', ')
            cteParts.push(`excluded(literal_id) AS (VALUES ${values})`)
            params.push(...excludedExpandedIds)
            cteParts.push(`excluded_exp(literal_id, expanded_id, distance) AS (
            SELECT literal_id, literal_id, 0 FROM excluded
            UNION
            SELECT ee.literal_id, tr.parent_id, ee.distance + 1
            FROM excluded_exp ee
            JOIN tag_relations tr ON tr.child_id = ee.expanded_id
            WHERE ee.distance < 100
        )`)
            cteParts.push(`excluded_expanded_matches(file_id) AS (
            SELECT DISTINCT ft.file_id
            FROM file_tags ft
            JOIN excluded_exp ee ON ft.tag_id = ee.expanded_id
        )`)
        }

        const whereConditions: string[] = []

        if (hasRequiredExact) {
            whereConditions.push('fs.file_id IN (SELECT file_id FROM required_exact_matches)')
        }
        if (hasRequiredExpanded) {
            whereConditions.push('fs.file_id IN (SELECT file_id FROM required_expanded_matches)')
        }
        if (hasExcludedExact) {
            whereConditions.push('fs.file_id NOT IN (SELECT file_id FROM excluded_exact)')
        }
        if (hasExcludedExpanded) {
            whereConditions.push(
                'fs.file_id NOT IN (SELECT file_id FROM excluded_expanded_matches)'
            )
        }

        const whereClause =
            whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''

        if (!hasPositive) {
            const excludedWhere = whereClause.replace(/fs\.file_id/g, 'f.id')
            const countSql = `
        WITH ${cteParts.join(',\n')}
        SELECT COUNT(*) as total
        FROM files f
        ${excludedWhere}
        `
            const [{ total }] = await this.prisma.$queryRawUnsafe<[{ total: number }]>(
                countSql,
                ...params
            )
            if (total === 0) return { candidates: [], total: 0 }

            const sql = `
        WITH ${cteParts.join(',\n')}
        SELECT f.id, 0 as score
        FROM files f
        ${excludedWhere}
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
        `
            const candidates = await this.prisma.$queryRawUnsafe<
                Array<{ id: number; score: number }>
            >(sql, ...params, limit, offset)
            return { candidates, total }
        }

        const countSql = `
        WITH ${cteParts.join(',\n')}
        SELECT COUNT(DISTINCT fs.file_id) as total
        FROM file_scores fs
        ${whereClause}
        `
        const [{ total }] = await this.prisma.$queryRawUnsafe<[{ total: number }]>(
            countSql,
            ...params
        )
        if (total === 0) return { candidates: [], total: 0 }

        const sql = `
        WITH ${cteParts.join(',\n')}
        SELECT fs.file_id as id, fs.score as score
        FROM file_scores fs
        ${whereClause}
        ORDER BY fs.score DESC
        LIMIT ? OFFSET ?
        `
        const candidates = await this.prisma.$queryRawUnsafe<Array<{ id: number; score: number }>>(
            sql,
            ...params,
            limit,
            offset
        )
        return { candidates, total }
    }

    async addSubtags(parentId: number, childIds: number[]): Promise<Result<{ added: number[] }>> {
        try {
            const unique = [...new Set(childIds)]
            const valid = unique.filter((id) => id !== parentId)

            if (valid.length === 0 && unique.length > 0) {
                return {
                    success: false,
                    error: 'A tag cannot be a subtag of itself.'
                }
            }

            await this.prisma.$transaction(async (tx) => {
                for (const childId of valid) {
                    const cycles = await tx.$queryRaw<{ id: number }[]>`
                        WITH RECURSIVE descendants(id) AS (
                            SELECT child_id AS id FROM tag_relations WHERE parent_id = ${childId}
                            UNION
                            SELECT tr.child_id FROM tag_relations tr
                            JOIN descendants d ON tr.parent_id = d.id
                        )
                        SELECT id FROM descendants WHERE id = ${parentId}
                    `
                    if (cycles.length > 0) {
                        throw new Error(
                            `Cycle detected: tag ${parentId} is an ancestor of tag ${childId}`
                        )
                    }
                    await tx.tagRelation.upsert({
                        where: {
                            parentId_childId: { parentId, childId }
                        },
                        create: { parentId, childId },
                        update: {}
                    })
                }
            })

            return { success: true, data: { added: valid } }
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('Cycle detected:')) {
                return { success: false, error: err.message }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to add subtags.'
            }
        }
    }

    async removeSubtags(
        parentId: number,
        childIds: number[]
    ): Promise<Result<{ removed: number }>> {
        try {
            const { count } = await this.prisma.tagRelation.deleteMany({
                where: {
                    parentId,
                    childId: { in: childIds }
                }
            })
            return { success: true, data: { removed: count } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to remove subtags.'
            }
        }
    }

    async getAllRelations(): Promise<
        Result<{ childrenByTag: Record<number, number[]>; parentsByTag: Record<number, number[]> }>
    > {
        try {
            const rows = await this.prisma.tagRelation.findMany({
                select: { parentId: true, childId: true }
            })
            const childrenByTag: Record<number, number[]> = {}
            const parentsByTag: Record<number, number[]> = {}
            for (const { parentId, childId } of rows) {
                ;(childrenByTag[parentId] ??= []).push(childId)
                ;(parentsByTag[childId] ??= []).push(parentId)
            }
            return { success: true, data: { childrenByTag, parentsByTag } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get all relations.'
            }
        }
    }

    async getDirectParentIds(childId: number): Promise<Result<number[]>> {
        try {
            const rows = await this.prisma.tagRelation.findMany({
                where: { childId },
                select: { parentId: true }
            })
            return { success: true, data: rows.map((r) => r.parentId) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get parent ids.'
            }
        }
    }

    async addParents(childId: number, parentIds: number[]): Promise<Result<{ added: number[] }>> {
        try {
            const unique = [...new Set(parentIds)]
            const valid = unique.filter((id) => id !== childId)

            if (valid.length === 0 && unique.length > 0) {
                return { success: false, error: 'A tag cannot be a parent of itself.' }
            }

            await this.prisma.$transaction(async (tx) => {
                for (const parentId of valid) {
                    const cycles = await tx.$queryRaw<{ id: number }[]>`
                        WITH RECURSIVE descendants(id) AS (
                            SELECT child_id AS id FROM tag_relations WHERE parent_id = ${childId}
                            UNION
                            SELECT tr.child_id FROM tag_relations tr
                            JOIN descendants d ON tr.parent_id = d.id
                        )
                        SELECT id FROM descendants WHERE id = ${parentId}
                    `
                    if (cycles.length > 0) {
                        throw new Error(
                            `Cycle detected: tag ${childId} is an ancestor of tag ${parentId}`
                        )
                    }
                    await tx.tagRelation.upsert({
                        where: { parentId_childId: { parentId, childId } },
                        create: { parentId, childId },
                        update: {}
                    })
                }
            })

            return { success: true, data: { added: valid } }
        } catch (err) {
            if (err instanceof Error && err.message.startsWith('Cycle detected:')) {
                return { success: false, error: err.message }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to add parents.'
            }
        }
    }

    async removeParents(
        childId: number,
        parentIds: number[]
    ): Promise<Result<{ removed: number }>> {
        try {
            const { count } = await this.prisma.tagRelation.deleteMany({
                where: {
                    childId,
                    parentId: { in: parentIds }
                }
            })
            return { success: true, data: { removed: count } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to remove parents.'
            }
        }
    }

    // Canvas delegation

    async getCanvasesPage(page: number, limit: number): Promise<Result<PaginatedCanvases>> {
        try {
            const skip = (page - 1) * limit
            const [rows, total] = await Promise.all([
                this.prisma.canvas.findMany({
                    orderBy: { updatedAt: 'desc' },
                    skip,
                    take: limit
                }),
                this.prisma.canvas.count()
            ])
            return {
                success: true,
                data: {
                    data: rows.map((r) => this.canvasService.toCanvas(r)),
                    total,
                    page,
                    limit
                }
            }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get canvases.'
            }
        }
    }

    async getCanvasesByIds(ids: number[]): Promise<Result<Array<[number, Canvas]>>> {
        return this.canvasService.getCanvasesByIds(ids)
    }

    async createCanvas(name: string, data: CanvasSceneData): Promise<Result<Canvas>> {
        return this.canvasService.createCanvas(name, data)
    }

    async getAllCanvases(): Promise<Result<Canvas[]>> {
        return this.canvasService.getAllCanvases()
    }

    async getCanvas(id: number): Promise<Result<{ meta: Canvas; data: CanvasSceneData }>> {
        return this.canvasService.getCanvas(id)
    }

    async updateCanvasName(id: number, name: string): Promise<Result<Canvas>> {
        return this.canvasService.updateCanvasName(id, name)
    }

    async updateCanvasData(id: number, data: CanvasSceneData): Promise<Result<void>> {
        return this.canvasService.updateCanvasData(id, data)
    }

    async deleteCanvas(id: number): Promise<Result<void>> {
        return this.canvasService.deleteCanvas(id)
    }
}

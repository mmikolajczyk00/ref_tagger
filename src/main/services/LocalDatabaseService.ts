import path from 'path'
import Database from 'better-sqlite3'
import { PrismaClient } from '../../generated/prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { Result } from '../../shared/types/api'
import {
    MediaFile,
    MediaType,
    PaginatedMediaFiles,
    Tag,
    TagOperation,
    TagOperationResult,
    TagSearchQuery,
    UploadFilePayload
} from '../../shared/types/models'

const initDDL = `
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL UNIQUE,
        file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
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
`

type FileRow = {
    id: number
    filePath: string
    fileName: string
    mediaType: string
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
        createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
        tags: f.tags.map((ft) => ({ id: ft.tag.id, name: ft.tag.name, color: ft.tag.color }))
    }
}

function filesToRecord(files: FileRow[]): Record<number, MediaFile> {
    const result: Record<number, MediaFile> = {}
    for (const file of files) {
        result[file.id] = fileToResponse(file)
    }
    return result
}

function buildNormalTagFilter(tag: string): Record<string, unknown> {
    if (!tag.includes('*')) return { name: tag }

    const parts = tag.split('*')
    const conds: Record<string, unknown>[] = []

    if (parts[0]) conds.push({ name: { startsWith: parts[0] } })
    const last = parts[parts.length - 1]
    if (last) conds.push({ name: { endsWith: last } })
    for (let i = 1; i < parts.length - 1; i++) {
        if (parts[i]) conds.push({ name: { contains: parts[i] } })
    }

    if (conds.length === 0) return { name: { contains: '' } }
    if (conds.length === 1) return conds[0]
    return { AND: conds }
}

export class LocalDatabaseService {
    private prisma: PrismaClient

    constructor(dbFolderPath: string) {
        const dbPath = path.join(dbFolderPath, 'ref-sheeter.sqlite')

        const initDb = new Database(dbPath)
        initDb.pragma('journal_mode = WAL')
        initDb.pragma('foreign_keys = ON')
        initDb.exec(initDDL)
        initDb.close()

        const adapterFactory = new PrismaBetterSqlite3({ url: dbPath })
        this.prisma = new PrismaClient({ adapter: adapterFactory })
    }

    async getFilesPage(page: number, limit: number): Promise<Result<PaginatedMediaFiles>> {
        try {
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
                    data: filesToRecord(files),
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

    async getFilesOfIds(ids: number[]): Promise<Result<Record<number, MediaFile>>> {
        try {
            const files = await this.prisma.file.findMany({
                where: { id: { in: ids } },
                include: { tags: { include: { tag: true } } }
            })
            return { success: true, data: filesToRecord(files) }
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

    async insertFile(payload: UploadFilePayload): Promise<Result<void>> {
        try {
            await this.prisma.file.create({
                data: {
                    filePath: payload.filePath,
                    fileName: payload.fileName,
                    mediaType: payload.mediaType
                }
            })
            return { success: true, data: undefined as void }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to insert file.'
            }
        }
    }

    async processTagOperations(operations: TagOperation[]): Promise<Result<TagOperationResult>> {
        try {
            const affectedFileIds = [...new Set(operations.map((op) => op.fileId))]
            const changedTags: Tag[] = []

            for (const op of operations) {
                if (op.action === 'add' && op.tagName) {
                    const tag = await this.prisma.tag.upsert({
                        where: { name: op.tagName },
                        create: { name: op.tagName, color: '#808080' },
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
            const requiredTags = [...new Set(query.requiredTags || [])]
            const excludedTags = [...new Set(query.excludedTags || [])]
            const normalTags = [...new Set(query.normalTags || [])]

            const conditions: Record<string, unknown>[] = []

            if (excludedTags.length > 0) {
                conditions.push({
                    NOT: { tags: { some: { tag: { name: { in: excludedTags } } } } }
                })
            }

            for (const name of requiredTags) {
                conditions.push({ tags: { some: { tag: { name } } } })
            }

            if (normalTags.length > 0) {
                const normalFilters = normalTags.map((tag) => ({
                    tags: { some: { tag: buildNormalTagFilter(tag) } }
                }))
                conditions.push(
                    normalFilters.length === 1 ? normalFilters[0] : { OR: normalFilters }
                )
            }

            const where = conditions.length > 0 ? { AND: conditions } : {}

            const [files, total] = await Promise.all([
                this.prisma.file.findMany({
                    where,
                    include: { tags: { include: { tag: true } } },
                    orderBy: { createdAt: 'desc' },
                    skip: offset,
                    take: limit
                }),
                this.prisma.file.count({ where })
            ])

            return {
                success: true,
                data: {
                    data: filesToRecord(files),
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
}

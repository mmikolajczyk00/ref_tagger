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
            // Uncomment to clear all data:
            // const res = await this.prisma.file.deleteMany({})
            // const res2 = await this.prisma.tag.deleteMany({})
            // const res3 = await this.prisma.fileTag.deleteMany({})
            // console.log(res, res2, res3)

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

            const conditions: Record<string, unknown>[] = []

            const requiredExactTags = [...new Set(query.requiredExactTags || [])]
            const requiredExpandedTags = [...new Set(query.requiredExpandedTags || [])]

            for (const chip of requiredExactTags) {
                const tag = await this.prisma.tag.findFirst({
                    where: { name: chip },
                    select: { id: true }
                })
                if (tag) {
                    conditions.push({ tags: { some: { tag: { id: tag.id } } } })
                } else {
                    conditions.push({ id: -1 })
                }
            }

            for (const chip of requiredExpandedTags) {
                const ids = await this.expandChipToTagIds(chip)
                if (ids.length > 0) {
                    conditions.push({ tags: { some: { tag: { id: { in: ids } } } } })
                } else {
                    conditions.push({ id: -1 })
                }
            }

            const excludedExactTags = [...new Set(query.excludedExactTags || [])]
            const excludedExpandedTags = [...new Set(query.excludedExpandedTags || [])]

            if (excludedExactTags.length > 0 || excludedExpandedTags.length > 0) {
                const excludedIds = new Set<number>()

                for (const chip of excludedExactTags) {
                    const tag = await this.prisma.tag.findFirst({
                        where: { name: chip },
                        select: { id: true }
                    })
                    if (tag) excludedIds.add(tag.id)
                }

                for (const chip of excludedExpandedTags) {
                    const ids = await this.expandChipToTagIds(chip)
                    for (const id of ids) excludedIds.add(id)
                }

                if (excludedIds.size > 0) {
                    conditions.push({
                        NOT: { tags: { some: { tag: { id: { in: [...excludedIds] } } } } }
                    })
                }
            }

            const normalTags = [...new Set(query.normalTags || [])]
            if (normalTags.length > 0) {
                const normalIds = new Set<number>()
                for (const chip of normalTags) {
                    const ids = await this.expandChipToTagIds(chip)
                    for (const id of ids) normalIds.add(id)
                }
                conditions.push(
                    normalIds.size > 0
                        ? { tags: { some: { tag: { id: { in: [...normalIds] } } } } }
                        : { id: -1 }
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

    private async expandChipToTagIds(chip: string): Promise<number[]> {
        if (chip.includes('*')) {
            const likePattern = chip.replaceAll('*', '%')
            const rows = await this.prisma.$queryRaw<{ id: number }[]>`
                WITH RECURSIVE ancestors(id) AS (
                    SELECT id FROM tags WHERE name LIKE ${likePattern}
                    UNION
                    SELECT tr.parent_id FROM tag_relations tr
                    JOIN ancestors a ON tr.child_id = a.id
                )
                SELECT id FROM ancestors
            `
            return rows.map((r) => r.id)
        }

        const tag = await this.prisma.tag.findFirst({
            where: { name: chip },
            select: { id: true }
        })
        if (!tag) return []

        const ancestors = await this.prisma.$queryRaw<{ id: number }[]>`
            WITH RECURSIVE ancestors(id) AS (
                SELECT parent_id AS id FROM tag_relations WHERE child_id = ${tag.id}
                UNION
                SELECT tr.parent_id FROM tag_relations tr
                JOIN ancestors a ON tr.child_id = a.id
            )
            SELECT id FROM ancestors
        `
        return [tag.id, ...ancestors.map((r) => r.id)]
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
}

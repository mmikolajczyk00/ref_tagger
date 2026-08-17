import { PrismaClient } from '../../generated/prisma/client'
import { Result } from '../../shared/types/api'
import { Tag, TagOperation, TagOperationResult } from '../../shared/types/models'

export class TagService {
    constructor(private prisma: PrismaClient) {}

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

    async addTagsToFiles(
        tagNames: string[],
        fileIds: number[]
    ): Promise<Result<{ addedFilesByTagId: Record<number, number[]>; createdTagIds: number[] }>> {
        try {
            const uniqueTagNames = [...new Set(tagNames)]
            if (fileIds.length === 0 || uniqueTagNames.length === 0) {
                return {
                    success: true,
                    data: { addedFilesByTagId: {}, createdTagIds: [] }
                }
            }

            const data = await this.prisma.$transaction(async (tx) => {
                const tagIds: number[] = []
                const createdTagIds: number[] = []

                for (const tagName of uniqueTagNames) {
                    const existing = await tx.tag.findUnique({
                        where: { name: tagName },
                        select: { id: true }
                    })

                    if (existing) {
                        tagIds.push(existing.id)
                    } else {
                        const created = await tx.tag.create({
                            data: { name: tagName, color: '#FFF' },
                            select: { id: true }
                        })
                        tagIds.push(created.id)
                        createdTagIds.push(created.id)
                    }
                }

                const existingLinks = await tx.fileTag.findMany({
                    where: { tagId: { in: tagIds }, fileId: { in: fileIds } },
                    select: { tagId: true, fileId: true }
                })
                const linkedKeys = new Set(existingLinks.map((row) => `${row.tagId}:${row.fileId}`))

                const addedFilesByTagId: Record<number, number[]> = {}
                const inserts: { tagId: number; fileId: number }[] = []

                for (const tagId of tagIds) {
                    const bucket: number[] = []
                    for (const fileId of fileIds) {
                        if (linkedKeys.has(`${tagId}:${fileId}`)) continue
                        bucket.push(fileId)
                        inserts.push({ tagId, fileId })
                    }
                    addedFilesByTagId[tagId] = bucket
                }

                if (inserts.length > 0) {
                    await tx.fileTag.createMany({ data: inserts })
                }

                return { addedFilesByTagId, createdTagIds }
            })

            return { success: true, data }
        } catch (err) {
            if (err instanceof Error && err.message.includes('Unique constraint')) {
                return { success: false, error: 'Tag name already exists.' }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to add tags to files.'
            }
        }
    }

    async removeTagsFromFiles(
        tagIds: number[],
        fileIds: number[]
    ): Promise<
        Result<{
            removedFilesByTagId: Record<number, number[]>
            remainingFileTagCount: Record<number, number>
        }>
    > {
        try {
            const uniqueTagIds = [...new Set(tagIds)]
            if (fileIds.length === 0 || uniqueTagIds.length === 0) {
                return {
                    success: true,
                    data: {
                        removedFilesByTagId: {},
                        remainingFileTagCount: Object.fromEntries(uniqueTagIds.map((id) => [id, 0]))
                    }
                }
            }

            const { removedFilesByTagId, remainingFileTagCount } = await this.prisma.$transaction(
                async (tx) => {
                    const existing = await tx.fileTag.findMany({
                        where: { tagId: { in: uniqueTagIds }, fileId: { in: fileIds } },
                        select: { tagId: true, fileId: true }
                    })

                    const result: Record<number, number[]> = {}
                    for (const tagId of uniqueTagIds) {
                        result[tagId] = []
                    }
                    for (const row of existing) {
                        result[row.tagId].push(row.fileId)
                    }

                    if (existing.length > 0) {
                        await tx.fileTag.deleteMany({
                            where: { tagId: { in: uniqueTagIds }, fileId: { in: fileIds } }
                        })
                    }

                    const grouped = await tx.fileTag.groupBy({
                        by: ['tagId'],
                        where: { tagId: { in: uniqueTagIds } },
                        _count: { _all: true }
                    })
                    const remaining: Record<number, number> = {}
                    for (const tagId of uniqueTagIds) {
                        remaining[tagId] = 0
                    }
                    for (const row of grouped) {
                        remaining[row.tagId] = row._count._all
                    }

                    return { removedFilesByTagId: result, remainingFileTagCount: remaining }
                }
            )

            return { success: true, data: { removedFilesByTagId, remainingFileTagCount } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to remove tags from files.'
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
}

import { PrismaClient } from '../../generated/prisma/client'
import { Result } from '../../shared/types/api'
import { Alias, Blacklist } from '../../shared/types/models'

export class TagsProcessingService {
    constructor(private prisma: PrismaClient) {}

    private toBlacklist(row: {
        id: number
        listName: string
        createdAt: Date | string
        tags: { tag: string }[]
    }): Blacklist {
        return {
            id: row.id,
            listName: row.listName,
            tags: row.tags.map((t) => t.tag),
            createdAt:
                row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
        }
    }

    private toAlias(row: {
        id: number
        realTag: string
        createdAt: Date | string
        aliases: { tag: string }[]
    }): Alias {
        return {
            id: row.id,
            realTag: row.realTag,
            aliasTags: row.aliases.map((a) => a.tag),
            createdAt:
                row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
        }
    }

    // Blacklist CRUD

    async createBlacklist(listName: string): Promise<Result<Blacklist>> {
        try {
            const row = await this.prisma.blacklist.create({
                data: { listName },
                include: { tags: { select: { tag: true } } }
            })
            return { success: true, data: this.toBlacklist(row) }
        } catch (err: any) {
            if (err?.code === 'P2002') {
                return { success: false, error: 'Blacklist name already exists.' }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to create blacklist.'
            }
        }
    }

    async renameBlacklist(id: number, listName: string): Promise<Result<Blacklist>> {
        try {
            const row = await this.prisma.blacklist.update({
                where: { id },
                data: { listName },
                include: { tags: { select: { tag: true } } }
            })
            return { success: true, data: this.toBlacklist(row) }
        } catch (err: any) {
            if (err?.code === 'P2002') {
                return { success: false, error: 'Blacklist name already exists.' }
            }
            if (err?.code === 'P2025') {
                return { success: false, error: `Blacklist with id=${id} not found.` }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to rename blacklist.'
            }
        }
    }

    async deleteBlacklist(id: number): Promise<Result<void>> {
        try {
            await this.prisma.blacklist.delete({ where: { id } })
            return { success: true, data: undefined as void }
        } catch (err: any) {
            if (err?.code === 'P2025') {
                return { success: false, error: `Blacklist with id=${id} not found.` }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to delete blacklist.'
            }
        }
    }

    async getAllBlacklists(): Promise<Result<Blacklist[]>> {
        try {
            const rows = await this.prisma.blacklist.findMany({
                include: { tags: { select: { tag: true } } },
                orderBy: { listName: 'asc' }
            })
            return { success: true, data: rows.map((r) => this.toBlacklist(r)) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get blacklists.'
            }
        }
    }

    async getBlacklist(id: number): Promise<Result<Blacklist>> {
        try {
            const row = await this.prisma.blacklist.findUnique({
                where: { id },
                include: { tags: { select: { tag: true } } }
            })
            if (!row) {
                return { success: false, error: `Blacklist with id=${id} not found.` }
            }
            return { success: true, data: this.toBlacklist(row) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get blacklist.'
            }
        }
    }

    async addBlacklistTags(listId: number, tags: string[]): Promise<Result<{ added: string[] }>> {
        try {
            const unique = [...new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0))]
            if (unique.length === 0) {
                return { success: false, error: 'No valid tags provided.' }
            }

            const list = await this.prisma.blacklist.findUnique({
                where: { id: listId },
                select: { id: true }
            })
            if (!list) {
                return { success: false, error: `Blacklist with id=${listId} not found.` }
            }

            const added: string[] = []
            for (const tag of unique) {
                try {
                    await this.prisma.blacklistTag.create({
                        data: { listId, tag }
                    })
                    added.push(tag)
                } catch {
                    // duplicate (INSERT OR IGNORE equivalent)
                }
            }

            return { success: true, data: { added } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to add blacklist tags.'
            }
        }
    }

    async removeBlacklistTag(listId: number, tag: string): Promise<Result<void>> {
        try {
            await this.prisma.blacklistTag.deleteMany({
                where: { listId, tag }
            })
            return { success: true, data: undefined as void }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to remove blacklist tag.'
            }
        }
    }

    // Alias CRUD

    async createAlias(realTag: string): Promise<Result<Alias>> {
        try {
            const row = await this.prisma.alias.create({
                data: { realTag },
                include: { aliases: { select: { tag: true } } }
            })
            return { success: true, data: this.toAlias(row) }
        } catch (err: any) {
            if (err?.code === 'P2002') {
                return { success: false, error: 'Real tag already exists.' }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to create alias.'
            }
        }
    }

    async renameAlias(id: number, realTag: string): Promise<Result<Alias>> {
        try {
            const row = await this.prisma.alias.update({
                where: { id },
                data: { realTag },
                include: { aliases: { select: { tag: true } } }
            })
            return { success: true, data: this.toAlias(row) }
        } catch (err: any) {
            if (err?.code === 'P2002') {
                return { success: false, error: 'Real tag already exists.' }
            }
            if (err?.code === 'P2025') {
                return { success: false, error: `Alias with id=${id} not found.` }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to rename alias.'
            }
        }
    }

    async deleteAlias(id: number): Promise<Result<void>> {
        try {
            await this.prisma.alias.delete({ where: { id } })
            return { success: true, data: undefined as void }
        } catch (err: any) {
            if (err?.code === 'P2025') {
                return { success: false, error: `Alias with id=${id} not found.` }
            }
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to delete alias.'
            }
        }
    }

    async getAllAliases(): Promise<Result<Alias[]>> {
        try {
            const rows = await this.prisma.alias.findMany({
                include: { aliases: { select: { tag: true } } },
                orderBy: { realTag: 'asc' }
            })
            return { success: true, data: rows.map((r) => this.toAlias(r)) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get aliases.'
            }
        }
    }

    async getAlias(id: number): Promise<Result<Alias>> {
        try {
            const row = await this.prisma.alias.findUnique({
                where: { id },
                include: { aliases: { select: { tag: true } } }
            })
            if (!row) {
                return { success: false, error: `Alias with id=${id} not found.` }
            }
            return { success: true, data: this.toAlias(row) }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to get alias.'
            }
        }
    }

    async addAliasTags(aliasId: number, tags: string[]): Promise<Result<{ added: string[] }>> {
        try {
            const unique = [...new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0))]
            if (unique.length === 0) {
                return { success: false, error: 'No valid tags provided.' }
            }

            const alias = await this.prisma.alias.findUnique({
                where: { id: aliasId },
                select: { id: true }
            })
            if (!alias) {
                return { success: false, error: `Alias with id=${aliasId} not found.` }
            }

            const added: string[] = []
            for (const tag of unique) {
                try {
                    await this.prisma.aliasTag.create({
                        data: { aliasId, tag }
                    })
                    added.push(tag)
                } catch {
                    // duplicate (INSERT OR IGNORE equivalent)
                }
            }

            return { success: true, data: { added } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to add alias tags.'
            }
        }
    }

    async removeAliasTag(aliasId: number, tag: string): Promise<Result<void>> {
        try {
            await this.prisma.aliasTag.deleteMany({
                where: { aliasId, tag }
            })
            return { success: true, data: undefined as void }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to remove alias tag.'
            }
        }
    }
}

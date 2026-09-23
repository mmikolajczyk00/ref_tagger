import { PrismaClient } from '../../generated/prisma/client'
import { FileService } from './FileService'
import { Result } from '../../shared/types/api'
import { PaginatedMediaFiles, TagSearchQuery } from '../../shared/types/models'

export class SearchService {
    constructor(
        private prisma: PrismaClient,
        private fileService: FileService
    ) {}

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
                return this.fileService.getFilesPage(page, limit)
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
                where: { id: { in: candidateIds }, deleted: false },
                include: { tags: { include: { tag: true } } }
            })

            const fileById = new Map(files.map((f) => [f.id, f]))
            const orderedFiles = candidateIds
                .map((id) => fileById.get(id))
                .filter((f) => f !== undefined)

            return {
                success: true,
                data: {
                    data: orderedFiles.map((f) => [f.id, this.fileService.fileToResponse(f)]),
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
            const fileWhere = excludedWhere
                ? `${excludedWhere} AND f.deleted = 0`
                : 'WHERE f.deleted = 0'
            const countSql = `
        WITH ${cteParts.join(',\n')}
        SELECT COUNT(*) as total
        FROM files f
        ${fileWhere}
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
        ${fileWhere}
        ORDER BY f.created_at DESC
        LIMIT ? OFFSET ?
        `
            const candidates = await this.prisma.$queryRawUnsafe<
                Array<{ id: number; score: number }>
            >(sql, ...params, limit, offset)
            return { candidates, total }
        }

        const deletedFilter = 'fs.file_id NOT IN (SELECT id FROM files WHERE deleted = 1)'
        const scoreWhere = whereClause
            ? `${whereClause} AND ${deletedFilter}`
            : `WHERE ${deletedFilter}`

        const countSql = `
        WITH ${cteParts.join(',\n')}
        SELECT COUNT(DISTINCT fs.file_id) as total
        FROM file_scores fs
        ${scoreWhere}
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
        ${scoreWhere}
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
}

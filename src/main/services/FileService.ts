import path from 'path'
import { PrismaClient } from '../../generated/prisma/client'
import { FileStorageService } from './FileStorageService'
import { Result } from '../../shared/types/api'
import {
    MediaFile,
    MediaFileSourceType,
    MediaType,
    PaginatedMediaFiles,
    UploadFilePayload
} from '../../shared/types/models'
import { extFromMediaType } from '../../shared/utils/mediaType'

type FileRow = {
    id: number
    ext: string
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

export class FileService {
    constructor(
        private prisma: PrismaClient,
        private fileStorage: FileStorageService
    ) {}

    filePathOf(id: number, ext: string): string {
        return this.fileStorage.filePathFor(id, ext)
    }

    fileToResponse(f: FileRow): MediaFile {
        return {
            id: f.id,
            fileName: f.fileName,
            filePath: this.filePathOf(f.id, f.ext),
            mediaType: f.mediaType as MediaType,
            sourceUrl: f.sourceUrl ?? undefined,
            createdAt:
                f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
            tags: f.tags.map((ft) => ({ id: ft.tag.id, name: ft.tag.name, color: ft.tag.color }))
        }
    }

    private filesToEntries(files: FileRow[]): Array<[number, MediaFile]> {
        return files.map((f) => [f.id, this.fileToResponse(f)])
    }

    async getFilesPage(page: number, limit: number): Promise<Result<PaginatedMediaFiles>> {
        try {
            const skip = (page - 1) * limit
            const [files, total] = await Promise.all([
                this.prisma.file.findMany({
                    where: { deleted: false },
                    include: { tags: { include: { tag: true } } },
                    orderBy: { createdAt: 'desc' },
                    skip,
                    take: limit
                }),
                this.prisma.file.count({ where: { deleted: false } })
            ])
            return {
                success: true,
                data: {
                    data: this.filesToEntries(files),
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
                where: { id: { in: ids }, deleted: false },
                include: { tags: { include: { tag: true } } }
            })
            return { success: true, data: this.filesToEntries(files) }
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
            if (!file || file.deleted) {
                return { success: false, error: `File of id=${id} might not exist` }
            }
            return { success: true, data: this.fileToResponse(file) }
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
        if (payload.source === MediaFileSourceType.WEB && !payload.mediaUrl && !payload.filePath) {
            console.log(payload)

            return { success: false, error: 'Web upload requires mediaUrl or filePath.' }
        }

        const ext =
            extFromPath(payload.filePath) ||
            extFromPath(payload.mediaUrl) ||
            extFromFileName(payload.fileName) ||
            extFromMediaType(payload.mediaType)

        let row: { id: number }
        try {
            row = await this.prisma.file.create({
                data: {
                    ext,
                    fileName: payload.fileName,
                    mediaType: payload.mediaType,
                    sourceUrl: payload.sourceUrl ?? null
                },
                select: { id: true }
            })
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to insert file record.'
            }
        }

        let stored: Result<{ storedPath: string; thumbPath?: string }>
        if (payload.source === MediaFileSourceType.WEB && payload.filePath) {
            if (!payload.thumb) {
                await this.prisma.file.delete({ where: { id: row.id } }).catch(() => {})
                return { success: false, error: 'Web upload (downloaded) requires thumb.' }
            }
            stored = await this.fileStorage.storeDownloadedWebFile(
                row.id,
                payload.filePath,
                ext,
                payload.thumb
            )
        } else if (payload.source === MediaFileSourceType.LOCAL && payload.filePath) {
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

        return { success: true, data: { id: row.id } }
    }

    async softDeleteFiles(ids: number[]): Promise<Result<{ deleted: number }>> {
        try {
            const { count } = await this.prisma.file.updateMany({
                where: { id: { in: ids } },
                data: { deleted: true }
            })
            return { success: true, data: { deleted: count } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to delete files.'
            }
        }
    }

    async restoreFiles(ids: number[]): Promise<Result<{ restored: number }>> {
        try {
            const { count } = await this.prisma.file.updateMany({
                where: { id: { in: ids } },
                data: { deleted: false }
            })
            return { success: true, data: { restored: count } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to restore files.'
            }
        }
    }

    async hardDeleteFiles(ids: number[]): Promise<Result<{ deleted: number }>> {
        try {
            const rows = await this.prisma.file.findMany({
                where: { id: { in: ids } },
                select: { id: true, ext: true }
            })
            await Promise.all(rows.map((r) => this.fileStorage.deleteStoredFile(r.id, r.ext)))
            const { count } = await this.prisma.file.deleteMany({
                where: { id: { in: ids } }
            })
            return { success: true, data: { deleted: count } }
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to delete files.'
            }
        }
    }

    async purgeDeletedFiles(): Promise<Result<{ deleted: number }>> {
        try {
            const rows = await this.prisma.file.findMany({
                where: { deleted: true },
                select: { id: true }
            })
            if (rows.length === 0) {
                return { success: true, data: { deleted: 0 } }
            }
            return this.hardDeleteFiles(rows.map((r) => r.id))
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to purge deleted files.'
            }
        }
    }
}

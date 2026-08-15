import path from 'path'
import { promises as fs } from 'fs'
import crypto from 'crypto'
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

export class FileService {
    constructor(
        private prisma: PrismaClient,
        private fileStorage: FileStorageService
    ) {}

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
        if (payload.source === MediaFileSourceType.WEB && !payload.mediaUrl && !payload.filePath) {
            console.log(payload)

            return { success: false, error: 'Web upload requires mediaUrl or filePath.' }
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
}

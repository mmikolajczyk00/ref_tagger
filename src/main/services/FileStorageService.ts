import { promises as fs } from 'fs'
import path from 'path'
import { net } from 'electron'
import sharp from 'sharp'
import { Result } from '../../shared/types/api'
import { execFile } from 'child_process'
import { mediaTypeFromExt } from '../../shared/utils/mediaType'
import ffmpegPath from 'ffmpeg-static'

export class FileStorageService {
    private readonly filesDir: string
    private readonly tempThumbsDir: string

    constructor(rootDir: string) {
        this.filesDir = path.join(rootDir, 'files')
        this.tempThumbsDir = path.join(rootDir, 'tempThumbs')
        fs.mkdir(this.filesDir, { recursive: true })
        fs.mkdir(this.tempThumbsDir, { recursive: true })
    }

    getRootDir(): string {
        return path.resolve(this.filesDir)
    }

    private thumbPathFor(storedPath: string): string {
        return `${storedPath}_thumb.webp`
    }
    private tempThumbPathFor(storedPath: string): string {
        return `${path.join(this.tempThumbsDir, path.basename(storedPath))}_temp_thumb.webp`
    }

    private async generateThumbnailFromBuffer(buffer: Buffer, target: string): Promise<boolean> {
        try {
            await sharp(buffer)
                .resize(200, 200, { fit: 'inside' })
                .webp({ quality: 80 })
                .toFile(target)
            return true
        } catch (err) {
            console.warn(`Thumbnail generation failed for ${target}:`, err)
            return false
        }
    }

    private async generateThumbnailFromImagePath(source: string, target: string): Promise<boolean> {
        try {
            await sharp(source)
                .resize(200, 200, { fit: 'inside' })
                .webp({ quality: 80 })
                .toFile(target)
            return true
        } catch (err) {
            console.warn(`Thumbnail generation failed for ${target}:`, err)
            return false
        }
    }

    private async generateThumbnailFromVideoPath(source: string, target: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                const executable = ffmpegPath || 'ffmpeg'

                execFile(
                    executable,
                    [
                        '-ss',
                        '00:00:01',
                        '-i',
                        source,
                        '-vf',
                        'scale=200:200:force_original_aspect_ratio=decrease',
                        '-vframes',
                        '1',
                        '-y',
                        target
                    ],
                    (error, stdout) => {
                        if (error) throw error

                        console.log(stdout)
                        resolve(true)
                    }
                )
            } catch (err) {
                console.warn(`Thumbnail generation failed for ${target}:`, err)
                reject(false)
            }
        })
    }

    private async generateThumbnailFromUrl(url: string, target: string): Promise<boolean> {
        try {
            const response = await net.fetch(url)
            if (!response.ok) {
                console.warn(`Thumbnail download failed for ${url}: HTTP ${response.status}`)
                return false
            }
            const buffer = Buffer.from(await response.arrayBuffer())
            return this.generateThumbnailFromBuffer(buffer, target)
        } catch (err) {
            console.warn(`Thumbnail generation failed for ${target}:`, err)
            return false
        }
    }

    async createTempVideoThumb(srcPath: string): Promise<Result<{ thumb: string }>> {
        try {
            const ext = path.extname(srcPath)
            const mediaType = mediaTypeFromExt(ext)
            if (mediaType != 'video') {
                return { success: false, error: `Unsupported media type: ${mediaType}` }
            }

            const tempThumb = this.tempThumbPathFor(srcPath)
            await this.generateThumbnailFromVideoPath(srcPath, tempThumb)
            return { success: true, data: { thumb: tempThumb } }
        } catch (err) {
            console.warn(`Thumbnail generation failed for ${srcPath}:`, err)
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Thumbnail generation failed.'
            }
        }
    }

    async clearTempThumbs(): Promise<Result<void>> {
        try {
            const entries = await fs.readdir(this.tempThumbsDir)
            await Promise.all(
                entries.map((name) =>
                    fs.unlink(path.join(this.tempThumbsDir, name)).catch(() => {})
                )
            )
        } catch (err) {
            console.warn('Temp thumb cleanup failed:', err)
        }
        return { success: true, data: undefined }
    }

    async storeDownloadedWebFile(
        id: number,
        sourcePath: string,
        ext: string,
        thumb: string
    ): Promise<Result<{ storedPath: string; thumbPath?: string }>> {
        const target = path.join(this.filesDir, `${id}${ext}`)
        try {
            await fs.rename(sourcePath, target)
        } catch (err) {
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to rename file.'
            }
        }

        const thumbTarget = this.thumbPathFor(target)
        let success = false
        if (/^https?:\/\//i.test(thumb)) {
            success = await this.generateThumbnailFromUrl(thumb, thumbTarget)
        } else {
            success = await this.generateThumbnailFromImagePath(thumb, thumbTarget)
        }

        return {
            success: true,
            data: { storedPath: target, thumbPath: success ? thumbTarget : undefined }
        }
    }

    async storeLocalFile(
        id: number,
        sourcePath: string,
        ext: string
    ): Promise<Result<{ storedPath: string; thumbPath?: string }>> {
        const target = path.join(this.filesDir, `${id}${ext}`)
        try {
            await fs.copyFile(sourcePath, target)
        } catch (err) {
            await fs.unlink(target).catch(() => {})
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to copy local file.'
            }
        }

        const mediaType = mediaTypeFromExt(ext)

        const thumbTarget = this.thumbPathFor(target)

        let success = false

        console.log(mediaType)

        if (mediaType == 'image') {
            success = await this.generateThumbnailFromImagePath(target, thumbTarget)
        } else if (mediaType == 'video') {
            success = await this.generateThumbnailFromVideoPath(target, thumbTarget)
        } else {
            return {
                success: false,
                error: `Unsupported media type: ${mediaType}`
            }
        }

        return {
            success: true,
            data: { storedPath: target, thumbPath: success ? thumbTarget : undefined }
        }
    }

    async storeWebFile(
        id: number,
        url: string,
        ext: string
    ): Promise<Result<{ storedPath: string; thumbPath?: string }>> {
        const target = path.join(this.filesDir, `${id}${ext}`)
        let buffer: Buffer
        try {
            const response = await net.fetch(url)
            if (!response.ok) {
                return {
                    success: false,
                    error: `HTTP ${response.status} fetching ${url}`
                }
            }
            buffer = Buffer.from(await response.arrayBuffer())
            await fs.writeFile(target, buffer)
        } catch (err) {
            await fs.unlink(target).catch(() => {})
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to download file.'
            }
        }

        const thumbTarget = this.thumbPathFor(target)
        const success = await this.generateThumbnailFromBuffer(buffer, thumbTarget)

        return {
            success: true,
            data: { storedPath: target, thumbPath: success ? thumbTarget : undefined }
        }
    }
}

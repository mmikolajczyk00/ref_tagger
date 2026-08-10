import { promises as fs } from 'fs'
import path from 'path'
import { net } from 'electron'
import { Result } from '../../shared/types/api'

export class FileStorageService {
    private readonly filesDir: string

    constructor(rootDir: string) {
        this.filesDir = path.join(rootDir, 'files')
        fs.mkdir(this.filesDir, { recursive: true })
    }

    async storeLocalFile(
        id: number,
        sourcePath: string,
        ext: string
    ): Promise<Result<{ storedPath: string }>> {
        const target = path.join(this.filesDir, `${id}${ext}`)
        try {
            await fs.copyFile(sourcePath, target)
            return { success: true, data: { storedPath: target } }
        } catch (err) {
            await fs.unlink(target).catch(() => {})
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to copy local file.'
            }
        }
    }

    async storeWebFile(
        id: number,
        url: string,
        ext: string
    ): Promise<Result<{ storedPath: string }>> {
        const target = path.join(this.filesDir, `${id}${ext}`)
        try {
            const response = await net.fetch(url)
            if (!response.ok) {
                return {
                    success: false,
                    error: `HTTP ${response.status} fetching ${url}`
                }
            }
            const buffer = Buffer.from(await response.arrayBuffer())
            await fs.writeFile(target, buffer)
            return { success: true, data: { storedPath: target } }
        } catch (err) {
            await fs.unlink(target).catch(() => {})
            return {
                success: false,
                error: err instanceof Error ? err.message : 'Failed to download file.'
            }
        }
    }
}

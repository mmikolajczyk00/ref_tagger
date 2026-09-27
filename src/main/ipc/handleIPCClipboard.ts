import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { clipboard, nativeImage } from 'electron'
import { Result } from '../../shared/types/api'
import { buildUriList, SCENE_MIME } from '../../shared/clipboard/sceneClipboard'
import {
    ClipboardReadResult,
    ClipboardWriteOptions,
    MediaFile,
    MediaFileSourceType
} from '../../shared/types/models'
import { FileService } from '../services/FileService'

const EXT_BY_MIME: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'image/bmp': '.bmp'
}

const SCENE_META = 'ref-sheeter-scene'
const URI_LIST_META = 'ref-sheeter-uri-list'

// Electron's clipboard.write() only publishes the standard keys (text/html/
// image/rtf/bookmark), and on Linux every clipboard call REPLACES the previous
// contents — you cannot accumulate custom writeBuffer() formats alongside them.
// So our app payload rides inside the html format as <meta> tags in a single
// clipboard.write({ text?, image?, html? }) call, which keeps all formats alive.
function buildCarrierHtml(options: ClipboardWriteOptions): string | undefined {
    const metas: string[] = []
    if (options.scene) {
        metas.push(`<meta name="${SCENE_META}" content="${encodeURIComponent(options.scene)}">`)
    }
    if (options.uriList && options.uriList.length > 0) {
        metas.push(
            `<meta name="${URI_LIST_META}" content="${encodeURIComponent(buildUriList(options.uriList))}">`
        )
    }
    if (metas.length === 0) return undefined
    const text = options.text ?? ''
    const body = text ? `<pre>${escapeHtml(text)}</pre>` : ''
    return `<html><head>${metas.join('')}</head><body>${body}</body></html>`
}

function parseMetaFromHtml(html: string, name: string): string | null {
    const match = new RegExp(`<meta name="${name}" content="([^"]*)"`).exec(html)
    if (!match) return null
    try {
        return decodeURIComponent(match[1])
    } catch {
        return null
    }
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

export function registerIPCClipboardHandlers(ipcMain: Electron.IpcMain, fileService: FileService) {
    // Clipboard access lives in the main process: the Electron clipboard module
    // is deprecated from the renderer process (preload included).
    ipcMain.handle('api:clipboard:read', (): ClipboardReadResult => {
        const html = clipboard.readHTML()
        const scene =
            clipboard.readBuffer(SCENE_MIME)?.toString('utf8') ||
            parseMetaFromHtml(html, SCENE_META)
        const image = clipboard.readImage()
        const uriListText =
            clipboard.read('text/uri-list') || parseMetaFromHtml(html, URI_LIST_META) || ''
        return {
            scene: scene || null,
            text: clipboard.readText(),
            imageDataUrl: image.isEmpty() ? null : image.toDataURL(),
            uriListText
        }
    })

    ipcMain.handle('api:clipboard:write', (_event, options: ClipboardWriteOptions): void => {
        const data: Record<string, unknown> = {}
        if (options.text !== undefined) data.text = options.text
        if (options.imageDataUrl) {
            data.image = nativeImage.createFromDataURL(options.imageDataUrl)
        }
        const html = buildCarrierHtml(options)
        if (html) data.html = html
        if (Object.keys(data).length > 0) clipboard.write(data)
    })

    // Persists an in-memory clipboard image (data URL) into the library and
    // returns the created MediaFile so the caller can add it to a canvas. The
    // bytes are copied into the app's FILES dir (<id><ext>) like any import; the
    // temp decoy in os.tmpdir() is removed afterwards.
    ipcMain.handle(
        'api:clipboard:importImage',
        async (_event, imageDataUrl: string): Promise<Result<MediaFile>> => {
            let tmpDir: string | undefined
            try {
                if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
                    return { success: false, error: 'Invalid clipboard image payload.' }
                }
                const comma = imageDataUrl.indexOf(',')
                if (comma === -1) {
                    return { success: false, error: 'Invalid clipboard image payload.' }
                }
                const meta = imageDataUrl.slice(5, comma)
                const mime = /^image\/[\w.+-]+/.exec(meta)?.[0] ?? ''
                const ext = EXT_BY_MIME[mime] ?? '.png'
                const buffer = Buffer.from(imageDataUrl.slice(comma + 1), 'base64')
                if (buffer.length === 0) {
                    return { success: false, error: 'Clipboard image is empty.' }
                }

                tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ref-sheeter-clip-'))
                const tmpPath = path.join(tmpDir, `clipboard-image-${Date.now()}${ext}`)
                await fs.writeFile(tmpPath, buffer)

                const fileName = `Pasted image ${Date.now()}${ext}`
                const inserted = await fileService.insertFile({
                    source: MediaFileSourceType.LOCAL,
                    fileName,
                    mediaType: 'image',
                    filePath: tmpPath
                })
                if (!inserted.success) return inserted

                return await fileService.getFileOfId(inserted.data.id)
            } catch (err) {
                return {
                    success: false,
                    error: err instanceof Error ? err.message : 'Failed to import clipboard image.'
                }
            } finally {
                if (tmpDir) {
                    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {})
                }
            }
        }
    )
}

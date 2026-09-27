import { MediaFileCanvasElement } from '../scene/CanvasElements'
import { useFileStore } from '@renderer/core/stores/useFileStore'

interface LoadedImage {
    el: MediaFileCanvasElement
    bitmap: ImageBitmap
}

// Renders the selected image elements into a single PNG bitmap, like a
// screenshot: uniform zoom anchored so the largest image maps 1:1 to its
// natural resolution (no loss of detail), smaller images scaled by the same
// factor. Videos/audio and unreadable files are skipped. Returns a PNG data
// URL ready for the OS clipboard, or null when nothing could be rendered.
export async function composeSelectedImagesToPng(
    elements: MediaFileCanvasElement[]
): Promise<string | null> {
    if (elements.length === 0) return null

    const fileStore = useFileStore()
    const files = await fileStore.fetchFilesOfIds(elements.map((e) => e.fileId))
    const byId = new Map(files.map((f) => [f.id, f]))

    const loaded: LoadedImage[] = []
    for (const el of elements) {
        const mf = byId.get(el.fileId)
        if (!mf) {
            console.warn('[clipboard] element fileId', el.fileId, 'not found in db')
            continue
        }
        if (mf.mediaType !== 'image') {
            console.warn('[clipboard] element fileId', el.fileId, 'is', mf.mediaType, '- skipped')
            continue
        }
        try {
            const blob = await fetch(`media://load?path=${encodeURIComponent(mf.filePath)}`).then(
                (r) => {
                    if (!r.ok) throw new Error('HTTP ' + r.status)
                    return r.blob()
                }
            )
            const bitmap = await createImageBitmap(blob)
            loaded.push({ el, bitmap })
        } catch (err) {
            console.warn('[clipboard] could not load image for fileId', el.fileId, mf.filePath, err)
        }
    }
    if (loaded.length === 0) {
        console.warn('[clipboard] bitmap compose produced no images; no image format written')
        return null
    }

    let largest = loaded[0]
    for (const l of loaded) {
        const current = largest.el.transform.scaledWidth() * largest.el.transform.scaledHeight()
        const candidate = l.el.transform.scaledWidth() * l.el.transform.scaledHeight()
        if (candidate > current) largest = l
    }

    const z = largest.bitmap.width / largest.el.transform.scaledWidth()
    if (!(z > 0) || !Number.isFinite(z)) {
        loaded.forEach((l) => l.bitmap.close())
        return null
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const { el } of loaded) {
        const bb = el.transform.getBoundingBox()
        minX = Math.min(minX, bb.left)
        minY = Math.min(minY, bb.top)
        maxX = Math.max(maxX, bb.right)
        maxY = Math.max(maxY, bb.bottom)
    }

    const width = Math.max(1, Math.floor((maxX - minX) * z))
    const height = Math.max(1, Math.floor((maxY - minY) * z))
    const canvas = new OffscreenCanvas(width, height)
    const ctx = canvas.getContext('2d')
    if (!ctx) {
        loaded.forEach((l) => l.bitmap.close())
        return null
    }

    ctx.setTransform(z, 0, 0, z, -minX * z, -minY * z)

    const ordered = loaded
        .slice()
        .sort((a, b) => (a.el.transform.zIndex ?? 0) - (b.el.transform.zIndex ?? 0))

    for (const { el, bitmap } of ordered) {
        ctx.save()
        ctx.translate(el.transform.position.x, el.transform.position.y)
        ctx.rotate(el.transform.rotation)
        ctx.scale(el.transform.scale, el.transform.scale)
        ctx.drawImage(bitmap, 0, 0)
        ctx.restore()
        bitmap.close()
    }

    const blob = await canvas.convertToBlob({ type: 'image/png' })
    console.log('composed')
    return await blobToDataUrl(blob)
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
    })
}

import { ClipboardReadResult, SceneClipboardPayload } from '../types/models'

export const SCENE_MIME = 'application/x-ref-sheeter-scene'
export const SCENE_VERSION = 1

interface SerializableElement {
    toJSON(): unknown
}

export function buildScenePayload(elements: SerializableElement[] | unknown[]): string {
    return JSON.stringify({
        app: 'ref-sheeter',
        version: SCENE_VERSION,
        elements: elements.map((e) =>
            typeof e === 'object' && e !== null && 'toJSON' in e
                ? (e as SerializableElement).toJSON()
                : e
        )
    } satisfies SceneClipboardPayload)
}

export function parseScenePayload(json: string | null): SceneClipboardPayload | null {
    if (!json) return null
    try {
        const parsed = JSON.parse(json) as SceneClipboardPayload
        if (parsed.app !== 'ref-sheeter' || parsed.version !== SCENE_VERSION) return null
        if (!Array.isArray(parsed.elements)) return null
        return parsed
    } catch {
        return null
    }
}

// Converts absolute file paths into standard file:// URI-list lines (CRLF).
export function buildUriList(paths: string[]): string {
    return paths.map(pathToFileUri).join('\r\n')
}

// Parses a text/uri-list payload back into absolute paths. Ignores comments
// (lines starting with '#') and non-file URIs. Safe to run in the renderer.
export function parseUriList(text: string): string[] {
    const out: string[] = []
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        try {
            const url = new URL(trimmed)
            if (url.protocol !== 'file:') continue
            out.push(decodeURIComponent(url.pathname))
        } catch {
            // ignore malformed lines
        }
    }
    return out
}

export function pathToFileUri(p: string): string {
    const isWindows = p.match(/^[a-zA-Z]:[\\/]/) !== null
    const normalized = p.replace(/\\/g, '/')
    const encoded = normalized
        .split('/')
        .map((seg) => encodeURIComponent(seg))
        .join('/')
    return isWindows || encoded.startsWith('/') ? `file://${encoded}` : `file:///${encoded}`
}

export function clipboardHasUsableContent(clip: ClipboardReadResult): boolean {
    if (clip.scene) return true
    if (clip.text.trim().length > 0) return true
    if (clip.imageDataUrl) return true
    if (clip.uriListText.trim().length > 0) return true
    return false
}

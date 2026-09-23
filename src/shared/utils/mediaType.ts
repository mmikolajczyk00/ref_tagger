import type { MediaType } from '../types/models'

const VIDEO_EXTS = new Set(['mp4', 'webm', 'mkv', 'mov', 'avi', 'flv', 'm4v', 'ogv'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'flac', 'opus', 'aac'])
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'])

export function mediaTypeFromExt(ext: string): MediaType | undefined {
    const normalized = ext.replace(/^\./, '').toLowerCase()
    if (VIDEO_EXTS.has(normalized)) return 'video'
    if (AUDIO_EXTS.has(normalized)) return 'audio'
    if (IMAGE_EXTS.has(normalized)) return 'image'
    return undefined
}

export function extFromMediaType(mediaType: string): string {
    const map: Record<string, string> = {
        image: '.jpg',
        video: '.mp4',
        audio: '.mp3'
    }
    return map[mediaType] ?? '.bin'
}

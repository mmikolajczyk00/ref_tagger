import type { MediaType } from '@shared/types/models'

export type PreviewMediaType = 'image' | 'video'

export interface PreviewItem {
    src: string
    mediaType: PreviewMediaType
    name?: string
}

export function toPreviewSrc(src: string | undefined): string {
    if (!src) return ''
    if (/^https?:\/\//i.test(src)) return src
    return `media://load?path=${src}`
}

export function isPreviewableMediaType(
    mediaType: MediaType | undefined
): mediaType is PreviewMediaType {
    return mediaType === 'image' || mediaType === 'video'
}

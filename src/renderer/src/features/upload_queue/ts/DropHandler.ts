import { useUploadQueueStore } from './useUploadQueueStore'
import { SCRAPE_STATUS, UPLOAD_STATUS } from './UploadQueue'
import type { MediaClassification, MediaFileSource } from '@shared/types/models'
import { normalizeTag } from '@renderer/core/utils/tagsUtils'
export { MediaFileSourceType } from '@shared/types/models'

export type DropScanResult = {
    name?: string
    thumb?: string
    src?: string
    tags: string[]
    mediaType: MediaClassification
    videoSrc?: string
    sourceType: MediaFileSource
    originalSourceUrl?: string
}

function isPinterest(data: DataTransfer): boolean {
    return data.types.includes('text/html') && data.getData('text/html').includes('pinterest.com')
}
function isSafebooru(data: DataTransfer): boolean {
    return data.types.includes('text/html') && data.getData('text/html').includes('safebooru.org')
}
function isLocal(data: DataTransfer): boolean {
    const files = data.files
    return files && files.length > 0
}

// extract urls and tags from html
// urls are in resolution ascending order
function handlePinterest(data: DataTransfer): DropScanResult[] {
    const results: DropScanResult[] = []
    const htmlString = data.getData('text/html')

    // const droppedImages = [
    //     ...htmlString.matchAll(/<a aria-label="([^"]*?)pin page"[\s\S]*? srcSet="([^"]*?)"/gim)

    const trimPinterestTags = function (tags: string) {
        ;['This contains an image of:', 'This may contain:'].forEach((pref) => {
            tags = tags.replace(pref, '').trim()
        })
        return tags
    }

    const imgPinRegex =
        /(?:href="([^"]*?pinterest.com\/pin[^"]*?)"(?:(?!href).)*?)(?:<a aria-label="([^"]*?)pin page"|alt="([^"]*?)")(?:(?!(?:<a aria-label|img alt)).)*? srcSet="([^"]*?)"/gim

    const droppedImages = [...htmlString.matchAll(imgPinRegex)].map((m) => m)
    const droppedVideos = [
        ...htmlString.matchAll(
            /<a[\s\S]*?href="([^"]*?)"[\s\S]*?<video .*?poster="([^"]*?)".*?>/gim
        )
    ].map((m) => ({ src: m.at(1), thumb: m[2] }))

    console.dir(htmlString)

    droppedImages.forEach((f) => {
        console.log(f)
    })

    droppedVideos.forEach((f) => {
        console.log(f)
        const result = {
            name: 'untitled',
            thumb: f.thumb,
            src: f.src,
            tags: [] as string[],
            mediaType: 'video',
            videoSrc: f.src,
            sourceType: 'web',
            originalSourceUrl: ''
        } as DropScanResult
        results.push(result)
    })

    droppedImages.forEach((f) => {
        const originalSourceUrl = f[1] || ''
        let tagsString = f[2] || f[3] || ''
        tagsString = trimPinterestTags(tagsString)

        const tags = tagsString.trim().split(' ')
        const srcSet = f[4]

        const srcs = srcSet?.split(',')
        let thumb = srcs?.[0]?.trim()
        thumb = thumb?.split(' ')[0]?.trim()

        let best = srcs?.at(-1)?.trim()
        best = best?.split(' ')[0]?.trim()

        console.log({ thumb, best, tags })

        const result = {
            name: 'untitled',
            thumb: thumb || undefined,
            src: best || undefined,
            tags,
            mediaType: 'image',
            sourceType: 'web',
            originalSourceUrl
        } as DropScanResult

        results.push(result)
    })

    console.log(results)

    return results
}

function handleSafebooru(data: DataTransfer): DropScanResult[] {
    const results: DropScanResult[] = []
    const htmlString = data.getData('text/html')
    // const originalSourceUrl = data.getData('text/plain') || data.getData('text/uri-list')

    const regex = /<a[\s\S]*?href="([^"]*?)"[\s\S]*?<img .*?src="([^"]*?)" alt="([^"]*?)"/gim
    const getFullResRegex = /\/([0-9]*?)\/thumbnail_([\s\S]*?)\?/

    function thumbToFullRes(thumb: string | undefined): string | undefined {
        const match = thumb?.match(getFullResRegex)
        const id = match?.[1]
        const url_part = match?.[2]
        console.log('thumbToFullRes', { match, id, url_part })
        return match ? `https://safebooru.org/images/${id}/${url_part}` : undefined
    }

    const matches = htmlString?.matchAll(regex).map((m) => ({
        src: thumbToFullRes(m[2]),
        originalSourceUrl: m[1],
        thumb: m[2],
        tags: m[3]?.split(' ') || []
    }))

    if (!matches) return results

    for (const match of matches) {
        console.log(match)
        const { src, thumb, tags, originalSourceUrl } = match

        const result = {
            name: 'untitled',
            thumb,
            src,
            tags,
            mediaType: 'image',
            sourceType: 'web',
            originalSourceUrl
        } as DropScanResult
        results.push(result)
    }

    return results
}

async function handleLocal(data: DataTransfer): Promise<DropScanResult[]> {
    console.log(data)
    const files = data.files
    if (!files) return []
    const results: DropScanResult[] = []

    for (const file of files) {
        const absolutePath = await window.api.files.getFilePath(file)
        if (!absolutePath) continue

        let mediaType: MediaClassification = 'undefined'
        if (file.type.startsWith('image/')) mediaType = 'image'
        else if (file.type.startsWith('audio/')) mediaType = 'audio'
        else if (file.type.startsWith('video/')) mediaType = 'video'
        else mediaType = 'unsupported'
        if (mediaType === 'unsupported') continue

        const result = {
            name: file.name,
            thumb: absolutePath,
            src: absolutePath,
            tags: [] as string[],
            mediaType,
            sourceType: 'local',
            originalSourceUrl: absolutePath
        } as DropScanResult
        results.push(result)
    }

    console.log('handleLocal', results)
    return results
}

export async function handleDrop(event: DragEvent) {
    if (!event.dataTransfer) return

    const store = useUploadQueueStore()
    const dt = event.dataTransfer
    const results = [] as DropScanResult[]

    if (isLocal(dt)) {
        const res = await handleLocal(dt)
        console.log('handleLocal', res)
        results.push(...res)
    } else if (isPinterest(dt)) {
        const res = handlePinterest(dt)
        results.push(...res)
    } else if (isSafebooru(dt)) {
        const res = handleSafebooru(dt)
        results.push(...res)
    } else {
        console.log('unhandled source')
        console.log(dt)
        console.log(dt.types)
        console.log({
            types: dt.types,
            html: dt.getData('text/html'),
            text: dt.getData('text/plain'),
            urilist: dt.getData('text/uri-list'),
            files: dt.files
        })
    }
    store.addToScrape(results)
}

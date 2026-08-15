import { useUploadQueueStore } from './useUploadQueueStore'
import type { MediaFileSource, MediaType } from '@shared/types/models'
export { MediaFileSourceType } from '@shared/types/models'

const parser = new DOMParser()

export type DropScanResult = {
    name?: string
    thumb?: string
    src?: string
    tags: string[]
    mediaType?: MediaType
    sourceType: MediaFileSource
    originalSourceUrl?: string
}

function isPinterest(data: DataTransfer): boolean {
    return data.types.includes('text/html') && data.getData('text/html').includes('pinterest.com')
}
function isSafebooru(data: DataTransfer): boolean {
    return data.types.includes('text/html') && data.getData('text/html').includes('safebooru.org')
}
function isXTwitter(data: DataTransfer): boolean {
    return data.types.includes('text/uri-list') && data.getData('text/uri-list').includes('x.com')
}
function isLocal(data: DataTransfer): boolean {
    const files = data.files
    return files && files.length > 0
}

function handleXTwitter(data: DataTransfer): DropScanResult[] {
    // const link = data.getData('text/uri-list')
    const htmlString = data.getData('text/html')

    const doc = parser.parseFromString(htmlString, 'text/html')

    console.log(doc)

    const link = doc.querySelector('a')?.getAttribute('href')
    const thumb = doc.querySelector('img')?.getAttribute('src')

    if (!link || !thumb) return []

    const thumbBody = thumb.slice(0, thumb.lastIndexOf('&name=') + 6)
    const src = thumbBody + '4096x4096'

    return [
        {
            name: 'untitled',
            thumb,
            src,
            tags: [],
            mediaType: 'image',
            sourceType: 'web',
            originalSourceUrl: link
        }
    ]
}

function handlePinterest(data: DataTransfer): DropScanResult[] {
    const results: DropScanResult[] = []
    const htmlString = data.getData('text/html')
    if (!htmlString) return []

    const trimPinterestTags = function (tags: string) {
        ;['This contains an image of:', 'This may contain:', 'Pin card'].forEach((pref) => {
            tags = tags.replace(pref, '').trim()
        })
        return tags
    }

    const doc = parser.parseFromString(htmlString, 'text/html')

    console.log(doc)

    // selected multiple

    let gridItems = doc.querySelectorAll('[data-grid-item]') as
        NodeListOf<HTMLAnchorElement> | [HTMLAnchorElement]

    if (gridItems.length == 0) {
        const item = doc.querySelector('a')
        if (!item) return results
        gridItems = [item]
    }

    for (const item of gridItems) {
        const originalSourceUrl =
            item.getAttribute('href') || item.querySelector('a')?.getAttribute('href')
        const srcSet = item.querySelector('img')?.getAttribute('srcSet')?.split(', ')
        const thumb = srcSet?.[0].split(' ')[0]
        const src = srcSet?.[srcSet.length - 1].split(' ')[0]
        const possibleTagItems = [
            ...item.querySelectorAll('[aria-label]'),
            ...item.querySelectorAll('[alt]')
        ]
        if (!originalSourceUrl || !thumb || !src) continue

        const tags: string[] = []
        for (const i of possibleTagItems) {
            const tagsString = i.getAttribute('aria-label') || i.getAttribute('alt') || ''
            tags.push(...trimPinterestTags(tagsString).split(' ').filter(Boolean))
        }

        // TODO: support for videos

        console.log(item, { originalSourceUrl, srcSet, tags })
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
    console.log(results)

    return results
}

function handleSafebooru(data: DataTransfer): DropScanResult[] {
    const results: DropScanResult[] = []
    const htmlString = data.getData('text/html')

    function thumbToFullRes(thumb: string): string {
        const getFullResRegex = /\/([0-9]*?)\/thumbnail_([\s\S]*?)\?/
        const match = thumb?.match(getFullResRegex)
        const id = match?.[1]
        const url_part = match?.[2]
        console.log('thumbToFullRes', { match, id, url_part })
        return match ? `https://safebooru.org/images/${id}/${url_part}` : ''
    }

    const doc = parser.parseFromString(htmlString, 'text/html')

    const gridItems = doc.querySelectorAll('a[id]')

    for (const item of gridItems) {
        const originalSourceUrl = item.getAttribute('href')
        const thumb = item.querySelector('img')?.getAttribute('src') || ''
        const src = thumbToFullRes(thumb)

        if (!originalSourceUrl || !thumb || !src) continue

        const tags = item.querySelector('img')?.getAttribute('alt')?.split(' ')

        // TODO: support for videos

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

        let mediaType: MediaType | undefined
        if (file.type.startsWith('image/')) mediaType = 'image'
        else if (file.type.startsWith('audio/')) mediaType = 'audio'
        else if (file.type.startsWith('video/')) mediaType = 'video'
        if (!mediaType) continue

        const result: DropScanResult = {
            name: file.name,
            thumb: absolutePath,
            src: absolutePath,
            tags: [] as string[],
            mediaType,
            sourceType: 'local',
            originalSourceUrl: absolutePath
        }

        if (mediaType === 'video') {
            const thumbRes = await window.api.files.getVideoThumb(absolutePath)
            console.log(thumbRes)
            if (!thumbRes.success || !thumbRes.data) continue
            result.thumb = thumbRes.data.thumb
        }

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

    console.log(dt)
    console.log(dt.types)
    console.log({
        types: dt.types,
        html: dt.getData('text/html'),
        text: dt.getData('text/plain'),
        urilist: dt.getData('text/uri-list'),
        files: dt.files
    })

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
    } else if (isXTwitter(dt)) {
        const res = handleXTwitter(dt)
        results.push(...res)
    } else {
        console.log('unhandled source')
    }
    store.addToScrape(results)
}

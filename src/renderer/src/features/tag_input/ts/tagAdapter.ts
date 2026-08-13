import type { Tag } from '@shared/types/models'
import { DEFAULT_TAG_COLOR } from '@renderer/core/theme/colors'

function hashStringToInt(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = (hash * 31 + str.charCodeAt(i)) | 0
    }
    return hash
}

export function stringToTag(name: string, color: string = DEFAULT_TAG_COLOR): Tag {
    return {
        id: hashStringToInt(name),
        name,
        color
    }
}

export function stringsToTags(names: string[], colorResolver?: (name: string) => string): Tag[] {
    const seen = new Set<number>()
    const result: Tag[] = []
    for (const name of names) {
        if (!name) continue
        const tag = stringToTag(name, colorResolver ? colorResolver(name) : DEFAULT_TAG_COLOR)
        if (seen.has(tag.id)) continue
        seen.add(tag.id)
        result.push(tag)
    }
    return result
}

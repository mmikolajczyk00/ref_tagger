import { TagModel, TagRequest } from './model/tagModel'

function normalizeTag(tag: string): string {
    const new_tag = tag
        .slice(0)
        .replaceAll(/[^a-zA-Z0-9_\-\s]/g, '_')
        .replaceAll(/\./g, '_')
        .replaceAll(/\s/g, '_')
        .toLowerCase()

    return new_tag
}

function normalizeScrapedTag(tag: string): string {
    return (
        tag
            .slice(0)
            // .replace(/[^a-zA-Z0-9_.\-\s]/g, '')
            .replaceAll(/\s\.\,\-\+\:/g, '_')
            .toLowerCase()
    )
}

function flattenTagSets(iter: Set<TagModel | TagRequest>): Set<TagModel | TagRequest> {
    const set = new Set<string>([])
    const result = new Set([]) as Set<TagModel | TagRequest>
    iter.forEach((t) => {
        if (!set.has(t.name)) result.add(t)
    })
    return result
}

function separateTagAndGroup(str: string) {
    if (str.includes(':')) {
        let [newGroup, newName] = str.split(':')
        newGroup = normalizeTag(newGroup)
        newName = normalizeTag(newName)
        if (newGroup.length == 0) newGroup = 'general'

        return [newName, newGroup]
    } else {
        return [normalizeTag(str), 'general']
    }
}

export { normalizeTag, normalizeScrapedTag, flattenTagSets, separateTagAndGroup }

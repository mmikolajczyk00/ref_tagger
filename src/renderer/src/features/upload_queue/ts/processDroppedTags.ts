export function processDroppedTags(
    tags: string[],
    blacklistSet: Set<string>,
    aliasMap: Map<string, string>
): string[] {
    const out: string[] = []
    for (const tag of tags) {
        if (blacklistSet.has(tag)) continue
        let cur = tag
        const seen = new Set<string>()
        while (aliasMap.has(cur) && !seen.has(cur)) {
            seen.add(cur)
            cur = aliasMap.get(cur) as string
        }
        out.push(cur)
    }
    return [...new Set(out)]
}

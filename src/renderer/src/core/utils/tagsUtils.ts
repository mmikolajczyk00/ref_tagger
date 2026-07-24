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
            .replaceAll(/\s\.,-\+:/g, '_')
            .toLowerCase()
    )
}

export { normalizeTag, normalizeScrapedTag }

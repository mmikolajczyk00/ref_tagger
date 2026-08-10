function normalizeTag(tag: string): string {
    const new_tag = tag
        .slice(0)
        .trim()
        .replaceAll(/[^a-zA-Z0-9_\-\s]/g, '_')
        .replaceAll(/\./g, '_')
        .replaceAll(/\s/g, '_')
        .toLowerCase()

    return new_tag
}

export { normalizeTag }

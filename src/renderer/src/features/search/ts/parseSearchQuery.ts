export function parseSearchChips(chips: string[]): {
    required: string[]
    excluded: string[]
    normal: string[]
} {
    const required = new Set<string>()
    const excluded = new Set<string>()
    const normal = new Set<string>()

    for (const chip of chips) {
        const t = chip.trim().toLowerCase()
        if (!t) continue

        if (t.startsWith('!')) {
            const name = t.slice(1).trim()
            if (name) required.add(name)
        } else if (t.startsWith('-')) {
            const name = t.slice(1).trim()
            if (name) excluded.add(name)
        } else {
            normal.add(t)
        }
    }

    return {
        required: [...required],
        excluded: [...excluded],
        normal: [...normal]
    }
}

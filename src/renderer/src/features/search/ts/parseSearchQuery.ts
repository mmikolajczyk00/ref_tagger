export function parseSearchChips(chips: string[]): {
    requiredExact: string[]
    requiredExpanded: string[]
    excludedExact: string[]
    excludedExpanded: string[]
    normal: string[]
} {
    const requiredExact = new Set<string>()
    const requiredExpanded = new Set<string>()
    const excludedExact = new Set<string>()
    const excludedExpanded = new Set<string>()
    const normal = new Set<string>()

    for (const chip of chips) {
        const t = chip.trim().toLowerCase()
        if (!t) continue

        if (t.startsWith('!!')) {
            const name = t.slice(2).trim()
            if (name) requiredExact.add(name)
        } else if (t.startsWith('--')) {
            const name = t.slice(2).trim()
            if (name) excludedExact.add(name)
        } else if (t.startsWith('!')) {
            const name = t.slice(1).trim()
            if (name) requiredExpanded.add(name)
        } else if (t.startsWith('-')) {
            const name = t.slice(1).trim()
            if (name) excludedExpanded.add(name)
        } else {
            normal.add(t)
        }
    }

    return {
        requiredExact: [...requiredExact],
        requiredExpanded: [...requiredExpanded],
        excludedExact: [...excludedExact],
        excludedExpanded: [...excludedExpanded],
        normal: [...normal]
    }
}

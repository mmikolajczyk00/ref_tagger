export interface TagInputModifiers {
    unprefix(text: string): { prefix: string; name: string }
    sanitizeDraft(raw: string): string
    commit(raw: string): string | null
    queryForAutocomplete(text: string): string
}

const MODIFIER_PREFIXES = ['!!', '--', '!', '-'] as const

function detectPrefix(text: string): { prefix: string; name: string } {
    const trimmed = text.trimStart()
    for (const p of MODIFIER_PREFIXES) {
        if (trimmed.startsWith(p)) return { prefix: p, name: trimmed.slice(p.length) }
    }
    return { prefix: '', name: trimmed }
}

export function useTagInputModifiers(): TagInputModifiers {
    function unprefix(text: string): { prefix: string; name: string } {
        return detectPrefix(text)
    }

    function sanitizeDraft(raw: string): string {
        return raw.toLowerCase()
    }

    function commit(raw: string): string | null {
        const trimmed = raw.trim()
        if (!trimmed) return null
        return trimmed.toLowerCase()
    }

    function queryForAutocomplete(text: string): string {
        const { name } = detectPrefix(text)
        return name.trim().toLowerCase()
    }

    return { unprefix, sanitizeDraft, commit, queryForAutocomplete }
}

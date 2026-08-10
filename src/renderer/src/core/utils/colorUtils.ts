export const DEFAULT_TAG_COLOR = '#6b7280'
export const DEFAULT_TAG_BG_20 = `${DEFAULT_TAG_COLOR}33`

export function withAlpha(hex: string, alpha: number): string {
    const a = Math.round(alpha * 255)
        .toString(16)
        .padStart(2, '0')
    return `${hex}${a}`
}

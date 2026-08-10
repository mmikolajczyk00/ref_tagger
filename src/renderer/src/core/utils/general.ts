const MouseButton = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2,
    BACK: 3,
    FORWARD: 4
} as const

const MouseButtons = {
    LEFT: 1,
    RIGHT: 2,
    MIDDLE: 4,
    BACK: 8,
    FORWARD: 16
} as const

type MouseButton = (typeof MouseButton)[keyof typeof MouseButton]
type MouseButtons = (typeof MouseButtons)[keyof typeof MouseButtons]

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max)

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t
}

export { clamp, MouseButton, MouseButtons, lerp }

export function containsAtLeastNTimes(str: string, substring: string, n: number): boolean {
    if (n <= 0) return true
    if (!substring) return false

    let count = 0
    let index = 0

    while ((index = str.indexOf(substring, index)) !== -1) {
        count++
        if (count >= n) {
            return true
        }
        index += substring.length
    }

    return false
}

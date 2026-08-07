export const CANVAS_NAME_MAX_LENGTH = 64

export type CanvasNameError = 'empty' | 'tooLong' | 'invalidCharacters' | 'duplicate'

export interface CanvasNameResult {
    valid: true
    name: string
}

export interface CanvasNameErrorResult {
    valid: false
    error: CanvasNameError
    message: string
}

type ValidateResult = CanvasNameResult | CanvasNameErrorResult

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

export function validateCanvasName(rawName: string, existingNames: Set<string>): ValidateResult {
    const trimmed = rawName.trim()
    if (!trimmed) {
        return { valid: false, error: 'empty', message: 'Name cannot be empty.' }
    }
    if (trimmed.length > CANVAS_NAME_MAX_LENGTH) {
        return {
            valid: false,
            error: 'tooLong',
            message: `Name must be at most ${CANVAS_NAME_MAX_LENGTH} characters.`
        }
    }
    if (CONTROL_CHARS.test(trimmed)) {
        return {
            valid: false,
            error: 'invalidCharacters',
            message: 'Name cannot contain control characters.'
        }
    }
    console.log({ existingNames, trimmed })

    if (existingNames.has(trimmed)) {
        return {
            valid: false,
            error: 'duplicate',
            message: 'A canvas with this name already exists.'
        }
    }
    return { valid: true, name: trimmed }
}

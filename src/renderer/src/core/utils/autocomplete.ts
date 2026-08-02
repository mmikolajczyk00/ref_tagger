export type AutocompleteOptions = {
    typoTolerance?: number
    minLengthForTypo?: number
    matchFromStart?: boolean
    autocompleteSize?: number
}

export function autocompleteFilter(
    input: string,
    suggestions: string[],
    options: AutocompleteOptions = {}
): string[] {
    const { typoTolerance = 3, minLengthForTypo = 3, matchFromStart = true } = options
    let autocompleteSize = Math.min(15, suggestions.length)
    autocompleteSize = Math.min(suggestions.length, autocompleteSize)

    if (!input || input.length == 0) return suggestions.slice(0, autocompleteSize)

    const matches = Array.from(''.repeat(autocompleteSize))

    const inputLower = input.toLowerCase()
    const inputLength = input.length

    let perfectMatch = null as null | string
    const startsWithMatches = [] as string[]
    const exactMatches = [] as string[]

    for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i]
        if (suggestion == inputLower) {
            perfectMatch = suggestion
        } else if (suggestion.startsWith(inputLower)) {
            startsWithMatches.push(suggestion)
        } else if (suggestion.includes(inputLower)) {
            exactMatches.push(suggestion)
        }
    }

    // replace the empty array

    let matchCount = 0

    if (perfectMatch) {
        matches[0] = perfectMatch
        matchCount++
    }
    for (let i = 0; i < startsWithMatches.length; i++) {
        if (matchCount > autocompleteSize - 1) break
        matches[matchCount] = startsWithMatches[i]
        matchCount++
    }
    for (let i = 0; i < exactMatches.length; i++) {
        if (matchCount > autocompleteSize - 1) break
        matches[matchCount] = exactMatches[i]
        matchCount++
    }

    // If options specify only exact matches,
    // or if the text is too short for typos
    // -> Then ignore rest of the code
    if (inputLength < minLengthForTypo || typoTolerance === 0) {
        return matches
    }

    for (let i = 0; i < suggestions.length; i++) {
        if (matchCount >= autocompleteSize - 1) break

        const suggestion = suggestions[i]
        if (matches.includes(suggestion)) continue

        // Check if suggestion starts with input (with typos)
        if (matchFromStart) {
            const suggestionStart = suggestion.substring(0, inputLength)
            if (levenshteinDistance(inputLower, suggestionStart) <= typoTolerance) {
                matches[matchCount] = suggestion
                matchCount++
            }
        }
    }

    // Check for close matches anywhere in the string
    for (let i = 0; i <= suggestions.length - inputLength; i++) {
        const suggestion = suggestions[i]

        if (matchCount >= autocompleteSize - 1) break
        const substring = suggestion.substring(i, i + inputLength)
        if (levenshteinDistance(inputLower, substring) <= typoTolerance) {
            matches[matchCount] = suggestion
            matchCount++
        }
    }

    return matches
}

/**
 * Calculates Levenshtein distance between two strings
 * (Number of edits needed to transform one string into another)
 */
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length

    const matrix: number[][] = []

    // Initialize matrix
    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i]
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j
    }

    // Fill in the matrix
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1]
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    matrix[i][j - 1] + 1, // insertion
                    matrix[i - 1][j] + 1 // deletion
                )
            }
        }
    }

    return matrix[b.length][a.length]
}
/*
export function autocompleteFilterObjects(
    input: string,
    suggestionObjects: object[],
    properties: string[],
    options: AutocompleteOptions = {}
): object[] {
    let {
        typoTolerance = 3,
        minLengthForTypo = 3,
        matchFromStart = true,
        autocompleteSize = Math.min(15, suggestionObjects.length)
    } = options
    autocompleteSize = Math.min(suggestionObjects.length, autocompleteSize)

    if (!input || input.length == 0) return suggestionObjects.slice(0, autocompleteSize)

    let matches = Array.from(''.repeat(autocompleteSize))

    const inputLower = input.toLowerCase()
    const inputLength = input.length

    let perfectMatch = null as null | string
    let startsWithMatches = [] as string[]
    let exactMatches = [] as string[]

    for (let i = 0; i < suggestionObjects.length; i++) {
        const suggestedProperties = [] as any[]
        properties.forEach((p) => {
            suggestedProperties.push(suggestionObjects[i][p])
        })

        for (let j = 0; j < suggestedProperties.length; j++) {
            const suggestedProperty = suggestedProperties[j]
            if (suggestedProperty == inputLower) {
                perfectMatch = suggestedProperty
            } else if (suggestedProperty.startsWith(inputLower)) {
                startsWithMatches.push(suggestedProperty)
            } else if (suggestedProperty.includes(inputLower)) {
                exactMatches.push(suggestedProperty)
            }
        }
    }

    // replace the empty array

    let matchCount = 0

    if (perfectMatch) {
        matches[0] = perfectMatch
        matchCount++
    }
    for (let i = 0; i < startsWithMatches.length; i++) {
        if (matchCount > autocompleteSize - 1) break
        matches[matchCount] = startsWithMatches[i]
        matchCount++
    }
    for (let i = 0; i < exactMatches.length; i++) {
        if (matchCount > autocompleteSize - 1) break
        matches[matchCount] = exactMatches[i]
        matchCount++
    }

    // If options specify only exact matches,
    // or if the text is too short for typos
    // -> Then ignore rest of the code
    if (inputLength < minLengthForTypo || typoTolerance === 0) {
        return matches
    }

    for (let i = 0; i < suggestionObjects.length; i++) {
        if (matchCount >= autocompleteSize - 1) break

        const suggestion = suggestionObjects[i]
        if (matches.includes(suggestion)) continue

        // Check if suggestion starts with input (with typos)
        if (matchFromStart) {
            const suggestionStart = suggestion.substring(0, inputLength)
            if (levenshteinDistance(inputLower, suggestionStart) <= typoTolerance) {
                matches[matchCount] = suggestion
                matchCount++
            }
        }
    }

    // Check for close matches anywhere in the string
    for (let i = 0; i <= suggestionObjects.length - inputLength; i++) {
        const suggestion = suggestionObjects[i]

        if (matchCount >= autocompleteSize - 1) break
        const substring = suggestion.substring(i, i + inputLength)
        if (levenshteinDistance(inputLower, substring) <= typoTolerance) {
            matches[matchCount] = suggestion
            matchCount++
        }
    }

    return matches
}
*/

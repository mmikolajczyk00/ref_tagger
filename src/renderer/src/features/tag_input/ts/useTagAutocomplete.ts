import { ref, computed } from 'vue'
import { useTagStore } from '@renderer/core/stores/useTagStore'
import { normalizeTag } from '@renderer/core/utils/tagsUtils'
import type { Tag } from '@shared/types/models'

export interface TagAutocompleteOptions {
    queryNormalizer?: (raw: string) => string
}

export function useTagAutocomplete(
    excludeIds: () => Set<number>,
    options: TagAutocompleteOptions = {}
) {
    const tagStore = useTagStore()
    const queryNormalizer = options.queryNormalizer ?? normalizeTag

    const inputText = ref('')
    const selectedIndex = ref(-1)

    const suggestions = computed<Tag[]>(() => {
        const query = queryNormalizer(inputText.value.trim()).trim()
        if (!query) return []
        return tagStore.getMatchingTags(query, excludeIds())
    })

    const activeSuggestion = computed<Tag | null>(() => {
        if (selectedIndex.value >= 0 && selectedIndex.value < suggestions.value.length) {
            return suggestions.value[selectedIndex.value]
        }
        return null
    })

    const ghostText = computed<string>(() => {
        const query = queryNormalizer(inputText.value.trim()).trim()
        if (!query || suggestions.value.length === 0) return ''
        const first = suggestions.value[0].name
        if (first.toLowerCase().startsWith(query)) {
            return first.slice(query.length)
        }
        return ''
    })

    function selectSuggestion(index: number) {
        const sug = suggestions.value[index]
        if (sug) {
            inputText.value = sug.name
            selectedIndex.value = -1
        }
    }

    function reset() {
        inputText.value = ''
        selectedIndex.value = -1
    }

    function cycleDown() {
        if (suggestions.value.length > 0) {
            selectedIndex.value = (selectedIndex.value + 1) % suggestions.value.length
        }
    }

    function cycleUp() {
        if (suggestions.value.length > 0) {
            selectedIndex.value =
                selectedIndex.value <= 0 ? suggestions.value.length - 1 : selectedIndex.value - 1
        }
    }

    return {
        inputText,
        selectedIndex,
        suggestions,
        activeSuggestion,
        ghostText,
        selectSuggestion,
        reset,
        cycleDown,
        cycleUp
    }
}

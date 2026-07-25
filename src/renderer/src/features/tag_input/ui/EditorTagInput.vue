<script setup lang="ts">
import { computed } from 'vue'
import { useTagAutocomplete } from '../ts/useTagAutocomplete'
import { useTagStore } from '../../../core/stores/useTagStore'
import { normalizeTag } from '../../../core/utils/tagsUtils'
import BaseTagInput from './BaseTagInput.vue'

const modelValue = defineModel<string[]>({ required: true })

const props = defineProps<{
    existingTagIds?: number[]
}>()

const emit = defineEmits<{
    submit: []
}>()

const tagStore = useTagStore()

const excludeIds = computed(() => {
    const ids = new Set(props.existingTagIds ?? [])
    for (const name of modelValue.value) {
        const tag = tagStore.tags.find((t) => t.name === name)
        if (tag) ids.add(tag.id)
    }
    return ids
})

const {
    inputText,
    selectedIndex,
    suggestions,
    ghostText,
    selectSuggestion,
    reset,
    cycleDown,
    cycleUp
} = useTagAutocomplete(() => excludeIds.value)

function commitTag(name: string) {
    const normalized = normalizeTag(name)
    if (!normalized) return
    if (modelValue.value.includes(normalized)) return
    modelValue.value = [...modelValue.value, normalized]
    inputText.value = ''
    reset()
}

function onInput(value: string) {
    inputText.value = normalizeTag(value)
}

function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
        cycleDown()
        event.preventDefault()
    } else if (event.key === 'ArrowUp') {
        cycleUp()
        event.preventDefault()
    } else if (event.key === 'Tab') {
        event.preventDefault()
        const sug =
            selectedIndex.value >= 0 ? suggestions.value[selectedIndex.value] : suggestions.value[0]
        if (sug) {
            inputText.value = sug.name
            selectedIndex.value = -1
        }
    } else if (event.key === 'Enter') {
        event.preventDefault()
        if (selectedIndex.value >= 0) {
            const name = suggestions.value[selectedIndex.value].name
            selectSuggestion(selectedIndex.value)
            commitTag(name)
        } else if (inputText.value.trim()) {
            commitTag(inputText.value)
        } else if (modelValue.value.length > 0) {
            emit('submit')
        }
    } else if (event.key === ',') {
        if (inputText.value.trim()) {
            commitTag(inputText.value)
        }
        event.preventDefault()
    } else if (event.key === 'Escape') {
        reset()
        event.preventDefault()
    } else if (event.key === 'Backspace' && !inputText.value) {
        modelValue.value = modelValue.value.slice(0, -1)
    }
}
</script>

<template>
    <BaseTagInput
        v-model="modelValue"
        :input-value="inputText"
        :suggestions="suggestions"
        :selected-index="selectedIndex"
        :ghost-text="ghostText"
        placeholder="Add tags..."
        @keydown="handleKeydown"
        @update:input-value="onInput"
        @select-suggestion="
            (sug) => {
                const idx = suggestions.indexOf(sug)
                if (idx >= 0) selectSuggestion(idx)
                commitTag(sug.name)
            }
        "
        @highlight-suggestion="selectedIndex = $event"
        @blur="reset"
    />
</template>

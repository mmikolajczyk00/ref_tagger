<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTagStore } from '../../../core/stores/useTagStore'
import BaseTagInput from '../../tag_input/ui/BaseTagInput.vue'

const modelValue = defineModel<string[]>({ required: true })

const emit = defineEmits<{
    submit: []
}>()

const tagStore = useTagStore()

const inputText = ref('')
const selectedIndex = ref(-1)

function unprefix(text: string): { prefix: string; name: string } {
    const t = text.trim()
    if (t.startsWith('!!')) return { prefix: '!!', name: t.slice(2) }
    if (t.startsWith('--')) return { prefix: '--', name: t.slice(2) }
    if (t.startsWith('!')) return { prefix: '!', name: t.slice(1) }
    if (t.startsWith('-')) return { prefix: '-', name: t.slice(1) }
    return { prefix: '', name: t }
}

function sanitizeDraft(raw: string): string {
    const trimmed = raw.trim().toLowerCase()
    const hasModifier =
        trimmed.startsWith('!!') ||
        trimmed.startsWith('!') ||
        trimmed.startsWith('--') ||
        trimmed.startsWith('-')
    return hasModifier ? raw.replace(/\*/g, '_') : raw
}

const suggestions = computed(() => {
    const { name } = unprefix(inputText.value)
    if (!name) return []
    return tagStore.getMatchingTags(name, new Set())
})

const ghostText = computed(() => {
    const { name } = unprefix(inputText.value)
    if (!name || suggestions.value.length === 0) return ''
    const first = suggestions.value[0].name
    if (first.toLowerCase().startsWith(name.toLowerCase())) {
        return first.slice(name.length)
    }
    return ''
})

function reset() {
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

function commitTag(tagName: string, prefix: string) {
    const chip = prefix + tagName
    if (!tagName) return
    if (modelValue.value.includes(chip)) return
    modelValue.value = [...modelValue.value, chip]
    inputText.value = ''
    reset()
}

function onInput(value: string) {
    inputText.value = sanitizeDraft(value.toLowerCase())
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
            inputText.value = unprefix(inputText.value).prefix + sug.name
            selectedIndex.value = -1
        }
    } else if (event.key === 'Enter') {
        event.preventDefault()
        if (selectedIndex.value >= 0) {
            const sug = suggestions.value[selectedIndex.value]
            const { prefix } = unprefix(inputText.value)
            commitTag(sug.name, prefix)
        } else if (inputText.value.trim()) {
            const { prefix, name } = unprefix(inputText.value)
            commitTag(name, prefix)
        } else if (modelValue.value.length > 0) {
            emit('submit')
        }
    } else if (event.key === ',') {
        if (inputText.value.trim()) {
            const { prefix, name } = unprefix(inputText.value)
            commitTag(name, prefix)
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
        placeholder="Search"
        @keydown="handleKeydown"
        @update:input-value="onInput"
        @select-suggestion="
            (sug) => {
                const idx = suggestions.indexOf(sug)
                if (idx >= 0) {
                    const { prefix } = unprefix(inputText)
                    commitTag(sug.name, prefix)
                }
            }
        "
        @highlight-suggestion="selectedIndex = $event"
        @blur="reset"
    />
</template>

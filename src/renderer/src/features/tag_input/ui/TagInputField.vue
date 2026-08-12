<script setup lang="ts">
import { ref } from 'vue'
import type { Tag } from '@shared/types/models'

type DropdownDirection = 'up' | 'down'

const inputValue = defineModel<string>('inputValue', { required: true })

defineProps<{
    suggestions: Tag[]
    selectedIndex: number
    ghostText: string
    placeholder?: string
    dropdownDirection?: DropdownDirection
    disabled?: boolean
}>()

const emit = defineEmits<{
    keydown: [event: KeyboardEvent]
    'select-suggestion': [tag: Tag]
    'highlight-suggestion': [index: number]
    blur: []
}>()

const inputEl = ref<HTMLInputElement | null>(null)

defineExpose({
    focus: () => inputEl.value?.focus(),
    blur: () => inputEl.value?.blur()
})

function onInput(event: Event) {
    inputValue.value = (event.target as HTMLInputElement).value
}
</script>

<template>
    <div class="relative w-full">
        <div
            class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 flex items-center rounded-lg border px-2 py-1"
        >
            <div class="relative inline-flex min-w-20 flex-1">
                <span
                    class="pointer-events-none absolute inset-0 flex items-center text-sm"
                    aria-hidden="true"
                >
                    <span class="text-surface-950 dark:text-surface-0">{{ inputValue }}</span>
                    <span v-if="ghostText" class="text-surface-400 dark:text-surface-500">{{
                        ghostText
                    }}</span>
                    <span v-if="inputValue == ''" class="text-surface-400 dark:text-surface-500">{{
                        placeholder
                    }}</span>
                </span>
                <input
                    ref="inputEl"
                    class="caret-surface-950 dark:caret-surface-0 relative w-full bg-transparent py-1 text-sm text-transparent outline-none"
                    :value="inputValue"
                    :disabled="disabled"
                    @input="onInput"
                    @keydown="emit('keydown', $event)"
                    @blur="emit('blur')"
                />
            </div>
        </div>

        <div
            v-if="suggestions.length > 0"
            :class="[
                'border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 absolute z-50 w-full rounded-lg border shadow-lg',
                dropdownDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
            ]"
        >
            <div
                v-for="(sug, i) in suggestions"
                :key="sug.id"
                :class="[
                    'cursor-pointer px-3 py-1.5 text-sm',
                    i === selectedIndex
                        ? 'bg-primary text-primary-contrast'
                        : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'
                ]"
                @mousedown.prevent="emit('select-suggestion', sug)"
                @mouseenter="emit('highlight-suggestion', i)"
            >
                {{ sug.name }}
            </div>
        </div>
    </div>
</template>

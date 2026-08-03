<script setup lang="ts">
import type { Tag } from '@shared/types/models'

const modelValue = defineModel<string[]>({ required: true })
const inputValue = defineModel<string>('inputValue', { required: true })

defineProps<{
    suggestions: Tag[]
    selectedIndex: number
    ghostText: string
    placeholder?: string
}>()

const emit = defineEmits<{
    keydown: [event: KeyboardEvent]
    'select-suggestion': [tag: Tag]
    'highlight-suggestion': [index: number]
    blur: []
}>()

function removeChip(tagValue: string) {
    modelValue.value = modelValue.value.filter((t) => t !== tagValue)
}
</script>

<template>
    <div class="relative">
        <div
            class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 flex flex-wrap items-center gap-1 rounded-lg border px-2 py-1"
        >
            <Chip
                v-for="tag in modelValue"
                :key="tag"
                :label="tag"
                removable
                class="bg-primary text-primary-contrast text-xs font-medium"
                @remove="removeChip(tag)"
            />

            <div class="relative inline-flex min-w-20 flex-1">
                <span
                    class="pointer-events-none absolute inset-0 flex items-center text-sm"
                    aria-hidden="true"
                >
                    <span class="text-surface-950 dark:text-surface-0">{{ inputValue }}</span>
                    <span v-if="ghostText" class="text-surface-400 dark:text-surface-500">{{
                        ghostText
                    }}</span>
                </span>
                <input
                    class="caret-surface-950 dark:caret-surface-0 relative w-full bg-transparent py-1 text-sm text-transparent outline-none"
                    :value="inputValue"
                    :placeholder="modelValue.length === 0 ? placeholder : ''"
                    @input="inputValue = ($event.target as HTMLInputElement).value"
                    @keydown="emit('keydown', $event)"
                    @blur="emit('blur')"
                />
            </div>
        </div>

        <div
            v-if="suggestions.length > 0"
            class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 absolute z-50 mt-1 w-full rounded-lg border shadow-lg"
        >
            <div
                v-for="(sug, i) in suggestions"
                :key="sug.id"
                :class="[
                    'cursor-pointer px-3 py-1.5 text-sm',
                    i === selectedIndex
                        ? 'bg-primary text-primary-contrast'
                        : 'text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700'
                ]"
                @mousedown.prevent="emit('select-suggestion', sug)"
                @mouseenter="emit('highlight-suggestion', i)"
            >
                {{ sug.name }}
            </div>
        </div>
    </div>
</template>

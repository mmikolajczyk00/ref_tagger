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

function removeChip(index: number) {
    modelValue.value = modelValue.value.filter((_, i) => i !== index)
}
</script>

<template>
    <div class="relative">
        <div
            class="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1"
        >
            <Chip
                v-for="(tag, i) in modelValue"
                :key="i"
                :label="tag"
                removable
                class="bg-primary text-xs font-medium text-zinc-950"
                @remove="removeChip(i)"
            />

            <div class="relative inline-flex min-w-[80px] flex-1">
                <span
                    class="pointer-events-none absolute inset-0 flex items-center text-sm"
                    aria-hidden="true"
                >
                    <span class="text-zinc-100">{{ inputValue }}</span>
                    <span v-if="ghostText" class="text-zinc-500">{{ ghostText }}</span>
                </span>
                <input
                    class="relative w-full bg-transparent py-1 text-sm text-transparent caret-zinc-100 outline-none"
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
            class="absolute z-50 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-800 shadow-lg"
        >
            <div
                v-for="(sug, i) in suggestions"
                :key="sug.id"
                :class="[
                    'cursor-pointer px-3 py-1.5 text-sm',
                    i === selectedIndex
                        ? 'bg-primary text-zinc-950'
                        : 'text-zinc-300 hover:bg-zinc-700'
                ]"
                @mousedown.prevent="emit('select-suggestion', sug)"
                @mouseenter="emit('highlight-suggestion', i)"
            >
                {{ sug.name }}
            </div>
        </div>
    </div>
</template>

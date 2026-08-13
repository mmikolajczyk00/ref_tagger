<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { withAlpha } from '@renderer/core/utils/colorUtils'
import { DEFAULT_TAG_COLOR } from '@renderer/core/theme/colors'

type Variant = 'solid' | 'outlined' | 'dashed'

const props = withDefaults(
    defineProps<{
        label: string
        color?: string
        variant: Variant
        selected?: boolean
        editing?: boolean
        removable?: boolean
        disabled?: boolean
    }>(),
    { color: DEFAULT_TAG_COLOR }
)

const emit = defineEmits<{
    remove: []
    select: [event: MouseEvent]
    'begin-edit': []
    'commit-edit': [name: string]
    'cancel-edit': []
}>()

const editInputRef = ref<HTMLInputElement | null>(null)
const editValue = ref(props.label)

watch(
    () => props.editing,
    (editing) => {
        if (editing) {
            editValue.value = props.label
            nextTick(() => {
                editInputRef.value?.focus()
                editInputRef.value?.select()
            })
        }
    }
)

const isFilled = computed(() => props.selected || props.variant === 'solid')

const style = computed(() => ({
    color: props.color,
    backgroundColor: isFilled.value ? withAlpha(props.color, 0.2) : 'transparent',
    borderColor: props.color
}))

const borderClass = computed(() => {
    if (props.selected) return 'border border-solid'
    if (props.variant === 'dashed') return 'border border-dashed'
    if (props.variant === 'outlined') return 'border border-solid'
    return 'border border-transparent'
})

function commitEdit() {
    const next = editValue.value.trim()
    if (!next) return
    emit('commit-edit', next)
}

function cancelEdit() {
    editValue.value = props.label
    emit('cancel-edit')
}

function onEditKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        event.preventDefault()
        commitEdit()
    } else if (event.key === 'Escape') {
        event.preventDefault()
        cancelEdit()
    }
}

function onMouseDown(event: MouseEvent) {
    if (props.disabled || props.editing) return
    emit('select', event)
}

function onDoubleClick() {
    if (props.disabled) return
    emit('begin-edit')
}

function onRemoveClick(event: MouseEvent) {
    event.stopPropagation()
    emit('remove')
}
</script>

<template>
    <div
        :class="[
            'group inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium transition-colors',
            borderClass,
            selected
                ? 'ring-primary-500 ring-offset-surface-0 dark:ring-offset-surface-900 ring-2 ring-offset-1'
                : '',
            disabled ? 'opacity-50' : 'cursor-pointer'
        ]"
        :style="style"
        @mousedown="onMouseDown"
        @dblclick="onDoubleClick"
    >
        <input
            v-if="editing"
            ref="editInputRef"
            v-model="editValue"
            class="min-w-0 flex-1 bg-transparent text-sm outline-none"
            @keydown="onEditKeydown"
            @blur="commitEdit"
            @mousedown.stop
        />
        <template v-else>
            <span class="truncate">{{ label }}</span>
            <button
                v-if="removable"
                type="button"
                class="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                :style="{ color }"
                :aria-label="`Remove ${label}`"
                tabindex="-1"
                @mousedown.prevent
                @click="onRemoveClick"
            >
                <svg
                    viewBox="0 0 16 16"
                    class="h-3 w-3"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                >
                    <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
                </svg>
            </button>
        </template>
    </div>
</template>

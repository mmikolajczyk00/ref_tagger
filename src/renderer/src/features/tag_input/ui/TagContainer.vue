<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { createListSelection } from '@renderer/core/utils/listSelection'
import { normalizeTag } from '@renderer/core/utils/tagsUtils'
import { useTagStore } from '@renderer/core/stores/useTagStore'
import { useTagAutocomplete } from '../ts/useTagAutocomplete'
import { useTagInputModifiers } from '../ts/useTagInputModifiers'
import TagChip from './TagChip.vue'
import TagChipGroup from './TagChipGroup.vue'
import TagInputField from './TagInputField.vue'
import type { Tag } from '@shared/types/models'

const props = withDefaults(
    defineProps<{
        allItemsTags: Tag[]
        someItemsTags: Tag[]
        autocomplete?: boolean
        inline?: boolean
        allowModifiers?: boolean
        placeholder?: string
        disabled?: boolean
        hideInput?: boolean
        excludeIds?: number[]
    }>(),
    {
        autocomplete: false,
        inline: false,
        allowModifiers: false,
        placeholder: 'Add tags...',
        disabled: false,
        hideInput: false,
        excludeIds: () => []
    }
)

const emit = defineEmits<{
    'update:allItemsTags': [tags: Tag[]]
    'update:someItemsTags': [tags: Tag[]]
    add: [tag: Tag]
    remove: [tag: Tag]
    edit: [tag: Tag, newName: string]
    submit: []
}>()

// Local source of truth. Always reflects the latest prop on sync ticks,
// and updates synchronously on writes — unlike defineModel, which only
// syncs after the parent re-renders.
const allItems = ref<Tag[]>([...props.allItemsTags])
const someItems = ref<Tag[]>([...props.someItemsTags])

watch(
    () => props.allItemsTags,
    (v) => {
        allItems.value = [...v]
    },
    { flush: 'sync' }
)
watch(
    () => props.someItemsTags,
    (v) => {
        someItems.value = [...v]
    },
    { flush: 'sync' }
)

function setAllItems(next: Tag[]) {
    allItems.value = next
    emit('update:allItemsTags', next)
}

function setSomeItems(next: Tag[]) {
    someItems.value = next
    emit('update:someItemsTags', next)
}

const modifiers = useTagInputModifiers()
const tagStore = useTagStore()

const inputFieldRef = ref<InstanceType<typeof TagInputField> | null>(null)
const rootRef = ref<HTMLElement | null>(null)

defineExpose({
    focus: () => inputFieldRef.value?.focus(),
    blur: () => inputFieldRef.value?.blur()
})

onClickOutside(rootRef, () => selection.clearSelection())

const flatItems = computed(() => [...allItems.value, ...someItems.value])

const excludeIds = computed(
    () => new Set([...flatItems.value.map((t) => t.id), ...props.excludeIds])
)

const autocomplete = useTagAutocomplete(
    () => (props.autocomplete ? excludeIds.value : new Set<number>()),
    props.allowModifiers ? { queryNormalizer: modifiers.queryForAutocomplete } : {}
)

const selection = createListSelection(flatItems)

const editingId = ref<number | null>(null)
const suggestionOpen = ref(props.autocomplete)

function normalizeDraft(raw: string): string {
    return props.allowModifiers ? modifiers.sanitizeDraft(raw) : normalizeTag(raw)
}

function commitTag(name: string) {
    const normalized = props.allowModifiers ? modifiers.commit(name) : normalizeTag(name)
    if (!normalized) return
    if (flatItems.value.some((t) => t.name === normalized)) return

    const existing = tagStore.tags.find((t) => t.name === normalized)
    if (existing) {
        if (allItems.value.some((t) => t.id === existing.id)) return
        setAllItems([...allItems.value, existing])
        emit('add', existing)
    } else {
        const local: Tag = { id: -Date.now(), name: normalized }
        setAllItems([...allItems.value, local])
        emit('add', local)
    }

    autocomplete.reset()
}

function removeFromList(tag: Tag) {
    if (allItems.value.some((t) => t.id === tag.id)) {
        setAllItems(allItems.value.filter((t) => t.id !== tag.id))
    } else {
        setSomeItems(someItems.value.filter((t) => t.id !== tag.id))
    }
}

function onChipSelect(event: MouseEvent, tag: Tag) {
    const idx = flatItems.value.findIndex((t) => t.id === tag.id)
    if (idx >= 0) selection.handleItemClick(event, tag, idx)
    rootRef.value?.focus()
}

function onChipRemove(tag: Tag) {
    removeFromList(tag)
    selection.clearSelection()
    emit('remove', tag)
}

function onChipBeginEdit(tag: Tag) {
    editingId.value = tag.id
}

function onChipCommitEdit(tag: Tag, newName: string) {
    editingId.value = null
    if (newName === tag.name) return
    emit('edit', tag, newName)
}

function onChipCancelEdit() {
    editingId.value = null
}

function onKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' && suggestionOpen.value) {
        autocomplete.cycleDown()
        event.preventDefault()
    } else if (event.key === 'ArrowUp' && suggestionOpen.value) {
        autocomplete.cycleUp()
        event.preventDefault()
    } else if (event.key === 'Tab' && suggestionOpen.value) {
        event.preventDefault()
        const sug =
            autocomplete.selectedIndex.value >= 0
                ? autocomplete.suggestions.value[autocomplete.selectedIndex.value]
                : autocomplete.suggestions.value[0]
        if (sug) {
            autocomplete.inputText.value = sug.name
            autocomplete.selectedIndex.value = -1
        }
    } else if (event.key === 'Enter') {
        event.preventDefault()
        if (suggestionOpen.value && autocomplete.selectedIndex.value >= 0) {
            const sug = autocomplete.suggestions.value[autocomplete.selectedIndex.value]
            autocomplete.selectSuggestion(autocomplete.selectedIndex.value)
            commitTag(sug.name)
        } else if (autocomplete.inputText.value.trim()) {
            commitTag(autocomplete.inputText.value)
        } else if (flatItems.value.length > 0) {
            emit('submit')
        }
    } else if (event.key === ',') {
        if (autocomplete.inputText.value.trim()) {
            commitTag(autocomplete.inputText.value)
        }
        event.preventDefault()
    } else if (event.key === 'Escape') {
        autocomplete.reset()
        selection.clearSelection()
        event.preventDefault()
    } else if (event.key === 'Backspace' && !autocomplete.inputText.value) {
        if (allItems.value.length > 0) {
            const removed = allItems.value[allItems.value.length - 1]
            setAllItems(allItems.value.slice(0, -1))
            emit('remove', removed)
        }
    }
}

function onInputUpdate(value: string) {
    autocomplete.inputText.value = normalizeDraft(value)
}

function onInputPaste(text: string, event: ClipboardEvent) {
    if (!text.includes(',')) return
    event.preventDefault()
    const parts = text
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    for (const part of parts) {
        commitTag(part)
    }
    autocomplete.reset()
}

function copySelectedTags() {
    const names = flatItems.value
        .filter((t) => selection.isSelected(t.id))
        .map((t) => t.name)
        .join(', ')
    navigator.clipboard.writeText(names).catch(() => {})
}

function deleteSelectedTags() {
    const selectedIds = selection.selectedIds.value
    if (selectedIds.size === 0) return
    const allNext = allItems.value.filter((t) => !selectedIds.has(t.id))
    const someNext = someItems.value.filter((t) => !selectedIds.has(t.id))
    if (allNext.length !== allItems.value.length) setAllItems(allNext)
    if (someNext.length !== someItems.value.length) setSomeItems(someNext)
    for (const tag of flatItems.value.filter((t) => selectedIds.has(t.id))) {
        emit('remove', tag)
    }
    selection.clearSelection()
}

function onContainerKeydown(event: KeyboardEvent) {
    const active = document.activeElement as HTMLElement | null
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
    if (selection.selectedIds.value.size === 0) return

    if ((event.ctrlKey || event.metaKey) && (event.key === 'c' || event.key === 'x')) {
        event.preventDefault()
        copySelectedTags()
        if (event.key === 'x') deleteSelectedTags()
    } else if (
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        (event.key === 'Delete' || event.key === 'Backspace')
    ) {
        event.preventDefault()
        deleteSelectedTags()
    }
}

function onSelectSuggestion(sug: Tag) {
    const idx = autocomplete.suggestions.value.findIndex((s) => s.id === sug.id)
    if (idx >= 0) autocomplete.selectSuggestion(idx)
    commitTag(sug.name)
}

function onHighlightSuggestion(i: number) {
    autocomplete.selectedIndex.value = i
}

function onInputBlur() {
    autocomplete.reset()
}

function tagProps(tag: Tag) {
    return {
        label: tag.name,
        color: tag.color,
        selected: selection.isSelected(tag.id),
        editing: editingId.value === tag.id,
        removable: !props.disabled,
        disabled: props.disabled,
        onSelect: (e: MouseEvent) => onChipSelect(e, tag),
        onRemove: () => onChipRemove(tag),
        onBeginEdit: () => onChipBeginEdit(tag),
        onCommitEdit: (n: string) => onChipCommitEdit(tag, n),
        onCancelEdit: () => onChipCancelEdit()
    }
}
</script>

<template>
    <div ref="rootRef" class="w-full" tabindex="-1" @keydown="onContainerKeydown">
        <TagChipGroup :inline="inline">
            <template #chips>
                <template v-if="!inline">
                    <div
                        v-if="allItems.length"
                        class="flex flex-wrap content-start justify-start gap-1 p-1"
                    >
                        <TagChip
                            v-for="tag in allItems"
                            :key="tag.id"
                            v-bind="tagProps(tag)"
                            variant="outlined"
                        />
                    </div>
                    <div
                        v-if="someItems.length"
                        class="flex flex-wrap content-start justify-start gap-1 p-1"
                    >
                        <TagChip
                            v-for="tag in someItems"
                            :key="tag.id"
                            v-bind="tagProps(tag)"
                            variant="dashed"
                        />
                    </div>
                    <div
                        v-if="!allItems.length && !someItems.length"
                        class="dark:text-surface-500 text-surface-400 text-center"
                    >
                        - No tags added yet -
                    </div>
                </template>
                <template v-else>
                    <TagChip
                        v-for="tag in flatItems"
                        :key="tag.id"
                        v-bind="tagProps(tag)"
                        variant="outlined"
                    />
                </template>
            </template>
            <template v-if="!hideInput" #input>
                <TagInputField
                    ref="inputFieldRef"
                    :input-value="autocomplete.inputText.value"
                    :suggestions="suggestionOpen ? autocomplete.suggestions.value : []"
                    :selected-index="suggestionOpen ? autocomplete.selectedIndex.value : -1"
                    :ghost-text="suggestionOpen ? autocomplete.ghostText.value : ''"
                    :placeholder="placeholder"
                    :dropdown-direction="inline ? 'down' : 'up'"
                    :disabled="disabled"
                    @update:input-value="onInputUpdate"
                    @keydown="onKeydown"
                    @paste="onInputPaste"
                    @select-suggestion="onSelectSuggestion"
                    @highlight-suggestion="onHighlightSuggestion"
                    @blur="onInputBlur"
                />
            </template>
        </TagChipGroup>
    </div>
</template>

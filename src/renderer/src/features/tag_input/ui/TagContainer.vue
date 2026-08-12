<script setup lang="ts">
import { computed, ref } from 'vue'
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

const allItemsTags = defineModel<Tag[]>('allItemsTags', { required: true })
const someItemsTags = defineModel<Tag[]>('someItemsTags', { required: true })

const props = withDefaults(
    defineProps<{
        autocomplete?: boolean
        inline?: boolean
        allowModifiers?: boolean
        placeholder?: string
        disabled?: boolean
    }>(),
    {
        autocomplete: false,
        inline: false,
        allowModifiers: false,
        placeholder: 'Add tags...',
        disabled: false
    }
)

const emit = defineEmits<{
    add: [tag: Tag]
    remove: [tag: Tag]
    edit: [tag: Tag, newName: string]
    submit: []
}>()

const modifiers = useTagInputModifiers()
const tagStore = useTagStore()

const inputFieldRef = ref<InstanceType<typeof TagInputField> | null>(null)
const rootRef = ref<HTMLElement | null>(null)

defineExpose({
    focus: () => inputFieldRef.value?.focus(),
    blur: () => inputFieldRef.value?.blur()
})

onClickOutside(rootRef, () => selection.clearSelection())

const flatItems = computed(() => [...allItemsTags.value, ...someItemsTags.value])

const excludeIds = computed(() => new Set(flatItems.value.map((t) => t.id)))

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
        if (allItemsTags.value.some((t) => t.id === existing.id)) return
        allItemsTags.value = [...allItemsTags.value, existing]
        emit('add', existing)
    } else {
        const local: Tag = { id: -Date.now(), name: normalized, color: '#6b7280' }
        allItemsTags.value = [...allItemsTags.value, local]
        emit('add', local)
    }

    autocomplete.reset()
}

function removeFromList(tag: Tag) {
    if (allItemsTags.value.some((t) => t.id === tag.id)) {
        allItemsTags.value = allItemsTags.value.filter((t) => t.id !== tag.id)
    } else {
        someItemsTags.value = someItemsTags.value.filter((t) => t.id !== tag.id)
    }
}

function onChipSelect(event: MouseEvent, tag: Tag) {
    const idx = flatItems.value.findIndex((t) => t.id === tag.id)
    if (idx >= 0) selection.handleItemClick(event, tag, idx)
    inputFieldRef.value?.blur()
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
        if (allItemsTags.value.length > 0) {
            const removed = allItemsTags.value[allItemsTags.value.length - 1]
            allItemsTags.value = allItemsTags.value.slice(0, -1)
            emit('remove', removed)
        }
    }
}

function onInputUpdate(value: string) {
    autocomplete.inputText.value = normalizeDraft(value)
}

function onContainerKeydown(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey) || event.key !== 'c') return
    if (selection.selectedIds.value.size === 0) return
    const active = document.activeElement as HTMLElement | null
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return
    event.preventDefault()
    const names = flatItems.value
        .filter((t) => selection.isSelected(t.id))
        .map((t) => t.name)
        .join(', ')
    navigator.clipboard.writeText(names).catch(() => {})
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
    <div ref="rootRef" class="w-full" @keydown="onContainerKeydown">
        <TagChipGroup :inline="inline">
            <template #chips>
                <template v-if="!inline">
                    <div v-if="allItemsTags.length" class="flex flex-wrap gap-1">
                        <TagChip
                            v-for="tag in allItemsTags"
                            :key="tag.id"
                            v-bind="tagProps(tag)"
                            variant="outlined"
                        />
                    </div>
                    <div v-if="someItemsTags.length" class="flex flex-wrap gap-1">
                        <TagChip
                            v-for="tag in someItemsTags"
                            :key="tag.id"
                            v-bind="tagProps(tag)"
                            variant="dashed"
                        />
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
            <template #input>
                <TagInputField
                    ref="inputFieldRef"
                    :input-value="autocomplete.inputText.value"
                    :suggestions="suggestionOpen ? autocomplete.suggestions.value : []"
                    :selected-index="suggestionOpen ? autocomplete.selectedIndex.value : -1"
                    :ghost-text="suggestionOpen ? autocomplete.ghostText.value : ''"
                    :placeholder="placeholder"
                    :dropdown-direction="inline ? 'up' : 'down'"
                    :disabled="disabled"
                    @update:input-value="onInputUpdate"
                    @keydown="onKeydown"
                    @select-suggestion="onSelectSuggestion"
                    @highlight-suggestion="onHighlightSuggestion"
                    @blur="onInputBlur"
                />
            </template>
        </TagChipGroup>
    </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import type { Tag } from '@shared/types/models'
import TagContainer from '../../tag_input/ui/TagContainer.vue'
import { tagEditorRelationsKey, type TagEditorRelationsApi } from '../types'

const props = defineProps<{
    tagId: number
}>()

function useRelationsApi(): TagEditorRelationsApi {
    const api = inject(tagEditorRelationsKey)
    if (!api) throw new Error('TagRelationsExpansion: tagEditorRelationsKey not provided')
    return api
}

const api = useRelationsApi()

const parentsTags = ref<Tag[]>([])
const childrenTags = ref<Tag[]>([])
const emptyTags = ref<Tag[]>([])

const parents = computed(() => api.getParents(props.tagId))
const children = computed(() => api.getChildren(props.tagId))

watch(
    parents,
    (v) => {
        parentsTags.value = [...v]
    },
    { immediate: true }
)
watch(
    children,
    (v) => {
        childrenTags.value = [...v]
    },
    { immediate: true }
)

async function onAddParents(tags: Tag[]) {
    if (tags.length === 0) return
    await api.addParentByName(
        props.tagId,
        tags.map((t) => t.name)
    )
}

async function onRemoveParents(tags: Tag[]) {
    if (tags.length === 0) return
    await api.removeParent(
        props.tagId,
        tags.map((t) => t.id)
    )
}

async function onAddChildren(tags: Tag[]) {
    if (tags.length === 0) return
    await api.addChildByName(
        props.tagId,
        tags.map((t) => t.name)
    )
}

async function onRemoveChildren(tags: Tag[]) {
    if (tags.length === 0) return
    await api.removeChild(
        props.tagId,
        tags.map((t) => t.id)
    )
}

async function onEditTag(tag: Tag, newName: string) {
    await api.updateTagName(tag.id, newName)
}
</script>

<template>
    <div class="flex flex-row p-4">
        <div class="flex flex-1 flex-col">
            <h4 class="text-surface-500 mb-2 text-xs font-semibold tracking-wide uppercase">
                Parents
            </h4>
            <TagContainer
                v-model:all-items-tags="parentsTags"
                v-model:some-items-tags="emptyTags"
                autocomplete
                :exclude-ids="[tagId]"
                placeholder="Add parent..."
                @add="onAddParents"
                @remove="onRemoveParents"
                @edit="onEditTag"
            />
        </div>
        <Divider layout="vertical" />
        <div class="flex flex-1 flex-col">
            <h4 class="text-surface-500 mb-2 text-xs font-semibold tracking-wide uppercase">
                Children
            </h4>
            <TagContainer
                v-model:all-items-tags="childrenTags"
                v-model:some-items-tags="emptyTags"
                autocomplete
                :exclude-ids="[tagId]"
                placeholder="Add child..."
                @add="onAddChildren"
                @remove="onRemoveChildren"
                @edit="onEditTag"
            />
        </div>
    </div>
</template>

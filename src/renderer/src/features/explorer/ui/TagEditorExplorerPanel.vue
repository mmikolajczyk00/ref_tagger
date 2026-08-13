<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
    FileTagResult,
    MediaFile,
    Tag,
    TagOperation,
    TagOperationResult
} from '@shared/types/models'
import { useTagEditorPanel } from '../ts/useTagEditorPanel'
import TagContainer from '../../tag_input/ui/TagContainer.vue'
import { useTagStore } from '../../../core/stores/useTagStore'

const props = defineProps<{
    selectedFiles: MediaFile[]
}>()

const emit = defineEmits<{
    (e: 'files-updated', updates: FileTagResult[]): void
}>()

const selectedFilesRef = computed<MediaFile[]>(() => {
    const v = props.selectedFiles
    return Array.isArray(v) ? v : []
})

const { allGroup, someGroup, removeTag } = useTagEditorPanel(selectedFilesRef)

const tagStore = useTagStore()

const allItemsTags = ref<Tag[]>([])
const someItemsTags = ref<Tag[]>([])

watch(
    [allGroup, someGroup],
    ([all, some]) => {
        allItemsTags.value = [...all]
        someItemsTags.value = [...some]
    },
    { immediate: true }
)

async function applyOperations(ops: TagOperation[]) {
    const result = await window.api.files.applyTagOperations(ops)

    if (result.success) {
        const { files, tags } = result.data as TagOperationResult

        tagStore.addTagsLocally(tags)
        emit('files-updated', files)
    } else {
        console.error(result.error)
    }
}

function handleAddTag(tag: Tag) {
    const ops: TagOperation[] = []
    for (const file of selectedFilesRef.value) {
        const fileHasTag = file.tags.some((t) => t.name === tag.name)
        if (!fileHasTag) {
            ops.push({ action: 'add', fileId: file.id, tagName: tag.name })
        }
    }
    if (ops.length) applyOperations(ops)
}

function handleRemoveTag(tag: Tag) {
    const operations = removeTag(tag)
    if (!operations.length) return
    applyOperations(operations)
}
</script>

<template>
    <div
        class="border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900 flex h-full w-full flex-col rounded-lg border p-4"
    >
        <h3 class="text-surface-950 dark:text-surface-0 mb-3 text-lg font-bold">Edit Tags</h3>

        <div class="flex min-h-0">
            <TagContainer
                v-model:all-items-tags="allItemsTags"
                v-model:some-items-tags="someItemsTags"
                autocomplete
                @add="handleAddTag"
                @remove="handleRemoveTag"
            />
        </div>
    </div>
</template>

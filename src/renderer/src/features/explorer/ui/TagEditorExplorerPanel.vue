<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileTagResult, MediaFile, TagOperation, TagOperationResult } from '@shared/types/models'
import { useTagEditorPanel } from '../ts/useTagEditorPanel'
import { normalizeTag } from '../../../core/utils/tagsUtils'
import { withAlpha } from '../../../core/utils/colorUtils'
import EditorTagInput from '../../tag_input/ui/EditorTagInput.vue'
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

const { allGroup, someGroup, existingTagIds, submitTags, removeTag } = useTagEditorPanel(
    selectedFilesRef,
    normalizeTag
)

const pendingTags = ref<string[]>([])

const tagStore = useTagStore()

async function applyOperations(ops: TagOperation[]) {
    const result = await window.api.files.applyTagOperations(ops)

    if (result.success) {
        const { files, tags } = result.data as TagOperationResult

        tagStore.addTagsLocally(tags)
        emit('files-updated', files)

        pendingTags.value = []
    } else {
        console.error(result.error)
    }
}

function handleAddTags() {
    const operations = submitTags(pendingTags.value)
    if (!operations.length) return

    applyOperations(operations)
}

function handleRemoveTag(tag: any) {
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

        <div class="flex-1 overflow-y-auto pr-1">
            <div v-if="allGroup.length" class="mb-4">
                <div class="flex flex-wrap gap-2">
                    <Chip
                        v-for="tag in allGroup"
                        :key="tag.id"
                        :label="tag.name"
                        removable
                        class="font-semibold"
                        :style="{
                            color: tag.color,
                            backgroundColor: withAlpha(tag.color, 0.2)
                        }"
                        :pt="{ removeIcon: { color: tag.color } }"
                        @remove="handleRemoveTag(tag)"
                    />
                </div>
            </div>

            <div v-if="someGroup.length">
                <div class="flex flex-wrap gap-2">
                    <Chip
                        v-for="tag in someGroup"
                        :key="tag.id"
                        :label="tag.name"
                        removable
                        class="border border-dashed"
                        :style="{
                            color: tag.color,
                            backgroundColor: withAlpha(tag.color, 0.2),
                            borderColor: tag.color
                        }"
                        :pt="{ removeIcon: { color: tag.color } }"
                        @remove="handleRemoveTag(tag)"
                    />
                </div>
            </div>
        </div>

        <Divider class="my-3" />

        <div>
            <EditorTagInput
                v-model="pendingTags"
                :existing-tag-ids="allGroup.map((t) => t.id)"
                @submit="handleAddTags"
            />
            <Button label="Add Tags" class="mt-2 w-full" @click="handleAddTags" />
        </div>
    </div>
</template>

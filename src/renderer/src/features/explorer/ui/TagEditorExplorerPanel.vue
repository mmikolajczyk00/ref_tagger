<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { MediaFile, Tag } from '@shared/types/models'
import { useTagEditorPanel } from '../ts/useTagEditorPanel'
import TagContainer from '../../tag_input/ui/TagContainer.vue'
import { EXPLORER_COMMANDS } from '../commands/ExplorerCmd'
import { CommandService } from '../../../core/command_system/CommandService'

const props = defineProps<{
    selectedFiles: MediaFile[]
}>()

const commandService = inject<CommandService>('commandService')!

const selectedFilesRef = computed<MediaFile[]>(() => {
    const v = props.selectedFiles
    return Array.isArray(v) ? v : []
})

const { allGroup, someGroup } = useTagEditorPanel(selectedFilesRef)

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

function handleAddTags(tags: Tag[]) {
    if (tags.length === 0) return
    const tagNames = tags.map((t) => t.name)
    const fileIds = selectedFilesRef.value
        .filter((f) => !f.tags.some((t) => tagNames.includes(t.name)))
        .map((f) => f.id)
    if (fileIds.length === 0) return
    commandService.execute(EXPLORER_COMMANDS.ADD_TAGS_TO_FILES, tagNames, fileIds)
}

function handleRemoveTags(tags: Tag[]) {
    if (tags.length === 0) return
    const tagNames = tags.map((t) => t.name)
    const tagIds = tags.map((t) => t.id)
    const fileIds = selectedFilesRef.value
        .filter((f) => f.tags.some((t) => tagIds.includes(t.id)))
        .map((f) => f.id)
    if (fileIds.length === 0) return
    commandService.execute(EXPLORER_COMMANDS.REMOVE_TAGS_FROM_FILES, tagNames, tagIds, fileIds)
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
                @add="handleAddTags"
                @remove="handleRemoveTags"
            />
        </div>
    </div>
</template>

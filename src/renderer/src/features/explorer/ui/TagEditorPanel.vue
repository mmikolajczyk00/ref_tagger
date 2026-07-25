<script setup lang="ts">
import Chip from 'primevue/chip'
import InputText from 'primevue/inputtext'
import { eventBus } from '../../../events/bus'
import { MediaFile, TagOperation } from '@shared/types/models'
import { useTagEditor } from '../ts/useTagEditorPanel'
import { normalizeTag } from '../../../core/utils/tagsUtils'

const props = defineProps<{
    selectedFiles: MediaFile[]
}>()

const { inputText, allGroup, someGroup, submitTags, removeTag } = useTagEditor(
    () => props.selectedFiles,
    normalizeTag
)

async function applyOperations(ops: TagOperation[]) {
    const result = await window.api.files.applyTagOperations(ops)

    console.log('result', result)

    if (result.success) {
        console.log(result.data)

        const changed = result.data

        eventBus.emit('files:updated', {
            ids: new Set(changed.map((f) => f.id)),
            files: new Map(changed.map((f) => [f.id, f]))
        })
    } else {
        console.error(result.error)
    }
}

function handleAddTags() {
    const operations = submitTags()
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
    <div class="flex h-full w-full flex-col rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h3 class="mb-3 text-lg font-bold text-zinc-100">Edit Tags</h3>

        <div class="flex-1 overflow-y-auto pr-1">
            <div v-if="allGroup.length" class="mb-4">
                <div class="flex flex-wrap gap-2">
                    <Chip
                        v-for="tag in allGroup"
                        :key="tag.id"
                        :label="tag.name"
                        removable
                        class="bg-primary font-semibold text-zinc-950"
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
                        class="border-primary bg-primary/50 border border-dashed"
                        @remove="handleRemoveTag(tag)"
                    />
                </div>
            </div>
        </div>

        <Divider class="my-3" />

        <div>
            <InputText
                v-model="inputText"
                placeholder="Add tags (space or comma separated)..."
                class="w-full"
                @keydown.enter="handleAddTags"
            />
        </div>
    </div>
</template>

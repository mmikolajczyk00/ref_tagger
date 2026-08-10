<script setup lang="ts">
import { nextTick, ref, computed } from 'vue'
import type { QueuedFile } from '../ts/UploadQueue'
import { useUploadQueueDetailsPanel } from '../ts/useUploadQueueDetailsPanel'
import { useUploadQueueStore } from '../ts/useUploadQueueStore'
import { isLocked } from '../ts/UploadQueue'
import { normalizeTag } from '../../../core/utils/tagsUtils'
import { withAlpha, DEFAULT_TAG_BG_20, DEFAULT_TAG_COLOR } from '../../../core/utils/colorUtils'
import EditorTagInput from '../../tag_input/ui/EditorTagInput.vue'
import ExternalLink from '@primeicons/vue/external-link'

const props = defineProps<{
    selectedFiles: QueuedFile[]
}>()

const {
    dropDataAllGroup,
    dropDataSomeGroup,
    userTagsAllGroup,
    userTagsSomeGroup,
    existingUserTagIds,
    submitUserTags
} = useUploadQueueDetailsPanel(() => props.selectedFiles, normalizeTag)

const store = useUploadQueueStore()
const pendingTags = ref<string[]>([])

const anyLocked = computed(() => props.selectedFiles.some(isLocked))

const nameValue = computed({
    get: () => props.selectedFiles[0]?.dropData.name ?? '',
    set: (v: string) => {
        if (props.selectedFiles.length === 1) {
            store.updateName([props.selectedFiles[0].id], v)
        }
    }
})

const sourceValue = computed({
    get: () => props.selectedFiles[0]?.dropData.originalSourceUrl ?? '',
    set: (v: string) => {
        if (props.selectedFiles.length === 1) {
            store.updateOriginalSourceUrl([props.selectedFiles[0].id], v)
        }
    }
})

async function openSourceUrl() {
    const url = props.selectedFiles[0]?.dropData.originalSourceUrl
    if (!url) return
    try {
        await window.api.shell.openExternal(url)
    } catch (err) {
        console.error('Failed to open URL', err)
    }
}

function handleAddUserTags() {
    if (anyLocked.value) return
    const { fileIds, tags } = submitUserTags(pendingTags.value)
    if (!fileIds.length || !tags.length) return
    store.addUserTags(fileIds, tags)
    pendingTags.value = []
}

function handleRemoveDropDataTag(tag: string) {
    if (anyLocked.value) return
    const fileIds = props.selectedFiles.map((f) => f.id)
    store.removeDropDataTag(fileIds, tag)
}

function handleRemoveUserTag(tag: string) {
    if (anyLocked.value) return
    const fileIds = props.selectedFiles.map((f) => f.id)
    store.removeUserTag(fileIds, tag)
}

function handleClearAllDropData() {
    if (anyLocked.value) return
    const fileIds = props.selectedFiles.map((f) => f.id)
    store.clearDropDataTags(fileIds)
}

const hasDropDataTags = computed(
    () => dropDataAllGroup.value.length + dropDataSomeGroup.value.length > 0
)

const editingTag = ref<string | null>(null)
const editValue = ref('')
const editInputRef = ref<[HTMLInputElement | null]>([null])

const isEditingTagInSomeGroup = computed(() => {
    if (!editingTag.value) return false
    return dropDataSomeGroup.value.includes(editingTag.value)
})

function startEdit(ev: MouseEvent, name: string) {
    const target = ev.target as HTMLElement | null
    if (target?.closest('.p-chip-remove-icon')) return
    editingTag.value = name
    editValue.value = name
    nextTick(() => {
        const el = editInputRef.value![1] as HTMLInputElement | undefined
        if (!el) return
        el.focus()
        el.select()
    })
}

function cancelEdit() {
    editingTag.value = null
    editValue.value = ''
}

function submitEdit() {
    const tag = editingTag.value
    if (!tag) return
    const fileIds = props.selectedFiles
        .filter((f) => f.dropData.tags.includes(tag))
        .map((f) => f.id)
    if (fileIds.length) {
        store.removeDropDataTag(fileIds, tag)
        const newName = normalizeTag(editValue.value)
        if (newName) {
            store.addUserTags(fileIds, [newName])
        }
    }
    cancelEdit()
}
</script>

<template>
    <div
        class="border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900 relative flex h-full min-h-0 w-full flex-col items-center gap-2 rounded-lg border p-4 focus-within:outline-0"
    >
        <div v-if="!selectedFiles.length" class="text-surface-400 dark:text-surface-500 text-sm">
            Select files to edit tags
        </div>

        <template v-else>
            <template v-if="selectedFiles.length === 1">
                <div class="flex w-full shrink-0 gap-2">
                    <Label for="name" class="w-14">Name</Label
                    ><InputText
                        id="name"
                        v-model="nameValue"
                        class="w-full"
                        :disabled="anyLocked"
                    />
                </div>
                <div class="flex-co flex w-full shrink-0 gap-2">
                    <Label for="source" class="w-14">Source</Label>
                    <InputGroup>
                        <InputGroupAddon
                            class="hover:bg-surface-300 dark:hover:bg-surface-700 cursor-pointer duration-75"
                            :class="{ 'pointer-events-none opacity-50': anyLocked }"
                            @click="!anyLocked && openSourceUrl()"
                        >
                            <ExternalLink />
                        </InputGroupAddon>
                        <InputText
                            id="source"
                            v-model="sourceValue"
                            class="w-full"
                            :disabled="anyLocked"
                        />
                    </InputGroup>
                </div>
                <Divider class="my-3" />
            </template>

            <div class="flex min-h-0 w-full flex-1 flex-col gap-3">
                <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <div class="mb-1 flex shrink-0 items-center justify-between">
                        <h4 class="text-xs font-semibold uppercase">Scraped Tags</h4>
                        <button
                            v-if="hasDropDataTags && !anyLocked"
                            class="bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 cursor-pointer rounded px-2 py-1 text-xs transition-colors"
                            @click="handleClearAllDropData"
                        >
                            clear all
                        </button>
                    </div>
                    <div class="min-h-0 flex-1 overflow-y-auto">
                        <div class="flex min-h-0 flex-wrap gap-2 p-2">
                            <template v-for="name in dropDataAllGroup" :key="name">
                                <input
                                    v-if="editingTag === name"
                                    ref="editInputRef"
                                    v-model="editValue"
                                    type="text"
                                    class="chip-edit-input"
                                    :class="{
                                        'border border-dashed': isEditingTagInSomeGroup
                                    }"
                                    :style="{
                                        color: DEFAULT_TAG_COLOR,
                                        backgroundColor: DEFAULT_TAG_BG_20,
                                        borderColor: isEditingTagInSomeGroup
                                            ? DEFAULT_TAG_COLOR
                                            : 'transparent'
                                    }"
                                    @keydown.enter.prevent="submitEdit"
                                    @keydown.escape.prevent="cancelEdit"
                                    @blur="cancelEdit"
                                />
                                <Chip
                                    v-else
                                    :label="name"
                                    :removable="!anyLocked"
                                    class="cursor-text font-semibold"
                                    :style="{
                                        color: DEFAULT_TAG_COLOR,
                                        backgroundColor: DEFAULT_TAG_BG_20
                                    }"
                                    :pt="{ removeIcon: { color: DEFAULT_TAG_COLOR } }"
                                    @remove="handleRemoveDropDataTag(name)"
                                    @click="startEdit($event, name)"
                                />
                            </template>
                        </div>
                        <div
                            v-if="dropDataSomeGroup.length"
                            class="mt-2 flex min-h-0 flex-wrap gap-2"
                        >
                            <template v-for="name in dropDataSomeGroup" :key="name">
                                <input
                                    v-if="editingTag === name"
                                    ref="editInputRef"
                                    v-model="editValue"
                                    type="text"
                                    class="chip-edit-input border border-dashed"
                                    :style="{
                                        color: DEFAULT_TAG_COLOR,
                                        backgroundColor: DEFAULT_TAG_BG_20,
                                        borderColor: DEFAULT_TAG_COLOR
                                    }"
                                    @keydown.enter.prevent="submitEdit"
                                    @keydown.escape.prevent="cancelEdit"
                                    @blur="cancelEdit"
                                />
                                <Chip
                                    v-else
                                    :label="name"
                                    :removable="!anyLocked"
                                    class="cursor-text border border-dashed"
                                    :style="{
                                        color: DEFAULT_TAG_COLOR,
                                        backgroundColor: DEFAULT_TAG_BG_20,
                                        borderColor: DEFAULT_TAG_COLOR
                                    }"
                                    :pt="{ removeIcon: { color: DEFAULT_TAG_COLOR } }"
                                    @remove="handleRemoveDropDataTag(name)"
                                    @click="startEdit($event, name)"
                                />
                            </template>
                        </div>
                    </div>
                </div>

                <div
                    v-if="userTagsAllGroup.length > 0 || userTagsSomeGroup.length > 0"
                    class="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
                >
                    <h4 class="mb-1 shrink-0 text-xs font-semibold uppercase">User Tags</h4>
                    <div class="min-h-0 flex-1 overflow-y-auto">
                        <div v-if="userTagsAllGroup.length" class="flex min-h-0 flex-wrap gap-2">
                            <Chip
                                v-for="tag in userTagsAllGroup"
                                :key="tag.name"
                                :label="tag.name"
                                :removable="!anyLocked"
                                class="font-semibold"
                                :style="{
                                    color: tag.color,
                                    backgroundColor: withAlpha(tag.color, 0.2)
                                }"
                                :pt="{ removeIcon: { color: tag.color } }"
                                @remove="handleRemoveUserTag(tag.name)"
                            />
                        </div>
                        <div
                            v-if="userTagsSomeGroup.length"
                            class="mt-2 flex min-h-0 flex-wrap gap-2"
                        >
                            <Chip
                                v-for="tag in userTagsSomeGroup"
                                :key="tag.name"
                                :label="tag.name"
                                :removable="!anyLocked"
                                class="border border-dashed"
                                :style="{
                                    color: tag.color,
                                    backgroundColor: withAlpha(tag.color, 0.2),
                                    borderColor: tag.color
                                }"
                                :pt="{ removeIcon: { color: tag.color } }"
                                @remove="handleRemoveUserTag(tag.name)"
                            />
                        </div>
                    </div>
                </div>
            </div>

            <Divider class="my-3" />

            <div class="flex w-full shrink-0 flex-row items-center gap-2">
                <EditorTagInput
                    v-model="pendingTags"
                    class="w-full"
                    :existing-tag-ids="existingUserTagIds"
                    @submit="handleAddUserTags"
                />
                <Button
                    label="Add Tags"
                    class="px-4 text-nowrap"
                    :disabled="anyLocked"
                    @click="handleAddUserTags"
                />
            </div>
        </template>
    </div>
</template>

<style scoped>
.chip-edit-input {
    font-size: 0.75rem;
    line-height: 1rem;
    padding: 0.25rem 0.625rem;
    border-radius: 0.375rem;
    outline: none;
    min-width: 7rem;
    width: 7rem;
    font-weight: 600;
}
</style>

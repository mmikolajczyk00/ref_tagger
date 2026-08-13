<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { QueuedFile } from '../ts/UploadQueue'
import type { Tag } from '@shared/types/models'
import { useUploadQueueDetailsPanel } from '../ts/useUploadQueueDetailsPanel'
import { useUploadQueueStore } from '../ts/useUploadQueueStore'
import { isLocked } from '../ts/UploadQueue'
import { normalizeTag } from '../../../core/utils/tagsUtils'
import TagContainer from '../../tag_input/ui/TagContainer.vue'
import ExternalLink from '@primeicons/vue/external-link'

const props = defineProps<{
    selectedFiles: QueuedFile[]
}>()

const { dropDataAllGroup, dropDataSomeGroup, userTagsAllGroup, userTagsSomeGroup } =
    useUploadQueueDetailsPanel(() => props.selectedFiles, normalizeTag)

const store = useUploadQueueStore()

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

const selectedFileIds = computed(() => props.selectedFiles.map((f) => f.id))

async function openSourceUrl() {
    const url = props.selectedFiles[0]?.dropData.originalSourceUrl
    if (!url) return
    try {
        await window.api.shell.openExternal(url)
    } catch (err) {
        console.error('Failed to open URL', err)
    }
}

const scrapedAll = ref<Tag[]>([])
const scrapedSome = ref<Tag[]>([])
const userAll = ref<Tag[]>([])
const userSome = ref<Tag[]>([])

watch(
    [dropDataAllGroup, dropDataSomeGroup, userTagsAllGroup, userTagsSomeGroup],
    ([dropAll, dropSome, userA, userS]) => {
        scrapedAll.value = [...dropAll]
        scrapedSome.value = [...dropSome]
        userAll.value = [...userA]
        userSome.value = [...userS]
    },
    { immediate: true }
)

function handleAddUserTag(tag: Tag) {
    if (anyLocked.value) return
    const ids = selectedFileIds.value
    if (!ids.length) return
    store.addUserTags(ids, [tag.name])
}

function handleRemoveUserTag(tag: Tag) {
    if (anyLocked.value) return
    const ids = selectedFileIds.value
    if (!ids.length) return
    store.removeUserTag(ids, tag.name)
}

function handleEditUserTag(tag: Tag, newName: string) {
    if (anyLocked.value) return
    const normalized = normalizeTag(newName)
    if (!normalized || normalized === tag.name) return
    const ids = selectedFileIds.value
    if (!ids.length) return
    store.removeUserTag(ids, tag.name)
    store.addUserTags(ids, [normalized])
}

function handleRemoveScrapedTag(tag: Tag) {
    if (anyLocked.value) return
    const ids = selectedFileIds.value
    if (!ids.length) return
    store.removeDropDataTag(ids, tag.name)
}

function handleEditScrapedTag(tag: Tag, newName: string) {
    if (anyLocked.value) return
    const normalized = normalizeTag(newName)
    const ids = selectedFileIds.value
    if (!ids.length) return
    const filesWithOldTag = props.selectedFiles.filter((f) => f.dropData.tags.includes(tag.name))
    if (!filesWithOldTag.length) return
    const idsWithOld = filesWithOldTag.map((f) => f.id)
    store.removeDropDataTag(idsWithOld, tag.name)
    if (normalized && normalized !== tag.name) {
        store.addUserTags(idsWithOld, [normalized])
    }
}

function handleClearAllDropData() {
    if (anyLocked.value) return
    const ids = selectedFileIds.value
    if (!ids.length) return
    store.clearDropDataTags(ids)
}

const hasDropDataTags = computed(
    () => dropDataAllGroup.value.length + dropDataSomeGroup.value.length > 0
)
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
                    <div class="flex min-h-0 flex-1">
                        <TagContainer
                            v-model:all-items-tags="scrapedAll"
                            v-model:some-items-tags="scrapedSome"
                            hide-input
                            :disabled="anyLocked"
                            @remove="handleRemoveScrapedTag"
                            @edit="handleEditScrapedTag"
                        />
                    </div>
                </div>

                <div
                    v-if="userTagsAllGroup.length > 0 || userTagsSomeGroup.length > 0 || !anyLocked"
                    class="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
                >
                    <h4 class="mb-1 shrink-0 text-xs font-semibold uppercase">User Tags</h4>
                    <div class="min-h-0 flex-1">
                        <TagContainer
                            v-model:all-items-tags="userAll"
                            v-model:some-items-tags="userSome"
                            autocomplete
                            :disabled="anyLocked"
                            @add="handleAddUserTag"
                            @remove="handleRemoveUserTag"
                            @edit="handleEditUserTag"
                        />
                    </div>
                </div>
            </div>
        </template>
    </div>
</template>

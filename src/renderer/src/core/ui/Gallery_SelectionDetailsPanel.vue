<script setup lang="ts">
import { ref, triggerRef, watch } from 'vue'
import imgpath from '../assets/img/defaultImage.png'
import TagChip from './tags/TagChip.vue'
import { FileModel } from '../../../../shared/model/fileModel'
import { useFileStore } from '../stores/useFileStore'
import TagsInput from './tags/TagsInput.vue'
import BrowserLink from './BrowserLink.vue'
import { useVirtualList } from '@vueuse/core'

const props = defineProps({
    selectedFiles: { type: Array<FileModel>, required: true }
})

const emit = defineEmits(['addTagToFiles', 'removeTagFromFiles', 'clearTagsOnFiles'])

const fileStore = useFileStore()

const selectedFilesTagData = ref<Set<TagData>>(new Set())

const sharedTags = ref<Set<string>>(new Set())
const otherTags = ref<Set<string>>(new Set())
const inputTags = ref<string[]>([])

interface TagData {
    shared: boolean
    disabled: boolean
    name: string
}

// watch changes to selected files
// deterine which tags are shared among all files and which aren't
watch(
    props,
    async (newProps) => {
        const newFiles = newProps.selectedFiles

        if (newFiles.length <= 0) {
            sharedTags.value.clear()
            otherTags.value.clear()
            return
        }

        let allTagData: Set<TagData> = new Set()

        console.log('tags', newFiles[0].tags)

        let shared: Set<string> = new Set(newFiles[0].getTagsNamesSet())
        let other: Set<string> = new Set()

        // loop through each file, and get its tags
        for (let i = 1; i < newFiles.length; i++) {
            // keep in sharedTags only those tags, that are present in the file's tags

            const allFileTags = new Set(newFiles[i].getTagsNamesSet())

            other = shared.symmetricDifference(allFileTags.union(other))
            shared = shared.intersection(allFileTags)
        }

        // populate allTagData

        shared.forEach((tag) => {
            allTagData.add({ shared: true, name: tag, disabled: false })
        })
        other.forEach((tag) => {
            allTagData.add({ shared: false, name: tag, disabled: false })
        })

        sharedTags.value = shared
        otherTags.value = other
        selectedFilesTagData.value = allTagData

        triggerRef(sharedTags)
        triggerRef(otherTags)
        triggerRef(selectedFilesTagData)
    },
    { deep: true }
)

function removeTagFromSelected(tag: string): void {
    emit('removeTagFromFiles', tag)
}

function clearAllTagsInSelected(): void {
    emit('clearTagsOnFiles')
}

function addTagToSelected(tag: string): void {
    emit('addTagToFiles', tag)
}

const rating = ref(5)

const isActive = ref(true)
</script>
<template>
    <div
        class="relative flex flex-col items-center gap-1"
        :class="[isActive ? 'max-w-full p-4' : 'max-w-12 p-1']"
    >
        <Button
            :class="[isActive ? 'absolute top-2 left-2 size-10' : 'size-full', ' ']"
            text
            @click="isActive = !isActive"
            severity="secondary"
            ><span class="material-symbols-outlined">{{
                isActive ? 'keyboard_arrow_right' : 'keyboard_arrow_left'
            }}</span></Button
        >
        <template v-if="isActive">
            <!-- file count -->
            <p class="border-surface-400 text-surface-300 border-b pb-4">
                {{ selectedFiles.length }} files selected
            </p>

            <!-- source -->
            <template v-if="selectedFiles.length > 0">
                <!-- tags -->
                <ButtonGroup class="h-9 w-full">
                    <Button
                        v-tooltip.top="'clear all'"
                        class="w-full rounded-b-none"
                        @click="clearAllTagsInSelected"
                        ><span class="material-symbols-outlined">delete_sweep</span></Button
                    >
                </ButtonGroup>
                <div
                    class="bg-surface-800 flex min-h-16 w-full flex-2 flex-row flex-wrap content-start gap-1 overflow-y-auto rounded-none p-3"
                >
                    <TagChip
                        v-for="tagData in selectedFilesTagData"
                        :key="tagData.name"
                        :removable="true"
                        :name="tagData.name"
                        :solid="tagData.shared"
                        :disabled="tagData.disabled"
                        @remove="
                            () => {
                                tagData.disabled = true
                                removeTagFromSelected(tagData.name)
                            }
                        "
                    ></TagChip>
                </div>

                <TagsInput
                    v-model:input-tags="inputTags"
                    input-style="p-2 w-full outline-none"
                    class="z-10 w-full rounded-sm rounded-t-none"
                    :icon="false"
                    placeholder="add tags"
                    :show-tags="false"
                    @add-tag="addTagToSelected"
                ></TagsInput>

                <div class="border-surface-400 my-1 w-full border-t pb-1"></div>

                <!-- source -->
                <template v-if="selectedFiles.length == 1">
                    <span class="text-dimmed -mb-1 w-full justify-start">source:</span>
                    <BrowserLink :href="selectedFiles[0].source" class="mb-2"></BrowserLink>
                </template>
            </template>
        </template>
    </div>
</template>

<style scoped></style>

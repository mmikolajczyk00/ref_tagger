<script setup lang="ts">
import { onActivated, onMounted, ref, watch } from 'vue'
import { clamp, useIntersectionObserver } from '@vueuse/core'
import { useExplorer } from '../ts/useExplorer'
import { FileTagResult, MediaFile } from 'src/shared/types/models'

import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import TagEditorPanel from './TagEditorPanel.vue'
import { useSelectionManager } from '../../../core/composables/useSelectionManager'
import SearchTagInput from '../../search/ui/SearchTagInput.vue'
import { useCanvasStore } from '../../canvas/ts/useCanvasStore'

const canvasStore = useCanvasStore()

const {
    refetch,
    mediaFiles,
    initialize,
    search,
    fetchNextPage,
    applyFileTagUpdates,
    applyFileTagUpdatesToMap
} = useExplorer()

const { selectedItems, handleItemClick, clearSelection, isSelected } = useSelectionManager(() => {
    return Array.from(mediaFiles.value.values())
})

const searchChips = ref<string[]>([])

watch(searchChips, (chips) => {
    search(chips)
})

function handleSearchSubmit() {
    search(searchChips.value)
}

function clearSearch() {
    searchChips.value = []
}

function openCanvas(id: number) {
    canvasStore.fetchOpenCanvas(id)
}

function onFilesUpdated(updates: FileTagResult[]) {
    applyFileTagUpdates(updates)
    const byId = new Map(selectedItems.value.map((f) => [f.id, f] as [number, MediaFile]))
    applyFileTagUpdatesToMap(byId, updates)
}

// REFS

// ZOOM THUMBNAIL SIZE
const thumbnailScale = ref(200 as number)
const thumbnailScale_min = 100
const thumbnailScale_max = 600

function handleWheel(e: WheelEvent) {
    if (e.ctrlKey) {
        thumbnailScale.value -= e.deltaY / 2
        thumbnailScale.value = clamp(thumbnailScale.value, thumbnailScale_min, thumbnailScale_max)
    }
}

const mediaSentinel = ref<HTMLElement | null>(null)
useIntersectionObserver(mediaSentinel, ([{ isIntersecting }]) => {
    if (isIntersecting) fetchNextPage()
})

onActivated(() => {
    refetch()
    canvasStore.fetchCanvases()
})

onMounted(() => {
    initialize()
})
</script>

<template>
    <Splitter class="bg-surface-0 dark:bg-surface-950 size-full overflow-hidden">
        <SplitterPanel
            class="text-surface-950 dark:text-surface-0 flex size-full flex-col p-6 focus-visible:outline-0"
            :style="{ '--thumb-size': `${thumbnailScale}px` }"
        >
            <div class="mb-4 flex shrink-0 items-center gap-2">
                <div class="flex-1">
                    <SearchTagInput v-model="searchChips" @submit="handleSearchSubmit" />
                </div>
                <button
                    v-if="searchChips.length > 0"
                    class="bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 rounded px-3 py-1.5 text-sm transition-colors"
                    @click="clearSearch"
                >
                    Clear
                </button>
            </div>

            <Splitter class="flex flex-col" layout="vertical">
                <SplitterPanel @wheel="handleWheel">
                    <div
                        class="flex size-full flex-row flex-wrap content-start items-start justify-start gap-1 overflow-clip overflow-y-auto focus-visible:outline-0"
                    >
                        <div
                            v-for="c in Array.from(canvasStore.availableCanvases.values())"
                            :key="c.id"
                            class="media-file border-surface-200 dark:border-surface-800 bg-surface-200 dark:bg-surface-800 hover:border-surface-400 dark:hover:border-surface-600 group relative flex aspect-square flex-col overflow-hidden border transition-colors"
                            @dblclick.left.stop="openCanvas(c.id)"
                        >
                            <div class="flex flex-1 items-center justify-center">
                                <span class="text-surface-400 dark:text-surface-500 text-2xl"
                                    >#</span
                                >
                            </div>

                            <div
                                class="border-surface-300/80 dark:border-surface-800/80 bg-surface-0/90 dark:bg-surface-900/90 absolute bottom-0 flex w-full flex-col gap-0.5 border-t p-2 text-xs backdrop-blur-sm"
                            >
                                <span
                                    class="text-surface-700 dark:text-surface-300 group-hover:text-surface-950 dark:group-hover:text-surface-0 truncate font-medium transition-colors"
                                >
                                    {{ c.name }}
                                </span>
                                <span
                                    class="text-surface-400 dark:text-surface-500 truncate text-[10px]"
                                >
                                    #{{ c.id }}
                                </span>
                            </div>

                            <span
                                class="material-symbols-outlined text-surface-500 bg-surface-0/80 dark:bg-surface-900/80 absolute right-1 bottom-1 z-10 cursor-pointer rounded p-0.5 text-sm opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500 hover:text-white dark:hover:bg-red-600"
                                @click.left.stop.prevent="canvasStore.deleteCanvas(c.id)"
                                >delete</span
                            >
                        </div>
                    </div>
                </SplitterPanel>
                <SplitterPanel @wheel="handleWheel" @click="clearSelection">
                    <div
                        class="flex size-full flex-row flex-wrap content-start items-start justify-start gap-1 overflow-clip overflow-y-auto"
                    >
                        <div
                            v-for="(f, index) in Array.from(mediaFiles.values())"
                            :key="f.id"
                            class="media-file border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 hover:border-surface-400 dark:hover:border-surface-600 group relative flex aspect-square flex-col overflow-hidden border transition-colors select-none"
                            @click.left.stop="handleItemClick($event, f, index)"
                        >
                            <div
                                v-show="isSelected(f.id)"
                                class="bg-primary/30 absolute size-full"
                            ></div>
                            <img
                                :src="`media://load?path=${f.filePath}`"
                                :alt="f.fileName"
                                class="loading-lazy bg-surface-200 dark:bg-surface-950 pointer-events-none w-full flex-1 object-cover"
                            />

                            <div
                                class="border-surface-300/80 dark:border-surface-800/80 bg-surface-0/90 dark:bg-surface-900/90 absolute bottom-0 flex w-full flex-col gap-0.5 border-t p-2 text-xs backdrop-blur-sm"
                            >
                                <span
                                    class="text-surface-700 dark:text-surface-300 group-hover:text-surface-950 dark:group-hover:text-surface-0 truncate font-medium transition-colors"
                                >
                                    {{ f.fileName }}
                                </span>
                                <span
                                    class="text-surface-400 dark:text-surface-500 truncate text-[10px]"
                                >
                                    #{{ f.id }}
                                </span>
                            </div>
                        </div>
                        <div ref="mediaSentinel" class="h-1 w-full shrink-0"></div>
                    </div>
                </SplitterPanel>
            </Splitter>
        </SplitterPanel>
        <SplitterPanel :min-size="5" :size="15">
            <TagEditorPanel
                :selected-files="selectedItems"
                @files-updated="onFilesUpdated"
            ></TagEditorPanel>
        </SplitterPanel>
    </Splitter>
</template>

<style scoped>
.media-file {
    width: var(--thumb-size);
    height: var(--thumb-size);
    content-visibility: auto;
    contain-intrinsic-size: var(--thumb-size);
}
</style>

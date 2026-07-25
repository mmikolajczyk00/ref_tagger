<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { clamp } from '@vueuse/core'
import { useExplorer } from '../ts/useExplorer'

import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import TagEditorPanel from './TagEditorPanel.vue'
import { useSelectionManager } from '../../../core/composables/useSelectionManager'
import SearchTagInput from '../../search/ui/SearchTagInput.vue'

const { mediaFiles, resetAndRefresh, initialize, search } = useExplorer()

const { selectedItems, handleItemClick, clearSelection, isSelected } = useSelectionManager(() => {
    return mediaFiles.value
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

// REFS

// ZOOM THUMBNAIL SIZE
const thumbnailScale = ref(300 as number)
const thumbnailScale_min = 100
const thumbnailScale_max = 600

function handleWheel(e: WheelEvent) {
    if (e.ctrlKey) {
        thumbnailScale.value -= e.deltaY / 2
        thumbnailScale.value = clamp(thumbnailScale.value, thumbnailScale_min, thumbnailScale_max)
    }
}

onMounted(() => {
    initialize()
})
</script>

<template>
    <Splitter class="size-full overflow-hidden">
        <SplitterPanel
            class="bg-surface-0 dark:bg-surface-950 text-surface-950 dark:text-surface-0 flex size-full flex-col p-6 focus-visible:outline-0"
        >
            <header class="mb-6 flex shrink-0 items-center justify-between">
                <div>
                    <h1 class="text-xl font-bold">Explorer</h1>
                </div>
                <button
                    class="bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 rounded px-3 py-1.5 text-sm transition-colors"
                    @click="resetAndRefresh"
                >
                    Refresh Library
                </button>
            </header>

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

            <div
                class="bg-surface-100 dark:bg-surface-900 flex size-full flex-row flex-wrap content-start items-start justify-start gap-1 overflow-clip overflow-y-auto"
                :style="{ '--thumb-size': `${thumbnailScale}px` }"
                @wheel="handleWheel"
                @click="clearSelection"
            >
                <div
                    v-for="(f, index) in mediaFiles"
                    :key="f.id"
                    class="media-file border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 hover:border-surface-400 dark:hover:border-surface-600 group relative flex aspect-square flex-col overflow-hidden border transition-colors select-none"
                    @click.left.stop="handleItemClick($event, f, index)"
                >
                    <div v-show="isSelected(f.id)" class="bg-primary/30 absolute size-full"></div>
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
                        <span class="text-surface-400 dark:text-surface-500 truncate text-[10px]">
                            #{{ f.id }} — {{ f.filePath }}
                        </span>
                    </div>
                </div>
            </div>
        </SplitterPanel>
        <SplitterPanel :min-size="5" :size="15">
            <TagEditorPanel :selected-files="selectedItems"></TagEditorPanel>
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

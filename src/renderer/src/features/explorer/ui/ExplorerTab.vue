<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { clamp } from '@vueuse/core'
import { ExplorerTabPayload } from '../../tab_system/Tabs'

import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import SearchTagInput from '../../search/ui/SearchTagInput.vue'
import { useCanvasStore } from '../../canvas/ts/useCanvasStore'
import { useExplorerStore } from '../ts/useExplorerStore'
import MediaFileExplorerList from './MediaFileExplorerList.vue'
import CanvasExplorerList from './CanvasExplorerList.vue'
import TagEditorExplorerPanel from './TagEditorExplorerPanel.vue'

const canvasStore = useCanvasStore()
const props = defineProps<ExplorerTabPayload>()

const explorerStore = useExplorerStore()
const explorer = explorerStore.getOrCreate(props.explorerTabId)

const searchChips = ref<string[]>([])

watch(searchChips, (chips) => {
    explorer.search(chips)
})

function handleSearchSubmit() {
    explorer.search(searchChips.value)
}

function clearSearch() {
    searchChips.value = []
}

const mediaFilesArr = computed(() => Array.from(explorer.mediaFiles.values()))

const thumbnailScale = ref(200 as number)
const thumbnailScale_min = 100
const thumbnailScale_max = 600

function handleWheel(e: WheelEvent) {
    if (e.ctrlKey) {
        thumbnailScale.value -= e.deltaY / 2
        thumbnailScale.value = clamp(thumbnailScale.value, thumbnailScale_min, thumbnailScale_max)
    }
}

onActivated(() => {
    explorer.refetch()
    canvasStore.fetchCanvases()
})

onMounted(() => {
    explorer.initialize()
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
                <SplitterPanel
                    class="focus-visible:outline-0"
                    @wheel="handleWheel"
                    @click="explorer.selection.clearSelection"
                >
                    <CanvasExplorerList />
                </SplitterPanel>
                <SplitterPanel
                    class="focus-visible:outline-0"
                    @wheel="handleWheel"
                    @click="explorer.selection.clearSelection"
                >
                    <MediaFileExplorerList :files="mediaFilesArr" :explorer="explorer" />
                </SplitterPanel>
            </Splitter>
        </SplitterPanel>
        <SplitterPanel :min-size="5" :size="15">
            <TagEditorExplorerPanel
                :selected-files="explorer.selectedItems"
            ></TagEditorExplorerPanel>
        </SplitterPanel>
    </Splitter>
</template>

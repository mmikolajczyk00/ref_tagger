<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { clamp } from '@vueuse/core'
import { useDialog } from 'primevue/usedialog'
import { ExplorerTabPayload } from '../../tab_system/Tabs'

import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import ContextMenu from 'primevue/contextmenu'
import SearchTagInput from '../../search/ui/SearchTagInput.vue'
import { useCanvasStore } from '../../canvas/ts/useCanvasStore'
import { useExplorerStore } from '../ts/useExplorerStore'
import MediaFileExplorerList from './MediaFileExplorerList.vue'
import CanvasExplorerList from './CanvasExplorerList.vue'
import TagEditorExplorerPanel from './TagEditorExplorerPanel.vue'
import AddToCanvasDialog from './AddToCanvasDialog.vue'

const canvasStore = useCanvasStore()
const dialog = useDialog()
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

const canvasMenu = ref()
const mediaMenu = ref()

const canvasMenuItems = ref([
    { label: 'Open', command: () => console.log('open canvas') },
    { label: 'Delete', command: () => console.log('delete canvas') }
])

const mediaMenuItems = ref([
    { label: 'Delete selected', command: onDeleteSelected },
    { label: 'Add to canvas', command: onAddToCanvas },
    { label: 'Add to new canvas', command: onAddToNewCanvas }
])

function onContextMenu(e: MouseEvent, which: 'canvas' | 'media') {
    if (which === 'media' && explorer.selectedItems.length === 0) return
    ;(which === 'canvas' ? canvasMenu.value : mediaMenu.value)?.show(e)
}

function onDeleteSelected() {
    console.log('delete selected', explorer.selectedItems.length)
}

const selectedFileIds = computed(() => explorer.selectedItems.map((f) => f.id))

function onAddToNewCanvas() {
    canvasStore.addAndOpenNewCanvas(selectedFileIds.value)
}

async function onAddToCanvas() {
    await canvasStore.fetchCanvases()

    const openTabs = canvasStore.getOpenCanvasTabs()
    const openIds = new Set(openTabs.map((t) => t.canvasId))
    const items = [
        ...openTabs.map((t) => ({ id: t.canvasId, title: t.title, isOpen: true })),
        ...Array.from(canvasStore.availableCanvases.values())
            .filter((c) => !openIds.has(c.id))
            .map((c) => ({ id: c.id, title: c.name, isOpen: false }))
    ]

    const canvasId = await new Promise<number | undefined>((resolve) => {
        dialog.open(AddToCanvasDialog, {
            data: { items },
            onClose: (options) => resolve(options?.data?.canvasId as number | undefined)
        })
    })

    if (canvasId === undefined) return
    await canvasStore.addFilesToCanvas(canvasId, selectedFileIds.value)
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
                    @contextmenu.prevent="(e) => onContextMenu(e, 'canvas')"
                >
                    <CanvasExplorerList />
                </SplitterPanel>
                <SplitterPanel
                    class="focus-visible:outline-0"
                    @wheel="handleWheel"
                    @click="explorer.selection.clearSelection"
                    @contextmenu.prevent="(e) => onContextMenu(e, 'media')"
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

    <ContextMenu ref="canvasMenu" :model="canvasMenuItems" />
    <ContextMenu ref="mediaMenu" :model="mediaMenuItems" />
</template>

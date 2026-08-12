<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useUploadQueueStore } from '../ts/useUploadQueueStore'
import ScrapePanel from './ScrapePanel.vue'
import UploadPanel from './UploadPanel.vue'
import { handleDrop } from '../ts/DropHandler'
import TagProcessingPanel from './TagProcessingPanel.vue'
import TagsProcessingPanel from './TagsProcessingPanel.vue'

const isDragging = ref(false)
let dragCounter = 0

const store = useUploadQueueStore()

const activeTab = ref('2')

function isFileDrag(e: DragEvent): boolean {
    return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}

function onWindowDragEnter(e: DragEvent) {
    if (!isFileDrag(e)) return
    dragCounter++
    isDragging.value = true
}

function onWindowDragLeave() {
    dragCounter = Math.max(0, dragCounter - 1)
    if (dragCounter === 0) isDragging.value = false
}

function onWindowDrop() {
    dragCounter = 0
    isDragging.value = false
}

onMounted(() => {
    window.addEventListener('dragenter', onWindowDragEnter)
    window.addEventListener('dragleave', onWindowDragLeave)
    window.addEventListener('drop', onWindowDrop)
})

onUnmounted(() => {
    window.removeEventListener('dragenter', onWindowDragEnter)
    window.removeEventListener('dragleave', onWindowDragLeave)
    window.removeEventListener('drop', onWindowDrop)
})

async function handleDropEvent(event: DragEvent) {
    isDragging.value = false
    dragCounter = 0

    handleDrop(event)
}
</script>

<template>
    <div
        class="relative flex h-full flex-col"
        @dragover.prevent="isDragging = true"
        @drop.prevent="handleDropEvent"
    >
        <Tabs :value="activeTab" class="flex h-full min-h-0 flex-1 flex-col">
            <TabList>
                <Tab value="0">Scrape</Tab>
                <Tab value="1">Upload</Tab>
                <Tab value="2">Tag Processing</Tab>
            </TabList>
            <TabPanels class="flex h-full min-h-0 flex-1 overflow-hidden">
                <TabPanel
                    value="0"
                    class="h-full min-h-0 flex-1 overflow-hidden focus-within:outline-0"
                >
                    <ScrapePanel />
                </TabPanel>
                <TabPanel value="1" class="min-h-0 flex-1 overflow-hidden focus-within:outline-0">
                    <UploadPanel />
                </TabPanel>
                <TabPanel value="2" class="min-h-0 flex-1 overflow-hidden focus-within:outline-0">
                    <TagsProcessingPanel />
                </TabPanel>
            </TabPanels>
        </Tabs>

        <div
            v-show="isDragging"
            class="pointer-events-none absolute inset-0 z-50 flex items-center justify-center"
        >
            <div
                class="border-primary-500 bg-primary-500/10 m-6 flex size-full items-center justify-center rounded-lg border-2 border-dashed backdrop-blur-sm"
            >
                <span class="text-primary-300 text-lg font-medium">drop files here</span>
            </div>
        </div>
    </div>
</template>

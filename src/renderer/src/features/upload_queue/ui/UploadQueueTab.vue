<script setup lang="ts">
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { useUploadQueueStore } from '../ts/useUploadQueueStore'
import ScrapePanel from './ScrapePanel.vue'
import UploadPanel from './UploadPanel.vue'
import { handleDrop } from '../ts/DropHandler'
import TagProcessingPanel from './TagProcessingPanel.vue'
import TagsProcessingPanel from './TagsProcessingPanel.vue'

const isDragging = ref(false)
let dragCounter = 0

const store = useUploadQueueStore()

const activeTab = ref('0')

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

const ytdlpText = ref('')
const downloads = reactive<Record<string, number>>({})
let offProgress: (() => void) | null = null

function startDownload() {
    const sessionId = crypto.randomUUID()
    downloads[sessionId] = 0
    void window.api.scrape
        .downloadFile(ytdlpText.value, sessionId)
        .then((result) => {
            console.log(result)
        })
        .catch((err) => {
            console.error(err)
        })
        .finally(() => {
            delete downloads[sessionId]
        })
}

onMounted(() => {
    offProgress = window.api.scrape.onDownloadProgress(({ sessionId, percentage }) => {
        if (sessionId in downloads) {
            console.log(percentage)
            downloads[sessionId] = percentage
        }
    })
})

onUnmounted(() => {
    offProgress?.()
    offProgress = null
})
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
                <Tab value="3">yt dlp</Tab>
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
                <TabPanel
                    value="3"
                    class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4 focus-within:outline-0"
                >
                    <div class="flex gap-2">
                        <InputText v-model="ytdlpText" class="flex-1" />
                        <Button @click="startDownload">Download</Button>
                    </div>
                    <div
                        v-for="(percentage, sessionId) in downloads"
                        :key="sessionId"
                        class="flex flex-col gap-1"
                    >
                        <div class="text-surface-400 flex justify-between text-xs">
                            <span class="font-mono">{{ sessionId.slice(0, 8) }}</span>
                            <span>{{ percentage.toFixed(1) }}%</span>
                        </div>
                        <ProgressBar :value="percentage" />
                    </div>
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

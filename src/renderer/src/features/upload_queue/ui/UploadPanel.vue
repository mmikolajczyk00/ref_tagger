<script setup lang="ts">
import { useUploadQueueStore } from '../ts/useUploadQueueStore'
import { QueuedFile, UPLOAD_STATUS, isLocked } from '../ts/UploadQueue'
import MediaFileGrid from './MediaFileGrid.vue'
import UploadQueueDetailsPanel from './UploadQueueDetailsPanel.vue'
import { uploadQueueProcessor } from '../ts/uploadQueueProcessor'

import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'

const store = useUploadQueueStore()

function onItemClick(event: MouseEvent, item: QueuedFile, index: number) {
    store.uploadSelection.handleItemClick(event, item, index)
}

function onClearSelection() {
    store.uploadSelection.clearSelection()
}

function onRemove(id: string) {
    store.remove('upload', id)
}

function uploadSelected() {
    const idleIds = new Set(store.uploadSelection.selectedIds)
    const selected = store.uploadFiles.filter(
        (f) => idleIds.has(f.id) && f.uploadStatus === UPLOAD_STATUS.IDLE
    )
    uploadQueueProcessor.enqueue(selected)
}

function uploadAll() {
    const idle = store.uploadFiles.filter((f) => f.uploadStatus === UPLOAD_STATUS.IDLE)
    uploadQueueProcessor.enqueue(idle)
}

function retryFailed() {
    const failed = store.uploadFiles.filter((f) => f.uploadStatus === UPLOAD_STATUS.ERROR)
    if (!failed.length) return
    failed.forEach((f) => store.setUploadStatus(f.id, UPLOAD_STATUS.IDLE))
    uploadQueueProcessor.enqueue(failed)
}
</script>

<template>
    <div class="flex size-full flex-col gap-3" :style="{ '--thumb-size': '200px' }">
        <Splitter class="min-h-0 flex-1">
            <SplitterPanel class="focus-visible:outline-0">
                <div class="size-full overflow-hidden">
                    <MediaFileGrid
                        :files="store.uploadFiles"
                        :is-selected="store.uploadSelection.isSelected"
                        :is-locked="isLocked"
                        :get-item-id="(f: QueuedFile) => f.id"
                        @item-click="onItemClick"
                        @clear-selection="onClearSelection"
                        @remove="onRemove"
                        @preview="(f) => store.openPreview(store.uploadFiles, f)"
                    />
                </div>
            </SplitterPanel>
            <SplitterPanel :min-size="5" :size="20">
                <UploadQueueDetailsPanel :selected-files="store.selectedUploadTabItems" />
            </SplitterPanel>
        </Splitter>

        <div class="flex shrink-0 items-center gap-3">
            <button
                class="bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 rounded px-3 py-1.5 text-sm transition-colors"
                @click="uploadSelected"
            >
                upload selected
            </button>
            <button
                class="bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 rounded px-3 py-1.5 text-sm transition-colors"
                @click="uploadAll"
            >
                upload all
            </button>
            <button
                class="bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 rounded px-3 py-1.5 text-sm transition-colors"
                @click="retryFailed"
            >
                retry failed
            </button>
            <button
                class="bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 rounded px-3 py-1.5 text-sm transition-colors"
                @click="store.skipAll('upload')"
            >
                skip all
            </button>
        </div>
    </div>
</template>

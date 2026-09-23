<script setup lang="ts">
import { useUploadQueueStore } from '../ts/useUploadQueueStore'
import { QueuedFile } from '../ts/UploadQueue'
import MediaFileGrid from './MediaFileGrid.vue'
import UploadQueueDetailsPanel from './UploadQueueDetailsPanel.vue'

import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import { ref } from 'vue'

const store = useUploadQueueStore()

function onItemClick(event: MouseEvent, item: QueuedFile, index: number) {
    store.scrapeSelection.handleItemClick(event, item, index)
}

function onClearSelection() {
    store.scrapeSelection.clearSelection()
}

function onRemove(id: string) {
    store.remove('scrape', id)
}

const downloadUrl = ref('')

function onDownloadWithUrl() {
    console.log(downloadUrl.value)
    store.downloadWithUrl(downloadUrl.value)
    downloadUrl.value = ''
}
</script>

<template>
    <div class="flex size-full flex-col gap-3" :style="{ '--thumb-size': '200px' }">
        <Splitter class="min-h-0 flex-1">
            <SplitterPanel class="focus-visible:outline-0">
                <div
                    class="relative size-full overflow-hidden"
                    :class="{ 'opacity-40': store.disableScraping }"
                >
                    <div
                        class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
                        :class="store.disableScraping ? 'opacity-100' : 'opacity-0'"
                    >
                        <span class="text-surface-400 text-lg font-medium">scraping disabled</span>
                    </div>
                    <MediaFileGrid
                        :files="store.scrapeFiles"
                        :is-selected="store.scrapeSelection.isSelected"
                        :is-locked="() => false"
                        :get-item-id="(f: QueuedFile) => f.id"
                        @item-click="onItemClick"
                        @clear-selection="onClearSelection"
                        @remove="onRemove"
                        @preview="(f) => store.openPreview(store.scrapeFiles, f)"
                    />
                    <div class="absolute right-2 bottom-2">
                        <InputText
                            v-model="downloadUrl"
                            placeholder="Paste url here"
                            @change="onDownloadWithUrl"
                        />
                    </div>
                </div>
            </SplitterPanel>
            <SplitterPanel :min-size="5" :size="20">
                <UploadQueueDetailsPanel :selected-files="store.selectedScrapeTabItems" />
            </SplitterPanel>
        </Splitter>

        <div class="flex shrink-0 items-center gap-3">
            <button
                class="bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 rounded px-3 py-1.5 text-sm transition-colors"
                @click="store.skipAll('scrape')"
            >
                skip all
            </button>
            <button
                class="bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 rounded px-3 py-1.5 text-sm transition-colors"
                @click="store.skipFailed('scrape')"
            >
                skip failed
            </button>
            <div class="flex items-center gap-2">
                <ToggleSwitch v-model="store.disableScraping" />
                <span class="text-sm">disable scraping</span>
            </div>
            <div class="flex items-center gap-2">
                <ToggleSwitch v-model="store.autoSkipFailed" />
                <span class="text-sm">auto-skip failed</span>
            </div>
        </div>
    </div>
</template>

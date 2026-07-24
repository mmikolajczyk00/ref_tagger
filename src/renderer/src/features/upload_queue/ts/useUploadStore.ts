// stores/useUploadStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { QueuedFile } from '../../upload_queue/ts/UploadQueue'

export const useUploadStore = defineStore('upload', () => {
    // State
    const queue = ref<QueuedFile[]>([])
    const isProcessing = ref(false)

    // Getters
    const hasItems = computed(() => queue.value.length > 0)
    const pendingCount = computed(() => queue.value.filter((i) => i.status === 'idle').length)

    // Actions
    function addToQueue(files: QueuedFile[]) {
        queue.value.push(...files)
    }

    function clearFinished() {
        queue.value = queue.value.filter((item) => item.status !== 'success')
    }

    async function processQueue() {
        if (isProcessing.value) return
        isProcessing.value = true

        for (const item of queue.value) {
            if (item.status === 'success') continue
            item.status = 'uploading'

            try {
                await window.api.insertMediaFile({
                    filePath: item.path,
                    fileName: item.name,
                    mediaType: item.type
                })
                item.status = 'success'
            } catch (error: any) {
                item.status = 'error'
                item.errorMessage = error.message || 'SQLite Error'
            }
        }

        isProcessing.value = false
    }

    return { queue, isProcessing, hasItems, pendingCount, addToQueue, clearFinished, processQueue }
})

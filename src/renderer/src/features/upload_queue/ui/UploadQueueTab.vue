<script setup lang="ts">
import { ref } from 'vue'
import { useUploadStore } from '../ts/useUploadStore'

const isDragging = ref(false)
const isProcessing = ref(false)

const uploadStore = useUploadStore()

async function handleDrop(event: DragEvent) {
    isDragging.value = false
    const files = event.dataTransfer?.files
    if (!files) return

    for (let i = 0; i < files.length; i++) {
        const file = files[i]

        const absolutePath = await window.api.files.getFilePath(file)
        if (!absolutePath) continue

        let mediaType = 'unknown'
        if (file.type.startsWith('image/')) mediaType = 'image'
        if (file.type.startsWith('audio/')) mediaType = 'audio'
        if (file.type.startsWith('video/')) mediaType = 'video'

        if (mediaType === 'unknown') continue // Skip unsupported files

        uploadStore.addToQueue([
            {
                id: crypto.randomUUID(),
                name: file.name,
                path: absolutePath,
                type: mediaType,
                size: file.size,
                status: 'idle'
            }
        ])
    }
}
</script>

<template>
    <div class="flex h-full flex-col p-6">
        <div
            class="rounded-lg border-2 border-dashed p-12 text-center transition-colors"
            :class="
                isDragging
                    ? 'border-primary-500 bg-primary-500/10'
                    : 'border-surface-300 dark:border-surface-700 bg-surface-100 dark:bg-surface-900'
            "
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
        >
            <p class="text-surface-400">Drag and drop audio, video, or image files here</p>
        </div>

        <div class="mt-4 flex gap-4">
            <button
                :disabled="isProcessing || uploadStore.queue.length === 0"
                class="bg-primary-600 rounded px-4 py-2 disabled:opacity-50"
                @click="uploadStore.processQueue"
            >
                {{ isProcessing ? 'Processing...' : 'Upload All' }}
            </button>
            <button
                class="bg-surface-200 dark:bg-surface-700 rounded px-4 py-2"
                @click="uploadStore.clearFinished"
            >
                Clear Finished
            </button>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
            <div
                v-for="item in uploadStore.queue"
                :key="item.id"
                class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-800 flex flex-col gap-2 rounded border p-4"
            >
                <div class="truncate font-medium">{{ item.name }}</div>

                <div class="flex items-center justify-between text-sm">
                    <span class="text-surface-400 text-xs uppercase">{{ item.type }}</span>

                    <span v-if="item.status === 'idle'" class="text-surface-400">Waiting</span>
                    <span
                        v-else-if="item.status === 'uploading'"
                        class="text-primary-400 animate-pulse"
                        >Saving...</span
                    >
                    <span v-else-if="item.status === 'success'" class="text-success-400">Done</span>
                    <span
                        v-else-if="item.status === 'error'"
                        class="text-danger-400 ml-2 truncate"
                        :title="item.errorMessage"
                    >
                        Error: {{ item.errorMessage }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

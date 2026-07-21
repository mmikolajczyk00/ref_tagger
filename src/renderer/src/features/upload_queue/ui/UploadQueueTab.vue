<script setup lang="ts">
import { ref } from 'vue'
import { QueuedFile } from '../ts/UploadQueue'
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
        console.log('event', event)

        const absolutePath = await window.api.getFilePath(file)
        if (!absolutePath) continue

        let mediaType = 'unknown'
        if (file.type.startsWith('image/')) mediaType = 'image'
        if (file.type.startsWith('audio/')) mediaType = 'audio'
        if (file.type.startsWith('video/')) mediaType = 'video'

        if (mediaType === 'unknown') continue // Skip unsupported files

        console.log(file)

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
                isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-700 bg-zinc-900'
            "
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
        >
            <p class="text-zinc-400">Drag and drop audio, video, or image files here</p>
        </div>

        <div class="mt-4 flex gap-4">
            <button
                @click="uploadStore.processQueue"
                :disabled="isProcessing || uploadStore.queue.length === 0"
                class="rounded bg-indigo-600 px-4 py-2 disabled:opacity-50"
            >
                {{ isProcessing ? 'Processing...' : 'Upload All' }}
            </button>
            <button @click="uploadStore.clearFinished" class="rounded bg-zinc-700 px-4 py-2">
                Clear Finished
            </button>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-4 overflow-y-auto md:grid-cols-2 lg:grid-cols-3">
            <div
                v-for="item in uploadStore.queue"
                :key="item.id"
                class="flex flex-col gap-2 rounded border border-zinc-700 bg-zinc-800 p-4"
            >
                <div class="truncate font-medium">{{ item.name }}</div>

                <div class="flex items-center justify-between text-sm">
                    <span class="text-xs text-zinc-400 uppercase">{{ item.type }}</span>

                    <span v-if="item.status === 'idle'" class="text-zinc-400">Waiting</span>
                    <span
                        v-else-if="item.status === 'uploading'"
                        class="animate-pulse text-indigo-400"
                        >Saving...</span
                    >
                    <span v-else-if="item.status === 'success'" class="text-emerald-400">Done</span>
                    <span
                        v-else-if="item.status === 'error'"
                        class="ml-2 truncate text-red-400"
                        :title="item.errorMessage"
                    >
                        Error: {{ item.errorMessage }}
                    </span>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { QueuedFile } from '../ts/UploadQueue'

defineProps<{
    files: QueuedFile[]
    isSelected: (id: string) => boolean
    isLocked: (f: QueuedFile) => boolean
    getItemId: (item: QueuedFile) => string
}>()

const emit = defineEmits<{
    (e: 'itemClick', event: MouseEvent, item: QueuedFile, index: number): void
    (e: 'clearSelection'): void
    (e: 'remove', id: string): void
}>()

function onClick(event: MouseEvent, item: QueuedFile, index: number) {
    console.log(item.dropData)
    emit('itemClick', event, item, index)
}

function onGridClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
        emit('clearSelection')
    }
}
</script>

<template>
    <div
        class="flex size-full flex-row flex-wrap content-start items-start justify-start gap-1 overflow-clip overflow-y-auto"
        @click.left="onGridClick"
    >
        <div
            v-for="(f, index) in files"
            :key="getItemId(f)"
            v-tooltip.bottom="f.errorMessage"
            class="media-file border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 hover:border-surface-400 dark:hover:border-surface-600 group relative flex aspect-square flex-col overflow-hidden border transition-colors select-none"
            @click.left.stop="onClick($event, f, index)"
        >
            <div
                v-show="isSelected(getItemId(f))"
                class="bg-primary/30 absolute z-10 size-full"
            ></div>

            <span
                v-show="!isLocked(f)"
                class="material-symbols-outlined text-surface-500 bg-surface-0/80 dark:bg-surface-900/80 absolute top-1 right-1 z-10 cursor-pointer rounded p-0.5 text-sm opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500 hover:text-white dark:hover:bg-red-600"
                @click.left.stop.prevent="emit('remove', getItemId(f))"
                >delete</span
            >
            <template v-if="f.errorMessage">
                <div class="bg-danger-500/30 absolute size-full"></div>
                <Badge class="absolute top-2 right-2" value="error" severity="danger"></Badge
            ></template>
            <img
                :src="`${f.dropData.sourceType === 'local' ? 'media://load?path=' : ''}${f.dropData.thumb}`"
                :alt="f.dropData.name || 'Image'"
                class="bg-surface-200 dark:bg-surface-950 pointer-events-none w-full flex-1 object-cover"
            />

            <span
                v-if="f.dropData.mediaType === 'video'"
                class="material-symbols-outlined text-surface-0 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 scale-200 drop-shadow-lg"
                >play_circle</span
            >

            <div
                v-if="f.downloadStatus === 'downloading'"
                class="bg-surface-0/60 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm"
            >
                <i class="pi pi-spin pi-spinner text-primary-400 text-3xl"></i>
            </div>

            <div
                v-if="isLocked(f)"
                class="bg-surface-0/60 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-sm"
            >
                <i class="pi pi-spin pi-spinner text-primary-400 text-3xl"></i>
            </div>

            <div
                class="bg-surface-0/50 dark:bg-surface-900/50 absolute bottom-0 z-20 flex w-full flex-col gap-0.5 p-2 text-xs backdrop-blur-sm"
            >
                <span
                    class="text-surface-700 dark:text-surface-300 group-hover:text-surface-950 dark:group-hover:text-surface-0 truncate font-medium transition-colors"
                >
                    {{ f.dropData.name }}
                </span>
                <span class="text-surface-400 dark:text-surface-500 truncate text-[10px]">
                    {{ f.dropData.mediaType || 'undefined' }}
                </span>
            </div>
            <ProgressBar
                v-if="f.percentage && f.downloadStatus === 'downloading'"
                class="absolute bottom-0 z-30 w-full"
                :value="f.percentage"
                :pt="{ value: { style: { transition: 'none' } } }"
            ></ProgressBar>
        </div>
    </div>
</template>

<style scoped>
.media-file {
    width: var(--thumb-size, 200px);
    height: var(--thumb-size, 200px);
    content-visibility: auto;
    contain-intrinsic-size: var(--thumb-size, 200px);
}
</style>

<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { MediaFile } from '@shared/types/models'
import { Explorer } from '../ts/createExplorer'

const props = defineProps<{
    files: MediaFile[]
    explorer: Explorer
}>()

const mediaSentinel = ref<HTMLElement | null>(null)
useIntersectionObserver(mediaSentinel, ([{ isIntersecting }]) => {
    if (isIntersecting) props.explorer.fetchNextPage()
})
</script>

<template>
    <div
        class="flex size-full flex-row flex-wrap content-start items-start justify-start gap-1 overflow-clip overflow-y-auto"
    >
        <div
            v-for="(f, index) in files"
            :key="f.id"
            class="media-file border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 hover:border-surface-400 dark:hover:border-surface-600 group relative flex aspect-square flex-col overflow-hidden border transition-colors select-none"
            @click.left.stop="props.explorer.handleItemClick($event, f, index)"
        >
            <div
                v-show="props.explorer.isSelected(f.id)"
                class="bg-primary/30 absolute size-full"
            ></div>
            <img
                :src="`media://load?path=${f.filePath}`"
                :alt="f.fileName"
                class="loading-lazy bg-surface-200 dark:bg-surface-950 pointer-events-none w-full flex-1 object-cover"
            />

            <div
                class="bg-surface-0/50 dark:bg-surface-900/50 absolute bottom-0 flex w-full flex-col gap-0.5 p-2 text-xs backdrop-blur-sm"
            >
                <span
                    class="text-surface-700 dark:text-surface-300 group-hover:text-surface-950 dark:group-hover:text-surface-0 truncate font-medium transition-colors"
                >
                    {{ f.fileName }}
                </span>
                <span class="text-surface-400 dark:text-surface-500 truncate text-[10px]">
                    #{{ f.id }}
                </span>
            </div>
        </div>
        <div ref="mediaSentinel" class="h-1 w-full shrink-0"></div>
    </div>
</template>

<style scoped>
.media-file {
    width: var(--thumb-size);
    height: var(--thumb-size);
    content-visibility: auto;
    contain-intrinsic-size: var(--thumb-size);
}
</style>

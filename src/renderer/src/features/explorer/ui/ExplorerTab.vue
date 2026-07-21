<script setup lang="ts">
import { inject, onMounted, ref, useTemplateRef } from 'vue'
import { clamp } from '@vueuse/core'
import { CommandService } from '../../../core/command_system/CommandService'
import { EXPLORER_COMMANDS } from '../commands/ExplorerCmd.js'
import { useExplorer } from '../ts/useExplorer'
import { useSelectionManager } from '@renderer/core/composables/useSelectionManager'

import Splitter from 'primevue/splitter'
import SplitterPanel from 'primevue/splitterpanel'
import TagEditorPanel from './TagEditorPanel.vue'

const props = defineProps(['active'])
const commandService = inject('commandService') as CommandService

const { mediaFiles, isLoading, fetchNextPage, resetAndRefresh, initialize } = useExplorer()

const { selectedIds, selectedItems, handleItemClick, clearSelection, isSelected } =
    useSelectionManager(() => {
        return mediaFiles.value
    })

// const explorerMng = new ExplorerManager(commandService)

// watchEffect((onCleanup) => {
//     if (props.active) {
//         explorerMng.registerFeature()
//         onCleanup(() => {
//             explorerMng.unregisterFeature()
//         })
//     }
// })

// REFS

const contextMenu = useTemplateRef('cmenu')

// CONTEXT MENU
const contextMenuData = ref([
    {
        label: 'Canvas',
        icon: 'gallery_thumbnail',
        items: [
            {
                label: 'Add to new canvas',
                command: () => {
                    commandService.execute(EXPLORER_COMMANDS.ADD_TO_NEW_CANVAS)
                }
            },
            {
                label: 'Add to existing canvas',
                command: () => {
                    console.log('2')
                }
            }
        ]
    },
    {
        label: 'Delete',
        icon: 'delete',
        command: () => {
            console.log('delete')
        }
    }
])

// ZOOM THUMBNAIL SIZE
const thumbnailScale = ref(300 as number)
const thumbnailScale_min = 100
const thumbnailScale_max = 600

function handleWheel(e: WheelEvent) {
    if (e.ctrlKey) {
        thumbnailScale.value -= e.deltaY / 2
        thumbnailScale.value = clamp(thumbnailScale.value, thumbnailScale_min, thumbnailScale_max)
    }
}

onMounted(() => {
    initialize()
})
</script>

<template>
    <Splitter class="size-full overflow-hidden">
        <SplitterPanel
            class="flex size-full flex-col bg-zinc-950 p-6 text-white focus-visible:outline-0"
        >
            <header class="mb-6 flex shrink-0 items-center justify-between">
                <div>
                    <h1 class="text-xl font-bold">Explorer</h1>
                </div>
                <button
                    @click="resetAndRefresh"
                    class="rounded bg-zinc-800 px-3 py-1.5 text-sm transition-colors hover:bg-zinc-700"
                >
                    Refresh Library
                </button>
            </header>

            <div
                @wheel="handleWheel"
                @click="clearSelection"
                class="flex size-full flex-row flex-wrap content-start items-start justify-start gap-1 overflow-clip overflow-y-auto bg-zinc-900"
                :style="{ '--thumb-size': `${thumbnailScale}px` }"
            >
                <div
                    v-for="(f, index) in mediaFiles"
                    :key="f.id"
                    class="media-file group relative flex aspect-square flex-col overflow-hidden border border-zinc-800 bg-zinc-900 transition-colors select-none hover:border-zinc-600"
                    @click.left.stop="handleItemClick($event, f, index)"
                >
                    <div v-show="isSelected(f.id)" class="bg-primary/30 absolute size-full"></div>
                    <img
                        :src="`media://load?path=${f.filePath}`"
                        :alt="f.fileName"
                        class="loading-lazy pointer-events-none w-full flex-1 bg-zinc-950 object-cover"
                    />

                    <div
                        class="absolute bottom-0 flex w-full flex-col gap-0.5 border-t border-zinc-800/80 bg-zinc-900/90 p-2 text-xs backdrop-blur-sm"
                    >
                        <span
                            class="truncate font-medium text-zinc-300 transition-colors group-hover:text-white"
                        >
                            {{ f.fileName }}
                        </span>
                        <span class="truncate text-[10px] text-zinc-500">
                            #{{ f.id }} — {{ f.filePath }}
                        </span>
                    </div>
                </div>
            </div>
        </SplitterPanel>
        <SplitterPanel :minSize="5" :size="15">
            <TagEditorPanel :selectedFiles="selectedItems"></TagEditorPanel>
        </SplitterPanel>
    </Splitter>
</template>

<style scoped>
.media-file {
    width: var(--thumb-size);
    height: var(--thumb-size);
    content-visibility: auto;
    contain-intrinsic-size: var(--thumb-size);
}
</style>

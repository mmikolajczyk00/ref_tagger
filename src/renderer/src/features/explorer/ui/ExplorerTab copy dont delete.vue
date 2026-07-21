<script setup lang="ts">
import { UUID } from 'crypto'
import { computed, inject, onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import { useEventListener, clamp } from '@vueuse/core'
import GalleriaIT from './GalleriaIT.vue'
import SearchBar from '../../../core/ui/SearchBar.vue'
import Gallery_Card from '../../../core/ui/Gallery_Card.vue'
import Gallery_SelectionDetailsPanel from '../../../core/ui/Gallery_SelectionDetailsPanel.vue'
import { ExplorerManager } from '../ts/ExplorerManager.js'
import { CommandService } from '../../../core/command_system/CommandService'
import { EXPLORER_COMMANDS } from '../commands/ExplorerCmd.js'

const props = defineProps(['active'])
const commandService = inject('commandService') as CommandService
const explorerMng = new ExplorerManager(commandService)

watchEffect(() => {
    if (props.active) explorerMng.registerFeature()
    else explorerMng.unregisterFeature()
})

defineExpose({
    forceLoadImgs: () => {
        console.log('force')
        requestAnimationFrame(() => galleryGrid.value?.scrollBy({ top: 1 }))
    }
})

// REFS

const contextMenu = useTemplateRef('cmenu')
const galleryGrid = useTemplateRef('galleryGrid')

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

useEventListener(galleryGrid, 'wheel', (e: WheelEvent) => {
    if (e.ctrlKey) {
        thumbnailScale.value -= e.deltaY / 2
        thumbnailScale.value = clamp(thumbnailScale.value, thumbnailScale_min, thumbnailScale_max)
    }
})

// FETCHING DATA

function deleteSelected() {
    commandService.execute(EXPLORER_COMMANDS.DELETE_SELECTED)
}
function viewSelectedInGalleria() {
    commandService.execute(EXPLORER_COMMANDS.VIEW_IN_GALLERIA)
}

onMounted(() => {
    // props.tab!.feature = explorerMng
    // props.tab!.setFeature(explorerMng)
    explorerMng.fetchData()
})

function search() {
    explorerMng.search()
}

function fetchData() {
    explorerMng.fetchData()
}

function clearSelection() {
    explorerMng.selectionHandler.clearSelection()
}

function handleCardClick(e: MouseEvent, index: number) {
    explorerMng.selectionHandler.cardClickHandler(e, index)
}

function viewInGalleria(arr: UUID[]) {
    explorerMng.viewInGalleria(arr)
}

const selectedFiles = computed(() => {
    return explorerMng.selectedFiles.value.map((f: any) => f.file)
})
</script>

<template>
    <GalleriaIT
        v-model:open="explorerMng.galleriaOpen.value"
        class="bg-surface-950/90 absolute z-50 size-full"
        :files="explorerMng.galleriaFiles.value"
    ></GalleriaIT>
    <ContextMenu ref="cmenu" :model="contextMenuData">
        <template #item="{ item, props }">
            <a v-bind="props.action" class="flex items-center gap-2">
                <span class="material-symbols-outlined">{{ item.icon }}</span>
                <span>{{ item.label }}</span>
            </a>
        </template>
    </ContextMenu>
    <div
        @click.right="(e) => contextMenu?.show(e)"
        class="bg-surface-950 grid size-full grid-cols-[1fr_auto] grid-rows-[auto_1fr_auto]"
    >
        <!-- Search Bar -->

        <div class="flex h-16 w-full flex-row gap-2 p-2">
            <SearchBar
                v-model:input-tags="explorerMng.searchTagsInput.value"
                class="z-10 h-full w-full"
                direction="down"
                icon-style="m-4 mr-2 text-md"
                @value-change="search"
            ></SearchBar>
            <Button class="aspect-square" rounded @click="fetchData"
                ><i
                    :class="[
                        explorerMng.fetchingStatus ? 'pi-spin pi-spinner' : 'pi-refresh',
                        'pi'
                    ]"
                ></i
            ></Button>
            {{ explorerMng.selectedFiles.value.length }}
        </div>

        <!-- Gallery Grid -->
        <div
            ref="galleryGrid"
            class="col-start-1 row-start-2 m-1 flex flex-row flex-wrap content-start items-start gap-0.5 overflow-y-auto outline-none"
            tabindex="-1"
            @click.self="clearSelection"
        >
            <Gallery_Card
                v-for="(galleryFile, index) in explorerMng.searchResult.value"
                :id="galleryFile.file.id"
                :key="galleryFile.file.id"
                :url="galleryFile.file.url"
                :mediaType="galleryFile.file.mediaType"
                :selected="galleryFile.selected"
                :style="{ width: thumbnailScale + 'px' }"
                @click="(e: MouseEvent) => handleCardClick(e, index)"
                @dblclick="viewInGalleria([galleryFile.file.id])"
                @expand="viewInGalleria([galleryFile.file.id])"
            ></Gallery_Card>
        </div>

        <!-- Right Panel -->
        <Gallery_SelectionDetailsPanel
            :selected-files="selectedFiles"
            class="bg-surface-700 row-span-3 w-[300px] overflow-auto"
            @add-tag-to-files="
                () => {
                    throw new Error('add tag to files not implemented')
                }
            "
            @remove-tag-from-files="
                (tag: string) => {
                    // tagStore.removeTagFromFiles(
                    //   [tag],
                    //   selectedFiles.map((f) => f.file.id)
                    // )
                    throw new Error('remove tag from files not implemented')
                }
            "
            @clear-tags-on-files=""
        ></Gallery_SelectionDetailsPanel>

        <!-- Bottom Bar -->
        <footer
            class="bg-surface-700 mx-1 flex h-16 items-center gap-4 overflow-visible px-3 py-2 text-sm"
        >
            <div class="text-surface-400 flex flex-1 flex-row flex-nowrap items-center">
                <i class="material-symbols-outlined cursor-pointer" @click="thumbnailScale = 300"
                    >replay</i
                >
                <Slider
                    v-model="thumbnailScale"
                    pt:root:class="bg-surface-950"
                    pt:range:class="bg-surface-500"
                    pt:handle:class="bg-surface-500 outline-hidden"
                    class="ml-4 w-full"
                    :min="thumbnailScale_min"
                    :max="thumbnailScale_max"
                />
            </div>

            <div class="flex flex-row gap-1">
                <Button
                    class="bg-surface-800 h-full w-fit text-nowrap active:bg-red-900"
                    label="Remove Selected"
                    severity="danger"
                    outlined
                    @click="deleteSelected"
                >
                    <span class="material-symbols-outlined">delete</span
                    ><span class="hidden xl:inline">delete selected</span></Button
                >
                <Button
                    class="bg-surface-800 active:bg-primary-900 h-full w-fit text-nowrap"
                    label="Upload Selected"
                    outlined
                    @click="viewSelectedInGalleria"
                    ><span class="material-symbols-outlined">art_track</span
                    ><span class="hidden xl:inline">open in galleria</span></Button
                >
            </div>
        </footer>
    </div>
</template>

<style lang="css" scoped></style>

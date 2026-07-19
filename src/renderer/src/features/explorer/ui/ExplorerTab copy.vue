<script setup lang="ts">
import { UUID } from 'crypto'
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { FileModel, GalleryFile } from '../../../../../shared/model/fileModel'
import { useFileStore } from '../../../core/stores/fileStore'
import { SelectionHandler } from '../../../core/utils/selectionHandler'
import { useTagStore } from '../../../core/stores/tagStore'
import { useEventListener, clamp } from '@vueuse/core'
import GalleriaIT from './GalleriaIT.vue'
import SearchBar from '../../../core/ui/SearchBar.vue'
import Gallery_Card from '../../../core/ui/Gallery_Card.vue'
import Gallery_SelectionDetailsPanel from '../../../core/ui/Gallery_SelectionDetailsPanel.vue'
const apiUrl = import.meta.env.VITE_API_URL

// STORES

const fileStore = useFileStore()
const tagStore = useTagStore()

// SEARCH

const searchTagsInput = ref([] as string[])
const searchResult = computed(() => {
  if (searchTagsInput.value.length > 0) {
    return fileStore.getSearchResultList.map((file: FileModel) => new GalleryFile(file))
  } else {
    return fileStore.getAllFilesList.map((file: FileModel) => new GalleryFile(file))
  }
})
function search(): void {
  fetchingStatus.value = true
  fileStore.search(searchTagsInput.value).finally(() => (fetchingStatus.value = false))
}

// REFS

const contextMenu = useTemplateRef('cmenu')
const galleryGrid = useTemplateRef('galleryGrid')
const selectedFiles = ref([] as GalleryFile[])
const selectionHandler = new SelectionHandler(searchResult, selectedFiles)
const galleriaFiles = ref([] as FileModel[])
const galleriaOpen = ref(false)

// ACTIONS

function deleteSelected() {
  if (selectedFiles.value.length <= 0) return
  fileStore.deleteFiles(selectedFiles.value.map((f) => f.file.id))
}

function deleteFile(id: UUID) {
  fileStore.deleteFiles([id])
}

function openInGalleria(files: GalleryFile[]): void {
  if (files.length <= 0) return

  galleriaFiles.value = files.map((f) => f.file)
  galleriaOpen.value = true
}

// CONTEXT MENU
const items = ref([
  {
    label: 'Canvas',
    icon: 'gallery_thumbnail',
    items: [
      {
        label: 'Add to new canvas',
        command: () => {
          console.log('1')
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
      deleteSelected()
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

// SELECTING

useEventListener(galleryGrid, 'keydown', (e) => {
  if (e.ctrlKey && e.key === 'a') {
    e.preventDefault()
    selectionHandler.selectAll()
  } else if (e.key === ' ') {
    e.preventDefault()
    openInGalleria(selectedFiles.value)
  }
})

// FETCHING DATA

defineExpose({
  forceLoadImgs: () => {
    console.log('force')
    requestAnimationFrame(() => galleryGrid.value?.scrollBy({ top: 1 }))
  }
})

const fetchingStatus = ref(false)

function fetchData(): void {
  fetchingStatus.value = true
  fileStore.fetchAllFiles(() => {
    fetchingStatus.value = false
  })

  search()
}

onMounted(() => {
  fetchData()
})
</script>

<template>
  <GalleriaIT
    v-model:open="galleriaOpen"
    class="bg-surface-950/90 absolute z-50 size-full"
    :files="galleriaFiles"
  ></GalleriaIT>
  <ContextMenu ref="cmenu" :model="items">
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
        v-model:input-tags="searchTagsInput"
        class="z-10 h-full w-full"
        direction="down"
        icon-style="m-4 mr-2 text-md"
        @value-change="search()"
      ></SearchBar>
      <Button class="aspect-square" rounded @click="fetchData"
        ><i :class="[fetchingStatus ? 'pi-spin pi-spinner' : 'pi-refresh', 'pi']"></i
      ></Button>
    </div>

    <!-- Gallery Grid -->
    <div
      ref="galleryGrid"
      class="col-start-1 row-start-2 m-1 flex flex-row flex-wrap content-start items-start gap-0.5 overflow-y-auto outline-none"
      tabindex="-1"
      @click.self="selectionHandler.clearSelection"
    >
      <Gallery_Card
        v-for="(galleryFile, index) in searchResult"
        :id="galleryFile.file.id"
        :key="galleryFile.file.id"
        :url="galleryFile.file.url"
        :mediaType="galleryFile.file.mediaType"
        :selected="galleryFile.selected"
        :style="{ width: thumbnailScale + 'px' }"
        @click="(e: MouseEvent) => selectionHandler.cardClickHandler(e, index)"
        @dblclick="openInGalleria([galleryFile])"
        @expand="openInGalleria([galleryFile])"
      ></Gallery_Card>
    </div>

    <!-- Right Panel -->
    <Gallery_SelectionDetailsPanel
      :selected-files="selectedFiles.map((f) => f.file)"
      class="bg-surface-700 row-span-3 w-[300px] overflow-auto"
      @add-tag-to-files="
        (tag: string) => {
          tagStore.addTagsToFiles(
            [tag],
            selectedFiles.map((f) => f.file.id)
          )
        }
      "
      @remove-tag-from-files="
        (tag: string) => {
          tagStore.removeTagFromFiles(
            [tag],
            selectedFiles.map((f) => f.file.id)
          )
        }
      "
      @clear-tags-on-files=""
    ></Gallery_SelectionDetailsPanel>

    <!-- Bottom Bar -->
    <footer
      class="bg-surface-700 mx-1 flex h-16 items-center gap-4 overflow-visible px-3 py-2 text-sm"
    >
      <div class="text-surface-400 flex flex-1 flex-row flex-nowrap items-center">
        <i class="material-symbols-outlined cursor-pointer" @click="thumbnailScale = 300">replay</i>
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
          @click="openInGalleria(selectedFiles)"
          ><span class="material-symbols-outlined">art_track</span
          ><span class="hidden xl:inline">open in galleria</span></Button
        >
      </div>
    </footer>
  </div>
</template>

<style lang="css" scoped></style>

<script setup lang="ts">
import { clamp, useEventListener } from '@vueuse/core'
import { computed, ref, useTemplateRef, watch } from 'vue'
import { FileModel } from '../../../../../shared/model/fileModel'
import { MediaType } from '../../../../../shared/shared'
import FileDisplay from '../../../core/ui/FileDisplay.vue'

const props = defineProps({
    files: { type: Array<FileModel>, required: true }
})

const activeFile_el = useTemplateRef('activeFile')
const root = useTemplateRef('root')
const thumbnails_el = useTemplateRef('thumbnails')
const activeFileId = ref(0)
const hoverFileId = ref<number>(-1)

const open = defineModel<boolean>('open', { required: false, default: true })

const zoom_min = 0.1
const zoom_max = 10

const panning = ref(false)
const img_x = ref(0)
const img_y = ref(0)

// when opening the galleria (probably with new files), clamp active/hoverFileId to not go out of array bounds
watch(open, async (newOpen) => {
    if (newOpen) {
        activeFileId.value = Math.min(activeFileId.value, props.files.push.length)
        hoverFileId.value = Math.min(hoverFileId.value, props.files.push.length)
    }
})

useEventListener(document, 'wheel', (e: WheelEvent) => {
    // let speed = Math.abs(e.deltaY / zoom.value)

    if (!open.value) return

    const thumbs = thumbnails_el.value as Node

    if (e.target == thumbs || thumbs.contains(e.target as Node)) return

    const mousePos = getMouseRelativePosToCenter(e)
    const zoomDelta = (e.deltaY / 500.0) * zoom.value
    zoom.value -= zoomDelta
    zoom.value = clamp(zoom.value, zoom_min, zoom_max)
    img_x.value -= mousePos.x * zoomDelta
    img_y.value -= mousePos.y * zoomDelta
})

useEventListener(root, 'mousedown', () => (panning.value = true))
useEventListener(document, 'mouseup', () => (panning.value = false))
useEventListener(root, 'mousemove', (e: MouseEvent) => {
    if (!panning.value) return
    img_x.value += e.movementX
    img_y.value += e.movementY
})

function offsetActiveId(offset: number): void {
    if (activeFileId.value + offset < 0) activeFileId.value = props.files.length - 1
    else {
        activeFileId.value = (activeFileId.value + offset) % props.files.length
    }
}
function close(): void {
    open.value = false
    activeFile_el.value?.stopVideo()
}

useEventListener(document, 'keydown', (e) => {
    if (!open.value) return

    console.log(e)

    if (e.key == 'd') offsetActiveId(1)
    else if (e.key == 'a') offsetActiveId(-1)
    else if (e.key == 'r') resetTransform()
    else if (e.key == 'f') activeFile_el.value?.toggleVideoFullscreen()
    else if (e.code == 'Space') activeFile_el.value?.toggleVideoPlayback()
    else if (e.key == 'l') activeFile_el.value?.toggleVideoLooping()
    else if (e.key == 'Escape' || e.key == 'q') close()
})

interface Vector2 {
    x: number
    y: number
}

// use it on the element
function getMouseRelativePosToCenter(e: MouseEvent): Vector2 {
    return {
        x: root.value!.offsetWidth / 2.0 - e.offsetX,
        y: root.value!.offsetHeight / 2.0 - e.offsetY
    }
}

function resetTransform(): void {
    zoom.value = 1
    img_x.value = 0
    img_y.value = 0
}
function resetPosition(): void {
    img_x.value = 0
    img_y.value = 0
}

const hoveredOrActive = computed((): FileModel => {
    return hoverFileId.value >= 0 ? props.files[hoverFileId.value] : props.files[activeFileId.value]
})

const zoom = ref(1)
</script>

<template>
    <div v-show="open">
        <div ref="root" class="size-full" :class="[panning ? 'cursor-grabbing' : '']">
            <div
                v-if="files.length > 0"
                :style="{ scale: zoom, top: img_y + 'px', left: img_x + 'px' }"
                class="absolute size-full select-none"
            >
                <FileDisplay
                    ref="activeFile"
                    class="size-full object-contain shadow-black"
                    :src="hoveredOrActive.url + '?original=true'"
                    :media-type="hoveredOrActive.mediaType"
                    :controls="true"
                    :autoplay="true"
                    :lazy="false"
                ></FileDisplay>
            </div>
        </div>
        <!-- left panel thumbnails -->
        <div
            :class="[panning ? 'hidden' : '']"
            class="group absolute top-0 left-0 z-10 flex h-full w-48 flex-row justify-end overflow-x-hidden overflow-y-auto opacity-0 hover:opacity-100"
            @mouseleave="hoverFileId = -1"
        >
            <div
                ref="thumbnails"
                class="bg-surface-950/50 flex h-full w-0 flex-col items-center justify-center gap-1 opacity-0 transition-all ease-out group-hover:flex group-hover:w-48 group-hover:opacity-100"
            >
                <div
                    v-for="(file, index) in files"
                    :key="file.id"
                    class="relative aspect-square size-32 transition-all hover:ml-5 active:scale-95"
                    @mouseenter="hoverFileId = index"
                    @click="activeFileId = hoverFileId!"
                >
                    <div
                        v-show="activeFileId == index"
                        class="bg-primary-500/25 absolute z-5 size-full border"
                    ></div>
                    <FileDisplay
                        :class="{ 'shadow-primary-500 shadow-2xl': activeFileId == index }"
                        :src="file.url"
                        :media-type="MediaType.IMAGE"
                        class="size-full object-cover"
                        :draggable="false"
                    ></FileDisplay>
                </div>
            </div>
        </div>
        <!-- right panel buttons -->
        <div
            :class="[panning ? 'hidden' : '']"
            class="group absolute top-0 right-0 z-10 flex h-full w-48 flex-row justify-end"
        >
            <div
                class="bg-surface-950/50 flex w-0 flex-col items-center justify-center gap-1 overflow-hidden opacity-0 transition-all ease-out group-hover:w-32 group-hover:opacity-100"
            >
                <div class="flex h-full flex-col items-center justify-center gap-0.5">
                    <Button
                        v-tooltip.left="'reset zoom'"
                        class="rounded-none rounded-t"
                        @click="zoom = 1"
                        ><span class="material-symbols-outlined">fullscreen</span></Button
                    >
                    <Button
                        v-tooltip.left="'reset transform (r)'"
                        class="rounded-none"
                        @click="resetTransform"
                        ><span class="material-symbols-outlined">reset_focus</span></Button
                    >
                    <Button
                        v-tooltip.left="'center position'"
                        class="rounded-none rounded-b"
                        @click="resetPosition"
                        ><span class="material-symbols-outlined">recenter</span></Button
                    >
                </div>
            </div>
        </div>

        <span
            class="material-symbols-outlined bg-surface-950/50 absolute top-0 right-0 z-15 m-5 cursor-pointer rounded-full text-5xl!"
            @click.stop="close()"
        >
            close
        </span>
    </div>
</template>

<style scoped></style>

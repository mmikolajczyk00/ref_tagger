<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { clamp, useEventListener } from '@vueuse/core'
import type { PreviewItem } from '@renderer/core/utils/mediaPreview'

const props = defineProps<{
    items: PreviewItem[]
    modelValue: number
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', index: number): void
    (e: 'close'): void
}>()

const current = computed(() => props.items[props.modelValue])

function close() {
    emit('close')
}

function go(delta: number) {
    const count = props.items.length
    if (count <= 1) return
    emit('update:modelValue', (props.modelValue + delta + count) % count)
}

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
        close()
    } else if (e.key === 'ArrowLeft') {
        go(-1)
    } else if (e.key === 'ArrowRight') {
        go(1)
    }
})

useEventListener(document, 'keydown', (e: KeyboardEvent) => {
    if (e.key === 'Alt' && !e.repeat) {
        controlsVisible.value = !controlsVisible.value
    }
})

const zoom = ref(1)
const rotation = ref(0)
const pan = reactive({ x: 0, y: 0 })
const stageEl = ref<HTMLElement | null>(null)
const controlsVisible = ref(true)

const mediaTransform = computed(
    () => `translate(${pan.x}px, ${pan.y}px) rotate(${rotation.value}rad) scale(${zoom.value})`
)

const dragging = ref(false)
const dragMode = ref<'pan' | 'rotate'>('pan')
const dragStart = {
    x: 0,
    y: 0,
    panX: 0,
    panY: 0,
    rotation: 0,
    centerX: 0,
    centerY: 0
}

function stageCenter() {
    const rect = stageEl.value?.getBoundingClientRect()
    return {
        x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
        y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2
    }
}

function startDrag(e: MouseEvent, mode: 'pan' | 'rotate') {
    dragging.value = true
    dragStart.x = e.clientX
    dragStart.y = e.clientY
    dragStart.panX = pan.x
    dragStart.panY = pan.y
    dragStart.rotation = rotation.value
    dragMode.value = mode

    const center = stageCenter()
    dragStart.centerX = center.x
    dragStart.centerY = center.y

    window.addEventListener('mousemove', onPointerMove)
    window.addEventListener('mouseup', onPointerUp)
}

function onBackdropPointerDown(e: MouseEvent) {
    startDrag(e, e.button === 2 ? 'rotate' : 'pan')
}

function onPointerMove(e: MouseEvent) {
    if (!dragging.value) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y

    if (dragMode.value === 'pan') {
        pan.x = dragStart.panX + dx
        pan.y = dragStart.panY + dy
    } else {
        const startAngle = Math.atan2(
            dragStart.y - dragStart.centerY,
            dragStart.x - dragStart.centerX
        )
        const currentAngle = Math.atan2(
            e.clientY - dragStart.centerY,
            e.clientX - dragStart.centerX
        )
        rotation.value = dragStart.rotation + (currentAngle - startAngle)
    }
}

function onPointerUp() {
    dragging.value = false
    window.removeEventListener('mousemove', onPointerMove)
    window.removeEventListener('mouseup', onPointerUp)
}

onUnmounted(() => {
    window.removeEventListener('mousemove', onPointerMove)
    window.removeEventListener('mouseup', onPointerUp)
})

function onWheel(e: WheelEvent) {
    e.preventDefault()
    const oldZoom = zoom.value
    const newZoom = clamp(oldZoom * Math.exp(-e.deltaY * 0.0015), 0.1, 20)
    const k = newZoom / oldZoom
    const center = stageCenter()
    const px = e.clientX - center.x
    const py = e.clientY - center.y
    pan.x += px * (1 - k)
    pan.y += py * (1 - k)
    zoom.value = newZoom
}

function resetZoom() {
    zoom.value = 1
}

function resetRotation() {
    rotation.value = 0
}

function resetPan() {
    pan.x = 0
    pan.y = 0
}

function resetAll() {
    resetZoom()
    resetRotation()
    resetPan()
}
</script>

<template>
    <Teleport to="body">
        <div
            class="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 p-8 select-none"
            @wheel.prevent="onWheel"
            @contextmenu.prevent
            @mousedown.prevent="onBackdropPointerDown"
        >
            <button
                v-show="controlsVisible"
                class="text-surface-0 absolute top-4 right-4 z-30 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-black/70"
                @click="close"
            >
                <span class="material-symbols-outlined">close</span>
            </button>

            <template v-if="items.length > 1">
                <button
                    v-show="controlsVisible"
                    class="text-surface-0 absolute top-1/2 left-4 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-black/70"
                    @click="go(-1)"
                >
                    <span class="material-symbols-outlined">chevron_left</span>
                </button>
                <button
                    v-show="controlsVisible"
                    class="text-surface-0 absolute top-1/2 right-4 z-10 flex size-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-black/70"
                    @click="go(1)"
                >
                    <span class="material-symbols-outlined">chevron_right</span>
                </button>
            </template>

            <img
                v-if="current?.mediaType === 'image'"
                ref="stageEl"
                :key="modelValue"
                :src="current.src"
                :alt="current.name"
                class="max-h-full max-w-full object-contain"
                :style="{ transform: mediaTransform }"
                :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
            />
            <video
                v-else-if="current?.mediaType === 'video'"
                ref="stageEl"
                :key="modelValue"
                :src="current.src"
                class="max-h-full max-w-full object-contain"
                :style="{ transform: mediaTransform }"
                :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
                controls
                autoplay
            ></video>

            <div
                v-show="controlsVisible"
                class="absolute bottom-4 left-1/2 flex max-w-[80vw] -translate-x-1/2 flex-col items-center gap-2"
            >
                <div
                    class="text-surface-0 flex items-center gap-2 rounded bg-black/40 px-3 py-1 text-sm"
                >
                    <span class="truncate">{{ current?.name }}</span>
                    <span v-if="items.length > 1" class="text-surface-300 shrink-0">
                        {{ modelValue + 1 }} / {{ items.length }}
                    </span>
                </div>
                <div class="flex flex-row gap-2">
                    <button
                        title="Reset zoom"
                        class="text-surface-0 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-black/70"
                        @click.stop="resetZoom"
                    >
                        <span class="material-symbols-outlined">zoom_out_map</span>
                    </button>
                    <button
                        title="Reset rotation"
                        class="text-surface-0 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-black/70"
                        @click.stop="resetRotation"
                    >
                        <span class="material-symbols-outlined">rotate_right</span>
                    </button>
                    <button
                        title="Reset pan"
                        class="text-surface-0 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-black/70"
                        @click.stop="resetPan"
                    >
                        <span class="material-symbols-outlined">open_with</span>
                    </button>
                    <button
                        title="Reset all"
                        class="text-surface-0 flex size-10 cursor-pointer items-center justify-center rounded-full bg-black/40 transition-colors hover:bg-black/70"
                        @click.stop="resetAll"
                    >
                        <span class="material-symbols-outlined">asterisk</span>
                    </button>
                </div>
            </div>
        </div>
    </Teleport>
</template>

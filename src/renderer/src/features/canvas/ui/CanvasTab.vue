<script setup lang="ts">
import CanvasScene from '../ts/scene/CanvasScene'
import { computed, onActivated, onDeactivated, onMounted, ref, useTemplateRef } from 'vue'
import { CanvasManager } from '../ts/scene/CanvasManager'
import CanvasElementWrapper from './CanvasElementWrapper.vue'
import { CanvasElement, ImageCanvasElement } from '../ts/scene/CanvasElements'
import ImageElement from './ImageElement.vue'
import TransformBoxOverlay from './TransformBoxOverlay.vue'
import { CARDINAL_DIRECTIONS, TransformBox } from '../ts/scene/TransformBox'
import { Vector2 } from '../ts/scene/canvas_utils'
import SelectionBoxOverlay from './SelectionBoxOverlay.vue'
import { MouseButton } from '@renderer/core/utils/general'
import { useCanvasStore } from '../ts/canvasStore'

const props = defineProps({
    canvasId: Number
})

const canvasStore = useCanvasStore()
const canvasScene = canvasStore.getCanvas(props.canvasId!)!

const canvasManager = ref<CanvasManager>(new CanvasManager(canvasScene as CanvasScene))

const canvasBg = useTemplateRef('canvas-bg')

const handleGlobalMouseMove = (event: MouseEvent) => {
    const container = canvasBg.value
    if (!container) return

    const rect = container.getBoundingClientRect()

    const localX = event.clientX - rect.left
    const localY = event.clientY - rect.top

    canvasScene.updateMousePos({ x: localX, y: localY })
}

onActivated(() => {
    const manager = canvasManager.value

    console.log('onActivated')

    window.addEventListener('mousemove', handleGlobalMouseMove)
    manager.registerFeature()
})

onDeactivated(() => {
    const manager = canvasManager.value

    manager.unregisterFeature()
    window.removeEventListener('mousemove', handleGlobalMouseMove)
})

function initMouseAction(
    start: (e?: MouseEvent) => void,
    update: (e: MouseEvent) => void,
    end: (e: MouseEvent) => void,
    e?: MouseEvent
) {
    const handleMouseMove = (e: MouseEvent) => {
        update(e)
    }

    const handleMouseUp = (e: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)

        end(e)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    start(e)
}

let isPotentialTogglableClick = false
let dragStartMousePos = new Vector2(0, 0)
const MOVE_THRESHOLD_SQ = 16

function handleElementMouseDown(el: CanvasElement, e: MouseEvent) {
    if (el.isSelected) {
        isPotentialTogglableClick = true
        handleMoveStart(el)
    } else {
        canvasScene.selectElement(el, e.shiftKey)
        isPotentialTogglableClick = false
        handleMoveStart(el)
    }
}

function handleMoveStart(el: CanvasElement) {
    initMouseAction(
        () => {
            canvasScene.transformBox.moveStart()
            dragStartMousePos.setV(canvasScene.mousePos)
        },
        () => {
            if (isPotentialTogglableClick) {
                const currentPos = canvasScene.mousePos

                const dist = currentPos.subtracted(dragStartMousePos).magnitudeSq()
                if (dist > MOVE_THRESHOLD_SQ) {
                    isPotentialTogglableClick = false
                }
            }
            canvasScene.transformBox.moveUpdate()
        },
        (e: MouseEvent) => {
            if (isPotentialTogglableClick) {
                canvasScene.selectElement(el, e.shiftKey)
            }

            canvasScene.transformBox.moveEnd()
        }
    )
}

function handleBgClick(e: MouseEvent) {
    if (e.button == MouseButton.LEFT) {
        initMouseAction(
            () => {
                if (!e.shiftKey) canvasScene.clearSelection()
                canvasScene.selectionBox.start()
            },
            (e: MouseEvent) => {
                canvasScene.selectionBox.update(e.shiftKey)
            },
            () => {
                canvasScene.selectionBox.end()
            }
        )
    } else if (e.button == MouseButton.MIDDLE || e.button == MouseButton.RIGHT) {
        initMouseAction(
            () => {
                canvasScene.panStart()
            },
            (e: MouseEvent) => {
                canvasScene.panUpdate({ x: e.movementX, y: e.movementY })
            },
            () => {
                canvasScene.panEnd()
            }
        )
    }
}

function handleWheel(e: WheelEvent) {
    const container = canvasBg.value
    if (!container) return

    // Get mouse position local to the canvas window element
    const rect = container.getBoundingClientRect()

    canvasScene.zoomUpdate(e.deltaY, { x: e.clientX - rect.left, y: e.clientY - rect.top })
}

function handleResizeStart(ev: { axis: CARDINAL_DIRECTIONS; e: MouseEvent }) {
    const { axis, e } = ev

    const handleMouseMove = (e: MouseEvent) => {
        canvasScene.transformBox.resizeUpdate(axis, e.altKey)
    }

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)

        canvasScene.transformBox.resizeEnd()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    canvasScene.transformBox.resizeStart(axis)
}
function handleRotateStart() {
    const handleMouseMove = (e: MouseEvent) => {
        canvasScene.transformBox.rotateUpdate(e.altKey)
    }

    const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)

        canvasScene.transformBox.rotateEnd()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    canvasScene.transformBox.rotateStart()
}

const canvasBgStyle = computed(() => {
    return {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        transform: `translate3d(${canvasScene.transform.position.x}px, ${canvasScene.transform.position.y}px,0) rotate(${canvasScene.transform.rotation}rad) scale(${canvasScene.zoom})`,
        transformOrigin: 'top left'
    }
})
</script>

<template>
    <div
        class="relative size-full"
        ref="canvas-bg"
        @mousedown="handleBgClick($event)"
        @wheel="handleWheel($event)"
    >
        <div class="absolute bottom-0 left-0 z-50">
            {{ canvasScene.mousePos }} || {{ canvasScene.zoom }}
        </div>
        <div :style="canvasBgStyle" ref="canvas-pivot">
            <CanvasElementWrapper
                :transform="img.transform as Transform"
                v-for="img in canvasScene.imageElements"
                :key="img.elementId"
                @mousedown.left.stop="handleElementMouseDown(img, $event)"
            >
                <ImageElement :canvas-image-data="img as ImageCanvasElement"></ImageElement>
            </CanvasElementWrapper>
            <TransformBoxOverlay
                @resize-start="handleResizeStart($event)"
                @rotate-start="handleRotateStart()"
                class="z-50"
                :transform-box="canvasScene.transformBox as TransformBox"
            ></TransformBoxOverlay>
            <SelectionBoxOverlay :selection-box="canvasScene.selectionBox"> </SelectionBoxOverlay>
        </div>
    </div>
</template>

<style scoped></style>

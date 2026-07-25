<script setup lang="ts">
import { computed, onActivated, onDeactivated, useTemplateRef } from 'vue'
import CanvasElementWrapper from './CanvasElementWrapper.vue'
import { CanvasElement, ImageCanvasElement } from '../ts/scene/CanvasElements'
import ImageElement from './ImageElement.vue'
import TransformBoxOverlay from './TransformBoxOverlay.vue'
import { CARDINAL_DIRECTIONS, TransformBox } from '../ts/scene/TransformBox'
import { Transform, Vector2 } from '../ts/scene/canvas_utils'
import SelectionBoxOverlay from './SelectionBoxOverlay.vue'
import { useCanvasStore } from '../ts/canvasStore'
import { MouseButton } from '../../../core/utils/general'

export interface CanvasTabProps {
    canvasId: number
}

const props = defineProps<CanvasTabProps>()

const canvasStore = useCanvasStore()
const canvasScene = canvasStore.getCanvas(props.canvasId!)!

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
    console.log('onActivated')

    window.addEventListener('mousemove', handleGlobalMouseMove)
})

onDeactivated(() => {
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
    const { axis } = ev

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
        ref="canvas-bg"
        class="relative size-full"
        @mousedown="handleBgClick($event)"
        @wheel="handleWheel($event)"
    >
        <div class="absolute bottom-0 left-0 z-50">
            {{ canvasScene.mousePos }} || {{ canvasScene.zoom }}
        </div>
        <div ref="canvas-pivot" :style="canvasBgStyle">
            <CanvasElementWrapper
                v-for="img in canvasScene.imageElements"
                :key="img.elementId"
                :transform="img.transform as Transform"
                @mousedown.left.stop="handleElementMouseDown(img, $event)"
            >
                <ImageElement :canvas-image-data="img as ImageCanvasElement"></ImageElement>
            </CanvasElementWrapper>
            <TransformBoxOverlay
                class="z-50"
                :zoom="canvasScene.zoom"
                :transform-box="canvasScene.transformBox as TransformBox"
                @resize-start="handleResizeStart($event)"
                @rotate-start="handleRotateStart()"
            ></TransformBoxOverlay>
            <SelectionBoxOverlay :zoom="canvasScene.zoom" :selection-box="canvasScene.selectionBox">
            </SelectionBoxOverlay>
        </div>
    </div>
</template>

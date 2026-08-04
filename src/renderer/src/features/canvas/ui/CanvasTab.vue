<script setup lang="ts">
import { computed, onActivated, onDeactivated, useTemplateRef } from 'vue'
import CanvasElementWrapper from './CanvasElementWrapper.vue'
import { CanvasElement } from '../ts/scene/CanvasElements'
import TransformBoxOverlay from './TransformBoxOverlay.vue'
import { CARDINAL_DIRECTIONS, TransformBox } from '../ts/scene/TransformBox'
import { Vector2 } from '../ts/scene/CanvasUtils'
import SelectionBoxOverlay from './SelectionBoxOverlay.vue'
import { useCanvasStore } from '../ts/canvasStore'
import { MouseButton } from '../../../core/utils/general'
import GroupElement from './GroupElement.vue'
import MediaFileElement from './MediaFileElement.vue'

export interface CanvasTabProps {
    canvasId: number
}

const props = defineProps<CanvasTabProps>()

const canvasStore = useCanvasStore()
const canvasScene = canvasStore.getCanvas(props.canvasId!)!
// const canvasMediaFileElements = computed(() =>
//     canvasScene.mediaFileElements.filter((f) => f.transform.parentTransform?.elementId === 'root')
// )
// const canvasGroupElements = computed(() =>
//     canvasScene.groupElements.filter((f) => f.transform.parentTransform?.elementId === 'root')
// )
//
const canvasMediaFileElements = computed(() => canvasScene.mediaFileElements)
const canvasGroupElements = computed(() => canvasScene.groupElements)

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

function handleDoubleClick(el: CanvasElement, e: MouseEvent) {
    let outerParent = el.transform.getOuterParent()
    if (outerParent) {
        el = canvasScene.elementsDict.get(outerParent.elementId)!
    }
    console.log('dbclick')
}

function handleElementMouseDown(el: CanvasElement, e: MouseEvent) {
    // find most outer parent and work on that
    let outerParent = el.transform.getOuterParent()
    if (outerParent) {
        console.log(outerParent)
        el = canvasScene.elementsDict.get(outerParent.elementId)!
    }

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
        <div ref="canvas-pivot" class="z-0" :style="canvasBgStyle">
            <div class="relative z-50">
                <TransformBoxOverlay
                    class="z-50"
                    :zoom="canvasScene.zoom"
                    :transform-box="canvasScene.transformBox as TransformBox"
                    @resize-start="handleResizeStart($event)"
                    @rotate-start="handleRotateStart()"
                ></TransformBoxOverlay>
                <SelectionBoxOverlay
                    :zoom="canvasScene.zoom"
                    :selection-box="canvasScene.selectionBox"
                >
                </SelectionBoxOverlay>
            </div>
            <div class="relative z-30">
                <CanvasElementWrapper
                    v-for="img in canvasMediaFileElements"
                    :key="img.elementId"
                    :transform="img.transform"
                    @mousedown.left.stop="handleElementMouseDown(img, $event)"
                    @dblclick.left.stop="handleDoubleClick(img, $event)"
                >
                    <MediaFileElement :canvas-image-data="img"></MediaFileElement>
                </CanvasElementWrapper>
            </div>
            <div class="relative z-0">
                <CanvasElementWrapper
                    v-for="group in canvasGroupElements"
                    :key="group.elementId"
                    :transform="group.transform"
                    @mousedown.left.stop="handleElementMouseDown(group, $event)"
                    @dblclick.left.stop="handleDoubleClick(group, $event)"
                >
                    <GroupElement :canvas-group-data="group"></GroupElement>
                </CanvasElementWrapper>
            </div>
        </div>
    </div>
</template>

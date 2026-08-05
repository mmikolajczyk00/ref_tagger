<script setup lang="ts">
import { computed, onActivated, onDeactivated, useTemplateRef } from 'vue'
import CanvasElementWrapper from './CanvasElementWrapper.vue'
import {
    CanvasElement,
    GroupCanvasElement,
    MediaFileCanvasElement,
    NoteCanvasElement
} from '../ts/scene/CanvasElements'
import TransformBoxOverlay from './TransformBoxOverlay.vue'
import { CARDINAL_DIRECTIONS, TransformBox } from '../ts/scene/TransformBox'
import { initMouseAction, Vector2 } from '../ts/scene/CanvasUtils'
import SelectionBoxOverlay from './SelectionBoxOverlay.vue'
import { useCanvasStore } from '../ts/canvasStore'
import { MouseButton } from '../../../core/utils/general'
import GroupElement from './GroupElement.vue'
import MediaFileElement from './MediaFileElement.vue'
import NoteElement from './NoteElement.vue'

export interface CanvasTabProps {
    canvasId: number
}

const props = defineProps<CanvasTabProps>()

const canvasStore = useCanvasStore()
const canvasScene = canvasStore.getCanvas(props.canvasId!)!
const canvasMediaFileElements = computed(() => canvasScene.mediaFileElements)
const canvasGroupElements = computed(() => canvasScene.groupElements)
const canvasNoteElements = computed(() => canvasScene.noteElements)

const sortedCanvasElements = computed(() => {
    const all = [
        ...canvasMediaFileElements.value,
        ...canvasGroupElements.value,
        ...canvasNoteElements.value
    ]
    all.sort((a, b) => (a.transform.zIndex ?? 0) - (b.transform.zIndex ?? 0))
    return all
})

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

let isPotentialTogglableClick = false
let dragStartMousePos = new Vector2(0, 0)
const MOVE_THRESHOLD_SQ = 16

function handleDoubleClick(el: CanvasElement, e: MouseEvent) {
    el = el.getOrGetSelectableAncestor()
    if (e.shiftKey) return

    if (el instanceof GroupCanvasElement) {
        el.expanded = !el.expanded
    } else if (el instanceof MediaFileCanvasElement) {
        console.log('to be implemented', el)
    }
    console.log('dbclick', el)
}

function handleElementMouseDown(el: CanvasElement, e: MouseEvent) {
    if (el instanceof NoteCanvasElement && el.editMode) return

    if (canvasScene.editedNote && canvasScene.editedNote.elementId !== el.elementId) {
        canvasScene.editedNote.exitEditMode()
    }

    el = el.getOrGetSelectableAncestor()

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
    if (canvasScene.editedNote) {
        canvasScene.editedNote.exitEditMode()
    }

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

    initMouseAction(
        () => {
            canvasScene.transformBox.resizeStart(axis)
        },
        (e: MouseEvent) => {
            canvasScene.transformBox.resizeUpdate(axis, e.altKey)
        },
        () => {
            canvasScene.transformBox.resizeEnd()
        }
    )
}
function handleRotateStart() {
    initMouseAction(
        () => {
            canvasScene.transformBox.rotateStart()
        },
        (e: MouseEvent) => {
            canvasScene.transformBox.rotateUpdate(e.altKey)
        },
        () => {
            canvasScene.transformBox.rotateEnd()
        }
    )
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
        class="relative size-full overflow-clip"
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
            <div class="relative">
                <CanvasElementWrapper
                    v-for="el in sortedCanvasElements"
                    :key="el.elementId"
                    :transform="el.transform"
                    :is-selected="el.isSelected"
                    @mousedown.left.stop="handleElementMouseDown(el, $event)"
                    @dblclick.left.stop="handleDoubleClick(el, $event)"
                >
                    <MediaFileElement
                        v-if="el instanceof MediaFileCanvasElement"
                        :canvas-image-data="el"
                    />
                    <GroupElement
                        v-else-if="el instanceof GroupCanvasElement"
                        :canvas-group-data="el"
                    />
                    <NoteElement
                        v-else-if="el instanceof NoteCanvasElement"
                        :canvas-note-data="el"
                    />
                </CanvasElementWrapper>
            </div>
        </div>
    </div>
</template>

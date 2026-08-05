<template>
    <div
        ref="noteHtmlElement"
        class="bg-surface-200 dark:bg-surface-800 relative z-0 flex size-full"
        @dblclick.stop="toggleEditMode"
    >
        <pre v-show="!noteData.editMode" class="m-2 overflow-auto">{{ noteData.noteText }}</pre>
        <textarea
            v-show="noteData.editMode"
            ref="textAreaRef"
            v-model="noteData.noteText"
            class="absolute size-full resize-none overflow-auto p-2 focus-within:outline-0"
            :style="textAreaStyle"
            @mousedown.stop
            @keydown.esc="exitEditMode"
            @keyup.enter="onEnter"
            @keydown="onKeyDown"
            @paste="onPaste"
        ></textarea>

        <div
            v-show="noteData.editMode"
            class="resize-btns-container absolute size-full"
            :style="resizeContainerStyle"
            @mousedown.stop
            @dblclick.stop
        >
            <div class="resize-corners">
                <div
                    class="note-resize-corner -top-2.5 -left-2.5 cursor-nw-resize"
                    :style="{ cursor: noteCursor('nw') }"
                    @mousedown.stop="handleResizeStart({ axis: 'nw', e: $event })"
                ></div>
                <div
                    class="note-resize-corner -top-2.5 -right-2.5 cursor-ne-resize"
                    :style="{ cursor: noteCursor('ne') }"
                    @mousedown.stop="handleResizeStart({ axis: 'ne', e: $event })"
                ></div>
                <div
                    class="note-resize-corner -right-2.5 -bottom-2.5 cursor-se-resize"
                    :style="{ cursor: noteCursor('se') }"
                    @mousedown.stop="handleResizeStart({ axis: 'se', e: $event })"
                ></div>
                <div
                    class="note-resize-corner -bottom-2.5 -left-2.5 cursor-sw-resize"
                    :style="{ cursor: noteCursor('sw') }"
                    @mousedown.stop="handleResizeStart({ axis: 'sw', e: $event })"
                ></div>
            </div>
            <div class="resize-edges">
                <div
                    class="note-resize-bar -top-2 flex h-2 w-full cursor-n-resize justify-center"
                    :style="{ cursor: noteCursor('n') }"
                    @mousedown.stop="handleResizeStart({ axis: 'n', e: $event })"
                ></div>
                <div
                    class="note-resize-bar -right-2 flex h-full w-2 cursor-e-resize flex-col justify-center"
                    :style="{ cursor: noteCursor('e') }"
                    @mousedown.stop="handleResizeStart({ axis: 'e', e: $event })"
                ></div>
                <div
                    class="note-resize-bar -bottom-2 flex h-2 w-full cursor-s-resize justify-center"
                    :style="{ cursor: noteCursor('s') }"
                    @mousedown.stop="handleResizeStart({ axis: 's', e: $event })"
                ></div>
                <div
                    class="note-resize-bar -left-2 flex h-full w-2 cursor-w-resize flex-col justify-center"
                    :style="{ cursor: noteCursor('w') }"
                    @mousedown.stop="handleResizeStart({ axis: 'w', e: $event })"
                ></div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { reactive, computed, ref, nextTick } from 'vue'
import { NoteCanvasElement } from '../ts/scene/CanvasElements'
import { CARDINAL_DIRECTIONS } from '../ts/scene/TransformBox'
import {
    initMouseAction,
    getRotatedResizeCursor,
    type NoteResizeDirection
} from '../ts/scene/CanvasUtils'
import { CmdService } from '../../../main'

const { canvasNoteData } = defineProps({
    canvasNoteData: NoteCanvasElement
})
const noteData = reactive(canvasNoteData as NoteCanvasElement)
const note = canvasNoteData as NoteCanvasElement

const noteHtmlElement = ref<HTMLDivElement | null>(null)
const textAreaRef = ref<HTMLTextAreaElement | null>(null)

const textAreaStyle = computed(() => ({
    'min-width': `${noteData.textAreaMinSize.x}px`,
    'min-height': `${noteData.textAreaMinSize.y}px`
}))

const resizeContainerStyle = computed(() => {
    const canvasZoom = noteData.canvas.zoom
    const w = noteData.transform.width * noteData.transform.scale * canvasZoom
    const h = noteData.transform.height * noteData.transform.scale * canvasZoom

    return {
        width: `${w}px`,
        height: `${h}px`,
        transform: `scale(${1 / noteData.transform.scale / canvasZoom})`,
        transformOrigin: 'top left'
    }
})

function noteCursor(base: NoteResizeDirection) {
    return getRotatedResizeCursor(base, noteData.transform.rotation)
}

function toggleEditMode() {
    if (noteData.editMode) {
        exitEditMode()
    } else {
        enterEditMode()
    }
}

function enterEditMode() {
    note.enterEditMode()
    nextTick(() => {
        textAreaRef.value?.focus()
    })
}

function exitEditMode() {
    if (!noteData.editMode) return
    note.exitEditMode()
}

function onEnter() {
    if (!noteData.editMode) return
    note.commitTextEdit()
}

function onKeyDown(e: KeyboardEvent) {
    if (!noteData.editMode) return
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        note.commitTextEdit()
        if (CmdService) e.shiftKey ? CmdService.redo() : CmdService.undo()
        return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        CmdService.redo()
    } else {
        noteData.didInputNewText = true
    }
}

function onPaste() {
    if (!noteData.editMode) return
    nextTick(() => {
        noteData.didInputNewText = true
        note.commitTextEdit()
    })
}

function handleResizeStart(ev: { axis: string; e: MouseEvent }) {
    const axis = ev.axis as CARDINAL_DIRECTIONS
    const canvas = note.canvas

    initMouseAction(
        () => {
            note.beginResize(axis, canvas.mousePos.clone())
        },
        () => {
            note.updateResize(canvas.mousePos)
        },
        () => {
            note.endResize()
        }
    )
}
</script>

<style scoped>
@reference "#main.css";

.resize-btns-container {
    @apply border-primary pointer-events-none z-0 border-2 border-dashed;
}

.resize-btns-container * {
    @apply pointer-events-auto;
}

.note-resize-corner {
    @apply bg-primary-500 absolute z-5 aspect-square size-6;
}
.note-resize-bar {
    @apply absolute z-0 min-h-3 min-w-3 opacity-0;
}
</style>

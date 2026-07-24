<template>
    <div ref="note-html-element" :style="noteStyle" :class="noteClasses" class="noteStyle">
        <pre
            v-show="!noteData.editMode"
            ref="text-container"
            class="size-fit"
            :style="textContainerStyle"
            >{{ noteData.noteText }}</pre>
        <textarea
            v-show="noteData.editMode"
            ref="text-area"
            v-model="noteData.noteText"
            :style="textAreaStyle"
            style="field-sizing: content"
        ></textarea>

        <!-- resize buttons -->

        <div v-show="noteData.editMode" id="resize-btns-container" class="absolute size-full">
            <div
                ref="resize-n"
                class="absolute -top-8 flex w-full cursor-n-resize items-center justify-center"
            >
                <div class="size-full bg-gray-900 text-center">--</div>
            </div>
            <div
                ref="resize-e"
                class="absolute -right-8 flex h-full cursor-e-resize items-center justify-center"
            >
                <div class="flex size-full items-center bg-gray-900 px-1 py-2">||</div>
            </div>
            <div
                ref="resize-s"
                class="absolute -bottom-8 flex w-full cursor-s-resize items-center justify-center"
            >
                <div class="size-full bg-gray-900 text-center">--</div>
            </div>
            <div
                ref="resize-w"
                class="absolute -left-8 flex h-full cursor-w-resize items-center justify-center"
            >
                <div class="flex size-full items-center bg-gray-900 px-1 py-2">||</div>
            </div>
            <div
                ref="resize-ne"
                class="absolute -top-8 -right-8 flex cursor-ne-resize items-center justify-center"
            >
                <div class="size-7 justify-center bg-gray-900 text-center">\</div>
            </div>
            <div
                ref="resize-nw"
                class="absolute -top-8 -left-8 flex cursor-nw-resize items-center justify-center"
            >
                <div class="size-7 justify-center bg-gray-900 text-center">/</div>
            </div>
            <div
                ref="resize-se"
                class="absolute -right-8 -bottom-8 flex cursor-se-resize items-center justify-center"
            >
                <div class="flex size-7 items-center justify-center bg-gray-900">/</div>
            </div>
            <div
                ref="resize-sw"
                class="absolute -bottom-8 -left-8 flex cursor-sw-resize items-center justify-center"
            >
                <div class="flex size-7 items-center justify-center bg-gray-900">\</div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useTemplateRef, reactive, onMounted, computed } from 'vue'
import { NoteCanvasElement } from '../ts/scene/CanvasElements'

const { canvasNoteData } = defineProps({
    canvasNoteData: NoteCanvasElement
})
const noteData = reactive(canvasNoteData as NoteCanvasElement)

const noteStyle = computed(() => {
    return {
        bottom: noteData.transform.position.y + 'px',
        left: noteData.transform.position.x + 'px',
        cursor: noteData.isGrabbed ? 'grabbing' : 'grab',
        transform: `rotate(${noteData.transform.rotation}deg)`,
        width: noteData.transform.width * noteData.transform.scale + 'px',
        height: noteData.transform.height * noteData.transform.scale + 'px',
        'min-width': noteData.textAreaMinSize.x * noteData.transform.scale + 'px',
        'min-height': noteData.textAreaMinSize.y * noteData.transform.scale + 'px',
        'z-index': noteData.zIndex,
        'transform-origin': 'bottom left'
    }
})

const textContainerStyle = computed(() => {
    return {
        transform: `scale(${noteData.transform.scale.y})`,
        'transform-origin': 'top left'
    }
})

const textAreaStyle = computed(() => {
    return {
        width: noteData.transform.width * noteData.transform.scale + 'px',
        height: noteData.transform.height * noteData.transform.scale + 'px',
        'min-width': noteData.textAreaMinSize.x * noteData.transform.scale + 'px',
        'min-height': noteData.textAreaMinSize.y * noteData.transform.scale + 'px',
        'font-size': `${noteData.transform.scale}rem`,
        padding: `${noteData.transform.scale}rem`

        // transform: `scale(${noteData.transform.scale.y})`,
        // "transform-origin": "topleft",
    }
})

const noteClasses = computed(() => {
    return {
        selectedNoteStyle: noteData.isSelected,
        editModeStyle_On: noteData.editMode,
        editModeStyle_Off: !noteData.editMode
    }
})

const noteHtmlEl = useTemplateRef('note-html-element')
const textContainer = useTemplateRef('text-container')

const textAreaHtmlEl = useTemplateRef('text-area')

const resizeButtons = {
    n: useTemplateRef('resize-n'),
    e: useTemplateRef('resize-e'),
    s: useTemplateRef('resize-s'),
    w: useTemplateRef('resize-w'),
    ne: useTemplateRef('resize-ne'),
    nw: useTemplateRef('resize-nw'),
    se: useTemplateRef('resize-se'),
    sw: useTemplateRef('resize-sw')
}

onMounted(() => {
    console.log(textAreaHtmlEl.value)

    canvasNoteData?.setHtmlElement(noteHtmlEl.value as HTMLDivElement)
    canvasNoteData?.setTextContainer(textContainer.value as HTMLPreElement)
    canvasNoteData?.setTextAreaEl(textAreaHtmlEl.value as HTMLTextAreaElement)

    const resizeBtns = {
        n: resizeButtons.n.value as HTMLElement,
        e: resizeButtons.e.value as HTMLElement,
        s: resizeButtons.s.value as HTMLElement,
        w: resizeButtons.w.value as HTMLElement,
        ne: resizeButtons.ne.value as HTMLElement,
        nw: resizeButtons.nw.value as HTMLElement,
        se: resizeButtons.se.value as HTMLElement,
        sw: resizeButtons.sw.value as HTMLElement
    }

    canvasNoteData?.setResizeButtons(resizeBtns)
})
</script>

<style scoped>
@reference "tailwindcss";

/* no matter the state */
.noteStyle {
    @apply absolute z-0 box-border flex bg-gray-950 text-white;
}

/* edit mode */
.editModeStyle_Off {
    @apply w-fit border border-gray-700 text-nowrap;
}

.editModeStyle_On {
    @apply w-fit border border-gray-700 text-nowrap;
}

/* selected */
.selectedNoteStyle {
    @apply ring-2 ring-yellow-500;
}

pre {
    @apply box-border p-4 font-mono;
}

textarea {
    @apply box-border resize-none overflow-hidden bg-gray-950 font-mono text-nowrap focus-visible:outline-none;
}

#resize-btns-container {
    @apply pointer-events-none;
}
#resize-btns-container * {
    @apply pointer-events-auto;
}
</style>

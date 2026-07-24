<script setup lang="ts">
import { computed } from 'vue'
import { useTransformStyle } from '../composables/useTransformStyle'
import { TransformBox } from '../ts/scene/TransformBox'

const props = defineProps<{
    transformBox: TransformBox
}>()

const transformStyle = useTransformStyle(computed(() => props.transformBox.transform))

const emit = defineEmits(['resizeStart', 'rotateStart'])
</script>

<template>
    <div v-if="!transformBox.hidden" class="tbox" :style="transformStyle">
        <div class="resize-corners">
            <div
                class="tbox-resize-corner -top-2.5 -left-2.5 cursor-nw-resize"
                @mousedown.stop="emit('resizeStart', { axis: 'nw', e: $event })"
            ></div>
            <div
                class="tbox-resize-corner -top-2.5 -right-2.5 cursor-ne-resize"
                @mousedown.stop="emit('resizeStart', { axis: 'ne', e: $event })"
            ></div>
            <div
                class="tbox-resize-corner -right-2.5 -bottom-2.5 cursor-se-resize"
                @mousedown.stop="emit('resizeStart', { axis: 'se', e: $event })"
            ></div>
            <div
                class="tbox-resize-corner -bottom-2.5 -left-2.5 cursor-sw-resize"
                @mousedown.stop="emit('resizeStart', { axis: 'sw', e: $event })"
            ></div>
        </div>
        <div class="resize-edges">
            <div
                class="tbox-resize-bar -top-2 flex h-2 w-full cursor-n-resize justify-center"
                @mousedown.stop="emit('resizeStart', { axis: 'n', e: $event })"
            ></div>
            <div
                class="tbox-resize-bar -right-2 flex h-full w-2 cursor-e-resize flex-col justify-center"
                @mousedown.stop="emit('resizeStart', { axis: 'e', e: $event })"
            ></div>
            <div
                class="tbox-resize-bar -bottom-2 flex h-2 w-full cursor-s-resize justify-center"
                @mousedown.stop="emit('resizeStart', { axis: 's', e: $event })"
            ></div>
            <div
                class="tbox-resize-bar -left-2 flex h-full w-2 cursor-w-resize flex-col justify-center"
                @mousedown.stop="emit('resizeStart', { axis: 'w', e: $event })"
            ></div>
        </div>

        <div class="rotate-handles">
            <div
                class="tbox-rot -top-10 -left-10"
                @mousedown.stop="emit('rotateStart', { axis: 'nw', e: $event })"
            ></div>
            <div
                class="tbox-rot -top-10 -right-10"
                @mousedown.stop="emit('rotateStart', { axis: 'ne', e: $event })"
            ></div>
            <div
                class="tbox-rot -right-10 -bottom-10"
                @mousedown.stop="emit('rotateStart', { axis: 'se', e: $event })"
            ></div>
            <div
                class="tbox-rot -bottom-10 -left-10"
                @mousedown.stop="emit('rotateStart', { axis: 'sw', e: $event })"
            ></div>
        </div>
    </div>
</template>

<style scoped>
@reference "#main.css";

.tbox {
    @apply border-primary pointer-events-none border-2 border-dashed;
}

.tbox * {
    @apply pointer-events-auto;
}

.tbox-rot {
    @apply bg-primary-700/30 absolute aspect-square size-8 cursor-grab rounded-full;
}
.tbox-resize-corner {
    @apply bg-primary-500 absolute aspect-square size-4 rounded-full;
}
.tbox-resize-bar {
    @apply absolute min-h-3 min-w-3 opacity-0;
}
</style>

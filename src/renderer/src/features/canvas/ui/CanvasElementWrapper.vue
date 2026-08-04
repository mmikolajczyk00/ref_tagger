<script setup lang="ts">
import { HTMLAttributes } from 'vue'
import { useTransformStyle } from '../composables/useTransformStyle'
import { Transform } from '../ts/scene/CanvasUtils'

interface Props extends /* @vue-ignore */ HTMLAttributes {
    transform: Transform
    isSelected?: boolean
}

const props = defineProps<Props>()

const transformStyle = useTransformStyle(() => props.transform)
</script>

<template>
    <div :style="transformStyle" :class="['canvas-element-node', { selected: isSelected }]">
        <slot />
    </div>
</template>

<style scoped>
@reference "#main.css";

.selected {
    @apply ring-primary-500 ring-2;
}
</style>

<script setup lang="ts">
import { HTMLAttributes } from 'vue'
import { useTransformStyle } from '../composables/useTransformStyle'
import { Transform } from '../ts/scene/canvas_utils'

interface Props extends /* @vue-ignore */ HTMLAttributes {
    transform: Transform
}

const props = defineProps<Props>()

const transformStyle = useTransformStyle(() => props.transform)
</script>

<template>
    <div :style="transformStyle" class="canvas-element-node">
        <slot />
    </div>
</template>

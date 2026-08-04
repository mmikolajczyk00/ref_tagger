<script setup lang="ts">
import { computed, HTMLAttributes } from 'vue'
import { useTransformStyle } from '../composables/useTransformStyle'
import { Transform } from '../ts/scene/CanvasUtils'

interface Props extends /* @vue-ignore */ HTMLAttributes {
    transform: Transform
}

const props = defineProps<Props>()

const transformStyle = useTransformStyle(computed(() => props.transform))
</script>

<template>
    <div class="" :style="transformStyle">
        <slot />
    </div>
</template>

<style scoped>
@reference "#main.css";
</style>

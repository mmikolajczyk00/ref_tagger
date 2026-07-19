<script setup lang="ts">
import { computed, HTMLAttributes } from 'vue'
import { useTransformStyle } from '../composables/useTransformStyle'
import { TransformBox } from '../TransformBox'
import SelectionBox from '../SelectionBox'
import { Transform } from '../canvas_utils'

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

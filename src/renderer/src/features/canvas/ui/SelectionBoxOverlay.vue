<script setup lang="ts">
import { computed } from 'vue'
import { useTransformStyleUnzoomed } from '../composables/useTransformStyle'
import SelectionBox from '../ts/scene/SelectionBox'

const props = defineProps<{
    selectionBox: SelectionBox
    zoom: number
}>()

const transformStyle = useTransformStyleUnzoomed(
    computed(() => props.selectionBox.transform),
    computed(() => props.zoom)
)

// const emit = defineEmits([])
</script>

<template>
    <div
        v-if="!selectionBox.hidden"
        class="border-primary pointer-events-none border-2"
        :style="transformStyle"
    ></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTransformStyle } from '../composables/useTransformStyle'
import SelectionBox from '../ts/scene/SelectionBox'

const props = defineProps<{
    selectionBox: SelectionBox
}>()

const transformStyle = useTransformStyle(computed(() => props.selectionBox.transform))

// const emit = defineEmits([])
</script>

<template>
    <div
        v-if="!selectionBox.hidden"
        class="border-primary pointer-events-none border-2"
        :style="transformStyle"
    ></div>
</template>

<style scoped>
@reference "#main.css";
</style>

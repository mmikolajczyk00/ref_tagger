<template>
    <div
        ref="image-html-element"
        :class="groupContainerClasses"
        class="group bg-primary-200/80 dark:bg-primary-950/80 absolute size-full"
    >
        <!-- <CanvasElementWrapper
            v-for="child in canvasGroupData!.children"
            :key="child.elementId"
            :transform="child.transform"
        >
            <MediaFileElement
                v-if="child instanceof MediaFileCanvasElement"
                :canvas-image-data="child"
            />
            <GroupElement
                v-else-if="child instanceof GroupCanvasElement"
                :canvas-group-data="child"
            ></GroupElement>
        </CanvasElementWrapper> -->
        <p class="absolute bottom-5 left-0 bg-black text-white opacity-0 group-hover:opacity-100">
            {{ groupData.transform.position }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { GroupCanvasElement } from '../ts/scene/CanvasElements'
import { reactive, computed } from 'vue'

const { canvasGroupData } = defineProps({
    canvasGroupData: GroupCanvasElement
})

const groupData = reactive(canvasGroupData as GroupCanvasElement)

const groupContainerClasses = computed(() => [
    { selected: groupData.isSelected },
    groupData.isGrabbed ? 'grabbing' : 'grab'
])
</script>

<style scoped>
@reference "#main.css";

.selected {
    @apply ring-primary-500 ring-2;
}
</style>

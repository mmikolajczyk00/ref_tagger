<template>
    <div
        ref="image-html-element"
        :class="groupContainerClasses"
        class="group bg-surface-400/50 dark:bg-surface-600/50 absolute size-full"
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
        <p class="absolute bottom-5 left-0 bg-black text-white">
            {{ groupData.elementId }}
            {{ groupData.transform.parentTransform?.elementId }}
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

const isSelectable = computed(() => groupData.canvas.isSelectable(groupData))

const groupContainerClasses = computed(() => [
    { 'border-2 border-dashed border-surface-500 dark:border-surface-400': groupData.expanded },
    groupData.isGrabbed ? 'grabbing' : 'grab',
    isSelectable.value ? 'rounded-lg' : ''
])
</script>

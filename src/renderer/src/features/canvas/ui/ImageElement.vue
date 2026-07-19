<template>
    <div
        ref="image-html-element"
        :class="imageContainerClasses"
        class="group absolute size-full overflow-clip"
    >
        <canvas class="size-full" ref="imgCanvas"></canvas>
        <p class="absolute bottom-5 left-0 bg-black text-white opacity-0 group-hover:opacity-100">
            {{ imageData.transform.position }}
        </p>
    </div>
</template>

<script setup lang="ts">
import { useFileStore } from '../../../core/stores/fileStore'
import { ImageCanvasElement } from '../CanvasElements'
import { useTemplateRef, reactive, onMounted, computed } from 'vue'

const fileStore = useFileStore()

const { canvasImageData } = defineProps({
    canvasImageData: ImageCanvasElement
})

const imageData = reactive(canvasImageData as ImageCanvasElement)

const imageContainerClasses = computed(() => [
    { selected: imageData.isSelected },
    imageData.isGrabbed ? 'grabbing' : 'grab'
])

const htmlEl = useTemplateRef('image-html-element')
const canvasRef = useTemplateRef('imgCanvas')
onMounted(() => {
    canvasImageData?.setHtmlElement(htmlEl.value as HTMLDivElement)

    //load image and draw on canvas

    const canvas = canvasRef.value as HTMLCanvasElement

    let context = canvas.getContext('2d')
    const image = new Image()

    const imageUrl = fileStore.getFileOfId(canvasImageData?.fileId)?.url

    image.src = imageUrl!

    // draw on canvas

    image.onload = () => {
        // Use the intrinsic size of image in CSS pixels for the canvas element
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight

        // Will draw the image as 300x227, ignoring the custom size of 60x45
        // given in the constructor
        context!.drawImage(image, 0, 0)

        // To use the custom size we'll have to specify the scale parameters
        // using the element's width and height properties - lets draw one
        // on top in the corner:
        context!.drawImage(image, 0, 0, image.width, image.height)

        //update image container size
        imageData.transform.width = image.width
        imageData.transform.height = image.height

        console.log(image)
    }
})
</script>

<style scoped>
@reference "#main.css";

.selected {
    @apply ring-primary-500 ring-2;
}
</style>

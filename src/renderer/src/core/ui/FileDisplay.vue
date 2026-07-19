<template>
  <img
    v-if="mediaType == MediaType.IMAGE && lazy"
    :draggable="draggable"
    v-lazy="src"
    :class="class"
    :style="style"
  />
  <img
    v-else-if="mediaType == MediaType.IMAGE && !lazy"
    :draggable="draggable"
    :src="src"
    :class="class"
    :style="style"
  />
  <video
    v-else-if="mediaType == MediaType.VIDEO"
    :draggable="draggable"
    :class="class"
    :style="style"
    :src="src"
    :controls="controls"
    :autoplay="autoplay"
    ref="video"
    class="outline-none"
    @keydown.prevent=""
  ></video>
</template>

<script setup lang="ts">
import { onMounted, ref, useTemplateRef } from 'vue'
import { MediaType } from '../../../../shared/shared'

const video_el = useTemplateRef('video')

defineExpose({
  toggleVideoFullscreen,
  toggleVideoPlayback,
  toggleVideoLooping,
  stopVideo
})

const fullscreen = ref(false)

function toggleVideoFullscreen() {
  if (props.mediaType != MediaType.VIDEO) return
  if (fullscreen.value) document.exitFullscreen()
  else video_el.value?.requestFullscreen()
  fullscreen.value = !fullscreen.value
}

function toggleVideoPlayback() {
  if (props.mediaType != MediaType.VIDEO) return

  if (!video_el.value?.paused) video_el.value?.pause()
  else video_el.value?.play()
}
function stopVideo() {
  video_el.value?.pause()
}

function toggleVideoLooping() {
  if (props.mediaType != MediaType.VIDEO) return

  video_el.value!.loop = !video_el.value?.loop
}

interface Props {
  mediaType: string
  src: string
  class?: string
  style?: string
  controls?: boolean
  draggable?: boolean
  autoplay?: boolean
  lazy?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  mediaType: MediaType.UNDEFINED,
  src: '',
  class: '',
  style: '',
  controls: false,
  draggable: false,
  autoplay: false,
  lazy: true
})
</script>

<style scoped></style>

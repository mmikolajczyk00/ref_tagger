<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import FileDisplay from './FileDisplay.vue'
import { MediaType } from '../../../../shared/shared'

const props = defineProps({
  mediaType: { type: String, required: true },
  url: { type: String, required: true },
  id: { type: String, required: true },
  selected: { type: Boolean, required: true }
})

const emit = defineEmits(['delete', 'expand'])

const img_mediatype = MediaType.IMAGE
</script>

<template>
  <div
    class="group relative aspect-square select-none overflow-hidden bg-zinc-400"
    :class="{ 'ring-primary ring-2': selected }"
  >
    <!-- SELECTION TINT -->
    <div v-show="selected" class="bg-primary-500/25 z-5 absolute size-full"></div>

    <!-- HOVER BUTTONS -->
    <div
      class="absolute bottom-0 z-20 flex w-full origin-bottom scale-y-0 flex-row justify-end justify-between bg-black/75 p-1 transition-all duration-100 ease-out group-hover:scale-100"
    >
      <span
        class="material-symbols-outlined text-4xl! text-primary-500 cursor-pointer"
        @click.stop="emit('expand')"
      >
        fullscreen
      </span>
    </div>

    <!-- media -->

    <FileDisplay
      class="contain absolute size-full w-full object-cover transition-transform duration-75 ease-out group-hover:scale-110"
      :src="url"
      :media-type="img_mediatype"
    ></FileDisplay>
  </div>
</template>

<style scoped></style>

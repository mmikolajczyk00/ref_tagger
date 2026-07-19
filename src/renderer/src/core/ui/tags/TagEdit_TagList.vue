<script setup lang="ts">
import { onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import { normalizeTag } from '@renderer/core/tagsUtils'
import { useTagStore } from '@renderer/store/tagStore'
import TagsInput from './TagsInput.vue'
import { TagModel, TagSimpleResponse } from '@renderer/core/model/tagModel'
import TagChip from './TagChip.vue'

const emit = defineEmits(['submit', 'cancel'])
const changedTagList = ref([] as string[])
const editing = ref(false)

const tagStore = useTagStore()

interface Props {
  originalTags: TagSimpleResponse[]
  inputClass?: string
  direction?: string
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  originalTags: () => [],
  inputClass: '',
  direction: 'up',
  height: 200
})

function onInput(): void {
  // changedTagListInput.value = normalizeTag(changedTagListInput.value)
}

function submit(): void {
  editing.value = false
  emit('submit', changedTagList.value)
  changedTagList.value = modelsToNames()
}
function cancel(): void {
  changedTagList.value = modelsToNames()
  editing.value = false
  emit('cancel')
}

watchEffect(() => {
  changedTagList.value = modelsToNames()
})

function modelsToNames() {
  return props.originalTags.map((t) => t.name)
}

function enableEditing() {
  editing.value = true
  console.log('editing')
}
</script>

<template>
  <div
    ref="container"
    v-on:dblclick="enableEditing()"
    @keydown.exact.escape.capture="cancel"
    class="size-full overflow-visible"
  >
    <div
      class="border-surface-500/25 group relative flex min-h-8 w-full flex-row justify-center rounded border"
      v-if="!editing"
    >
      <div
        v-if="originalTags.length <= 0"
        class="text-surface-100/25 flex items-center overflow-hidden text-nowrap"
      >
        - no tags -
      </div>
      <div v-else class="flex max-h-48 flex-row flex-wrap gap-1 overflow-y-auto">
        <TagChip v-for="tag in originalTags" :key="tag.name" :name="tag.name"></TagChip>
      </div>
      <Button
        class="bg-surface-900 absolute right-0 hidden h-full rounded group-hover:flex"
        text
        @click="enableEditing"
      >
        <span class="material-symbols-outlined">edit</span></Button
      >
    </div>
    <div class="flex items-center overflow-visible" v-else>
      <TagsInput
        v-model:input-tags="changedTagList"
        input-style="p-2 w-full outline-none"
        class="border-surface-500/25 z-10 w-full rounded-sm rounded-t-none border bg-transparent"
        placeholder="tags"
        :icon="false"
        :show-tags="true"
        :height="height"
        @submit="submit"
      ></TagsInput>

      <Button class="hover:bg-primary-700 m-1 size-8 rounded p-0" text @click="submit">
        <span class="material-symbols-outlined">check</span></Button
      >
    </div>
  </div>
</template>

<style scoped></style>

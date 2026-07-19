<script setup lang="ts">
import { onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import { normalizeTag } from '@renderer/core/tagsUtils'
import { useTagStore } from '@renderer/store/tagStore'

const emit = defineEmits(['submit', 'cancel'])
const changedGroup = ref('')
const editing = ref(false)
const inputEl = useTemplateRef('input')

const tagStore = useTagStore()

interface Props {
  originalGroup: string
  inputClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  originalGroup: '',
  inputClass: ''
})

function onInput(): void {
  // changedGroupInput.value = normalizeTag(changedGroupInput.value)
}

function submit(): void {
  editing.value = false
  if (props.originalGroup == changedGroup.value) return
  emit('submit', changedGroup.value)
  changedGroup.value = props.originalGroup
}
function cancel(): void {
  changedGroup.value = props.originalGroup
  editing.value = false
  emit('cancel')
}

watchEffect(() => {
  changedGroup.value = props.originalGroup
})

function enableEditing() {
  editing.value = true
  console.log('editing')
}
</script>

<template>
  <div
    ref="container"
    class="size-full"
    v-on:dblclick="enableEditing()"
    @keydown.exact.escape.capture="cancel"
  >
    <div class="group relative flex w-full flex-row justify-center" v-if="!editing">
      <div class="text-center">{{ originalGroup }}</div>
      <Button
        class="bg-surface-900 absolute right-0 hidden h-full rounded group-hover:flex"
        text
        @click="enableEditing"
      >
        <span class="material-symbols-outlined">edit</span></Button
      >
    </div>
    <div class="ring-primary flex items-center overflow-clip focus-within:ring" v-else>
      <Select
        ref="input"
        v-model="changedGroup"
        editable
        :options="tagStore.getGroupNames"
        placeholder="Select a Group"
        class="bg-surface-800 caret-primary focus:bg-primary-900 selection:bg-primary w-full outline-none"
        @input="onInput"
        @change="onInput"
        @keydown.exact.enter.prevent="submit"
      />
      <Button class="hover:bg-primary-700 m-1 size-8 rounded p-0" text @click="submit">
        <span class="material-symbols-outlined">check</span></Button
      >
    </div>
  </div>
</template>

<style scoped></style>

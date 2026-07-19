<script setup lang="ts">
import { onMounted, ref, useTemplateRef, watchEffect } from 'vue'
import { normalizeTag } from '@renderer/core/tagsUtils'

const emit = defineEmits(['submit', 'cancel'])
const changedTagName = ref('')
const editing = ref(false)
const inputEl = useTemplateRef('input')

interface Props {
  originalTagName: string
  inputClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  originalTagName: '',
  inputClass: ''
})

function onInput(): void {
  changedTagName.value = normalizeTag(changedTagName.value)
}

function submit(): void {
  editing.value = false
  if (props.originalTagName == changedTagName.value) return
  emit('submit', changedTagName.value)
  changedTagName.value = props.originalTagName
}
function cancel(): void {
  changedTagName.value = props.originalTagName
  editing.value = false
  emit('cancel')
}

watchEffect(() => {
  changedTagName.value = props.originalTagName
})

function enableEditing() {
  editing.value = true
  requestAnimationFrame(() => {
    inputEl.value?.focus()
  })
}
</script>

<template>
  <div ref="container" v-on:dblclick="enableEditing()">
    <div class="group relative flex w-full flex-row justify-start" v-if="!editing">
      <div class="text-start">{{ originalTagName }}</div>
      <Button
        class="bg-surface-900 absolute right-0 hidden h-full rounded group-hover:flex"
        text
        @click="enableEditing"
      >
        <span class="material-symbols-outlined">edit</span></Button
      >
    </div>
    <div class="ring-primary flex items-center overflow-clip focus-within:ring" v-else>
      <input
        ref="input"
        v-model="changedTagName"
        :class="inputClass"
        class="bg-surface-800 caret-primary focus:bg-primary-900 selection:bg-primary w-full p-2 outline-none"
        type="text"
        @input="onInput"
        @change="onInput"
        @keydown.exact.enter.prevent="submit"
        @keydown.exact.escape.prevent="cancel"
      />
      <Button class="hover:bg-primary-700 m-1 size-8 rounded p-0" text @click="submit">
        <span class="material-symbols-outlined">check</span></Button
      >
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { computed, onMounted, onUpdated, ref, useTemplateRef, watchEffect } from 'vue'
import { normalizeTag, separateTagAndGroup } from '@renderer/core/tagsUtils'
import { autocompleteFilter } from '@renderer/core/autocomplete'
import { useTagStore } from '@renderer/store/tagStore'
import { useMagicKeys, whenever } from '@vueuse/core'

const emit = defineEmits(['submit', 'cancel', 'input'])
const textInput = ref('')
const focused = ref(false)

const inputEl = useTemplateRef('input_el')

const tagStore = useTagStore()

const suggestedActiveIndex = ref(0)

const autocompletePool = computed(() => {
  let startWithQ = textInput.value.startsWith('?')
  let hasColon = textInput.value.includes(':')

  if (startWithQ && !hasColon) {
    return tagStore.getGroupNames
  } else if (hasColon) {
    return tagStore.getNamesInGroup(textInput.value.split(':')[0])
  } else {
    return [...tagStore.allTagNames]
  }
})

interface Props {
  inputClass?: string
  typaheadClass?: string
  inputStyle?: string
  suggestedClass?: string
  placeholder?: string
  clearOnSubmit?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  inputClass: '',
  typaheadClass: '',
  inputStyle: '',
  suggestedClass: '',
  placeholder: 'new tag',
  clearOnSubmit: true
})

function onInput(e: Event): void {
  const [tagname, group] = separateTagAndGroup(textInput.value.replaceAll('?', ''))
  emit('input', tagname, group)
}

function submit(): void {
  textInput.value = textInput.value.replaceAll('?', '')
  const [tagname, group] = separateTagAndGroup(textInput.value)
  emit('input', tagname, group)
  emit('submit', tagname, group)
  if (props.clearOnSubmit) textInput.value = ''

  tagStore.addGroup('group')
}
function cancel(): void {
  focused.value = false
  textInput.value = ''
  inputEl.value?.blur()

  emit('cancel')
}

function enableEditing() {
  focused.value = true
  requestAnimationFrame(() => {
    inputEl.value?.focus()
  })
}

const suggestedTags = computed(() => {
  // return tagStore.suggestedTags(changed.value)
  let cleanInput = textInput.value.replace('?', '')
  if (cleanInput.includes(':')) cleanInput = cleanInput.split(':')[1]

  console.log({ cleanInput, pool: autocompletePool.value })

  return autocompleteFilter(cleanInput, autocompletePool.value, {
    autocompleteSize: 4
  })
})

const typeahead = computed(() => {
  const input_length = textInput.value.length

  if (input_length <= 0 || suggestedTags.value.length <= 0) return ''
  let tag = suggestedTags.value[0]

  tag = tag.slice(input_length)

  return tag.padStart(suggestedTags.value[0].length, ' ')
})

function completeTag(): void {
  if (suggestedTags.value?.length > 0) {
    if (textInput.value.startsWith('?')) {
      textInput.value = suggestedTags.value[suggestedActiveIndex.value] + ':'
    } else {
      textInput.value = suggestedTags.value[suggestedActiveIndex.value]
    }
    suggestedActiveIndex.value = 0
  }
}

const suggestionsPopup_el = useTemplateRef('suggestions-popup')
const container_el = useTemplateRef('container')
onUpdated(() => {
  suggestionsPopup_el.value!.style.bottom = container_el.value?.offsetHeight! + 5 + 'px'
})
</script>

<template>
  <div ref="container" v-on:dblclick="enableEditing()">
    <div class="relative z-0 flex size-full flex-row">
      <input
        ref="input_el"
        v-model="textInput"
        :class="[
          'selection:bg-primary bg-surface-800 caret-primary size-full p-4 text-transparent outline-none',
          inputClass
        ]"
        :style="inputStyle"
        type="text"
        @focus="focused = true"
        @blur="focused = false"
        @input="onInput"
        @keydown.tab.prevent="completeTag"
        @keydown.enter.prevent="submit"
        @keydown.escape.prevent="cancel"
        @keydown.arrow-up.prevent="
          () => {
            suggestedActiveIndex--
            if (suggestedActiveIndex < 0) suggestedActiveIndex = suggestedTags.length - 1
          }
        "
        @keydown.arrow-down.prevent="
          () => {
            suggestedActiveIndex++
            if (suggestedActiveIndex >= suggestedTags.length) suggestedActiveIndex = 0
          }
        "
      />
      <div class="pointer-events-none absolute flex size-full items-center overflow-hidden p-4">
        <span>{{ textInput }}</span>
        <span :class="[typaheadClass]" class="text-white/50">{{
          textInput.length > 0 ? typeahead : placeholder
        }}</span>
      </div>
      <div
        class="-z-5 bg-surface-700 absolute bottom-4 flex h-fit w-full flex-col flex-nowrap gap-1 overflow-hidden rounded"
        :class="suggestedClass"
        v-show="focused && textInput.length > 0"
        ref="suggestions-popup"
      >
        <div
          v-for="(tag, index) in suggestedTags"
          :key="tag"
          :class="[index == suggestedActiveIndex ? 'text-primary-200 bg-primary-800' : '', 'p-1']"
        >
          {{ tag }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, useTemplateRef } from 'vue'
import { onClickOutside } from '@vueuse/core'
import TagChip from './TagChip.vue'
import { useTagStore } from '../../stores/tagStore'
import { autocompleteFilter } from '../../utils/autocomplete'
import { normalizeTag } from '../../utils/tagsUtils'

const inputTags = defineModel<string[]>('inputTags', { required: true, default: [] })

const emit = defineEmits(['addTag', 'removeTag', 'clearTags', 'submit'])
const tagStore = useTagStore()
const rawInput = ref('')
const focused = ref(false)
const inputEl = useTemplateRef('input')
const containerEl = useTemplateRef('container')

onClickOutside(containerEl, () => {
  inputEl.value?.blur()
  focused.value = false
})

interface Props {
  direction?: string
  placeholder?: string
  iconStyle?: string
  inputStyle?: string
  icon?: boolean
  showTags?: boolean
  height?: number
}

const props = withDefaults(defineProps<Props>(), {
  direction: 'auto',
  placeholder: 'search',
  iconStyle: 'p-2',
  inputStyle: 'mx-1 w-full outline-none',
  icon: true,
  showTags: true,
  height: 200
})

const automatedDirection = ref(props.direction)

const suggestedTags = computed(() => {
  // return tagStore.suggestedTags(rawInput.value)
  if (rawInput.value.length > 0) {
    return autocompleteFilter(rawInput.value, [...tagStore.allTagNames])
  } else {
    return []
  }
})

const typeahead = computed(() => {
  const input_length = rawInput.value.length

  if (input_length <= 0 || suggestedTags.value.length <= 0) return ''
  let tag = suggestedTags.value[0]

  tag = tag.slice(input_length)

  return tag.padStart(suggestedTags.value[0].length, ' ')
})

function onInput(): void {
  rawInput.value = normalizeTag(rawInput.value)
}

function enterTag(): void {
  if (rawInput.value.length <= 0) emit('submit')
  else {
    addTag(normalizeTag(rawInput.value))
    rawInput.value = ''
  }
}
function completeTag(): void {
  if (suggestedTags.value?.length > 0) {
    rawInput.value = suggestedTags.value[0]
  }
}

function addTag(tag: string): void {
  if (tag.length <= 0) return
  // if it isnt already in the array
  if (!inputTags.value.some((t) => t === tag)) inputTags.value.push(tag)
  emit('addTag', tag)
}

function removeTag(tag: string): void {
  let index = inputTags.value.findIndex((t) => t === tag)
  if (index !== -1) {
    inputTags.value.splice(index, 1)
  }
  emit('removeTag', tag)
}

function clearTags(): void {
  inputTags.value = []
  emit('clearTags')
}

onMounted(() => {
  tagStore.fetchAllTags()

  if (automatedDirection.value == 'auto') {
    automatedDirection.value = containerEl.value?.offsetTop! - props.height < 50 ? 'down' : 'up'
  }
})

const containerClass = computed(() => ({
  '-z-5 bg-surface-800  border-surface-400 rounded-md border flex w-full p-1 flex-row content-start gap-1 flex-wrap duration-150 ease-out overflow-auto absolute w-full': true,
  'bottom-0 pb-12': automatedDirection.value == 'up',
  'top-0 pt-12': automatedDirection.value != 'up',
  'opacity-100': focused.value,
  'opacity-0': !focused.value
}))
</script>

<template>
  <div ref="container" class="bg-surface-800 relative z-0 rounded-full">
    <div
      :class="[focused ? 'bg-surface-800 border-surface-400 rounded border' : 'bg-none']"
      class="flex h-full flex-row flex-nowrap items-center"
    >
      <i
        v-if="icon"
        v-show="!focused"
        class="material-symbols-outlined text-surface-300"
        :class="iconStyle"
        >search</i
      >
      <i
        v-show="focused"
        class="material-symbols-outlined text-surface-300 cursor-pointer"
        :class="iconStyle"
        @click="clearTags"
        >close</i
      >
      <div class="relative flex size-full flex-row">
        <input
          ref="input"
          v-model="rawInput"
          :class="inputStyle"
          class="selection:bg-primary caret-primary size-full text-transparent outline-none"
          type="text"
          @focus="focused = true"
          @input="onInput"
          @change="onInput"
          @keydown.exact.tab.prevent="completeTag"
          @keydown.exact.enter.prevent="enterTag"
        />
        <div class="pointer-events-none absolute flex size-full items-center overflow-hidden px-1">
          <span>{{ rawInput }}</span>
          <span class="text-white/50">{{ rawInput.length > 0 ? typeahead : placeholder }}</span>
        </div>
        <div
          v-if="showTags"
          v-show="!focused"
          class="pointer-events-none absolute flex size-full items-center gap-1 overflow-hidden rounded-full px-1"
        >
          <TagChip v-for="tag in inputTags" :key="tag" :name="tag"></TagChip>
        </div>
      </div>
    </div>

    <div :class="containerClass" :style="{ height: focused ? height + 'px' : '0px' }">
      <template v-if="rawInput.length <= 0 && inputTags.length > 0 && showTags">
        <TagChip
          v-for="tag in inputTags"
          :key="tag"
          class="cursor-pointer"
          :name="tag"
          :removable="true"
          @remove="removeTag(tag)"
        ></TagChip>
      </template>
      <template v-else>
        <TagChip
          v-for="(tag, index) in suggestedTags"
          :key="tag"
          class="cursor-pointer"
          :name="tag"
          @press="addTag(tag)"
        ></TagChip>
      </template>
    </div>
  </div>
</template>

<style scoped></style>

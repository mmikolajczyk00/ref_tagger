<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import TagChip from './tags/TagChip.vue'
import { onClickOutside, useElementVisibility, useMagicKeys } from '@vueuse/core'
import { useTagStore } from '../stores/tagStore'
import { autocompleteFilter } from '../utils/autocomplete'
import { normalizeTag } from '../utils/tagsUtils'

const inputTags = defineModel<string[]>('inputTags', { required: true, default: [] })

const emit = defineEmits(['valueChange', 'search'])
const tagStore = useTagStore()
const rawInput = ref('')
const focused = ref(false)
const inputEl = useTemplateRef('input')
const containerEl = useTemplateRef('container')

onClickOutside(containerEl, () => {
  inputEl.value?.blur()
  focused.value = false
})

const keys = useMagicKeys()
const ctrlF_bind = keys['Ctrl+F']

const isVisible = useElementVisibility(containerEl)
watch(ctrlF_bind, (v) => {
  if (v && isVisible) {
    focused.value = true
    inputEl.value?.focus()
  }
})

document.body.addEventListener('click', function (event: any) {
  if (containerEl.value?.contains(event.target)) {
    console.log('clicke2')
  } else {
    // hide autocomplete, click was outside container.
  }
})

interface Props {
  direction?: string
  placeholder?: string
  iconStyle?: string
  containerStyle?: string
  inputStyle?: string
  icon?: boolean
  showTags?: boolean
  ctrlF?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  direction: '',
  placeholder: 'search',
  iconStyle: 'p-2',
  containerStyle: '',
  inputStyle: 'mx-1 w-full outline-none',
  icon: true,
  showTags: true,
  ctrlF: true
})

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

  console.log('suggestedTags.value', suggestedTags.value)

  let tag = suggestedTags.value[0]

  tag = tag.slice(input_length)

  return tag.padStart(suggestedTags.value[0].length, ' ')
})

function onInput(): void {
  rawInput.value = normalizeTag(rawInput.value)
}

function enterTag(): void {
  addTag(normalizeTag(rawInput.value))
  rawInput.value = ''
}
function completeTag(): void {
  if (suggestedTags.value?.length > 0) {
    rawInput.value = suggestedTags.value[0]
  }
}

function clearTags(): void {
  inputTags.value = []
  emit('valueChange')
}

function removeTag(tag: string): void {
  inputTags.value.splice(inputTags.value.indexOf(tag), 1)
  emit('valueChange')
}

function addTag(tag: string): void {
  if (tag.length <= 0) return
  if (!inputTags.value.some((t) => t === tag)) inputTags.value.push(tag)
  emit('valueChange')
  inputEl.value?.focus()
}
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
        @click="
          () => {
            clearTags()
            rawInput = ''
            inputEl?.focus()
          }
        "
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
          <span class="text-white/50">{{ typeahead }}</span>
          <span v-show="!focused && inputTags.length <= 0" class="text-white/50">{{
            placeholder
          }}</span>
        </div>
        <div
          v-show="!focused"
          class="pointer-events-none absolute flex size-full items-center gap-1 overflow-hidden rounded-full px-1"
        >
          <TagChip v-for="tag in inputTags" :key="tag" :name="tag"></TagChip>
        </div>
      </div>
    </div>

    <div
      :class="[
        props.direction == 'up' ? 'bottom-0 pb-12' : 'top-0 pt-14',
        focused ? 'h-32 opacity-100' : 'h-0 opacity-0',
        containerStyle
      ]"
      class="bg-surface-800 -z-5 border-surface-400 absolute flex w-full flex-row flex-wrap content-start gap-1 overflow-auto rounded-md border p-1 duration-150 ease-out"
    >
      <template v-if="rawInput.length <= 0 && inputTags.length > 0 && showTags">
        <TagChip
          v-for="tag in inputTags"
          :key="tag"
          class="cursor-pointer"
          :name="tag"
          :removable="true"
          severity="primary"
          @remove="removeTag(tag)"
        ></TagChip>
      </template>
      <template v-else>
        <TagChip
          v-for="(tag, index) in suggestedTags"
          :key="tag"
          class="cursor-pointer"
          :name="tag"
          :severity="index == 0 ? 'primary' : 'secondary'"
          @click.exact="
            () => {
              addTag(tag)
              rawInput = ''
            }
          "
          @click.ctrl="addTag(tag)"
        ></TagChip>
      </template>
    </div>
  </div>
</template>

<style scoped></style>

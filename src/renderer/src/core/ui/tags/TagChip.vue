<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { useTagStore } from '../../stores/tagStore'

const emit = defineEmits(['press', 'remove', 'dblclick', 'submit'])

const tagStore = useTagStore()

const input_el = useTemplateRef('input_el')

defineExpose({
  startEdit
})

interface Props {
  name: string
  group?: string
  editable?: boolean
  removable?: boolean
  unique?: boolean
  inlineGroup?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  name: '',
  group: '',
  editable: false,
  removable: false,
  unique: false,
  inlineGroup: true
})

const editing = ref(false)

function dblclick() {
  emit('dblclick')
  if (!editing.value) startEdit()
}

function startEdit() {
  if (props.editable) {
    editing.value = true
    requestAnimationFrame(() => {
      newTagValue.value = props.group.length > 0 ? props.group + ':' + props.name : props.name
      input_el.value?.focus()
      input_el.value?.setSelectionRange(newTagValue.value.length, newTagValue.value.length)
    })
  }
}

const newTagValue = ref('')

function input() {
  // TODO: format input into a group_name:tag_name format
}

function submit() {
  emit('submit', newTagValue.value)
  editing.value = false
}

const bgClass = 'bg-surface-700'
</script>

<template>
  <div
    :class="[editable ? 'cursor-pointer rounded-none' : 'rounded-full']"
    class="text-surface-400 group/tag relative z-0 flex h-fit min-h-8 w-fit min-w-16 flex-row items-center gap-1 overflow-hidden text-nowrap p-1 text-center"
    @click.self="emit('press')"
    @dblclick="dblclick"
  >
    <template v-if="editing">
      <input
        v-model="newTagValue"
        @keydown.exact.enter="submit"
        @input="input"
        @submit="submit"
        @blur="editing = false"
        @keydown.exact.escape="editing = false"
        :class="[bgClass, 'w-32 p-1 outline-none']"
        type="text"
        ref="input_el"
      />
    </template>
    <template v-else>
      <span
        v-if="removable"
        :class="[
          bgClass,
          'material-symbols-outlined absolute right-0 w-0 cursor-pointer px-1 opacity-0 hover:text-red-400 group-hover/tag:w-fit group-hover/tag:opacity-100'
        ]"
        @click.stop="emit('remove')"
      >
        cancel
      </span>
      <span v-show="group.length > 0 && inlineGroup" class="opacity-75">{{ group }}:</span
      ><span class="grow">{{ name }}</span>
      <!-- bg -->
      <div :class="[bgClass, '-z-5 absolute left-0 top-0 size-full']"></div>
    </template>
  </div>
</template>

<style scoped></style>

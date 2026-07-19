<script setup lang="ts">
import { computed } from 'vue'

const emit = defineEmits(['press', 'remove'])

interface Props {
  severity?: string
  name?: string
  removable?: boolean
  rightIcon?: string
  rounded?: boolean
  solid?: boolean
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  severity: 'secondary',
  name: '',
  removable: false,
  rightIcon: '',
  rounded: true,
  solid: true,
  disabled: false
})

const outlinedTagClass = computed(() => ({
  'border border-primary-400 bg-primary-950 text-primary-400': props.severity == 'primary',
  'border border-surface-400 bg-surface-950 text-surface-400': props.severity == 'secondary',
  'border border-emerald-400 bg-emerald-950 text-emerald-400': props.severity == 'success',
  'border border-blue-400 bg-sky-950 text-blue-400': props.severity == 'info',
  'border border-orange-400 bg-orange-950 text-orange-400': props.severity == 'warn',
  'border border-purple-400 bg-purple-950 text-purple-400': props.severity == 'help',
  'border border-rose-400 bg-rose-950 text-rose-400': props.severity == 'danger',
  'border border-white bg-black text-white': props.severity == 'contrast'
}))

const solidTagClass = computed(() => ({
  'text-black bg-primary-500': props.severity == 'primary',
  'text-black bg-surface-400': props.severity == 'secondary',
  'text-black bg-emerald-500': props.severity == 'success',
  'text-black bg-sky-500': props.severity == 'info',
  'text-black bg-orange-500': props.severity == 'warn',
  'text-black bg-purple-500': props.severity == 'help',
  'text-black bg-rose-500': props.severity == 'danger',
  'text-black bg-white': props.severity == 'contrast'
}))
</script>

<template>
  <div
    :class="[
      solid ? solidTagClass : outlinedTagClass,
      rounded ? 'rounded-full' : 'rounded',
      disabled ? 'pointer-events-none opacity-50' : ''
    ]"
    class="flex h-fit flex-row items-center gap-1 text-nowrap p-0.5 px-2 text-center"
    @click.self="emit('press')"
  >
    <i v-if="removable" class="pi pi-times-circle cursor-pointer" @click.stop="emit('remove')"></i>
    {{ name }}
    <i class="material-symbols-outlined">{{ rightIcon }}</i>
  </div>
</template>

<style scoped></style>

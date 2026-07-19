<script setup lang="ts">
const props = defineProps({
  href: { type: String, required: true }
})

function openInBrowser(): void {
  window.open(props.href, '_blank')
}
</script>

<template>
  <div class="group relative flex w-full cursor-pointer flex-row" @click="openInBrowser()">
    <span
      class="bg-surface-800 group-hover:bg-surface-500 transition-all duration-150 ease-out w-full overflow-clip overflow-ellipsis rounded p-2"
    >
      {{ href }}
    </span>
    <span
      class="group-hover:bg-surface-500 transition-all duration-150 ease-out material-symbols-outlined bg-surface-800 absolute -right-2 -top-2 select-none rounded"
    >
      open_in_new
    </span>
  </div>
</template>

<style scoped></style>

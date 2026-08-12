<script setup lang="ts">
defineProps<{
    inline?: boolean
}>()
</script>

<template>
    <div
        v-if="!inline"
        class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 flex flex-col gap-3 rounded-lg border p-3"
    >
        <div class="flex min-h-0 flex-col gap-2">
            <slot name="chips" />
        </div>
        <slot name="input" />
    </div>
    <div
        v-else
        class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-900 flex items-center gap-1 overflow-x-auto rounded-lg border px-2 py-1"
    >
        <div class="flex min-w-0 items-center gap-1">
            <slot name="chips" />
        </div>
        <div class="ml-auto flex min-w-32 shrink-0 items-center">
            <slot name="input" />
        </div>
    </div>
</template>

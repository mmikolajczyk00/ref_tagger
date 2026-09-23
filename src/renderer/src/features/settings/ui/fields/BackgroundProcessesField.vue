<script setup lang="ts">
import { useTaskStore } from '@renderer/core/stores/useTaskStore'

const taskStore = useTaskStore()

function statusIcon(status: string): string {
    if (status === 'done') return 'check_circle'
    if (status === 'error') return 'error'
    return 'hourglass_top'
}
</script>

<template>
    <div class="flex flex-col gap-3 p-6">
        <p v-if="taskStore.tasks.length === 0" class="text-surface-400 text-sm">
            No background tasks yet.
        </p>
        <div
            v-for="task in taskStore.tasks"
            :key="task.id"
            class="bg-surface-100 dark:bg-surface-900 border-surface-200 dark:border-surface-700 rounded-lg border p-3"
        >
            <div class="flex items-center gap-2">
                <span
                    class="material-symbols-outlined text-base"
                    :class="
                        task.status === 'done'
                            ? 'text-green-500'
                            : task.status === 'error'
                              ? 'text-red-500'
                              : 'text-surface-400'
                    "
                >
                    {{ statusIcon(task.status) }}
                </span>
                <span class="text-sm font-medium">{{ task.label }}</span>
                <span class="text-surface-400 ml-auto text-xs">
                    {{ Math.round(task.percentage) }}%
                </span>
            </div>
            <ProgressBar v-if="task.status === 'running'" :value="task.percentage" class="mt-2" />
            <p v-if="task.error" class="mt-2 text-xs text-red-500">{{ task.error }}</p>
            <p v-if="task.warning" class="mt-2 text-xs text-amber-500">{{ task.warning }}</p>
        </div>
    </div>
</template>

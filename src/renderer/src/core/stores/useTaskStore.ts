import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { TaskInfo } from '@shared/types/models'

interface ToastMessage {
    severity?: 'success' | 'info' | 'warn' | 'error'
    summary?: string
    detail?: string
    life?: number
}

interface ToastLike {
    add: (message: ToastMessage) => void
}

export const useTaskStore = defineStore('tasks', () => {
    const tasks = ref<TaskInfo[]>([])
    const isLocked = ref(false)

    let toast: ToastLike | null = null

    function bindToast(t: ToastLike) {
        toast = t
    }

    window.api.backup.isLocked().then((res) => {
        if (res.success) isLocked.value = res.data
    })

    window.api.backup.onTaskUpdate((task) => {
        const idx = tasks.value.findIndex((t) => t.id === task.id)
        if (idx === -1) {
            tasks.value.push(task)
        } else {
            tasks.value[idx] = task
        }

        if (task.status === 'done') {
            toast?.add({
                severity: task.warning ? 'warn' : 'success',
                summary: task.label,
                detail: task.warning,
                life: 5000
            })
        } else if (task.status === 'error') {
            toast?.add({
                severity: 'error',
                summary: task.label,
                detail: task.error,
                life: 8000
            })
        }

        isLocked.value = tasks.value.some((t) => t.status === 'running')
    })

    const hasRunningTasks = computed(() => tasks.value.some((t) => t.status === 'running'))

    return { tasks, isLocked, hasRunningTasks, bindToast }
})

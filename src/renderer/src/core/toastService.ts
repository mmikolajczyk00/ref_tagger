import ToastEventBus from 'primevue/toasteventbus'

// Bus-backed replica of PrimeVue's ToastService.install (primevue/toastservice).
// Same rationale as dialogService.ts: useToast() resolves via inject() and needs an
// active Vue component instance, so stores and non-component code use this singleton.
// It emits on the same ToastEventBus that the <Toast /> host in App.vue listens on.

export interface ToastMessage {
    severity?: 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast'
    summary?: string
    detail?: string
    life?: number
    group?: string
    [key: string]: any
}

export const toastService = {
    add(message: ToastMessage): void {
        ToastEventBus.emit('add', message)
    },
    remove(message: ToastMessage): void {
        ToastEventBus.emit('remove', message)
    },
    removeGroup(group: string): void {
        ToastEventBus.emit('remove-group', group)
    },
    removeAllGroups(): void {
        ToastEventBus.emit('remove-all-groups')
    }
}

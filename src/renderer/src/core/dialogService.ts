import DynamicDialogEventBus from 'primevue/dynamicdialogeventbus'
import { markRaw } from 'vue'

// Bus-backed replica of PrimeVue's DialogService.install (primevue/dialogservice).
// useDialog() resolves PrimeVueDialogSymbol via inject(), which requires an active Vue
// component instance, so it cannot be called from Pinia stores or commands triggered by
// global hotkeys (e.g. closing a canvas tab via ctrl+w). This module singleton emits on
// the same DynamicDialogEventBus that <DynamicDialog /> in App.vue listens on, so dialogs
// opened here render identically to ones opened via useDialog(). The instance/options
// shapes mirror DynamicDialog's expectations (see primevue/dynamicdialogoptions).

export interface DialogOpenOptions {
    data?: any
    onClose?: (options: { data?: any; type?: string }) => void
    [key: string]: any
}

export interface DialogInstance {
    content: any
    options: DialogOpenOptions
    data?: any
    close: (params?: any) => void
}

export const dialogService = {
    open(content: any, options: DialogOpenOptions = {}): DialogInstance {
        const instance: DialogInstance = {
            content: content && markRaw(content),
            options,
            data: options.data,
            close(params) {
                DynamicDialogEventBus.emit('close', { instance, params })
            }
        }
        DynamicDialogEventBus.emit('open', { instance })
        return instance
    }
}

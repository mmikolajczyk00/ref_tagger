import './assets/main.css'
import 'primeicons/primeicons.css'

import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import FocusTrap from 'primevue/focustrap'
import VueLazyload from 'vue-lazyload'

import { createApp } from 'vue'
import App from './App.vue'
import { CommandRegistry, UndoRedoManager } from './core/command_system/UndoRedoManager'
import { HotkeysManager } from './core/command_system/HotkeysManager'
import { CommandService } from './core/command_system/CommandService'
import DialogService from 'primevue/dialogservice'
import ToastService from 'primevue/toastservice'
import ConfirmationService from 'primevue/confirmationservice'
import { useCanvasStore } from './features/canvas/ts/useCanvasStore'
import { useTabStore } from './core/stores/useTabStore'
import { AppTabType } from './features/tab_system/Tabs'
import { ApplicationContext } from './core/command_system/AppContext'
import { RefSheeterPreset } from './core/theme/presets'
import { primeVuePassThrough } from './core/theme/primeVuePassThrough'

const PRIMEUI_LICENSE = import.meta.env.VITE_PRIMEUI_LICENSE_KEY

const pinia = createPinia()

const app = createApp(App)

app.use(DialogService)
app.use(ToastService)
app.use(ConfirmationService)
app.use(pinia)

app.use(VueLazyload, {
    preLoad: 1.3,
    listenEvents: [
        'scroll',
        'wheel',
        'mousewheel',
        'resize',
        'animationend',
        'transitionend',
        'touchmove'
    ],

    // optional
    observerOptions: {
        rootMargin: '0px',
        threshold: 0.1
    }
})

app.use(PrimeVue, {
    theme: {
        preset: RefSheeterPreset,
        options: {
            darkModeSelector: '.app-dark',
            cssLayer: {
                name: 'primevue',
                order: 'theme, base, primevue'
            },
            inputVariant: 'filled'
        }
    },
    pt: primeVuePassThrough,
    license: PRIMEUI_LICENSE
})

app.directive('focustrap', FocusTrap)

// command system

const globalUndoRedoManager = new UndoRedoManager()
const hotkeysManager = new HotkeysManager()
const commandRegistry = new CommandRegistry()
export const CmdService = new CommandService()

const appContext = new ApplicationContext({
    commandRegistry,
    globalUndoRedoManager,
    commandService: CmdService,
    hotkeysManager
})

CmdService.setContext(appContext)
hotkeysManager.setContext(appContext)
commandRegistry.setContext(appContext)

const canvasStore = useCanvasStore()
const tabStore = useTabStore()

CmdService.registerAllFeatures()

// provides

app.provide('commandService', CmdService)
app.provide('appContext', appContext)

// tabs demo
tabStore.openTab(AppTabType.Upload, 'Upload')
tabStore.openTab(AppTabType.Explorer, 'Explorer')
tabStore.openTab(AppTabType.TagEditor, 'Tag Editor')

// canvas demo

tabStore.setActiveTab(0)

canvasStore.fetchCanvases()

// window.api.files.getMediaFiles(1, 50).then((result) => {
//     if (result.success) {
//         canvasStore.addAndOpenNewCanvas(
//             result.data.data.map(([id]) => id),
//             'CanvasDemo'
//         )
//         // const scene = canvasStore.addAndOpenNewCanvas([], 'CanvasDemo')
//         // scene.loadFromJSON(data)

//         tabStore.setActiveTab(0)
//     }
// })

app.mount('#app')

import './assets/main.css'
import 'primeicons/primeicons.css'

import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import FocusTrap from 'primevue/focustrap'
import VueLazyload from 'vue-lazyload'

import { createApp } from 'vue'
import App from './App.vue'
import { CommandRegistry, UndoRedoManager } from './core/command_system/UndoRedoManager'
import { HotkeysManager } from './core/command_system/HotkeysManager'
import { CommandService } from './core/command_system/CommandService'
import DialogService from 'primevue/dialogservice'
import { useCanvasStore } from './features/canvas/ts/canvasStore'
import { useTabStore } from './core/stores/useTabStore'
import { AppTabType } from './features/tab_system/Tabs'
import { ApplicationContext } from './core/command_system/AppContext'
import { useTagStore } from './core/stores/useTagStore'

const PRIMEUI_LICENSE = import.meta.env.VITE_PRIMEUI_LICENSE_KEY

const pinia = createPinia()

const app = createApp(App)

app.use(DialogService)
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
        preset: Aura,
        options: {
            cssLayer: {
                name: 'primevue',
                order: 'theme, base, primevue'
            },
            inputVariant: 'filled'
        }
    },
    pt: {
        global: {
            css: `
              .p-datatable-tbody > tr > td {
               overflow: visible;
              }
              .p-datatable-flex-scrollable > .p-datatable-table-container {
                  display: flex;
                  flex-direction: column;
                  flex: 1;
                  height: 100%;
              }
            `
        },
        datatable: {
            bodycell: {
                class: 'bg-red'
            },
            tbody: {
                class: 'bg-red'
            }
        }
    },
    license: PRIMEUI_LICENSE
})

app.directive('focustrap', FocusTrap)

// command system

const globalUndoRedoManager = new UndoRedoManager()
const hotkeysManager = new HotkeysManager()
const commandRegistry = new CommandRegistry()
const commandService = new CommandService()

const appContext = new ApplicationContext({
    commandRegistry,
    globalUndoRedoManager,
    commandService,
    hotkeysManager
})

commandService.setContext(appContext)
hotkeysManager.setContext(appContext)
commandRegistry.setContext(appContext)

const canvasStore = useCanvasStore()
const tabStore = useTabStore()

tabStore.openTab(AppTabType.Upload)
tabStore.openTab(AppTabType.Explorer)
tabStore.openTab(AppTabType.Explorer)

commandService.registerAllFeatures()

// provides

app.provide('commandService', commandService)
app.provide('appContext', appContext)

app.mount('#app')

// testing

const defaultImgs = [1, 2] as number[]
setTimeout(() => {
    canvasStore.addOpenCanvas(defaultImgs)
}, 300)

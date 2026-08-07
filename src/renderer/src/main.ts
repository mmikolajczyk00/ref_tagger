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
import { useCanvasStore } from './features/canvas/ts/canvasStore'
import { useTabStore } from './core/stores/useTabStore'
import { AppTabType } from './features/tab_system/Tabs'
import { ApplicationContext } from './core/command_system/AppContext'
import { RefSheeterPreset } from './core/theme/presets'
import { primeVuePassThrough } from './core/theme/primeVuePassThrough'

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

window.api.files.getMediaFiles(1, 50).then((result) => {
    if (result.success) {
        const data = {
            elements: [
                {
                    elementId: '5b9158ed-076b-4839-b446-84fff3a009a5',
                    type: 'note',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 890.5217938598743,
                            y: 381.606554367871
                        },
                        scale: 1.7537815227090967,
                        rotation: 0,
                        width: 150,
                        height: 175.5069432688649,
                        children: {}
                    },
                    noteText: 'sample text\n\ntesting\n'
                },
                {
                    elementId: '81ca7916-f8b3-4833-902b-a45804cb45b5',
                    type: 'media',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 100,
                            y: 100
                        },
                        scale: 1,
                        rotation: 0,
                        width: 640,
                        height: 426,
                        children: {}
                    },
                    fileId: 53
                },
                {
                    elementId: 'e54fb7fb-7c03-4250-a3d9-219855099446',
                    type: 'media',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 100,
                            y: 100
                        },
                        scale: 1,
                        rotation: 0,
                        width: 640,
                        height: 427,
                        children: {}
                    },
                    fileId: 52
                },
                {
                    elementId: 'db8829cb-eca6-43d1-bc79-676dcb0d885b',
                    type: 'media',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 341.789431220545,
                            y: 695.3022547981694
                        },
                        scale: 0.49887742614417296,
                        rotation: 0,
                        width: 640,
                        height: 853,
                        children: {}
                    },
                    fileId: 50
                },
                {
                    elementId: 'ed2b33e3-4a40-4a0b-b5fc-112aa85340e4',
                    type: 'media',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 100,
                            y: 100
                        },
                        scale: 1,
                        rotation: 0,
                        width: 640,
                        height: 427,
                        children: {}
                    },
                    fileId: 51
                },
                {
                    elementId: '324822dd-f70a-44ef-8a21-e335302d5a16',
                    type: 'media',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 100,
                            y: 100
                        },
                        scale: 1,
                        rotation: 0,
                        width: 640,
                        height: 426,
                        children: {}
                    },
                    fileId: 49
                },
                {
                    elementId: 'c59a0c8f-73cb-47fb-beca-b4a36beea60b',
                    type: 'media',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 100,
                            y: 100
                        },
                        scale: 1,
                        rotation: 0,
                        width: 640,
                        height: 480,
                        children: {}
                    },
                    fileId: 48
                },
                {
                    elementId: 'bf9e53c8-20f0-4766-bd3b-514a63e92b64',
                    type: 'media',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 100,
                            y: 100
                        },
                        scale: 1,
                        rotation: 0,
                        width: 640,
                        height: 480,
                        children: {}
                    },
                    fileId: 47
                },
                {
                    elementId: 'c2b138a0-d1c4-458a-992d-6824aebef9e4',
                    type: 'media',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 1844.2189314254492,
                            y: 663.6195017416843
                        },
                        scale: 1,
                        rotation: 0,
                        width: 640,
                        height: 960,
                        children: {}
                    },
                    fileId: 46
                },
                {
                    elementId: '11844d03-4541-478c-8317-daf6ca2cb54b',
                    type: 'media',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 1262.2567831773786,
                            y: -21.728472269653707
                        },
                        scale: 1,
                        rotation: 0,
                        width: 640,
                        height: 960,
                        children: {}
                    },
                    fileId: 45
                },
                {
                    elementId: '19efbd44-8d66-4b58-b6f9-a78215ea76fd',
                    type: 'group',
                    transform: {
                        position: {
                            __type: 'Vector2',
                            x: 1212.2567831773786,
                            y: -71.72847226965371
                        },
                        scale: 1,
                        rotation: 0,
                        width: 1321.9621482480707,
                        height: 1745.347974011338,
                        children: {}
                    }
                }
            ],
            zoom: 0.35963452480552954,
            panOffset: {
                __type: 'Vector2',
                x: -289,
                y: -194
            },
            highestZIndex: 9
        }

        // canvasStore.addOpenCanvas(
        //     result.data.data.map(([id]) => id),
        //     'CanvasDemo'
        // )
        const scene = canvasStore.addOpenCanvas([], 'CanvasDemo')
        scene.loadFromJSON(data)

        tabStore.setActiveTab(3)
    }
})

app.mount('#app')

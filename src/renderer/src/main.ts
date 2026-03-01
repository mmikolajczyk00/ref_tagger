import './assets/main.css'
import 'primeicons/primeicons.css'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import FocusTrap from 'primevue/focustrap'

import { createApp, reactive, ref } from 'vue'
import App from './App.vue'
import { CommandManager, CommandRegistry } from './core/command_system/CommandManager'
import hotkeys from 'hotkeys-js'
import { HotkeysManager } from './core/command_system/HotkeysManager'
import { CommandService } from './core/command_system/CommandService'
import { TabSystem } from './features/tab_system/TabSystem'
const pinia = createPinia()

const app = createApp(App)

app.use(pinia)

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
  }
})

app.directive('focustrap', FocusTrap)

//

const commandManager = new CommandManager()
const commandRegistry = new CommandRegistry()
const hotkeysManager = new HotkeysManager()
const commandService = new CommandService(commandRegistry, commandManager, hotkeysManager)
hotkeysManager.commandService = commandService

// app.provide('commandRegistry', commandRegistry)
// app.provide('commandManager', commandManager)
app.provide('commandService', commandService)
app.provide('tabSystem', new TabSystem(commandService))

app.mount('#app')

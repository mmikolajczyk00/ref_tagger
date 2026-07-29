import { AppTab } from '@renderer/features/tab_system/Tabs'
import { UndoRedoManager, CommandRegistry } from './UndoRedoManager'
import { useTabStore } from '../stores/useTabStore'
import { CommandService } from './CommandService'
import { HotkeysManager } from './HotkeysManager'

export interface IAppServices {
    commandRegistry: CommandRegistry
    commandService: CommandService
    globalUndoRedoManager: UndoRedoManager
    hotkeysManager: HotkeysManager
}

// This is passed into your 'when' clauses and 'execute' handlers
export interface AppContext {
    // State getters
    getActiveTab(): AppTab
    getTabCount(): number

    // Global flags or UI states
    // isCommandPaletteOpen(): boolean

    // Access to core services if commands need to trigger other actions
    services: IAppServices
}

export class ApplicationContext implements AppContext {
    constructor(public services: IAppServices) {}

    getActiveTab(): AppTab {
        return useTabStore().currentActiveTab
    }

    getTabCount(): number {
        return useTabStore().openTabs.length
    }
}

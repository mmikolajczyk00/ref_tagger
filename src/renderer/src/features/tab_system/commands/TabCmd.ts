import { CommandRegistry, ICommand } from '@renderer/core/command_system/UndoRedoManager'
import { AppTabType } from '../Tabs'
import { useTabStore } from '../../../core/stores/useTabStore'

export const TAB_COMMANDS = {
    NEW_EMPTY_TAB: 'new_empty_tab',
    NEW_CANVAS_TAB: 'new_canvas_tab',
    NEW_EXPLORER_TAB: 'new_explorer_tab',
    NEW_TAGEDITOR_TAB: 'new_tageditor_tab',
    CLOSE_ACTIVE_TAB: 'close_active_tab',
    REOPEN_TAB: 'reopen_tab'
} as const

class OpenNewTabCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor(private tabType: AppTabType) {}

    execute(): void {
        const tabStore = useTabStore()
        tabStore.openTab(this.tabType)
    }
    undo(): void {}
}

class OpenNewEmptyTabCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor() {}

    execute(): void {
        const tabStore = useTabStore()
        tabStore.openTab(AppTabType.Empty)
    }
    undo(): void {}
}
class CloseActiveTabCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor() {}

    execute(): void {
        const tabStore = useTabStore()
        tabStore.closeActiveTab()
    }
    undo(): void {}
}
class ReopenTabCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor() {}

    execute(): void {
        const tabStore = useTabStore()
        tabStore.reopenTab()
    }
    undo(): void {}
}

export function registerTabCommands(registry: CommandRegistry) {
    const scope = 'all'

    registry.register({
        id: TAB_COMMANDS.NEW_EMPTY_TAB,
        label: 'New Empty Tab',
        scope,
        showInPalette: true,
        keybind: 'ctrl+t',
        when: () => true,
        create: () => new OpenNewEmptyTabCommand()
    })
    registry.register({
        id: TAB_COMMANDS.NEW_CANVAS_TAB,
        label: 'New Canvas Tab',
        scope,
        showInPalette: true,
        keybind: '',
        when: () => true,
        create: () => new OpenNewTabCommand(AppTabType.Canvas)
    })
    registry.register({
        id: TAB_COMMANDS.NEW_EXPLORER_TAB,
        label: 'New Explorer Tab',
        scope,
        showInPalette: true,
        keybind: '',
        when: () => true,
        create: () => new OpenNewTabCommand(AppTabType.Explorer)
    })

    registry.register({
        id: TAB_COMMANDS.CLOSE_ACTIVE_TAB,
        label: 'Close Active Tab',
        scope,
        showInPalette: true,
        keybind: 'ctrl+w',
        when: () => true,
        create: () => new CloseActiveTabCommand()
    })

    registry.register({
        id: TAB_COMMANDS.REOPEN_TAB,
        label: 'Reopen Tab',
        scope,
        showInPalette: true,
        keybind: 'ctrl+shift+t',
        when: () => true,
        create: () => new ReopenTabCommand()
    })
}

export { OpenNewEmptyTabCommand, OpenNewTabCommand, CloseActiveTabCommand, ReopenTabCommand }

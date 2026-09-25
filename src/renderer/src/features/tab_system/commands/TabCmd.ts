import { CommandRegistry, ICommand } from '@renderer/core/command_system/UndoRedoManager'
import { AppTabType } from '../Tabs'
import { useTabStore } from '../../../core/stores/useTabStore'

export const TAB_COMMANDS = {
    NEW_EMPTY_TAB: 'new_empty_tab',
    NEW_CANVAS_TAB: 'new_canvas_tab',
    NEW_EXPLORER_TAB: 'new_explorer_tab',
    NEW_TAG_EDITOR_TAB: 'new_tage_ditor_tab',
    CLOSE_ACTIVE_TAB: 'close_active_tab',
    REOPEN_TAB: 'reopen_tab'
} as const

class OpenNewTabCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor(private tabType: AppTabType) {}

    execute(): void {
        const tabStore = useTabStore()
        const index = tabStore.openTab(this.tabType)
        if (index !== -1) tabStore.setActiveTab(index)
    }
    undo(): void {}
}

class CloseActiveTabCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor() {}

    async execute(): Promise<void> {
        const tabStore = useTabStore()
        await tabStore.closeActiveTab()
    }
    undo(): void {}
}
class ReopenTabCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor() {}

    async execute(): Promise<void> {
        const tabStore = useTabStore()
        await tabStore.reopenTab()
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
        create: () => new OpenNewTabCommand(AppTabType.Empty)
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
        id: TAB_COMMANDS.NEW_TAG_EDITOR_TAB,
        label: 'New Tag Editor Tab',
        scope,
        showInPalette: true,
        keybind: '',
        when: () => true,
        create: () => new OpenNewTabCommand(AppTabType.TagEditor)
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

export { OpenNewTabCommand, CloseActiveTabCommand, ReopenTabCommand }

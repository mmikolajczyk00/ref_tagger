import { Command } from '@renderer/core/command_system/CommandManager'
import { HotkeysMap } from '@renderer/core/command_system/HotkeysManager'
import { AppTabType } from '../Tabs'
import { useTabStore } from '@renderer/core/stores/tabStore'

export const TAB_COMMANDS = {
    TAB_TEST: 'tab_test',
    NEW_EMPTY_TAB: 'new_empty_tab',
    NEW_CANVAS_TAB: 'new_canvas_tab',
    NEW_EXPLORER_TAB: 'new_explorer_tab',
    NEW_TAGEDITOR_TAB: 'new_tageditor_tab',
    CLOSE_ACTIVE_TAB: 'close_active_tab',
    REOPEN_TAB: 'reopen_tab'
} as const

class TabTestCommand extends Command {
    undoable: boolean = true
    execute(): void {
        console.log('execute')
    }
    undo(): void {
        console.log('undo')
    }
}

class OpenNewTabCommand extends Command {
    undoable: boolean = false

    constructor(private tabType: AppTabType) {
        super()
    }

    execute(): void {
        const tabStore = useTabStore()
        tabStore.openTab(this.tabType)
    }
    undo(): void {
        throw new Error('Cannot undo this action')
    }
}

class OpenNewEmptyTabCommand extends Command {
    undoable: boolean = false

    constructor() {
        super()
    }

    execute(): void {
        const tabStore = useTabStore()
        tabStore.openEmptyTab()
    }
    undo(): void {
        throw new Error('Cannot undo this action')
    }
}
class CloseActiveTabCommand extends Command {
    undoable: boolean = false

    constructor() {
        super()
    }

    execute(): void {
        const tabStore = useTabStore()
        tabStore.closeActiveTab()
    }
    undo(): void {
        throw new Error('Cannot undo this action')
    }
}
class ReopenTabCommand extends Command {
    undoable: boolean = false

    constructor() {
        super()
    }

    execute(): void {
        const tabStore = useTabStore()
        tabStore.reopenTab()
    }
    undo(): void {
        throw new Error('Cannot undo this action')
    }
}

export function generate_tab_commands_factories() {
    return new Map([
        [
            TAB_COMMANDS.TAB_TEST,
            {
                factory: () => {
                    return new TabTestCommand()
                },
                showInPalette: true
            }
        ],
        [
            TAB_COMMANDS.NEW_EMPTY_TAB,
            {
                factory: () => new OpenNewEmptyTabCommand(),
                showInPalette: true
            }
        ],
        [
            TAB_COMMANDS.NEW_CANVAS_TAB,
            {
                factory: () => new OpenNewTabCommand(AppTabType.Canvas),
                showInPalette: true
            }
        ],
        [
            TAB_COMMANDS.NEW_EXPLORER_TAB,
            {
                factory: () => new OpenNewTabCommand(AppTabType.Explorer),
                showInPalette: true
            }
        ],
        [
            TAB_COMMANDS.NEW_TAGEDITOR_TAB,
            {
                factory: () => new OpenNewTabCommand(AppTabType.TagEditor),
                showInPalette: true
            }
        ],
        [
            TAB_COMMANDS.CLOSE_ACTIVE_TAB,
            {
                factory: () => new CloseActiveTabCommand(),
                showInPalette: true
            }
        ],
        [
            TAB_COMMANDS.REOPEN_TAB,
            {
                factory: () => new ReopenTabCommand(),
                showInPalette: true
            }
        ]
    ])
}
export const TAB_HOTKEYS_MAP: HotkeysMap = new Map([
    ['ctrl+t', TAB_COMMANDS.NEW_EMPTY_TAB],
    ['ctrl+shift+t', TAB_COMMANDS.REOPEN_TAB],
    ['alt+w', TAB_COMMANDS.CLOSE_ACTIVE_TAB]
])

export {
    TabTestCommand,
    OpenNewEmptyTabCommand,
    OpenNewTabCommand,
    CloseActiveTabCommand,
    ReopenTabCommand
}

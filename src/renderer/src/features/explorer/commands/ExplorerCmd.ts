import { CommandRegistry, ICommand } from '@renderer/core/command_system/UndoRedoManager'
import { useExplorerStore } from '../ts/useExplorerStore'
import { Explorer } from '../ts/createExplorer'
import { useCanvasStore } from '../../canvas/ts/useCanvasStore'

export const EXPLORER_COMMANDS = {
    SELECT_ALL: 'select_all',
    DELETE_SELECTED: 'delete_selected',
    ADD_TO_NEW_CANVAS: 'add_to_new_canvas',
    VIEW_IN_GALLERIA: 'view_in_galleria'
} as const

class SelectAllCommand implements ICommand {
    undoable = false
    timestamp: number | undefined

    constructor(private explorer: Explorer) {}

    execute(): void {
        this.explorer.selection.selectedIds = new Set(this.explorer.mediaFiles.keys())
    }
    undo(): void {}
}

class DeleteSelectedCommand implements ICommand {
    undoable = true
    timestamp: number | undefined
    private deletedIds: number[] = []

    constructor(private explorer: Explorer) {
        this.deletedIds = [...this.explorer.selection.selectedIds]
    }

    execute(): void {
        console.log('TODO: DELETE_SELECTED — implement IPC api:files:delete', this.deletedIds)
    }
    undo(): void {
        console.log('TODO: undo DELETE_SELECTED')
    }
}

class AddToNewCanvasCommand implements ICommand {
    undoable = false
    timestamp: number | undefined
    private fileIds: number[] = []

    constructor(private explorer: Explorer) {
        this.fileIds = [...this.explorer.selection.selectedIds]
    }

    execute(): void {
        useCanvasStore().addAndOpenNewCanvas(this.fileIds)
    }
    undo(): void {}
}

class ViewInGalleriaCommand implements ICommand {
    undoable = false
    timestamp: number | undefined

    constructor(private explorer: Explorer) {}

    execute(): void {
        if (this.explorer.selectedItems.length === 0) return
        console.log(
            'TODO: VIEW_IN_GALLERIA — open galleria for',
            this.explorer.selectedItems.map((f) => f.id)
        )
    }
    undo(): void {}
}

export function registerExplorerCommands(commandRegistry: CommandRegistry) {
    const activeExplorer = () => useExplorerStore().getActiveExplorer
    const scope = 'explorer'

    const isActiveExplorer = () => activeExplorer() !== null
    const hasSelection = () => {
        const e = activeExplorer()
        return e !== null && e.selection.selectedIds.size > 0
    }

    commandRegistry.register({
        id: EXPLORER_COMMANDS.SELECT_ALL,
        label: 'Select All',
        scope,
        showInPalette: false,
        keybind: 'ctrl+a',
        when: isActiveExplorer,
        create: () => new SelectAllCommand(activeExplorer()!)
    })

    commandRegistry.register({
        id: EXPLORER_COMMANDS.DELETE_SELECTED,
        label: 'Delete Selected',
        scope,
        showInPalette: false,
        keybind: 'delete',
        when: hasSelection,
        create: () => new DeleteSelectedCommand(activeExplorer()!)
    })

    commandRegistry.register({
        id: EXPLORER_COMMANDS.ADD_TO_NEW_CANVAS,
        label: 'Add to New Canvas',
        scope,
        showInPalette: true,
        keybind: 'ctrl+n',
        when: hasSelection,
        create: () => new AddToNewCanvasCommand(activeExplorer()!)
    })

    commandRegistry.register({
        id: EXPLORER_COMMANDS.VIEW_IN_GALLERIA,
        label: 'View in Galleria',
        scope,
        showInPalette: false,
        keybind: 'g',
        when: hasSelection,
        create: () => new ViewInGalleriaCommand(activeExplorer()!)
    })
}

/*

- select all
- delete selected


*/

import { Command } from '@renderer/core/command_system/CommandManager'
import { HotkeysMap } from '@renderer/core/command_system/HotkeysManager'
import { ExplorerManager } from '../ts/ExplorerManager'
import { UUID } from 'crypto'
import { useCanvasStore } from '../../canvas/ts/canvasStore'

export const EXPLORER_COMMANDS = {
    SELECT_ALL: 'select_all',
    DELETE_SELECTED: 'delete_selected',
    ADD_TO_NEW_CANVAS: 'add_to_new_canvas',
    VIEW_IN_GALLERIA: 'view_in_galleria'
} as const

class ExplorerCommand extends Command {
    undoable: boolean = false
    protected selected: Array<UUID> = []

    constructor(protected explorer: ExplorerManager) {
        super()
    }

    execute(): void {}

    undo(): void {
        throw new Error('Cannot undo this action')
    }
}

class SelectAllFilesCommand extends ExplorerCommand {
    execute(): void {
        this.explorer.selectAll()
    }
}

class DeleteSelectdFilesCommand extends ExplorerCommand {
    undoable: boolean = false // needs to be changed in the future

    execute(): void {
        this.selected = this.explorer.getSelected()

        this.explorer.delete(this.selected)
    }
    undo(): void {
        throw new Error(
            "'Undo deleteSelected' -> 'Return files from archive' - not YET implemented"
        )
    }
}

class AddSelectedFilesToNewCanvasCommand extends ExplorerCommand {
    execute(): void {
        this.selected = this.explorer.getSelected()

        const canvasStore = useCanvasStore()
        canvasStore.addOpenCanvas(this.selected)
    }
}

class ViewSelectedFilesInGalleriaCommand extends ExplorerCommand {
    execute(): void {
        this.selected = this.explorer.getSelected()

        this.explorer.viewInGalleria(this.selected)
    }
}

export function generate_explorer_commands_factories(explorer: ExplorerManager) {
    return new Map([
        [
            EXPLORER_COMMANDS.SELECT_ALL,
            {
                factory: () => new SelectAllFilesCommand(explorer),
                showInPalette: true
            }
        ],
        [
            EXPLORER_COMMANDS.DELETE_SELECTED,
            {
                factory: () => new DeleteSelectdFilesCommand(explorer),
                showInPalette: true
            }
        ],
        [
            EXPLORER_COMMANDS.ADD_TO_NEW_CANVAS,
            {
                factory: () => new AddSelectedFilesToNewCanvasCommand(explorer),
                showInPalette: true
            }
        ],
        [
            EXPLORER_COMMANDS.VIEW_IN_GALLERIA,
            {
                factory: () => new ViewSelectedFilesInGalleriaCommand(explorer),
                showInPalette: true
            }
        ]
    ])
}
export const EXPLORER_HOTKEYS_MAP: HotkeysMap = new Map([
    ['ctrl+a', EXPLORER_COMMANDS.SELECT_ALL],
    ['delete', EXPLORER_COMMANDS.DELETE_SELECTED],
    ['ctrl+alt+c', EXPLORER_COMMANDS.ADD_TO_NEW_CANVAS],
    ['space', EXPLORER_COMMANDS.VIEW_IN_GALLERIA]
])

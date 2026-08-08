import { CommandRegistry } from '@renderer/core/command_system/UndoRedoManager'

export const EXPLORER_COMMANDS = {
    SELECT_ALL: 'select_all',
    DELETE_SELECTED: 'delete_selected',
    ADD_TO_NEW_CANVAS: 'add_to_new_canvas',
    VIEW_IN_GALLERIA: 'view_in_galleria'
} as const
/*

class MoveCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined

    constructor() {}

    execute(): void {}
    undo(): void {}
}
export function registerExplorerCommands(commandRegistry: CommandRegistry) {
    // const activeExplorer = () =>
    const scope = 'canvas'

    const isActiveExplorer = () => {
        const scene = activeScene()
        return scene !== undefined
    }
    const hasSelectedElements = () => {
        const scene = activeScene()
        if (!scene) return false
        return scene.selectedElements.length > 0
    }
}
*/

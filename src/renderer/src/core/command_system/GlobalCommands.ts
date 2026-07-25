import { UUID } from 'crypto'
import { CommandRegistry, ICommand } from './UndoRedoManager'
import { AppContext } from './AppContext'

class UndoCommand implements ICommand {
    undoable = false
    timestamp: number | undefined

    constructor(private context: AppContext) {}

    execute(): void {
        this.context.services.commandService.undo()
    }
    undo(): void {
        throw new Error('Method not implemented.')
    }
}

class RedoCommand implements ICommand {
    undoable = false
    timestamp: number | undefined

    constructor(private context: AppContext) {}

    execute(): void {
        this.context.services.commandService.redo()
    }
    undo(): void {}
}

class PromptAddFilesToCanvasCommand implements ICommand {
    undoable = false
    timestamp: number | undefined

    // @ts-ignore files usage will be implemented later
    constructor(private files: UUID[]) {}

    execute(): void {}
    undo(): void {}
}

export const GLOBAL_COMMANDS = {
    UNDO: 'undo',
    REDO: 'redo'
} as const

function registerGlobalCommands(registry: CommandRegistry) {
    registry.register({
        id: GLOBAL_COMMANDS.UNDO,
        label: 'Undo',
        scope: 'all',
        showInPalette: true,
        keybind: 'ctrl+z',
        when: () => true,
        create: () => new UndoCommand(registry!.context!)
    })

    registry.register({
        id: GLOBAL_COMMANDS.REDO,
        label: 'Redo',
        scope: 'all',
        showInPalette: true,
        keybind: 'ctrl+y',
        when: () => true,
        create: () => new RedoCommand(registry!.context!)
    })
}

export { RedoCommand, UndoCommand, PromptAddFilesToCanvasCommand, registerGlobalCommands }

import { UUID } from 'crypto'
import { CommandRegistry, ICommand } from './UndoRedoManager'
import { AppContext } from './AppContext'
import { useCanvasStore } from '@renderer/features/canvas/ts/useCanvasStore'

export const GLOBAL_COMMANDS = {
    UNDO: 'undo',
    REDO: 'redo',
    ADD_FILES_TO_CANVAS: 'add_files_to_canvas'
} as const

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

class AddFilesToCanvasCommand implements ICommand {
    undoable = true
    timestamp: number | undefined
    private fileCanvElementIds: string[] = []

    constructor(
        private fileIds: number[],
        private canvasId: number
    ) {}

    execute(): void {
        const store = useCanvasStore()
        const canvas = store.getCanvas(this.canvasId)
        if (!canvas) throw new Error('Canvas not found')
        this.fileCanvElementIds = canvas?.addMediaFiles(this.fileIds)
    }
    undo(): void {
        const store = useCanvasStore()
        const canvas = store.getCanvas(this.canvasId)
        if (!canvas) throw new Error('Canvas not found')
        canvas.removeMediaFiles(this.fileCanvElementIds)
    }
}

class PromptAddFilesToCanvasCommand implements ICommand {
    undoable = false
    timestamp: number | undefined

    // @ts-ignore files usage will be implemented later
    constructor(private files: UUID[]) {}

    execute(): void {}
    undo(): void {}
}

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

    registry.register({
        id: GLOBAL_COMMANDS.ADD_FILES_TO_CANVAS,
        label: 'Add Files to Canvas',
        scope: 'all',
        showInPalette: true,
        keybind: '',
        when: () => true,
        create: (_, fileIds: number[], canvasId: number) =>
            new AddFilesToCanvasCommand(fileIds, canvasId)
    })
}

export { RedoCommand, UndoCommand, PromptAddFilesToCanvasCommand, registerGlobalCommands }

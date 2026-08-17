import { AppContext } from './AppContext'
import { HotkeysManager } from './HotkeysManager'

interface ICommand {
    execute: () => void | Promise<void>
    undo: () => void | Promise<void>
    undoable: boolean
    timestamp: number | undefined
}

export interface ICommandRegistration {
    id: string
    label: string
    scope: string
    showInPalette: boolean
    keybind: string
    when: (context: AppContext, ...args: any[]) => boolean
    create: (context: AppContext, ...args: any[]) => ICommand | null
}

type CommandFactory = (...args: any[]) => ICommand

class UndoRedoManager {
    undoStack: Array<ICommand> = []
    redoStack: Array<ICommand> = []

    peekUndo(): ICommand | undefined {
        return this.undoStack[this.undoStack.length - 1]
    }
    peekRedo(): ICommand | undefined {
        return this.redoStack[this.redoStack.length - 1]
    }

    async execute(cmd: ICommand) {
        await cmd.execute()
        if (cmd.undoable) {
            this.undoStack.push(cmd)
            this.redoStack = []
        }
    }

    addWithoutExecute(cmd: ICommand) {
        this.undoStack.push(cmd)
        this.redoStack = []
    }

    async undo() {
        if (this.undoStack.length > 0) {
            const cmd = this.undoStack.pop() as ICommand
            await cmd.undo()
            this.redoStack.push(cmd)
        }
    }

    async redo() {
        if (this.redoStack.length > 0) {
            const cmd = this.redoStack.pop() as ICommand
            await cmd.execute()
            this.undoStack.push(cmd)
        }
    }
}

class CommandRegistry {
    public commands = new Map<string, ICommandRegistration>()
    public hotkeysManager: HotkeysManager | undefined
    public context: AppContext | undefined

    setContext(context: AppContext) {
        this.context = context
        this.hotkeysManager = context.services.hotkeysManager
    }

    register(registration: ICommandRegistration) {
        this.commands.set(registration.id, registration)
        this.hotkeysManager!.register(registration)
    }
    unregister(id: string) {
        if (this.commands.has(id)) {
            this.commands.delete(id)
            this.hotkeysManager?.unregister(this.commands.get(id)!)
        } else console.error('cannot unregister command, not found')
    }

    create(id: string, ...args: any[]): ICommand | null {
        if (!this.context) return null
        if (this.commands.has(id)) {
            if (!this.commands.get(id)!.when(this.context)) return null
            return this.commands.get(id)!.create(this.context, ...args)
        }

        return null
    }

    // rn just gives the names
    getShownInPalette(): Map<string, ICommandRegistration> {
        if (!this.context) return new Map()
        const result = new Map<string, ICommandRegistration>()
        for (const [id, registration] of this.commands) {
            if (
                registration.showInPalette &&
                (!registration.when || registration.when(this.context))
            ) {
                result.set(id, registration)
            }
        }
        return result
    }
}

export { UndoRedoManager, CommandRegistry }
export type { ICommand, CommandFactory }

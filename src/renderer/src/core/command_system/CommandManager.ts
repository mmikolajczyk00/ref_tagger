class Command {
    execute(): void {}
    undo(): void {}
    undoable = true
}

type CommandFactory = (...args: any[]) => Command
type CommandMap = Map<string, CommandFactory>
type CommandMapAdv = Map<string, { factory: CommandFactory; showInPalette: boolean }>
type CommandsScopeMap = Map<string, CommandMap>

class CommandManager {
    undoStack: Array<Command> = []
    redoStack: Array<Command> = []

    execute(cmd: Command) {
        cmd.execute()
        if (cmd.undoable) {
            this.undoStack.push(cmd)
            this.redoStack = []
        }
    }

    addWithoutExecute(cmd: Command) {
        this.undoStack.push(cmd)
        this.redoStack = []
    }

    undo() {
        if (this.undoStack.length > 0) {
            const cmd = this.undoStack.pop() as Command
            cmd.undo()
            this.redoStack.push(cmd)
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            const cmd = this.redoStack.pop() as Command
            cmd.execute()
            this.undoStack.push(cmd)
        }
    }
}

class CommandRegistry {
    public commands_invisible = new Map<string, CommandMap>() // arent visible in command palette
    public commands_visible = new Map<string, CommandMap>() // are shown in palette

    constructor() {}

    register(scope: string, id: string, factory: CommandFactory, showInPalette = true) {
        const cmdMap = showInPalette ? this.commands_visible : this.commands_invisible

        if (!cmdMap.get(scope)) cmdMap.set(scope, new Map())

        cmdMap.get(scope)!.set(id, factory)
    }
    unregister(scope: string, id: string, _factory: CommandFactory, showInPalette = true) {
        const cmdMap = showInPalette ? this.commands_visible : this.commands_invisible

        if (!cmdMap.get(scope)) console.log('scope not registered, cannot unregister')
        else cmdMap.get(scope)!.delete(id)
    }

    create(id: string, ...args: any[]): Command | null {
        let cmd: Command | null = null

        // first check visible
        this.commands_visible.forEach((v) => {
            const factory = v.get(id)

            if (factory) {
                cmd = factory(...args)
            }
        })

        if (cmd) return cmd

        // then check invisible
        this.commands_invisible.forEach((v) => {
            const factory = v.get(id)

            if (factory) {
                cmd = factory(...args)
            }
        })

        if (cmd) return cmd
        else throw new Error('Command not found: ' + id)
    }

    // rn just gives the names
    getShownInPalette(): Map<string, CommandMap> {
        return this.commands_visible
    }
}

export { Command, CommandManager, CommandRegistry }
export type { CommandFactory, CommandMapAdv, CommandMap, CommandsScopeMap }

class Command {
  execute(): void {}
  undo(): void {}
  undoable = true
}

type CommandFactory = (...args: any[]) => Command
type CommandMap = Map<string, { factory: CommandFactory; showInPalette: boolean }>
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
      let cmd = this.undoStack.pop() as Command
      cmd.undo()
      this.redoStack.push(cmd)
    }
  }

  redo() {
    if (this.redoStack.length > 0) {
      let cmd = this.redoStack.pop() as Command
      cmd.execute()
      this.undoStack.push(cmd)
    }
  }
}

class CommandRegistry {
  public commands = new Map<string, CommandMap>()

  constructor() {}

  register(scope: string, id: string, factory: CommandFactory, showInPalette = true) {
    // this.commands.set(id, {
    //   factory: factory,
    //   showInPalette: showInPalette
    // })
    if (!this.commands.get(scope)) this.commands.set(scope, new Map())

    this.commands.get(scope)!.set(id, { factory, showInPalette })
  }

  create(id: string, ...args: any[]): Command | null {
    let cmd: Command | null = null

    this.commands.forEach((v, k) => {
      console.log(k, v)

      let t = v.get(id)

      console.log(t)

      if (t) {
        const { factory } = t
        cmd = factory(...args)
      }
    })

    if (!cmd) throw new Error('Command not found: ' + id)
    else return cmd
  }

  // rn just gives the names
  getShownInPalette() {
    let arr: Array<string> = []
    this.commands.forEach((map, scope) => {
      let t = Array.from(map.entries())
        .filter((e) => {
          return e[1].showInPalette
        })
        .map((e) => {
          return e[0]
        })

      arr.push(...t)
    })
  }
}

export { Command, CommandManager, CommandRegistry }
export type { CommandFactory, CommandMap, CommandsScopeMap }

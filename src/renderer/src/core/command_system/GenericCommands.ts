import { Command, CommandManager } from './CommandManager'

class Undo_Command extends Command {
  undoable = false

  constructor(private cmdManager: CommandManager) {
    super()
  }

  execute(): void {
    this.cmdManager.undo()
  }
  undo(): void {
    throw new Error('Method not implemented.')
  }
}

class Redo_Command extends Command {
  undoable = false

  constructor(private cmdManager: CommandManager) {
    super()
  }

  execute(): void {
    this.cmdManager.redo()
  }
  undo(): void {
    throw new Error('Method not implemented.')
  }
}

export { Redo_Command, Undo_Command }

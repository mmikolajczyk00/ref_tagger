import { Command } from '@renderer/core/command_system/CommandManager'
import { TabSystem } from '../TabSystem'

class TabTestCommand extends Command {
  undoable: boolean = true
  execute(): void {
    console.log('execute')
  }
  undo(): void {
    console.log('undo')
  }
}

class OpenEmptyTabCommand extends Command {
  undoable: boolean = false

  constructor(private tabSystem: TabSystem) {
    super()
  }

  execute(): void {
    this.tabSystem.openEmptyTab()
  }
  undo(): void {
    console.log('Cannot undo this action')
  }
}
class CloseActiveTabCommand extends Command {
  undoable: boolean = false

  constructor(private tabSystem: TabSystem) {
    super()
  }

  execute(): void {
    this.tabSystem.closeActiveTab()
  }
  undo(): void {
    console.log('Cannot undo this action')
  }
}
class ReopenTabCommand extends Command {
  undoable: boolean = false

  constructor(private tabSystem: TabSystem) {
    super()
  }

  execute(): void {
    this.tabSystem.reopenTab()
  }
  undo(): void {
    console.log('Cannot undo this action')
  }
}

export { TabTestCommand, OpenEmptyTabCommand, CloseActiveTabCommand, ReopenTabCommand }

import { UUID } from 'crypto'
import { Command, CommandManager } from './CommandManager'
import { defineAsyncComponent } from 'vue'

class UndoCommand extends Command {
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

class RedoCommand extends Command {
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

class PromptAddFilesToCanvasCommand extends Command {
  undoable = false

  constructor(private files: UUID[]) {
    super()

    import('primevue/usedialog').then((a) => {
      const dialog = a.useDialog()
      const dynamicComponent = defineAsyncComponent(() => import('../ui/CanvasListDialog.vue'))

      dialog.open(dynamicComponent, {})
    })
  }

  execute(): void {
    throw new Error('Method not implemented.')
  }
  undo(): void {
    throw new Error('Method not implemented.')
  }
}

export { RedoCommand, UndoCommand, PromptAddFilesToCanvasCommand }

import { useTabStore } from '../stores/useTabStore'
import { CommandRegistry, UndoRedoManager } from './UndoRedoManager'
import { registerTabCommands } from '@renderer/features/tab_system/commands/TabCmd'
import { registerCanvasCommands } from '@renderer/features/canvas/commands/CanvasCmd'
import { registerGlobalCommands } from './GlobalCommands'
import { AppContext } from './AppContext'

class CommandService {
    public registry: CommandRegistry | undefined
    public globalUndoRedoMng: UndoRedoManager | undefined
    public context: AppContext | undefined

    getActiveUndoRedoMng() {
        const tabStore = useTabStore()
        return tabStore.currentActiveTab.undoRedoMng
    }

    setContext(context: AppContext) {
        this.context = context
        this.globalUndoRedoMng = context.services.globalUndoRedoManager
        this.registry = context.services.commandRegistry
    }

    execute(id: string): void {
        const cmd = this.registry!.create(id)
        if (cmd) {
            cmd.timestamp = Date.now()

            const registration = this.registry!.commands.get(id)

            if (registration?.scope === 'all') {
                this.globalUndoRedoMng!.execute(cmd)
            } else {
                this.getActiveUndoRedoMng().execute(cmd)
            }
        }
    }

    undo(): void {
        // get active cmd manager and the global one
        // then decide which one to use

        const activeUndoRedoMng = this.getActiveUndoRedoMng()
        const [activeMostRecentTimestamp, globalMostRecentTimestamp] = [
            activeUndoRedoMng.peekUndo()?.timestamp || 0,
            this.globalUndoRedoMng!.peekUndo()?.timestamp || 0
        ]
        if (activeMostRecentTimestamp > globalMostRecentTimestamp) {
            activeUndoRedoMng.undo()
        } else {
            this.globalUndoRedoMng!.undo()
        }
    }

    redo(): void {
        const activeUndoRedoMng = this.getActiveUndoRedoMng()
        const [activeMostRecentTimestamp, globalMostRecentTimestamp] = [
            activeUndoRedoMng.peekRedo()?.timestamp || 0,
            this.globalUndoRedoMng!.peekRedo()?.timestamp || 0
        ]
        if (activeMostRecentTimestamp > globalMostRecentTimestamp) {
            activeUndoRedoMng.redo()
        } else {
            this.globalUndoRedoMng!.redo()
        }
    }

    getShownInPalette() {
        return this.registry!.getShownInPalette()
    }

    registerAllFeatures() {
        registerGlobalCommands(this.registry!)
        registerTabCommands(this.registry!)
        registerCanvasCommands(this.registry!)
    }
}

export { CommandService }

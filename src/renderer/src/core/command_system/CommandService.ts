import { useTabStore } from '../stores/useTabStore'
import { CommandRegistry, UndoRedoManager } from './UndoRedoManager'
import { registerTabCommands } from '@renderer/features/tab_system/commands/TabCmd'
import { registerCanvasCommands } from '@renderer/features/canvas/commands/CanvasCmd'
import { registerExplorerCommands } from '@renderer/features/explorer/commands/ExplorerCmd'
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

    async execute(id: string, ...args: any[]): Promise<void> {
        const cmd = this.registry!.create(id, ...args)
        if (cmd) {
            cmd.timestamp = Date.now()

            const registration = this.registry!.commands.get(id)

            if (registration?.scope === 'all') {
                await this.globalUndoRedoMng!.execute(cmd)
            } else {
                await this.getActiveUndoRedoMng().execute(cmd)
            }
        }
    }

    async undo(): Promise<void> {
        const activeUndoRedoMng = this.getActiveUndoRedoMng()

        const activeMostRecentTimestamp = activeUndoRedoMng.peekUndo()?.timestamp || 0
        const globalMostRecentTimestamp = this.globalUndoRedoMng!.peekUndo()?.timestamp || 0

        if (activeMostRecentTimestamp > globalMostRecentTimestamp) {
            await activeUndoRedoMng.undo()
        } else {
            await this.globalUndoRedoMng!.undo()
        }
    }

    async redo(): Promise<void> {
        const activeUndoRedoMng = this.getActiveUndoRedoMng()
        const [activeMostRecentTimestamp, globalMostRecentTimestamp] = [
            activeUndoRedoMng.peekRedo()?.timestamp || 0,
            this.globalUndoRedoMng!.peekRedo()?.timestamp || 0
        ]
        if (activeMostRecentTimestamp > globalMostRecentTimestamp) {
            await activeUndoRedoMng.redo()
        } else {
            await this.globalUndoRedoMng!.redo()
        }
    }

    getShownInPalette() {
        return this.registry!.getShownInPalette()
    }

    registerAllFeatures() {
        registerGlobalCommands(this.registry!)
        registerTabCommands(this.registry!)
        registerCanvasCommands(this.registry!)
        registerExplorerCommands(this.registry!)
    }
}

export { CommandService }

import {
    CommandRegistry,
    CommandManager,
    CommandMap,
    CommandFactory,
    CommandMapAdv
} from './CommandManager'
import { HotkeysManager, HotkeysMap } from './HotkeysManager'
import { PromptAddFilesToCanvasCommand, RedoCommand, UndoCommand } from './GenericCommands'
import { UUID } from 'crypto'
import { useTabStore } from '../stores/tabStore'

interface Feature {
    registerFeature()
    unregisterFeature()
}

class CommandService {
    constructor(
        private registry: CommandRegistry,
        private hotkeysMng: HotkeysManager
    ) {
        // undo redo global commands

        registry.register('all', 'undo', () => {
            return new UndoCommand(this.getCurrentCmdManager())
        })
        registry.register('all', 'redo', () => {
            return new RedoCommand(this.getCurrentCmdManager())
        })
        this.hotkeysMng.bindHotkey('all', 'ctrl+z', 'undo')
        this.hotkeysMng.bindHotkey('all', 'ctrl+y', 'redo')

        registry.register('all', 'prompt_add_files_to_canvas', (files: UUID[]) => {
            return new PromptAddFilesToCanvasCommand(files)
        })
    }

    getCurrentCmdManager() {
        const tabStore = useTabStore()
        return tabStore.getActiveTab().cmdManager
    }

    execute(id: string, ...args: any[]): void {
        const cmd = this.registry.create(id, ...args)
        if (cmd) {
            if (cmd.undoable) {
                this.getCurrentCmdManager().execute(cmd)
            } else {
                cmd.execute()
            }
        }
    }

    undo(): void {
        this.getCurrentCmdManager().undo()
    }

    redo(): void {
        this.getCurrentCmdManager().redo()
    }

    registerFeature(
        scope: string,
        cmdMap: CommandMapAdv,
        hotkeysMap: HotkeysMap,
        hotkeysScope: string = ''
    ) {
        hotkeysScope = hotkeysScope == '' ? scope : hotkeysScope
        cmdMap.forEach((v, id) => {
            this.registry.register(scope, id, v.factory, v.showInPalette)
        })

        this.hotkeysMng.bindHotkeys(hotkeysScope, hotkeysMap)
    }

    unregisterFeature(
        scope: string,
        cmdMap: CommandMapAdv,
        hotkeysMap: HotkeysMap,
        hotkeysScope: string = ''
    ) {
        hotkeysScope = hotkeysScope == '' ? scope : hotkeysScope
        cmdMap.forEach((v, id) => {
            this.registry.unregister(scope, id, v.factory, v.showInPalette)
        })

        this.hotkeysMng.unbindHotkeys(hotkeysScope, hotkeysMap)
    }

    getShownInPalette() {
        return this.registry.getShownInPalette()
    }
}

export { CommandService }
export type { Feature }

import { AppContext } from './AppContext'
import { CommandService } from './CommandService'
import { ICommandRegistration } from './UndoRedoManager'

import hotkeys from 'hotkeys-js'

class HotkeysManager {
    private keybindMap = new Map<string, () => void>()
    public context: AppContext | undefined
    private commandService: CommandService | undefined

    setContext(context: AppContext) {
        this.context = context
        this.commandService = context.services.commandService
    }

    register(registration: ICommandRegistration) {
        if (!this.commandService) return
        if (registration.keybind) {
            this.keybindMap.set(registration.id, () =>
                this.commandService!.execute(registration.id)
            )
            hotkeys(registration.keybind, this.keybindMap.get(registration.id)!)
        }
    }

    unregister(registration: ICommandRegistration) {
        if (registration.keybind && this.keybindMap.has(registration.id)) {
            hotkeys.unbind(registration.keybind, this.keybindMap.get(registration.id)!)
            this.keybindMap.delete(registration.id)
        }
    }
}

export { HotkeysManager }

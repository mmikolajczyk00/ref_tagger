import { AppContext } from './AppContext'
import { CommandService } from './CommandService'
import { ICommandRegistration } from './UndoRedoManager'

import hotkeys from 'hotkeys-js'

hotkeys.filter = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null
    if (!target) return true
    const tag = target.tagName
    const isInput =
        tag === 'INPUT' &&
        !['checkbox', 'radio', 'range', 'button', 'file', 'reset', 'submit', 'color'].includes(
            (target as HTMLInputElement).type
        )
    const isEditable =
        target.isContentEditable ||
        ((isInput || tag === 'TEXTAREA' || tag === 'SELECT') &&
            !(target as HTMLInputElement).readOnly)

    if (isEditable && (event.ctrlKey || event.metaKey)) {
        const k = event.key.toLowerCase()
        if (k === 'z' || k === 'y') return true
    }
    return !isEditable
}

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

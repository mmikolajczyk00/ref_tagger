import { Command } from '@renderer/core/command_system/CommandManager'
import { HotkeysMap } from '@renderer/core/command_system/HotkeysManager'
import { CanvasManager } from '../ts/scene/CanvasManager'

export const CANVAS_COMMANDS = {
    ARRANGE: 'arrange'
} as const

class ArrangeCommand extends Command {
    undoable: boolean = true
    constructor(private rsCanvas: CanvasManager) {
        super()
    }
    execute(): void {
        console.log('execute')
    }
    undo(): void {
        console.log('undo')
    }
}

export function generate_canvas_commands_factories(rsCanvas: CanvasManager) {
    return new Map([
        [
            CANVAS_COMMANDS.ARRANGE,
            {
                factory: () => new ArrangeCommand(rsCanvas),
                showInPalette: true
            }
        ]
    ])
}
export const CANVAS_HOTKEYS_MAP: HotkeysMap = new Map([['shit+a', CANVAS_COMMANDS.ARRANGE]])

import {
    Command,
    CommandFactory,
    CommandMap,
    CommandMapAdv
} from '@renderer/core/command_system/CommandManager'
import { HotkeysMap } from '@renderer/core/command_system/HotkeysManager'
import { ref } from 'vue'

export const CMD_PALETTE_COMMANDS = {
    OPEN_COMMAND_PALETTE: 'open_command_palette'
} as const

export class CommandPaletteState {
    show = ref(false)
}

class OpenCommandPaletteCommand extends Command {
    undoable: boolean = false

    constructor(private paletteState: CommandPaletteState) {
        super()
    }

    execute(): void {
        this.paletteState.show.value = true
    }
    undo(): void {
        throw new Error('Cannot undo this action')
    }
}

export function generate_cmd_palette_commands_factories(
    paletteState: CommandPaletteState
): CommandMapAdv {
    return new Map([
        [
            CMD_PALETTE_COMMANDS.OPEN_COMMAND_PALETTE,
            {
                factory: () => new OpenCommandPaletteCommand(paletteState),
                showInPalette: true
            }
        ]
    ])
}
export const CMD_PALETTE_HOTKEYS_MAP: HotkeysMap = new Map([
    ['ctrl+space', CMD_PALETTE_COMMANDS.OPEN_COMMAND_PALETTE]
])

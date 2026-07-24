import hotkeys from 'hotkeys-js'
import { CommandService } from './CommandService'

// hotkeys (comma separated strings) : cmd_name_id
type HotkeysMap = Map<string, string>

class HotkeysManager {
    public commandService: CommandService | undefined
    bindHotkeys(scope: string, map: HotkeysMap): void {
        map.forEach((cmd_name, bind) => {
            hotkeys(bind, { scope: scope }, () => {
                this.commandService!.execute(cmd_name)
            })
        })
    }

    bindHotkey(scope: string, bind: string, cmd_name: string) {
        hotkeys(bind, { scope: scope }, () => {
            this.commandService!.execute(cmd_name)
        })
    }

    unbindHotkeys(scope: string, map: HotkeysMap) {
        map.forEach((cmd_name, bind) => {
            hotkeys.unbind(bind, scope, () => {
                this.commandService!.execute(cmd_name)
            })
        })
    }
}

export type { HotkeysMap }
export { HotkeysManager }

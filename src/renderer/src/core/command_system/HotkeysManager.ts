import hotkeys from 'hotkeys-js'
import { CommandService } from './CommandService'

// hotkeys (comma separated strings) : cmd_name_id
type HotkeysMap = Map<string, string>

class HotkeysManager {
  public commandService: CommandService | undefined
  constructor() {}
  bindHotkeys(scope: string, map: HotkeysMap): void {
    map.forEach((cmd_name, bind) => {
      hotkeys(bind, { scope: scope }, () => {
        this.commandService!.execute(cmd_name)
      })
    })
  }
}

export type { HotkeysMap }
export { HotkeysManager }

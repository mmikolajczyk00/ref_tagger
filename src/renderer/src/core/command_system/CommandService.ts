import { CommandRegistry, CommandManager, CommandMap } from './CommandManager'
import { HotkeysManager, HotkeysMap } from './HotkeysManager'

class CommandService {
  constructor(
    private registry: CommandRegistry,
    private manager: CommandManager,
    private hotkeysMng: HotkeysManager
  ) {}

  execute(id: string, ...args: any[]): void {
    const cmd = this.registry.create(id, ...args)
    if (cmd) this.manager.execute(cmd)
  }

  undo(): void {
    this.manager.undo()
  }

  redo(): void {
    this.manager.redo()
  }

  registerFeature(
    scope: string,
    cmdMap: CommandMap,
    hotkeysMap: HotkeysMap,
    hotkeysScope: string = ''
  ) {
    hotkeysScope = hotkeysScope == '' ? scope : hotkeysScope
    cmdMap.forEach((v, id) => {
      this.registry.register(scope, id, v.factory, v.showInPalette)
    })

    console.log('registering features')

    this.hotkeysMng.bindHotkeys(hotkeysScope, hotkeysMap)
  }
}

export { CommandService }

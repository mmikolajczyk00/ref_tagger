import { CommandRegistry, ICommand } from '@renderer/core/command_system/UndoRedoManager'
import CanvasScene from '../ts/scene/CanvasScene'
import { useCanvasStore } from '../ts/canvasStore'

export const CANVAS_COMMANDS = {
    ARRANGE: 'arrange'
} as const

class ArrangeCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private elements: Array<string>

    constructor(private canvasScene: CanvasScene) {
        this.elements = this.canvasScene.selectedElements.map((el) => el.elementId)
    }

    execute(): void {
        console.log('execute', this.canvasScene, this.elements)
    }
    undo(): void {
        console.log('undo')
    }
}

export function registerCanvasCommands(commandRegistry: CommandRegistry) {
    const activeScene = () => useCanvasStore().getActiveCanvas
    const scope = 'canvas'

    commandRegistry.register({
        id: CANVAS_COMMANDS.ARRANGE,
        label: 'Arrange',
        scope,
        showInPalette: true,
        keybind: 'shift+a',
        when: () => true,
        create: () => {
            const scene = activeScene()
            if (scene) return new ArrangeCommand(scene)
            console.error('There is no active scene to arrange.')
            return null
        }
    })
}

import { CommandRegistry, ICommand } from '@renderer/core/command_system/UndoRedoManager'
import CanvasScene from '../ts/scene/CanvasScene'
import { useCanvasStore } from '../ts/canvasStore'
import { AppTabType } from '@renderer/features/tab_system/Tabs'
import { GroupCanvasElement } from '../ts/scene/CanvasElements'

export const CANVAS_COMMANDS = {
    ARRANGE: 'arrange',
    GROUP: 'group'
} as const

class GroupCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private elementIds: Array<string>
    private groupId?: string

    constructor(private canvasScene: CanvasScene) {
        this.elementIds = this.canvasScene.selectedElements.map((el) => el.elementId)
    }

    execute(): void {
        console.log('group elements', this.canvasScene, this.elementIds)
        const group = this.canvasScene.addGroup()
        this.groupId = group.elementId
        const el = this.canvasScene.getElementsById(this.elementIds)
        console.log(el)
        group.addElements(el)
    }
    undo(): void {
        if (!this.groupId) return
        const group = this.canvasScene.elementsDict.get(this.groupId) as GroupCanvasElement
        group.ungroupAll()
        this.canvasScene.removeGroup(this.groupId)
    }
}

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

    const isCanvas = () => {
        const context = commandRegistry.context
        return context?.getActiveTab()?.type === AppTabType.Canvas
    }
    const hasSelectedElements = () => {
        const scene = activeScene()
        if (!scene) return false
        return scene.selectedElements.length > 0
    }

    commandRegistry.register({
        id: CANVAS_COMMANDS.ARRANGE,
        label: 'Arrange',
        scope,
        showInPalette: true,
        keybind: 'shift+a',
        when: hasSelectedElements,
        create: () => new ArrangeCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.GROUP,
        label: 'Group',
        scope,
        showInPalette: true,
        keybind: 'ctrl+g',
        when: hasSelectedElements,
        create: () => new GroupCommand(activeScene()!)
    })
}

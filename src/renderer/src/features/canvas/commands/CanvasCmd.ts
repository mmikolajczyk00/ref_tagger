import { CommandRegistry, ICommand } from '@renderer/core/command_system/UndoRedoManager'
import CanvasScene, { ZIndexChange } from '../ts/scene/CanvasScene'
import { useCanvasStore } from '../ts/useCanvasStore'
import { CanvasElement, GroupCanvasElement, NoteCanvasElement } from '../ts/scene/CanvasElements'
import { Coordinates } from '../ts/scene/CanvasUtils'
import { NoteTransformSnapshot, RotActionTransform } from '../ts/scene/TransformBox'

export const CANVAS_COMMANDS = {
    ARRANGE: 'arrange',
    GROUP: 'group',
    UNGROUP: 'ungroup',
    MOVE: 'move',
    BRING_TO_FRONT: 'bring_to_front',
    RESIZE: 'resize',
    ROTATE: 'rotate',
    SAVE: 'save',
    SAVE_AS: 'save_as',
    NOTE_RESIZE: 'note_resize',
    NOTE_TEXT_EDIT: 'note_text_edit'
} as const

class MoveCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined

    oldPositions = new Map<string, Coordinates>()
    newPositions = new Map<string, Coordinates>()
    groupId: string | undefined
    private zIndexChanges: ZIndexChange[] = []
    private prevHighestZIndex = 0

    constructor(private canvasScene: CanvasScene) {
        const { oldPositions, newPositions } = canvasScene.transformBox.moveAction.copy()
        this.oldPositions = oldPositions
        this.newPositions = newPositions

        this.groupId = canvasScene.transformBox.moveAction.groupId
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        this.newPositions.forEach((pos, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
            }
        })

        if (this.groupId) {
            const group = this.canvasScene.elementsDict.get(this.groupId) as
                GroupCanvasElement | undefined
            if (group) {
                group.addElements(this.canvasScene.getElementsById([...this.newPositions.keys()]))
                this.prevHighestZIndex = this.canvasScene.highestZIndex
                this.zIndexChanges = this.canvasScene.bringToFront(group)
            }
        }

        this.canvasScene.transformBox.notifyParents()
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        this.oldPositions.forEach((pos, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
            }
        })

        if (this.groupId) {
            this.canvasScene.revertZIndexChanges(this.zIndexChanges, this.prevHighestZIndex)
            this.zIndexChanges = []

            const group = this.canvasScene.elementsDict.get(this.groupId) as
                GroupCanvasElement | undefined
            if (group) {
                group.removeElements(
                    this.canvasScene.getElementsById([...this.newPositions.keys()])
                )
            }
        }

        this.canvasScene.transformBox.notifyParents()
    }
}

class UngroupCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private groupElementsMap: Map<string, string[]> = new Map() // partially removed, the group still exists
    private zIndexChanges: ZIndexChange[] = []
    private prevHighestZIndex = 0

    constructor(private canvasScene: CanvasScene) {
        this.canvasScene.selectedElements.forEach((el) => {
            if (el instanceof GroupCanvasElement) {
                this.groupElementsMap.set(
                    el.elementId,
                    el.children.map((c) => c.elementId)
                )
            } else {
                const parentEl = this.canvasScene.elementsDict.get(
                    el!.transform.parentTransform?.elementId ?? '-1'
                )
                if (parentEl && parentEl instanceof GroupCanvasElement) {
                    this.groupElementsMap.set(
                        parentEl.elementId,
                        this.groupElementsMap.get(parentEl.elementId)?.concat(el.elementId) ?? [
                            el.elementId
                        ]
                    )
                }
            }
        })
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        const allRemoved: CanvasElement[] = []

        this.groupElementsMap.forEach((elementIds, groupId) => {
            const group = this.canvasScene.elementsDict.get(groupId) as GroupCanvasElement

            group.removeElements(this.canvasScene.getElementsById(elementIds))
            allRemoved.push(...this.canvasScene.getElementsById(elementIds))

            if (group.children.length === 0) {
                this.canvasScene.removeGroup(groupId)
            }
        })

        if (allRemoved.length > 0) {
            this.prevHighestZIndex = this.canvasScene.highestZIndex
            this.zIndexChanges = this.canvasScene.bringSelectionToFront(allRemoved)
        }
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        this.canvasScene.revertZIndexChanges(this.zIndexChanges, this.prevHighestZIndex)
        this.zIndexChanges = []

        this.groupElementsMap.forEach((elementIds, groupId) => {
            const group = this.canvasScene.elementsDict.get(groupId) as
                GroupCanvasElement | undefined

            if (group) {
                group.addElements(this.canvasScene.getElementsById(elementIds))
            } else {
                const group = this.canvasScene.addGroup(groupId)
                group.addElements(this.canvasScene.getElementsById(elementIds))
            }
        })
    }
}

class GroupCommand implements ICommand {
    // creates and adds elements to the group
    undoable: boolean = true
    timestamp: number | undefined
    private elementIds: Array<string>
    private groupId?: string
    private zIndexChanges: ZIndexChange[] = []
    private prevHighestZIndex = 0

    constructor(private canvasScene: CanvasScene) {
        this.elementIds = this.canvasScene.selectedElements.map((el) => el.elementId)
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        const group = this.canvasScene.addGroup(this.groupId)
        this.groupId = group.elementId
        const el = this.canvasScene.getElementsById(this.elementIds)
        group.addElements(el)

        this.prevHighestZIndex = this.canvasScene.highestZIndex
        this.zIndexChanges = this.canvasScene.bringToFront(group)
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        if (!this.groupId) return

        this.canvasScene.revertZIndexChanges(this.zIndexChanges, this.prevHighestZIndex)
        this.zIndexChanges = []

        const group = this.canvasScene.elementsDict.get(this.groupId) as GroupCanvasElement
        group.ungroupAll()
        this.canvasScene.removeGroup(this.groupId)
    }
}

class SaveCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor(private canvasScene: CanvasScene) {}

    execute(): void {
        useCanvasStore().requestSave(this.canvasScene.id)
    }
    undo(): void {}
}

class SaveAsCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor(private canvasScene: CanvasScene) {}

    execute(): void {
        useCanvasStore().requestSave(this.canvasScene.id, true)
    }
    undo(): void {}
}

class ArrangeCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private elements: Array<string>

    constructor(private canvasScene: CanvasScene) {
        this.elements = this.canvasScene.selectedElements.map((el) => el.elementId)
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        console.log('execute', this.canvasScene, this.elements)
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        console.log('undo')
    }
}

class BringToFrontCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private zIndexChanges: ZIndexChange[] = []
    private prevHighestZIndex = 0

    constructor(private canvasScene: CanvasScene) {}

    execute(): void {
        if (this.canvasScene.selectedElements.length === 0) return
        this.canvasScene.unsavedChanges = true
        this.prevHighestZIndex = this.canvasScene.highestZIndex
        this.zIndexChanges = this.canvasScene.bringSelectionToFront(
            this.canvasScene.selectedElements
        )
    }
    undo(): void {
        if (this.zIndexChanges.length === 0) return
        this.canvasScene.unsavedChanges = true
        this.canvasScene.revertZIndexChanges(this.zIndexChanges, this.prevHighestZIndex)
        this.zIndexChanges = []
    }
}

class ResizeCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    oldTransforms = new Map<string, RotActionTransform>()
    newTransforms = new Map<string, RotActionTransform>()

    constructor(private canvasScene: CanvasScene) {
        const { oldTransforms, newTransforms } = canvasScene.transformBox.resizeAction.copy()
        this.oldTransforms = oldTransforms
        this.newTransforms = newTransforms
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        this.newTransforms.forEach(({ pos, rotOrScale }, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
                el.transform.setScale(rotOrScale)
            }
        })
        this.canvasScene.transformBox.notifyParents()
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        this.oldTransforms.forEach(({ pos, rotOrScale }, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
                el.transform.setScale(rotOrScale)
            }
        })
        this.canvasScene.transformBox.notifyParents()
    }
}

class RotateCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    oldTransforms = new Map<string, RotActionTransform>()
    newTransforms = new Map<string, RotActionTransform>()

    constructor(private canvasScene: CanvasScene) {
        const { oldTransforms, newTransforms } = canvasScene.transformBox.rotateAction.copy()
        this.oldTransforms = oldTransforms
        this.newTransforms = newTransforms
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        this.newTransforms.forEach(({ pos, rotOrScale }, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
                el.transform.setRotation(rotOrScale)
            }
        })
        this.canvasScene.transformBox.notifyParents()
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        this.oldTransforms.forEach(({ pos, rotOrScale }, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
                el.transform.setRotation(rotOrScale)
            }
        })
        this.canvasScene.transformBox.notifyParents()
    }
}

class NoteResizeCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private noteId: string
    private oldTransform: NoteTransformSnapshot
    private newTransform: NoteTransformSnapshot

    constructor(private canvasScene: CanvasScene) {
        const note = canvasScene.editedNote as NoteCanvasElement
        this.noteId = note.elementId
        const { oldTransform, newTransform } = note.resizeAction.copy()
        this.oldTransform = oldTransform
        this.newTransform = newTransform
    }

    execute(): void {
        const note = this.canvasScene.elementsDict.get(this.noteId) as NoteCanvasElement
        if (!note) return
        this.canvasScene.unsavedChanges = true
        const { pos, width, height, scale } = this.newTransform
        note.transform.setPos(pos)
        note.transform.width = width
        note.transform.height = height
        note.transform.scale = scale
    }
    undo(): void {
        const note = this.canvasScene.elementsDict.get(this.noteId) as NoteCanvasElement
        if (!note) return
        this.canvasScene.unsavedChanges = true
        const { pos, width, height, scale } = this.oldTransform
        note.transform.setPos(pos)
        note.transform.width = width
        note.transform.height = height
        note.transform.scale = scale
    }
}

class NoteTextEditCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private noteId: string
    private oldText: string
    private newText: string

    constructor(private canvasScene: CanvasScene) {
        const note = canvasScene.editedNote as NoteCanvasElement
        this.noteId = note.elementId
        this.oldText = note.textEditOldText
        this.newText = note.noteText
    }

    execute(): void {
        const note = this.canvasScene.elementsDict.get(this.noteId) as NoteCanvasElement | undefined
        if (!note) return
        this.canvasScene.unsavedChanges = true
        note.noteText = this.newText
    }
    undo(): void {
        const note = this.canvasScene.elementsDict.get(this.noteId) as NoteCanvasElement | undefined
        if (!note) return
        this.canvasScene.unsavedChanges = true
        note.noteText = this.oldText
    }
}

export function registerCanvasCommands(commandRegistry: CommandRegistry) {
    const activeScene = () => useCanvasStore().getActiveCanvas as CanvasScene
    const scope = 'canvas'

    const isActiveCanvas = () => {
        const scene = activeScene()
        return scene !== undefined
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

    commandRegistry.register({
        id: CANVAS_COMMANDS.UNGROUP,
        label: 'Ungroup',
        scope,
        showInPalette: true,
        keybind: 'ctrl+shift+g',
        when: hasSelectedElements,
        create: () => new UngroupCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.MOVE,
        label: 'Move',
        scope,
        showInPalette: false,
        keybind: '',
        when: hasSelectedElements,
        create: () => new MoveCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.ROTATE,
        label: 'Rotate',
        scope,
        showInPalette: false,
        keybind: '',
        when: hasSelectedElements,
        create: () => new RotateCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.RESIZE,
        label: 'Resize',
        scope,
        showInPalette: false,
        keybind: '',
        when: hasSelectedElements,
        create: () => new ResizeCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.SAVE,
        label: 'Save Canvas',
        scope,
        showInPalette: true,
        keybind: 'ctrl+s',
        when: isActiveCanvas,
        create: () => new SaveCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.SAVE_AS,
        label: 'Save Canvas As',
        scope,
        showInPalette: true,
        keybind: 'ctrl+shift+s',
        when: isActiveCanvas,
        create: () => new SaveAsCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.NOTE_RESIZE,
        label: 'Note Resize',
        scope,
        showInPalette: false,
        keybind: '',
        when: () => {
            const scene = activeScene()
            if (!scene) return false
            return scene.editedNote instanceof NoteCanvasElement
        },
        create: () => new NoteResizeCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.NOTE_TEXT_EDIT,
        label: 'Edit Note Text',
        scope,
        showInPalette: false,
        keybind: '',
        when: () => {
            const scene = activeScene()
            if (!scene) return false
            return scene.editedNote instanceof NoteCanvasElement
        },
        create: () => new NoteTextEditCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.BRING_TO_FRONT,
        label: 'Bring to Front',
        scope,
        showInPalette: false,
        keybind: '',
        when: hasSelectedElements,
        create: () => new BringToFrontCommand(activeScene()!)
    })
}

import type CanvasScene from './CanvasScene'
import {
    Coordinates,
    doPolygonsIntersect,
    calculateBBoxByChildren as calculateBBoxWithChildren,
    Rectangle,
    Transform,
    Vector2
} from './CanvasUtils'
import { CARDINAL_DIRECTIONS, NoteResizeAction } from './TransformBox'
import { CANVAS_COMMANDS } from '../../commands/CanvasCmd'
import { CmdService } from '@renderer/main'

export abstract class CanvasElement {
    transform: Transform
    canvas: CanvasScene
    elementId: string
    htmlElement: HTMLDivElement | undefined
    mouseDown = false
    locked = false
    isGrabbed = false
    isSelected = false

    constructor(
        canvas: CanvasScene,
        parentTransform: Transform,
        elementId: string = crypto.randomUUID()
    ) {
        this.elementId = elementId
        this.canvas = canvas
        this.transform = new Transform(canvas, parentTransform, this.elementId)
    }

    setHtmlElement(htmlElement: HTMLDivElement) {
        this.htmlElement = htmlElement
        this.canvas.htmlElement = htmlElement
    }

    getHtmlBoundingBox(): Rectangle {
        const rect = this.htmlElement!.getBoundingClientRect()
        const pos = this.transform.position
        const box = {
            left: pos.x,
            bottom: pos.y,
            right: rect.width + pos.x,
            top: rect.height + pos.y
        }
        return box
    }

    isOverlapping(other: Array<Vector2>) {
        // let rect1 = this.getHtmlBoundingBox();
        const polygon = [
            this.transform.getBottomLeft(),
            this.transform.getBottomRight(),
            this.transform.getTopRight(),
            this.transform.getTopLeft()
        ]

        return doPolygonsIntersect(polygon, other)
    }

    select() {
        this.canvas.setSelection(this)
    }

    getOrGetSelectableAncestor() {
        // if im selectable, return me, otherwise return first selectable parent

        if (this.canvas.isSelectable(this)) return this
        const parentId = this.transform.parentTransform?.elementId
        if (!parentId || parentId === 'root') return null
        return this.canvas.elementsDict.get(parentId)?.getOrGetSelectableAncestor()
    }
}

export class GroupCanvasElement extends CanvasElement {
    childrenMap: Map<string, CanvasElement> = new Map()
    static MIN_SIZE = 100
    static PADDING = 50
    expanded: boolean = false

    constructor(
        canvas: CanvasScene,
        parentTransform: Transform,
        position?: Coordinates,
        elementId?: string
    ) {
        super(canvas, parentTransform, elementId)
        if (position) this.transform.position.setV(position)
    }

    get children() {
        return [...this.childrenMap.values()]
    }

    addElements(children: CanvasElement[]) {
        const newChildren: string[] = []
        children.forEach((c) => {
            if (!this.childrenMap.has(c.elementId) && !this.createsCycle(c)) {
                this.removeFromPreviousParent(c)

                this.childrenMap.set(c.elementId, c)
                this.transform.children.push(c.transform)
                c.transform.parentTransform = this.transform
                console.log('dropping into', this.elementId, c.elementId)

                newChildren.push(c.elementId)
            }
        })
        if (newChildren.length > 0) this.updateBoundingBox()
    }

    private removeFromPreviousParent(child: CanvasElement) {
        const oldParentId = child.transform.parentTransform?.elementId
        const oldParent = this.canvas.elementsDict.get(oldParentId!)

        if (oldParent instanceof GroupCanvasElement) {
            oldParent.removeElement(child)
        }
    }

    private createsCycle(child: CanvasElement): boolean {
        if (child.elementId === this.elementId) return true

        if (child instanceof GroupCanvasElement) {
            return child.children.some((c) => this.createsCycle(c))
        }
        return false
    }

    addElement(child: CanvasElement) {
        if (!this.childrenMap.has(child.elementId)) {
            if (this.createsCycle(child)) return

            this.removeFromPreviousParent(child)
            this.childrenMap.set(child.elementId, child)
            this.transform.children.push(child.transform)
            child.transform.parentTransform = this.transform
            console.log('dropping into', this.elementId, child.elementId)
            this.updateBoundingBox()
        }
    }

    removeElement(child: CanvasElement) {
        if (this.childrenMap.has(child.elementId)) {
            this.childrenMap.delete(child.elementId)
            this.transform.children = this.transform.children.filter(
                (t) => t.elementId !== child.transform.elementId
            )
            child.transform.parentTransform = this.transform.parentTransform
            this.updateBoundingBox()
        }
    }

    removeElements(children: Array<CanvasElement>) {
        let update = false

        children.forEach((c) => {
            if (this.childrenMap.has(c.elementId)) {
                this.childrenMap.delete(c.elementId)
                this.transform.children = this.transform.children.filter(
                    (t) => t.elementId !== c.transform.elementId
                )
                c.transform.parentTransform = this.transform.parentTransform
                update = true
            }
        })

        if (update) this.updateBoundingBox()
    }

    updateBoundingBox() {
        if (this.children.length === 0) return
        const oldPos = this.transform.position
        const oldRotation = this.transform.rotation
        this.transform.setRotation(0)

        const bbox = calculateBBoxWithChildren(this.children)
        const newPos = new Vector2(
            bbox.left - GroupCanvasElement.PADDING,
            bbox.top - GroupCanvasElement.PADDING
        )
        console.log('diff', newPos.subtracted(oldPos))
        console.log('rotated diff', newPos.subtracted(oldPos).rotated(oldRotation))
        const rotatedDiff = newPos.subtracted(oldPos).rotated(oldRotation)

        this.transform.width =
            Math.max(
                GroupCanvasElement.MIN_SIZE,
                bbox.right - bbox.left + GroupCanvasElement.PADDING * 2
            ) / this.transform.scale
        this.transform.height =
            Math.max(
                GroupCanvasElement.MIN_SIZE,
                bbox.bottom - bbox.top + GroupCanvasElement.PADDING * 2
            ) / this.transform.scale

        this.transform.setRotation(oldRotation)
        this.transform.position.add(rotatedDiff)
    }

    ungroupAll() {
        this.removeElements(this.children)
    }
}

export class MediaFileCanvasElement extends CanvasElement {
    constructor(
        canvas: CanvasScene,
        parentTransform: Transform,
        public fileId: number
    ) {
        super(canvas, parentTransform)
    }
}

export class NoteCanvasElement extends CanvasElement {
    noteText: string
    editMode: boolean = false
    resizeAction: NoteResizeAction = new NoteResizeAction()
    MIN_SIZE = 50
    textAreaMinSize: Vector2 = new Vector2(this.MIN_SIZE, this.MIN_SIZE)

    private resizeStartMouse = new Vector2()
    private resizeStartWidth = 0
    private resizeStartHeight = 0
    private resizeStartPos = new Vector2()
    private resizeAxisMask: Coordinates = { x: 0, y: 0 }
    private resizeActive = false

    constructor(canvas: CanvasScene, parentTransform: Transform, noteText: string) {
        super(canvas, parentTransform)
        this.noteText = noteText
        this.transform.width = this.MIN_SIZE * 3
        this.transform.height = this.MIN_SIZE
    }

    beginResize(axis: CARDINAL_DIRECTIONS, mousePos: Vector2) {
        this.resizeAction.saveOld(this)
        this.resizeStartMouse.setV(mousePos)
        this.resizeStartWidth = this.transform.width
        this.resizeStartHeight = this.transform.height
        this.resizeStartPos.setV(this.transform.position)
        this.resizeActive = true
        this.resizeAxisMask = this.getResizeAxisMask(axis)
    }

    updateResize(mousePos: Vector2) {
        if (!this.resizeActive) return

        const scale = this.transform.scale
        const rot = this.transform.rotation
        const cos = Math.cos(rot)
        const sin = Math.sin(rot)

        const worldDx = mousePos.x - this.resizeStartMouse.x
        const worldDy = mousePos.y - this.resizeStartMouse.y

        const localDx = (worldDx * cos + worldDy * sin) / scale
        const localDy = (worldDx * -sin + worldDy * cos) / scale

        let newWidth = this.resizeStartWidth
        let newHeight = this.resizeStartHeight

        this.transform.position.setV(this.resizeStartPos)

        if (this.resizeAxisMask.x !== 0) {
            const sign = Math.sign(this.resizeAxisMask.x)
            newWidth = Math.max(this.MIN_SIZE, this.resizeStartWidth + localDx * sign)
            if (sign < 0) {
                const widthDelta = (newWidth - this.resizeStartWidth) * scale
                this.transform.position.x -= cos * widthDelta
                this.transform.position.y -= sin * widthDelta
            }
        }
        if (this.resizeAxisMask.y !== 0) {
            const sign = Math.sign(this.resizeAxisMask.y)
            newHeight = Math.max(this.MIN_SIZE, this.resizeStartHeight + localDy * sign)
            if (sign < 0) {
                const heightDelta = (newHeight - this.resizeStartHeight) * scale
                this.transform.position.x += sin * heightDelta
                this.transform.position.y -= cos * heightDelta
            }
        }

        this.transform.width = newWidth
        this.transform.height = newHeight
    }

    endResize() {
        if (!this.resizeActive) return
        this.resizeActive = false
        this.resizeAction.saveNew(this)
        CmdService.execute(CANVAS_COMMANDS.NOTE_RESIZE)
    }

    enterEditMode() {
        this.editMode = true
        this.canvas.clearSelection()
        this.canvas.editedNote = this
    }

    exitEditMode() {
        this.editMode = false
        this.canvas.editedNote = undefined
    }

    private getResizeAxisMask(axis: CARDINAL_DIRECTIONS): Coordinates {
        switch (axis) {
            case CARDINAL_DIRECTIONS.n:
                return { x: 0, y: -1 }
            case CARDINAL_DIRECTIONS.e:
                return { x: 1, y: 0 }
            case CARDINAL_DIRECTIONS.s:
                return { x: 0, y: 1 }
            case CARDINAL_DIRECTIONS.w:
                return { x: -1, y: 0 }
            case CARDINAL_DIRECTIONS.nw:
                return { x: -1, y: -1 }
            case CARDINAL_DIRECTIONS.ne:
                return { x: 1, y: -1 }
            case CARDINAL_DIRECTIONS.se:
                return { x: 1, y: 1 }
            case CARDINAL_DIRECTIONS.sw:
                return { x: -1, y: 1 }
            default:
                return { x: 0, y: 0 }
        }
    }
}

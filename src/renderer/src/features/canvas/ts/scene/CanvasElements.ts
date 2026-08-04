import type CanvasScene from './CanvasScene'
import {
    Coordinates,
    doPolygonsIntersect,
    calculateBBoxByChildren as calculateBBoxWithChildren,
    Rectangle,
    Transform,
    Vector2
} from './CanvasUtils'
import { CARDINAL_DIRECTIONS } from './TransformBox'

export abstract class CanvasElement {
    transform: Transform
    canvas: CanvasScene
    elementId: string
    htmlElement: HTMLDivElement | undefined
    mouseDown = false
    locked = false
    isGrabbed = false
    isSelected = false

    constructor(canvas: CanvasScene, parentTransform: Transform) {
        this.elementId = crypto.randomUUID()
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
}

export class GroupCanvasElement extends CanvasElement {
    childrenMap: Map<string, CanvasElement> = new Map()
    static MIN_SIZE = 100
    static PADDING = 50

    constructor(canvas: CanvasScene, parentTransform: Transform, position?: Coordinates) {
        super(canvas, parentTransform)
        if (position) this.transform.position.setV(position)
    }

    get children() {
        return [...this.childrenMap.values()]
    }

    addElements(children: CanvasElement[]) {
        const newChildren: string[] = []
        children.forEach((c) => {
            if (!this.childrenMap.has(c.elementId)) {
                this.childrenMap.set(c.elementId, c)
                this.transform.children.push(c.transform)
                c.transform.parentTransform = this.transform
                newChildren.push(c.elementId)
            }
        })
        if (newChildren.length > 0) this.updateBoundingBox()
        newChildren.forEach((c) => this.localizeTransform(this.childrenMap.get(c)!.transform))
    }

    addElement(child: CanvasElement) {
        if (!this.childrenMap.has(child.elementId)) {
            this.childrenMap.set(child.elementId, child)
            this.transform.children.push(child.transform)
            child.transform.parentTransform = this.transform
            this.updateBoundingBox()
        }
    }

    localizeTransform(transform: Transform) {
        return
        console.log('before', transform.position, this.transform.position)
        transform.move(this.transform.position.multiplied(-1))
        console.log('after', transform.position, this.transform.position)
    }
    unlocalizeTransform(transform: Transform) {
        return
        console.log('before', transform.position, this.transform.position)
        transform.move(this.transform.position.clone())
        console.log('after', transform.position, this.transform.position)
    }

    removeElement(child: CanvasElement) {
        if (this.childrenMap.has(child.elementId)) {
            this.childrenMap.delete(child.elementId)
            this.transform.children = this.transform.children.filter(
                (t) => t.elementId !== child.transform.elementId
            )
            child.transform.parentTransform = this.transform.parentTransform
            this.unlocalizeTransform(child.transform)
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
                this.unlocalizeTransform(c.transform)
            }
        })

        if (update) this.updateBoundingBox()
    }

    updateBoundingBox() {
        if (this.children.length === 0) return

        const oldRotation = this.transform.rotation
        this.transform.setRotation(0)

        const bbox = calculateBBoxWithChildren(this.children)
        this.transform.position.x = bbox.left - GroupCanvasElement.PADDING
        this.transform.position.y = bbox.top - GroupCanvasElement.PADDING
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
    textAreaHtmlEl: HTMLTextAreaElement | undefined = undefined
    textContainerHtmlEl: HTMLPreElement | undefined = undefined
    textAreaMinSize: Vector2 = new Vector2(0, 0)
    resizing: boolean = false
    resizeAxis: CARDINAL_DIRECTIONS = CARDINAL_DIRECTIONS.none
    rotationBackup = 0

    currentMousePos: Vector2 = new Vector2(0, 0)
    startMousePos: Vector2 = new Vector2(0, 0)
    sizeOnStart: Vector2 = new Vector2(0, 0)
    posOnStart: Vector2 = new Vector2(0, 0)

    constructor(canvas: CanvasScene, parentTransform: Transform, noteText: string) {
        super(canvas, parentTransform)
        this.noteText = noteText
    }

    setHtmlElement(htmlElement: HTMLDivElement) {
        super.setHtmlElement(htmlElement)
    }

    setTextContainer(textContainerHtmlEl: HTMLPreElement) {
        this.textContainerHtmlEl = textContainerHtmlEl

        requestAnimationFrame(() => {
            this.fitTextContainerToContent()
        })
    }

    fitTextContainerToContent() {
        this.transform.width = this.textContainerHtmlEl!.offsetWidth
        this.transform.height = this.textContainerHtmlEl!.offsetHeight

        this.textAreaMinSize.x = Math.max(this.transform.width, this.textAreaMinSize.x)
        this.textAreaMinSize.y = Math.max(this.transform.height, this.textAreaMinSize.y)
    }

    fitTextAreaToContent() {
        if (typeof this.textAreaHtmlEl == 'undefined') return

        this.transform.width = this.textAreaHtmlEl!.scrollWidth / this.transform.scale
        this.transform.height = this.textAreaHtmlEl!.scrollHeight / this.transform.scale
    }

    setEditMode(onOff: boolean) {
        this.canvas.editedNote = onOff ? this : undefined
        this.editMode = onOff
        this.locked = onOff //temporalily lock movement

        if (typeof this.textAreaHtmlEl == 'undefined') return

        requestAnimationFrame(() => {
            if (onOff) {
                this.fitTextAreaToContent()
                this.rotationBackup = this.transform.rotation
                this.transform.rotation = 0
            } else {
                this.fitTextContainerToContent()
                this.transform.rotation = this.rotationBackup
            }

            this.textAreaMinSize.x = Math.max(this.transform.width, this.textAreaMinSize.x)
            this.textAreaMinSize.y = Math.max(this.transform.height, this.textAreaMinSize.y)
            this.transform.width = this.textAreaMinSize.x
            this.transform.height = this.textAreaMinSize.y
        })
        // this.canvas.toggleTransformBox(!onOff);
    }

    onDoubleClick() {
        this.setEditMode(true)
    }

    getResizePivotFromAxisArea() {
        let pivot = new Vector2(0, 0)
        if (this.resizeAxis == CARDINAL_DIRECTIONS.n) {
            // pick the pivot point, and calculate scale difference
            pivot = this.transform.getCenterBottom()
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.e) {
            pivot = this.transform.getCenterLeft()
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.s) {
            pivot = this.transform.getCenterTop()
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.w) {
            pivot = this.transform.getCenterRight()
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.ne) {
            pivot = this.transform.getBottomLeft()
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.nw) {
            pivot = this.transform.getBottomRight()
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.se) {
            pivot = this.transform.getTopLeft()
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.sw) {
            pivot = this.transform.getTopRight()
        }
        return pivot
    }

    getResizeAxisMaskFromAxisArea() {
        const axisMask = new Vector2(1, 1)
        if (this.resizeAxis == CARDINAL_DIRECTIONS.n) {
            // pick the pivot point, and calculate scale difference
            axisMask.x = 0
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.e) {
            axisMask.y = 0
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.s) {
            axisMask.x = 0
        } else if (this.resizeAxis == CARDINAL_DIRECTIONS.w) {
            axisMask.y = 0
        }
        return axisMask
    }
}

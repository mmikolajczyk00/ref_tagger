import type CanvasScene from './CanvasScene'
import { UUID } from 'crypto'
import { doPolygonsIntersect, Rectangle, Transform, Vector2 } from './canvas_utils'
import { CARDINAL_DIRECTIONS } from './TransformBox'

abstract class CanvasElement {
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
        this.canvas.htmlElement
    }

    getHtmlBoundingBox(): Rectangle {
        let rect = this.htmlElement!.getBoundingClientRect()
        let box = {
            left: this.transform.position.x,
            bottom: this.transform.position.y,
            right: rect.width + this.transform.position.x,
            top: rect.height + this.transform.position.y
        }
        return box
    }

    isOverlapping(other: Array<Vector2>) {
        // let rect1 = this.getHtmlBoundingBox();
        let polygon = [
            this.transform.getBottomLeft(),
            this.transform.getBottomRight(),
            this.transform.getTopRight(),
            this.transform.getTopLeft()
        ]

        return doPolygonsIntersect(polygon, other)
    }

    select(e: MouseEvent) {
        this.canvas.setSelection(this)
    }
}

class ImageCanvasElement extends CanvasElement {
    constructor(
        canvas: CanvasScene,
        parentTransform: Transform,
        public fileId: number
    ) {
        super(canvas, parentTransform)
    }
}

class NoteCanvasElement extends CanvasElement {
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

    setResizeButtons(resizeBtns: CARDINAL_DIRECTIONS) {
        // for (let i = 0; i < 8; i++) {
        //     const axis = CARDINAL_DIRECTIONS[i] as keyof CARDINAL_DIRECTIONS
        //     resizeBtns[axis].addEventListener('mousedown', () => {
        //         this.resizing = true
        //         this.resizeAxis = i
        //         this.startMousePos = this.canvas.mouseEventsHandler.mouseWorldPos
        //         this.sizeOnStart = new Vector2(this.transform.width, this.transform.height)
        //         this.posOnStart = this.transform.position.clone()
        //     })
        // }
        // document.addEventListener('mousemove', (e) => {
        //     if (!this.resizing) return
        //     this.currentMousePos = this.canvas.mouseEventsHandler.mouseWorldPos
        //     let delta = this.startMousePos.clone().subtract(this.currentMousePos)
        //     let pivot = this.getResizePivotFromAxisArea()
        //     let axisMask = this.getResizeAxisMaskFromAxisArea()
        //     delta.multiplyByVector(axisMask)
        //     let oldPos = this.posOnStart.clone()
        //     let posToPivot = pivot.clone().subtract(oldPos)
        //     let startMouseToPivot = pivot.clone().subtract(this.startMousePos)
        //     let modifier = new Vector2(
        //         delta.x == 0 ? 1 : delta.x / startMouseToPivot.x + 1,
        //         delta.y == 0 ? 1 : delta.y / startMouseToPivot.y + 1
        //     )
        //     let absModifier = Math.abs(modifier.x) > Math.abs(modifier.y) ? modifier.x : modifier.y
        //     let posToPivotScaled = posToPivot
        //         .clone()
        //         .multiplyByVector(new Vector2(modifier.x - 1, modifier.y - 1))
        //     this.transform.setPos(oldPos.clone().subtract(posToPivotScaled))
        //     this.textAreaMinSize.x = this.sizeOnStart.x * modifier.x
        //     this.textAreaMinSize.y = this.sizeOnStart.y * modifier.y
        //     this.transform.width = this.sizeOnStart.x * modifier.x
        //     this.transform.height = this.sizeOnStart.y * modifier.y
        //     // console.log(
        //     //         `m ${modifier.x}  ${modifier.y} .d ${delta.x} ${delta.y} .sm ${startMouseToPivot.x} ${startMouseToPivot.y} .pstp ${posToPivot.x} ${posToPivot.y} .psts ${posToPivotScaled.x} ${posToPivotScaled.y}`
        //     // );
        //     console.log(
        //         `m ${modifier.x}  ${modifier.y} .t ${this.transform.width} ${this.transform.height} .size ${this.sizeOnStart.x} ${this.sizeOnStart.y}`
        //     )
        // })
        // document.addEventListener('mouseup', (e) => {
        //     this.resizing = false
        // })
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

    onDoubleClick(e: MouseEvent) {
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
        let axisMask = new Vector2(1, 1)
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

// removes by looking at their ids
function removeCanvElFromArray(array: Array<CanvasElement>, el: CanvasElement) {
    for (let i = 0; i < array.length; i++) {
        const t = array[i]
        if (t.elementId == el.elementId) {
            array.splice(i, 0)
            return
        }
    }
}

// pushes without duplicates
function pushCanvElToArray(array: Array<CanvasElement>, el: CanvasElement) {
    if (array.some((e) => e.elementId == el.elementId)) return
    array.push(el)
}

export {
    CanvasElement,
    ImageCanvasElement,
    NoteCanvasElement,
    removeCanvElFromArray,
    pushCanvElToArray
}

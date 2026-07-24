import {
    CanvasElement,
    ImageCanvasElement,
    NoteCanvasElement,
    removeCanvElFromArray,
    pushCanvElToArray
} from './CanvasElements'
import SelectionBox from './SelectionBox'
import { TransformBox } from './TransformBox'

import potpack from 'potpack'
import { Coordinates, Transform, Vector2 } from './canvas_utils'

export default class CanvasScene {
    id: number
    transform: Transform
    zoom: number = 1
    htmlElement: HTMLDivElement | undefined
    selectedElements: Array<CanvasElement> = []
    isGrabbed: boolean = false
    panOffset = new Vector2(0, 0)

    imageElements: Array<ImageCanvasElement> = []
    noteElements: Array<NoteCanvasElement> = []
    elementCount: number = 0

    transformBox: TransformBox
    selectionBox: SelectionBox

    highestZIndex: number = 0

    editedNote: NoteCanvasElement | undefined

    elementsDict: Map<string, CanvasElement> = new Map()

    mousePos = new Vector2(0, 0)

    constructor(id: number) {
        this.id = id
        this.transform = new Transform(this, null, 'root')

        this.transformBox = new TransformBox(this)
        this.selectionBox = new SelectionBox(this)
    }

    getTransform() {
        return this.transform
    }

    addImage(fileId: number, position?: Coordinates) {
        const imageEl = new ImageCanvasElement(this, this.transform, fileId)

        if (typeof position !== 'undefined') imageEl.transform.setPos(position)

        this.imageElements.push(imageEl)
        this.elementsDict.set(imageEl.elementId, imageEl)
        // this.transform.addChild(imageEl.transform);
        this.elementCount++
    }
    addImages(files: number[], position?: Coordinates) {
        files.forEach((f) => {
            this.addImage(f, position)
        })
    }
    incrementZIndex() {
        this.highestZIndex++
    }

    addNote(text: string, position?: Vector2) {
        const noteEl = new NoteCanvasElement(this, this.transform, text)

        this.incrementZIndex()

        if (typeof position !== 'undefined') noteEl.transform.position = position

        this.noteElements.push(noteEl)
        this.elementsDict.set(noteEl.elementId, noteEl)
        // this.transform.addChild(noteEl.transform);
        this.elementCount++
    }

    selectElement(element: CanvasElement, shiftPressed: boolean) {
        const index = this.selectedElements.findIndex((el) => el.elementId === element.elementId)
        const isSelected = element.isSelected

        console.log('this.selectedElements.length ', this.selectedElements.length)

        if (shiftPressed) {
            if (isSelected) {
                this.selectedElements.splice(index, 1)
                element.isSelected = false
            } else {
                this.selectedElements.push(element)
                element.isSelected = true

                this.highestZIndex++
                element.transform.zIndex = this.highestZIndex
            }
        } else {
            if (isSelected) {
                if (this.selectedElements.length > 1) {
                    this.clearSelection()
                    this.selectedElements = [element]
                    element.isSelected = true

                    this.highestZIndex++
                    element.transform.zIndex = this.highestZIndex
                } else {
                    this.clearSelection()
                }
            } else {
                this.clearSelection()
                this.selectedElements = [element]
                element.isSelected = true

                this.highestZIndex++
                element.transform.zIndex = this.highestZIndex
            }
        }

        this.transformBox.onSelectionChange()
    }

    setSelection(el: CanvasElement | Array<CanvasElement>) {
        this.clearSelection()

        if (Array.isArray(el)) {
            const array = el as Array<CanvasElement>
            this.selectedElements = array
            this.selectedElements.forEach((element) => {
                element.isSelected = true
            })
        } else {
            el = el as CanvasElement
            this.selectedElements = [el]
            el.isSelected = true

            this.incrementZIndex()
        }

        this.onSelectionChange()
    }

    clearSelection() {
        for (let i = 0; i < this.selectedElements.length; i++) {
            const element = this.selectedElements[i]
            element.isSelected = false
        }

        this.selectedElements = []

        this.onSelectionChange()
    }

    appendSelection(el: CanvasElement | Array<CanvasElement>) {
        //array of elements
        if (Array.isArray(el)) {
            const array = el as Array<CanvasElement>
            array.forEach((i) => {
                this.appendSelection(i)
            })
        }

        //one element
        else {
            el = el as CanvasElement

            if (!el.isSelected) pushCanvElToArray(this.selectedElements, el)
            el.isSelected = true
        }

        this.onSelectionChange()
    }

    removeSelection(el: CanvasElement | Array<CanvasElement>) {
        //array of elements
        if (Array.isArray(el)) {
            const array = el as Array<CanvasElement>
            array.forEach((i) => {
                this.removeSelection(i)
            })
        }

        //one element
        else {
            el = el as CanvasElement

            removeCanvElFromArray(this.selectedElements, el)
            el.isSelected = false
        }

        this.onSelectionChange()
    }

    getSelected() {
        return this.selectedElements.slice()
    }
    getSelectedOrAll() {
        return this.selectedElements.length > 0 ? this.getSelected() : this.getAllElements()
    }

    onSelectionChange() {
        this.transformBox.onSelectionChange()
    }

    // freezeEvents() { this.mouseEventsHandler.freezed = true; }
    // unFreezeEvents() { this.mouseEventsHandler.freezed = false; }

    getAllElements(): Array<CanvasElement> {
        let t = [] as Array<CanvasElement>

        t = t.concat(this.imageElements)
        t = t.concat(this.noteElements)

        return t
    }

    moveSelection(vector: Vector2) {
        for (let i = 0; i < this.selectedElements.length; i++) {
            const el = this.selectedElements[i]

            if (el.locked) continue

            el.transform.move(vector)
        }

        this.transformBox.transform.move(vector)
    }

    panStart() {}
    panUpdate(v: Coordinates) {
        this.panOffset.add(v)
        this.transform.move(v)
    }

    panEnd() {}

    zoomUpdate(delta: number, localMouse: Coordinates) {
        // this.zoom += delta

        const oldZoom = this.zoom
        const targetZoom = this.zoom - (this.zoom * delta) / 1000
        this.zoom = Math.max(0.1, Math.min(targetZoom, 10))

        if (this.zoom == oldZoom) return

        this.transform.position.x = localMouse.x - this.mousePos.x * this.zoom
        this.transform.position.y = localMouse.y - this.mousePos.y * this.zoom
    }

    toggleTransformBox(onOff: boolean) {
        this.transformBox.hidden = !onOff
    }

    arrange(elements: Array<CanvasElement>) {
        const boxes = [] as any

        const pivot = this.transformBox.transform.getBottomLeft()

        for (let i = 0; i < elements.length; i++) {
            const element = elements[i]

            const bbox = element.transform.getBoundingBox()

            boxes.push({
                w: bbox.right - bbox.left,
                h: bbox.top - bbox.bottom,
                id: element.elementId,
                offset: element.transform.position
                    .clone()
                    .subtract(new Vector2(bbox.left, bbox.bottom))
            })
        }

        potpack(boxes)

        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i] as any

            let element = elements[i]

            if (element.elementId != box.id) {
                console.log('mismatch')
                element = this.elementsDict.get(box.id)!
            }

            element.transform.setPos(new Vector2(box.x, box.y).add(pivot).add(box.offset))
        }
    }

    getIdsOfSelected() {
        return this.selectedElements.map((el) => el.elementId)
    }

    updateMousePos(pos: Coordinates) {
        this.mousePos.set(
            (pos.x - this.transform.position.x) / this.zoom,
            (pos.y - this.transform.position.y) / this.zoom
        )
    }
}

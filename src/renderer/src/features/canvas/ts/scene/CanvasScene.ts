import {
    CanvasElement,
    MediaFileCanvasElement,
    NoteCanvasElement,
    GroupCanvasElement
} from './CanvasElements'
import SelectionBox from './SelectionBox'
import { TransformBox } from './TransformBox'

import potpack from 'potpack'
import { CmdService } from '@renderer/main'
import { CANVAS_COMMANDS } from '../../commands/CanvasCmd'
import {
    Coordinates,
    pushCanvElToArray,
    removeCanvElFromArray,
    Transform,
    Vector2
} from './CanvasUtils'

export type ZIndexChange = { elementId: string; oldZ: number; newZ: number }

export default class CanvasScene {
    id: number
    name: string
    isPersisted: boolean
    unsavedChanges: boolean = false
    transform: Transform
    zoom: number = 1
    htmlElement: HTMLDivElement | undefined
    selectedElements: Array<CanvasElement> = []
    isGrabbed: boolean = false

    mediaFileElements: Array<MediaFileCanvasElement> = []
    noteElements: Array<NoteCanvasElement> = []
    groupElements: Array<GroupCanvasElement> = []
    elementCount: number = 0

    transformBox: TransformBox
    selectionBox: SelectionBox

    highestZIndex: number = 0

    editedNote: NoteCanvasElement | undefined

    elementsDict: Map<string, CanvasElement> = new Map()

    mousePos = new Vector2(0, 0)

    constructor(id: number, name = 'untitled', isPersisted = false) {
        this.id = id
        this.name = name
        this.isPersisted = isPersisted
        this.transform = new Transform(this, 'root')

        this.transformBox = new TransformBox(this)
        this.selectionBox = new SelectionBox(this)
    }

    getTransform() {
        return this.transform
    }

    addMediaFile(fileId: number, position?: Coordinates) {
        const mediaFile = new MediaFileCanvasElement(this, fileId)

        if (typeof position !== 'undefined') mediaFile.transform.setPos(position)

        this.mediaFileElements.push(mediaFile)
        this.elementsDict.set(mediaFile.elementId, mediaFile)
        // this.transform.addChild(imageEl.transform);
    }
    addMediaFiles(files: number[], position?: Coordinates) {
        files.forEach((f) => {
            this.addMediaFile(f, position)
        })
    }

    private collectSubtree(root: CanvasElement): CanvasElement[] {
        const out: CanvasElement[] = [root]
        if (root instanceof GroupCanvasElement) {
            for (const c of root.children) out.push(...this.collectSubtree(c))
        }
        return out
    }

    private getSelectionRoots(els: CanvasElement[]): CanvasElement[] {
        const ids = new Set(els.map((e) => e.elementId))
        return els.filter((e) => {
            let p = e.transform.parentTransform
            while (p && p.elementId !== 'root') {
                if (ids.has(p.elementId)) return false
                p = p.parentTransform
            }
            return true
        })
    }

    bringToFront(root: CanvasElement): ZIndexChange[] {
        const subtree = this.collectSubtree(root)
        const subtreeIds = new Set(subtree.map((e) => e.elementId))
        const zOf = (e: CanvasElement) => e.transform.zIndex ?? 0

        let minZ = Infinity
        for (const el of subtree) {
            const z = zOf(el)
            if (z < minZ) minZ = z
        }
        if (minZ === Infinity) minZ = 0

        const N = subtree.length
        const changes: ZIndexChange[] = []

        for (const el of this.elementsDict.values()) {
            if (subtreeIds.has(el.elementId)) continue
            const z = zOf(el)
            if (z >= minZ) {
                changes.push({ elementId: el.elementId, oldZ: z, newZ: z - N })
            }
        }

        const baseZ = this.highestZIndex + 1
        for (let i = 0; i < N; i++) {
            const el = subtree[i]
            changes.push({ elementId: el.elementId, oldZ: zOf(el), newZ: baseZ + i })
        }

        for (const c of changes) {
            const el = this.elementsDict.get(c.elementId)
            if (el) el.transform.zIndex = c.newZ
        }
        this.highestZIndex += N
        return changes
    }

    bringSelectionToFront(els: CanvasElement[]): ZIndexChange[] {
        const roots = this.getSelectionRoots(els)
        if (roots.length === 0) return []

        const allSubtreeIds = new Set<string>()
        const allSubtree: CanvasElement[] = []
        for (const root of roots) {
            for (const el of this.collectSubtree(root)) {
                if (!allSubtreeIds.has(el.elementId)) {
                    allSubtreeIds.add(el.elementId)
                    allSubtree.push(el)
                }
            }
        }

        const zOf = (e: CanvasElement) => e.transform.zIndex ?? 0

        let minZ = Infinity
        for (const el of allSubtree) {
            const z = zOf(el)
            if (z < minZ) minZ = z
        }
        if (minZ === Infinity) minZ = 0

        const N = allSubtree.length
        const changes: ZIndexChange[] = []

        for (const el of this.elementsDict.values()) {
            if (allSubtreeIds.has(el.elementId)) continue
            const z = zOf(el)
            if (z >= minZ) {
                changes.push({ elementId: el.elementId, oldZ: z, newZ: z - N })
            }
        }

        const baseZ = this.highestZIndex + 1
        for (let i = 0; i < N; i++) {
            const el = allSubtree[i]
            changes.push({ elementId: el.elementId, oldZ: zOf(el), newZ: baseZ + i })
        }

        for (const c of changes) {
            const tgt = this.elementsDict.get(c.elementId)
            if (tgt) tgt.transform.zIndex = c.newZ
        }
        this.highestZIndex += N
        return changes
    }

    revertZIndexChanges(changes: ZIndexChange[], prevHighest: number) {
        for (const c of changes) {
            const el = this.elementsDict.get(c.elementId)
            if (el) el.transform.zIndex = c.oldZ
        }
        this.highestZIndex = prevHighest
    }

    addNote(text: string, position?: Vector2) {
        const note = new NoteCanvasElement(this, text)

        if (typeof position !== 'undefined') note.transform.position = position

        this.noteElements.push(note)
        this.elementsDict.set(note.elementId, note)
    }

    addGroup(groupId?: string): GroupCanvasElement {
        const group = new GroupCanvasElement(this, groupId)
        this.groupElements.push(group)
        this.elementsDict.set(group.elementId, group)
        return group
    }
    removeGroup(groupId: string) {
        const group = this.elementsDict.get(groupId)
        if (!group) return
        this.groupElements = this.groupElements.filter((g) => g.elementId !== groupId)
        this.elementsDict.delete(groupId)
    }

    selectElement(element: CanvasElement, shiftPressed: boolean) {
        const index = this.selectedElements.findIndex((el) => el.elementId === element.elementId)
        const isSelected = element.isSelected

        // console.log('this.selectedElements.length ', this.selectedElements.length)

        if (shiftPressed) {
            if (isSelected) {
                this.selectedElements.splice(index, 1)
                element.isSelected = false
            } else {
                this.selectedElements.push(element)
                element.isSelected = true

                CmdService.execute(CANVAS_COMMANDS.BRING_TO_FRONT)
            }
        } else {
            if (isSelected) {
                if (this.selectedElements.length > 1) {
                    this.clearSelection()
                    this.selectedElements = [element]
                    element.isSelected = true

                    CmdService.execute(CANVAS_COMMANDS.BRING_TO_FRONT)
                } else {
                    this.clearSelection()
                }
            } else {
                this.clearSelection()
                this.selectedElements = [element]
                element.isSelected = true

                CmdService.execute(CANVAS_COMMANDS.BRING_TO_FRONT)
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
        return this.selectedElements.length > 0 ? this.getSelected() : this.getAllSelectable()
    }

    onSelectionChange() {
        this.transformBox.onSelectionChange()
    }

    getAllSelectable(): Array<CanvasElement> {
        return [...this.elementsDict.values().filter((e) => this.isSelectable(e))]
    }

    isSelectable(element: CanvasElement): boolean {
        // needs to be a child of root or expanded group

        const parentT = element.transform.parentTransform
        if (parentT?.elementId === 'root') return true

        const parentEl = this.elementsDict.get(parentT!.elementId)
        if (!parentEl || !(parentEl instanceof GroupCanvasElement)) return false
        return parentEl.expanded
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
        this.transform.move(v)
    }

    panEnd() {}

    zoomUpdate(delta: number, localMouse: Coordinates) {
        // this.zoom += delta

        const oldZoom = this.zoom
        const targetZoom = this.zoom - (this.zoom * delta) / 1000
        this.zoom = Math.max(0.0005, Math.min(targetZoom, 10))

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
                offset: element.transform.position.subtract(new Vector2(bbox.left, bbox.bottom))
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

    getElementsById(elements: string[]) {
        return elements.map((id) => this.elementsDict.get(id)!)
    }

    saveToJSON() {
        const data = {
            elements: [...this.elementsDict.values()].map((e) => e.toJSON()),
            zoom: this.zoom,
            panOffset: this.transform.position.toJSON(),
            highestZIndex: this.highestZIndex
        }

        console.log(data)

        return data
    }

    loadFromJSON(data: any) {
        this.zoom = data.zoom
        this.transform.setPos(Vector2.fromJSON(data.panOffset))
        this.highestZIndex = data.highestZIndex
        this.elementsDict.clear()
        this.mediaFileElements = []
        this.noteElements = []
        this.groupElements = []
        this.selectedElements = []
        this.unsavedChanges = false
        for (const e of data.elements) {
            if (e.type === 'media') {
                const mediaFile = new MediaFileCanvasElement(this, e.fileId, e.elementId)
                this.mediaFileElements.push(mediaFile)
                this.elementsDict.set(e.elementId, mediaFile)
                mediaFile.fromJSON(e)
            } else if (e.type === 'note') {
                const note = new NoteCanvasElement(this, e.text, e.elementId)
                this.noteElements.push(note)
                this.elementsDict.set(e.elementId, note)
                note.fromJSON(e)
            } else if (e.type === 'group') {
                const group = new GroupCanvasElement(this, e.elementId)
                this.groupElements.push(group)
                this.elementsDict.set(e.elementId, group)
                group.fromJSON(e)
            } else {
                throw new Error(`Unknown element type: ${e.type}`)
            }
        }

        for (const e of data.elements) {
            if (e.type !== 'media' && e.type !== 'note' && e.type !== 'group') {
                throw new Error(`Unknown element type: ${e.type}`)
            } else {
                const element = this.elementsDict.get(e.elementId)
                if (!element) {
                    throw new Error(`Element not found: ${e.elementId}`)
                }
                console.log('onsceneload', e, e.transform, e.transform.children)
                element.onSceneLoad(e)
            }
        }

        // this.elementsDict.values().forEach((i) => {
        //     i.onSceneLoad()
        // })
    }
}

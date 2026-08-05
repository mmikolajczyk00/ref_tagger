import {
    Coordinates,
    Transform,
    Vector2,
    calculateBBoxByChildren,
    isInsideRect
} from './CanvasUtils'
import type CanvasScene from './CanvasScene'
import { GroupCanvasElement } from './CanvasElements'
import { CANVAS_COMMANDS } from '../../commands/CanvasCmd'
import { CmdService } from '@renderer/main'

export class MoveAction {
    oldPositions = new Map<string, Coordinates>()

    newPositions = new Map<string, Coordinates>()

    groupId: string | undefined

    saveOld(canvas: CanvasScene) {
        this.oldPositions.clear()
        canvas.selectedElements.forEach((e) => {
            this.oldPositions.set(e.elementId, e.transform.position.asCoordinates())
        })
    }

    saveNew(canvas: CanvasScene) {
        this.newPositions.clear()
        canvas.selectedElements.forEach((e) => {
            this.newPositions.set(e.elementId, e.transform.position.asCoordinates())
        })
    }

    copy() {
        const oldPositions = new Map<string, Coordinates>(
            Array.from(this.oldPositions, ([key, coord]) => [key, { x: coord.x, y: coord.y }])
        )
        const newPositions = new Map<string, Coordinates>(
            Array.from(this.newPositions, ([key, coord]) => [key, { x: coord.x, y: coord.y }])
        )
        return { oldPositions, newPositions }
    }
}

export type RotActionTransform = { pos: Coordinates; pivot: Coordinates; rotOrScale: number }
export class RotateAction {
    oldTransforms = new Map<string, RotActionTransform>()
    newTransforms = new Map<string, RotActionTransform>()

    saveOld(canvas: CanvasScene) {
        this.oldTransforms.clear()
        canvas.selectedElements.forEach((e) => {
            this.oldTransforms.set(e.elementId, {
                pos: e.transform.position.asCoordinates(),
                pivot: e.transform.getCenter().asCoordinates(),
                rotOrScale: e.transform.rotation
            })
        })
    }

    saveNew(canvas: CanvasScene) {
        this.newTransforms.clear()
        canvas.selectedElements.forEach((e) => {
            this.newTransforms.set(e.elementId, {
                pos: e.transform.position.asCoordinates(),
                pivot: e.transform.getCenter().asCoordinates(),
                rotOrScale: e.transform.rotation
            })
        })
    }

    copy() {
        const oldTransforms = new Map<string, RotActionTransform>(
            Array.from(this.oldTransforms, ([key, t]) => [
                key,
                { pos: { ...t.pos }, pivot: { ...t.pivot }, rotOrScale: t.rotOrScale }
            ])
        )
        const newTransforms = new Map<string, RotActionTransform>(
            Array.from(this.newTransforms, ([key, t]) => [
                key,
                { pos: { ...t.pos }, pivot: { ...t.pivot }, rotOrScale: t.rotOrScale }
            ])
        )
        return { oldTransforms, newTransforms }
    }
}

export class ResizeAction {
    oldTransforms = new Map<string, RotActionTransform>()
    newTransforms = new Map<string, RotActionTransform>()

    saveOld(canvas: CanvasScene) {
        this.oldTransforms.clear()
        canvas.selectedElements.forEach((e) => {
            this.oldTransforms.set(e.elementId, {
                pos: e.transform.position.asCoordinates(),
                pivot: e.transform.getCenter().asCoordinates(),
                rotOrScale: e.transform.scale
            })
        })
    }

    saveNew(canvas: CanvasScene) {
        this.newTransforms.clear()
        canvas.selectedElements.forEach((e) => {
            this.newTransforms.set(e.elementId, {
                pos: e.transform.position.asCoordinates(),
                pivot: e.transform.getCenter().asCoordinates(),
                rotOrScale: e.transform.scale
            })
        })
    }

    copy() {
        const oldTransforms = new Map<string, RotActionTransform>(
            Array.from(this.oldTransforms, ([key, t]) => [
                key,
                { pos: { ...t.pos }, pivot: { ...t.pivot }, rotOrScale: t.rotOrScale }
            ])
        )
        const newTransforms = new Map<string, RotActionTransform>(
            Array.from(this.newTransforms, ([key, t]) => [
                key,
                { pos: { ...t.pos }, pivot: { ...t.pivot }, rotOrScale: t.rotOrScale }
            ])
        )
        return { oldTransforms, newTransforms }
    }
}

export class TransformBox {
    canvas: CanvasScene
    transform: Transform
    hidden = true

    rotateAction = new RotateAction()
    resizeAction = new ResizeAction()
    moveAction = new MoveAction()

    startMouse = new Vector2()
    endMouse = new Vector2()
    initialAngle = 0
    initialCenter = new Vector2()
    initialPos = new Vector2()

    startMouseToPivotDistance = 0
    currentMouseToPivotDist = 0
    axisMask = { x: 0, y: 0 } as Coordinates

    axisToPivot = new Map<CARDINAL_DIRECTIONS, () => Vector2>()

    constructor(canvas: CanvasScene) {
        this.canvas = canvas
        this.transform = new Transform(canvas, canvas.getTransform(), 'transform_box')

        this.axisToPivot.set(CARDINAL_DIRECTIONS.n, () => this.transform.getCenterBottom())
        this.axisToPivot.set(CARDINAL_DIRECTIONS.e, () => this.transform.getCenterLeft())
        this.axisToPivot.set(CARDINAL_DIRECTIONS.s, () => this.transform.getCenterTop())
        this.axisToPivot.set(CARDINAL_DIRECTIONS.w, () => this.transform.getCenterRight())
        this.axisToPivot.set(CARDINAL_DIRECTIONS.nw, () => this.transform.getBottomRight())
        this.axisToPivot.set(CARDINAL_DIRECTIONS.ne, () => this.transform.getBottomLeft())
        this.axisToPivot.set(CARDINAL_DIRECTIONS.se, () => this.transform.getTopLeft())
        this.axisToPivot.set(CARDINAL_DIRECTIONS.sw, () => this.transform.getTopRight())
    }

    onSelectionChange() {
        const selArr = this.canvas.selectedElements

        this.transform.rotation = 0

        // none selected
        if (selArr.length <= 0) {
            this.hidden = true

            return
        }

        // copy transform box transforms from element
        else if (selArr.length == 1) {
            this.transform.rotation = selArr[0].transform.rotation
            this.transform.position = selArr[0].transform.position.clone()
            this.transform.width = selArr[0].transform.scaledWidth()
            this.transform.height = selArr[0].transform.scaledHeight()

            this.hidden = false
        }

        // fit box to content
        else {
            const bbox = calculateBBoxByChildren(selArr)

            this.transform.position.x = bbox.left
            this.transform.position.y = bbox.top
            this.transform.width = bbox.right - bbox.left
            this.transform.height = bbox.bottom - bbox.top

            this.hidden = false
        }
    }

    resizeStart(axis: CARDINAL_DIRECTIONS) {
        console.log('startResizeAction', axis)
        this.resizeAction.saveOld(this.canvas)
        this.startMouse.setV(this.canvas.mousePos)

        this.axisMask = this.getResizeAxisMask(axis)
        this.startMouseToPivotDistance = this.axisToPivot.get(axis)!()
            .clone()
            .subtract(this.canvas.mousePos)
            .multiplyByVector(this.axisMask)
            .magnitude()
    }
    resizeUpdate(axis: CARDINAL_DIRECTIONS, isAlt: boolean) {
        const tboxPivot = this.axisToPivot.get(axis)!()

        const currentMouseToPivotDistance = tboxPivot
            .clone()
            .subtract(this.canvas.mousePos)
            .multiplyByVector(this.axisMask)
            .magnitude()

        // default option is the max (for diagonals)
        const scaleDifference = currentMouseToPivotDistance / this.startMouseToPivotDistance

        const moveScale = scaleDifference - 1

        this.resizeAction.oldTransforms.forEach(({ pos, rotOrScale }, id) => {
            const el = this.canvas.elementsDict.get(id)
            if (el) {
                const activePivot = isAlt ? el.transform.getCenter() : tboxPivot
                const pivotToPos = new Vector2(pos.x, pos.y)
                    .subtract(activePivot)
                    .multiply(moveScale)
                el.transform.setPos(pivotToPos.added(pos))

                el.transform.setScale(rotOrScale * scaleDifference)
            }
        })

        this.onSelectionChange()
    }
    resizeEnd() {
        this.resizeAction.saveNew(this.canvas)
        CmdService.execute(CANVAS_COMMANDS.RESIZE)
    }

    rotateStart() {
        this.rotateAction.saveOld(this.canvas)
        const v = this.transform.getCenter().subtract(this.canvas.mousePos)
        this.initialAngle = Math.atan2(v.x, v.y)
        this.initialCenter = this.transform.getCenter()
        this.initialPos = this.transform.position.clone()
    }
    rotateUpdate(isAlt: boolean) {
        const center = this.transform.getCenter()
        const v = center.subtracted(this.canvas.mousePos)
        const angle = this.initialAngle - Math.atan2(v.x, v.y)

        this.rotateAction.oldTransforms.forEach(({ pos, pivot, rotOrScale }, id) => {
            const el = this.canvas.elementsDict.get(id)
            if (el) {
                el.transform.setRotation(rotOrScale + angle)

                const activePivot = isAlt ? pivot : this.initialCenter
                const diff = new Vector2(pos.x, pos.y).subtract(activePivot)
                diff.rotate(angle)

                el.transform.setPos(diff.add(activePivot))
            }
        })

        this.onSelectionChange()
    }

    notifyParents() {
        const parentsToNotify = new Set<string>()

        this.canvas.selectedElements.forEach((el) => {
            const parent = this.canvas.elementsDict.get(el!.transform.parentTransform!.elementId)
            if (parent instanceof GroupCanvasElement) {
                parentsToNotify.add(parent.elementId)
            }
        })

        parentsToNotify.forEach((id) => {
            const parent = this.canvas.elementsDict.get(id)
            if (parent instanceof GroupCanvasElement) {
                parent.updateBoundingBox()
            }
        })
    }

    rotateEnd() {
        this.rotateAction.saveNew(this.canvas)
        CmdService.execute(CANVAS_COMMANDS.ROTATE)
    }

    moveStart() {
        this.startMouse.setV(this.canvas.mousePos)
        this.moveAction.saveOld(this.canvas)
        this.moveAction.groupId = undefined
    }

    moveUpdate() {
        const delta = this.startMouse.subtracted(this.canvas.mousePos).multiply(-1)

        this.moveAction.oldPositions.forEach((pos, id) => {
            const el = this.canvas.elementsDict.get(id)
            if (el) {
                el.transform.setPos(delta.added(pos))
            }
        })

        this.onSelectionChange()
    }

    moveEnd() {
        const mousePos = this.canvas.mousePos
        const groupIds = new Map<string, number>()

        // ignore selected groups
        const ignoredGroupIds = new Set<string>()
        this.canvas.selectedElements.forEach((el) => {
            if (el instanceof GroupCanvasElement) {
                ignoredGroupIds.add(el.elementId)
            }
        })
        const validGroups = this.canvas.groupElements.filter(
            (e) => !ignoredGroupIds.has(e.elementId) && this.canvas.isSelectable(e)
        )

        for (const group of validGroups) {
            const bbox = group.transform.getBoundingBox()
            if (isInsideRect(mousePos, bbox)) {
                groupIds.set(group.elementId, mousePos.distanceToSq(group.transform.getCenter()))
            }
        }

        const sorted = [...groupIds.entries()].sort((a, b) => a[1] - b[1]) // sort by distance

        if (sorted[0] && sorted[0][0]) {
            this.moveAction.groupId = sorted[0][0]
            console.log('moveAction.groupId', this.moveAction.groupId)
        }

        this.moveAction.saveNew(this.canvas)

        CmdService.execute(CANVAS_COMMANDS.MOVE)
    }

    getResizeAxisMask(axis: CARDINAL_DIRECTIONS) {
        const axisMask = { x: 1, y: 1 }
        if (axis == CARDINAL_DIRECTIONS.n || axis == CARDINAL_DIRECTIONS.s) {
            axisMask.x = 0
        } else if (axis == CARDINAL_DIRECTIONS.e || axis == CARDINAL_DIRECTIONS.w) {
            axisMask.y = 0
        }
        return axisMask
    }
}

export enum CARDINAL_DIRECTIONS {
    n = 'n',
    e = 'e',
    s = 's',
    w = 'w',
    nw = 'nw',
    ne = 'ne',
    se = 'se',
    sw = 'sw',
    none = 'none'
}

import { Coordinates, Transform, Vector2 } from './canvas_utils'
import type CanvasScene from './CanvasScene'

export class MoveAction {
    oldPositions = new Map<string, Vector2>()

    newPositions = new Map<string, Vector2>()

    saveOld(canvas: CanvasScene) {
        this.oldPositions.clear()
        canvas.selectedElements.forEach((e) => {
            this.oldPositions.set(e.elementId, e.transform.position.clone())
        })
    }

    saveNew(canvas: CanvasScene) {
        this.newPositions.clear()
        canvas.selectedElements.forEach((e) => {
            this.newPositions.set(e.elementId, e.transform.position.clone())
        })
    }
}

type RotActionTransform = { pos: Vector2; pivot: Vector2; rotOrScale: number }
export class RotateAction {
    oldTransforms = new Map<string, RotActionTransform>()
    newTransforms = new Map<string, RotActionTransform>()

    saveOld(canvas: CanvasScene) {
        this.oldTransforms.clear()
        canvas.selectedElements.forEach((e) => {
            this.oldTransforms.set(e.elementId, {
                pos: e.transform.position.clone(),
                pivot: e.transform.getCenter().clone(),
                rotOrScale: e.transform.rotation
            })
        })
    }

    saveNew(canvas: CanvasScene) {
        this.newTransforms.clear()
        canvas.selectedElements.forEach((e) => {
            this.newTransforms.set(e.elementId, {
                pos: e.transform.position.clone(),
                pivot: e.transform.getCenter().clone(),
                rotOrScale: e.transform.rotation
            })
        })
    }
}

export class ResizeAction {
    oldTransforms = new Map<string, RotActionTransform>()
    newTransforms = new Map<string, RotActionTransform>()

    saveOld(canvas: CanvasScene) {
        this.oldTransforms.clear()
        canvas.selectedElements.forEach((e) => {
            this.oldTransforms.set(e.elementId, {
                pos: e.transform.position.clone(),
                pivot: e.transform.getCenter().clone(),
                rotOrScale: e.transform.scale
            })
            console.log(e.transform.position)
        })
    }

    saveNew(canvas: CanvasScene) {
        this.newTransforms.clear()
        canvas.selectedElements.forEach((e) => {
            this.newTransforms.set(e.elementId, {
                pos: e.transform.position.clone(),
                pivot: e.transform.getCenter().clone(),
                rotOrScale: e.transform.scale
            })
        })
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
            const botLeft = new Vector2(0, 0)
            const topRight = new Vector2(0, 0)

            const firstElRect = selArr[0].transform.getBoundingBox()
            botLeft.x = firstElRect.left
            botLeft.y = firstElRect.bottom
            topRight.x = firstElRect.right
            topRight.y = firstElRect.top

            for (let i = 1; i < selArr.length; i++) {
                const element = selArr[i]
                const rect = element.transform.getBoundingBox()

                botLeft.x = Math.min(rect.left, botLeft.x)
                botLeft.y = Math.min(rect.bottom, botLeft.y)
                topRight.x = Math.max(rect.right, topRight.x)
                topRight.y = Math.max(rect.top, topRight.y)
            }

            this.transform.position.x = botLeft.x
            this.transform.position.y = botLeft.y
            this.transform.width = topRight.x - botLeft.x
            this.transform.height = topRight.y - botLeft.y

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
                const pivotToPos = pos.clone().subtract(activePivot).multiply(moveScale)
                el.transform.setPos(pivotToPos.added(pos))

                el.transform.scale = rotOrScale * scaleDifference
                el.transform.scale = rotOrScale * scaleDifference
            }
        })

        this.onSelectionChange()
    }
    resizeEnd() {
        // this.resizeAction.saveNew(this.canvas)
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
                const diff = pos.subtracted(activePivot)
                diff.rotate(angle)

                el.transform.setPos(diff.add(activePivot))
            }
        })

        this.onSelectionChange()
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    rotateEnd() {}

    moveStart() {
        this.startMouse.setV(this.canvas.mousePos)
        this.moveAction.saveOld(this.canvas)
    }

    moveUpdate() {
        const delta = this.startMouse.subtracted(this.canvas.mousePos).multiply(-1)

        this.moveAction.oldPositions.forEach((pos, id) => {
            const el = this.canvas.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos.added(delta))
            }
        })

        this.onSelectionChange()
    }
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    moveEnd() {}

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

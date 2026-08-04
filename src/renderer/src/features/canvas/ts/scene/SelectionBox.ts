import { Transform, Vector2 } from './CanvasUtils'
import { CanvasElement } from './CanvasElements'
import type CanvasScene from './CanvasScene'

const SIZE_THRESHOLD = 4

export default class SelectionBox {
    canvas: CanvasScene
    transform: Transform
    hidden = true
    on = true
    firstTouch = new Vector2(0, 0)

    constructor(canvas: CanvasScene) {
        this.canvas = canvas
        this.transform = new Transform(canvas, canvas.getTransform(), 'transform_box')
    }

    start() {
        this.firstTouch.setV(this.canvas.mousePos)
        this.on = false
    }

    update(isShift: boolean) {
        const mousePos = this.canvas.mousePos

        const sX = Math.min(mousePos.x, this.firstTouch.x)
        const sY = Math.min(mousePos.y, this.firstTouch.y)
        const width = Math.abs(mousePos.x - this.firstTouch.x)
        const height = Math.abs(mousePos.y - this.firstTouch.y)

        if (width > SIZE_THRESHOLD || height > SIZE_THRESHOLD) {
            this.hidden = false
        } else {
            this.hidden = true
            return
        }

        this.transform.position.x = sX
        this.transform.position.y = sY
        this.transform.width = width
        this.transform.height = height

        // //handle selection

        const newSelection: Array<CanvasElement> = []
        const allElements = this.canvas.getAllElements()
        const rectangle = {
            top: sY + height,
            right: sX + width,
            bottom: sY,
            left: sX
        }
        const polygon = [
            new Vector2(rectangle.left, rectangle.bottom),
            new Vector2(rectangle.right, rectangle.bottom),
            new Vector2(rectangle.left, rectangle.top),
            new Vector2(rectangle.right, rectangle.top)
        ]

        for (let i = 0; i < allElements.length; i++) {
            const element = allElements[i]

            if (element.isOverlapping(polygon)) {
                newSelection.push(element)
            }
        }

        if (isShift) this.canvas.appendSelection(newSelection)
        else this.canvas.setSelection(newSelection)
    }

    end() {
        this.on = false
        this.hidden = true
    }
}

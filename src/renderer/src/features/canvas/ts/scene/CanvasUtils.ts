import { CanvasElement } from './CanvasElements'
import CanvasScene from './CanvasScene'

export interface Coordinates {
    x: number
    y: number
}

export class Vector2 implements Coordinates {
    x = 0 as number
    y = 0 as number

    constructor(x?: number, y?: number) {
        if (typeof x !== 'undefined') this.x = x
        if (typeof y !== 'undefined') this.y = y
    }

    add(vector: Coordinates) {
        this.x += vector.x
        this.y += vector.y
        return this
    }
    added(vector: Coordinates) {
        return new Vector2(this.x + vector.x, this.y + vector.y)
    }

    subtract(vector: Coordinates) {
        this.x -= vector.x
        this.y -= vector.y
        return this
    }
    subtracted(vector: Coordinates) {
        return new Vector2(this.x - vector.x, this.y - vector.y)
    }

    multiply(scalar: number) {
        this.x = this.x * scalar
        this.y = this.y * scalar
        return this
    }

    multiplyByVector(vector: Coordinates) {
        this.x = this.x * vector.x
        this.y = this.y * vector.y
        return this
    }

    multiplied(scalar: number) {
        return new Vector2(this.x * scalar, this.y * scalar)
    }
    multipliedByVector(vector: Coordinates) {
        return new Vector2(this.x * vector.x, this.y * vector.y)
    }

    divide(scalar: number) {
        this.x = this.x * scalar
        this.y = this.y * scalar
        return this
    }

    divideByVector(vector: Coordinates) {
        this.x = this.x / vector.x
        this.y = this.y / vector.y
        return this
    }

    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y)
    }

    magnitudeSq() {
        return this.x * this.x + this.y * this.y
    }

    set(x: number, y: number) {
        this.x = x
        this.y = y
        return this
    }
    setV(other: Coordinates) {
        this.x = other.x
        this.y = other.y
        return this
    }

    static clone(other: Coordinates) {
        return new Vector2(other.x, other.y)
    }

    clone() {
        return new Vector2(this.x, this.y)
    }

    normalized() {
        if (this.x == 0 && this.y == 0) {
            return new Vector2(0, 0)
        }
        const l = this.magnitude()
        return new Vector2(this.x / l, this.y / l)
    }

    normalize() {
        if (this.x == 0 && this.y == 0) {
            return this
        }

        const l = this.magnitude()
        this.x = this.x / l
        this.y = this.y / l
        return this
    }

    rotate(r: number) {
        const tx = this.x * Math.cos(r) - this.y * Math.sin(r)
        this.y = this.x * Math.sin(r) + this.y * Math.cos(r)
        this.x = tx
        return this
    }

    rotated(r: number) {
        return new Vector2(
            this.x * Math.cos(r) - this.y * Math.sin(r),
            this.x * Math.sin(r) + this.y * Math.cos(r)
        )
    }
}

export class Transform {
    position = new Vector2(0, 0)
    scale = 1
    rotation = 0
    width = 0
    height = 0
    children: Array<Transform> = []
    parentTransform: Transform | null
    canvas: CanvasScene
    elementId: string
    zIndex: any

    constructor(canvas: CanvasScene, parentTransform: Transform | null, elementId: string) {
        this.canvas = canvas
        this.parentTransform = parentTransform
        this.elementId = elementId
    }

    scaledWidth = () => this.width * this.scale
    scaledHeight = () => this.height * this.scale

    move(vector: Coordinates) {
        this.position.add(vector)

        // this.children.forEach((c) => {
        //     c.move(vector)
        // })
    }

    setPos(newPos: Coordinates) {
        if (this.children.length > 0) {
            const difference = { x: newPos.x - this.position.x, y: newPos.y - this.position.y }
            this.move(difference)
        } else {
            this.position.setV(newPos)
        }
    }

    setRotation(newAngle: number) {
        this.rotation = newAngle
        //TODO: rotate the children around the center
    }

    resize(scalar: number) {
        this.scale *= scalar

        this.children.forEach((c) => {
            c.resize(scalar)
        })
    }

    addChild(childTransform: Transform) {
        this.children.push(childTransform)
    }

    getBoundingBox(): Rectangle {
        const bl = this.getBottomLeft()
        const br = this.getBottomRight()
        const tl = this.getTopLeft()
        const tr = this.getTopRight()
        return {
            top: Math.min(bl.y, br.y, tl.y, tr.y),
            right: Math.max(bl.x, br.x, tl.x, tr.x),
            bottom: Math.max(bl.y, br.y, tl.y, tr.y),
            left: Math.min(bl.x, br.x, tl.x, tr.x)
        }
    }

    getCenter() {
        return this.rotatedPointAroundOrigin(
            new Vector2(
                this.position.x + this.scaledWidth() / 2,
                this.position.y + this.scaledHeight() / 2
            )
        )
    }

    getCenterTop() {
        return this.rotatedPointAroundOrigin(
            new Vector2(this.position.x + this.scaledWidth() / 2, this.position.y)
        )
    }
    getCenterBottom() {
        return this.rotatedPointAroundOrigin(
            new Vector2(
                this.position.x + this.scaledWidth() / 2,
                this.position.y + this.scaledHeight()
            )
        )
    }
    getCenterLeft() {
        return this.rotatedPointAroundOrigin(
            new Vector2(this.position.x, this.position.y + this.scaledHeight() / 2)
        )
    }

    getCenterRight() {
        return this.rotatedPointAroundOrigin(
            new Vector2(
                this.position.x + this.scaledWidth(),
                this.position.y + this.scaledHeight() / 2
            )
        )
    }

    getTopRight() {
        return this.rotatedPointAroundOrigin(
            new Vector2(this.position.x + this.scaledWidth(), this.position.y)
        )
    }
    getTopLeft() {
        return new Vector2(this.position.x, this.position.y)
    }
    getBottomRight() {
        return this.rotatedPointAroundOrigin(
            new Vector2(this.position.x + this.scaledWidth(), this.position.y + this.scaledHeight())
        )
    }

    getBottomLeft() {
        return this.rotatedPointAroundOrigin(
            new Vector2(this.position.x, this.position.y + this.scaledHeight())
        )
    }

    rotatedPointAroundOrigin(point: Vector2): Vector2 {
        return rotateVectorAroundOrigin(point, this.getTopLeft(), this.rotation)
    }
}

export function isArray(someVar: any) {
    if (Object.prototype.toString.call(someVar) === '[object Array]') {
        return true
    } else return false
}

export function removeFromArray(array: Array<any>, item: any) {
    for (let i = 0; i < array.length; i++) {
        const element = array[i]
        if (element == item) {
            array.splice(i, 0)
            return
        }
    }
}

export function rotateCoordAroundOrigin(
    x: number,
    y: number,
    px: number,
    py: number,
    angleRad: number
) {
    const c = Math.cos(angleRad)
    const s = Math.sin(angleRad)
    const dx = x - px
    const dy = y - py
    return {
        x: px + c * dx - s * dy,
        y: py + s * dx + c * dy
    } as Coordinates
}

export function rotateVectorAroundOrigin(v: Vector2, pivot: Vector2, angleRad: number) {
    const c = Math.cos(angleRad)
    const s = Math.sin(angleRad)
    const dx = v.x - pivot.x
    const dy = v.y - pivot.y
    return v.setV({ x: pivot.x + c * dx - s * dy, y: pivot.y + s * dx + c * dy })
}

export function doPolygonsIntersect(a: Array<Vector2>, b: Array<Vector2>) {
    const polygons = [a, b]
    let minA, maxA, projected, i, i1, j, minB, maxB

    for (i = 0; i < polygons.length; i++) {
        // for each polygon, look at each edge of the polygon, and determine if it separates
        // the two shapes
        const polygon = polygons[i]
        for (i1 = 0; i1 < polygon.length; i1++) {
            // grab 2 vertices to create an edge
            const i2 = (i1 + 1) % polygon.length
            const p1 = polygon[i1]
            const p2 = polygon[i2]

            // find the line perpendicular to this edge
            const normal = { x: p2.y - p1.y, y: p1.x - p2.x }

            minA = maxA = undefined
            // for each vertex in the first shape, project it onto the line perpendicular to the edge
            // and keep track of the min and max of these values
            for (j = 0; j < a.length; j++) {
                projected = normal.x * a[j].x + normal.y * a[j].y
                if (minA == undefined || projected < minA) {
                    minA = projected
                }
                if (maxA == undefined || projected > maxA) {
                    maxA = projected
                }
            }

            // for each vertex in the second shape, project it onto the line perpendicular to the edge
            // and keep track of the min and max of these values
            minB = maxB = undefined
            for (j = 0; j < b.length; j++) {
                projected = normal.x * b[j].x + normal.y * b[j].y
                if (minB == undefined || projected < minB) {
                    minB = projected
                }
                if (maxB == undefined || projected > maxB) {
                    maxB = projected
                }
            }

            // if there is no overlap between the projects, the edge we are looking at separates the two
            // polygons, and we know there is no overlap
            if (maxA! < minB! || maxB! < minA!) {
                return false
            }
        }
    }
    return true
}

export function getBoundingBox(elements: CanvasElement[]): Rectangle {
    const rectangle = elements[0].transform.getBoundingBox()

    for (let i = 1; i < elements.length; i++) {
        const element = elements[i]
        const rect = element.transform.getBoundingBox()

        rectangle.left = Math.min(rect.left, rectangle.left)
        rectangle.top = Math.min(rect.top, rectangle.top)
        rectangle.right = Math.max(rect.right, rectangle.right)
        rectangle.bottom = Math.max(rect.bottom, rectangle.bottom)
    }

    return rectangle
}

export interface Rectangle {
    top: number
    right: number
    bottom: number
    left: number
}

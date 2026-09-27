import {
    CanvasElement,
    GroupCanvasElement,
    MediaFileCanvasElement,
    NoteCanvasElement
} from '../scene/CanvasElements'
import CanvasScene from '../scene/CanvasScene'
import { Vector2 } from '../scene/CanvasUtils'
import { buildScenePayload } from '@shared/clipboard/sceneClipboard'

interface SceneElementJson {
    elementId: string
    type?: string
    transform?: {
        children?: string[]
        parent?: string
        [key: string]: unknown
    }
    fileId?: number
    noteText?: string
}

// Cuts a group in the selection down to its whole subtree (deduped), so groups
// behave as if their children were selected both for copying and for serialization.
export function collectEffectiveSelection(scene: CanvasScene): CanvasElement[] {
    const out: CanvasElement[] = []
    const seen = new Set<string>()
    for (const root of scene.getSelected()) {
        for (const el of expandSubtree(root)) {
            if (!seen.has(el.elementId)) {
                seen.add(el.elementId)
                out.push(el)
            }
        }
    }
    return out
}

function expandSubtree(root: CanvasElement): CanvasElement[] {
    if (root instanceof GroupCanvasElement) {
        return [root, ...root.children.flatMap((c) => expandSubtree(c))]
    }
    return [root]
}

export function buildCanvasScenePayload(effective: CanvasElement[]): string {
    return buildScenePayload(effective)
}

export function noteTextFallback(effective: CanvasElement[]): string | undefined {
    const notes = effective.filter((e): e is NoteCanvasElement => e instanceof NoteCanvasElement)
    if (notes.length === 1) return notes[0].noteText
    return undefined
}

export function imageElementsOf(effective: CanvasElement[]): MediaFileCanvasElement[] {
    return effective.filter(
        (e): e is MediaFileCanvasElement =>
            e instanceof MediaFileCanvasElement && e.transform.scaledWidth() > 0
    )
}

// Elements of a pasted set whose ancestor chain never leaves the set. Used to
// keep anchoring from displacing group children relative to their parent.
// Translates pasted elements so the top-left of their combined rotated bbox lands
// at `anchor`, preserving every element's position RELATIVE to the others (group
// children included — every local position shifts by the same delta, so the whole
// layout moves as one piece). Also used for transform-less pastes, which simply
// land at the anchor.
export function placeAtPasteAnchor(elements: CanvasElement[], anchor: Vector2): void {
    if (elements.length === 0) return
    const roots = selectionRootsOf(elements)
    let minX = Infinity
    let minY = Infinity
    for (const el of roots) {
        const bb = el.transform.getBoundingBox()
        minX = Math.min(minX, bb.left)
        minY = Math.min(minY, bb.top)
    }
    const dx = anchor.x - minX
    const dy = anchor.y - minY
    for (const el of elements) {
        el.transform.position.x += dx
        el.transform.position.y += dy
    }
}

export function selectionRootsOf(elements: CanvasElement[]): CanvasElement[] {
    const ids = new Set(elements.map((e) => e.elementId))
    return elements.filter((e) => {
        let parent = e.transform.parentTransform
        while (parent) {
            if (parent.elementId !== 'root' && ids.has(parent.elementId)) return false
            parent = parent.parentTransform
        }
        return true
    })
}

export function viewportCenterInWorld(scene: CanvasScene): Vector2 {
    const size = scene.viewportElement
        ? {
              width: scene.viewportElement.clientWidth,
              height: scene.viewportElement.clientHeight
          }
        : { width: window.innerWidth, height: window.innerHeight }
    return new Vector2(
        (size.width / 2 - scene.transform.position.x) / scene.zoom,
        (size.height / 2 - scene.transform.position.y) / scene.zoom
    )
}

export function pasteAnchorPosition(scene: CanvasScene): Vector2 {
    const mouse = scene.mousePos
    if (mouse.x !== 0 || mouse.y !== 0) return mouse.clone()
    return viewportCenterInWorld(scene)
}

// Creates fresh elements from a parsed scene payload (elementIds and transform
// parent/children references are remapped to brand-new ids), inserts them into
// the scene, and returns them. Transforms are optional per the clipboard format.
export function buildElementsFromSceneJson(
    canvas: CanvasScene,
    elementsJson: unknown[]
): CanvasElement[] {
    const idMap = new Map<string, string>()
    const byOldId = new Map<string, CanvasElement>()
    const created: CanvasElement[] = []

    for (const raw of elementsJson) {
        const json = raw as SceneElementJson
        let el: CanvasElement | undefined
        if (json.type === 'media') {
            el = new MediaFileCanvasElement(canvas, json.fileId ?? 0)
        } else if (json.type === 'note') {
            el = new NoteCanvasElement(canvas, json.noteText ?? '')
        } else if (json.type === 'group') {
            el = new GroupCanvasElement(canvas)
        }
        if (!el) continue

        if (json.transform) el.fromJSON(json)

        const newId = crypto.randomUUID()
        idMap.set(json.elementId, newId)
        el.elementId = newId
        byOldId.set(json.elementId, el)
        created.push(el)
        canvas.elementsDict.set(newId, el)

        if (el instanceof MediaFileCanvasElement) {
            canvas.mediaFileElements.push(el)
        } else if (el instanceof NoteCanvasElement) {
            canvas.noteElements.push(el)
        } else if (el instanceof GroupCanvasElement) {
            canvas.groupElements.push(el)
        }
    }

    // Wire transform hierarchy with the remapped ids.
    for (const raw of elementsJson) {
        const json = raw as SceneElementJson
        const el = byOldId.get(json.elementId)
        if (!el) continue
        const transform = el.transform
        for (const childId of json.transform?.children ?? []) {
            const newChildId = idMap.get(childId)
            const child = newChildId ? canvas.elementsDict.get(newChildId) : undefined
            if (child) {
                transform.children.set(child.elementId, child.transform)
                child.transform.parentTransform = transform
            }
        }
        const parentId = json.transform?.parent
        if (parentId && parentId !== 'root') {
            const newParentId = idMap.get(parentId)
            const parent = newParentId ? canvas.elementsDict.get(newParentId) : undefined
            if (parent) transform.parentTransform = parent.transform
        }
    }

    return created
}

import { CommandRegistry, ICommand } from '@renderer/core/command_system/UndoRedoManager'
import CanvasScene, { ZIndexChange } from '../ts/scene/CanvasScene'
import { useCanvasStore } from '../ts/useCanvasStore'
import {
    CanvasElement,
    GroupCanvasElement,
    MediaFileCanvasElement,
    NoteCanvasElement
} from '../ts/scene/CanvasElements'
import { Coordinates, Vector2 } from '../ts/scene/CanvasUtils'
import { NoteTransformSnapshot, RotActionTransform } from '../ts/scene/TransformBox'
import { parseScenePayload, parseUriList } from '@shared/clipboard/sceneClipboard'
import { mediaTypeFromExt } from '@shared/utils/mediaType'
import { MediaFile, MediaFileSourceType } from '@shared/types/models'
import { toastService } from '../../../core/toastService'
import {
    buildCanvasScenePayload,
    buildElementsFromSceneJson,
    collectEffectiveSelection,
    imageElementsOf,
    noteTextFallback,
    pasteAnchorPosition,
    placeAtPasteAnchor,
    selectionRootsOf
} from '../ts/clipboard/canvasClipboard'
import { composeSelectedImagesToPng } from '../ts/clipboard/bitmapComposer'

export type CanvasPastePayload =
    | { kind: 'scene'; elements: unknown[] }
    | { kind: 'note'; text: string }
    | { kind: 'mediaImport'; fileIds: number[]; sizes?: Record<number, { w: number; h: number }> }

export const CANVAS_COMMANDS = {
    ARRANGE: 'canvas_arrange',
    DELETE: 'canvas_delete',
    GROUP: 'canvas_group',
    UNGROUP: 'canvas_ungroup',
    MOVE: 'canvas_move',
    NORMALIZE_SIZE: 'canvas_normalize_size',
    NORMALIZE_SCALE: 'canvas_normalize_scale',
    BRING_TO_FRONT: 'canvas_bring_to_front',
    RESIZE: 'canvas_resize',
    ROTATE: 'canvas_rotate',
    SAVE: 'canvas_save',
    SAVE_AS: 'canvas_save_as',
    NOTE_RESIZE: 'canvas_note_resize',
    NOTE_TEXT_EDIT: 'canvas_note_text_edit',
    COPY: 'canvas_copy',
    CUT: 'canvas_cut',
    PASTE: 'canvas_paste'
} as const

class MoveCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined

    oldPositions = new Map<string, Coordinates>()
    newPositions = new Map<string, Coordinates>()
    groupId: string | undefined
    private zIndexChanges: ZIndexChange[] = []
    private prevHighestZIndex = 0

    constructor(private canvasScene: CanvasScene) {
        const { oldPositions, newPositions } = canvasScene.transformBox.moveAction.copy()
        this.oldPositions = oldPositions
        this.newPositions = newPositions

        this.groupId = canvasScene.transformBox.moveAction.groupId
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        this.newPositions.forEach((pos, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
            }
        })

        if (this.groupId) {
            const group = this.canvasScene.elementsDict.get(this.groupId) as
                GroupCanvasElement | undefined
            if (group) {
                group.addElements(this.canvasScene.getElementsById([...this.newPositions.keys()]))
                this.prevHighestZIndex = this.canvasScene.highestZIndex
                this.zIndexChanges = this.canvasScene.bringSelectionToFront(
                    this.canvasScene.getElementsById([...this.newPositions.keys()])
                )
            }
        }

        this.canvasScene.transformBox.notifyParents()
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        this.oldPositions.forEach((pos, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
            }
        })

        if (this.groupId) {
            this.canvasScene.revertZIndexChanges(this.zIndexChanges, this.prevHighestZIndex)
            this.zIndexChanges = []

            const group = this.canvasScene.elementsDict.get(this.groupId) as
                GroupCanvasElement | undefined
            if (group) {
                group.removeElements(
                    this.canvasScene.getElementsById([...this.newPositions.keys()])
                )
            }
        }

        this.canvasScene.transformBox.notifyParents()
    }
}

class UngroupCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private groupElementsMap: Map<string, string[]> = new Map() // partially removed, the group still exists
    private zIndexChanges: ZIndexChange[] = []
    private prevHighestZIndex = 0

    constructor(private canvasScene: CanvasScene) {
        this.canvasScene.selectedElements.forEach((el) => {
            if (el instanceof GroupCanvasElement) {
                this.groupElementsMap.set(
                    el.elementId,
                    el.children.map((c) => c.elementId)
                )
            } else {
                const parentEl = this.canvasScene.elementsDict.get(
                    el!.transform.parentTransform?.elementId ?? '-1'
                )
                if (parentEl && parentEl instanceof GroupCanvasElement) {
                    this.groupElementsMap.set(
                        parentEl.elementId,
                        this.groupElementsMap.get(parentEl.elementId)?.concat(el.elementId) ?? [
                            el.elementId
                        ]
                    )
                }
            }
        })
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        const allRemoved: CanvasElement[] = []

        this.groupElementsMap.forEach((elementIds, groupId) => {
            const group = this.canvasScene.elementsDict.get(groupId) as GroupCanvasElement

            group.removeElements(this.canvasScene.getElementsById(elementIds))
            allRemoved.push(...this.canvasScene.getElementsById(elementIds))

            if (group.children.length === 0) {
                this.canvasScene.removeGroup(groupId)
            }
        })

        if (allRemoved.length > 0) {
            this.prevHighestZIndex = this.canvasScene.highestZIndex
            this.zIndexChanges = this.canvasScene.bringSelectionToFront(allRemoved)
        }
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        this.canvasScene.revertZIndexChanges(this.zIndexChanges, this.prevHighestZIndex)
        this.zIndexChanges = []

        this.groupElementsMap.forEach((elementIds, groupId) => {
            const group = this.canvasScene.elementsDict.get(groupId) as
                GroupCanvasElement | undefined

            if (group) {
                group.addElements(this.canvasScene.getElementsById(elementIds))
            } else {
                const group = this.canvasScene.addGroup(groupId)
                group.addElements(this.canvasScene.getElementsById(elementIds))
            }
        })
    }
}

class GroupCommand implements ICommand {
    // creates and adds elements to the group
    undoable: boolean = true
    timestamp: number | undefined
    private elementIds: Array<string>
    private groupId?: string
    private zIndexChanges: ZIndexChange[] = []
    private prevHighestZIndex = 0

    constructor(private canvasScene: CanvasScene) {
        this.elementIds = this.canvasScene.selectedElements.map((el) => el.elementId)
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        const group = this.canvasScene.addGroup(this.groupId)
        this.groupId = group.elementId
        const el = this.canvasScene.getElementsById(this.elementIds)
        group.addElements(el)

        this.prevHighestZIndex = this.canvasScene.highestZIndex
        this.zIndexChanges = this.canvasScene.bringToFront(group)
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        if (!this.groupId) return

        this.canvasScene.revertZIndexChanges(this.zIndexChanges, this.prevHighestZIndex)
        this.zIndexChanges = []

        const group = this.canvasScene.elementsDict.get(this.groupId) as GroupCanvasElement
        group.ungroupAll()
        this.canvasScene.removeGroup(this.groupId)
    }
}

class SaveCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor(private canvasScene: CanvasScene) {}

    execute(): void {
        useCanvasStore().requestSave(this.canvasScene.id)
    }
    undo(): void {}
}

class SaveAsCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined

    constructor(private canvasScene: CanvasScene) {}

    execute(): void {
        useCanvasStore().requestSave(this.canvasScene.id, true)
    }
    undo(): void {}
}

class ArrangeCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private elements: Array<string>
    private oldPositions = new Map<string, Coordinates>()
    private newPositions = new Map<string, Coordinates>()

    constructor(private canvasScene: CanvasScene) {
        this.elements = this.canvasScene.getSelectedOrAll().map((el) => el.elementId)
        this.elements.forEach((id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                this.oldPositions.set(id, el.transform.position.asCoordinates())
            }
        })
    }

    execute(): void {
        if (this.elements.length === 0) return
        this.canvasScene.unsavedChanges = true

        this.canvasScene.arrange(this.canvasScene.getElementsById(this.elements))

        this.newPositions.clear()
        this.elements.forEach((id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                this.newPositions.set(id, el.transform.position.asCoordinates())
            }
        })
        this.canvasScene.onSelectionChange()
    }
    undo(): void {
        if (this.oldPositions.size === 0) return
        this.canvasScene.unsavedChanges = true
        this.oldPositions.forEach((pos, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
            }
        })
        this.canvasScene.onSelectionChange()
    }
}

class DeleteCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private removed: CanvasElement[]

    constructor(private canvasScene: CanvasScene) {
        this.removed = this.canvasScene.getSelectedOrAll()
    }

    execute(): void {
        if (this.removed.length === 0) return
        this.canvasScene.unsavedChanges = true
        this.canvasScene.removeElements(this.removed)
    }
    undo(): void {
        if (this.removed.length === 0) return
        this.canvasScene.unsavedChanges = true
        this.canvasScene.restoreElements(this.removed)
    }
}

class NormalizeSizeCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private elements: Array<string>
    private oldScales = new Map<string, number>()
    private newScales = new Map<string, number>()

    constructor(private canvasScene: CanvasScene) {
        this.elements = this.canvasScene.getSelectedOrAll().map((el) => el.elementId)
        this.elements.forEach((id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                this.oldScales.set(id, el.transform.scale)
            }
        })
    }

    execute(): void {
        if (this.elements.length === 0) return
        this.canvasScene.unsavedChanges = true

        let target = 0
        this.elements.forEach((id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                target = Math.max(
                    target,
                    Math.max(el.transform.scaledWidth(), el.transform.scaledHeight())
                )
            }
        })

        this.newScales.clear()
        this.elements.forEach((id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (!el) return
            const longerEdge = Math.max(el.transform.scaledWidth(), el.transform.scaledHeight())
            if (longerEdge > 0 && longerEdge < target) {
                el.transform.rescale(target / longerEdge)
            }
            this.newScales.set(id, el.transform.scale)
        })
        this.canvasScene.onSelectionChange()
    }
    undo(): void {
        if (this.oldScales.size === 0) return
        this.canvasScene.unsavedChanges = true
        this.oldScales.forEach((scale, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setScale(scale)
            }
        })
        this.canvasScene.onSelectionChange()
    }
}

class NormalizeScaleCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private elements: Array<string>
    private oldScales = new Map<string, number>()

    constructor(private canvasScene: CanvasScene) {
        this.elements = this.canvasScene.getSelectedOrAll().map((el) => el.elementId)
        this.elements.forEach((id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                this.oldScales.set(id, el.transform.scale)
            }
        })
    }

    execute(): void {
        if (this.elements.length === 0) return
        this.canvasScene.unsavedChanges = true
        this.elements.forEach((id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el && el.transform.scale !== 1) {
                el.transform.setScale(1)
            }
        })
        this.canvasScene.onSelectionChange()
    }
    undo(): void {
        if (this.oldScales.size === 0) return
        this.canvasScene.unsavedChanges = true
        this.oldScales.forEach((scale, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setScale(scale)
            }
        })
        this.canvasScene.onSelectionChange()
    }
}

class BringToFrontCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private zIndexChanges: ZIndexChange[] = []
    private prevHighestZIndex = 0

    constructor(private canvasScene: CanvasScene) {}

    execute(): void {
        if (this.canvasScene.selectedElements.length === 0) return
        this.canvasScene.unsavedChanges = true
        this.prevHighestZIndex = this.canvasScene.highestZIndex
        this.zIndexChanges = this.canvasScene.bringSelectionToFront(
            this.canvasScene.selectedElements
        )
    }
    undo(): void {
        if (this.zIndexChanges.length === 0) return
        this.canvasScene.unsavedChanges = true
        this.canvasScene.revertZIndexChanges(this.zIndexChanges, this.prevHighestZIndex)
        this.zIndexChanges = []
    }
}

class ResizeCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    oldTransforms = new Map<string, RotActionTransform>()
    newTransforms = new Map<string, RotActionTransform>()

    constructor(private canvasScene: CanvasScene) {
        const { oldTransforms, newTransforms } = canvasScene.transformBox.resizeAction.copy()
        this.oldTransforms = oldTransforms
        this.newTransforms = newTransforms
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        this.newTransforms.forEach(({ pos, rotOrScale }, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
                el.transform.setScale(rotOrScale)
            }
        })
        this.canvasScene.transformBox.notifyParents()
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        this.oldTransforms.forEach(({ pos, rotOrScale }, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
                el.transform.setScale(rotOrScale)
            }
        })
        this.canvasScene.transformBox.notifyParents()
    }
}

class RotateCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    oldTransforms = new Map<string, RotActionTransform>()
    newTransforms = new Map<string, RotActionTransform>()

    constructor(private canvasScene: CanvasScene) {
        const { oldTransforms, newTransforms } = canvasScene.transformBox.rotateAction.copy()
        this.oldTransforms = oldTransforms
        this.newTransforms = newTransforms
    }

    execute(): void {
        this.canvasScene.unsavedChanges = true
        this.newTransforms.forEach(({ pos, rotOrScale }, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
                el.transform.setRotation(rotOrScale)
            }
        })
        this.canvasScene.transformBox.notifyParents()
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        this.oldTransforms.forEach(({ pos, rotOrScale }, id) => {
            const el = this.canvasScene.elementsDict.get(id)
            if (el) {
                el.transform.setPos(pos)
                el.transform.setRotation(rotOrScale)
            }
        })
        this.canvasScene.transformBox.notifyParents()
    }
}

class NoteResizeCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private noteId: string
    private oldTransform: NoteTransformSnapshot
    private newTransform: NoteTransformSnapshot

    constructor(private canvasScene: CanvasScene) {
        const note = canvasScene.editedNote as NoteCanvasElement
        this.noteId = note.elementId
        const { oldTransform, newTransform } = note.resizeAction.copy()
        this.oldTransform = oldTransform
        this.newTransform = newTransform
    }

    execute(): void {
        const note = this.canvasScene.elementsDict.get(this.noteId) as NoteCanvasElement
        if (!note) return
        this.canvasScene.unsavedChanges = true
        const { pos, width, height, scale } = this.newTransform
        note.transform.setPos(pos)
        note.transform.width = width
        note.transform.height = height
        note.transform.scale = scale
    }
    undo(): void {
        const note = this.canvasScene.elementsDict.get(this.noteId) as NoteCanvasElement
        if (!note) return
        this.canvasScene.unsavedChanges = true
        const { pos, width, height, scale } = this.oldTransform
        note.transform.setPos(pos)
        note.transform.width = width
        note.transform.height = height
        note.transform.scale = scale
    }
}

class NoteTextEditCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private noteId: string
    private oldText: string
    private newText: string

    constructor(private canvasScene: CanvasScene) {
        const note = canvasScene.editedNote as NoteCanvasElement
        this.noteId = note.elementId
        this.oldText = note.textEditOldText
        this.newText = note.noteText
    }

    execute(): void {
        const note = this.canvasScene.elementsDict.get(this.noteId) as NoteCanvasElement | undefined
        if (!note) return
        this.canvasScene.unsavedChanges = true
        note.noteText = this.newText
    }
    undo(): void {
        const note = this.canvasScene.elementsDict.get(this.noteId) as NoteCanvasElement | undefined
        if (!note) return
        this.canvasScene.unsavedChanges = true
        note.noteText = this.oldText
    }
}

class CopyCommand implements ICommand {
    undoable: boolean = false
    timestamp: number | undefined
    private effective: CanvasElement[]
    private text: string | undefined

    constructor(canvasScene: CanvasScene) {
        console.log('copy command')
        this.effective = collectEffectiveSelection(canvasScene)
        this.text = noteTextFallback(this.effective)
    }

    async execute(): Promise<void> {
        console.log({ eff: this.effective, txt: this.text })

        if (this.effective.length === 0) return
        const scene = buildCanvasScenePayload(this.effective)
        const images = imageElementsOf(this.effective)
        const mediaTotal = this.effective.filter((e) => e instanceof MediaFileCanvasElement).length
        if (mediaTotal > 0 && images.length === 0) {
            console.warn(
                '[clipboard] selection has',
                mediaTotal,
                'media elements but none have a decoded size (width 0) - no image format written'
            )
        }
        const imageDataUrl = await composeSelectedImagesToPng(images)
        if (!imageDataUrl) {
            console.warn('[clipboard] copy wrote no image format (compose returned null)')
        }
        await window.api.clipboard.write({
            scene,
            text: this.text,
            imageDataUrl: imageDataUrl ?? undefined
        })
    }
    undo(): void {}
}

class CutCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private removed: CanvasElement[]
    private effective: CanvasElement[]
    private text: string | undefined
    private didClipboardWrite = false

    constructor(private canvasScene: CanvasScene) {
        this.removed = canvasScene.getSelected()
        this.effective = collectEffectiveSelection(canvasScene)
        this.text = noteTextFallback(this.effective)
    }

    async execute(): Promise<void> {
        if (this.removed.length === 0) return
        this.canvasScene.unsavedChanges = true

        if (!this.didClipboardWrite) {
            const scene = buildCanvasScenePayload(this.effective)
            const images = imageElementsOf(this.effective)
            const mediaTotal = this.effective.filter(
                (e) => e instanceof MediaFileCanvasElement
            ).length
            if (mediaTotal > 0 && images.length === 0) {
                console.warn(
                    '[clipboard] selection has',
                    mediaTotal,
                    'media elements but none have a decoded size (width 0) - no image format written'
                )
            }
            const imageDataUrl = await composeSelectedImagesToPng(images)
            if (!imageDataUrl) {
                console.warn('[clipboard] cut wrote no image format (compose returned null)')
            }
            await window.api.clipboard.write({
                scene,
                text: this.text,
                imageDataUrl: imageDataUrl ?? undefined
            })
            this.didClipboardWrite = true
        }

        this.canvasScene.removeElements(this.removed)
    }
    undo(): void {
        this.canvasScene.unsavedChanges = true
        // restore the full subtree (group + children) — the roots-only array is
        // only safe for removal; the effective set is the deduped subtree
        this.canvasScene.restoreElements(this.effective)
        // clipboard is intentionally left untouched on undo
    }
}

class PasteCommand implements ICommand {
    undoable: boolean = true
    timestamp: number | undefined
    private created: CanvasElement[] = []
    private hasBuilt = false
    private pivot: Vector2
    private payload: CanvasPastePayload | null = null
    private zIndexChanges: ZIndexChange[] = []
    private prevHighestZIndex = 0

    constructor(private canvasScene: CanvasScene) {
        this.pivot = pasteAnchorPosition(canvasScene)
    }

    async execute(): Promise<void> {
        this.canvasScene.unsavedChanges = true

        if (!this.hasBuilt) {
            this.payload = await this.readClipboardPayload()
            if (!this.payload) return // nothing usable on the clipboard -> silent no-op
            this.created = this.buildElements(this.payload)
            this.hasBuilt = true
        } else if (this.created.every((e) => !this.canvasScene.elementsDict.has(e.elementId))) {
            // redo after undo -> re-insert the same element objects
            this.canvasScene.restoreElements(this.created)
        }

        if (this.created.length === 0) return

        // Pasted elements keep their relative layout (already-positioned payloads
        // such as canvas-to-canvas copies) or stack at the anchor (transform-less
        // pastes); no potpack repacking — imported image sizes arrive
        // asynchronously, so packing would be computed from stale/zero sizes.
        placeAtPasteAnchor(this.created, this.pivot)
        this.canvasScene.setSelection(selectionRootsOf(this.created))

        this.prevHighestZIndex = this.canvasScene.highestZIndex
        this.zIndexChanges = this.canvasScene.bringSelectionToFront(this.created)
    }
    undo(): void {
        if (this.created.length === 0) return
        this.canvasScene.unsavedChanges = true
        this.canvasScene.revertZIndexChanges(this.zIndexChanges, this.prevHighestZIndex)
        this.zIndexChanges = []
        this.canvasScene.removeElements(this.created)
    }

    // Priority: custom scene payload -> plain text -> image payload -> file
    // uri-list. Unknown/empty clipboards are a silent no-op.
    private async readClipboardPayload(): Promise<CanvasPastePayload | null> {
        const clip = await window.api.clipboard.read()

        const scene = parseScenePayload(clip.scene)
        if (scene && scene.elements.length > 0) {
            return { kind: 'scene', elements: scene.elements }
        }

        const text = clip.text.trim()
        if (text.length > 0) {
            return { kind: 'note', text: clip.text }
        }

        if (clip.imageDataUrl) {
            const imported = await window.api.clipboard.importImage(clip.imageDataUrl)
            if (!imported.success) {
                toastService.add({
                    severity: 'error',
                    summary: 'Paste failed',
                    detail: imported.error
                })
                return null
            }
            const sizes: Record<number, { w: number; h: number }> = {}
            const size = await resolveMediaSize(imported.data)
            if (size) sizes[imported.data.id] = size
            return { kind: 'mediaImport', fileIds: [imported.data.id], sizes }
        }

        const paths = parseUriList(clip.uriListText)
        if (paths.length === 0) return null

        const imported: MediaFile[] = []
        const failed: string[] = []
        for (const p of paths) {
            const mediaType = mediaTypeFromExt(extOf(p))
            const result = await window.api.files.insertMediaFile({
                source: MediaFileSourceType.LOCAL,
                fileName: pathNameOf(p),
                mediaType: mediaType ?? 'image',
                filePath: p
            })
            if (result.success) {
                const mf = await window.api.files.getMediaFileOfId(result.data.id)
                if (mf.success) imported.push(mf.data)
                else failed.push(pathNameOf(p))
            } else {
                failed.push(pathNameOf(p))
            }
        }
        if (failed.length > 0) {
            toastService.add({
                severity: 'error',
                summary: 'Paste failed',
                detail: `Could not import ${failed.length} file(s): ${failed.slice(0, 3).join(', ')}`
            })
        }
        if (imported.length === 0) return null

        const sizes: Record<number, { w: number; h: number }> = {}
        for (const mf of imported) {
            const size = await resolveMediaSize(mf)
            if (size) sizes[mf.id] = size
        }
        return { kind: 'mediaImport', fileIds: imported.map((m) => m.id), sizes }
    }

    private buildElements(payload: CanvasPastePayload): CanvasElement[] {
        if (payload.kind === 'scene') {
            return buildElementsFromSceneJson(this.canvasScene, payload.elements)
        }

        if (payload.kind === 'note') {
            const note = new NoteCanvasElement(this.canvasScene, payload.text)
            this.canvasScene.noteElements.push(note)
            this.canvasScene.elementsDict.set(note.elementId, note)
            return [note]
        }

        const created: MediaFileCanvasElement[] = []
        for (const fileId of payload.fileIds) {
            const el = new MediaFileCanvasElement(this.canvasScene, fileId)
            const size = payload.sizes?.[fileId]
            if (size) {
                el.transform.width = size.w
                el.transform.height = size.h
            }
            this.canvasScene.mediaFileElements.push(el)
            this.canvasScene.elementsDict.set(el.elementId, el)
            created.push(el)
        }
        return created
    }
}

async function resolveMediaSize(mf: MediaFile): Promise<{ w: number; h: number } | undefined> {
    if (mf.mediaType !== 'image') return undefined
    try {
        const blob = await fetch(`media://load?path=${encodeURIComponent(mf.filePath)}`).then((r) =>
            r.blob()
        )
        const bitmap = await createImageBitmap(blob)
        const size = { w: bitmap.width, h: bitmap.height }
        bitmap.close()
        return size
    } catch {
        return undefined
    }
}

function pathNameOf(p: string): string {
    const seg = p.replace(/\\/g, '/').split('/').pop()
    return seg && seg.length > 0 ? seg : 'pasted-file'
}

function extOf(p: string): string {
    const m = p.replace(/\\/g, '/').match(/\.[a-zA-Z0-9]+$/)
    return m ? m[0] : ''
}

export function registerCanvasCommands(commandRegistry: CommandRegistry) {
    const activeScene = () => useCanvasStore().getActiveCanvas as CanvasScene
    const scope = 'canvas'

    const isActiveCanvas = () => {
        return activeScene() != undefined
    }
    const hasSelectedElements = () => {
        const scene = activeScene()
        if (!scene) return false
        return scene.selectedElements.length > 0
    }
    const hasCanvasElements = () => {
        const scene = activeScene()
        if (!scene) return false
        return scene.getAllSelectable().length > 0
    }

    commandRegistry.register({
        id: CANVAS_COMMANDS.ARRANGE,
        label: 'Arrange',
        scope,
        showInPalette: true,
        keybind: 'alt+a',
        when: hasCanvasElements,
        create: () => new ArrangeCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.GROUP,
        label: 'Group',
        scope,
        showInPalette: true,
        keybind: 'ctrl+g',
        when: hasSelectedElements,
        create: () => new GroupCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.UNGROUP,
        label: 'Ungroup',
        scope,
        showInPalette: true,
        keybind: 'ctrl+shift+g',
        when: hasSelectedElements,
        create: () => new UngroupCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.MOVE,
        label: 'Move',
        scope,
        showInPalette: false,
        keybind: '',
        when: hasSelectedElements,
        create: () => new MoveCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.ROTATE,
        label: 'Rotate',
        scope,
        showInPalette: false,
        keybind: '',
        when: hasSelectedElements,
        create: () => new RotateCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.RESIZE,
        label: 'Resize',
        scope,
        showInPalette: false,
        keybind: '',
        when: hasSelectedElements,
        create: () => new ResizeCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.SAVE,
        label: 'Save Canvas',
        scope,
        showInPalette: true,
        keybind: 'ctrl+s',
        when: isActiveCanvas,
        create: () => new SaveCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.SAVE_AS,
        label: 'Save Canvas As',
        scope,
        showInPalette: true,
        keybind: 'ctrl+shift+s',
        when: isActiveCanvas,
        create: () => new SaveAsCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.NOTE_RESIZE,
        label: 'Note Resize',
        scope,
        showInPalette: false,
        keybind: '',
        when: () => {
            const scene = activeScene()
            if (!scene) return false
            return scene.editedNote instanceof NoteCanvasElement
        },
        create: () => new NoteResizeCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.NOTE_TEXT_EDIT,
        label: 'Edit Note Text',
        scope,
        showInPalette: false,
        keybind: '',
        when: () => {
            const scene = activeScene()
            if (!scene) return false
            return scene.editedNote instanceof NoteCanvasElement
        },
        create: () => new NoteTextEditCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.BRING_TO_FRONT,
        label: 'Bring to Front',
        scope,
        showInPalette: false,
        keybind: '',
        when: hasSelectedElements,
        create: () => new BringToFrontCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.NORMALIZE_SIZE,
        label: 'Normalize Size',
        scope,
        showInPalette: true,
        keybind: 'alt+s',
        when: hasCanvasElements,
        create: () => new NormalizeSizeCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.NORMALIZE_SCALE,
        label: 'Normalize Scale',
        scope,
        showInPalette: true,
        keybind: 'alt+shift+s',
        when: hasCanvasElements,
        create: () => new NormalizeScaleCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.DELETE,
        label: 'Delete',
        scope,
        showInPalette: true,
        keybind: 'delete',
        when: hasCanvasElements,
        create: () => new DeleteCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.COPY,
        label: 'Copy',
        scope,
        showInPalette: true,
        keybind: 'ctrl+c',
        when: hasSelectedElements,
        create: () => new CopyCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.CUT,
        label: 'Cut',
        scope,
        showInPalette: true,
        keybind: 'ctrl+x',
        when: hasSelectedElements,
        create: () => new CutCommand(activeScene()!)
    })

    commandRegistry.register({
        id: CANVAS_COMMANDS.PASTE,
        label: 'Paste',
        scope,
        showInPalette: true,
        keybind: 'ctrl+v',
        when: isActiveCanvas,
        create: () => new PasteCommand(activeScene()!)
    })
}

import { CommandRegistry, ICommand } from '@renderer/core/command_system/UndoRedoManager'
import { useExplorerStore } from '../ts/useExplorerStore'
import { Explorer } from '../ts/createExplorer'
import { useCanvasStore } from '../../canvas/ts/useCanvasStore'
import { useFileStore } from '@renderer/core/stores/useFileStore'
import { useTagStore } from '@renderer/core/stores/useTagStore'
import { AppContext } from '@renderer/core/command_system/AppContext'

export const EXPLORER_COMMANDS = {
    SELECT_ALL: 'select_all',
    DELETE_SELECTED: 'delete_selected',
    ADD_TO_NEW_CANVAS: 'add_to_new_canvas',
    VIEW_IN_GALLERIA: 'view_in_galleria',
    ADD_TAGS_TO_FILES: 'add_tags_to_files',
    REMOVE_TAGS_FROM_FILES: 'remove_tags_from_files'
} as const

class SelectAllCommand implements ICommand {
    undoable = false
    timestamp: number | undefined

    constructor(private explorer: Explorer) {}

    execute(): void {
        const sel = this.explorer.selection.selectedIds
        sel.clear()
        for (const id of this.explorer.mediaFiles.keys()) sel.add(id)
    }
    undo(): void {}
}

class DeleteSelectedCommand implements ICommand {
    undoable = true
    timestamp: number | undefined
    private deletedIds: number[] = []

    constructor(private explorer: Explorer) {
        this.deletedIds = [...this.explorer.selection.selectedIds]
    }

    execute(): void {
        console.log('TODO: DELETE_SELECTED — implement IPC api:files:delete', this.deletedIds)
    }
    undo(): void {
        console.log('TODO: undo DELETE_SELECTED')
    }
}

class AddToNewCanvasCommand implements ICommand {
    undoable = false
    timestamp: number | undefined
    private fileIds: number[] = []

    constructor(private explorer: Explorer) {
        this.fileIds = [...this.explorer.selection.selectedIds]
    }

    execute(): void {
        useCanvasStore().addAndOpenNewCanvas(this.fileIds)
    }
    undo(): void {}
}

class ViewInGalleriaCommand implements ICommand {
    undoable = false
    timestamp: number | undefined

    constructor(private explorer: Explorer) {}

    execute(): void {
        if (this.explorer.selectedItems.length === 0) return
        console.log(
            'TODO: VIEW_IN_GALLERIA — open galleria for',
            this.explorer.selectedItems.map((f) => f.id)
        )
    }
    undo(): void {}
}

class AddTagsToFilesCommand implements ICommand {
    undoable = true
    timestamp: number | undefined
    private addedFilesByTagId: Record<number, number[]> = {}
    private createdTagIds: number[] = []
    private tagNames: string[] = []
    private fileIds: number[] = []

    constructor(
        private explorer: Explorer,
        tagNames: string[],
        fileIds: number[]
    ) {
        this.tagNames = [...tagNames]
        this.fileIds = [...fileIds]
    }

    async execute(): Promise<void> {
        const data = await useFileStore().addTagsToFiles(this.tagNames, this.fileIds)
        if (!data) return

        this.addedFilesByTagId = data.addedFilesByTagId
        this.createdTagIds = data.createdTagIds

        if (this.createdTagIds.length > 0) {
            await useTagStore().fetchTags()
        }

        await this.refreshExplorer()
    }

    async undo(): Promise<void> {
        const tagIds = Object.keys(this.addedFilesByTagId).map(Number)
        const allFileIds = [...new Set(Object.values(this.addedFilesByTagId).flat())]
        if (tagIds.length === 0) return

        const removeData = await useFileStore().removeTagsFromFiles(tagIds, allFileIds)
        if (!removeData) return

        for (const tagId of this.createdTagIds) {
            if ((removeData.remainingFileTagCount[tagId] ?? 0) === 0) {
                const deleted = await useFileStore().deleteTag(tagId)
                if (deleted) useTagStore().removeTagLocally(tagId)
            }
        }

        await this.refreshExplorer()
    }

    private async refreshExplorer(): Promise<void> {
        const affectedIds = [...new Set(Object.values(this.addedFilesByTagId).flat())]
        if (affectedIds.length === 0) return
        const files = await useFileStore().fetchFilesOfIds(affectedIds)
        if (files.length > 0) this.explorer.applyFilesUpdate(files)
    }
}

class RemoveTagsFromFilesCommand implements ICommand {
    undoable = true
    timestamp: number | undefined
    private removedFilesByTagId: Record<number, number[]> = {}
    private tagNames: string[] = []
    private tagIds: number[] = []
    private fileIds: number[] = []

    constructor(
        private explorer: Explorer,
        tagNames: string[],
        tagIds: number[],
        fileIds: number[]
    ) {
        this.tagNames = [...tagNames]
        this.tagIds = [...tagIds]
        this.fileIds = [...fileIds]
        console.log(this.tagNames)
    }

    async execute(): Promise<void> {
        const data = await useFileStore().removeTagsFromFiles(this.tagIds, this.fileIds)
        if (!data) return

        this.removedFilesByTagId = data.removedFilesByTagId

        await this.refreshExplorer()
    }

    async undo(): Promise<void> {
        if (this.removedFilesByTagId && Object.keys(this.removedFilesByTagId).length > 0) {
            const allFileIds = [...new Set(Object.values(this.removedFilesByTagId).flat())]
            const reAddData = await useFileStore().addTagsToFiles(this.tagNames, allFileIds)
            if (reAddData && reAddData.createdTagIds.length > 0) {
                await useTagStore().fetchTags()
            }
        }

        await this.refreshExplorer()
    }

    private async refreshExplorer(): Promise<void> {
        const affectedIds = [...new Set(Object.values(this.removedFilesByTagId).flat())]
        if (affectedIds.length === 0) return
        const files = await useFileStore().fetchFilesOfIds(affectedIds)
        if (files.length > 0) this.explorer.applyFilesUpdate(files)
    }
}

export function registerExplorerCommands(commandRegistry: CommandRegistry) {
    const activeExplorer = () => useExplorerStore().getActiveExplorer
    const scope = 'explorer'

    const isActiveExplorer = () => activeExplorer() !== null
    const hasSelection = () => {
        const e = activeExplorer()

        return e !== null && e.selection.selectedIds.size > 0
    }

    commandRegistry.register({
        id: EXPLORER_COMMANDS.SELECT_ALL,
        label: 'Select All',
        scope,
        showInPalette: false,
        keybind: 'ctrl+a',
        when: isActiveExplorer,
        create: () => new SelectAllCommand(activeExplorer()!)
    })

    commandRegistry.register({
        id: EXPLORER_COMMANDS.DELETE_SELECTED,
        label: 'Delete Selected',
        scope,
        showInPalette: false,
        keybind: '',
        when: hasSelection,
        create: () => new DeleteSelectedCommand(activeExplorer()!)
    })

    commandRegistry.register({
        id: EXPLORER_COMMANDS.ADD_TO_NEW_CANVAS,
        label: 'Add to New Canvas',
        scope,
        showInPalette: true,
        keybind: 'ctrl+n',
        when: hasSelection,
        create: () => new AddToNewCanvasCommand(activeExplorer()!)
    })

    commandRegistry.register({
        id: EXPLORER_COMMANDS.VIEW_IN_GALLERIA,
        label: 'View in Galleria',
        scope,
        showInPalette: false,
        keybind: 'g',
        when: hasSelection,
        create: () => new ViewInGalleriaCommand(activeExplorer()!)
    })

    commandRegistry.register({
        id: EXPLORER_COMMANDS.ADD_TAGS_TO_FILES,
        label: 'Add Tags to Files',
        scope,
        showInPalette: false,
        keybind: '',
        when: isActiveExplorer,
        create: (_context: AppContext, tagNames: string[], fileIds: number[]) =>
            new AddTagsToFilesCommand(activeExplorer()!, tagNames, fileIds)
    })

    commandRegistry.register({
        id: EXPLORER_COMMANDS.REMOVE_TAGS_FROM_FILES,
        label: 'Remove Tags from Files',
        scope,
        showInPalette: false,
        keybind: '',
        when: isActiveExplorer,
        create: (_context: AppContext, tagNames: string[], tagIds: number[], fileIds: number[]) =>
            new RemoveTagsFromFilesCommand(activeExplorer()!, tagNames, tagIds, fileIds)
    })
}

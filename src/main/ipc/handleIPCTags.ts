import { IpcMain } from 'electron'
import { TagService } from '../services/TagService'
import { LocalDatabaseService } from '../services/LocalDatabaseService'

export function registerIPCTagsHandlers(
    ipcMain: IpcMain,
    dbService: LocalDatabaseService,
    tagService: TagService
): void {
    ipcMain.handle('api:tags:getAll', () => {
        return tagService.getAllTags()
    })

    ipcMain.handle('api:tags:create', (_event, name: string, color: string) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.createTag(name, color)
    })

    ipcMain.handle('api:tags:delete', (_event, id: number) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.deleteTag(id)
    })

    ipcMain.handle('api:tags:updateName', (_event, id: number, name: string) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.updateTagName(id, name)
    })

    ipcMain.handle('api:tags:updateColor', (_event, id: number, color: string) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.updateTagColor(id, color)
    })

    ipcMain.handle('api:tags:getAllColors', () => {
        return tagService.getAllTagColors()
    })

    ipcMain.handle('api:tags:getSubtags', (_event, parentId: number) => {
        return tagService.getDirectSubtagIds(parentId)
    })

    ipcMain.handle('api:tags:addSubtags', (_event, parentId: number, childIds: number[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.addSubtags(parentId, childIds)
    })

    ipcMain.handle('api:tags:removeSubtags', (_event, parentId: number, childIds: number[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.removeSubtags(parentId, childIds)
    })

    ipcMain.handle('api:tags:getAllRelations', () => {
        return tagService.getAllRelations()
    })

    ipcMain.handle('api:tags:getParents', (_event, childId: number) => {
        return tagService.getDirectParentIds(childId)
    })

    ipcMain.handle('api:tags:addParents', (_event, childId: number, parentIds: number[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.addParents(childId, parentIds)
    })

    ipcMain.handle('api:tags:removeParents', (_event, childId: number, parentIds: number[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.removeParents(childId, parentIds)
    })

    ipcMain.handle('api:tags:addToFiles', (_event, tagNames: string[], fileIds: number[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.addTagsToFiles(tagNames, fileIds)
    })

    ipcMain.handle('api:tags:removeFromFiles', (_event, tagIds: number[], fileIds: number[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.removeTagsFromFiles(tagIds, fileIds)
    })
}

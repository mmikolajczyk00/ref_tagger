import { IpcMain } from 'electron'
import { LocalDatabaseService } from '../services/LocalDatabaseService'

export function registerIPCTagsHandlers(ipcMain: IpcMain, dbService: LocalDatabaseService): void {
    ipcMain.handle('api:tags:getAll', () => {
        return dbService.getAllTags()
    })

    ipcMain.handle('api:tags:create', (_event, name: string, color: string) => {
        return dbService.createTag(name, color)
    })

    ipcMain.handle('api:tags:delete', (_event, id: number) => {
        return dbService.deleteTag(id)
    })

    ipcMain.handle('api:tags:updateName', (_event, id: number, name: string) => {
        return dbService.updateTagName(id, name)
    })

    ipcMain.handle('api:tags:updateColor', (_event, id: number, color: string) => {
        return dbService.updateTagColor(id, color)
    })

    ipcMain.handle('api:tags:getAllColors', () => {
        return dbService.getAllTagColors()
    })

    ipcMain.handle('api:tags:getSubtags', (_event, parentId: number) => {
        return dbService.getDirectSubtagIds(parentId)
    })

    ipcMain.handle('api:tags:addSubtags', (_event, parentId: number, childIds: number[]) => {
        return dbService.addSubtags(parentId, childIds)
    })

    ipcMain.handle('api:tags:removeSubtags', (_event, parentId: number, childIds: number[]) => {
        return dbService.removeSubtags(parentId, childIds)
    })

    ipcMain.handle('api:tags:getAllRelations', () => {
        return dbService.getAllRelations()
    })

    ipcMain.handle('api:tags:getParents', (_event, childId: number) => {
        return dbService.getDirectParentIds(childId)
    })

    ipcMain.handle('api:tags:addParents', (_event, childId: number, parentIds: number[]) => {
        return dbService.addParents(childId, parentIds)
    })

    ipcMain.handle('api:tags:removeParents', (_event, childId: number, parentIds: number[]) => {
        return dbService.removeParents(childId, parentIds)
    })
}

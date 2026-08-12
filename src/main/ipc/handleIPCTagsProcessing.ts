import { IpcMain } from 'electron'
import { LocalDatabaseService } from '../services/LocalDatabaseService'

export function registerIPCTagsProcessingHandlers(
    ipcMain: IpcMain,
    dbService: LocalDatabaseService
): void {
    // Blacklist

    ipcMain.handle('api:tagsProcessing:blacklist:getAll', () => {
        return dbService.getAllBlacklists()
    })

    ipcMain.handle('api:tagsProcessing:blacklist:get', (_event, id: number) => {
        return dbService.getBlacklist(id)
    })

    ipcMain.handle('api:tagsProcessing:blacklist:create', (_event, listName: string) => {
        return dbService.createBlacklist(listName)
    })

    ipcMain.handle(
        'api:tagsProcessing:blacklist:rename',
        (_event, id: number, listName: string) => {
            return dbService.renameBlacklist(id, listName)
        }
    )

    ipcMain.handle('api:tagsProcessing:blacklist:delete', (_event, id: number) => {
        return dbService.deleteBlacklist(id)
    })

    ipcMain.handle('api:tagsProcessing:blacklist:addTags', (_event, id: number, tags: string[]) => {
        return dbService.addBlacklistTags(id, tags)
    })

    ipcMain.handle('api:tagsProcessing:blacklist:removeTag', (_event, id: number, tag: string) => {
        return dbService.removeBlacklistTag(id, tag)
    })

    // Aliases

    ipcMain.handle('api:tagsProcessing:aliases:getAll', () => {
        return dbService.getAllAliases()
    })

    ipcMain.handle('api:tagsProcessing:aliases:get', (_event, id: number) => {
        return dbService.getAlias(id)
    })

    ipcMain.handle('api:tagsProcessing:aliases:create', (_event, realTag: string) => {
        return dbService.createAlias(realTag)
    })

    ipcMain.handle('api:tagsProcessing:aliases:rename', (_event, id: number, realTag: string) => {
        return dbService.renameAlias(id, realTag)
    })

    ipcMain.handle('api:tagsProcessing:aliases:delete', (_event, id: number) => {
        return dbService.deleteAlias(id)
    })

    ipcMain.handle('api:tagsProcessing:aliases:addTags', (_event, id: number, tags: string[]) => {
        return dbService.addAliasTags(id, tags)
    })

    ipcMain.handle('api:tagsProcessing:aliases:removeTag', (_event, id: number, tag: string) => {
        return dbService.removeAliasTag(id, tag)
    })
}

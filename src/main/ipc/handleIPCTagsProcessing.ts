import { IpcMain } from 'electron'
import { TagsProcessingService } from '../services/TagsProcessingService'
import { LocalDatabaseService } from '../services/LocalDatabaseService'

export function registerIPCTagsProcessingHandlers(
    ipcMain: IpcMain,
    dbService: LocalDatabaseService,
    tagsProcessingService: TagsProcessingService
): void {
    // Blacklist

    ipcMain.handle('api:tagsProcessing:blacklist:getAll', () => {
        return tagsProcessingService.getAllBlacklists()
    })

    ipcMain.handle('api:tagsProcessing:blacklist:get', (_event, id: number) => {
        return tagsProcessingService.getBlacklist(id)
    })

    ipcMain.handle('api:tagsProcessing:blacklist:create', (_event, listName: string) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagsProcessingService.createBlacklist(listName)
    })

    ipcMain.handle(
        'api:tagsProcessing:blacklist:rename',
        (_event, id: number, listName: string) => {
            if (dbService.isLocked) return { success: false, error: 'Database is locked' }
            return tagsProcessingService.renameBlacklist(id, listName)
        }
    )

    ipcMain.handle('api:tagsProcessing:blacklist:delete', (_event, id: number) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagsProcessingService.deleteBlacklist(id)
    })

    ipcMain.handle('api:tagsProcessing:blacklist:addTags', (_event, id: number, tags: string[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagsProcessingService.addBlacklistTags(id, tags)
    })

    ipcMain.handle('api:tagsProcessing:blacklist:removeTag', (_event, id: number, tag: string) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagsProcessingService.removeBlacklistTag(id, tag)
    })

    ipcMain.handle(
        'api:tagsProcessing:blacklist:removeTags',
        (_event, id: number, tags: string[]) => {
            if (dbService.isLocked) return { success: false, error: 'Database is locked' }
            return tagsProcessingService.removeBlacklistTags(id, tags)
        }
    )

    // Aliases

    ipcMain.handle('api:tagsProcessing:aliases:getAll', () => {
        return tagsProcessingService.getAllAliases()
    })

    ipcMain.handle('api:tagsProcessing:aliases:get', (_event, id: number) => {
        return tagsProcessingService.getAlias(id)
    })

    ipcMain.handle('api:tagsProcessing:aliases:create', (_event, realTag: string) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagsProcessingService.createAlias(realTag)
    })

    ipcMain.handle('api:tagsProcessing:aliases:rename', (_event, id: number, realTag: string) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagsProcessingService.renameAlias(id, realTag)
    })

    ipcMain.handle('api:tagsProcessing:aliases:delete', (_event, id: number) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagsProcessingService.deleteAlias(id)
    })

    ipcMain.handle('api:tagsProcessing:aliases:addTags', (_event, id: number, tags: string[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagsProcessingService.addAliasTags(id, tags)
    })

    ipcMain.handle('api:tagsProcessing:aliases:removeTag', (_event, id: number, tag: string) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagsProcessingService.removeAliasTag(id, tag)
    })

    ipcMain.handle(
        'api:tagsProcessing:aliases:removeTags',
        (_event, id: number, tags: string[]) => {
            if (dbService.isLocked) return { success: false, error: 'Database is locked' }
            return tagsProcessingService.removeAliasTags(id, tags)
        }
    )
}

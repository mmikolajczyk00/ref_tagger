import { IpcMain } from 'electron'
import { TagOperation, TagSearchQuery, UploadFilePayload } from '../../shared/types/models'
import { FileService } from '../services/FileService'
import { FileStorageService } from '../services/FileStorageService'
import { SearchService } from '../services/SearchService'
import { TagService } from '../services/TagService'
import { LocalDatabaseService } from '../services/LocalDatabaseService'

export function registerIPCFilesHandlers(
    ipcMain: IpcMain,
    dbService: LocalDatabaseService,
    fileService: FileService,
    tagService: TagService,
    searchService: SearchService,
    fileStorage: FileStorageService
): void {
    ipcMain.handle('api:files:createTempVideoThumb', (_event, srcPath: string) => {
        return fileStorage.createTempVideoThumb(srcPath)
    })
    ipcMain.handle('api:files:getPaginated', (_event, page: number, limit: number) => {
        return fileService.getFilesPage(page, limit)
    })

    ipcMain.handle('api:files:getById', (_event, id: number) => {
        return fileService.getFileOfId(id)
    })

    ipcMain.handle('api:files:getByIds', (_event, ids: number[]) => {
        return fileService.getFilesOfIds(ids)
    })

    ipcMain.handle('api:files:insert', (_event, payload: UploadFilePayload) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return fileService.insertFile(payload)
    })

    ipcMain.handle('api:files:delete', (_event, ids: number[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return fileService.softDeleteFiles(ids)
    })

    ipcMain.handle('api:files:restore', (_event, ids: number[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return fileService.restoreFiles(ids)
    })

    ipcMain.handle('api:files:updateTags', (_event, ops: TagOperation[]) => {
        if (dbService.isLocked) return { success: false, error: 'Database is locked' }
        return tagService.processTagOperations(ops)
    })

    ipcMain.handle('api:files:search', (_event, query: TagSearchQuery) => {
        return searchService.searchFiles(query)
    })
}

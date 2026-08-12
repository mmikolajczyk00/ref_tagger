import { IpcMain } from 'electron'
import { TagOperation, TagSearchQuery, UploadFilePayload } from '../../shared/types/models'
import { LocalDatabaseService } from '../services/LocalDatabaseService'

export function registerIPCFilesHandlers(ipcMain: IpcMain, dbService: LocalDatabaseService): void {
    ipcMain.handle('api:files:getPaginated', (_event, page: number, limit: number) => {
        return dbService.getFilesPage(page, limit)
    })

    ipcMain.handle('api:files:getById', (_event, id: number) => {
        return dbService.getFileOfId(id)
    })

    ipcMain.handle('api:files:getByIds', (_event, ids: number[]) => {
        return dbService.getFilesOfIds(ids)
    })

    ipcMain.handle('api:files:insert', (_event, payload: UploadFilePayload) => {
        return dbService.insertFile(payload)
    })

    ipcMain.handle('api:files:updateTags', (_event, ops: TagOperation[]) => {
        return dbService.processTagOperations(ops)
    })

    ipcMain.handle('api:files:search', (_event, query: TagSearchQuery) => {
        return dbService.searchFiles(query)
    })
}

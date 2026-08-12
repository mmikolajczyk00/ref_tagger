import { IpcMain } from 'electron'
import { LocalDatabaseService } from '../services/LocalDatabaseService'

export function registerIPCCanvasesHandlers(
    ipcMain: IpcMain,
    dbService: LocalDatabaseService
): void {
    ipcMain.handle('api:canvases:create', (_event, name: string, data: any) => {
        return dbService.createCanvas(name, data)
    })

    ipcMain.handle('api:canvases:getAll', () => {
        return dbService.getAllCanvases()
    })

    ipcMain.handle('api:canvases:get', (_event, id: number) => {
        return dbService.getCanvas(id)
    })

    ipcMain.handle('api:canvases:rename', (_event, id: number, name: string) => {
        return dbService.updateCanvasName(id, name)
    })

    ipcMain.handle('api:canvases:saveData', (_event, id: number, data: any) => {
        return dbService.updateCanvasData(id, data)
    })

    ipcMain.handle('api:canvases:delete', (_event, id: number) => {
        return dbService.deleteCanvas(id)
    })

    ipcMain.handle('api:canvases:getPaginated', (_event, page: number, limit: number) => {
        return dbService.getCanvasesPage(page, limit)
    })

    ipcMain.handle('api:canvases:getByIds', (_event, ids: number[]) => {
        return dbService.getCanvasesByIds(ids)
    })
}

import { IpcMain } from 'electron'
import { CanvasService } from '../services/CanvasService'

export function registerIPCCanvasesHandlers(ipcMain: IpcMain, canvasService: CanvasService): void {
    ipcMain.handle('api:canvases:create', (_event, name: string, data: any) => {
        return canvasService.createCanvas(name, data)
    })

    ipcMain.handle('api:canvases:getAll', () => {
        return canvasService.getAllCanvases()
    })

    ipcMain.handle('api:canvases:get', (_event, id: number) => {
        return canvasService.getCanvas(id)
    })

    ipcMain.handle('api:canvases:rename', (_event, id: number, name: string) => {
        return canvasService.updateCanvasName(id, name)
    })

    ipcMain.handle('api:canvases:saveData', (_event, id: number, data: any) => {
        return canvasService.updateCanvasData(id, data)
    })

    ipcMain.handle('api:canvases:delete', (_event, id: number) => {
        return canvasService.deleteCanvas(id)
    })

    ipcMain.handle('api:canvases:getPaginated', (_event, page: number, limit: number) => {
        return canvasService.getCanvasesPage(page, limit)
    })

    ipcMain.handle('api:canvases:getByIds', (_event, ids: number[]) => {
        return canvasService.getCanvasesByIds(ids)
    })
}

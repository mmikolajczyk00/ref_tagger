import { BrowserWindow, IpcMain } from 'electron'
import { LocalDatabaseService } from '../services/LocalDatabaseService'
import { FileDownloadResult, VideoInfo } from '../../shared/types/models'
import { downloadFile } from '../services/FileDownloadService'
import { Result } from '../../shared/types/api'

export function registerIPCDownloadHandlers(
    ipcMain: IpcMain,
    dbService: LocalDatabaseService
): void {
    ipcMain.handle(
        'api:scrape:downloadFile',
        (
            event,
            payload: { url: string; sessionId: string }
        ): Promise<Result<FileDownloadResult>> => {
            const win = BrowserWindow.fromWebContents(event.sender)
            const onProgress = (percentage: number) => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('api:scrape:downloadFile:progress', {
                        sessionId: payload.sessionId,
                        percentage
                    })
                }
            }
            const onInfo = (info: VideoInfo) => {
                if (win && !win.isDestroyed()) {
                    win.webContents.send('api:scrape:downloadFile:info', {
                        sessionId: payload.sessionId,
                        info
                    })
                }
            }
            return downloadFile(
                payload.url,
                dbService.getFileStorageDirectory(),
                onProgress,
                onInfo
            )
        }
    )
}

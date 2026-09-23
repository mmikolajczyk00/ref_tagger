import { BrowserWindow, IpcMain } from 'electron'
import { BackupService } from '../services/BackupService'
import { LocalDatabaseService } from '../services/LocalDatabaseService'
import { BackupLoadOptions, BackupSaveOptions } from '../../shared/types/models'

export function registerIPCBackupHandlers(
    ipcMain: IpcMain,
    dbService: LocalDatabaseService,
    backupService: BackupService
): void {
    ipcMain.handle('api:backup:inspect', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return { success: false, error: 'No window available.' }
        return backupService.inspect(win)
    })

    ipcMain.handle('api:backup:save', (event, options: BackupSaveOptions) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return { success: false, error: 'No window available.' }
        return backupService.saveBackup(win, options)
    })

    ipcMain.handle('api:backup:load', (event, options: BackupLoadOptions) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return { success: false, error: 'No window available.' }
        return backupService.loadBackup(win, options)
    })

    ipcMain.handle('api:backup:isLocked', () => {
        return { success: true, data: dbService.isLocked }
    })

    ipcMain.handle('api:backup:purge', (event) => {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) return { success: false, error: 'No window available.' }
        return backupService.purgeDatabase(win)
    })
}

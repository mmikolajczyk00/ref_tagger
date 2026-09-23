import { app, shell, BrowserWindow, ipcMain, globalShortcut, protocol } from 'electron'
import path, { join } from 'path'
import { createReadStream, statSync } from 'fs'
import { Readable } from 'stream'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LocalDatabaseService } from './services/LocalDatabaseService'
import { TaskManager } from './services/TaskManager'
import { BackupService } from './services/BackupService'
import { FILE_ROOT_DIR } from './env'
import { registerIPCFilesHandlers } from './ipc/handleIPCFiles'
import { registerIPCTagsHandlers } from './ipc/handleIPCTags'
import { registerIPCCanvasesHandlers } from './ipc/handleIPCCanvases'
import { registerIPCTagsProcessingHandlers } from './ipc/handleIPCTagsProcessing'
import { registerIPCDownloadHandlers } from './ipc/handleIPCDownload'
import { registerIPCBackupHandlers } from './ipc/handleIPCBackup'

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'media',
        privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    }
])

const MIME_BY_EXT: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.flv': 'video/x-flv',
    '.m4v': 'video/x-m4v',
    '.ogv': 'video/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
    '.opus': 'audio/opus',
    '.aac': 'audio/aac'
}

function createWindow(): void {
    const mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            webSecurity: true,
            preload: join(__dirname, '../preload/index.mjs'),
            sandbox: false
        }
    })

    mainWindow.on('ready-to-show', () => {
        mainWindow.show()
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
        shell.openExternal(details.url)
        return { action: 'deny' }
    })

    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    mainWindow.webContents.openDevTools({ mode: 'right' })

    mainWindow.setAutoHideMenuBar(false)
    mainWindow.setMenuBarVisibility(false)

    mainWindow.webContents.on('before-input-event', (_event, input) => {
        const isMod = input.control || input.meta
        if (isMod && input.code === 'KeyW') {
            mainWindow.webContents.setIgnoreMenuShortcuts(true)
        } else {
            mainWindow.webContents.setIgnoreMenuShortcuts(false)
        }
    })

    globalShortcut.register('CommandOrControl+Shift+I', () => {
        mainWindow.webContents.openDevTools({ mode: 'right' })
    })
}

app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.electron')

    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    protocol.handle('media', (request) => {
        try {
            const url = new URL(request.url)

            const targetPath = url.searchParams.get('path')
            if (!targetPath) {
                return new Response('Missing path parameter', { status: 400 })
            }

            const normalizedPath = path.normalize(decodeURIComponent(targetPath))

            let size: number
            try {
                size = statSync(normalizedPath).size
            } catch {
                return new Response('Not Found', { status: 404 })
            }

            const contentType =
                MIME_BY_EXT[path.extname(normalizedPath).toLowerCase()] ??
                'application/octet-stream'

            let start = 0
            let end = size - 1

            const rangeHeader = request.headers.get('Range')
            let partial = false
            if (rangeHeader) {
                const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader)
                if (match) {
                    const rangeStart = match[1] ? parseInt(match[1], 10) : start
                    const rangeEnd = match[2] ? parseInt(match[2], 10) : end
                    if (!Number.isNaN(rangeStart) && rangeStart <= rangeEnd && rangeStart < size) {
                        start = rangeStart
                        end = Math.min(rangeEnd, size - 1)
                        partial = true
                    }
                }
            }

            const headers: Record<string, string> = {
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'Content-Length': String(end - start + 1)
            }
            if (partial) {
                headers['Content-Range'] = `bytes ${start}-${end}/${size}`
            }

            if (request.method === 'HEAD') {
                return new Response(null, { status: partial ? 206 : 200, headers })
            }

            const stream = createReadStream(normalizedPath, { start, end })
            const body = Readable.toWeb(stream) as unknown as ReadableStream

            return new Response(body, { status: partial ? 206 : 200, headers })
        } catch (error) {
            console.error('Custom Protocol Error:', error)
            return new Response('Internal Protocol Error', { status: 500 })
        }
    })

    const userDataPath = app.getPath('userData')
    const dbService = new LocalDatabaseService(userDataPath, FILE_ROOT_DIR)
    const taskManager = new TaskManager()
    const backupService = new BackupService(dbService, taskManager)

    dbService.fileService
        .purgeDeletedFiles()
        .catch((e) => console.warn('Failed to purge deleted files on launch:', e))

    registerIPCFilesHandlers(
        ipcMain,
        dbService,
        dbService.fileService,
        dbService.tagService,
        dbService.searchService,
        dbService.fileStorage
    )
    registerIPCTagsHandlers(ipcMain, dbService, dbService.tagService)
    registerIPCDownloadHandlers(ipcMain, dbService, dbService.fileStorage)
    registerIPCCanvasesHandlers(ipcMain, dbService, dbService.canvasService)
    registerIPCTagsProcessingHandlers(ipcMain, dbService, dbService.tagsProcessingService)
    registerIPCBackupHandlers(ipcMain, dbService, backupService)

    ipcMain.handle('shell:openExternal', (_event, url: string) => {
        return shell.openExternal(url)
    })

    createWindow()
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

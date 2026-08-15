import { app, shell, BrowserWindow, ipcMain, globalShortcut, protocol, net } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LocalDatabaseService } from './services/LocalDatabaseService'
import { pathToFileURL } from 'url'
import { FILE_ROOT_DIR } from './env'
import { registerIPCFilesHandlers } from './ipc/handleIPCFiles'
import { registerIPCTagsHandlers } from './ipc/handleIPCTags'
import { registerIPCCanvasesHandlers } from './ipc/handleIPCCanvases'
import { registerIPCTagsProcessingHandlers } from './ipc/handleIPCTagsProcessing'
import { registerIPCDownloadHandlers } from './ipc/handleIPCDownload'

protocol.registerSchemesAsPrivileged([
    { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

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

            const fileUrl = pathToFileURL(normalizedPath).toString()

            return net.fetch(fileUrl)
        } catch (error) {
            console.error('Custom Protocol Error:', error)
            return new Response('Internal Protocol Error', { status: 500 })
        }
    })

    const userDataPath = app.getPath('userData')
    const dbService = new LocalDatabaseService(userDataPath, FILE_ROOT_DIR)

    registerIPCFilesHandlers(
        ipcMain,
        dbService.fileService,
        dbService.tagService,
        dbService.searchService,
        dbService.fileStorage
    )
    registerIPCTagsHandlers(ipcMain, dbService.tagService)
    registerIPCDownloadHandlers(ipcMain, dbService.fileStorage)
    registerIPCCanvasesHandlers(ipcMain, dbService.canvasService)
    registerIPCTagsProcessingHandlers(ipcMain, dbService.tagsProcessingService)

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

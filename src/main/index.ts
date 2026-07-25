import { app, shell, BrowserWindow, ipcMain, globalShortcut, protocol, net } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LocalDatabaseService } from './services/LocalDatabaseService'
import { TagOperation, TagSearchQuery, UploadFilePayload } from '../shared/types/models'
import { pathToFileURL } from 'url'

protocol.registerSchemesAsPrivileged([
    { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true } }
])

function createWindow(): void {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 670,
        show: false,
        autoHideMenuBar: true,
        ...(process.platform === 'linux' ? { icon } : {}),
        webPreferences: {
            webSecurity: true,
            preload: join(__dirname, '../preload/index.js'),
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

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }

    mainWindow.webContents.openDevTools({ mode: 'right' })

    mainWindow.setAutoHideMenuBar(false)
    mainWindow.setMenuBarVisibility(false)

    // keybinds
    mainWindow.webContents.on('before-input-event', (_event, input) => {
        // Check if the user pressed Ctrl+W (or Cmd+W on Mac)
        const isMod = input.control || input.meta
        if (isMod && input.code === 'KeyW') {
            // Tell Electron to ignore the menu shortcut, letting your renderer handle it
            mainWindow.webContents.setIgnoreMenuShortcuts(true)
        } else {
            mainWindow.webContents.setIgnoreMenuShortcuts(false)
        }
    })

    globalShortcut.register('CommandOrControl+Shift+I', () => {
        mainWindow.webContents.openDevTools({ mode: 'right' })
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.electron')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
    app.on('browser-window-created', (_, window) => {
        optimizer.watchWindowShortcuts(window)
    })

    // IPC test
    ipcMain.on('ping', () => console.log('pong'))

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })

    // media

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

    // database

    const userDataPath = app.getPath('userData')

    console.log('userDataPath', userDataPath)

    // Launch the database setup
    const dbService = new LocalDatabaseService(userDataPath)

    ipcMain.handle('api:files:getPaginated', (_event, page: number, limit: number) => {
        return dbService.getFiles(page, limit)
    })

    ipcMain.handle('api:files:getById', (_event, id: number) => {
        const file = dbService.getFileOfId(id)
        console.log(file)

        return file
    })

    ipcMain.handle('api:files:insert', async (_event, payload: UploadFilePayload) => {
        return dbService.insertFile(payload)
    })

    ipcMain.handle('api:files:updateTags', async (_event, ops: TagOperation[]) => {
        return dbService.processTagOperations(ops)
    })

    ipcMain.handle('api:files:search', (_event, query: TagSearchQuery) => {
        return dbService.searchFiles(query)
    })

    ipcMain.handle('api:tags:getAll', () => {
        return dbService.getAllTags()
    })

    createWindow()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

import { app, shell, BrowserWindow, ipcMain, globalShortcut, protocol, net } from 'electron'
import path, { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { LocalDatabaseService } from './services/LocalDatabaseService'
import { TagOperation, TagSearchQuery, UploadFilePayload } from '../shared/types/models'
import { pathToFileURL } from 'url'
import { FILE_ROOT_DIR } from './env'

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

    ipcMain.handle('api:tags:getAll', () => {
        return dbService.getAllTags()
    })

    ipcMain.handle('api:tags:create', (_event, name: string, color: string) => {
        return dbService.createTag(name, color)
    })

    ipcMain.handle('api:tags:delete', (_event, id: number) => {
        return dbService.deleteTag(id)
    })

    ipcMain.handle('api:tags:updateName', (_event, id: number, name: string) => {
        return dbService.updateTagName(id, name)
    })

    ipcMain.handle('api:tags:updateColor', (_event, id: number, color: string) => {
        return dbService.updateTagColor(id, color)
    })

    ipcMain.handle('api:tags:getAllColors', () => {
        return dbService.getAllTagColors()
    })

    ipcMain.handle('api:tags:getSubtags', (_event, parentId: number) => {
        return dbService.getDirectSubtagIds(parentId)
    })

    ipcMain.handle('api:tags:addSubtags', (_event, parentId: number, childIds: number[]) => {
        return dbService.addSubtags(parentId, childIds)
    })

    ipcMain.handle('api:tags:removeSubtags', (_event, parentId: number, childIds: number[]) => {
        return dbService.removeSubtags(parentId, childIds)
    })

    ipcMain.handle('api:tags:getAllRelations', () => {
        return dbService.getAllRelations()
    })

    ipcMain.handle('api:tags:getParents', (_event, childId: number) => {
        return dbService.getDirectParentIds(childId)
    })

    ipcMain.handle('api:tags:addParents', (_event, childId: number, parentIds: number[]) => {
        return dbService.addParents(childId, parentIds)
    })

    ipcMain.handle('api:tags:removeParents', (_event, childId: number, parentIds: number[]) => {
        return dbService.removeParents(childId, parentIds)
    })

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

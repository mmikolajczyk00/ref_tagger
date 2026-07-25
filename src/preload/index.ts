import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { ScrapeResult } from '../shared/shared'
import { TagOperation, UploadFilePayload } from '../shared/types/models'

// Custom APIs for renderer
const api = {
    scrape: {
        scrapeTwitter: (url: string): Promise<ScrapeResult> =>
            ipcRenderer.invoke('scrape-twt', url),
        scrapeR34: (url: string): Promise<ScrapeResult> => ipcRenderer.invoke('scrape-r34', url),
        downloadFromUrl_YTDLP: (url: string): Promise<string[]> =>
            ipcRenderer.invoke('download-yt-dlp', url)
    },

    files: {
        getMediaFileOfId: (id: number) => ipcRenderer.invoke('api:files:getById', id),
        getMediaFiles: (page: number, limit: number) =>
            ipcRenderer.invoke('api:files:getPaginated', page, limit),
        insertMediaFile: (payload: UploadFilePayload) =>
            ipcRenderer.invoke('api:files:insert', payload),
        getFilePath: (file: File) => {
            return webUtils.getPathForFile(file)
        },
        applyTagOperations: (operations: TagOperation[]) =>
            ipcRenderer.invoke('api:files:updateTags', operations)
    },

    tags: {
        getAll: () => ipcRenderer.invoke('api:tags:getAll')
    }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
    try {
        contextBridge.exposeInMainWorld('electron', electronAPI)
        contextBridge.exposeInMainWorld('api', api)
    } catch (error) {
        console.error(error)
    }
} else {
    // @ts-ignore (define in dts)
    window.electron = electronAPI
    // @ts-ignore (define in dts)
    window.api = api
}

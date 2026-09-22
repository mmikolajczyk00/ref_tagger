import { contextBridge, ipcRenderer, webUtils } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { Result } from '../shared/types/api'
import {
    DownloadInfoEvent,
    DownloadProgressEvent,
    FileDownloadResult,
    TagOperation,
    TagSearchQuery,
    UploadFilePayload
} from '../shared/types/models'

// Custom APIs for renderer
const api = {
    scrape: {
        downloadFile: (url: string, sessionId: string): Promise<Result<FileDownloadResult>> =>
            ipcRenderer.invoke('api:scrape:downloadFile', { url, sessionId }),
        onDownloadProgress: (handler: (event: DownloadProgressEvent) => void) => {
            const listener = (_: unknown, payload: DownloadProgressEvent) => handler(payload)
            ipcRenderer.on('api:scrape:downloadFile:progress', listener)
            return () => {
                ipcRenderer.off('api:scrape:downloadFile:progress', listener)
            }
        },
        onDownloadInfo: (handler: (event: DownloadInfoEvent) => void) => {
            const listener = (_: unknown, payload: DownloadInfoEvent) => handler(payload)
            ipcRenderer.on('api:scrape:downloadFile:info', listener)
            return () => {
                ipcRenderer.off('api:scrape:downloadFile:info', listener)
            }
        }
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
        getVideoThumb: (srcPath: string) =>
            ipcRenderer.invoke('api:files:createTempVideoThumb', srcPath),
        applyTagOperations: (operations: TagOperation[]) =>
            ipcRenderer.invoke('api:files:updateTags', operations),
        searchFiles: (query: TagSearchQuery) => ipcRenderer.invoke('api:files:search', query),
        getFilesOfIds: (ids: number[]) => ipcRenderer.invoke('api:files:getByIds', ids),
        deleteFiles: (ids: number[]) => ipcRenderer.invoke('api:files:delete', ids),
        restoreFiles: (ids: number[]) => ipcRenderer.invoke('api:files:restore', ids)
    },

    tags: {
        getAll: () => ipcRenderer.invoke('api:tags:getAll'),
        create: (name: string, color: string) => ipcRenderer.invoke('api:tags:create', name, color),
        delete: (id: number) => ipcRenderer.invoke('api:tags:delete', id),
        updateName: (id: number, name: string) =>
            ipcRenderer.invoke('api:tags:updateName', id, name),
        updateColor: (id: number, color: string) =>
            ipcRenderer.invoke('api:tags:updateColor', id, color),
        getAllColors: () => ipcRenderer.invoke('api:tags:getAllColors'),
        getSubtags: (parentId: number) => ipcRenderer.invoke('api:tags:getSubtags', parentId),
        addSubtags: (parentId: number, childIds: number[]) =>
            ipcRenderer.invoke('api:tags:addSubtags', parentId, childIds),
        removeSubtags: (parentId: number, childIds: number[]) =>
            ipcRenderer.invoke('api:tags:removeSubtags', parentId, childIds),
        getAllRelations: () => ipcRenderer.invoke('api:tags:getAllRelations'),
        getParents: (childId: number) => ipcRenderer.invoke('api:tags:getParents', childId),
        addParents: (childId: number, parentIds: number[]) =>
            ipcRenderer.invoke('api:tags:addParents', childId, parentIds),
        removeParents: (childId: number, parentIds: number[]) =>
            ipcRenderer.invoke('api:tags:removeParents', childId, parentIds),
        addToFiles: (tagNames: string[], fileIds: number[]) =>
            ipcRenderer.invoke('api:tags:addToFiles', tagNames, fileIds),
        removeFromFiles: (tagIds: number[], fileIds: number[]) =>
            ipcRenderer.invoke('api:tags:removeFromFiles', tagIds, fileIds)
    },

    canvases: {
        create: (name: string, data: unknown) =>
            ipcRenderer.invoke('api:canvases:create', name, data),
        getAll: () => ipcRenderer.invoke('api:canvases:getAll'),
        get: (id: number) => ipcRenderer.invoke('api:canvases:get', id),
        rename: (id: number, name: string) => ipcRenderer.invoke('api:canvases:rename', id, name),
        saveData: (id: number, data: unknown) =>
            ipcRenderer.invoke('api:canvases:saveData', id, data),
        delete: (id: number) => ipcRenderer.invoke('api:canvases:delete', id),
        getPaginated: (page: number, limit: number) =>
            ipcRenderer.invoke('api:canvases:getPaginated', page, limit),
        getByIds: (ids: number[]) => ipcRenderer.invoke('api:canvases:getByIds', ids)
    },

    tagsProcessing: {
        blacklist: {
            getAll: () => ipcRenderer.invoke('api:tagsProcessing:blacklist:getAll'),
            get: (id: number) => ipcRenderer.invoke('api:tagsProcessing:blacklist:get', id),
            create: (listName: string) =>
                ipcRenderer.invoke('api:tagsProcessing:blacklist:create', listName),
            rename: (id: number, listName: string) =>
                ipcRenderer.invoke('api:tagsProcessing:blacklist:rename', id, listName),
            delete: (id: number) => ipcRenderer.invoke('api:tagsProcessing:blacklist:delete', id),
            addTags: (id: number, tags: string[]) =>
                ipcRenderer.invoke('api:tagsProcessing:blacklist:addTags', id, tags),
            removeTag: (id: number, tag: string) =>
                ipcRenderer.invoke('api:tagsProcessing:blacklist:removeTag', id, tag),
            removeTags: (id: number, tags: string[]) =>
                ipcRenderer.invoke('api:tagsProcessing:blacklist:removeTags', id, tags)
        },
        aliases: {
            getAll: () => ipcRenderer.invoke('api:tagsProcessing:aliases:getAll'),
            get: (id: number) => ipcRenderer.invoke('api:tagsProcessing:aliases:get', id),
            create: (realTag: string) =>
                ipcRenderer.invoke('api:tagsProcessing:aliases:create', realTag),
            rename: (id: number, realTag: string) =>
                ipcRenderer.invoke('api:tagsProcessing:aliases:rename', id, realTag),
            delete: (id: number) => ipcRenderer.invoke('api:tagsProcessing:aliases:delete', id),
            addTags: (id: number, tags: string[]) =>
                ipcRenderer.invoke('api:tagsProcessing:aliases:addTags', id, tags),
            removeTag: (id: number, tag: string) =>
                ipcRenderer.invoke('api:tagsProcessing:aliases:removeTag', id, tag),
            removeTags: (id: number, tags: string[]) =>
                ipcRenderer.invoke('api:tagsProcessing:aliases:removeTags', id, tags)
        }
    },

    shell: {
        openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
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

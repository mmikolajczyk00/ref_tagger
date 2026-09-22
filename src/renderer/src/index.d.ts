import type { DownloadProgressEvent, FileDownloadResult } from '../shared/types/models'

type iapi = {
    scrape: {
        downloadFile: (url: string, sessionId: string) => Promise<Result<FileDownloadResult>>
        onDownloadProgress: (handler: (event: DownloadProgressEvent) => void) => () => void
        onDownloadInfo: (handler: (event: DownloadInfoEvent) => void) => () => void
    }

    files: {
        getMediaFiles: (page: number, limit: number) => Promise<Result<void>>
        getMediaFileOfId(id: number): Promise<Result<MediaFile>>
        getFilePath: (file: File) => Promise<string> // webutils stuff
        getVideoThumb: (srcPath: string) => Promise<Result<{ thumb: string }>>
        insertMediaFile: (payload: UploadFilePayload) => Promise<Result<void>>
        applyTagOperations: (operations: TagOperation[]) => Promise<Result<void>>
        searchFiles: (query: TagSearchQuery) => Promise<Result<void>>
        getFilesOfIds: (ids: number[]) => Promise<Result<void>>
        deleteFiles: (ids: number[]) => Promise<Result<{ deleted: number }>>
        restoreFiles: (ids: number[]) => Promise<Result<{ restored: number }>>
    }

    tags: {
        getAll: () => Promise<Result<Tag[]>>
        create: (name: string, color: string) => Promise<Result<void>>
        delete: (id: number) => Promise<Result<void>>
        updateName: (id: number, name: string) => Promise<Result<void>>
        updateColor: (id: number, color: string) => Promise<Result<void>>
        getAllColors: () => Promise<Result<void>>
        getAllRelations: () => Promise<Result<void>>
        addSubtags: (id: number, subtags: number[]) => Promise<Result<void>>
        addParents: (id: number, parents: number[]) => Promise<Result<void>>
        removeSubtags: (id: number, subtags: number[]) => Promise<Result<void>>
        removeParents: (id: number, parents: number[]) => Promise<Result<void>>
        addToFiles: (
            tagNames: string[],
            fileIds: number[]
        ) => Promise<
            Result<{ addedFilesByTagId: Record<number, number[]>; createdTagIds: number[] }>
        >
        removeFromFiles: (
            tagIds: number[],
            fileIds: number[]
        ) => Promise<
            Result<{
                removedFilesByTagId: Record<number, number[]>
                remainingFileTagCount: Record<number, number>
            }>
        >
    }
    canvases: {
        create: (name: string, data: CanvasData) => Promise<Result<void>>
        getAll: () => Promise<Result<void>>
        get: (id: number) => Promise<Result<void>>
        rename: (id: number, name: string) => Promise<Result<void>>
        saveData: (id: number, data: CanvasData) => Promise<Result<void>>
        delete: (id: number) => Promise<Result<void>>
        getPaginated: (page: number, limit: number) => Promise<Result<void>>
        getByIds: (ids: number[]) => Promise<Result<void>>
    }
    tagsProcessing: {
        blacklist: {
            getAll: () => Promise<Result<void>>
            get: (id: number) => Promise<Result<void>>
            create: (listName: string) => Promise<Result<void>>
            rename: (id: number, listName: string) => Promise<Result<void>>
            delete: (id: number) => Promise<Result<void>>
            addTags: (id: number, tags: string[]) => Promise<Result<void>>
            removeTag: (id: number, tag: string) => Promise<Result<void>>
            removeTags: (id: number, tags: string[]) => Promise<Result<void>>
        }
        aliases: {
            getAll: () => Promise<Result<void>>
            get: (id: number) => Promise<Result<void>>
            create: (realTag: string) => Promise<Result<void>>
            rename: (id: number, realTag: string) => Promise<Result<void>>
            delete: (id: number) => Promise<Result<void>>
            addTags: (id: number, tags: string[]) => Promise<Result<void>>
            removeTag: (id: number, tag: string) => Promise<Result<void>>
            removeTags: (id: number, tags: string[]) => Promise<Result<void>>
        }
    }
    shell: {
        openExternal: (url: string) => Promise<void>
    }
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: iapi
    }
}

export {}

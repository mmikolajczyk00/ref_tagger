type ScrapeResult = unknown

type iapi = {
    scrape: {
        scrapeTwitter: (url: string) => Promise<ScrapeResult>
        scrapeR34: (url: string) => Promise<ScrapeResult>
        downloadFromUrl_YTDLP: (url: string) => Promise<string[]>
    }

    files: {
        getMediaFiles: (page: number, limit: number) => Promise<Result<PaginatedMediaFiles>>
        getMediaFileOfId(id: number): Promise<Result<MediaFile>>
        getFilePath: (file: File) => Promise<string> // webutils stuff
        insertMediaFile: (payload: UploadFilePayload) => Promise<Result<{ id: number }>>
        applyTagOperations: (operations: TagOperation[]) => Promise<Result<TagOperationResult>>
        searchFiles: (query: TagSearchQuery) => Promise<Result<PaginatedMediaFiles>>
        getFilesOfIds: (ids: number[]) => Promise<Result<Array<[number, MediaFile]>>>
    }

    tags: {
        getAll: () => Promise<Result<Tag[]>>
        create: (name: string, color: string) => Promise<Result<Tag>>
        delete: (id: number) => Promise<Result<void>>
        updateName: (id: number, name: string) => Promise<Result<Tag>>
        updateColor: (id: number, color: string) => Promise<Result<Tag>>
        getAllColors: () => Promise<Result<string[]>>
        getAllRelations: () => Promise<Result<void>>
        addSubtags: (id: number, subtags: number[]) => Promise<Result<void>>
        addParents: (id: number, parents: number[]) => Promise<Result<void>>
        removeSubtags: (id: number, subtags: number[]) => Promise<Result<void>>
        removeParents: (id: number, parents: number[]) => Promise<Result<void>>
    }
    canvases: {
        create: (name: string, data: CanvasData) => Promise<Result<Canvas>>
        getAll: () => Promise<Result<Canvas[]>>
        get: (id: number) => Promise<Result<{ meta: Canvas; data: CanvasData }>>
        rename: (id: number, name: string) => Promise<Result<Canvas>>
        saveData: (id: number, data: CanvasData) => Promise<Result<void>>
        delete: (id: number) => Promise<Result<void>>
        getPaginated: (page: number, limit: number) => Promise<Result<PaginatedCanvases>>
        getByIds: (ids: number[]) => Promise<Result<Array<[number, Canvas]>>>
    }
    tagsProcessing: {
        blacklist: {
            getAll: () => Promise<Result<Blacklist[]>>
            get: (id: number) => Promise<Result<Blacklist>>
            create: (listName: string) => Promise<Result<Blacklist>>
            rename: (id: number, listName: string) => Promise<Result<Blacklist>>
            delete: (id: number) => Promise<Result<void>>
            addTags: (id: number, tags: string[]) => Promise<Result<{ added: string[] }>>
            removeTag: (id: number, tag: string) => Promise<Result<void>>
        }
        aliases: {
            getAll: () => Promise<Result<Alias[]>>
            get: (id: number) => Promise<Result<Alias>>
            create: (realTag: string) => Promise<Result<Alias>>
            rename: (id: number, realTag: string) => Promise<Result<Alias>>
            delete: (id: number) => Promise<Result<void>>
            addTags: (id: number, tags: string[]) => Promise<Result<{ added: string[] }>>
            removeTag: (id: number, tag: string) => Promise<Result<void>>
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

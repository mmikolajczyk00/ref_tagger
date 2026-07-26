type iapi = {
    scrape: {
        scrapeTwitter: (url: string) => Promise<ScrapeResult>
        scrapeR34: (url: string) => Promise<ScrapeResult>
        downloadFromUrl_YTDLP: (url: string) => Promise<string[]>
    }

    files: {
        getMediaFiles: (page: number, limit: number) => Promise<Result<PaginatedResult<MediaFile>>>
        getMediaFileOfId(id: number): Promise<Result<MediaFile>>
        getFilePath: (file: File) => Promise<string> // webutils stuff
        insertMediaFile: (payload: UploadFilePayload) => Promise<Result<void>>
        applyTagOperations: (operations: TagOperation[]) => Promise<Result<MediaFile[]>>
        searchFiles: (query: TagSearchQuery) => Promise<Result<PaginatedResult<MediaFile>>>
    }

    tags: {
        getAll: () => Promise<Result<Tag[]>>
        create: (name: string, color: string) => Promise<Result<Tag>>
        delete: (id: number) => Promise<Result<void>>
        updateName: (id: number, name: string) => Promise<Result<Tag>>
        updateColor: (id: number, color: string) => Promise<Result<Tag>>
    }
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: iapi
    }
}

export {}

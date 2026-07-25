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
    }

    tags: {
        getAll: () => Promise<Result<Tag[]>>
    }
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: iapi
    }
}

export {}

import { ElectronAPI } from '@electron-toolkit/preload'
import { PaginatedResult, MediaFile, MediaType } from '../shared/types/models'
import { TagOperation } from '@renderer/features/explorer/ts/useTagEditorPanel'
import { Result } from '../shared/types/api'

type iapi = {
    scrapeTwitter: (url: string) => Promise<ScrapeResult>
    scrapeR34: (url: string) => Promise<ScrapeResult>
    downloadFromUrl_YTDLP: (url: string) => Promise<string[]>

    getMediaFiles: (page: number, limit: number) => Promise<Result<PaginatedResult<MediaFile>>>
    getMediaFileOfId(id: number): Promise<Result<MediaFile>>
    getFilePath: (file: File) => Promise<string> // webutils stuff

    insertMediaFile: (payload: UploadFilePayload) => Promise<Result<void>>

    applyTagOperations: (operations: TagOperation[]) => Promise<Result<MediaFile[]>>
}

declare global {
    interface Window {
        electron: ElectronAPI
        api: iapi
    }
}

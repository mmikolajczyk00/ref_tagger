import { DropScanResult } from './DropHandler'

export const UPLOAD_STATUS = {
    IDLE: 'idle',
    UPLOADING: 'uploading',
    SUCCESS: 'success',
    ERROR: 'error'
} as const

export const SCRAPE_STATUS = {
    IDLE: 'idle',
    SCRAPING: 'scraping',
    SUCCESS: 'success',
    ERROR: 'error',
    SKIPPED: 'skipped'
} as const

export interface QueuedFile {
    id: string
    uploadStatus: string
    scrapeStatus: string
    errorMessage?: string
    dropData: DropScanResult
    userTags: string[]
}

export function isLocked(file: QueuedFile): boolean {
    return file.uploadStatus === UPLOAD_STATUS.UPLOADING
}

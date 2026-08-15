import { DropScanResult } from './DropHandler'
import { ScrapeScanResult } from './ScrapeHandler'

export const UPLOAD_STATUS = {
    IDLE: 'idle',
    UPLOADING: 'uploading',
    SUCCESS: 'success',
    ERROR: 'error'
} as const

export const DOWNLOAD_STATUS = {
    IDLE: 'idle',
    UNNECESSARY: 'unnecessary',
    DOWNLOADING: 'downloading',
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
    downloadStatus: string
    errorMessage?: string
    dropData: DropScanResult
    scrapeData?: ScrapeScanResult
    userTags: string[]
    percentage?: number
}

export function isLocked(file: QueuedFile): boolean {
    return file.uploadStatus === UPLOAD_STATUS.UPLOADING
}

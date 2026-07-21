export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export interface QueuedFile {
    id: string
    name: string
    path: string
    type: string
    size: number
    status: UploadStatus
    errorMessage?: string
}


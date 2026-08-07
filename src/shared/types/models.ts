export type MediaType = 'audio' | 'video' | 'image'

export interface MediaFile {
    id: number
    fileName: string
    filePath: string
    mediaType: MediaType
    createdAt: string
    tags: Tag[]
}

export interface Tag {
    id: number
    name: string
    color: string
}

// Data Transfer Object for paginated results
export interface PaginatedResult<T> {
    data: T[]
    total: number
    page: number
    limit: number
}

export interface PaginatedMediaFiles {
    data: Array<[number, MediaFile]>
    total: number
    page: number
    limit: number
}

export interface UploadFilePayload {
    filePath: string
    fileName: string
    mediaType: MediaType
}

export interface TagOperation {
    action: 'add' | 'remove'
    fileId: number
    tagName?: string // Used for adds
    tagId?: number // Used for removals
}

export interface FileTagResult {
    id: number
    tags: Tag[]
}

export interface TagOperationResult {
    filesIds?: Set<number>
    files: FileTagResult[]
    tags: Tag[]
}

export interface TagSearchQuery {
    requiredExactTags?: string[]
    requiredExpandedTags?: string[]
    excludedExactTags?: string[]
    excludedExpandedTags?: string[]
    normalTags?: string[]
    page?: number
    limit?: number
}

export interface PaginatedCanvases {
    data: Canvas[]
    total: number
    page: number
    limit: number
}

export interface Canvas {
    id: number
    name: string
    dataPath: string
    createdAt: string
    updatedAt: string
}

export type CanvasSceneData = {
    elements: unknown[]
    zoom: number
    panOffset: { x: number; y: number }
    highestZIndex: number
}

export type MediaType = 'audio' | 'video' | 'image'

export interface MediaFile {
    id: number
    fileName: string
    filePath: string
    mediaType: MediaType
    createdAt: string
    tags: Array<Tag>
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

export interface TagSearchQuery {
    requiredTags?: string[]
    excludedTags?: string[]
    normalTags?: string[]
    page?: number
    limit?: number
}

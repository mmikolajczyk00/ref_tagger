import { UUID } from 'crypto'
import { TagModel, TagResponse } from '../../../../shared/model/tagModel'

export interface ActionResult {
    message: string
    success: boolean
}

export interface FileActionResult {
    fileId: UUID
    message: string
    success: boolean
}

export interface BulkActionResponse_Tags {
    bulkResults: BulkOperationResult<TagActionResult>
    finalTags: TagResponse[]
}

export class BulkAction_Tags {
    bulkResults: BulkOperationResult<TagActionResult>
    finalTags: TagModel[]
    constructor(bulkResponse: BulkActionResponse_Tags) {
        this.bulkResults = bulkResponse.bulkResults
        this.finalTags = bulkResponse.finalTags.map((tag) => new TagModel(tag.id, tag.name))
    }
}

export interface AllFilesDeleteResult {
    succes: boolean
    error: string
}

export interface TagActionResult {
    success: boolean
    name: string
    error: string
}

export interface TagActionResultVerbose {
    id: UUID
    name: string
    message: string
    error: string
    data?: TagResponse
}

export interface BulkOperationResult<T> {
    successful: T[]
    failed: T[]
}

export interface AllTagsDeleteResult {
    success: boolean
    error: string
}

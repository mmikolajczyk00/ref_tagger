import { UUID } from 'crypto'
import { TagModel, TagResponse } from '../../../../shared/model/tagModel'

export interface ActionResult {
  message: String
  success: boolean
}

export interface FileActionResult {
  fileId: UUID
  message: String
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
  error: String
}

export interface TagActionResult {
  success: boolean
  name: String
  error: String
}

export interface TagActionResultVerbose {
  id: UUID
  name: String
  message: String
  error: String
  data?: TagResponse
}

export interface BulkOperationResult<T> {
  successful: T[]
  failed: T[]
}

export interface AllTagsDeleteResult {
  success: boolean
  error: String
}

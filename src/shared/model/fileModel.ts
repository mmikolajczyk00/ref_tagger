const apiUrl = import.meta.env.VITE_API_URL

import { TagModel, TagResponse } from './tagModel'
import { UUID } from 'crypto'
import { Selectable } from '../../renderer/src/core/utils/selectionHandler'
import { MediaType, mimeTypeToMediaType } from '../shared'

export class FileModel {
  id: UUID
  name: string
  url: string
  source: string
  tags: Set<TagModel>
  finalTags: Set<TagModel>
  // tagsNamesSet: Set<string>
  mediaType: MediaType
  createdAt: Date
  updatedAt: Date

  constructor(fileResponse: FileResponse) {
    this.id = fileResponse.id
    this.name = fileResponse.name
    this.url = apiUrl + 'files/' + fileResponse.id
    this.source = fileResponse.source
    this.mediaType = mimeTypeToMediaType(fileResponse.mimeType)
    this.tags = new Set(fileResponse.tags.map((dto) => TagModel.fromDto(dto)))
    this.finalTags = new Set(fileResponse.finalTags.map((dto) => TagModel.fromDto(dto)))
    // this.tagsNamesSet = new Set(fileResponse.finalTags.map((t) => t.name))
    this.createdAt = fileResponse.createdAt
    this.updatedAt = fileResponse.updatedAt
  }

  addTag(tag: TagModel): void {
    this.finalTags.add(tag)
  }
  removeTag(tag: TagModel): void {
    let foundTag = this.findTagByName(tag.name)
    if (foundTag != null) this.finalTags.delete(foundTag)
    console.log('foundTag', foundTag, this.finalTags)
  }
  findTagByName(name: string): TagModel | null {
    let tags = this.finalTags.keys()

    for (const tag of tags) {
      if (tag.name == name) {
        return tag
      }
    }
    return null
  }
  clearAllTags(): void {}
  getTagsNamesSet(): Set<string> {
    let set = new Set<string>()
    this.tags.forEach((t) => set.add(t.name))

    return set
  }
}

export class GalleryFile implements Selectable {
  selected: boolean = false
  file: FileModel
  constructor(file: FileModel) {
    this.file = file
  }
}

export interface FileResponse {
  id: UUID
  name: string
  url: string
  source: string
  mimeType: String
  tags: TagResponse[]
  finalTags: TagResponse[]
  createdAt: Date
  updatedAt: Date
  message?: string
}

import { UUID } from 'crypto'
import {
    TagModel,
    TagRequest,
    TagResponse,
    TagSimpleResponse
} from '../../../../shared/model/tagModel'
import {
    TagActionResult,
    BulkOperationResult,
    AllTagsDeleteResult,
    BulkAction_Tags,
    TagActionResultVerbose
} from './responses'

// general

export async function getAllTags(): Promise<TagResponse[]> {
    const data = await window.api.get('tags')
    return data
}

export async function getAllTagsSimple(): Promise<TagSimpleResponse[]> {
    const data = await window.api.get('tags/simple')
    return data
}

export async function addTags(tags: string[]): Promise<BulkOperationResult<TagActionResult>> {
    const data = await window.api.post('tags-list', { tags: tags })
    return data
}

export async function deleteTags(): Promise<BulkOperationResult<TagActionResult>> {
    const data = await window.api.delete('tags')
    return data
}

export async function deleteAllTags(): Promise<AllTagsDeleteResult> {
    const data = await window.api.delete('tags')
    return data
}

export async function addTagAdvanced(tag: TagRequest): Promise<TagActionResult> {
    const data = await window.api.post('tags-one', tag)
    return data
}

export async function editTag(tagId: UUID, newTag: TagRequest): Promise<TagActionResult> {
    const data = await window.api.put('tags/' + tagId, newTag)
    return data
}

// groups

export async function getAllGroupsData(): Promise<Map<string, TagModel[]>> {
    const data = await window.api.get('groups/data')

    return new Map<string, TagModel[]>(Object.entries(data))
}

export async function addTagsToGroup(groupName: string, tags: string[]): Promise<BulkAction_Tags> {
    const data = await window.api.post(`groups/${groupName}/tags`, { tags: tags })
    return new BulkAction_Tags(data)
}

export async function removeTagsFromGroup(
    groupName: string,
    tags: string[]
): Promise<BulkAction_Tags> {
    const data = await window.api.delete(`groups/${groupName}/tags`, { data: { tags: tags } })
    return new BulkAction_Tags(data)
}

// files

export async function removeTagsFromFile(fileId: string, tags: string[]): Promise<BulkAction_Tags> {
    const data = await window.api.delete(`tags/file/${fileId}`, { data: { tags: tags } })
    return data
}

export async function addTagsToFile(fileId: string, tags: string[]): Promise<BulkAction_Tags> {
    const data = await window.api.post('tags/file/' + fileId, { tags: tags })
    return data
}

export async function addTagsToFiles(
    files: UUID[],
    tags: string[]
): Promise<Map<UUID, BulkOperationResult<TagActionResultVerbose>>> {
    const data = await window.api.post('tags/file-list', { files: files, tags: tags })
    return new Map(Object.entries(data)) as Map<UUID, BulkOperationResult<TagActionResultVerbose>>
}

export async function removeAllTagsFromFile(fileId: string): Promise<BulkAction_Tags> {
    const data = await window.api.delete(`tags/file/${fileId}/all`)
    return data
}

export async function removeTagsFromFiles(
    files: UUID[],
    tags: string[]
): Promise<Map<UUID, BulkOperationResult<TagActionResultVerbose>>> {
    const data = await window.api.delete('tags/file-list', { data: { files: files, tags: tags } })
    return new Map(Object.entries(data)) as Map<UUID, BulkOperationResult<TagActionResultVerbose>>
}

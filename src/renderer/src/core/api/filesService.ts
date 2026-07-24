import { FileModel, FileResponse } from '../../../../shared/model/fileModel'
import {} from '../../../../shared/model/tagModel'
import { ActionResult, AllFilesDeleteResult, FileActionResult } from './responses'
import { UUID } from 'crypto'

// general

export async function uploadFile(
    file: File,
    tags: Set<string>,
    source: string
): Promise<ActionResult> {
    const data = await window.api.postForm('files/upload', {
        file: file,
        tags: [...tags],
        source: source
    })
    return data
}

export async function findFilesByAnyTags(tags: string[]): Promise<FileModel[]> {
    const data = await window.api.post(`search`, { tags: tags })

    return data.map((file: FileResponse) => new FileModel(file))
}

export async function getAllFiles(): Promise<FileModel[]> {
    const data = await window.api.get('files/data')
    return data.map((file: FileResponse) => new FileModel(file))
}

export async function deleteAllFiles(): Promise<AllFilesDeleteResult> {
    const data = await window.api.delete('files')
    return data
}

export async function deleteFile(id: UUID): Promise<FileActionResult> {
    const data = await window.api.delete('files/' + id)
    return data
}

export async function getFileUrl(id: UUID): Promise<ActionResult> {
    const data = await window.api.get('files/' + id)
    return data
}

// stores/useFileStore.ts
import { defineStore } from 'pinia'
import { MediaFile } from '@shared/types/models'

export const useFileStore = defineStore('file', () => {
    async function getFileOfId(id: number): Promise<MediaFile | undefined> {
        const result = await window.api.files.getMediaFileOfId(id)
        if (result.success) {
            return result.data
        } else {
            return undefined
        }
    }

    async function fetchFilesOfIds(ids: number[]): Promise<MediaFile[]> {
        if (ids.length === 0) return []
        const result = await window.api.files.getFilesOfIds(ids)
        if (!result.success) {
            console.error('fetchFilesOfIds failed:', result.error)
            return []
        }
        return result.data.map(([, file]) => file)
    }

    async function addTagsToFiles(tagNames: string[], fileIds: number[]) {
        const result = await window.api.tags.addToFiles([...tagNames], [...fileIds])
        if (!result.success) {
            console.error('addTagsToFiles failed:', result.error)
            return null
        }
        return result.data
    }

    async function removeTagsFromFiles(tagIds: number[], fileIds: number[]) {
        const result = await window.api.tags.removeFromFiles([...tagIds], [...fileIds])
        if (!result.success) {
            console.error('removeTagsFromFiles failed:', result.error)
            return null
        }
        return result.data
    }

    async function deleteTag(id: number): Promise<boolean> {
        const result = await window.api.tags.delete(id)
        if (!result.success) {
            return false
        }
        return true
    }

    return { getFileOfId, fetchFilesOfIds, addTagsToFiles, removeTagsFromFiles, deleteTag }
})

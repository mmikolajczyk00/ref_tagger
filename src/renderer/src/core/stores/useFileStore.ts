// stores/useExplorerStore.ts
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

    return { getFileOfId }
})

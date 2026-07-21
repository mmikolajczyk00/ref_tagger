// stores/useExplorerStore.ts
import { defineStore } from 'pinia'
import { MediaFile } from 'src/shared/types/models'

import { ref } from 'vue'

export const useFileStore = defineStore('file', () => {
    async function getFileOfId(id: number): Promise<MediaFile | undefined> {
        const result = await window.api.getMediaFileOfId(id)
        if (result.success) {
            return result.data
        } else {
            return undefined
        }
    }

    return { getFileOfId }
})

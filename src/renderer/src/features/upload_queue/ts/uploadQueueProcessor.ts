import type { QueuedFile } from './UploadQueue'
import { UPLOAD_STATUS } from './UploadQueue'
import { useUploadQueueStore } from './useUploadQueueStore'
import { MediaFileSourceType } from './DropHandler'
import type { MediaType, UploadFilePayload } from '@shared/types/models'

const TYPE_PRIORITY: Record<MediaType, number> = { image: 0, audio: 1, video: 2 }
const LOCAL_CONCURRENCY = 4

class UploadQueueProcessor {
    private localQueue: QueuedFile[] = []
    private webQueue: QueuedFile[] = []
    private activeLocal = 0
    private draining = false

    enqueue(files: QueuedFile[]) {
        const idle = files.filter((f) => f.uploadStatus === UPLOAD_STATUS.IDLE)
        if (!idle.length) return

        const sorted = [...idle].sort(
            (a, b) =>
                TYPE_PRIORITY[a.dropData.mediaType as MediaType] -
                TYPE_PRIORITY[b.dropData.mediaType as MediaType]
        )

        for (const f of sorted) {
            if (f.dropData.sourceType === MediaFileSourceType.LOCAL) {
                this.localQueue.push(f)
            } else {
                this.webQueue.push(f)
            }
        }

        void this.drain()
    }

    private async drain() {
        if (this.draining) return
        this.draining = true
        try {
            while (this.webQueue.length) {
                const next = this.webQueue.shift()!
                await this.processOne(next)
            }
            while (this.localQueue.length) {
                if (this.activeLocal >= LOCAL_CONCURRENCY) {
                    await new Promise((r) => setTimeout(r, 25))
                    continue
                }
                const next = this.localQueue.shift()!
                this.activeLocal++
                void this.processOne(next).finally(() => {
                    this.activeLocal--
                })
            }
            while (this.activeLocal > 0) {
                await new Promise((r) => setTimeout(r, 25))
            }
        } finally {
            this.draining = false
        }
    }

    private async processOne(file: QueuedFile) {
        const store = useUploadQueueStore()
        store.setUploadStatus(file.id, UPLOAD_STATUS.UPLOADING)

        try {
            const payload = buildPayload(file)
            const result = await window.api.files.insertMediaFile(payload)
            if (!result.success) {
                console.error('upload failed', file.id, result.error)
                store.setUploadStatus(file.id, UPLOAD_STATUS.ERROR, result.error)
                return
            }

            const tagsToAttach = [...file.dropData.tags, ...file.userTags].filter(Boolean)
            if (tagsToAttach.length) {
                const ops = tagsToAttach.map((name) => ({
                    action: 'add' as const,
                    fileId: result.data.id,
                    tagName: name
                }))
                const tagRes = await window.api.files.applyTagOperations(ops)
                if (!tagRes.success) {
                    console.error('tag attach failed', file.id, tagRes.error)
                }
            }

            console.log('upload ok', file.id)
            store.remove('upload', file.id)
        } catch (err) {
            console.error('upload error', file.id, err)
            store.setUploadStatus(file.id, UPLOAD_STATUS.ERROR, String(err))
        }
    }
}

function buildPayload(file: QueuedFile): UploadFilePayload {
    const base = {
        fileName: file.dropData.name ?? 'untitled',
        mediaType: file.dropData.mediaType as MediaType,
        sourceUrl: file.dropData.originalSourceUrl
    }
    if (file.dropData.sourceType === MediaFileSourceType.LOCAL) {
        return {
            ...base,
            source: MediaFileSourceType.LOCAL,
            filePath: file.dropData.src ?? file.dropData.originalSourceUrl
        }
    }
    return {
        ...base,
        source: MediaFileSourceType.WEB,
        mediaUrl: file.dropData.src
    }
}

export const uploadQueueProcessor = new UploadQueueProcessor()

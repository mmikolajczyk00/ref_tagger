import { MediaType } from '@shared/types/models'
import { DOWNLOAD_STATUS, QueuedFile, UPLOAD_STATUS } from './UploadQueue'
import { useUploadQueueStore } from './useUploadQueueStore'

export type SourceSites = 'twitter' | 'pinterest' | 'safebooru' | 'other'

class DownloadQueueProcessor {
    private queueMap: Record<SourceSites, QueuedFile[]> = {
        twitter: [],
        pinterest: [],
        safebooru: [],
        other: []
    }
    private draining = false

    enqueue(files: QueuedFile[]) {
        const idle = files.filter((f) => f.uploadStatus === DOWNLOAD_STATUS.IDLE)
        if (!idle.length) return

        console.log('enqueue')

        for (const f of idle) {
            if (f.dropData.sourceType === 'local') continue
            else if (f.dropData.originalSourceUrl?.includes('x.com')) this.queueMap.twitter.push(f)
            else if (f.dropData.originalSourceUrl?.includes('pinterest.com'))
                this.queueMap.pinterest.push(f)
            else if (f.dropData.originalSourceUrl?.includes('safebooru.org'))
                this.queueMap.safebooru.push(f)
            else this.queueMap.other.push(f)
        }

        void this.drain()
    }

    private async drain() {
        if (this.draining) return
        this.draining = true
        try {
            for (const srcSite in this.queueMap) {
                const queue = this.queueMap[srcSite]
                while (queue.length) {
                    const next = queue.shift()!
                    await this.processOne(next)
                }
            }
        } finally {
            this.draining = false
        }
    }

    private async processOne(file: QueuedFile) {
        const store = useUploadQueueStore()
        store.setDownloadStatus(file.id, DOWNLOAD_STATUS.DOWNLOADING)
        try {
            if (!file.dropData.originalSourceUrl) {
                throw new Error('no source url')
            }

            const downloadFilePromise = window.api.scrape.downloadFile(
                file.dropData.originalSourceUrl,
                file.id
            )

            window.api.scrape.onDownloadProgress(({ sessionId, percentage }) => {
                if (sessionId == file.id) {
                    console.log(percentage)
                    store.setPercentage(file.id, percentage)
                }
            })
            window.api.scrape.onDownloadInfo(({ sessionId, info }) => {
                if (sessionId == file.id) {
                    console.log(info)
                    store.setInfo(file.id, info)
                }
            })

            const result = await downloadFilePromise

            if (!result.success) {
                console.error('download failed', file.id, result.error)
                store.setDownloadStatus(file.id, DOWNLOAD_STATUS.ERROR, result.error)
            } else {
                store.setDownloadStatus(file.id, DOWNLOAD_STATUS.SUCCESS, result.data.filePath)
            }
        } catch (err) {
            console.error('download error', file.id, err)
            store.setDownloadStatus(file.id, DOWNLOAD_STATUS.ERROR, undefined, String(err))
        }
    }
}

export const downloadQueueProcessor = new DownloadQueueProcessor()

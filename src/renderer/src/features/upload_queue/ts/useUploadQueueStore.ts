import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { DOWNLOAD_STATUS, QueuedFile, SCRAPE_STATUS, UPLOAD_STATUS } from './UploadQueue'
import { normalizeTag } from '../../../core/utils/tagsUtils'
import { createListSelection } from '../../../core/utils/listSelection'
import { DropScanResult } from './DropHandler'
import { processDroppedTags } from './processDroppedTags'
import { useTagsProcessingStore } from '../../../core/stores/useTagsProcessingStore'
import { downloadQueueProcessor } from './downloadQueueProcessor'
import { VideoInfo } from '@shared/types/models'

export const useUploadQueueStore = defineStore('upload-queue', () => {
    const tpStore = useTagsProcessingStore()

    const scrapeFiles = ref<QueuedFile[]>([])
    const uploadFiles = ref<QueuedFile[]>([])

    const disableScraping = ref(false)
    const autoSkipFailed = ref(false)

    const scrapeSelection = createListSelection<QueuedFile, string>(scrapeFiles)
    const uploadSelection = createListSelection<QueuedFile, string>(uploadFiles)

    const selectedScrapeTabItems = computed(() =>
        scrapeFiles.value.filter((f) => scrapeSelection.selectedIds.has(f.id))
    )
    const selectedUploadTabItems = computed(() =>
        uploadFiles.value.filter((f) => uploadSelection.selectedIds.has(f.id))
    )

    async function ensureTagsProcessingLoaded() {
        if (!tpStore.isLoaded) await tpStore.fetchAll()
    }

    async function downloadWithUrl(url: string) {
        const file = {
            id: crypto.randomUUID(),
            uploadStatus: UPLOAD_STATUS.IDLE,
            scrapeStatus: SCRAPE_STATUS.IDLE,
            downloadStatus: DOWNLOAD_STATUS.IDLE,
            errorMessage: undefined,
            dropData: {
                name: 'untitled',
                tags: [],
                sourceType: 'web',
                originalSourceUrl: url
            },
            userTags: []
        } as QueuedFile
        scrapeFiles.value.push(file)
        downloadQueueProcessor.enqueue([file])
    }

    async function addToScrape(dropData: DropScanResult[]) {
        await ensureTagsProcessingLoaded()
        const files = dropData.map((f) => {
            const normalized = f.tags.map(normalizeTag).filter(Boolean)
            return {
                id: crypto.randomUUID(),
                dropData: {
                    ...f,
                    tags: processDroppedTags(normalized, tpStore.blacklistSet, tpStore.aliasMap)
                },
                uploadStatus: UPLOAD_STATUS.IDLE,
                scrapeStatus: SCRAPE_STATUS.IDLE,
                downloadStatus: DOWNLOAD_STATUS.UNNECESSARY,
                userTags: []
            }
        })
        scrapeFiles.value.push(...files)
    }

    function addToUpload(files: QueuedFile[]) {
        uploadFiles.value.push(...files)
    }

    function moveToUpload(fileIds: string[]) {
        const idSet = new Set(fileIds)
        const canMove = (f: QueuedFile) =>
            idSet.has(f.id) &&
            (f.downloadStatus === 'unnecessary' || f.downloadStatus === 'success')
        const toMove = scrapeFiles.value.filter(canMove)
        scrapeFiles.value = scrapeFiles.value.filter((f) => !canMove(f))
        const moved = toMove.map((f) => ({
            ...f,
            scrapeStatus: SCRAPE_STATUS.SKIPPED,
            uploadStatus: UPLOAD_STATUS.IDLE
        }))
        uploadFiles.value.push(...moved)
        fileIds.forEach((id) => scrapeSelection.selectedIds.delete(id))
    }

    function skipAll(side: 'scrape' | 'upload') {
        if (side === 'scrape') {
            moveToUpload(scrapeFiles.value.map((f) => f.id))
        } else {
            uploadFiles.value = []
            uploadSelection.clearSelection()
        }
    }

    function skipFailed(side: 'scrape' | 'upload') {
        if (side === 'scrape') {
            const failedIds = scrapeFiles.value
                .filter((f) => f.uploadStatus === 'error')
                .map((f) => f.id)
            moveToUpload(failedIds)
        } else {
            uploadFiles.value = uploadFiles.value.filter((f) => f.uploadStatus !== 'error')
        }
    }

    function addUserTags(fileIds: string[], tags: string[]) {
        const normalized = [...new Set(tags.map(normalizeTag).filter(Boolean))]
        if (!normalized.length) return

        scrapeFiles.value = scrapeFiles.value.map((f) => {
            if (!fileIds.includes(f.id)) return f
            const current = new Set(f.userTags)
            normalized.forEach((t) => current.add(t))
            return { ...f, userTags: [...current] }
        })
    }

    function removeUserTags(fileIds: string[], tags: string[]) {
        const tagSet = new Set(tags)
        scrapeFiles.value = scrapeFiles.value.map((f) => {
            if (!fileIds.includes(f.id)) return f
            return { ...f, userTags: f.userTags.filter((t) => !tagSet.has(t)) }
        })
    }

    function removeDropDataTags(fileIds: string[], tags: string[]) {
        const tagSet = new Set(tags)
        scrapeFiles.value = scrapeFiles.value.map((f) => {
            if (!fileIds.includes(f.id)) return f
            return {
                ...f,
                dropData: {
                    ...f.dropData,
                    tags: f.dropData.tags.filter((t) => !tagSet.has(t))
                }
            }
        })
    }

    function clearDropDataTags(fileIds: string[]) {
        scrapeFiles.value = scrapeFiles.value.map((f) => {
            if (!fileIds.includes(f.id)) return f
            return {
                ...f,
                dropData: {
                    ...f.dropData,
                    tags: []
                }
            }
        })
    }

    function updateName(fileIds: string[], name: string) {
        scrapeFiles.value = scrapeFiles.value.map((f) => {
            if (!fileIds.includes(f.id)) return f
            return {
                ...f,
                dropData: {
                    ...f.dropData,
                    name
                }
            }
        })
    }

    function updateOriginalSourceUrl(fileIds: string[], url: string) {
        scrapeFiles.value = scrapeFiles.value.map((f) => {
            if (!fileIds.includes(f.id)) return f
            return {
                ...f,
                dropData: {
                    ...f.dropData,
                    originalSourceUrl: url
                }
            }
        })
    }

    function setUploadStatus(id: string, status: string, errorMessage?: string) {
        uploadFiles.value = uploadFiles.value.map((f) =>
            f.id === id ? { ...f, uploadStatus: status, errorMessage } : f
        )
    }
    function setScrapeStatus(id: string, status: string, errorMessage?: string) {
        scrapeFiles.value = scrapeFiles.value.map((f) =>
            f.id === id ? { ...f, scrapeStatus: status, errorMessage } : f
        )
    }
    function setDownloadStatus(
        id: string,
        status: string,
        filePath?: string,
        errorMessage?: string
    ) {
        scrapeFiles.value = scrapeFiles.value.map((f) =>
            f.id === id
                ? {
                      ...f,
                      dropData: { ...f.dropData, src: filePath },
                      downloadStatus: status,
                      errorMessage
                  }
                : f
        )
    }

    function setPercentage(id: string, percentage: number) {
        scrapeFiles.value = scrapeFiles.value.map((f) => (f.id === id ? { ...f, percentage } : f))
    }
    function setInfo(id: string, info: VideoInfo) {
        // TODO: use info.tags if possible
        scrapeFiles.value = scrapeFiles.value.map((f) =>
            f.id === id
                ? {
                      ...f,
                      dropData: {
                          ...f.dropData,
                          thumb: info.thumbnailUrl,
                          name: info.title,
                          mediaType: info.mediaType ?? f.dropData.mediaType
                      }
                  }
                : f
        )
    }

    function remove(side: 'scrape' | 'upload', id: string) {
        if (side === 'scrape') {
            scrapeFiles.value = scrapeFiles.value.filter((f) => f.id !== id)
            scrapeSelection.selectedIds.delete(id)
        } else {
            uploadFiles.value = uploadFiles.value.filter((f) => f.id !== id)
            uploadSelection.selectedIds.delete(id)
        }
    }

    return {
        scrapeFiles,
        uploadFiles,
        disableScraping,
        autoSkipFailed,
        scrapeSelection,
        uploadSelection,
        selectedScrapeTabItems,
        selectedUploadTabItems,
        addToScrape,
        addToUpload,
        skipAll,
        skipFailed,
        remove,
        setUploadStatus,
        setScrapeStatus,
        setDownloadStatus,
        addUserTags,
        removeUserTags,
        removeDropDataTags,
        clearDropDataTags,
        updateName,
        updateOriginalSourceUrl,
        moveToUpload,
        downloadWithUrl,
        setPercentage,
        setInfo
    }
})

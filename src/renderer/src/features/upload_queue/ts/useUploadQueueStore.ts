import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { QueuedFile, SCRAPE_STATUS, UPLOAD_STATUS } from './UploadQueue'
import { normalizeTag } from '../../../core/utils/tagsUtils'
import { createListSelection } from '../../../core/utils/listSelection'
import { DropScanResult } from './DropHandler'
import { processDroppedTags } from './processDroppedTags'
import { useTagsProcessingStore } from '../../../core/stores/useTagsProcessingStore'

export const useUploadQueueStore = defineStore('upload-queue', () => {
    const tpStore = useTagsProcessingStore()

    const scrapeFiles = ref<QueuedFile[]>([])
    const uploadFiles = ref<QueuedFile[]>([])

    const disableScraping = ref(false)
    const autoSkipFailed = ref(false)

    const scrapeSelection = createListSelection<QueuedFile, string>(scrapeFiles)
    const uploadSelection = createListSelection<QueuedFile, string>(uploadFiles)

    const selectedScrapeTabItems = computed(() =>
        scrapeFiles.value.filter((f) => scrapeSelection.selectedIds.value.has(f.id))
    )
    const selectedUploadTabItems = computed(() =>
        uploadFiles.value.filter((f) => uploadSelection.selectedIds.value.has(f.id))
    )

    async function ensureTagsProcessingLoaded() {
        if (!tpStore.isLoaded) await tpStore.fetchAll()
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
                userTags: []
            }
        })
        // TODO: temporarily, skip scraping and add files directly to upload queue
        // scrapeFiles.value.push(...files)
        addToUpload(files)
    }

    function addToUpload(files: QueuedFile[]) {
        uploadFiles.value.push(...files)
    }

    function moveToUpload(fileIds: string[]) {
        const idSet = new Set(fileIds)
        const toMove = scrapeFiles.value.filter((f) => idSet.has(f.id))
        scrapeFiles.value = scrapeFiles.value.filter((f) => !idSet.has(f.id))
        const moved = toMove.map((f) => ({
            ...f,
            scrapeStatus: SCRAPE_STATUS.SKIPPED,
            uploadStatus: UPLOAD_STATUS.IDLE
        }))
        uploadFiles.value.push(...moved)
        const next = new Set(scrapeSelection.selectedIds.value)
        fileIds.forEach((id) => next.delete(id))
        scrapeSelection.selectedIds.value = next
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

    function removeUserTag(fileIds: string[], tag: string) {
        scrapeFiles.value = scrapeFiles.value.map((f) => {
            if (!fileIds.includes(f.id)) return f
            return { ...f, userTags: f.userTags.filter((t) => t !== tag) }
        })
    }

    function removeDropDataTag(fileIds: string[], tag: string) {
        scrapeFiles.value = scrapeFiles.value.map((f) => {
            if (!fileIds.includes(f.id)) return f
            return {
                ...f,
                dropData: {
                    ...f.dropData,
                    tags: f.dropData.tags.filter((t) => t !== tag)
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

    function remove(side: 'scrape' | 'upload', id: string) {
        if (side === 'scrape') {
            scrapeFiles.value = scrapeFiles.value.filter((f) => f.id !== id)
            if (scrapeSelection.selectedIds.value.has(id)) {
                const next = new Set(scrapeSelection.selectedIds.value)
                next.delete(id)
                scrapeSelection.selectedIds.value = next
            }
        } else {
            uploadFiles.value = uploadFiles.value.filter((f) => f.id !== id)
            if (uploadSelection.selectedIds.value.has(id)) {
                const next = new Set(uploadSelection.selectedIds.value)
                next.delete(id)
                uploadSelection.selectedIds.value = next
            }
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
        addUserTags,
        removeUserTag,
        removeDropDataTag,
        clearDropDataTags,
        updateName,
        updateOriginalSourceUrl,
        moveToUpload
    }
})

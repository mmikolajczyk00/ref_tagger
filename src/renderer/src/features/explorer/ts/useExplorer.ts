// composables/useLocalExplorer.ts
import { eventBus } from '@renderer/events/bus'
import { MediaFile } from 'src/shared/types/models'
import { onMounted, onUnmounted, ref } from 'vue'

export function useExplorer() {
    const mediaFiles = ref<MediaFile[]>([])
    const isLoading = ref(false)
    const isInitialized = ref(false)
    const currentPage = ref(1)
    const hasMoreData = ref(true)

    async function initialize() {
        if (isInitialized.value) return
        isInitialized.value = true

        resetAndRefresh()
    }

    async function fetchNextPage() {
        if (isLoading.value || !hasMoreData.value) return

        isLoading.value = true
        try {
            const result = await window.api.files.getMediaFiles(currentPage.value, 50)
            if (!result.success) {
                console.error('Failed to fetch files:', result.error)
                return
            }

            if (result.data.data.length < 50) hasMoreData.value = false

            mediaFiles.value.push(...result.data.data)
            currentPage.value++
        } catch (error) {
            console.error('Unexpected error:', error)
        } finally {
            isLoading.value = false
        }
    }

    function resetAndRefresh() {
        mediaFiles.value = []
        currentPage.value = 1
        hasMoreData.value = true
        fetchNextPage()
    }

    onMounted(() => eventBus.on('files:updated', handleFilesUpdated))
    onUnmounted(() => eventBus.off('files:updated', handleFilesUpdated))

    function handleFilesUpdated({
        ids,
        files
    }: {
        ids: Set<number>
        files: Map<number, MediaFile>
    }) {
        mediaFiles.value = mediaFiles.value.map((f) => {
            if (ids.has(f.id)) {
                const updatedFile = files.get(f.id)
                return updatedFile ?? f
            }
            return f
        })
        console.log('handleFilesUpdated', ids, files)
    }

    return { mediaFiles, isLoading, fetchNextPage, resetAndRefresh, initialize }
}

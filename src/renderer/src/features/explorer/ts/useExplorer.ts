// composables/useLocalExplorer.ts
import { ref } from 'vue'
import { parseSearchChips } from '../../search/ts/parseSearchQuery'
import { FileTagResult, MediaFile, TagSearchQuery } from 'src/shared/types/models'

export function useExplorer() {
    const mediaFiles = ref<Record<number, MediaFile>>({})
    const isLoading = ref(false)
    const isInitialized = ref(false)
    const currentPage = ref(1)
    const hasMoreData = ref(true)
    const query = ref<TagSearchQuery | null>(null)

    async function initialize() {
        if (isInitialized.value) return
        isInitialized.value = true

        resetAndRefresh()
    }

    function search(chips: string[]) {
        if (!chips.length) {
            query.value = null
        } else {
            const { requiredExact, requiredExpanded, excludedExact, excludedExpanded, normal } =
                parseSearchChips(chips)
            query.value = {
                requiredExactTags: requiredExact,
                requiredExpandedTags: requiredExpanded,
                excludedExactTags: excludedExact,
                excludedExpandedTags: excludedExpanded,
                normalTags: normal
            }
        }
        resetAndRefresh()
    }

    async function refetch() {
        if (isLoading.value) return
        isLoading.value = true

        try {
            const result = await window.api.files.getFilesOfIds(
                Object.keys(mediaFiles.value).map((k) => Number(k))
            )

            if (!result.success) {
                console.error('Failed to fetch files:', result.error)
                return
            }

            mediaFiles.value = result.data
        } finally {
            isLoading.value = false
        }
    }

    async function fetchNextPage() {
        if (isLoading.value || !hasMoreData.value) return

        isLoading.value = true
        try {
            const result = query.value
                ? await window.api.files.searchFiles({
                      requiredExactTags: [...(query.value.requiredExactTags ?? [])],
                      requiredExpandedTags: [...(query.value.requiredExpandedTags ?? [])],
                      excludedExactTags: [...(query.value.excludedExactTags ?? [])],
                      excludedExpandedTags: [...(query.value.excludedExpandedTags ?? [])],
                      normalTags: [...(query.value.normalTags ?? [])],
                      page: currentPage.value,
                      limit: 50
                  })
                : await window.api.files.getMediaFiles(currentPage.value, 50)

            if (!result.success) {
                console.error('Failed to fetch files:', result.error)
                return
            }

            if (result.data.total < 50) hasMoreData.value = false

            mediaFiles.value = { ...mediaFiles.value, ...result.data.data }
            currentPage.value++
        } catch (error) {
            console.error('Unexpected error:', error)
        } finally {
            isLoading.value = false
        }
    }

    function resetAndRefresh() {
        mediaFiles.value = {}
        currentPage.value = 1
        hasMoreData.value = true
        fetchNextPage()
    }

    function applyFileTagUpdates(updates: FileTagResult[]) {
        for (const u of updates) {
            const existing = mediaFiles.value[u.id]
            if (existing) {
                mediaFiles.value[u.id] = { ...existing, tags: u.tags }
            }
        }
    }

    function applyFileTagUpdatesToRecord(
        record: Record<number, MediaFile>,
        updates: FileTagResult[]
    ): Record<number, MediaFile> {
        const next = { ...record }
        for (const u of updates) {
            const existing = next[u.id]
            if (existing) next[u.id] = { ...existing, tags: u.tags }
        }
        return next
    }

    return {
        mediaFiles,
        isLoading,
        fetchNextPage,
        resetAndRefresh,
        initialize,
        query,
        search,
        refetch,
        applyFileTagUpdates,
        applyFileTagUpdatesToRecord
    }
}

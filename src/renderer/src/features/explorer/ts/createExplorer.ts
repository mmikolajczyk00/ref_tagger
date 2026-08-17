import { computed, proxyRefs, ref } from 'vue'
import { parseSearchChips } from '../../search/ts/parseSearchQuery'
import { MediaFile, TagSearchQuery } from '@shared/types/models'
import { createListSelection } from '../../../core/utils/listSelection'

export function createExplorer() {
    const mediaFiles = ref<Map<number, MediaFile>>(new Map())
    const isLoading = ref(false)
    const isInitialized = ref(false)
    const currentPage = ref(1)
    const hasMoreData = ref(true)
    const query = ref<TagSearchQuery | null>(null)

    const mediaFilesArr = computed(() => Array.from(mediaFiles.value.values()))
    const selection = createListSelection<MediaFile, number>(mediaFilesArr)
    const selectedItems = computed(() =>
        mediaFilesArr.value.filter((f) => selection.selectedIds.has(f.id))
    )

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
            const result = await window.api.files.getFilesOfIds(Array.from(mediaFiles.value.keys()))

            if (!result.success) {
                console.error('Failed to fetch files:', result.error)
                return
            }
            mediaFiles.value = new Map(result.data)
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

            mediaFiles.value = new Map([...mediaFiles.value, ...result.data.data])

            console.log(result.data)
            console.log(mediaFiles.value)

            currentPage.value++
        } catch (error) {
            console.error('Unexpected error:', error)
        } finally {
            isLoading.value = false
        }
    }

    function resetAndRefresh() {
        mediaFiles.value = new Map()
        currentPage.value = 1
        hasMoreData.value = true
        selection.clearSelection()
        fetchNextPage()
    }

    function applyFilesUpdate(updated: MediaFile[]) {
        const next = new Map(mediaFiles.value)
        for (const f of updated) next.set(f.id, f)
        mediaFiles.value = next
    }

    return proxyRefs({
        mediaFiles,
        isLoading,
        selection,
        selectedItems,
        initialize,
        query,
        search,
        refetch,
        fetchNextPage,
        resetAndRefresh,
        applyFilesUpdate
    })
}

export type Explorer = ReturnType<typeof createExplorer>

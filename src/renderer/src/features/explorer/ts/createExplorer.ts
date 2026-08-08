import { computed, proxyRefs, ref } from 'vue'
import { parseSearchChips } from '../../search/ts/parseSearchQuery'
import { FileTagResult, MediaFile, TagSearchQuery } from 'src/shared/types/models'

export function createExplorer() {
    const mediaFiles = ref<Map<number, MediaFile>>(new Map())
    const isLoading = ref(false)
    const isInitialized = ref(false)
    const currentPage = ref(1)
    const hasMoreData = ref(true)
    const query = ref<TagSearchQuery | null>(null)

    const selectedIds = ref<Set<number>>(new Set())
    const lastSelectedIndex = ref<number | null>(null)

    const selectedItems = computed(() => {
        return Array.from(mediaFiles.value.values()).filter((f) => selectedIds.value.has(f.id))
    })

    function handleItemClick(event: MouseEvent, currentItem: MediaFile, currentIndex: number) {
        const items = Array.from(mediaFiles.value.values())

        if (event.shiftKey && lastSelectedIndex.value !== null) {
            const start = Math.min(lastSelectedIndex.value, currentIndex)
            const end = Math.max(lastSelectedIndex.value, currentIndex)

            for (let i = start; i <= end; i++) {
                selectedIds.value.add(items[i].id)
            }
            return
        }

        if (event.ctrlKey || event.metaKey) {
            if (selectedIds.value.has(currentItem.id)) {
                selectedIds.value.delete(currentItem.id)
            } else {
                selectedIds.value.add(currentItem.id)
            }
            lastSelectedIndex.value = currentIndex
            return
        }

        selectedIds.value.clear()
        selectedIds.value.add(currentItem.id)
        lastSelectedIndex.value = currentIndex
    }

    function clearSelection() {
        selectedIds.value.clear()
        lastSelectedIndex.value = null
    }

    function isSelected(id: number): boolean {
        return selectedIds.value.has(id)
    }

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
        clearSelection()
        fetchNextPage()
    }

    function applyFileTagUpdates(updates: FileTagResult[]) {
        for (const u of updates) {
            const existing = mediaFiles.value.get(u.id)
            if (existing) {
                mediaFiles.value.set(u.id, { ...existing, tags: u.tags })
            }
        }
    }

    function applyFileTagUpdatesToMap(
        map: Map<number, MediaFile>,
        updates: FileTagResult[]
    ): Map<number, MediaFile> {
        const next = new Map(map)
        for (const u of updates) {
            const existing = next.get(u.id)
            if (existing) next.set(u.id, { ...existing, tags: u.tags })
        }
        return next
    }

    return proxyRefs({
        mediaFiles,
        isLoading,
        selectedIds,
        selectedItems,
        handleItemClick,
        clearSelection,
        isSelected,
        initialize,
        query,
        search,
        refetch,
        fetchNextPage,
        resetAndRefresh,
        applyFileTagUpdates,
        applyFileTagUpdatesToMap
    })
}

export type Explorer = ReturnType<typeof createExplorer>

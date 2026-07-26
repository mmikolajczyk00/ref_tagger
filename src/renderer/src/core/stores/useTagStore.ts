import { defineStore } from 'pinia'
import { ref } from 'vue'
import { normalizeTag } from '../utils/tagsUtils'

export interface ITag {
    id: number
    name: string
}

export const useTagStore = defineStore('tags', () => {
    const tags = ref<ITag[]>([])
    const isLoaded = ref(false)
    const tagNamesSet = ref(new Set<string>())
    const tagIdsSet = ref(new Set<number>())

    // 1. Fetch tags once on app start
    async function fetchTags() {
        const res = await window.api.tags.getAll()

        if (res.success && res.data) {
            tags.value = res.data

            // Populate sets in a single pass on app startup
            const names = new Set<string>()
            const ids = new Set<number>()

            for (let i = 0; i < res.data.length; i++) {
                names.add(normalizeTag(res.data[i].name))
                ids.add(res.data[i].id)
            }

            tagNamesSet.value = names
            tagIdsSet.value = ids
        }
    }

    function hasTag(tagName: string): boolean {
        return tagNamesSet.value.has(normalizeTag(tagName))
    }

    // 2. Add a newly created tag straight into memory
    function addTagLocally(tag: ITag) {
        const normalized = normalizeTag(tag.name)

        if (!tagNamesSet.value.has(normalized)) {
            tagNamesSet.value.add(normalized)
            tagIdsSet.value.add(tag.id)

            tags.value.push({ id: tag.id, name: normalized })
        }
    }

    // 3. Synchronous search helper for ghost text matching
    // exclude ids: ids of tags to exclude from the search results e.g. tags already selected in the input
    function getMatchingTags(query: string, excludeIds: Set<number> = new Set()): ITag[] {
        const cleanQuery = normalizeTag(query)
        if (!cleanQuery) return []

        return tags.value.filter(
            (tag) => !excludeIds.has(tag.id) && tag.name.startsWith(cleanQuery)
        )
    }

    return {
        tags,
        isLoaded,
        fetchTags,
        addTagLocally,
        getMatchingTags,
        hasTag
    }
})

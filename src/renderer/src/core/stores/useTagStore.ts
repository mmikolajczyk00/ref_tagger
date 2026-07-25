import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface Tag {
    id: number
    name: string
}

export const useTagStore = defineStore('tags', () => {
    const tags = ref<Tag[]>([])
    const isLoaded = ref(false)

    // 1. Fetch tags once on app start
    async function fetchTags() {
        if (isLoaded.value) return // Prevent duplicate network calls

        const res = await window.api.tags.getAll()
        if (res.success && res.data) {
            tags.value = res.data
            isLoaded.value = true
        }
    }

    // 2. Add a newly created tag straight into memory
    function addTagLocally(tag: Tag) {
        if (!tags.value.some((t) => t.id === tag.id)) {
            tags.value.push(tag)
            tags.value.sort((a, b) => a.name.localeCompare(b.name)) // Keep sorted
        }
    }

    // 3. Synchronous search helper for ghost text matching
    function getMatchingTags(query: string, excludeIds: Set<number> = new Set()): Tag[] {
        const cleanQuery = query.trim().toLowerCase()
        if (!cleanQuery) return []

        return tags.value.filter(
            (tag) => !excludeIds.has(tag.id) && tag.name.toLowerCase().startsWith(cleanQuery)
        )
    }

    return {
        tags,
        isLoaded,
        fetchTags,
        addTagLocally,
        getMatchingTags
    }
})

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { normalizeTag } from '../utils/tagsUtils'
import { Tag } from '@shared/types/models'

export const useTagStore = defineStore('tags', () => {
    const tags = ref<Tag[]>([])
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
    function addTagLocally(tag: Tag) {
        const normalized = normalizeTag(tag.name)

        if (!tagNamesSet.value.has(normalized)) {
            tagNamesSet.value.add(normalized)
            tagIdsSet.value.add(tag.id)

            tag.name = normalized
            tags.value.push(tag)
        }
    }
    function addTagsLocally(tags: Tag[]) {
        for (const tag of tags) {
            addTagLocally(tag)
        }
    }

    function updateTagLocally(id: number, name: string, color: string) {
        const idx = tags.value.findIndex((t) => t.id === id)
        if (idx < 0) return
        const prev = tags.value[idx]
        const oldName = prev.name
        const newName = normalizeTag(name)
        tags.value[idx] = { id, name, color }
        if (oldName !== newName) {
            tagNamesSet.value.delete(oldName)
            tagNamesSet.value.add(newName)
        }
    }

    function removeTagLocally(id: number) {
        const idx = tags.value.findIndex((t) => t.id === id)
        if (idx < 0) return

        const removed = tags.value[idx]
        tagNamesSet.value.delete(normalizeTag(removed.name))
        tagIdsSet.value.delete(id)
        tags.value.splice(idx, 1)
    }

    // 3. Synchronous search helper for ghost text matching
    // exclude ids: ids of tags to exclude from the search results e.g. tags already selected in the input
    function getMatchingTags(query: string, excludeIds: Set<number> = new Set()): Tag[] {
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
        addTagsLocally,
        updateTagLocally,
        removeTagLocally,
        getMatchingTags,
        hasTag
    }
})

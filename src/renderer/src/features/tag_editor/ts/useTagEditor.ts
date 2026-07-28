// Tags are loaded fully into memory and paged client-side by PrimeVue DataTable.
// At ~1k-2k tags the IPC payload is <200KB and render/filter stay sub-ms.
// Revisit server-side pagination around 50k+ tags (multi-MB payload, perceptible
// per-keystroke filter latency). Note: useTagStore also loads all tags at app
// start for app-wide autocomplete, so the full set is in memory regardless.

import { ref, computed, onMounted, watch } from 'vue'
import { Tag } from 'src/shared/types/models'
import { useTagStore } from '@renderer/core/stores/useTagStore'

export function useTagEditor() {
    const tagStore = useTagStore()
    const tags = ref<Record<number, Tag>>({})
    const isLoading = ref(false)
    const searchQuery = ref('')
    const first = ref(0)
    const rows = ref(10)

    const filteredTags = computed(() => {
        const q = searchQuery.value.toLowerCase().trim()
        const all = Object.values(tags.value)
        if (!q) return all
        return all.filter((t) => t.name.toLowerCase().includes(q))
    })

    watch(searchQuery, () => {
        first.value = 0
    })

    async function refetch() {
        isLoading.value = true
        const res = await window.api.tags.getAll()
        if (res.success) tags.value = Object.fromEntries(res.data.map((t) => [t.id, t]))
        else console.error('Failed to load tags:', res.error)
        isLoading.value = false
    }

    async function addTag(name: string, color: string) {
        const res = await window.api.tags.create(name, color)
        if (res.success) {
            tags.value[res.data.id] = res.data
            tagStore.addTagLocally(res.data)
        } else {
            console.error('Failed to add tag:', res.error)
        }
        return res
    }

    async function removeTag(id: number) {
        const res = await window.api.tags.delete(id)
        if (res.success) {
            delete tags.value[id]
            tagStore.removeTagLocally(id)
        } else {
            console.error('Failed to delete tag:', res.error)
        }
        return res
    }

    async function updateTagName(id: number, name: string) {
        const existed = id in tags.value
        const res = await window.api.tags.updateName(id, name)
        if (res.success) {
            tags.value[id] = res.data
            if (existed) {
                tagStore.updateTagLocally(id, res.data.name, res.data.color)
            }
        } else {
            console.error('Failed to rename tag:', res.error)
        }
        return res
    }

    async function updateTagColor(id: number, color: string) {
        const existed = id in tags.value
        const res = await window.api.tags.updateColor(id, color)
        if (res.success) {
            tags.value[id] = res.data
            if (existed) {
                tagStore.updateTagLocally(id, res.data.name, res.data.color)
            }
        } else {
            console.error('Failed to update tag color:', res.error)
        }
        return res
    }

    onMounted(refetch)

    return {
        tags,
        isLoading,
        searchQuery,
        filteredTags,
        first,
        rows,
        refetch,
        addTag,
        removeTag,
        updateTagName,
        updateTagColor
    }
}

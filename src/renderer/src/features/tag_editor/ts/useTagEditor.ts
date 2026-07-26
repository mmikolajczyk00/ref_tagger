import { ref, computed, onMounted, watch } from 'vue'
import { Tag } from 'src/shared/types/models'

export function useTagEditor() {
    const tags = ref<Tag[]>([])
    const isLoading = ref(false)
    const isInitialized = ref(false)
    const searchQuery = ref('')
    const first = ref(0)
    const rows = ref(10)

    const filteredTags = computed(() => {
        const q = searchQuery.value.toLowerCase().trim()
        if (!q) return tags.value
        return tags.value.filter((t) => t.name.toLowerCase().includes(q))
    })

    watch(searchQuery, () => {
        first.value = 0
    })

    async function loadTags() {
        if (isInitialized.value) return
        isInitialized.value = true
        isLoading.value = true
        const res = await window.api.tags.getAll()
        if (res.success) tags.value = res.data
        else console.error('Failed to load tags:', res.error)
        isLoading.value = false
    }

    async function addTag(name: string, color: string) {
        const res = await window.api.tags.create(name, color)
        if (res.success) {
            tags.value.push(res.data)
        } else {
            console.error('Failed to add tag:', res.error)
        }
        return res
    }

    async function removeTag(id: number) {
        const res = await window.api.tags.delete(id)
        if (res.success) {
            tags.value = tags.value.filter((t) => t.id !== id)
        } else {
            console.error('Failed to delete tag:', res.error)
        }
        return res
    }

    async function updateTagName(id: number, name: string) {
        const res = await window.api.tags.updateName(id, name)
        if (res.success) {
            const idx = tags.value.findIndex((t) => t.id === id)
            if (idx >= 0) tags.value[idx] = res.data
        } else {
            console.error('Failed to rename tag:', res.error)
        }
        return res
    }

    async function updateTagColor(id: number, color: string) {
        const res = await window.api.tags.updateColor(id, color)
        if (res.success) {
            const idx = tags.value.findIndex((t) => t.id === id)
            if (idx >= 0) tags.value[idx] = res.data
        } else {
            console.error('Failed to update tag color:', res.error)
        }
        return res
    }

    onMounted(loadTags)

    return {
        tags,
        isLoading,
        searchQuery,
        filteredTags,
        first,
        rows,
        loadTags,
        addTag,
        removeTag,
        updateTagName,
        updateTagColor
    }
}

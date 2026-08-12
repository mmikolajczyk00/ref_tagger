import { ref, onMounted } from 'vue'
import { Blacklist } from '@shared/types/models'

export function useBlacklistPanel() {
    const blacklists = ref<Blacklist[]>([])
    const currentlyEditedListId = ref<number | null>(null)
    const pendingTags = ref<string[]>([])
    const deletingIds = ref<Set<number>>(new Set())

    async function refetch() {
        const res = await window.api.tagsProcessing.blacklist.getAll()
        if (res.success) {
            blacklists.value = res.data
        } else {
            console.error('Failed to load blacklists:', res.error)
        }
    }

    function selectList(id: number | null) {
        currentlyEditedListId.value = id
        pendingTags.value = []
    }

    function pickUniqueName(base: string): string {
        const names = new Set(blacklists.value.map((b) => b.listName))
        if (!names.has(base)) return base
        let i = 1
        while (names.has(`${base} (${i})`)) i++
        return `${base} (${i})`
    }

    async function createBlacklist(): Promise<number | null> {
        const listName = pickUniqueName('New list')
        const res = await window.api.tagsProcessing.blacklist.create(listName)
        if (res.success) {
            blacklists.value.push(res.data)
            selectList(res.data.id)
            return res.data.id
        }
        console.error('Failed to create blacklist:', res.error)
        return null
    }

    async function removeTag(listId: number, tag: string) {
        const list = blacklists.value.find((b) => b.id === listId)
        if (!list) return
        const snapshot = [...list.tags]
        list.tags = list.tags.filter((t) => t !== tag)
        const res = await window.api.tagsProcessing.blacklist.removeTag(listId, tag)
        if (!res.success) {
            console.error('Failed to remove tag:', res.error)
            list.tags = snapshot
        }
    }

    async function submitPendingTags() {
        const id = currentlyEditedListId.value
        if (id === null) return
        const tags = [...pendingTags.value]
        if (tags.length === 0) return
        pendingTags.value = []
        const res = await window.api.tagsProcessing.blacklist.addTags(id, tags)
        if (res.success) {
            const list = blacklists.value.find((b) => b.id === id)
            if (list) {
                const existing = new Set(list.tags)
                list.tags = [...list.tags, ...tags.filter((t) => !existing.has(t))]
            }
        } else {
            console.error('Failed to add tags:', res.error)
            pendingTags.value = [...tags, ...pendingTags.value]
        }
    }

    async function renameBlacklist(id: number, newName: string) {
        const list = blacklists.value.find((b) => b.id === id)
        if (!list) return
        const previous = list.listName
        if (previous === newName) return
        list.listName = newName
        const res = await window.api.tagsProcessing.blacklist.rename(id, newName)
        if (!res.success) {
            console.error('Failed to rename blacklist:', res.error)
            list.listName = previous
        }
    }

    async function deleteBlacklist(id: number) {
        deletingIds.value = new Set(deletingIds.value).add(id)
        const res = await window.api.tagsProcessing.blacklist.delete(id)
        deletingIds.value = new Set([...deletingIds.value].filter((x) => x !== id))
        if (res.success) {
            blacklists.value = blacklists.value.filter((b) => b.id !== id)
            if (currentlyEditedListId.value === id) {
                currentlyEditedListId.value = null
                pendingTags.value = []
            }
        } else {
            console.error('Failed to delete blacklist:', res.error)
        }
    }

    onMounted(refetch)

    return {
        blacklists,
        currentlyEditedListId,
        pendingTags,
        deletingIds,
        refetch,
        selectList,
        createBlacklist,
        removeTag,
        submitPendingTags,
        renameBlacklist,
        deleteBlacklist
    }
}

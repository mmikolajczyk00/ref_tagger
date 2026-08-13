import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTagsProcessingStore } from '../../../core/stores/useTagsProcessingStore'

export function useBlacklistPanel() {
    const store = useTagsProcessingStore()
    const { blacklists } = storeToRefs(store)

    const currentlyEditedListId = ref<number | null>(null)
    const deletingIds = ref<Set<number>>(new Set())

    async function refetch() {
        await store.fetchBlacklists()
    }

    function selectList(id: number | null) {
        currentlyEditedListId.value = id
    }

    async function createBlacklist(): Promise<number | null> {
        const id = await store.createBlacklist()
        if (id !== null) selectList(id)
        return id
    }

    async function addTag(listId: number, tag: string) {
        const list = blacklists.value.find((b) => b.id === listId)
        if (!list) return
        const res = await window.api.tagsProcessing.blacklist.addTags(listId, [tag])
        if (!res.success) {
            console.error('Failed to add blacklist tag:', res.error)
            list.tags = list.tags.filter((t) => t !== tag)
        }
    }

    async function removeTag(listId: number, tag: string) {
        const list = blacklists.value.find((b) => b.id === listId)
        if (!list) return
        const res = await window.api.tagsProcessing.blacklist.removeTag(listId, tag)
        if (!res.success) {
            console.error('Failed to remove blacklist tag:', res.error)
            if (!list.tags.includes(tag)) list.tags = [...list.tags, tag]
        }
    }

    async function editTag(listId: number, oldName: string, newName: string) {
        const list = blacklists.value.find((b) => b.id === listId)
        if (!list) return
        const removeRes = await window.api.tagsProcessing.blacklist.removeTag(listId, oldName)
        if (!removeRes.success) {
            console.error('Failed to rename blacklist tag (remove):', removeRes.error)
            return
        }
        const addRes = await window.api.tagsProcessing.blacklist.addTags(listId, [newName])
        if (!addRes.success) {
            console.error('Failed to rename blacklist tag (add):', addRes.error)
            list.tags = [...list.tags, oldName]
            return
        }
        list.tags = [...list.tags.filter((t) => t !== oldName), newName]
    }

    async function renameBlacklist(id: number, newName: string) {
        await store.renameBlacklist(id, newName)
    }

    async function deleteBlacklist(id: number) {
        deletingIds.value = new Set(deletingIds.value).add(id)
        await store.deleteBlacklist(id)
        deletingIds.value = new Set([...deletingIds.value].filter((x) => x !== id))
        if (currentlyEditedListId.value === id) {
            currentlyEditedListId.value = null
        }
    }

    return {
        blacklists,
        currentlyEditedListId,
        deletingIds,
        refetch,
        selectList,
        createBlacklist,
        addTag,
        removeTag,
        editTag,
        renameBlacklist,
        deleteBlacklist
    }
}

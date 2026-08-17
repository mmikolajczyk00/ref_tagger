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

    async function addTags(listId: number, tags: string[]) {
        await store.addBlacklistTags(listId, tags)
    }

    async function removeTags(listId: number, tags: string[]) {
        await store.removeBlacklistTags(listId, tags)
    }

    async function editTag(listId: number, oldName: string, newName: string) {
        await store.editBlacklistTag(listId, oldName, newName)
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
        addTags,
        removeTags,
        editTag,
        renameBlacklist,
        deleteBlacklist
    }
}

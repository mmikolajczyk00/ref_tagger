import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTagsProcessingStore } from '../../../core/stores/useTagsProcessingStore'

export function useAliasesPanel() {
    const store = useTagsProcessingStore()
    const { aliases } = storeToRefs(store)

    const currentlyEditedAliasId = ref<number | null>(null)
    const deletingIds = ref<Set<number>>(new Set())

    async function refetch() {
        await store.fetchAliases()
    }

    function selectAlias(id: number | null) {
        currentlyEditedAliasId.value = id
    }

    async function createAlias(): Promise<number | null> {
        const id = await store.createAlias()
        if (id !== null) selectAlias(id)
        return id
    }

    async function addTags(aliasId: number, tags: string[]) {
        await store.addAliasTags(aliasId, tags)
    }

    async function removeTags(aliasId: number, tags: string[]) {
        await store.removeAliasTags(aliasId, tags)
    }

    async function editTag(aliasId: number, oldName: string, newName: string) {
        await store.editAliasTag(aliasId, oldName, newName)
    }

    async function renameAlias(id: number, newName: string) {
        await store.renameAlias(id, newName)
    }

    async function deleteAlias(id: number) {
        deletingIds.value = new Set(deletingIds.value).add(id)
        await store.deleteAlias(id)
        deletingIds.value = new Set([...deletingIds.value].filter((x) => x !== id))
        if (currentlyEditedAliasId.value === id) {
            currentlyEditedAliasId.value = null
        }
    }

    return {
        aliases,
        currentlyEditedAliasId,
        deletingIds,
        refetch,
        selectAlias,
        createAlias,
        addTags,
        removeTags,
        editTag,
        renameAlias,
        deleteAlias
    }
}

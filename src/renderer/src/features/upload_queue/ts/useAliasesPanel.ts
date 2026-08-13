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

    async function addTag(aliasId: number, tag: string) {
        const alias = aliases.value.find((a) => a.id === aliasId)
        if (!alias) return
        const res = await window.api.tagsProcessing.aliases.addTags(aliasId, [tag])
        if (!res.success) {
            console.error('Failed to add alias tag:', res.error)
            alias.aliasTags = alias.aliasTags.filter((t) => t !== tag)
        }
    }

    async function removeAliasTag(aliasId: number, tag: string) {
        const alias = aliases.value.find((a) => a.id === aliasId)
        if (!alias) return
        const res = await window.api.tagsProcessing.aliases.removeTag(aliasId, tag)
        if (!res.success) {
            console.error('Failed to remove alias tag:', res.error)
            if (!alias.aliasTags.includes(tag)) alias.aliasTags = [...alias.aliasTags, tag]
        }
    }

    async function editTag(aliasId: number, oldName: string, newName: string) {
        const alias = aliases.value.find((a) => a.id === aliasId)
        if (!alias) return
        const removeRes = await window.api.tagsProcessing.aliases.removeTag(aliasId, oldName)
        if (!removeRes.success) {
            console.error('Failed to rename alias tag (remove):', removeRes.error)
            return
        }
        const addRes = await window.api.tagsProcessing.aliases.addTags(aliasId, [newName])
        if (!addRes.success) {
            console.error('Failed to rename alias tag (add):', addRes.error)
            alias.aliasTags = [...alias.aliasTags, oldName]
            return
        }
        alias.aliasTags = [...alias.aliasTags.filter((t) => t !== oldName), newName]
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
        addTag,
        removeAliasTag,
        editTag,
        renameAlias,
        deleteAlias
    }
}

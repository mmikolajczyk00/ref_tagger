import { ref, onMounted } from 'vue'
import { Alias } from '@shared/types/models'

export function useAliasesPanel() {
    const aliases = ref<Alias[]>([])
    const currentlyEditedAliasId = ref<number | null>(null)
    const pendingAliases = ref<string[]>([])
    const deletingIds = ref<Set<number>>(new Set())

    async function refetch() {
        const res = await window.api.tagsProcessing.aliases.getAll()
        if (res.success) {
            aliases.value = res.data
        } else {
            console.error('Failed to load aliases:', res.error)
        }
    }

    function selectAlias(id: number | null) {
        currentlyEditedAliasId.value = id
        pendingAliases.value = []
    }

    function pickUniqueName(base: string): string {
        const names = new Set(aliases.value.map((a) => a.realTag))
        if (!names.has(base)) return base
        let i = 1
        while (names.has(`${base}_${i}`)) i++
        return `${base}_${i}`
    }

    async function createAlias(): Promise<number | null> {
        const realTag = pickUniqueName('new_alias')
        const res = await window.api.tagsProcessing.aliases.create(realTag)
        if (res.success) {
            aliases.value.push(res.data)
            selectAlias(res.data.id)
            return res.data.id
        }
        console.error('Failed to create alias:', res.error)
        return null
    }

    async function removeAliasTag(aliasId: number, tag: string) {
        const alias = aliases.value.find((a) => a.id === aliasId)
        if (!alias) return
        const snapshot = [...alias.aliasTags]
        alias.aliasTags = alias.aliasTags.filter((t) => t !== tag)
        const res = await window.api.tagsProcessing.aliases.removeTag(aliasId, tag)
        if (!res.success) {
            console.error('Failed to remove alias tag:', res.error)
            alias.aliasTags = snapshot
        }
    }

    async function submitPendingAliases() {
        const id = currentlyEditedAliasId.value
        if (id === null) return
        const tags = [...pendingAliases.value]
        if (tags.length === 0) return
        pendingAliases.value = []
        const res = await window.api.tagsProcessing.aliases.addTags(id, tags)
        if (res.success) {
            const alias = aliases.value.find((a) => a.id === id)
            if (alias) {
                const existing = new Set(alias.aliasTags)
                alias.aliasTags = [...alias.aliasTags, ...tags.filter((t) => !existing.has(t))]
            }
        } else {
            console.error('Failed to add alias tags:', res.error)
            pendingAliases.value = [...tags, ...pendingAliases.value]
        }
    }

    async function renameAlias(id: number, newName: string) {
        const alias = aliases.value.find((a) => a.id === id)
        if (!alias) return
        const previous = alias.realTag
        if (previous === newName) return
        alias.realTag = newName
        const res = await window.api.tagsProcessing.aliases.rename(id, newName)
        if (!res.success) {
            console.error('Failed to rename alias:', res.error)
            alias.realTag = previous
        }
    }

    async function deleteAlias(id: number) {
        deletingIds.value = new Set(deletingIds.value).add(id)
        const res = await window.api.tagsProcessing.aliases.delete(id)
        deletingIds.value = new Set([...deletingIds.value].filter((x) => x !== id))
        if (res.success) {
            aliases.value = aliases.value.filter((a) => a.id !== id)
            if (currentlyEditedAliasId.value === id) {
                currentlyEditedAliasId.value = null
                pendingAliases.value = []
            }
        } else {
            console.error('Failed to delete alias:', res.error)
        }
    }

    onMounted(refetch)

    return {
        aliases,
        currentlyEditedAliasId,
        pendingAliases,
        deletingIds,
        refetch,
        selectAlias,
        createAlias,
        removeAliasTag,
        submitPendingAliases,
        renameAlias,
        deleteAlias
    }
}

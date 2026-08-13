import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Alias, Blacklist } from '@shared/types/models'

export const useTagsProcessingStore = defineStore('tags-processing', () => {
    const blacklists = ref<Blacklist[]>([])
    const aliases = ref<Alias[]>([])
    const isLoaded = ref(false)

    const blacklistSet = computed(() => new Set(blacklists.value.flatMap((b) => b.tags)))

    const aliasMap = computed(() => {
        const m = new Map<string, string>()
        for (const a of aliases.value) {
            for (const t of a.aliasTags) {
                m.set(t, a.realTag)
            }
        }
        return m
    })

    async function fetchBlacklists() {
        const res = await window.api.tagsProcessing.blacklist.getAll()
        if (res.success) {
            blacklists.value = res.data
        } else {
            console.error('Failed to load blacklists:', res.error)
        }
    }

    async function fetchAliases() {
        const res = await window.api.tagsProcessing.aliases.getAll()
        if (res.success) {
            aliases.value = res.data
        } else {
            console.error('Failed to load aliases:', res.error)
        }
    }

    async function fetchAll() {
        await Promise.all([fetchBlacklists(), fetchAliases()])
        isLoaded.value = true
    }

    function pickUniqueName(base: string, kind: 'blacklist' | 'alias'): string {
        const names = new Set(
            kind === 'blacklist'
                ? blacklists.value.map((b) => b.listName)
                : aliases.value.map((a) => a.realTag)
        )
        if (!names.has(base)) return base
        if (kind === 'blacklist') {
            let i = 1
            while (names.has(`${base} (${i})`)) i++
            return `${base} (${i})`
        }
        let i = 1
        while (names.has(`${base}_${i}`)) i++
        return `${base}_${i}`
    }

    // Blacklist mutations

    async function createBlacklist(): Promise<number | null> {
        const listName = pickUniqueName('New list', 'blacklist')
        const res = await window.api.tagsProcessing.blacklist.create(listName)
        if (res.success) {
            blacklists.value.push(res.data)
            return res.data.id
        }
        console.error('Failed to create blacklist:', res.error)
        return null
    }

    async function addBlacklistTag(listId: number, tag: string) {
        const list = blacklists.value.find((b) => b.id === listId)
        if (!list) return
        const res = await window.api.tagsProcessing.blacklist.addTags(listId, [tag])
        if (!res.success) {
            console.error('Failed to add blacklist tag:', res.error)
            list.tags = list.tags.filter((t) => t !== tag)
        }
    }

    async function removeBlacklistTag(listId: number, tag: string) {
        const list = blacklists.value.find((b) => b.id === listId)
        if (!list) return
        const res = await window.api.tagsProcessing.blacklist.removeTag(listId, tag)
        if (!res.success) {
            console.error('Failed to remove blacklist tag:', res.error)
            if (!list.tags.includes(tag)) list.tags = [...list.tags, tag]
        }
    }

    async function editBlacklistTag(listId: number, oldName: string, newName: string) {
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
        const res = await window.api.tagsProcessing.blacklist.delete(id)
        if (res.success) {
            blacklists.value = blacklists.value.filter((b) => b.id !== id)
        } else {
            console.error('Failed to delete blacklist:', res.error)
        }
    }

    // Alias mutations

    async function createAlias(): Promise<number | null> {
        const realTag = pickUniqueName('new_alias', 'alias')
        const res = await window.api.tagsProcessing.aliases.create(realTag)
        if (res.success) {
            aliases.value.push(res.data)
            return res.data.id
        }
        console.error('Failed to create alias:', res.error)
        return null
    }

    async function addAliasTag(aliasId: number, tag: string) {
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

    async function editAliasTag(aliasId: number, oldName: string, newName: string) {
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
        const res = await window.api.tagsProcessing.aliases.delete(id)
        if (res.success) {
            aliases.value = aliases.value.filter((a) => a.id !== id)
        } else {
            console.error('Failed to delete alias:', res.error)
        }
    }

    return {
        blacklists,
        aliases,
        isLoaded,
        blacklistSet,
        aliasMap,
        fetchBlacklists,
        fetchAliases,
        fetchAll,
        createBlacklist,
        addBlacklistTag,
        removeBlacklistTag,
        editBlacklistTag,
        renameBlacklist,
        deleteBlacklist,
        createAlias,
        addAliasTag,
        removeAliasTag,
        editAliasTag,
        renameAlias,
        deleteAlias
    }
})

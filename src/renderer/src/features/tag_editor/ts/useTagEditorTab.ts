// Tags are loaded fully into memory and paged client-side by PrimeVue DataTable.
// At ~1k-2k tags the IPC payload is <200KB and render/filter stay sub-ms.
// Revisit server-side pagination around 50k+ tags (multi-MB payload, perceptible
// per-keystroke filter latency). Note: useTagStore also loads all tags at app
// start for app-wide autocomplete, so the full set is in memory regardless.

import { ref, computed, onMounted, watch } from 'vue'
import { Tag } from '@shared/types/models'
import { useTagStore } from '@renderer/core/stores/useTagStore'
import { normalizeTag } from '@renderer/core/utils/tagsUtils'
import type { TagRelations } from '../types'

export function useTagEditorTab() {
    const tagStore = useTagStore()
    const tags = ref<Record<number, Tag>>({})
    const childrenIdsByTag = ref<Record<number, number[]>>({})
    const parentIdsByTag = ref<Record<number, number[]>>({})
    const isLoading = ref(false)
    const searchQuery = ref('')
    const first = ref(0)
    const rows = ref(10)
    const expandedTags = ref<number[]>([])
    const childInputBuffers = ref<Record<number, string[]>>({})
    const parentInputBuffers = ref<Record<number, string[]>>({})

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
        const [tagsRes, relRes] = await Promise.all([
            window.api.tags.getAll(),
            window.api.tags.getAllRelations()
        ])
        if (tagsRes.success) tags.value = Object.fromEntries(tagsRes.data.map((t) => [t.id, t]))
        else console.error('Failed to load tags:', tagsRes.error)
        applyRelations(relRes)
        isLoading.value = false
    }

    async function refetchRelations() {
        const res = await window.api.tags.getAllRelations()
        applyRelations(res)
    }

    function applyRelations(res: { success: boolean; data?: TagRelations; error?: string }) {
        if (res.success && res.data) {
            childrenIdsByTag.value = res.data.childrenByTag
            parentIdsByTag.value = res.data.parentsByTag
        } else {
            console.error('Failed to load relations:', res.error)
        }
    }

    function getChildren(parentId: number): Tag[] {
        const ids = childrenIdsByTag.value[parentId]
        if (!ids) return []
        const byId = new Map(tagStore.tags.map((t) => [t.id, t]))
        return ids.map((id) => byId.get(id)).filter((t): t is Tag => t !== undefined)
    }

    function getParents(childId: number): Tag[] {
        const ids = parentIdsByTag.value[childId]
        if (!ids) return []
        const byId = new Map(tagStore.tags.map((t) => [t.id, t]))
        return ids.map((id) => byId.get(id)).filter((t): t is Tag => t !== undefined)
    }

    function childCount(parentId: number): number {
        return childrenIdsByTag.value[parentId]?.length ?? 0
    }

    function parentCount(childId: number): number {
        return parentIdsByTag.value[childId]?.length ?? 0
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
            await refetchRelations()
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

    async function resolveOrCreateIds(names: string[]): Promise<number[]> {
        const ids: number[] = []
        const existingIds = new Set<number>()
        for (const raw of names) {
            const name = normalizeTag(raw)
            if (!name) continue
            const existing = tagStore.tags.find((t) => t.name === name)
            if (existing) {
                if (!existingIds.has(existing.id)) {
                    existingIds.add(existing.id)
                    ids.push(existing.id)
                }
                continue
            }
            const created = await window.api.tags.create(name, '#FFF')
            if (created.success) {
                tagStore.addTagLocally(created.data)
                tags.value[created.data.id] = created.data
                ids.push(created.data.id)
            } else {
                console.error('Failed to create tag:', created.error)
            }
        }
        return ids
    }

    async function addChildByName(parentId: number, names: string[]) {
        const ids = await resolveOrCreateIds(names)
        if (ids.length === 0) return
        const res = await window.api.tags.addSubtags(parentId, ids)
        if (res.success) {
            await refetchRelations()
        } else {
            console.error('Failed to add child relation:', res.error)
        }
    }

    async function addParentByName(childId: number, names: string[]) {
        const ids = await resolveOrCreateIds(names)
        if (ids.length === 0) return
        const res = await window.api.tags.addParents(childId, ids)
        if (res.success) {
            await refetchRelations()
        } else {
            console.error('Failed to add parent relation:', res.error)
        }
    }

    async function removeChild(parentId: number, childId: number) {
        const res = await window.api.tags.removeSubtags(parentId, [childId])
        if (res.success) {
            await refetchRelations()
        } else {
            console.error('Failed to remove child:', res.error)
        }
    }

    async function removeParent(childId: number, parentId: number) {
        const res = await window.api.tags.removeParents(childId, [parentId])
        if (res.success) {
            await refetchRelations()
        } else {
            console.error('Failed to remove parent:', res.error)
        }
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
        updateTagColor,
        expandedTags,
        childrenIdsByTag,
        parentIdsByTag,
        childInputBuffers,
        parentInputBuffers,
        getChildren,
        getParents,
        childCount,
        parentCount,
        addChildByName,
        addParentByName,
        removeChild,
        removeParent
    }
}

import type { QueuedFile } from './UploadQueue'
import { computed, MaybeRefOrGetter, toValue } from 'vue'
import { useTagStore } from '../../../core/stores/useTagStore'
import { DEFAULT_TAG_COLOR } from '../../../core/utils/colorUtils'

interface TagBucketItem {
    name: string
    color: string
}

export function useUploadQueueDetailsPanel(
    selectedFilesSource: MaybeRefOrGetter<QueuedFile[]>,
    normalizeFn: (input: string) => string
) {
    const selectedFiles = computed(() => toValue(selectedFilesSource) || [])
    const tagStore = useTagStore()

    function resolveColor(tagName: string): string {
        const normalized = normalizeFn(tagName)
        const found = tagStore.tags.find((t) => t.name === normalized)
        return found ? found.color : DEFAULT_TAG_COLOR
    }

    function buildDropDataBuckets(): { all: string[]; some: string[] } {
        const total = selectedFiles.value.length
        if (total === 0) return { all: [], some: [] }

        const counts = new Map<string, number>()

        for (const file of selectedFiles.value) {
            const seen = new Set<string>()
            for (const tag of file.dropData.tags) {
                const key = normalizeFn(tag)
                if (!key) continue
                counts.set(key, (counts.get(key) ?? 0) + (seen.has(key) ? 0 : 1))
                seen.add(key)
            }
        }

        const all: string[] = []
        const some: string[] = []

        counts.forEach((count, key) => {
            if (count === total) {
                all.push(key)
            } else {
                some.push(key)
            }
        })

        return { all, some }
    }

    function buildUserTagBuckets(): { all: TagBucketItem[]; some: TagBucketItem[] } {
        const total = selectedFiles.value.length
        if (total === 0) return { all: [], some: [] }

        const counts = new Map<string, number>()
        const colors = new Map<string, string>()

        for (const file of selectedFiles.value) {
            const seen = new Set<string>()
            for (const tag of file.userTags) {
                const key = normalizeFn(tag)
                if (!key) continue
                if (!colors.has(key)) {
                    colors.set(key, resolveColor(tag))
                }
                counts.set(key, (counts.get(key) ?? 0) + (seen.has(key) ? 0 : 1))
                seen.add(key)
            }
        }

        const all: TagBucketItem[] = []
        const some: TagBucketItem[] = []

        counts.forEach((count, key) => {
            const item = { name: key, color: colors.get(key)! }
            if (count === total) {
                all.push(item)
            } else {
                some.push(item)
            }
        })

        return { all, some }
    }

    const dropDataAllGroup = computed(() => buildDropDataBuckets().all)
    const dropDataSomeGroup = computed(() => buildDropDataBuckets().some)
    const userTagsAllGroup = computed(() => buildUserTagBuckets().all)
    const userTagsSomeGroup = computed(() => buildUserTagBuckets().some)

    const existingUserTagIds = computed(() => {
        const ids = new Set<number>()
        for (const file of selectedFiles.value) {
            for (const tag of file.userTags) {
                const normalized = normalizeFn(tag)
                const found = tagStore.tags.find((t) => t.name === normalized)
                if (found) ids.add(found.id)
            }
        }
        return [...ids]
    })

    function submitUserTags(tagNames: string[]): { fileIds: string[]; tags: string[] } {
        const fileIds = selectedFiles.value.map((f) => f.id)
        return { fileIds, tags: tagNames }
    }

    return {
        dropDataAllGroup,
        dropDataSomeGroup,
        userTagsAllGroup,
        userTagsSomeGroup,
        existingUserTagIds,
        submitUserTags
    }
}

import { MediaFile, Tag, TagOperation } from '@shared/types/models'
import { computed, Ref } from 'vue'

export function useTagEditorPanel(
    selFiles: Ref<MediaFile[]>,
    normalizeFn?: (input: string) => string
) {
    const filesSource = computed<MediaFile[]>(() => selFiles.value)

    const tagBuckets = computed(() => {
        const totalSelected = filesSource.value.length
        const tagCounts = new Map<string | number, { count: number; tag: Tag }>()

        if (totalSelected === 0) return { all: [], some: [] }

        for (const file of filesSource.value) {
            for (const tag of file.tags) {
                if (!tagCounts.has(tag.id)) {
                    tagCounts.set(tag.id, { count: 0, tag })
                }
                tagCounts.get(tag.id)!.count++
            }
        }

        const all: Tag[] = []
        const some: Tag[] = []

        tagCounts.forEach(({ count, tag }) => {
            if (count === totalSelected) {
                all.push(tag)
            } else {
                some.push(tag)
            }
        })

        return { all, some }
    })

    const allGroup = computed(() => tagBuckets.value.all)
    const someGroup = computed(() => tagBuckets.value.some)

    const existingTagIds = computed(() => {
        const ids = new Set<number>()
        for (const file of filesSource.value) {
            for (const tag of file.tags) {
                ids.add(tag.id)
            }
        }
        return [...ids]
    })

    function submitTags(tagNames: string[]): TagOperation[] {
        const normalizedTags = [
            ...new Set(tagNames.map((n) => (normalizeFn ? normalizeFn(n) : n)).filter(Boolean))
        ]

        const operations: TagOperation[] = []

        for (const tagName of normalizedTags) {
            for (const file of filesSource.value) {
                const fileHasTag = file.tags.some((t) => t.name === tagName)

                if (!fileHasTag) {
                    operations.push({
                        action: 'add',
                        fileId: file.id,
                        tagName: tagName
                    })
                }
            }
        }

        return operations
    }

    function removeTag(targetTag: Tag): TagOperation[] {
        const operations: TagOperation[] = []

        for (const file of filesSource.value) {
            const fileHasTag = file.tags.some((t) => t.id === targetTag.id)

            if (fileHasTag) {
                operations.push({
                    action: 'remove',
                    fileId: file.id,
                    tagId: targetTag.id
                })
            }
        }

        return operations
    }

    return {
        allGroup,
        someGroup,
        existingTagIds,
        submitTags,
        removeTag
    }
}

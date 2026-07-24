import { MediaFile, Tag, TagOperation } from 'src/shared/types/models'
import { ref, computed, MaybeRefOrGetter, toValue } from 'vue'

export function useTagEditor(
    selectedFilesSource: MaybeRefOrGetter<MediaFile[]>,
    normalizeFn: (input: string) => string
) {
    const inputText = ref('')

    const selectedFiles = computed(() => toValue(selectedFilesSource) || [])

    // Dynamically bucket tags into ALL and SOME
    const tagBuckets = computed(() => {
        const totalSelected = selectedFiles.value.length
        const tagCounts = new Map<string | number, { count: number; tag: Tag }>()

        if (totalSelected === 0) return { all: [], some: [] }

        // Count how many files have each tag
        for (const file of selectedFiles.value) {
            for (const tag of file.tags) {
                if (!tagCounts.has(tag.id)) {
                    tagCounts.set(tag.id, { count: 0, tag })
                }
                tagCounts.get(tag.id)!.count++
            }
        }

        const all: Tag[] = []
        const some: Tag[] = []

        // Sort them into buckets
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

    // Requirement 1: Add to all files that don't have it
    function submitTags(): TagOperation[] {
        if (!inputText.value.trim()) return []

        // Split by comma or whitespace, filter out empties, apply your normalization
        const rawTags = inputText.value.split(/[,\s]+/).filter(Boolean)
        const normalizedTags = [...new Set(rawTags.map(normalizeFn).filter(Boolean))]

        const operations: TagOperation[] = []

        for (const tagName of normalizedTags) {
            for (const file of selectedFiles.value) {
                // Check if file already has this tag
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

        // Clear input only after successful submission processing
        inputText.value = ''
        return operations
    }

    // Requirement 3: Delete from ALL selected files
    function removeTag(targetTag: Tag): TagOperation[] {
        const operations: TagOperation[] = []

        for (const file of selectedFiles.value) {
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
        inputText,
        allGroup,
        someGroup,
        submitTags,
        removeTag
    }
}

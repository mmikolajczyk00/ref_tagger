import { MediaFile, Tag } from '@shared/types/models'
import { computed, Ref } from 'vue'

export function useTagEditorPanel(selFiles: Ref<MediaFile[]>) {
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

    return {
        allGroup,
        someGroup,
        existingTagIds
    }
}

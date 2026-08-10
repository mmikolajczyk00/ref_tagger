import { ref, Ref } from 'vue'

export interface ListSelectionHandle<K> {
    handleItemClick(event: MouseEvent, item: { id: K }, index: number): void
    isSelected(id: K): boolean
    clearSelection(): void
    selectedIds: Ref<Set<K>>
}

export function createListSelection<T extends { id: K }, K extends string | number>(
    items: Ref<T[]>
): ListSelectionHandle<K> {
    const selectedIds = ref<Set<K>>(new Set())
    const lastIndex = ref<number | null>(null)

    function handleItemClick(event: MouseEvent, currentItem: T, currentIndex: number) {
        if (event.shiftKey && event.ctrlKey && lastIndex.value !== null) {
            const start = Math.min(lastIndex.value, currentIndex)
            const end = Math.max(lastIndex.value, currentIndex)
            const next = new Set(selectedIds.value)
            for (let i = start; i <= end; i++) {
                next.add(items.value[i].id)
            }
            selectedIds.value = next
            return
        }

        if (event.shiftKey && lastIndex.value !== null) {
            const start = Math.min(lastIndex.value, currentIndex)
            const end = Math.max(lastIndex.value, currentIndex)
            const next = new Set<K>()
            for (let i = start; i <= end; i++) {
                next.add(items.value[i].id)
            }
            selectedIds.value = next
            return
        }

        if (event.ctrlKey || event.metaKey) {
            const next = new Set(selectedIds.value)
            if (next.has(currentItem.id)) {
                next.delete(currentItem.id)
            } else {
                next.add(currentItem.id)
            }
            selectedIds.value = next
            lastIndex.value = currentIndex
            return
        }

        selectedIds.value = new Set([currentItem.id])
        lastIndex.value = currentIndex
    }

    function isSelected(id: K): boolean {
        return selectedIds.value.has(id)
    }

    function clearSelection() {
        selectedIds.value = new Set()
        lastIndex.value = null
    }

    return { handleItemClick, isSelected, clearSelection, selectedIds }
}

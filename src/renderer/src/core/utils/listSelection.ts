import { reactive, Ref } from 'vue'

export interface ListSelectionHandle<K> {
    handleItemClick(event: MouseEvent, item: { id: K }, index: number): void
    isSelected(id: K): boolean
    clearSelection(): void
    selectedIds: Set<K>
}

interface SelectionState<K> {
    selectedIds: Set<K>
    lastIndex: number | null
}

export function createListSelection<T extends { id: K }, K extends string | number>(
    items: Ref<T[]>
): ListSelectionHandle<K> {
    const state = reactive({
        selectedIds: new Set<K>(),
        lastIndex: null
    }) as SelectionState<K>

    function handleItemClick(event: MouseEvent, currentItem: T, currentIndex: number) {
        if (event.shiftKey && event.ctrlKey && state.lastIndex !== null) {
            const start = Math.min(state.lastIndex, currentIndex)
            const end = Math.max(state.lastIndex, currentIndex)
            for (let i = start; i <= end; i++) {
                state.selectedIds.add(items.value[i].id)
            }
            return
        }

        if (event.shiftKey && state.lastIndex !== null) {
            const start = Math.min(state.lastIndex, currentIndex)
            const end = Math.max(state.lastIndex, currentIndex)
            for (let i = start; i <= end; i++) {
                state.selectedIds.add(items.value[i].id)
            }
            return
        }

        if (event.ctrlKey || event.metaKey) {
            if (state.selectedIds.has(currentItem.id)) {
                state.selectedIds.delete(currentItem.id)
            } else {
                state.selectedIds.add(currentItem.id)
            }
            state.lastIndex = currentIndex
            return
        }

        state.selectedIds.clear()
        state.selectedIds.add(currentItem.id)
        state.lastIndex = currentIndex
    }

    function isSelected(id: K): boolean {
        return state.selectedIds.has(id)
    }

    function clearSelection() {
        state.selectedIds.clear()
        state.lastIndex = null
    }

    return { handleItemClick, isSelected, clearSelection, selectedIds: state.selectedIds }
}

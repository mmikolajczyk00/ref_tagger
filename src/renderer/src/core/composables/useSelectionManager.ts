// composables/useSelectionManager.ts
import { computed, ref } from 'vue'

export interface Selectable {
    id: number | string
}

export function useSelectionManager<T extends Selectable>(getItems: () => T[]) {
    const selectedIds = ref(new Set<number | string>())
    const lastSelectedIndex = ref<number | null>(null)
    const selectedItems = computed(() => {
        return getItems().filter((i) => selectedIds.value.has(i.id))
    })

    function handleItemClick(event: MouseEvent, currentItem: T, currentIndex: number) {
        const items = getItems()

        // Shift + Click (Range Selection)
        if (event.shiftKey && lastSelectedIndex.value !== null) {
            const start = Math.min(lastSelectedIndex.value, currentIndex)
            const end = Math.max(lastSelectedIndex.value, currentIndex)

            for (let i = start; i <= end; i++) {
                selectedIds.value.add(items[i].id)
            }
            return
        }

        // Ctrl / Cmd + Click (Toggle individual item)
        if (event.ctrlKey || event.metaKey) {
            if (selectedIds.value.has(currentItem.id)) {
                selectedIds.value.delete(currentItem.id)
            } else {
                selectedIds.value.add(currentItem.id)
            }
            lastSelectedIndex.value = currentIndex
            return
        }

        // Standard Single Click (Clear others, select this one)
        selectedIds.value.clear()
        selectedIds.value.add(currentItem.id)
        lastSelectedIndex.value = currentIndex
    }

    function clearSelection() {
        selectedIds.value.clear()
        lastSelectedIndex.value = null
    }

    function isSelected(id: number | string): boolean {
        return selectedIds.value.has(id)
    }

    return {
        selectedIds,
        handleItemClick,
        clearSelection,
        isSelected,
        selectedItems
    }
}

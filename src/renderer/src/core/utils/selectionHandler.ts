import { Ref, triggerRef } from 'vue'

export interface Selectable {
    selected: boolean
}

export class SelectionHandler {
    allObjects: Ref<Array<Selectable>>
    selectedObjects: Ref<Array<Selectable>>
    lastSelected = 0

    constructor(selectableArray: Ref<Array<Selectable>>, selectedObjects: Ref<Array<Selectable>>) {
        this.allObjects = selectableArray
        this.selectedObjects = selectedObjects
    }

    setSelection(index: number): void {
        this.clearSelection()

        this.allObjects.value[index].selected = true
        this.selectedObjects.value = [this.allObjects.value[index]]
        console.log(this.allObjects.value[index])

        this.lastSelected = index
    }

    setSelectionBetween(index_from: number, index_to: number): void {
        this.clearSelection()

        const min = Math.min(index_from, index_to)
        const max = Math.max(index_from, index_to)

        this.selectedObjects.value = this.allObjects.value.slice(min, max + 1)
        this.selectedObjects.value.forEach((file) => {
            file.selected = true
        })
    }

    appendToSelectionBetween(index_from: number, index_to: number): void {
        const min = Math.min(index_from, index_to)
        const max = Math.max(index_from, index_to)
        for (let index = min; index < max; index++) {
            const file = this.allObjects.value[index]
            if (!file.selected) {
                this.selectedObjects.value.push(this.allObjects.value[index])
                triggerRef(this.selectedObjects)
            }
            file.selected = true
        }
    }

    appendToSelection(index: number): void {
        this.allObjects.value[index].selected = true
        this.selectedObjects.value.push(this.allObjects.value[index])
        triggerRef(this.selectedObjects)
        this.lastSelected = index
    }

    removeFromSelection(index: number): void {
        const removed_file = this.allObjects.value[index]
        removed_file.selected = false
        this.selectedObjects.value.splice(this.selectedObjects.value.indexOf(removed_file), 1)
        triggerRef(this.selectedObjects)
        this.lastSelected = index
    }

    clearSelection(): void {
        this.selectedObjects.value.forEach((file) => {
            file.selected = false
        })
        this.selectedObjects.value = []
        triggerRef(this.selectedObjects)
    }

    selectAll(): void {
        this.allObjects.value.forEach((file) => {
            this.selectedObjects.value.push(file)
            file.selected = true
        })
        triggerRef(this.selectedObjects)
    }

    cardClickHandler(e: MouseEvent, index: number): void {
        // shift ctrl
        if (e.shiftKey && e.ctrlKey) {
            this.appendToSelectionBetween(this.lastSelected, index)
        }
        // shift
        else if (e.shiftKey) {
            this.setSelectionBetween(this.lastSelected, index)
        }
        // ctrl
        else if (e.ctrlKey) {
            if (this.allObjects.value[index].selected) this.removeFromSelection(index)
            else this.appendToSelection(index)
        }
        // normal
        else {
            this.setSelection(index)
        }
    }
}

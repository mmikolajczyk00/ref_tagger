<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface CanvasChoice {
    id: number
    title: string
    isOpen: boolean
}

const dialogRef = inject<any>('dialogRef')

const items = (dialogRef?.value?.data?.items ?? []) as CanvasChoice[]

const search = ref('')
const selectedIndex = ref(0)

const filtered = computed(() => {
    const q = search.value.trim().toLowerCase()
    if (!q) return items
    return items.filter((i) => i.title.toLowerCase().includes(q))
})

function focusSearch() {
    const input = document.querySelector<HTMLInputElement>('[data-canvas-search-input]')
    input?.focus()
}

function select(item: CanvasChoice) {
    dialogRef?.value?.close({ canvasId: item.id })
}

function onCancel() {
    dialogRef?.value?.close()
}

function cycle(delta: number) {
    if (filtered.value.length === 0) return
    selectedIndex.value =
        (selectedIndex.value + delta + filtered.value.length) % filtered.value.length
}

function isPrintableKey(e: KeyboardEvent) {
    return !e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1
}

function onGlobalKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
        e.preventDefault()
        cycle(1)
    } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        cycle(-1)
    } else if (e.key === 'Enter') {
        e.preventDefault()
        const item = filtered.value[selectedIndex.value]
        if (item) select(item)
    } else if (e.key === 'Escape') {
        onCancel()
    } else if (isPrintableKey(e)) {
        const input = document.querySelector<HTMLInputElement>('[data-canvas-search-input]')
        if (input && document.activeElement !== input) input.focus()
    }
}

watch(
    () => search.value,
    () => {
        selectedIndex.value = 0
    }
)

watch(selectedIndex, () => {
    nextTick(() => {
        document
            .querySelector<HTMLElement>('[data-selected-canvas]')
            ?.scrollIntoView({ block: 'nearest' })
    })
})

onMounted(() => {
    nextTick(focusSearch)
    window.addEventListener('keydown', onGlobalKeydown)
})

onBeforeUnmount(() => {
    window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<template>
    <Dialog
        :visible="true"
        modal
        header="Add to Canvas"
        :style="{ width: '24rem' }"
        :closable="false"
        :close-on-escape="false"
        @hide="onCancel"
    >
        <div class="flex flex-col gap-2">
            <InputText
                v-model="search"
                data-canvas-search-input
                autofocus
                placeholder="Search canvases"
                class="w-full"
            />
            <div class="max-h-72 overflow-y-auto">
                <div v-if="filtered.length === 0" class="text-surface-500 py-4 text-center text-sm">
                    No canvases found
                </div>
                <template v-for="(item, i) in filtered" :key="item.id">
                    <hr
                        v-if="i > 0 && !item.isOpen && filtered[i - 1].isOpen"
                        class="border-surface-200 dark:border-surface-700 my-1"
                    />
                    <button
                        type="button"
                        :data-selected-canvas="i === selectedIndex ? 'true' : undefined"
                        :class="[
                            'flex w-full items-center rounded px-2 py-1.5 text-left text-sm transition-colors',
                            i === selectedIndex
                                ? 'bg-surface-200 dark:bg-surface-700'
                                : 'hover:bg-surface-100 dark:hover:bg-surface-800'
                        ]"
                        @click="select(item)"
                        @mouseenter="selectedIndex = i"
                    >
                        <span :class="item.isOpen ? 'font-bold' : ''">{{ item.title }}</span>
                    </button>
                </template>
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" severity="secondary" size="small" @click="onCancel" />
        </template>
    </Dialog>
</template>

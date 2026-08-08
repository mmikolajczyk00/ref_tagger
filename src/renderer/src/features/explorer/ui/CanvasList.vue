<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useCanvasStore } from '../../canvas/ts/useCanvasStore'
import { validateCanvasName } from '../../canvas/ts/validateCanvasName'

const canvasStore = useCanvasStore()
const canvases = computed(() => Array.from(canvasStore.availableCanvases.values()))

const editingId = ref<number | null>(null)
const editName = ref('')
const invalid = ref(false)

function openCanvas(id: number) {
    canvasStore.fetchAndOpenCanvas(id)
}

function startEditing(id: number, currentName: string) {
    editingId.value = id
    editName.value = currentName
    invalid.value = false
    nextTick(() => {
        const input = document.querySelector<HTMLInputElement>('[data-canvas-edit-input]')
        input?.focus()
        input?.select()
    })
}

function onEditInput() {
    invalid.value = false
}

async function submitRename(id: number) {
    const existingNames = canvasStore.getExistingNames(id)
    const validation = validateCanvasName(editName.value, existingNames)
    if (!validation.valid) {
        invalid.value = true
        console.error('Canvas name validation failed:', validation.message)
        return
    }
    await canvasStore.renameCanvas(id, validation.name)
    editingId.value = null
}

function cancelEditing() {
    editingId.value = null
    invalid.value = false
}
</script>

<template>
    <div
        class="text-surface-400 dark:text-surface-500 flex size-full flex-row flex-wrap content-start items-start justify-start gap-1 overflow-clip overflow-y-auto focus-visible:outline-0"
    >
        <div
            v-for="c in canvases"
            :key="c.id"
            class="media-file border-surface-200 dark:border-surface-800 bg-surface-200 dark:bg-surface-800 hover:border-surface-400 dark:hover:border-surface-600 group relative flex aspect-square flex-col overflow-hidden border transition-colors"
            @dblclick.left.stop="openCanvas(c.id)"
        >
            <div class="flex flex-1 items-center justify-center">
                <span class="text-2xl">#</span>
            </div>

            <div
                class="bg-surface-0/50 dark:bg-surface-900/50 absolute bottom-0 flex w-full flex-col gap-0.5 p-2 text-xs backdrop-blur-sm"
            >
                <div class="flex-start flex items-center gap-0.5">
                    <input
                        v-if="editingId === c.id"
                        v-model="editName"
                        data-canvas-edit-input
                        :class="[
                            'bg-surface-0 dark:bg-surface-950 min-w-0 rounded px-1 py-px text-xs focus:outline-0',
                            invalid
                                ? 'text-red-500 placeholder-red-400'
                                : 'text-surface-700 dark:text-surface-300'
                        ]"
                        @click.left.stop
                        @input="onEditInput"
                        @keydown.enter.prevent.stop="submitRename(c.id)"
                        @keydown.esc.stop="cancelEditing"
                        @blur="cancelEditing"
                    />
                    <span
                        v-else
                        class="text-surface-700 dark:text-surface-300 truncate font-medium transition-colors"
                        @click.left.stop="startEditing(c.id, c.name)"
                    >
                        {{ c.name }}
                    </span>
                    <span
                        v-if="editingId !== c.id"
                        class="material-symbols-outlined hover:text-surface-700 dark:hover:text-surface-200 cursor-pointer text-xs opacity-0 transition-all group-hover:opacity-100"
                        @click.left.stop="startEditing(c.id, c.name)"
                        >edit</span
                    >
                </div>
                <span class="truncate text-[10px]"> #{{ c.id }} </span>
            </div>

            <span
                class="material-symbols-outlined text-surface-500 bg-surface-0/80 dark:bg-surface-900/80 absolute right-1 bottom-1 z-10 cursor-pointer rounded p-0.5 text-sm opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500 hover:text-white dark:hover:bg-red-600"
                @click.left.stop.prevent="
                    () => {
                        cancelEditing()
                        canvasStore.deleteCanvas(c.id)
                    }
                "
                >delete</span
            >
        </div>
    </div>
</template>

<style scoped>
.media-file {
    width: var(--thumb-size);
    height: var(--thumb-size);
    content-visibility: auto;
    contain-intrinsic-size: var(--thumb-size);
}
</style>

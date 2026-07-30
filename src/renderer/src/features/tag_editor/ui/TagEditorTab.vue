<script setup lang="ts">
import { ref, nextTick, onActivated } from 'vue'
import { useDialog } from 'primevue/usedialog'
import { useTagEditor } from '../ts/useTagEditor'
import NewTagDialog from './NewTagDialog.vue'
import ColorPickerDialog from './ColorPickerDialog.vue'
import { Tag } from '@shared/types/models'
import { normalizeTag } from '../../../core/utils/tagsUtils'

const {
    isLoading,
    searchQuery,
    filteredTags,
    first,
    rows,
    refetch,
    addTag,
    removeTag,
    updateTagName,
    updateTagColor
} = useTagEditor()

onActivated(() => {
    refetch()
})

const dialog = useDialog()

const editingId = ref<number | null>(null)
const draftName = ref('')

function startEdit(tag: Tag) {
    editingId.value = tag.id
    draftName.value = tag.name
    nextTick(() => {
        const input = document.querySelector<HTMLInputElement>('[data-edit-name]')
        input?.focus()
        input?.select()
    })
}

function onNameInput(e: Event) {
    draftName.value = normalizeTag((e.target as HTMLInputElement).value)
}

async function commitEdit() {
    if (editingId.value == null) return
    const id = editingId.value
    const name = draftName.value.trim()
    editingId.value = null
    if (!name) return
    await updateTagName(id, name)
}

function cancelEdit() {
    editingId.value = null
}

async function onNewTag() {
    const result = await new Promise<{ name: string; color: string } | undefined>((resolve) => {
        dialog.open(NewTagDialog, {
            onClose: (options) => resolve(options?.data)
        })
    })

    if (result) {
        await addTag(result.name, result.color)
    }
}

async function onDeleteTag(id: number) {
    await removeTag(id)
}

async function onEditColor(tag: Tag) {
    const result = await new Promise<string | undefined>((resolve) => {
        dialog.open(ColorPickerDialog, {
            data: { currentColor: tag.color },
            onClose: (options) => resolve(options?.data)
        })
    })
    if (result !== undefined) {
        await updateTagColor(tag.id, result)
    }
}
</script>

<template>
    <div class="flex h-full flex-col gap-4 p-6">
        <div class="flex items-center justify-between">
            <div>
                <h1 class="text-surface-950 dark:text-surface-0 text-xl font-bold">Tag Editor</h1>
                <p class="text-surface-400 text-sm">{{ filteredTags.length }} tags</p>
            </div>
            <Button
                icon="pi pi-plus"
                label="New Tag"
                size="small"
                severity="secondary"
                @click="onNewTag"
            />
        </div>

        <div class="flex items-center gap-3">
            <IconField>
                <InputIcon class="pi pi-search" />
                <InputText v-model="searchQuery" placeholder="Filter by name..." class="w-full" />
            </IconField>
            <Button
                v-if="searchQuery"
                icon="pi pi-times"
                label="Clear"
                size="small"
                severity="secondary"
                @click="searchQuery = ''"
            />
        </div>

        <div
            class="border-surface-200 dark:border-surface-800 bg-surface-0 dark:bg-surface-950 flex-1 overflow-hidden rounded-lg border"
        >
            <DataTable
                ref="dt"
                v-model:first="first"
                :value="filteredTags"
                :loading="isLoading"
                :paginator="true"
                :rows="rows"
                :rows-per-page-options="[10, 25, 50]"
                paginator-position="bottom"
                sort-mode="multiple"
                removable-sort
                striped-rows
                scrollable
                scroll-height="flex"
                size="small"
            >
                <Column
                    field="id"
                    header="ID"
                    :sortable="true"
                    header-class="w-20"
                    body-class="text-surface-400 font-mono text-sm text-center"
                />
                <Column field="name" header="Name" :sortable="true">
                    <template #body="{ data }">
                        <InputText
                            v-if="editingId === data.id"
                            data-edit-name
                            :model-value="draftName"
                            size="small"
                            class="w-full"
                            @input="onNameInput"
                            @keydown.enter="commitEdit"
                            @blur="cancelEdit"
                        />
                        <span
                            v-else
                            class="cursor-text truncate font-medium"
                            @click="startEdit(data)"
                        >
                            {{ data.name }}
                        </span>
                    </template>
                </Column>
                <Column
                    field="color"
                    header="Color"
                    :sortable="true"
                    header-class="w-24"
                    body-class="p-1!"
                >
                    <template #body="{ data }">
                        <button
                            class="block h-full min-h-7 w-full cursor-pointer rounded border-0 transition-[filter] duration-150 hover:brightness-110 hover:contrast-125"
                            :style="{ backgroundColor: data.color }"
                            title="Click to edit color"
                            @click="onEditColor(data)"
                        />
                    </template>
                </Column>
                <Column header-class="w-12">
                    <template #body="{ data }">
                        <div class="flex justify-end gap-0.5">
                            <button
                                class="hover:bg-danger-50 text-surface-400 hover:text-danger-500 rounded p-1.5 transition-colors dark:hover:bg-red-950"
                                title="Delete"
                                @click="onDeleteTag(data.id)"
                            >
                                <span class="material-symbols-outlined text-sm">delete</span>
                            </button>
                        </div>
                    </template>
                </Column>
                <template #empty>
                    <div class="flex flex-col items-center justify-center py-16">
                        <span
                            class="material-symbols-outlined text-surface-300 dark:text-surface-600 mb-3 block text-5xl"
                            >label_off</span
                        >
                        <p v-if="searchQuery" class="text-surface-400 text-sm">
                            No tags matching <strong>"{{ searchQuery }}"</strong>
                        </p>
                        <p v-else class="text-surface-400 text-sm">
                            No tags yet. Create one to get started.
                        </p>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>

<style scoped></style>

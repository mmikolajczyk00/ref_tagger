<script setup lang="ts">
import { ref, nextTick, onActivated } from 'vue'
import { useDialog } from 'primevue/usedialog'
import { useTagEditorTab } from '../ts/useTagEditorTab'
import NewTagDialog from './NewTagDialog.vue'
import ColorPickerDialog from './ColorPickerDialog.vue'
import { Tag } from '@shared/types/models'
import { normalizeTag } from '../../../core/utils/tagsUtils'
import { withAlpha } from '../../../core/utils/colorUtils'
import EditorTagInput from '../../tag_input/ui/EditorTagInput.vue'

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
    updateTagColor,
    expandedTags,
    childrenIdsByTag,
    parentIdsByTag,
    childInputBuffers,
    parentInputBuffers,
    getChildren,
    getParents,
    childCount,
    parentCount,
    addChildByName,
    addParentByName,
    removeChild,
    removeParent
} = useTagEditorTab()

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

async function handleRemoveChild(parentId: number, childId: number) {
    await removeChild(parentId, childId)
}

async function handleRemoveParent(childId: number, parentId: number) {
    await removeParent(childId, parentId)
}

async function flushChildInput(parentId: number) {
    const buf = childInputBuffers.value[parentId] ?? []
    if (!buf.length) return
    childInputBuffers.value[parentId] = []
    await addChildByName(parentId, buf)
}

async function flushParentInput(childId: number) {
    const buf = parentInputBuffers.value[childId] ?? []
    if (!buf.length) return
    parentInputBuffers.value[childId] = []
    await addParentByName(childId, buf)
}

function sortByCount(
    e: { data: Tag[]; field: string; order: 1 | -1 },
    countFn: (id: number) => number
) {
    e.data.sort((a, b) => (countFn(a.id) - countFn(b.id)) * e.order)
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
                v-model:expanded-rows="expandedTags"
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
                    header="Parents"
                    header-class="w-20"
                    body-class="text-center"
                    :sortable="true"
                    :sort-function="(e: any) => sortByCount(e, parentCount)"
                >
                    <template #body="{ data }">
                        <span
                            class="text-surface-500 font-mono text-sm"
                            :title="`${parentCount(data.id)} parent(s)`"
                        >
                            {{ parentCount(data.id) }}
                        </span>
                    </template>
                </Column>
                <Column
                    header="Children"
                    header-class="w-20"
                    body-class="text-center"
                    :sortable="true"
                    :sort-function="(e: any) => sortByCount(e, childCount)"
                >
                    <template #body="{ data }">
                        <span
                            class="text-surface-500 font-mono text-sm"
                            :title="`${childCount(data.id)} child(ren)`"
                        >
                            {{ childCount(data.id) }}
                        </span>
                    </template>
                </Column>
                <Column expander style="width: 5rem"></Column>
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
                <template #expansion="slotProps">
                    <div class="flex flex-row p-4">
                        <div class="flex flex-1 flex-col">
                            <h4
                                class="text-surface-500 mb-2 text-xs font-semibold tracking-wide uppercase"
                            >
                                Parents
                            </h4>
                            <div
                                v-if="getParents(slotProps.data.id).length"
                                class="mb-2 flex flex-wrap gap-2"
                            >
                                <Chip
                                    v-for="p in getParents(slotProps.data.id)"
                                    :key="p.id"
                                    :label="p.name"
                                    removable
                                    class="border border-dashed"
                                    :style="{
                                        color: p.color,
                                        backgroundColor: withAlpha(p.color, 0.2),
                                        borderColor: p.color
                                    }"
                                    :pt="{ removeIcon: { color: p.color } }"
                                    @remove="handleRemoveParent(slotProps.data.id, p.id)"
                                />
                            </div>
                            <p v-else class="text-surface-400 mb-2 text-sm italic">
                                No parents yet
                            </p>
                            <EditorTagInput
                                class="mt-auto"
                                :model-value="parentInputBuffers[slotProps.data.id] ??= []"
                                :existing-tag-ids="[
                                    slotProps.data.id,
                                    ...(parentIdsByTag[slotProps.data.id] ?? [])
                                ]"
                                @update:model-value="
                                    (v: string[]) => (parentInputBuffers[slotProps.data.id] = v)
                                "
                                @submit="flushParentInput(slotProps.data.id)"
                            />
                        </div>
                        <Divider layout="vertical"></Divider>
                        <div class="flex flex-1 flex-col">
                            <h4
                                class="text-surface-500 mb-2 text-xs font-semibold tracking-wide uppercase"
                            >
                                Children
                            </h4>
                            <div
                                v-if="getChildren(slotProps.data.id).length"
                                class="mb-2 flex flex-wrap gap-2"
                            >
                                <Chip
                                    v-for="c in getChildren(slotProps.data.id)"
                                    :key="c.id"
                                    :label="c.name"
                                    removable
                                    class="border border-dashed"
                                    :style="{
                                        color: c.color,
                                        backgroundColor: withAlpha(c.color, 0.2),
                                        borderColor: c.color
                                    }"
                                    :pt="{ removeIcon: { color: c.color } }"
                                    @remove="handleRemoveChild(slotProps.data.id, c.id)"
                                />
                            </div>
                            <p v-else class="text-surface-400 mb-2 text-sm italic">
                                No children yet
                            </p>
                            <EditorTagInput
                                class="mt-auto"
                                :model-value="childInputBuffers[slotProps.data.id] ??= []"
                                :existing-tag-ids="[
                                    slotProps.data.id,
                                    ...(childrenIdsByTag[slotProps.data.id] ?? [])
                                ]"
                                @update:model-value="
                                    (v: string[]) => (childInputBuffers[slotProps.data.id] = v)
                                "
                                @submit="flushChildInput(slotProps.data.id)"
                            />
                        </div>
                    </div>
                </template>
            </DataTable>
        </div>
    </div>
</template>

<style scoped></style>

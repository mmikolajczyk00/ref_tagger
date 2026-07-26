<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Tag {
    id: number
    name: string
    color: string
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100
    l /= 100
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
        const k = (n + h / 30) % 12
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
        return Math.round(255 * color)
            .toString(16)
            .padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
}

function generateMockTags(): Tag[] {
    const names = [
        'Nature',
        'Urban',
        'Portrait',
        'Landscape',
        'Abstract',
        'Minimalist',
        'Vintage',
        'Modern',
        'Grunge',
        'Retro',
        'Cyberpunk',
        'Pastel',
        'Neon',
        'Mono',
        'Duotone',
        'Warm',
        'Cool',
        'Neutral',
        'Bright',
        'Muted',
        'Dark',
        'Light',
        'Contrast',
        'Soft',
        'Sharp',
        'Dreamy',
        'Gritty',
        'Clean',
        'Dirty',
        'Elegant',
        'Raw',
        'Polished',
        'Bold',
        'Subtle',
        'Vibrant',
        'Desaturated',
        'High Key',
        'Low Key',
        'Film',
        'Digital',
        'Analog',
        'Texture',
        'Pattern',
        'Silhouette',
        'Symmetry',
        'Asymmetry',
        'Depth',
        'Flat',
        'Layered',
        'Minimal',
        'Maximal',
        'Organic',
        'Geometric',
        'Fluid',
        'Structured',
        'Chaos',
        'Order'
    ]
    return names.map((name, i) => {
        const hue = (i * 137.508) % 360
        const saturation = 55 + ((i * 17) % 25)
        const lightness = 40 + ((i * 13) % 25)
        return { id: i + 1, name, color: hslToHex(hue, saturation, lightness) }
    })
}

const tags = ref<Tag[]>(generateMockTags())
const searchQuery = ref('')
const first = ref(0)
const rows = ref(10)
const dt = ref()

const filteredTags = computed(() => {
    const q = searchQuery.value.toLowerCase().trim()
    if (!q) return tags.value
    return tags.value.filter((t) => t.name.toLowerCase().includes(q))
})

watch(searchQuery, () => {
    first.value = 0
})
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
                @click="console.log('Add tag – placeholder')"
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
                        <span class="truncate font-medium">{{ data.name }}</span>
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
                            class="block h-full w-full min-h-[28px] rounded border-0 cursor-pointer transition-[filter] duration-150 hover:brightness-110 hover:contrast-125"
                            :style="{ backgroundColor: data.color }"
                            title="Click to edit color"
                        />
                    </template>
                </Column>
                <Column header-class="w-24">
                    <template #body>
                        <div class="flex justify-end gap-0.5">
                            <button
                                class="hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-surface-700 dark:hover:text-surface-200 rounded p-1.5 transition-colors"
                                title="Edit"
                            >
                                <span class="material-symbols-outlined text-sm">edit</span>
                            </button>
                            <button
                                class="hover:bg-danger-50 text-surface-400 hover:text-danger-500 rounded p-1.5 transition-colors dark:hover:bg-red-950"
                                title="Delete"
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

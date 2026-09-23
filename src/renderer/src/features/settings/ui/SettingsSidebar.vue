<script setup lang="ts">
import { computed, ref } from 'vue'

export interface SettingsField {
    id: string
    icon: string
    title: string
}

const props = defineProps<{
    fields: SettingsField[]
    activeId: string
}>()

defineEmits<{ select: [id: string] }>()

const search = ref('')

const filteredFields = computed(() => {
    const q = search.value.trim().toLowerCase()
    if (!q) return props.fields
    return props.fields.filter(
        (f) => f.title.toLowerCase().includes(q) || f.icon.toLowerCase().includes(q)
    )
})
</script>

<template>
    <div
        class="bg-surface-100 dark:bg-surface-900 border-surface-200 dark:border-surface-700 flex w-60 shrink-0 flex-col border-r"
    >
        <div class="p-3">
            <InputText v-model="search" placeholder="Search settings" class="w-full" />
        </div>
        <div class="min-h-0 flex-1 overflow-y-auto p-2">
            <button
                v-for="field in filteredFields"
                :key="field.id"
                class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors"
                :class="
                    field.id === activeId
                        ? 'bg-primary/15 text-primary'
                        : 'text-surface-600 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-800'
                "
                @click="$emit('select', field.id)"
            >
                <span class="material-symbols-outlined text-lg">{{ field.icon }}</span>
                <span>{{ field.title }}</span>
            </button>
        </div>
    </div>
</template>

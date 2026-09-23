<script setup lang="ts">
import { useSettingsStore } from '../../../core/stores/useSettingsStore'
import SettingsSidebar, { type SettingsField } from './SettingsSidebar.vue'
import AppearanceField from './fields/AppearanceField.vue'
import DatabaseField from './fields/DatabaseField.vue'
import BackgroundProcessesField from './fields/BackgroundProcessesField.vue'

const settings = useSettingsStore()

defineEmits<{ close: [] }>()

const fields: SettingsField[] = [
    { id: 'palette', icon: 'palette', title: 'Appearance' },
    { id: 'database', icon: 'database', title: 'Database' },
    { id: 'tasks', icon: 'manufacturing', title: 'Background Processes' }
]
</script>

<template>
    <div class="bg-surface-0 dark:bg-surface-950 fixed inset-0 z-50 flex">
        <SettingsSidebar
            :fields="fields"
            :active-id="settings.activeSettingsField"
            @select="settings.activeSettingsField = $event"
        />

        <div class="relative min-w-0 flex-1">
            <button
                class="text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-800 absolute top-3 right-3 rounded p-1.5 transition-colors"
                @click="$emit('close')"
            >
                <span class="material-symbols-outlined">close</span>
            </button>

            <div class="h-full overflow-y-auto">
                <AppearanceField v-if="settings.activeSettingsField === 'palette'" />
                <DatabaseField v-else-if="settings.activeSettingsField === 'database'" />
                <BackgroundProcessesField v-else-if="settings.activeSettingsField === 'tasks'" />
            </div>
        </div>
    </div>
</template>

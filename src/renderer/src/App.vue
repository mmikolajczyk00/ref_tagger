<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { updatePrimaryPalette } from '@primeuix/themes'
import { useTagStore } from './core/stores/useTagStore'
import { useSettingsStore } from './core/stores/useSettingsStore'
import { primaryPalettes } from './core/theme/presets'
import TabBar from './features/tab_system/ui/TabBar.vue'
import Tabwindow from './features/tab_system/ui/Tabwindow.vue'
import DynamicDialog from 'primevue/dynamicdialog'

const tagStore = useTagStore()
const settings = useSettingsStore()

watch(
    () => settings.themeId,
    (id) => {
        updatePrimaryPalette(primaryPalettes[id])
    },
    { immediate: true }
)

onMounted(() => {
    tagStore.fetchTags()
    settings.initTheme()
})
</script>

<template>
    <div
        class="bg-surface-0 text-surface-950 dark:bg-surface-950 dark:text-surface-0 m-0 box-border flex h-screen w-screen flex-col overflow-hidden p-0 select-none"
    >
        <TabBar></TabBar>
        <Tabwindow></Tabwindow>
        <DynamicDialog />
    </div>
</template>

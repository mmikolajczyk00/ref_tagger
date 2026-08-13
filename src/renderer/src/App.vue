<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { updatePrimaryPalette } from '@primeuix/themes'
import { useTagStore } from './core/stores/useTagStore'
import { useTagsProcessingStore } from './core/stores/useTagsProcessingStore'
import { useSettingsStore } from './core/stores/useSettingsStore'
import { primaryPalettes } from './core/theme/presets'
import TabBar from './features/tab_system/ui/TabBar.vue'
import Tabwindow from './features/tab_system/ui/Tabwindow.vue'
import DynamicDialog from 'primevue/dynamicdialog'

const tagStore = useTagStore()
const tpStore = useTagsProcessingStore()
const settings = useSettingsStore()

function applyPrimaryPalette(palette: Record<string, string>) {
    const root = document.documentElement
    for (const [shade, color] of Object.entries(palette)) {
        root.style.setProperty(`--p-primary-${shade}`, color)
    }
    root.style.setProperty('--p-primary-color', `light-dark(${palette[500]}, ${palette[400]})`)
    root.style.setProperty(
        '--p-primary-hover-color',
        `light-dark(${palette[600]}, ${palette[300]})`
    )
    root.style.setProperty(
        '--p-primary-active-color',
        `light-dark(${palette[700]}, ${palette[200]})`
    )
    root.style.setProperty(
        '--p-primary-contrast-color',
        'light-dark(#ffffff, var(--p-surface-900))'
    )
}

watch(
    () => settings.themeId,
    (id) => {
        const palette = primaryPalettes[id]
        updatePrimaryPalette(palette)
        applyPrimaryPalette(palette)
    },
    { immediate: true }
)

onMounted(() => {
    tagStore.fetchTags()
    tpStore.fetchAll()
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

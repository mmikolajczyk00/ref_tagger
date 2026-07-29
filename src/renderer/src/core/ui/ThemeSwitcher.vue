<template>
    <button
        ref="opener"
        class="text-surface-500 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-800 hover:text-surface-950 dark:hover:text-surface-0 rounded p-1.5 transition-colors"
        :title="themeLabel"
        @click="togglePopover"
    >
        <span class="material-symbols-outlined text-lg">{{ icon }}</span>
    </button>
    <Popover
        ref="popover"
        class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 rounded-lg border p-3 shadow-lg"
    >
        <div class="flex min-w-48 flex-col gap-3">
            <div>
                <p class="text-surface-500 mb-2 text-xs font-medium tracking-wide uppercase">
                    Theme
                </p>
                <div class="grid grid-cols-4 gap-2">
                    <button
                        v-for="theme in themeOptions"
                        :key="theme.id"
                        :title="theme.label"
                        class="h-8 w-8 rounded-full border-2 transition-all"
                        :class="[
                            settings.themeId === theme.id
                                ? 'border-surface-950 dark:border-surface-0 scale-110'
                                : 'border-transparent hover:scale-105'
                        ]"
                        :style="{ backgroundColor: theme.color }"
                        @click="settings.setThemeId(theme.id)"
                    ></button>
                </div>
            </div>
            <Divider class="bg-surface-200 dark:bg-surface-700 my-0" />
            <div>
                <p class="text-surface-500 mb-2 text-xs font-medium tracking-wide uppercase">
                    Mode
                </p>
                <div class="grid grid-cols-3 gap-1">
                    <button
                        v-for="mode in modeOptions"
                        :key="mode.id"
                        class="flex flex-col items-center gap-1 rounded-md px-2 py-1.5 text-xs transition-colors"
                        :class="[
                            settings.themeMode === mode.id
                                ? 'bg-primary/15 text-primary'
                                : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-950 dark:hover:text-surface-0'
                        ]"
                        @click="settings.setThemeMode(mode.id)"
                    >
                        <span class="material-symbols-outlined text-base">{{ mode.icon }}</span>
                        {{ mode.label }}
                    </button>
                </div>
            </div>
        </div>
    </Popover>
</template>

<script setup lang="ts">
import { computed, useTemplateRef } from 'vue'
import { useSettingsStore } from '../stores/useSettingsStore'
import type { ThemeId, ThemeMode } from '../theme/presets'

const settings = useSettingsStore()

const popover = useTemplateRef('popover')
const opener = useTemplateRef('opener')

function togglePopover(e: Event) {
    popover.value?.toggle(e)
}

const icon = computed(() => {
    switch (settings.themeMode) {
        case 'light':
            return 'light_mode'
        case 'dark':
            return 'dark_mode'
        default:
            return 'brightness_auto'
    }
})

const themeLabel = computed(() => {
    switch (settings.themeMode) {
        case 'light':
            return 'Toggle dark mode'
        case 'dark':
            return 'Toggle light mode'
        default:
            return 'Follow system theme'
    }
})

const themeOptions: { id: ThemeId; label: string; color: string }[] = [
    { id: 'aura-teal', label: 'Teal', color: '#14b8a6' },
    { id: 'aura-indigo', label: 'Indigo', color: '#6366f1' },
    { id: 'aura-rose', label: 'Rose', color: '#f43f5e' },
    { id: 'aura-amber', label: 'Amber', color: '#f59e0b' }
]

const modeOptions: { id: ThemeMode; label: string; icon: string }[] = [
    { id: 'dark', label: 'Dark', icon: 'dark_mode' },
    { id: 'light', label: 'Light', icon: 'light_mode' },
    { id: 'system', label: 'System', icon: 'brightness_auto' }
]
</script>

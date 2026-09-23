<script setup lang="ts">
import { useSettingsStore } from '@renderer/core/stores/useSettingsStore'
import type { ThemeId, ThemeMode } from '@renderer/core/theme/presets'

const settings = useSettingsStore()

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

<template>
    <div class="flex flex-col gap-6 p-6">
        <div>
            <p class="text-surface-500 mb-2 text-xs font-medium tracking-wide uppercase">Theme</p>
            <div class="grid w-fit grid-cols-4 gap-2">
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
            <p class="text-surface-500 mb-2 text-xs font-medium tracking-wide uppercase">Mode</p>
            <div class="grid w-fit grid-cols-3 gap-1">
                <button
                    v-for="mode in modeOptions"
                    :key="mode.id"
                    class="flex flex-col items-center gap-1 rounded-md px-4 py-1.5 text-xs transition-colors"
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
</template>

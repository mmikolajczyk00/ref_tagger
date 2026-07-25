import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ThemeId, ThemeMode } from '../theme/presets'
import { resolveSystemTheme } from '../theme/presets'

const SETTINGS_KEY = 'ref-sheeter-settings'

interface Settings {
    themeMode: ThemeMode
    themeId: ThemeId
}

const DEFAULT_SETTINGS: Settings = {
    themeMode: 'dark',
    themeId: 'aura-teal'
}

function loadSettings(): Settings {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (raw) {
            const parsed = JSON.parse(raw)
            return {
                themeMode: parsed.themeMode ?? DEFAULT_SETTINGS.themeMode,
                themeId: parsed.themeId ?? DEFAULT_SETTINGS.themeId
            }
        }
    } catch {
        /* ignore */
    }
    return { ...DEFAULT_SETTINGS }
}

function persistSettings(settings: Settings) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

export const useSettingsStore = defineStore('settings', () => {
    const saved = loadSettings()

    const themeMode = ref<ThemeMode>(saved.themeMode)
    const themeId = ref<ThemeId>(saved.themeId)

    watch([themeMode, themeId], ([mode, id]) => {
        persistSettings({ themeMode: mode, themeId: id })
    })

    watch(themeMode, (val) => {
        applyThemeClass(val)
    })

    function setThemeMode(mode: ThemeMode) {
        themeMode.value = mode
    }

    function setThemeId(id: ThemeId) {
        themeId.value = id
    }

    function toggleDark() {
        themeMode.value = themeMode.value === 'dark' ? 'light' : 'dark'
    }

    function applyThemeClass(mode: ThemeMode) {
        const root = document.documentElement
        const isDark = mode === 'dark' || (mode === 'system' && resolveSystemTheme() === 'dark')
        root.classList.toggle('app-dark', isDark)
    }

    function initTheme() {
        applyThemeClass(themeMode.value)

        if (themeMode.value === 'system') {
            const mq = window.matchMedia('(prefers-color-scheme: dark)')
            mq.addEventListener('change', () => {
                if (themeMode.value === 'system') {
                    applyThemeClass('system')
                }
            })
        }
    }

    return { themeMode, themeId, setThemeMode, setThemeId, toggleDark, initTheme }
})

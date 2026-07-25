import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

const zincLight = {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b'
}

export const RefSheeterPreset = definePreset(Aura, {
    semantic: {
        primary: {
            50: '#f0fdfa',
            100: '#ccfbf1',
            200: '#99f6e4',
            300: '#5eead4',
            400: '#2dd4bf',
            500: '#14b8a6',
            600: '#0d9488',
            700: '#0f766e',
            800: '#115e59',
            900: '#134e4a',
            950: '#042f2e'
        },
        colorScheme: {
            light: {
                surface: zincLight,
                'surface-ground': '{surface.100}',
                'surface-section': '{surface.0}',
                'surface-card': '{surface.0}',
                'surface-overlay': '{surface.0}',
                'surface-border': '{surface.200}',
                'surface-hover': '{surface.100}',
                'surface-muted': '{surface.300}',
                'surface-emphasis': '{surface.400}',
                formField: {
                    background: '{surface.0}',
                    border: '{surface.400}',
                    color: '{surface.700}'
                }
            }
        }
    }
})

export type ThemeId = 'aura-teal' | 'aura-indigo' | 'aura-rose' | 'aura-amber'

export const themes: Record<ThemeId, ReturnType<typeof definePreset>> = {
    'aura-teal': RefSheeterPreset,
    'aura-indigo': definePreset(Aura, {
        semantic: {
            primary: {
                50: '#eef2ff',
                100: '#e0e7ff',
                200: '#c7d2fe',
                300: '#a5b4fc',
                400: '#818cf8',
                500: '#6366f1',
                600: '#4f46e5',
                700: '#4338ca',
                800: '#3730a3',
                900: '#312e81',
                950: '#1e1b4b'
            },
            colorScheme: {
                light: {
                    surface: zincLight,
                    'surface-ground': '{surface.100}',
                    'surface-section': '{surface.0}',
                    'surface-card': '{surface.0}',
                    'surface-overlay': '{surface.0}',
                    'surface-border': '{surface.200}',
                    'surface-hover': '{surface.100}',
                    'surface-muted': '{surface.300}',
                    'surface-emphasis': '{surface.400}',
                    formField: {
                        background: '{surface.0}',
                        border: '{surface.400}',
                        color: '{surface.700}'
                    }
                }
            }
        }
    }),
    'aura-rose': definePreset(Aura, {
        semantic: {
            primary: {
                50: '#fff1f2',
                100: '#ffe4e6',
                200: '#fecdd3',
                300: '#fda4af',
                400: '#fb7185',
                500: '#f43f5e',
                600: '#e11d48',
                700: '#be123c',
                800: '#9f1239',
                900: '#881337',
                950: '#4c0519'
            },
            colorScheme: {
                light: {
                    surface: zincLight,
                    'surface-ground': '{surface.100}',
                    'surface-section': '{surface.0}',
                    'surface-card': '{surface.0}',
                    'surface-overlay': '{surface.0}',
                    'surface-border': '{surface.200}',
                    'surface-hover': '{surface.100}',
                    'surface-muted': '{surface.300}',
                    'surface-emphasis': '{surface.400}',
                    formField: {
                        background: '{surface.0}',
                        border: '{surface.400}',
                        color: '{surface.700}'
                    }
                }
            }
        }
    }),
    'aura-amber': definePreset(Aura, {
        semantic: {
            primary: {
                50: '#fffbeb',
                100: '#fef3c7',
                200: '#fde68a',
                300: '#fcd34d',
                400: '#fbbf24',
                500: '#f59e0b',
                600: '#d97706',
                700: '#b45309',
                800: '#92400e',
                900: '#78350f',
                950: '#451a03'
            },
            colorScheme: {
                light: {
                    surface: zincLight,
                    'surface-ground': '{surface.100}',
                    'surface-section': '{surface.0}',
                    'surface-card': '{surface.0}',
                    'surface-overlay': '{surface.0}',
                    'surface-border': '{surface.200}',
                    'surface-hover': '{surface.100}',
                    'surface-muted': '{surface.300}',
                    'surface-emphasis': '{surface.400}',
                    formField: {
                        background: '{surface.0}',
                        border: '{surface.400}',
                        color: '{surface.700}'
                    }
                }
            }
        }
    })
}

export type ThemeMode = 'light' | 'dark' | 'system'

export const primaryPalettes: Record<ThemeId, Record<string, string>> = {
    'aura-teal': {
        50: '#f0fdfa',
        100: '#ccfbf1',
        200: '#99f6e4',
        300: '#5eead4',
        400: '#2dd4bf',
        500: '#14b8a6',
        600: '#0d9488',
        700: '#0f766e',
        800: '#115e59',
        900: '#134e4a',
        950: '#042f2e'
    },
    'aura-indigo': {
        50: '#eef2ff',
        100: '#e0e7ff',
        200: '#c7d2fe',
        300: '#a5b4fc',
        400: '#818cf8',
        500: '#6366f1',
        600: '#4f46e5',
        700: '#4338ca',
        800: '#3730a3',
        900: '#312e81',
        950: '#1e1b4b'
    },
    'aura-rose': {
        50: '#fff1f2',
        100: '#ffe4e6',
        200: '#fecdd3',
        300: '#fda4af',
        400: '#fb7185',
        500: '#f43f5e',
        600: '#e11d48',
        700: '#be123c',
        800: '#9f1239',
        900: '#881337',
        950: '#4c0519'
    },
    'aura-amber': {
        50: '#fffbeb',
        100: '#fef3c7',
        200: '#fde68a',
        300: '#fcd34d',
        400: '#fbbf24',
        500: '#f59e0b',
        600: '#d97706',
        700: '#b45309',
        800: '#92400e',
        900: '#78350f',
        950: '#451a03'
    }
}

export function resolveSystemTheme(): 'light' | 'dark' {
    if (typeof window === 'undefined') return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

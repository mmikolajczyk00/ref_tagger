import type { PrimeVuePTOptions } from 'primevue/config'

export const primeVuePassThrough: PrimeVuePTOptions = {
    inputtext: {
        root: {
            class: [
                'bg-surface-100 dark:bg-surface-800',
                'border-surface-200 dark:border-surface-700',
                'text-surface-950 dark:text-surface-0',
                'placeholder:text-surface-400 dark:placeholder:text-surface-500'
            ]
        }
    },
    iconfield: {
        root: {
            class: 'flex-1'
        }
    },
    inputicon: {
        root: {
            class: 'text-surface-400 dark:text-surface-500'
        }
    },
    datatable: {
        headerRow: {
            class: 'bg-surface-50 dark:bg-surface-800'
        },
        bodyRow: {
            class: 'hover:bg-primary-50/40 dark:hover:bg-primary-950/40 transition-colors'
        }
    },
    column: {
        headerCell: {
            class: 'text-surface-600 dark:text-surface-400 text-xs uppercase tracking-wider font-medium'
        }
    },
    paginator: {
        root: {
            class: 'bg-surface-50 dark:bg-surface-800 border-t border-surface-200 dark:border-surface-800'
        }
    }
}

import type { PrimeVuePTOptions } from 'primevue/config'

export const primeVuePassThrough: PrimeVuePTOptions = {
    iconfield: {
        root: {
            class: 'flex-1'
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
    },
    badge: {
        root: ({ props }) => ({
            class: props.severity === 'danger' ? '!bg-danger-700 !text-surface-0' : undefined
        })
    }
}

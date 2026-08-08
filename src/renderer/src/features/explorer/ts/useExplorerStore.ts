import { computed, reactive, watch } from 'vue'
import { defineStore } from 'pinia'
import { useTabStore } from '@renderer/core/stores/useTabStore'
import { AppTabType } from '@renderer/features/tab_system/Tabs'
import { createExplorer, Explorer } from './createExplorer'

export const useExplorerStore = defineStore('explorer', () => {
    const tabStore = useTabStore()
    const instances = reactive(new Map<number, Explorer>())

    function getOrCreate(tabId: number): Explorer {
        let inst = instances.get(tabId)
        if (!inst) {
            inst = createExplorer()
            instances.set(tabId, inst)
        }
        return inst
    }

    function dispose(tabId: number) {
        instances.delete(tabId)
    }

    const openExplorerTabIds = computed(
        () =>
            new Set(
                tabStore.openTabs.filter((t) => t.type === AppTabType.Explorer).map((t) => t.id)
            )
    )

    watch(openExplorerTabIds, (current) => {
        for (const tabId of instances.keys()) {
            if (!current.has(tabId)) instances.delete(tabId)
        }
    })

    const getActiveExplorer = computed<Explorer | null>(() => {
        const tab = tabStore.currentActiveTab
        if (tab.type !== AppTabType.Explorer) return null
        return getOrCreate(tab.id)
    })

    return { getActiveExplorer, getOrCreate, dispose }
})

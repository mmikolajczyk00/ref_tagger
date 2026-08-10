import { defineStore } from 'pinia'

import { computed, ref } from 'vue'
import {
    AppTab,
    AppTabType,
    ExplorerTabPayload,
    TagEditorTab
} from '@renderer/features/tab_system/Tabs'
import { UndoRedoManager } from '../command_system/UndoRedoManager'

interface CanvasTabPayload {
    canvasId: number
}

interface UploadTabPayload {}
interface TagEditorPayload {}

const TAB_LIMIT = 50

export const useTabStore = defineStore('tabStore', () => {
    const idCounter = ref(0)
    const openTabs = ref<AppTab[]>([])
    const tabHistory = ref<AppTab[]>([])
    const activeTabIndex = ref(0)

    const currentActiveTab = computed(() => {
        return openTabs.value[activeTabIndex.value]
    })

    function setActiveTab(index: number) {
        if (activeTabIndex.value == index) return

        activeTabIndex.value = index
    }

    function openTab(type: AppTabType.Canvas, title?: string, data?: CanvasTabPayload): number
    function openTab(type: AppTabType.Explorer, title?: string, data?: ExplorerTabPayload): number
    function openTab(type: AppTabType.Upload, title?: string, data?: UploadTabPayload): number
    function openTab(type: AppTabType.TagEditor, title?: string, data?: TagEditorPayload): number
    function openTab(type: AppTabType.Empty, title?: string): number

    function openTab(type: AppTabType, title?: string, data?: any): number {
        if (openTabs.value.length >= TAB_LIMIT) {
            console.error('tab limit reached')
            return -1
        }

        const tabId = newId()
        const tab: AppTab = {
            id: tabId,
            title: title ?? 'untitled',
            type: type as any,
            data: data ?? (type === AppTabType.Explorer ? { explorerTabId: tabId } : undefined),
            undoRedoMng: new UndoRedoManager()
        }

        openTabs.value.push(tab)
        return openTabs.value.length - 1
    }

    function closeTab(index: number) {
        const tab = openTabs.value[index]

        tabHistory.value.push(tab)
        openTabs.value.splice(index, 1)

        activeTabIndex.value = Math.min(activeTabIndex.value, openTabs.value.length - 1)
    }
    function closeActiveTab() {
        closeTab(activeTabIndex.value)
    }
    function reopenTab() {
        const tab = tabHistory.value.pop()

        if (!tab) return

        tab.id = newId()
        openTabs.value.push(tab)
    }

    function setTabTitle(index: number, title: string) {
        const tab = openTabs.value[index]
        if (tab) tab.title = title
    }

    function closeTabWhere(predicate: (tab: AppTab) => boolean) {
        const idx = openTabs.value.findIndex(predicate)
        if (idx !== -1) closeTab(idx)
    }

    function newId(): number {
        return ++idCounter.value
    }

    return {
        openTabs,
        tabHistory,
        activeTabIndex,
        currentActiveTab,
        setActiveTab,
        openTab,
        closeTab,
        open,
        closeActiveTab,
        reopenTab,
        setTabTitle,
        closeTabWhere
    }
})

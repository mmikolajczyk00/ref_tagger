import { defineStore } from 'pinia'

import { computed, ref } from 'vue'
import { useCanvasStore } from '../../features/canvas/ts/useCanvasStore'
import { dialogService } from '../dialogService'
import { AppTab, AppTabType, ExplorerTabPayload } from '@renderer/features/tab_system/Tabs'
import { UndoRedoManager } from '../command_system/UndoRedoManager'
import UnsavedCanvasCloseDialog from '@renderer/features/canvas/ui/UnsavedCanvasCloseDialog.vue'

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

    async function closeTab(index: number): Promise<boolean> {
        const tab = openTabs.value[index]
        if (!tab) return false

        if (tab.type === AppTabType.Canvas) {
            const canvasStore = useCanvasStore()
            const scene = canvasStore.getCanvas(tab.data.canvasId)
            if (scene && scene.unsavedChanges) {
                const action = await new Promise<'save' | 'discard' | 'cancel' | undefined>(
                    (resolve) => {
                        dialogService.open(UnsavedCanvasCloseDialog, {
                            data: { canvasName: scene.name },
                            onClose: (options) =>
                                resolve(options?.data?.action as 'save' | 'discard' | 'cancel')
                        })
                    }
                )

                if (action === 'cancel' || action === undefined) return false

                if (action === 'save') {
                    const ok = await canvasStore.saveCanvasWithPrompt(tab.data.canvasId)
                    if (!ok) return false
                }

                // saveCanvasWithPrompt may have re-keyed the scene under a new id
                // (unpersisted canvas saved as new) and mutated tab.data.canvasId, so
                // evict by the current canvasId, not the pre-save one.
                canvasStore.closeCanvas(tab.data.canvasId)
            }
        }

        tabHistory.value.push(tab)
        openTabs.value.splice(index, 1)

        activeTabIndex.value = Math.min(activeTabIndex.value, openTabs.value.length - 1)
        return true
    }
    async function closeActiveTab(): Promise<boolean> {
        return closeTab(activeTabIndex.value)
    }
    async function reopenTab(): Promise<void> {
        const tab = tabHistory.value.pop()

        if (!tab) return

        if (tab.type === AppTabType.Canvas) {
            const canvasStore = useCanvasStore()
            const scene = await canvasStore.fetchAndOpenCanvas(tab.data.canvasId)
            if (!scene) {
                console.error(
                    'Reopen failed: canvas not found or failed to load',
                    tab.data.canvasId
                )
            }
            return
        }

        tab.id = newId()
        openTabs.value.push(tab)
    }

    function setTabTitle(index: number, title: string) {
        const tab = openTabs.value[index]
        if (tab) tab.title = title
    }

    async function closeTabWhere(predicate: (tab: AppTab) => boolean): Promise<void> {
        const idx = openTabs.value.findIndex(predicate)
        if (idx !== -1) await closeTab(idx)
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

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useTabStore } from '../../../core/stores/useTabStore'
import { dialogService } from '../../../core/dialogService'
import { toastService } from '../../../core/toastService'
import { AppTabType } from '@renderer/features/tab_system/Tabs'
import CanvasScene from './scene/CanvasScene'
import SaveCanvasDialog from '../ui/SaveCanvasDialog.vue'
import { Canvas } from '@shared/types/models'
import { validateCanvasName } from './validateCanvasName'

export const useCanvasStore = defineStore('canvasStore', () => {
    const openCanvases = ref(new Map<number, CanvasScene>())
    const availableCanvases = ref(new Map<number, Canvas>())
    const pendingSaveRequests = ref(new Map<number, { forceAs: boolean }>())

    const getCanvas = computed(() => (id: number) => openCanvases.value.get(id))
    const getActiveCanvas = computed(() => {
        const tabStore = useTabStore()
        const activeTab = tabStore.currentActiveTab
        if (activeTab.type != AppTabType.Canvas) return null
        else return openCanvases.value.get(activeTab.data.canvasId)
    })
    const isSaved = computed(() => (id: number) => {
        const scene = openCanvases.value.get(id)
        return scene ? !scene.unsavedChanges : true
    })

    async function fetchCanvases() {
        const result = await window.api.canvases.getAll()
        if (result.success) {
            const map = new Map<number, Canvas>()
            for (const c of result.data) map.set(c.id, c)
            availableCanvases.value = map
        } else {
            console.error('Failed to fetch canvases:', result.error)
        }
    }

    async function fetchAndOpenCanvas(id: number) {
        // check if already open
        if (openCanvases.value.has(id)) {
            const tabStore = useTabStore()
            const index = tabStore.openTabs.findIndex(
                (tab) => tab.type == AppTabType.Canvas && tab.data.canvasId == id
            )
            if (index !== -1) {
                tabStore.setActiveTab(index)
                return openCanvases.value.get(id)
            }
            // scene still loaded but its tab was closed -> reopen it
            const scene = openCanvases.value.get(id)!
            const newIndex = tabStore.openTab(AppTabType.Canvas, scene.name, { canvasId: id })
            tabStore.setActiveTab(newIndex)
            return scene
        }

        const result = await window.api.canvases.get(id)
        if (!result.success) {
            console.error('Failed to fetch canvas:', result.error)
            return null
        }
        const { meta, data } = result.data
        const scene = new CanvasScene(meta.id, meta.name, true)
        scene.loadFromJSON(data)
        openCanvases.value.set(scene.id, scene)
        const tabStore = useTabStore()
        const index = tabStore.openTab(AppTabType.Canvas, meta.name, { canvasId: scene.id })
        tabStore.setActiveTab(index)
        return openCanvases.value.get(scene.id)
    }

    function addAndOpenNewCanvas(files: number[] = [], title = 'Untitled canvas') {
        const scene = new CanvasScene(Date.now(), title, false)
        openCanvases.value.set(scene.id, scene)
        const opened = openCanvases.value.get(scene.id)!
        opened.unsavedChanges = true
        opened.addMediaFilesCentered(files)
        const tabStore = useTabStore()
        const index = tabStore.openTab(AppTabType.Canvas, title, { canvasId: opened.id })
        tabStore.setActiveTab(index)
        return opened
    }

    async function addFilesToCanvas(canvasId: number, fileIds: number[]) {
        const scene = await fetchAndOpenCanvas(canvasId)
        if (!scene) return
        scene.addMediaFilesCentered(fileIds)
        scene.unsavedChanges = true
        return scene
    }

    function getOpenCanvasTabs(): { canvasId: number; title: string }[] {
        const tabStore = useTabStore()
        return tabStore.openTabs
            .filter((tab) => tab.type === AppTabType.Canvas)
            .map((tab) => ({ canvasId: tab.data.canvasId, title: tab.title }))
    }

    function getExistingNames(ignoreId?: number): Set<string> {
        const names = new Set<string>()
        for (const [id, c] of availableCanvases.value) {
            if (ignoreId !== undefined && id === ignoreId) continue
            names.add(c.name)
        }
        return names
    }

    function requestSave(id: number, forceAs = false) {
        const next = new Map(pendingSaveRequests.value)
        next.set(id, { forceAs })
        pendingSaveRequests.value = next
    }

    function clearSaveRequest(id: number) {
        const next = new Map(pendingSaveRequests.value)
        next.delete(id)
        pendingSaveRequests.value = next
    }

    function getSaveRequest(id: number) {
        return pendingSaveRequests.value.get(id)
    }

    async function saveCanvas(
        id: number,
        name: string,
        opts?: { forceAsNew?: boolean }
    ): Promise<boolean> {
        const scene = openCanvases.value.get(id)
        if (!scene) {
            console.error('Canvas not found:', id)
            return false
        }
        const data = scene.saveToJSON()
        if (!scene.isPersisted || opts?.forceAsNew) {
            const validation = validateCanvasName(name, getExistingNames(scene.id))
            if (!validation.valid) {
                console.error('Canvas name validation failed (save):', validation.message)
                toastService.add({
                    severity: 'error',
                    summary: 'Save failed',
                    detail: validation.message
                })
                return false
            }
            const result = await window.api.canvases.create(validation.name, data)
            if (!result.success) {
                console.error('Failed to create canvas:', result.error)
                toastService.add({
                    severity: 'error',
                    summary: 'Save failed',
                    detail: `Could not create canvas: ${result.error}`
                })
                return false
            }
            const newId = result.data.id
            openCanvases.value.delete(scene.id)

            const tabStore = useTabStore()
            const idx = tabStore.openTabs.findIndex(
                (t) => t.type === AppTabType.Canvas && t.data?.canvasId === scene.id
            )

            scene.id = newId
            scene.name = validation.name
            scene.isPersisted = true
            openCanvases.value.set(newId, scene)
            availableCanvases.value.set(newId, result.data)

            if (idx !== -1) {
                tabStore.openTabs[idx].data.canvasId = newId
                tabStore.setTabTitle(idx, validation.name)
            }
            console.log('Canvas created:', newId, scene.name)
        } else {
            const result = await window.api.canvases.saveData(id, data)
            if (!result.success) {
                console.error('Failed to save canvas:', result.error)
                toastService.add({
                    severity: 'error',
                    summary: 'Save failed',
                    detail: `Could not save canvas: ${result.error}`
                })
                return false
            }
            console.log('Canvas saved:', id)
        }
        scene.unsavedChanges = false
        return true
    }

    // Saves the canvas by id, prompting for a name via SaveCanvasDialog when the
    // canvas is not yet persisted (or a new copy is forced). Returns false if the
    // scene is missing, the user bails out of the name dialog, or the save itself
    // failed; true only when the save succeeded.
    async function saveCanvasWithPrompt(canvasId: number, forceAs = false): Promise<boolean> {
        const scene = openCanvases.value.get(canvasId)
        if (!scene) return false

        if (scene.isPersisted && !forceAs) {
            return await saveCanvas(scene.id, scene.name)
        }

        const initialName = scene.name?.trim() || 'Untitled canvas'
        const existingNames = getExistingNames()

        const newName = await new Promise<string | undefined>((resolve) => {
            dialogService.open(SaveCanvasDialog, {
                data: {
                    initialName,
                    existingNames: Array.from(existingNames)
                },
                onClose: (options) => resolve(options?.data?.name as string | undefined)
            })
        })

        if (!newName) return false

        return await saveCanvas(scene.id, newName, { forceAsNew: forceAs })
    }

    async function renameCanvas(id: number, newName: string) {
        const validation = validateCanvasName(newName, getExistingNames(id))
        if (!validation.valid) {
            console.error('Canvas name validation failed (rename):', validation.message)
            return
        }
        const result = await window.api.canvases.rename(id, validation.name)
        if (!result.success) {
            console.error('Failed to rename canvas:', result.error)
            return
        }
        const updated = result.data
        availableCanvases.value.set(updated.id, updated)
        const scene = openCanvases.value.get(id)
        if (scene) scene.name = validation.name
        const tabStore = useTabStore()
        const idx = tabStore.openTabs.findIndex(
            (t) => t.type === AppTabType.Canvas && t.data?.canvasId === id
        )
        if (idx !== -1) {
            tabStore.setTabTitle(idx, validation.name)
        }
    }

    async function deleteCanvas(id: number) {
        const scene = openCanvases.value.get(id)
        if (scene && scene.unsavedChanges) {
            console.error('Canvas has unsaved changes')
            return
        }
        const result = await window.api.canvases.delete(id)
        if (!result.success) {
            console.error('Failed to delete canvas:', result.error)
            return
        }
        availableCanvases.value.delete(id)
        openCanvases.value.delete(id)
        const tabStore = useTabStore()
        await tabStore.closeTabWhere((t) => t.type === AppTabType.Canvas && t.data?.canvasId === id)
    }

    function closeCanvas(id: number) {
        openCanvases.value.delete(id)
    }

    return {
        openCanvases,
        availableCanvases,
        pendingSaveRequests,
        getCanvas,
        getActiveCanvas,
        isSaved,
        addAndOpenNewCanvas,
        addFilesToCanvas,
        getOpenCanvasTabs,
        fetchCanvases,
        fetchAndOpenCanvas,
        saveCanvas,
        saveCanvasWithPrompt,
        renameCanvas,
        deleteCanvas,
        closeCanvas,
        getExistingNames,
        requestSave,
        clearSaveRequest,
        getSaveRequest
    }
})

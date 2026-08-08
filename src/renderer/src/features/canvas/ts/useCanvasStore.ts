import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useTabStore } from '../../../core/stores/useTabStore'
import { AppTabType } from '@renderer/features/tab_system/Tabs'
import CanvasScene from './scene/CanvasScene'
import { Coordinates } from './scene/CanvasUtils'
import { Canvas } from 'src/shared/types/models'

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
        return scene
    }

    function addAndOpenNewCanvas(files: number[] = [], title = 'new canvas') {
        const scene = new CanvasScene(Date.now(), title, false)
        scene.unsavedChanges = true
        const tabStore = useTabStore()
        tabStore.openTab(AppTabType.Canvas, title, { canvasId: scene.id })
        openCanvases.value.set(scene.id, scene)
        scene.addMediaFiles(files, { x: 100, y: 100 } as Coordinates)
        return scene
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

    async function saveCanvas(id: number, name: string, opts?: { forceAsNew?: boolean }) {
        const scene = openCanvases.value.get(id)
        if (!scene) {
            console.error('Canvas not found:', id)
            return
        }
        const data = scene.saveToJSON()
        if (!scene.isPersisted || opts?.forceAsNew) {
            const result = await window.api.canvases.create(name, data)
            if (!result.success) {
                console.error('Failed to create canvas:', result.error)
                return
            }
            const newId = result.data.id
            openCanvases.value.delete(scene.id)

            const tabStore = useTabStore()
            const idx = tabStore.openTabs.findIndex(
                (t) => t.type === AppTabType.Canvas && t.data?.canvasId === scene.id
            )

            scene.id = newId
            scene.name = name
            scene.isPersisted = true
            openCanvases.value.set(newId, scene)
            availableCanvases.value.set(newId, result.data)

            if (idx !== -1) {
                tabStore.openTabs[idx].data.canvasId = newId
                tabStore.setTabTitle(idx, name)
            }
            console.log('Canvas created:', newId, scene.name)
        } else {
            const result = await window.api.canvases.saveData(id, data)
            if (!result.success) {
                console.error('Failed to save canvas:', result.error)
                return
            }
            console.log('Canvas saved:', id)
        }
        scene.unsavedChanges = false
    }

    async function renameCanvas(id: number, newName: string) {
        const result = await window.api.canvases.rename(id, newName)
        if (!result.success) {
            console.error('Failed to rename canvas:', result.error)
            return
        }
        const updated = result.data
        availableCanvases.value.set(updated.id, updated)
        const scene = openCanvases.value.get(id)
        if (scene) scene.name = newName
        const tabStore = useTabStore()
        const idx = tabStore.openTabs.findIndex(
            (t) => t.type === AppTabType.Canvas && t.data?.canvasId === id
        )
        if (idx !== -1) {
            tabStore.setTabTitle(idx, newName)
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
        tabStore.closeTabWhere((t) => t.type === AppTabType.Canvas && t.data?.canvasId === id)
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
        fetchCanvases,
        fetchAndOpenCanvas,
        saveCanvas,
        renameCanvas,
        deleteCanvas,
        closeCanvas,
        getExistingNames,
        requestSave,
        clearSaveRequest,
        getSaveRequest
    }
})

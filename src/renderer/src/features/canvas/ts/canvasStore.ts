import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { useTabStore } from '../../../core/stores/useTabStore'
import { AppTabType } from '@renderer/features/tab_system/Tabs'
import CanvasScene from './scene/CanvasScene'
import { Coordinates } from './scene/canvas_utils'

export const useCanvasStore = defineStore('canvasStore', () => {
    const openCanvases = ref(new Map<number, CanvasScene>())

    const getOpenCanvases = computed(() => openCanvases.value)
    const getCanvas = computed(() => (id: number) => openCanvases.value.get(id))
    const getActiveCanvas = computed(() => {
        const tabStore = useTabStore()
        const activeTab = tabStore.currentActiveTab
        if (activeTab.type != AppTabType.Canvas) return null
        else return openCanvases.value.get(activeTab.data.canvasId)
    })

    function addOpenCanvas(files: number[] = [], title = 'new canvas') {
        const scene = new CanvasScene(Date.now())
        const tabStore = useTabStore()
        tabStore.openTab(AppTabType.Canvas, title, { canvasId: scene.id })
        openCanvases.value.set(scene.id, scene)
        scene.addImages(files, { x: 100, y: 100 } as Coordinates)
    }

    function closeCanvas(id: number) {
        openCanvases.value.delete(id)
    }

    return { openCanvases, getOpenCanvases, getCanvas, getActiveCanvas, addOpenCanvas, closeCanvas }
})

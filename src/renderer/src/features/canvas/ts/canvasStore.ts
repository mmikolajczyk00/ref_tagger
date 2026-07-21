import { defineStore } from 'pinia'
import { useTabStore } from '../../../core/stores/useTabStore'
import { AppTabType } from '@renderer/features/tab_system/Tabs'
import CanvasScene from './scene/CanvasScene'
import { Coordinates } from './scene/canvas_utils'

interface CanvasTabsState {
    openCanvases: Map<number, CanvasScene>
}

export const useCanvasStore = defineStore('canvasStore', {
    state: (): CanvasTabsState => ({
        openCanvases: new Map<number, CanvasScene>()
    }),

    getters: {
        getOpenCanvases: (state) => {
            return state.openCanvases
        },
        getCanvas: (state) => {
            return (id: number) => state.openCanvases.get(id)
        }
    },

    actions: {
        addOpenCanvas(files: number[] = []) {
            const scene = new CanvasScene(Date.now())
            const tabStore = useTabStore()
            tabStore.openTab(AppTabType.Canvas, 'new canvas', { canvasId: scene.id })
            this.openCanvases.set(scene.id, scene)
            scene.addImages(files, { x: 100, y: 100 } as Coordinates)
        },

        closeCanvas(id: number) {
            this.$state.openCanvases.delete(id)
        }
    }
})

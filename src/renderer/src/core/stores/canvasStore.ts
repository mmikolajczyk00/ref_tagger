import { UUID } from 'crypto'
import { defineStore } from 'pinia'
import { useTabStore } from './tabStore'
import { AppTabType } from '@renderer/features/tab_system/Tabs'
import CanvasScene from '@renderer/features/canvas/CanvasScene'
import { Coordinates } from '@renderer/features/canvas/canvas_utils'

interface CanvasTabsState {
    openCanvases: Map<UUID, CanvasScene>
}

export const useCanvasStore = defineStore('canvasStore', {
    state: (): CanvasTabsState => ({
        openCanvases: new Map<UUID, CanvasScene>()
    }),

    getters: {
        getOpenCanvases: (state) => {
            return state.openCanvases
        },
        getCanvas: (state) => {
            return (id: UUID) => state.openCanvases.get(id)
        }
    },

    actions: {
        addOpenCanvas(files: UUID[] = []) {
            const scene = new CanvasScene(crypto.randomUUID())
            const tabStore = useTabStore()
            tabStore.openTab(AppTabType.Canvas, 'new canvas', { canvasId: scene.id })
            this.openCanvases.set(scene.id, scene)
            scene.addImages(files, { x: 100, y: 100 } as Coordinates)
        },

        closeCanvas(id: UUID) {
            this.$state.openCanvases.delete(id)
        }
    }
})

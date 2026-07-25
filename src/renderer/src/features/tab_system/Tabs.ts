import EmptyTab from './ui/EmptyTab.vue'
import UploadQueueTab from '../upload_queue/ui/UploadQueueTab.vue'
import ExplorerTab from '../explorer/ui/ExplorerTab.vue'
import CanvasTab, { CanvasTabProps } from '../canvas/ui/CanvasTab.vue'
import { UndoRedoManager } from '@renderer/core/command_system/UndoRedoManager'

export enum AppTabType {
    Empty = 'Empty',
    Upload = 'Upload',
    Explorer = 'Explorer',
    Canvas = 'Canvas',
    UploadQueue = 'UploadQueue'
}

export const AppTabComponents = {
    [AppTabType.Empty]: EmptyTab,
    [AppTabType.Upload]: UploadQueueTab,
    [AppTabType.Explorer]: ExplorerTab,
    [AppTabType.Canvas]: CanvasTab,
    [AppTabType.UploadQueue]: UploadQueueTab
}

export interface BaseTab {
    id: number
    title: string
    undoRedoMng: UndoRedoManager
    data: any
}

export interface EmptyTab extends BaseTab {
    type: AppTabType.Empty
}

export interface CanvasTab extends BaseTab {
    type: AppTabType.Canvas
    data: CanvasTabProps
}

export interface ExplorerTab extends BaseTab {
    type: AppTabType.Explorer
}

export interface UploadQueueTab extends BaseTab {
    type: AppTabType.Upload
}

export const AppTabIcons = ['', 'download_2', 'files', 'gallery_thumbnail', 'sell']

export type AppTab = CanvasTab | ExplorerTab | UploadQueueTab

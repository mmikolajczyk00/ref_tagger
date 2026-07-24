import { CommandManager } from '@renderer/core/command_system/CommandManager'
import EmptyTab from './ui/EmptyTab.vue'
import UploadQueueTab from '../upload_queue/ui/UploadQueueTab.vue'
import ExplorerTab from '../explorer/ui/ExplorerTab.vue'
import CanvasTab from '../canvas/ui/CanvasTab.vue'
import TagEditorTab from '../tag_editor/ui/TagEditorTab.vue'

enum AppTabType {
    Empty,
    UploadQueue,
    Explorer,
    Canvas,
    TagEditor
}

const AppTabComponents = [EmptyTab, UploadQueueTab, ExplorerTab, CanvasTab, TagEditorTab]
const AppTabIcons = ['', 'download_2', 'files', 'gallery_thumbnail', 'sell']

class AppTab {
    title: string = 'untitled'
    id: number
    tabType: AppTabType = AppTabType.Empty
    cmdManager = new CommandManager()
    data: any

    constructor(id: number, title?: string) {
        this.id = id

        if (title) this.title = title
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onActive() {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onInactive() {}
}

class Empty_Tab extends AppTab {
    tabType = AppTabType.Empty
}

// class UploadQueue_Tab extends AppTab {
//   tabType = AppTabType.Explorer
// }

// class Explorer_Tab extends AppTab {
//   tabType = AppTabType.Explorer
// }

// class CanvasEditor_Tab extends AppTab {
//   tabType = AppTabType.Canvas
// }

// class TagEditor_Tab extends AppTab {
//   tabType = AppTabType.TagEditor
// }

export {
    AppTab,
    AppTabType,
    Empty_Tab,
    // UploadQueue_Tab,
    // Explorer_Tab,
    // CanvasEditor_Tab,
    // TagEditor_Tab,
    AppTabComponents,
    AppTabIcons
}

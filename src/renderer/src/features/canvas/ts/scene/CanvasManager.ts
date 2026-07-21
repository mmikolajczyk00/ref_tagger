import { CommandService } from '@renderer/core/command_system/CommandService'
import { useFileStore } from '../../../../core/stores/useFileStore'
import { useTagStore } from '@renderer/core/stores/tagStore'
import { CANVAS_HOTKEYS_MAP, generate_canvas_commands_factories } from '../../commands/CanvasCmd'
import { useCanvasStore } from '../canvasStore'
import { UUID } from 'crypto'
import CanvasScene from './CanvasScene'
import { inject } from 'vue'

class CanvasFeatureManager {
    private scene: CanvasScene
    private commandService: CommandService

    constructor(scene?: CanvasScene) {
        this.scene = scene || new CanvasScene(crypto.randomUUID())
        this.commandService = inject('commandService') as CommandService
    }

    registerFeature() {
        this.commandService.registerFeature(
            'canvas',
            generate_canvas_commands_factories(this),
            CANVAS_HOTKEYS_MAP
        )
    }
    unregisterFeature() {
        this.commandService.unregisterFeature(
            'canvas',
            generate_canvas_commands_factories(this),
            CANVAS_HOTKEYS_MAP
        )
    }
}

export { CanvasFeatureManager as CanvasManager }

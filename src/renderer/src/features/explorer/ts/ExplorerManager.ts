import { CommandService, Feature } from '@renderer/core/command_system/CommandService'
import { EXPLORER_HOTKEYS_MAP, generate_explorer_commands_factories } from '../commands/ExplorerCmd'
import { UUID } from 'crypto'
import { SelectionHandler } from '@renderer/core/utils/selectionHandler'
import { computed, isProxy, isReactive, isRef, ref } from 'vue'
import { useFileStore } from '../../../core/stores/useFileStore'
import { useTagStore } from '@renderer/core/stores/tagStore'
import { FileModel, GalleryFile } from '@shared/model/fileModel'

class ExplorerManager implements Feature {
    private fileStore = useFileStore()
    private tagStore = useTagStore()

    searchTagsInput = ref<Array<string>>([])
    selectedFiles = ref<Array<GalleryFile>>([])
    fetchingStatus = ref(false)

    galleriaFiles = ref<Array<FileModel>>([])
    galleriaOpen = ref(false)

    searchResult = computed(() => {
        if (this.searchTagsInput.value.length > 0) {
            return this.fileStore.getSearchResultList.map(
                (file: FileModel) => new GalleryFile(file)
            )
        } else {
            return this.fileStore.getAllFilesList.map((file: FileModel) => new GalleryFile(file))
        }
    })
    selectionHandler = new SelectionHandler(this.searchResult, this.selectedFiles)

    constructor(private commandService: CommandService) {}

    registerFeature() {
        this.commandService.registerFeature(
            'explorer',
            generate_explorer_commands_factories(this),
            EXPLORER_HOTKEYS_MAP,
            'all'
        )
    }
    unregisterFeature() {
        this.commandService.unregisterFeature(
            'explorer',
            generate_explorer_commands_factories(this),
            EXPLORER_HOTKEYS_MAP,
            'all'
        )
    }

    search(): void {
        this.fetchingStatus.value = true
        this.fileStore
            .search(this.searchTagsInput.value)
            .finally(() => (this.fetchingStatus.value = false))
    }

    getSelected(): UUID[] {
        return this.selectedFiles.value.map(({ file }: GalleryFile) => file.id)
    }
    selectAll() {
        this.selectionHandler.selectAll()
    }
    delete(selected: UUID[]) {
        if (selected.length <= 0) return
        this.fileStore.deleteFiles(selected)
    }
    deleteFile(id: UUID) {
        this.fileStore.deleteFiles([id])
    }

    viewInGalleria(selected: UUID[]) {
        if (selected.length <= 0) return

        this.galleriaFiles.value = selected.map((id) => this.fileStore.getFileOfId(id))
        this.galleriaOpen.value = true
    }

    fetchData(): void {
        this.fetchingStatus.value = true
        this.fileStore.fetchAllFiles(() => {
            this.fetchingStatus.value = false
        })

        this.search()
    }
}

export { ExplorerManager }

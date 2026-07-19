import { UUID } from 'crypto'
import { defineStore } from 'pinia'
import { FileModel } from '../../../../shared/model/fileModel'
import * as filesService from '@renderer/core/api/filesService'

interface State {
  allFiles: Map<UUID, FileModel>
  searchResult: Map<UUID, FileModel>
}

export const useFileStore = defineStore('fileStore', {
  state: (): State => ({
    allFiles: new Map(), //TODO: replace with paginated 'most recent' search or 'home'-like dashboard
    searchResult: new Map()
  }),

  getters: {
    getAllFilesList: (state) => [...state.allFiles.values()],
    getSearchResultList: (state) => [...state.searchResult.values()],
    getFileOfId: (state) => {
      return (fileId) => state.allFiles.get(fileId)
    }
  },

  actions: {
    async fetchAllFiles(callback = () => {}) {
      filesService
        .getAllFiles()
        .then((result) => {
          result.forEach((f) => {
            this.$state.allFiles.set(f.id, f)
          })
          callback()
        })
        .catch((err) => {
          console.error(err)
          callback()
        })
    },
    async search(tags: string[], callback = () => {}) {
      filesService
        .findFilesByAnyTags(tags)
        .then((result) => {
          this.$state.searchResult.clear()
          result.forEach((f) => {
            // TODO: temporary approach, just to sync when tags are added / deleted
            this.$state.searchResult.set(f.id, this.$state.allFiles.get(f.id)!)
          })
          callback()
        })
        .catch((err) => {})
    },
    async deleteFiles(idArray: UUID[], callback = () => {}) {
      idArray.forEach((id) => {
        filesService
          .deleteFile(id)
          .then((result) => {
            this.$state.allFiles.delete(id)
            this.$state.searchResult.delete(id)
            callback()
          })
          .catch((err) => {
            console.error(err)
            callback()
          })
      })
    }
  }
})

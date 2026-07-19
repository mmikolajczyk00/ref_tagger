import * as blacklistService from '@renderer/core/api/blacklistService'
import { defineStore } from 'pinia'

interface State {
  blacklist: Set<string>
}

export const useBlacklistStore = defineStore('blacklistStore', {
  state: (): State => ({
    blacklist: new Set<string>()
  }),

  getters: {},

  actions: {
    async fetchBlacklist(callback = () => {}) {
      blacklistService
        .getAll()
        .then((result) => {
          this.blacklist = result
        })
        .catch((err) => {
          console.error(err)
        })
        .finally(() => {
          callback()
        })
    },
    async add(set: string[], callback = () => {}) {
      blacklistService
        .add(set)
        .then(() => {
          this.fetchBlacklist()
          callback()
        })
        .catch((err) => {
          console.error(err)
          this.fetchBlacklist()
          callback()
        })
    },
    async remove(set: string[], callback = () => {}) {
      blacklistService
        .remove(set)
        .then(() => {})
        .catch((err) => {
          console.error(err)
        })
        .finally(() => {
          this.fetchBlacklist()
          callback()
        })
    },
    async clearAll(callback = () => {}) {
      blacklistService
        .clearAll()
        .then(() => {
          this.blacklist = new Set()
        })
        .catch((err) => {
          console.error(err)
          this.fetchBlacklist()
        })
        .finally(() => {
          callback()
        })
    },
    async edit(oldOne: string, newOne: string, callback = () => {}) {
      blacklistService
        .add([newOne])
        .then(() => {
          blacklistService.remove([oldOne]).then(() => {
            this.fetchBlacklist()
            callback()
          })
        })
        .catch((err) => {
          console.error(err)
          this.fetchBlacklist()
          callback()
        })
    }
  }
})

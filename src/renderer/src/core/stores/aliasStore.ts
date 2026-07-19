import { defineStore } from 'pinia'
import * as aliasService from '@renderer/core/api/aliasService'

interface State {
  aliases: Map<string, Set<string>>
}

export const useAliasStore = defineStore('aliasStore', {
  state: (): State => ({
    aliases: new Map<string, Set<string>>()
  }),

  getters: {
    getAliasesOfTag: (state) => {
      return (tag: string) => state.aliases.get(tag)
    }
  },

  actions: {
    async fetchAliases(callback = () => {}) {
      aliasService
        .getMap()
        .then((result) => {
          this.aliases = result
          console.log('map', result)
        })
        .catch((err) => {
          console.error(err)
        })
        .finally(() => {
          callback()
        })
    },
    async add(tag: string, aliases: string[], callback = () => {}) {
      aliasService
        .add(tag, aliases)
        .then(() => {
          this.fetchAliases()
        })
        .catch((err) => {
          console.error(err)
          this.fetchAliases()
        })
        .finally(() => {
          callback()
        })
    },
    async remove(aliases: string[], callback = () => {}) {
      aliasService
        .remove(aliases)
        .then(() => {
          this.fetchAliases()
        })
        .catch((err) => {
          console.error(err)
          this.fetchAliases()
        })
        .finally(() => {
          callback()
        })
    },
    async clearAll(callback = () => {}) {
      aliasService
        .clearAll()
        .then(() => {
          this.aliases = new Map()
        })
        .catch((err) => {
          console.error(err)
          this.fetchAliases()
        })
        .finally(() => {
          callback()
        })
    },
    async clearAllOfTag(tag: string, callback = () => {}) {
      aliasService
        .clearAllOfTag(tag)
        .then(() => {
          this.fetchAliases()
        })
        .catch((err) => {
          console.error(err)
          this.fetchAliases()
        })
        .finally(() => {
          callback()
        })
    }
  }
})

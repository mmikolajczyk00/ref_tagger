import * as tagsService from '@renderer/core/api/tagsService'
import { UUID } from 'crypto'
import { TagModel, TagRequest } from '../../../../shared/model/tagModel'
import { defineStore } from 'pinia'
import { useFileStore } from './useFileStore'

interface TaggerState {
    allTags: Map<UUID, TagModel>
    allTagNames: Set<string>
    allGroupsData: Map<string, TagModel[]>
}

export const useTagStore = defineStore('tagStore', {
    state: (): TaggerState => ({
        allTags: new Map<UUID, TagModel>(),
        allTagNames: new Set([]),
        allGroupsData: new Map<string, TagModel[]>()
    }),

    getters: {
        getGroupNames(state) {
            return [...state.allGroupsData.keys()]
        },
        getTag(state) {
            return (tagId: UUID) => {
                return state.allTags.get(tagId)
            }
        },
        exists(state) {
            return (tagName: string) => {
                return state.allTagNames.has(tagName)
            }
        },
        getNamesInGroup(state) {
            return (groupName: string) => {
                return (state.allGroupsData.get(groupName) || []).map((t) => t.name)
            }
        }
    },

    actions: {
        addGroup(name: string) {
            if (!this.$state.allGroupsData.has(name)) this.$state.allGroupsData.set(name, [])
        },
        async fetchAllTags(callback = () => {}) {
            tagsService
                .getAllTags()
                .then((result) => {
                    const data: TagModel[] = result
                    data.forEach((t) => {
                        this.$state.allTags.set(t.id, t)
                    })
                    this.$state.allTagNames = new Set<string>(data.map((t) => t.name))
                })
                .catch((err) => {
                    catchError(err)
                })

                .finally(() => {
                    callback()
                })
        },
        async fetchAllGroupsData(callback = () => {}) {
            tagsService
                .getAllGroupsData()
                .then((result) => {
                    this.$state.allGroupsData = result
                })
                .catch((err) => {
                    catchError(err)
                })
                .finally(() => {
                    callback()
                })
        },
        async addTagAdvanced(new_tag: TagRequest, callback = () => {}) {
            console.log('store', new_tag)

            tagsService
                .addTagAdvanced(new_tag)
                .then(() => {
                    this.fetchAllTags()
                    this.fetchAllGroupsData()
                })
                .catch((err) => {
                    catchError(err)
                })
                .finally(() => {
                    callback()
                })
        },
        async addListOfTags(tagList: string[], callback = () => {}) {
            tagsService
                .addTags(tagList)
                .then(() => {
                    this.fetchAllTags()
                })
                .catch((err) => {
                    catchError(err)
                })
                .finally(() => {
                    callback()
                })
        },
        async addTagsToFiles(tagList: string[], fileList: UUID[], callback = () => {}) {
            const fileStore = useFileStore()
            tagsService
                .addTagsToFiles(fileList, tagList)
                .then((result) => {
                    result.forEach((v, k) => {
                        v.successful.forEach((action) =>
                            fileStore.getFileOfId(k)?.addTag(TagModel.fromDto(action.data!))
                        )
                    })
                })
                .catch((err) => {
                    catchError(err)
                })
                .finally(() => {
                    callback()
                })
        },
        async removeTagFromFiles(tagList: string[], fileList: UUID[], callback = () => {}) {
            const fileStore = useFileStore()
            tagsService
                .removeTagsFromFiles(fileList, tagList)
                .then((result) => {
                    result.forEach((v, k) => {
                        v.successful.forEach((action) =>
                            fileStore.getFileOfId(k)?.removeTag(TagModel.fromDto(action.data!))
                        )
                    })
                })
                .catch((err) => {
                    catchError(err)
                })
                .finally(() => {
                    callback()
                })
        },
        async editTag(tagId: UUID, newData: TagRequest, callback = () => {}) {
            tagsService
                .editTag(tagId, newData)
                .then((result) => {
                    console.log(result)

                    this.fetchAllTags()
                })
                .catch((err) => {
                    catchError(err)
                })
                .finally(() => {
                    callback()
                })
        }
    }
})

function catchError(err: any) {
    if (err.response.data) console.error(err.response.data)
    else console.error(err)
}

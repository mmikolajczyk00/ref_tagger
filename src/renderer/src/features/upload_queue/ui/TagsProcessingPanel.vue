<script setup lang="ts">
import Tabs from 'primevue/tabs'
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Alias, Blacklist, Tag } from '@shared/types/models'
import { useBlacklistPanel } from '../ts/useBlacklistPanel'
import { useAliasesPanel } from '../ts/useAliasesPanel'
import { useTagStore } from '../../../core/stores/useTagStore'
import { DEFAULT_TAG_COLOR } from '../../../core/theme/colors'
import { stringsToTags } from '../../tag_input/ts/tagAdapter'
import TagContainer from '../../tag_input/ui/TagContainer.vue'

const activeTagProcessPanel = ref('0')

const {
    blacklists,
    currentlyEditedListId,
    deletingIds: blacklistDeletingIds,
    selectList,
    createBlacklist,
    addTag: addBlacklistTag,
    removeTag: removeBlacklistTag,
    editTag: editBlacklistTag,
    renameBlacklist,
    deleteBlacklist
} = useBlacklistPanel()

const {
    aliases,
    currentlyEditedAliasId,
    deletingIds: aliasDeletingIds,
    selectAlias,
    createAlias,
    addTag: addAliasTag,
    removeAliasTag,
    editTag: editAliasTag,
    renameAlias,
    deleteAlias
} = useAliasesPanel()

const blacklistScrollContainer = ref<HTMLElement | null>(null)
const aliasScrollContainer = ref<HTMLElement | null>(null)

function scrollToBottom(el: HTMLElement | null) {
    el?.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
}

async function handleCreateBlacklist() {
    const id = await createBlacklist()
    if (id !== null) {
        await nextTick()
        scrollToBottom(blacklistScrollContainer.value)
    }
}

async function handleCreateAlias() {
    const id = await createAlias()
    if (id !== null) {
        await nextTick()
        scrollToBottom(aliasScrollContainer.value)
    }
}

const tagStore = useTagStore()

function resolveColor(tagName: string): string {
    return tagStore.tags.find((t) => t.name === tagName)?.color ?? DEFAULT_TAG_COLOR
}

function getBlacklistTags(bl: Blacklist): Tag[] {
    return stringsToTags(bl.tags, resolveColor)
}

function setBlacklistTags(bl: Blacklist, tags: Tag[]) {
    bl.tags = tags.map((t) => t.name)
}

function getAliasTags(al: Alias): Tag[] {
    return stringsToTags(al.aliasTags, resolveColor)
}

function setAliasTags(al: Alias, tags: Tag[]) {
    al.aliasTags = tags.map((t) => t.name)
}

function onBlacklistAdd(bl: Blacklist, tag: Tag) {
    addBlacklistTag(bl.id, tag.name)
}

function onBlacklistRemove(bl: Blacklist, tag: Tag) {
    removeBlacklistTag(bl.id, tag.name)
}

function onBlacklistEdit(bl: Blacklist, tag: Tag, newName: string) {
    editBlacklistTag(bl.id, tag.name, newName)
}

function onAliasAdd(al: Alias, tag: Tag) {
    addAliasTag(al.id, tag.name)
}

function onAliasRemove(al: Alias, tag: Tag) {
    removeAliasTag(al.id, tag.name)
}

function onAliasEdit(al: Alias, tag: Tag, newName: string) {
    editAliasTag(al.id, tag.name, newName)
}

function onDocumentMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement | null
    if (!target) return
    if (currentlyEditedListId.value !== null && !target.closest('[data-blacklist-item]')) {
        selectList(null)
    }
    if (currentlyEditedAliasId.value !== null && !target.closest('[data-alias-item]')) {
        selectAlias(null)
    }
}

onMounted(() => document.addEventListener('mousedown', onDocumentMouseDown))
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocumentMouseDown))

const renamingListId = ref<number | null>(null)
const renamingAliasId = ref<number | null>(null)
const renameDraft = ref('')
const renameListInputEl = ref<any>(null)
const renameAliasInputEl = ref<any>(null)

function startRename(item: Blacklist | Alias, kind: 'blacklist' | 'alias') {
    if (kind === 'blacklist') {
        renamingListId.value = item.id
        renamingAliasId.value = null
        renameDraft.value = (item as Blacklist).listName
        selectList(item.id)
    } else {
        renamingAliasId.value = item.id
        renamingListId.value = null
        renameDraft.value = (item as Alias).realTag
    }
    nextTick(() => {
        const el = kind === 'blacklist' ? renameListInputEl.value : renameAliasInputEl.value
        if (el) {
            el[0].focus()
            el[0].select()
        }
    })
}

function commitRename(kind: 'blacklist' | 'alias', id: number) {
    const draft = renameDraft.value.trim()
    renamingListId.value = null
    renamingAliasId.value = null
    if (!draft) return
    if (kind === 'blacklist') renameBlacklist(id, draft)
    else renameAlias(id, draft)
}

function cancelRename() {
    renamingListId.value = null
    renamingAliasId.value = null
}
</script>

<template>
    <div class="flex size-full flex-col items-center gap-3 duration-75">
        <Tabs class="flex size-full min-h-0 flex-1 overflow-hidden" :value="activeTagProcessPanel">
            <div class="mx-auto w-min">
                <TabList>
                    <Tab value="0">Blacklist</Tab>
                    <Tab value="1">Aliases</Tab>
                    <Tab value="2">Rules</Tab>
                </TabList>
            </div>
            <TabPanels class="flex h-full min-h-0 flex-1 overflow-hidden">
                <TabPanel
                    class="flex size-full min-h-0 flex-col gap-2 overflow-hidden focus-within:outline-0"
                    value="0"
                >
                    <div
                        ref="blacklistScrollContainer"
                        class="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4"
                    >
                        <div
                            v-for="bl in blacklists"
                            :key="bl.id"
                            data-blacklist-item
                            class="group relative flex w-full cursor-pointer flex-row items-center"
                            :class="{
                                'ring-primary ring-1': currentlyEditedListId === bl.id,
                                'pointer-events-none opacity-50': blacklistDeletingIds.has(bl.id)
                            }"
                            @click.stop="selectList(bl.id)"
                        >
                            <div class="flex flex-1 flex-col rounded p-1">
                                <div
                                    class="dark:border-surface-700 mb-2 flex items-center gap-2 border-b-2"
                                >
                                    <h1
                                        v-if="renamingListId !== bl.id"
                                        class="cursor-text text-xl"
                                        @click.stop="startRename(bl, 'blacklist')"
                                    >
                                        {{ bl.listName }}
                                    </h1>
                                    <input
                                        v-else
                                        ref="renameListInputEl"
                                        v-model="renameDraft"
                                        class="bg-surface-0 dark:bg-surface-800 text-surface-950 dark:text-surface-0 w-full rounded px-1 py-0.5 text-xl outline-none"
                                        @keydown.enter="commitRename('blacklist', bl.id)"
                                        @keydown.escape="cancelRename"
                                        @blur="cancelRename"
                                    />
                                </div>

                                <TagContainer
                                    :all-items-tags="getBlacklistTags(bl)"
                                    :some-items-tags="[]"
                                    @update:all-items-tags="(t: Tag[]) => setBlacklistTags(bl, t)"
                                    @add="(tag: Tag) => onBlacklistAdd(bl, tag)"
                                    @remove="(tag: Tag) => onBlacklistRemove(bl, tag)"
                                    @edit="(tag: Tag, n: string) => onBlacklistEdit(bl, tag, n)"
                                />
                            </div>
                            <Button
                                text
                                class="material-symbols-outlined dark:bg-surface-950 bg-surface-50 text-danger-500 hover:bg-danger-900 h-full cursor-pointer rounded p-2 text-sm opacity-0 transition-opacity group-hover:opacity-100"
                                @click.stop="deleteBlacklist(bl.id)"
                            >
                                <span> delete </span>
                            </Button>
                        </div>
                    </div>
                    <div class="p-3">
                        <Button outlined fluid @click="handleCreateBlacklist"
                            >Add new blacklist</Button
                        >
                    </div>
                </TabPanel>

                <TabPanel
                    class="flex size-full min-h-0 flex-col gap-2 overflow-hidden focus-within:outline-0"
                    value="1"
                >
                    <div
                        ref="aliasScrollContainer"
                        class="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4"
                    >
                        <div
                            v-for="al in aliases"
                            :key="al.id"
                            data-alias-item
                            class="group relative flex cursor-pointer flex-col rounded p-1"
                            :class="{
                                'pointer-events-none opacity-50': aliasDeletingIds.has(al.id),
                                'ring-primary ring-1': currentlyEditedAliasId === al.id
                            }"
                            @click.stop="selectAlias(al.id)"
                        >
                            <div class="flex flex-row items-center gap-2">
                                <div class="relative max-h-60 flex-1">
                                    <TagContainer
                                        :all-items-tags="getAliasTags(al)"
                                        :some-items-tags="[]"
                                        @update:all-items-tags="(t: Tag[]) => setAliasTags(al, t)"
                                        @add="(tag: Tag) => onAliasAdd(al, tag)"
                                        @remove="(tag: Tag) => onAliasRemove(al, tag)"
                                        @edit="(tag: Tag, n: string) => onAliasEdit(al, tag, n)"
                                    />
                                </div>
                                <span
                                    class="text-surface-500 dark:text-surface-500 material-symbols-outlined"
                                >
                                    keyboard_double_arrow_right
                                </span>
                                <div class="relative">
                                    <h1
                                        v-if="renamingAliasId !== al.id"
                                        class="bg-surface-200 dark:bg-surface-700 cursor-text rounded p-2"
                                        @click.stop="startRename(al, 'alias')"
                                    >
                                        {{ al.realTag }}
                                    </h1>
                                    <input
                                        v-else
                                        ref="renameAliasInputEl"
                                        v-model="renameDraft"
                                        class="bg-surface-200 dark:bg-surface-700 text-surface-950 dark:text-surface-0 rounded p-2 outline-none"
                                        @keydown.enter="commitRename('alias', al.id)"
                                        @keydown.escape="cancelRename"
                                        @blur="cancelRename"
                                    />
                                </div>
                                <Button
                                    text
                                    class="material-symbols-outlined dark:bg-surface-950 bg-surface-50 text-danger-500 hover:bg-danger-900 h-full cursor-pointer rounded p-2 text-sm opacity-0 transition-opacity group-hover:opacity-100"
                                    @click.stop="deleteAlias(al.id)"
                                >
                                    <span> delete </span>
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div class="p-3">
                        <Button outlined fluid @click="handleCreateAlias"
                            >Add new alias list</Button
                        >
                    </div>
                </TabPanel>

                <TabPanel value="2">
                    <h1>WIP</h1>
                </TabPanel>
            </TabPanels>
        </Tabs>
    </div>
</template>

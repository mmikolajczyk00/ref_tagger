<template>
    <div class="flex gap-1 justify-start w-fit relative pr-8 items-center">
        <div v-for="tab in tSys.openTabs" :key="tab.id">
            <div
                class="group min-w-24 p-1 max-w-44 cursor-pointer flex items-center relative"
                :class="[
                    tab.id == tSys.activeTabId
                        ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100'
                        : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'
                ]"
                @click="clickTab(tab.id)"
            >
                <span class="material-symbols-outlined mr-2">{{ AppTabIcons[tab.tabType] }}</span>
                <p class="select-none text-nowrap text-ellipsis overflow-hidden">
                    {{ tab.title }} : {{ tab.id }}
                </p>

                <Button
                    @click.stop="closeTab(tab.id)"
                    class="group-hover:opacity-100 opacity-0 size-fit aspect-square p-1 absolute right-0"
                    severity="secondary"
                    icon="pi pi-times"
                />
            </div>
        </div>
        <Button
            @click.stop="newEmptyTab()"
            class="size-fit aspect-square p-1 absolute right-0"
            severity="secondary"
            icon="pi pi-plus"
        />
    </div>
</template>

<script setup lang="ts">
import { inject, onMounted, reactive, Ref, ref, watch } from 'vue'
import { AppTab, AppTabType } from '../Tabs'
import { CommandService } from '../../../core/command_system/CommandService'

import { AppTabIcons } from '../Tabs'
import { TAB_COMMANDS } from '../commands/TabCmd'
import { useTabStore } from '@renderer/core/stores/tabStore'

const commandService = inject('commandService') as CommandService
let tabStore = useTabStore()
let tSys = ref(tabStore) // so ts doesnt complainc

function clickTab(id: number) {
    tabStore.setActiveTab(id)
}
function closeTab(id: number) {
    tabStore.closeTab(id)
}
function newEmptyTab() {
    console.log('open_empty_tab')
    commandService.execute(TAB_COMMANDS.NEW_EMPTY_TAB)
}
</script>

<style scoped></style>

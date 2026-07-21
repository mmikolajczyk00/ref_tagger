<template>
    <div class="relative flex w-fit items-center justify-start gap-1 pr-8">
        <div v-for="tab in tabStore.openTabs" :key="tab.id">
            <div
                class="group relative flex max-w-44 min-w-24 cursor-pointer items-center p-1"
                :class="[
                    tab.id == tabStore.activeTabId
                        ? 'bg-zinc-700 text-zinc-100 hover:bg-zinc-600'
                        : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                ]"
                @click="clickTab(tab.id)"
            >
                <span class="material-symbols-outlined mr-2">{{ AppTabIcons[tab.tabType] }}</span>
                <p class="overflow-hidden text-nowrap text-ellipsis select-none">
                    {{ tab.title }} : {{ tab.id }}
                </p>

                <Button
                    @click.stop="closeTab(tab.id)"
                    class="absolute right-0 aspect-square size-fit p-1 opacity-0 group-hover:opacity-100"
                    severity="secondary"
                    icon="pi pi-times"
                />
            </div>
        </div>
        <Button
            @click.stop="newEmptyTab()"
            class="absolute right-0 aspect-square size-fit p-1"
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
import { useTabStore } from '../../../core/stores/useTabStore'

const commandService = inject('commandService') as CommandService
let tabStore = useTabStore()

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

<template>
    <div class="relative flex w-fit items-center justify-start gap-1 pr-8">
        <div v-for="(tab, index) in tabStore.openTabs" :key="tab.id">
            <div
                class="group relative flex max-w-44 min-w-24 cursor-pointer items-center p-1"
                :class="[
                    index == tabStore.activeTabIndex
                        ? 'bg-zinc-700 text-zinc-100 hover:bg-zinc-600'
                        : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                ]"
                @click="clickTab(index)"
            >
                <span class="material-symbols-outlined mr-2">{{ AppTabIcons[tab.type] }}</span>
                <p class="overflow-hidden text-nowrap text-ellipsis select-none">
                    {{ tab.title }} : {{ index }}
                </p>

                <Button
                    class="absolute right-0 aspect-square size-fit p-1 opacity-0 group-hover:opacity-100"
                    severity="secondary"
                    icon="pi pi-times"
                    @click.stop="closeTab(index)"
                />
            </div>
        </div>
        <Button
            class="absolute right-0 aspect-square size-fit p-1"
            severity="secondary"
            icon="pi pi-plus"
            @click.stop="newEmptyTab()"
        />
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { AppTabIcons } from '../Tabs'
import { TAB_COMMANDS } from '../commands/TabCmd'
import { CommandService } from '../../../core/command_system/CommandService'
import { useTabStore } from '../../../core/stores/useTabStore'

const commandService = inject('commandService') as CommandService
let tabStore = useTabStore()

function clickTab(index: number) {
    tabStore.setActiveTab(index)
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

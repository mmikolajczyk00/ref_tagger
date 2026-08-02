<template>
    <div class="relative flex w-fit items-center justify-start gap-1 pr-8">
        <ThemeSwitcher />

        <div v-for="(tab, index) in tabStore.openTabs" :key="tab.id">
            <div
                class="group relative flex max-w-44 min-w-24 cursor-pointer items-center p-1"
                :class="[
                    index == tabStore.activeTabIndex
                        ? 'bg-surface-200 dark:bg-surface-700 text-surface-950 dark:text-surface-0 hover:bg-surface-300 dark:hover:bg-surface-600'
                        : 'bg-surface-0 dark:bg-surface-950 text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-950 dark:hover:text-surface-0'
                ]"
                @click="clickTab(index)"
            >
                <span class="material-symbols-outlined mr-2">{{ AppTabIcons[tab.type] }}</span>
                <p class="overflow-hidden text-nowrap text-ellipsis select-none">
                    <!-- {{ tab.title }} : {{ index }} -->
                    {{ tab.title }}
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
import ThemeSwitcher from '../../../core/ui/ThemeSwitcher.vue'

const commandService = inject('commandService') as CommandService
let tabStore = useTabStore()

function clickTab(index: number) {
    tabStore.setActiveTab(index)
}
function closeTab(id: number) {
    tabStore.closeTab(id)
}
function newEmptyTab() {
    commandService.execute(TAB_COMMANDS.NEW_EMPTY_TAB)
}
</script>

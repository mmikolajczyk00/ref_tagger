import { defineStore } from 'pinia'

import { CommandService } from '@renderer/core/command_system/CommandService'
import {
    generate_tab_commands_factories,
    TAB_HOTKEYS_MAP
} from '@renderer/features/tab_system/commands/TabCmd'
import { AppTab, AppTabType } from '@renderer/features/tab_system/Tabs'
import { computed, ref } from 'vue'

interface State {
    openTabs: Array<AppTab>
    tabHistory: Array<AppTab>
    activeTabId: number
}

export const useTabStore = defineStore('tabStore', () => {
    const openTabs = ref<AppTab[]>([])
    const tabHistory = ref<AppTab[]>([])
    const activeTabId = ref(1)

    const currentActiveTab = computed(() => {
        return openTabs.value[activeTabId.value]
    })

    function useCommandService(commandService: CommandService) {
        commandService.registerFeature(
            'tab_system',
            generate_tab_commands_factories(),
            TAB_HOTKEYS_MAP,
            'all'
        )
    }

    function setActiveTab(id: number) {
        if (activeTabId.value == id) return

        currentActiveTab.value.onInactive()

        console.log(id)

        activeTabId.value = id
        currentActiveTab.value.onActive()
    }
    function openTab(type: AppTabType, title?: string, data?: any) {
        let tab: AppTab
        let len = openTabs.value.length

        tab = new AppTab(len, title)
        tab.tabType = type
        tab.data = data

        openTabs.value.push(tab!)
    }
    function openEmptyTab() {
        openTab(AppTabType.Empty)
    }
    function closeTab(id: number) {
        let tab = openTabs.value[id]
        tab.onInactive()

        for (let i = id + 1; i < openTabs.value.length; i++) {
            const tab = openTabs.value[i]
            tab.id -= 1
        }

        tabHistory.value.push(tab)
        openTabs.value.splice(id, 1)

        activeTabId.value = Math.min(activeTabId.value, openTabs.value.length - 1)

        currentActiveTab.value.onActive()
    }
    function closeActiveTab() {
        closeTab(activeTabId.value)
    }
    function reopenTab() {
        let tab = tabHistory.value.pop()

        if (!tab) return

        tab.id = openTabs.value.length
        openTabs.value.push(tab)
    }

    return {
        openTabs,
        tabHistory,
        activeTabId,
        currentActiveTab,
        useCommandService,
        setActiveTab,
        openTab,
        openEmptyTab,
        closeTab,
        open,
        closeActiveTab,
        reopenTab
    }
})

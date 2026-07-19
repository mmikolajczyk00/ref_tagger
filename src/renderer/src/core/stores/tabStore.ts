import { defineStore } from 'pinia'

import { CommandService } from '@renderer/core/command_system/CommandService'
import {
    generate_tab_commands_factories,
    TAB_HOTKEYS_MAP
} from '@renderer/features/tab_system/commands/TabCmd'
import { AppTab, AppTabType } from '@renderer/features/tab_system/Tabs'

interface State {
    openTabs: Array<AppTab>
    tabHistory: Array<AppTab>
    activeTabId: number
}

export const useTabStore = defineStore('tabStore', {
    state: (): State => ({
        openTabs: [],
        tabHistory: [],
        activeTabId: 0
    }),

    getters: {
        getActiveTab: (state) => {
            return () => state.openTabs[state.activeTabId]
        }
    },

    actions: {
        useCommandService(commandService: CommandService) {
            commandService.registerFeature(
                'tab_system',
                generate_tab_commands_factories(this),
                TAB_HOTKEYS_MAP,
                'all'
            )
        },

        setActiveTab(id: number) {
            if (this.activeTabId == id) return

            this.getActiveTab().onInactive()
            this.activeTabId = id
            this.getActiveTab().onActive()
        },
        openTab(type: AppTabType, title?: string, data?: any) {
            let tab: AppTab
            let len = this.openTabs.length

            tab = new AppTab(len, title)
            tab.tabType = type
            tab.data = data

            this.openTabs.push(tab!)
        },
        openEmptyTab() {
            this.openTab(AppTabType.Empty)
        },
        closeTab(id: number) {
            let tab = this.openTabs[id]
            tab.onInactive()

            for (let i = id + 1; i < this.openTabs.length; i++) {
                const tab = this.openTabs[i]
                tab.id -= 1
            }

            this.tabHistory.push(tab)
            this.openTabs.splice(id, 1)

            this.activeTabId = Math.min(this.activeTabId, this.openTabs.length - 1)

            this.getActiveTab().onActive()
        },
        closeActiveTab() {
            this.closeTab(this.activeTabId)
        },
        reopenTab() {
            let tab = this.tabHistory.pop()

            if (!tab) return

            tab.id = this.openTabs.length
            this.openTabs.push(tab)
        }
    }
})

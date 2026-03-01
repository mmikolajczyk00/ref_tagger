import { CommandService } from '@renderer/core/command_system/CommandService'

import { generate_tab_commands_factories } from './commands/TabCmdRegistry'
import { TAB_HOTKEYS_MAP } from './commands/TabCmdRegistry'
import { AppTab, AppTabType, TagEditorTab, CanvasEditorTab, EmptyTab } from './Tabs'
import { reactive, ref } from 'vue'

class TabSystem {
  openTabs = ref<Array<AppTab>>([])
  tabHistory = ref<Array<AppTab>>([])
  activeTabId = ref<number>(0)

  constructor(commandService: CommandService) {
    commandService.registerFeature(
      'tab_system',
      generate_tab_commands_factories(this),
      TAB_HOTKEYS_MAP,
      'all'
    )

    this.openEmptyTab()
    this.openTab('canvas 1', AppTabType.Canvas)
    this.openTab('canvas 2', AppTabType.Canvas)
    this.openTab('tag editor', AppTabType.TagEditor)
  }

  setActiveTab(id: number) {
    this.activeTabId.value = id
  }

  openEmptyTab() {
    this.openTab('empty', AppTabType.Empty)
  }

  openTab(title: string, type: AppTabType) {
    let tab: AppTab
    let len = this.openTabs.value.length

    switch (type) {
      case AppTabType.Canvas:
        tab = new CanvasEditorTab(len, title)
        break
      case AppTabType.TagEditor:
        tab = new TagEditorTab(len, title)
        break
      default:
        tab = new EmptyTab(len, title)
        break
    }

    this.openTabs.value.push(tab!)
  }

  closeTab(id: number) {
    let tab = this.openTabs.value[id]

    for (let i = id + 1; i < this.openTabs.value.length; i++) {
      const tab = this.openTabs.value[i]
      tab.id -= 1
    }

    this.tabHistory.value.push(tab)
    this.openTabs.value.splice(id, 1)
  }

  closeActiveTab() {
    this.closeTab(this.activeTabId.value)
  }

  reopenTab() {
    let tab = this.tabHistory.value.pop()

    if (tab) this.openTabs.value.push(tab)
  }
}

export { TabSystem, AppTabType }

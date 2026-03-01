import { CommandMap } from '@renderer/core/command_system/CommandManager'
import * as TabCmd from './TabCmd'
import { HotkeysMap } from '@renderer/core/command_system/HotkeysManager'
import { TabSystem } from '../TabSystem'

export function generate_tab_commands_factories(tabSystem: TabSystem) {
  return new Map([
    [
      'tab_test',
      {
        factory: () => {
          return new TabCmd.TabTestCommand()
        },
        showInPalette: true
      }
    ],
    [
      'new_empty_tab',
      {
        factory: () => {
          return new TabCmd.OpenEmptyTabCommand(tabSystem)
        },
        showInPalette: true
      }
    ],
    [
      'close_active_tab',
      {
        factory: () => {
          return new TabCmd.CloseActiveTabCommand(tabSystem)
        },
        showInPalette: true
      }
    ],
    [
      'reopen_tab',
      {
        factory: () => {
          return new TabCmd.ReopenTabCommand(tabSystem)
        },
        showInPalette: true
      }
    ]
  ])
}
export const TAB_HOTKEYS_MAP: HotkeysMap = new Map([
  ['ctrl+t', 'new_empty_tab'],
  ['ctrl+shift+t', 'reopen_tab'],
  ['alt+w', 'close_active_tab']
])

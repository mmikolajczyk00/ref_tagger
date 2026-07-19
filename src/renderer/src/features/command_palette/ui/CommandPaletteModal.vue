<template>
  <div
    v-focustrap
    @keydown.down="changeFocus(1)"
    @keydown.up="changeFocus(-1)"
    class="absolute pointer-events-none w-screen h-screen flex items-center justify-center z-50"
    ref="palette"
    v-show="showPalette"
    @keydown.escape="paletteState.show.value = false"
  >
    <div
      class="gap-1 bg-zinc-900 p-2 flex flex-col items-center pointer-events-auto w-2/3 h-fit max-h-2/3 overflow-y-scroll"
    >
      <div class="w-full" v-for="scope in command_scopes" :key="scope[0]">
        <p class="text-muted-color p-2 border-b border-zinc-700">{{ scope[0] }}</p>
        <button
          class="hover:bg-zinc-600 cursor-pointer bg-zinc-800 w-full h-12 p-2 flex justify-between items-center"
          v-for="(map, j) in scope[1]"
          :key="map[0]"
          v-on:click="executeCommand(map[0])"
        >
          <div>
            {{ map[0] }}
          </div>
          <div class="text-muted-color bg-zinc-900 p-1 text-sm">ctrl + idk</div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  inject,
  onMounted,
  ref,
  triggerRef,
  useTemplateRef,
  watch,
  watchEffect
} from 'vue'
import { CommandService } from '../../../core/command_system/CommandService'
import { onClickOutside } from '@vueuse/core'
import {
  CMD_PALETTE_HOTKEYS_MAP,
  CommandPaletteState,
  generate_cmd_palette_commands_factories
} from '../commands/CmdPaletteRegistry'
import { autocompleteFilter } from '../../../core/utils/autocomplete'
import { CommandFactory } from '../../../core/command_system/CommandManager'

// commands
const commandService = inject('commandService') as CommandService
const command_scopes = computed(() => {
  return commandService.getShownInPalette()
})
function executeCommand(id: string) {
  commandService.execute(id)
  paletteState.show.value = false
}

// show / hide palette
const palette = useTemplateRef('palette')
const paletteState = new CommandPaletteState()
onClickOutside(palette, (event) => {
  paletteState.show.value = false
})
const showPalette = computed(() => paletteState.show.value)
watchEffect(() => {
  if (showPalette.value) {
    if (!palette.value) return
    const btns = Array.from(palette.value.querySelectorAll('button'))
    console.log(btns[0])

    // TODO: should focus search text-field
    requestAnimationFrame(() => {
      btns[0].focus()
    })
  }
})

// register commands
commandService.registerFeature(
  'command_palette',
  generate_cmd_palette_commands_factories(paletteState),
  CMD_PALETTE_HOTKEYS_MAP,
  'all'
)

// controls
let focusedId = ref(0)

function changeFocus(offset: number) {
  if (!palette.value || !document.activeElement) return

  const btns = Array.from(palette.value.querySelectorAll('button'))
  let current_focused_id = btns.indexOf(document.activeElement as HTMLButtonElement)

  if (current_focused_id != -1) {
    current_focused_id += offset
    if (current_focused_id < 0) current_focused_id = btns.length - 1
    current_focused_id = current_focused_id % btns.length

    focusedId.value = current_focused_id
    btns[current_focused_id].focus()
  }
}

// watchEffect(async () => {
//   if (!palette.value || !document.activeElement) return
//   const btns = Array.from(palette.value.querySelectorAll('button'))
//   let focused_id = btns.indexOf(document.activeElement as HTMLButtonElement)
//   if (focused_id) focusedId.value = focused_id
// })
</script>

<style scoped></style>

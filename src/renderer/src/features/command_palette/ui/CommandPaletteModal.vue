<template>
    <div
        v-show="showPalette"
        ref="palette"
        v-focustrap
        class="pointer-events-none absolute z-50 flex h-screen w-screen items-center justify-center"
        @keydown.down="changeFocus(1)"
        @keydown.up="changeFocus(-1)"
        @keydown.escape="paletteState.show.value = false"
    >
        <div
            class="pointer-events-auto flex h-fit max-h-2/3 w-2/3 flex-col items-center gap-1 overflow-y-scroll bg-zinc-900 p-2"
        >
            <div v-for="scope in command_scopes" :key="scope[0]" class="w-full">
                <p class="text-muted-color border-b border-zinc-700 p-2">{{ scope[0] }}</p>
                <button
                    v-for="map in scope[1]"
                    :key="map[0]"
                    class="flex h-12 w-full cursor-pointer items-center justify-between bg-zinc-800 p-2 hover:bg-zinc-600"
                    @click="executeCommand(map[0])"
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
import { computed, inject, ref, useTemplateRef, watchEffect } from 'vue'
import { CommandService } from '../../../core/command_system/CommandService'
import { onClickOutside } from '@vueuse/core'
import {
    CMD_PALETTE_HOTKEYS_MAP,
    CommandPaletteState,
    generate_cmd_palette_commands_factories
} from '../commands/CmdPaletteRegistry'

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
onClickOutside(palette, () => {
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

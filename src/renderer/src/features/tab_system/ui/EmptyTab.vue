<template>
    <div class="relative flex size-full items-center justify-center">
        <div class="flex flex-col gap-2">
            <Button
                outlined
                @click="
                    () => {
                        cmdService.execute(TAB_COMMANDS.CLOSE_ACTIVE_TAB)
                        cmdService.execute(TAB_COMMANDS.NEW_EXPLORER_TAB)
                    }
                "
                >Open Explorer</Button
            >
            <Button
                outlined
                @click="
                    () => {
                        cmdService.execute(TAB_COMMANDS.CLOSE_ACTIVE_TAB)
                        cmdService.execute(TAB_COMMANDS.NEW_TAG_EDITOR_TAB)
                    }
                "
                >Open Tag Editor</Button
            >
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { AppTabType } from '../Tabs'
import { CommandService } from '../../../core/command_system/CommandService'
import { TAB_COMMANDS } from '../commands/TabCmd'
const cmdService = inject('commandService') as CommandService
</script>

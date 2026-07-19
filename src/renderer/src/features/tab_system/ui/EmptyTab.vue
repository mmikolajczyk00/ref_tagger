<template>
    <div class="size-full relative flex items-center justify-center">
        <div class="flex flex-col gap-2">
            <Button outlined @click="open(AppTabType.Explorer)">Open Explorer</Button>
            <Button outlined @click="open(AppTabType.TagEditor)">Open Tag Editor</Button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { AppTabType } from '../Tabs'
import { CommandService } from '../../../core/command_system/CommandService'
import { TAB_COMMANDS } from '../commands/TabCmd'
const cmdService = inject('commandService') as CommandService

function open(tabType: AppTabType) {
    cmdService.execute(TAB_COMMANDS.NEW_EXPLORER_TAB)
    cmdService.execute(TAB_COMMANDS.CLOSE_ACTIVE_TAB)
}
</script>

<style scoped></style>

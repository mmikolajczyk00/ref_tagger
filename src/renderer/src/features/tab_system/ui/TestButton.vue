<template>
    <div class="m-auto w-fit border" @click="test">click</div>
</template>

<script setup lang="ts">
import { CommandService } from '@renderer/core/command_system/CommandService'
import { inject, onMounted } from 'vue'
import { TAB_COMMANDS } from '../commands/TabCmd'
const commandService = inject('commandService') as CommandService

onMounted(() => {})

function test() {
    commandService.execute(TAB_COMMANDS.TAB_TEST)
}
</script>

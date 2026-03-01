<template>
  <div class="m-auto border w-fit" @click="test">click</div>
</template>

<script setup lang="ts">
import { CommandService } from '@renderer/core/command_system/CommandService'
import { inject, onMounted } from 'vue'
import { TabSystem } from '../TabSystem'
const commandService = inject('commandService') as CommandService

onMounted(() => {})

function test() {
  commandService.execute('tab_test')
}
</script>

<style scoped></style>

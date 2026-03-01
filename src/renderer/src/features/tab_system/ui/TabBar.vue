<template>
  <div class="flex gap-1 justify-start w-fit relative pr-8 items-center">
    {{ tSys.tabHistory.length }}
    <div v-for="tab in tSys.openTabs" :key="tab.id">
      <div
        class="group min-w-24 p-1 max-w-44 cursor-pointer flex items-center relative"
        :class="[
          tab.id == tSys.activeTabId
            ? 'bg-zinc-700 hover:bg-zinc-600'
            : 'bg-zinc-900 hover:bg-zinc-800'
        ]"
        @click="clickTab(tab.id)"
      >
        <p class="select-none text-nowrap text-ellipsis overflow-hidden">{{ tab.title }}</p>

        <Button
          @click.stop="closeTab(tab.id)"
          class="group-hover:opacity-100 opacity-0 size-fit aspect-square p-1 absolute right-0"
          severity="secondary"
          icon="pi pi-times"
        />
      </div>
    </div>
    <Button
      @click.stop="newEmptyTab()"
      class="size-fit aspect-square p-1 absolute right-0"
      severity="secondary"
      icon="pi pi-plus"
    />
  </div>
</template>

<script setup lang="ts">
import { CommandService } from '@renderer/core/command_system/CommandService'
import { inject, onMounted, reactive, Ref, ref, watch } from 'vue'
import { TabSystem } from '../TabSystem'
import { AppTab } from '../Tabs'

const commandService = inject('commandService') as CommandService
let tabSystem = inject('tabSystem') as TabSystem
let tSys = ref(tabSystem) // so ts doesnt complainc

function clickTab(id: number) {
  tabSystem.setActiveTab(id)
}
function closeTab(id: number) {
  tabSystem.closeTab(id)
}
function newEmptyTab() {
  console.log('open_empty_tab')
  commandService.execute('new_empty_tab')
}
</script>

<style scoped></style>

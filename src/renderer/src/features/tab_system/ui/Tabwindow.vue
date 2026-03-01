<template>
  <div v-for="tab in tabSystem.openTabs" v-show="tab.id == tabSystem.activeTabId">
    <component :is="tabComponents[tab.tabType]" />
  </div>
</template>

<script setup lang="ts">
import { inject, reactive, ref } from 'vue'
import EmptyTab from './EmptyTab.vue'
import CanvasTab from '@renderer/features/canvas/ui/CanvasTab.vue'
import TagEditorTab from '@renderer/features/tab_editor/ui/TagEditorTab.vue'
const tabSystem = ref(inject<any>('tabSystem'))

const tabComponents = [EmptyTab, CanvasTab, TagEditorTab]
</script>

<style scoped></style>

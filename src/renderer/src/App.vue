<script setup lang="ts">
import { onMounted } from 'vue'
import CommandPaletteModal from './features/command_palette/ui/CommandPaletteModal.vue'
import TabBar from './features/tab_system/ui/TabBar.vue'
import Tabwindow from './features/tab_system/ui/Tabwindow.vue'
import DynamicDialog from 'primevue/dynamicdialog'
</script>

<template>
    <div class="select-none h-screen w-screen box-border m-0 p-0 flex flex-col overflow-hidden">
        <TabBar></TabBar>
        <Tabwindow></Tabwindow>
        <CommandPaletteModal></CommandPaletteModal>
        <DynamicDialog />
    </div>
</template>

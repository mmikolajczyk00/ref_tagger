<script setup lang="ts">
import TabBar from './features/tab_system/ui/TabBar.vue'
import Tabwindow from './features/tab_system/ui/Tabwindow.vue'
import DynamicDialog from 'primevue/dynamicdialog'
</script>

<template>
    <div class="m-0 box-border flex h-screen w-screen flex-col overflow-hidden p-0 select-none">
        <TabBar></TabBar>
        <Tabwindow></Tabwindow>
        <DynamicDialog />
    </div>
</template>

<script setup lang="ts">
import TabBar from './features/tab_system/ui/TabBar.vue'
import Tabwindow from './features/tab_system/ui/Tabwindow.vue'
</script>

<template>
  <div class="h-screen w-screen box-border m-0 p-0 flex flex-col">
    <TabBar></TabBar>
    <Tabwindow class="size-full"></Tabwindow>
  </div>
</template>

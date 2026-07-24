<template>
    <keep-alive :max="8">
        <component
            v-bind="tabStore.currentActiveTab.data"
            :is="AppTabComponents[tabStore.currentActiveTab.tabType]"
            :key="tabStore.activeTabId"
        />
    </keep-alive>
</template>

<script setup lang="ts">
import { AppTabComponents } from '../Tabs'
import { useTabStore } from '../../../core/stores/useTabStore'
const tabStore = useTabStore()
</script>

<style scoped></style>

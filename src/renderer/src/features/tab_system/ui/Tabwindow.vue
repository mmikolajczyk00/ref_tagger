<template>
    <keep-alive :max="8">
        <component
            v-bind="tabStore.currentActiveTab.data"
            :key="tabStore.activeTabId"
            :is="AppTabComponents[tabStore.currentActiveTab.tabType]"
        />
    </keep-alive>
</template>

<script setup lang="ts">
import { inject, KeepAlive } from 'vue'

import { AppTabComponents } from '../Tabs'
import { useTabStore } from '../../../core/stores/useTabStore'
const tabStore = useTabStore()
</script>

<style scoped></style>

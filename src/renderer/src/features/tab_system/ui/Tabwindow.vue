<template>
    <div
        class="relative h-1 flex-1"
        v-for="tab in tabStore.openTabs"
        v-show="tab.id == tabStore.activeTabId"
    >
        <component
            v-bind="tab.data"
            :active="tab.id == tabStore.activeTabId"
            :is="AppTabComponents[tab.tabType]"
        />
    </div>
</template>

<script setup lang="ts">
import { inject } from 'vue'

import { AppTabComponents } from '../Tabs'
import { useTabStore } from '@renderer/core/stores/tabStore'
const tabStore = useTabStore()
</script>

<style scoped></style>

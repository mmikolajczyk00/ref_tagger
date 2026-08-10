<template>
    <keep-alive :max="8">
        <component
            v-bind="tabStore.currentActiveTab.data"
            :is="AppTabComponents[tabStore.currentActiveTab.type]"
            :key="tabStore.currentActiveTab.id"
            class="min-h-0 flex-1 overflow-hidden"
        />
    </keep-alive>
</template>

<script setup lang="ts">
import { AppTabComponents } from '../Tabs'
import { useTabStore } from '../../../core/stores/useTabStore'
const tabStore = useTabStore()
</script>

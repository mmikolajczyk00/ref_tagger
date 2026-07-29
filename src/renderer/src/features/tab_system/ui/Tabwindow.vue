<template>
    <keep-alive :max="8">
        <component
            v-bind="tabStore.currentActiveTab.data"
            :is="AppTabComponents[tabStore.currentActiveTab.type]"
            :key="tabStore.currentActiveTab.id"
        />
    </keep-alive>
</template>

<script setup lang="ts">
import { AppTabComponents } from '../Tabs'
import { useTabStore } from '../../../core/stores/useTabStore'
import { watchEffect } from 'vue'
const tabStore = useTabStore()

watchEffect(() => {
    console.log(tabStore, tabStore.currentActiveTab.id)
})
</script>

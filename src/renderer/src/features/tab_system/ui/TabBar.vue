<template>
    <div class="relative flex w-fit items-center justify-start gap-1 pr-8">
        <Button
            class="aspect-square size-fit p-1"
            severity="secondary"
            aria-label="Open settings"
            @click="settings.settingsOpen = true"
        >
            <span class="material-symbols-outlined">settings</span>
        </Button>

        <div v-for="(tab, index) in tabStore.openTabs" :key="tab.id">
            <div
                class="group relative flex max-w-44 min-w-24 cursor-pointer items-center p-1"
                :class="[
                    index == tabStore.activeTabIndex
                        ? 'bg-surface-200 dark:bg-surface-700 text-surface-950 dark:text-surface-0 hover:bg-surface-300 dark:hover:bg-surface-600'
                        : 'bg-surface-0 dark:bg-surface-950 text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-950 dark:hover:text-surface-0'
                ]"
                @click="clickTab(index)"
            >
                <span class="material-symbols-outlined mr-2">{{ AppTabIcons[tab.type] }}</span>
                <p class="overflow-hidden text-nowrap text-ellipsis select-none">
                    {{ tabDisplayTitle(tab) }}
                </p>

                <Button
                    class="absolute right-0 aspect-square size-fit p-1 opacity-0 group-hover:opacity-100"
                    severity="secondary"
                    icon="pi pi-times"
                    @click.stop="closeTab(index)"
                />
            </div>
        </div>

        <div
            v-if="taskStore.hasRunningTasks"
            class="absolute right-8 flex items-center"
            @mouseenter="showTasks"
            @mouseleave="hideTasks"
        >
            <ProgressSpinner class="h-4 w-4" :stroke-width="6" />
        </div>

        <Button
            class="absolute right-0 aspect-square size-fit p-1"
            severity="secondary"
            icon="pi pi-plus"
            @click.stop="newEmptyTab()"
        />

        <Popover
            ref="tasksPopover"
            class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 rounded-lg border p-3 shadow-lg"
        >
            <div class="flex min-w-56 flex-col gap-2">
                <p v-if="taskStore.tasks.length === 0" class="text-surface-400 text-xs">
                    No active tasks.
                </p>
                <div v-for="task in taskStore.tasks" :key="task.id" class="flex flex-col gap-1">
                    <div class="flex items-center gap-2 text-sm">
                        <span
                            class="material-symbols-outlined text-base"
                            :class="
                                task.status === 'done'
                                    ? 'text-green-500'
                                    : task.status === 'error'
                                      ? 'text-red-500'
                                      : 'text-surface-400'
                            "
                        >
                            {{ statusIcon(task.status) }}
                        </span>
                        <span>{{ task.label }}</span>
                        <span class="text-surface-400 ml-auto text-xs">
                            {{ Math.round(task.percentage) }}%
                        </span>
                    </div>
                    <ProgressBar v-if="task.status === 'running'" :value="task.percentage" />
                    <p v-if="task.error" class="text-xs text-red-500">{{ task.error }}</p>
                    <p v-if="task.warning" class="text-xs text-amber-500">{{ task.warning }}</p>
                </div>
            </div>
        </Popover>
    </div>
</template>

<script setup lang="ts">
import { inject, useTemplateRef } from 'vue'
import { AppTabIcons, AppTab, AppTabType } from '../Tabs'
import { TAB_COMMANDS } from '../commands/TabCmd'
import { CommandService } from '../../../core/command_system/CommandService'
import { useTabStore } from '../../../core/stores/useTabStore'
import { useCanvasStore } from '../../canvas/ts/useCanvasStore'
import { useSettingsStore } from '../../../core/stores/useSettingsStore'
import { useTaskStore } from '../../../core/stores/useTaskStore'

const commandService = inject('commandService') as CommandService
let tabStore = useTabStore()
let canvasStore = useCanvasStore()
const settings = useSettingsStore()
const taskStore = useTaskStore()

const tasksPopover = useTemplateRef('tasksPopover')

function clickTab(index: number) {
    tabStore.setActiveTab(index)
}
function closeTab(id: number) {
    tabStore.closeTab(id)
}
function newEmptyTab() {
    commandService.execute(TAB_COMMANDS.NEW_EMPTY_TAB)
}

function tabDisplayTitle(tab: AppTab): string {
    if (tab.type === AppTabType.Canvas && !canvasStore.isSaved(tab.data.canvasId)) {
        return '* ' + tab.title
    }
    return tab.title
}

function showTasks(e: Event) {
    tasksPopover.value?.show(e)
}
function hideTasks() {
    tasksPopover.value?.hide()
}
function statusIcon(status: string): string {
    if (status === 'done') return 'check_circle'
    if (status === 'error') return 'error'
    return 'hourglass_top'
}
</script>

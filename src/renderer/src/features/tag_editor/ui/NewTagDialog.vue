<script setup lang="ts">
import { ref, inject } from 'vue'

const dialogRef = inject<any>('dialogRef')

const tagName = ref('')
const tagColor = ref('#808080')

const nameInput = ref()

function onSubmit() {
    const name = tagName.value.trim()
    if (!name) return
    dialogRef?.value?.close({ name, color: tagColor.value })
}

function onCancel() {
    dialogRef?.value?.close()
}
</script>

<template>
    <Dialog
        :visible="true"
        modal
        header="New Tag"
        :style="{ width: '24rem' }"
        :closable="false"
        @hide="onCancel"
    >
        <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
                <label class="text-surface-400 text-sm">Name</label>
                <InputText
                    ref="nameInput"
                    v-model="tagName"
                    autofocus
                    placeholder="Tag name"
                    @keydown.enter="onSubmit"
                />
            </div>
            <div class="flex flex-col gap-2">
                <label class="text-surface-400 text-sm">Color</label>
                <div class="flex items-center gap-2">
                    <InputText
                        v-model="tagColor"
                        placeholder="#808080"
                        class="w-full"
                        @keydown.enter="onSubmit"
                    />
                    <span
                        class="ring-surface-300 dark:ring-surface-600 size-8 shrink-0 rounded ring-1"
                        :style="{ backgroundColor: tagColor }"
                    />
                </div>
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" severity="secondary" size="small" @click="onCancel" />
            <Button label="Create" size="small" @click="onSubmit" />
        </template>
    </Dialog>
</template>

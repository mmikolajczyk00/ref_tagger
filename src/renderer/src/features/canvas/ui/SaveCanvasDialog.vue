<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { CANVAS_NAME_MAX_LENGTH, validateCanvasName } from '../ts/validateCanvasName'

const dialogRef = inject<any>('dialogRef')

const existingNames: Set<string> = new Set(dialogRef?.value?.data?.existingNames ?? [])
const initialName: string = dialogRef?.value?.data?.initialName ?? 'Untitled canvas'

const name = ref(initialName)
const nameInput = ref()

const validationResult = computed(() => validateCanvasName(name.value, existingNames))

const canSubmit = computed(() => validationResult.value.valid)

function onSubmit() {
    const result = validationResult.value
    if (!result.valid) return
    dialogRef?.value?.close({ name: result.name })
}

function onCancel() {
    dialogRef?.value?.close()
}
</script>

<template>
    <Dialog
        :visible="true"
        modal
        header="Save Canvas"
        :style="{ width: '24rem' }"
        :closable="false"
        @hide="onCancel"
    >
        <div class="flex flex-col gap-2">
            <label class="text-surface-400 text-sm">Name</label>
            <InputText
                ref="nameInput"
                v-model="name"
                autofocus
                placeholder="Canvas name"
                :maxlength="CANVAS_NAME_MAX_LENGTH"
                @keydown.enter="onSubmit"
            />
            <div
                v-if="!validationResult.valid"
                class="text-red-500 text-xs"
            >
                {{ validationResult.message }}
            </div>
            <div class="text-surface-500 text-xs">
                {{ name.trim().length }} / {{ CANVAS_NAME_MAX_LENGTH }}
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" severity="secondary" size="small" @click="onCancel" />
            <Button label="Save" size="small" :disabled="!canSubmit" @click="onSubmit" />
        </template>
    </Dialog>
</template>

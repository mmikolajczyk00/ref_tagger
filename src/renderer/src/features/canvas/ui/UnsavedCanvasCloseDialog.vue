<script setup lang="ts">
import { inject } from 'vue'

const dialogRef = inject<any>('dialogRef')

const canvasName: string = dialogRef?.value?.data?.canvasName ?? 'Untitled canvas'
let done = false

function onAction(action: 'save' | 'discard' | 'cancel') {
    if (done) return
    done = true
    dialogRef?.value?.close({ action })
}
</script>

<template>
    <Dialog
        :visible="true"
        modal
        header="Unsaved changes"
        :style="{ width: '24rem' }"
        :closable="true"
        @hide="onAction('cancel')"
    >
        <p class="m-0">Canvas &quot;{{ canvasName }}&quot; has unsaved changes.</p>
        <template #footer>
            <Button label="Cancel" severity="secondary" size="small" @click="onAction('cancel')" />
            <Button
                label="Discard & Close"
                severity="danger"
                size="small"
                @click="onAction('discard')"
            />
            <Button label="Save & Close" size="small" @click="onAction('save')" />
        </template>
    </Dialog>
</template>

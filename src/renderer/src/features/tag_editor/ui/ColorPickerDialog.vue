<script setup lang="ts">
import { ref, inject, onMounted } from 'vue'
import { PREMADE_COLORS } from '@renderer/core/theme/colors'
import InputColor from 'primevue/inputcolor'

const dialogRef = inject<any>('dialogRef')

const initialColor = (dialogRef?.value?.data?.currentColor as string) || '#FFF'
const selectedColor = ref(initialColor)
const dbColors = ref<string[]>([])
const isLoading = ref(false)

onMounted(async () => {
    isLoading.value = true
    const res = await window.api.tags.getAllColors()
    if (res.success) {
        const premadeLower = new Set(PREMADE_COLORS.map((c) => c.toLowerCase()))
        dbColors.value = res.data.filter((c) => !premadeLower.has(c.toLowerCase()))
    }
    isLoading.value = false
})

function selectColor(color: string) {
    selectedColor.value = color
}

function onApply() {
    dialogRef?.value?.close(selectedColor.value)
}

function onCancel() {
    dialogRef?.value?.close()
}
</script>

<template>
    <Dialog
        :visible="true"
        modal
        header="Pick Color"
        :style="{ width: '40rem' }"
        :closable="false"
        @hide="onCancel"
    >
        <div class="flex flex-row gap-6">
            <div class="shrink-0">
                <InputColor v-model="selectedColor" :format="'hex'">
                    <div class="flex flex-col gap-2 p-2">
                        <InputColorArea>
                            <InputColorAreaBackground />
                            <InputColorAreaHandle />
                        </InputColorArea>
                        <InputColorSlider>
                            <InputColorTransparencyGrid />
                            <InputColorSliderTrack />
                            <InputColorSliderHandle />
                        </InputColorSlider>
                        <div class="flex flex-row gap-2">
                            <InputColorSwatch>
                                <InputColorTransparencyGrid />
                                <InputColorSwatchBackground />
                            </InputColorSwatch>
                            <InputColorInput channel="hex" />
                        </div>
                    </div>
                </InputColor>
            </div>
            <div class="flex flex-1 flex-col gap-4 p-2">
                <div>
                    <p class="text-surface-400 mb-2 text-xs font-medium uppercase">Premade</p>
                    <div class="flex flex-wrap gap-1.5 p-1">
                        <button
                            v-for="color in PREMADE_COLORS"
                            :key="color"
                            class="h-7 w-7 cursor-pointer rounded-sm border-0 transition-[filter,box-shadow] duration-150 hover:brightness-110 hover:contrast-125"
                            :class="{
                                'ring-primary ring-2 ring-offset-1': selectedColor === color
                            }"
                            :style="{ backgroundColor: color }"
                            :title="color"
                            @click="selectColor(color)"
                        />
                    </div>
                </div>
                <Divider />
                <div class="flex flex-1 flex-col overflow-hidden">
                    <p class="text-surface-400 mb-2 text-xs font-medium uppercase">From tags</p>
                    <div class="max-h-36 overflow-y-auto">
                        <div v-if="isLoading" class="text-surface-400 py-4 text-center text-sm">
                            Loading...
                        </div>
                        <div
                            v-else-if="dbColors.length === 0"
                            class="text-surface-400 py-4 text-center text-sm"
                        >
                            No custom colors
                        </div>
                        <div v-else class="flex flex-wrap gap-1.5 p-1">
                            <button
                                v-for="color in dbColors"
                                :key="color"
                                class="h-7 w-7 cursor-pointer rounded-sm border-0 transition-[filter,box-shadow] duration-150 hover:brightness-110 hover:contrast-125"
                                :class="{
                                    'ring-primary ring-2 ring-offset-1': selectedColor === color
                                }"
                                :style="{ backgroundColor: color }"
                                :title="color"
                                @click="selectColor(color)"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <template #footer>
            <Button label="Cancel" severity="secondary" size="small" @click="onCancel" />
            <Button
                label="Apply"
                size="small"
                :disabled="selectedColor === initialColor"
                @click="onApply"
            />
        </template>
    </Dialog>
</template>

<style scoped></style>

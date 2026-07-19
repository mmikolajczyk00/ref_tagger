<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'

defineEmits(['change'])

interface Option {
    label: string
    value: string
    outlined: boolean
}

const props = defineProps<{
    options: Option[]
    alwaysShow?: boolean
    outlined?: boolean
}>()

const focused = ref(false)

const activeOption = defineModel<Option>()

const popup = useTemplateRef('popup')
const mainBtn = useTemplateRef('mainBtn')

watch(focused, () => {
    popup.value!.style.top = mainBtn.value?.offsetHeight + 'px'
})

defineExpose({
    focused
})
</script>

<template>
    <div class="border-red relative z-0 flex flex-col gap-1">
        <button
            ref="mainBtn"
            :class="[
                outlined ? 'border-surface-500 border' : 'bg-surface-300 text-surface-800',
                'z-5 squish h-full cursor-pointer rounded-xl p-2 text-center'
            ]"
            @click="focused = !focused"
        >
            {{ activeOption?.label }}
        </button>
        <transition name="slide-fade">
            <div
                v-show="alwaysShow || focused"
                ref="popup"
                :class="[
                    outlined ? 'border-surface-700 border' : 'bg-surface-900',
                    'text-surface-300 absolute mt-1 flex w-full flex-col gap-2 rounded-xl p-2'
                ]"
            >
                <button
                    @click="
                        () => {
                            if (activeOption == option) return
                            activeOption = option
                            focused = false
                            $emit('change', option)
                        }
                    "
                    v-for="option in options"
                    :disabled="option.value == activeOption?.value"
                    :class="[
                        option.value == activeOption?.value
                            ? 'bg-transparent opacity-50'
                            : 'squish hover:bg-surface-700 cursor-pointer',
                        outlined ? 'border-surface-700 border' : 'bg-surface-800',
                        'rounded-xl p-2 text-center'
                    ]"
                >
                    {{ option.label }}
                </button>
            </div>
        </transition>
    </div>
</template>

<style scoped>
.slide-fade-enter-active {
    transition: all 0.05s ease-out;
}

.slide-fade-leave-active {
    transition: all 0.05s ease-out;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
    transform: translateY(-40px);
    opacity: 0;
}
</style>

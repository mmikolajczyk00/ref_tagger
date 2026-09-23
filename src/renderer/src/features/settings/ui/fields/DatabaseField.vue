<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useTaskStore } from '@renderer/core/stores/useTaskStore'
import type { BackupDomain, BackupManifest } from '@shared/types/models'

const taskStore = useTaskStore()
const confirm = useConfirm()
const toast = useToast()

const ALL_DOMAINS: BackupDomain[] = [
    'files',
    'tags',
    'file_tags',
    'canvases',
    'blacklists',
    'aliases'
]

const DOMAIN_LABELS: Record<BackupDomain, string> = {
    files: 'Files',
    tags: 'Tags',
    file_tags: 'File ↔ Tag links',
    canvases: 'Canvases',
    blacklists: 'Blacklists',
    aliases: 'Aliases'
}

const DOMAIN_HINTS: Partial<Record<BackupDomain, string>> = {
    file_tags: '└ requires files and tags',
    canvases: '└ elements referencing files not in the backup will be empty'
}

const saveDomains = ref<BackupDomain[]>([...ALL_DOMAINS])
const mode = ref<'replace' | 'append'>('replace')
const manifest = ref<BackupManifest | null>(null)
const appendDomains = ref<BackupDomain[]>([])
const skipSameSourceUrl = ref(false)
const skipSameName = ref(false)

const modeOptions = [
    { label: 'Replace', value: 'replace' },
    { label: 'Append', value: 'append' }
]

const manifestDomainSet = computed(() => new Set(manifest.value?.domains ?? []))
const showSkipSourceUrl = computed(
    () => mode.value === 'append' && appendDomains.value.includes('files')
)
const showSkipName = computed(
    () =>
        mode.value === 'append' &&
        (appendDomains.value.includes('canvases') ||
            appendDomains.value.includes('blacklists') ||
            appendDomains.value.includes('aliases'))
)

function toggleDomain(
    domain: BackupDomain,
    checked: boolean,
    list: BackupDomain[]
): BackupDomain[] {
    const set = new Set(list)
    if (checked) {
        set.add(domain)
        if (domain === 'file_tags') {
            set.add('files')
            set.add('tags')
        }
        if (domain === 'canvases') set.add('files')
        if (domain === 'aliases') set.add('tags')
    } else {
        set.delete(domain)
        if (domain === 'files') {
            set.delete('file_tags')
            set.delete('canvases')
        }
        if (domain === 'tags') {
            set.delete('file_tags')
            set.delete('aliases')
        }
    }
    return ALL_DOMAINS.filter((d) => set.has(d))
}

function onSaveToggle(domain: BackupDomain, checked: boolean) {
    saveDomains.value = toggleDomain(domain, checked, saveDomains.value)
}

function onAppendToggle(domain: BackupDomain, checked: boolean) {
    appendDomains.value = toggleDomain(domain, checked, appendDomains.value)
}

async function saveBackup() {
    const res = await window.api.backup.save({ domains: [...saveDomains.value] })
    if (!res.success) {
        toast.add({ severity: 'error', summary: 'Save failed', detail: res.error, life: 6000 })
    }
}

async function chooseBackup() {
    const res = await window.api.backup.inspect()
    if (!res.success) {
        toast.add({
            severity: 'error',
            summary: 'Could not open backup',
            detail: res.error,
            life: 6000
        })
        return
    }
    if (res.data.manifest === null) {
        manifest.value = null
        appendDomains.value = []
        return
    }
    manifest.value = res.data.manifest
    appendDomains.value = [...res.data.manifest.domains]
}

async function loadAppend() {
    const res = await window.api.backup.load({
        mode: 'append',
        domains: [...appendDomains.value],
        skipSameSourceUrl: skipSameSourceUrl.value,
        skipSameName: skipSameName.value
    })
    if (!res.success) {
        toast.add({ severity: 'error', summary: 'Load failed', detail: res.error, life: 6000 })
        return
    }
    location.reload()
}

function confirmReplace() {
    if (!manifest.value) return
    const missing = ALL_DOMAINS.filter((d) => !manifest.value!.domains.includes(d))
    const missingText = missing.length
        ? `The following data will be deleted: ${missing.map((d) => DOMAIN_LABELS[d]).join(', ')}. `
        : ''
    confirm.require({
        header: 'Replace database?',
        message: `${missingText}This replaces the entire database with the contents of the backup. Continue?`,
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
            void doReplace()
        }
    })
}

async function doReplace() {
    if (!manifest.value) return
    const res = await window.api.backup.load({
        mode: 'replace',
        domains: [...manifest.value.domains],
        skipSameSourceUrl: false,
        skipSameName: false
    })
    if (!res.success) {
        toast.add({ severity: 'error', summary: 'Load failed', detail: res.error, life: 6000 })
        return
    }
    location.reload()
}

function confirmPurge() {
    confirm.require({
        header: 'Purge database?',
        message:
            'This permanently deletes ALL data: files, tags, canvases, blacklists, aliases, and their files on disk. This cannot be undone.',
        icon: 'pi pi-exclamation-triangle',
        accept: () => {
            void doPurge()
        }
    })
}

async function doPurge() {
    const res = await window.api.backup.purge()
    if (!res.success) {
        toast.add({ severity: 'error', summary: 'Purge failed', detail: res.error, life: 6000 })
        return
    }
    location.reload()
}
</script>

<template>
    <div class="flex flex-col gap-8 p-6">
        <!-- Save -->
        <section>
            <h2 class="text-surface-700 dark:text-surface-200 mb-3 text-sm font-semibold uppercase">
                Save backup
            </h2>
            <div class="flex flex-col gap-1">
                <div v-for="d in ALL_DOMAINS" :key="d" class="flex flex-wrap items-center gap-2">
                    <Checkbox
                        :input-id="`save-${d}`"
                        :binary="true"
                        :model-value="saveDomains.includes(d)"
                        @update:model-value="(v: boolean) => onSaveToggle(d, v)"
                    />
                    <label :for="`save-${d}`" class="text-sm">{{ DOMAIN_LABELS[d] }}</label>
                    <span v-if="DOMAIN_HINTS[d]" class="text-surface-400 w-full text-xs">
                        {{ DOMAIN_HINTS[d] }}
                    </span>
                </div>
            </div>
            <Button
                label="Save Backup"
                icon="pi pi-download"
                class="mt-3"
                :disabled="taskStore.isLocked"
                @click="saveBackup"
            />
        </section>

        <!-- Load -->
        <section>
            <h2 class="text-surface-700 dark:text-surface-200 mb-3 text-sm font-semibold uppercase">
                Load backup
            </h2>
            <SelectButton
                v-model="mode"
                :options="modeOptions"
                option-label="label"
                option-value="value"
            />
            <div class="mt-3">
                <Button
                    label="Choose backup…"
                    icon="pi pi-folder-open"
                    severity="secondary"
                    @click="chooseBackup"
                />
            </div>

            <div v-if="manifest" class="mt-3">
                <p class="text-surface-500 mb-1 text-xs uppercase">Backup contents</p>
                <div class="flex flex-wrap gap-1">
                    <Chip
                        v-for="d in manifest.domains"
                        :key="d"
                        :label="DOMAIN_LABELS[d]"
                        class="text-xs"
                    />
                </div>
            </div>

            <template v-if="mode === 'append' && manifest">
                <div class="mt-3 flex flex-col gap-1">
                    <div
                        v-for="d in ALL_DOMAINS"
                        :key="d"
                        class="flex flex-wrap items-center gap-2"
                    >
                        <Checkbox
                            :input-id="`append-${d}`"
                            :binary="true"
                            :model-value="appendDomains.includes(d)"
                            :disabled="!manifestDomainSet.has(d)"
                            @update:model-value="(v: boolean) => onAppendToggle(d, v)"
                        />
                        <label
                            :for="`append-${d}`"
                            class="text-sm"
                            :class="{ 'text-surface-400': !manifestDomainSet.has(d) }"
                        >
                            {{ DOMAIN_LABELS[d] }}
                        </label>
                    </div>
                </div>
                <div class="mt-2 flex flex-col gap-1">
                    <div v-if="showSkipSourceUrl" class="flex items-center gap-2">
                        <Checkbox v-model="skipSameSourceUrl" :binary="true" input-id="skip-source-url" />
                        <label for="skip-source-url" class="text-sm">
                            Skip if source_url matches
                        </label>
                    </div>
                    <div v-if="showSkipName" class="flex items-center gap-2">
                        <Checkbox v-model="skipSameName" :binary="true" input-id="skip-name" />
                        <label for="skip-name" class="text-sm">Skip if name matches</label>
                    </div>
                </div>
            </template>

            <div v-if="manifest" class="mt-3">
                <Button
                    label="Load Backup"
                    icon="pi pi-upload"
                    :disabled="taskStore.isLocked"
                    @click="mode === 'replace' ? confirmReplace() : loadAppend()"
                />
            </div>
        </section>

        <!-- Purge -->
        <section>
            <h2 class="text-surface-700 dark:text-surface-200 mb-3 text-sm font-semibold uppercase">
                Danger zone
            </h2>
            <Button
                label="Purge database"
                icon="pi pi-trash"
                severity="danger"
                :disabled="taskStore.isLocked"
                @click="confirmPurge"
            />
        </section>
    </div>
</template>

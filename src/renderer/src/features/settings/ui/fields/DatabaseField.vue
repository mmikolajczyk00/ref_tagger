<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useTaskStore } from '@renderer/core/stores/useTaskStore'
import type {
    AliasConflict,
    BackupDomain,
    BackupManifest,
    BlacklistConflict,
    CanvasConflict,
    FileConflict
} from '@shared/types/models'

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

const ROW_TOOLTIPS: Partial<Record<BackupDomain, string>> = {
    files: 'Conflict = same non-null source_url on a live (non-deleted) file. Local uploads keep the path they were picked from, so a backup from the same machine can match.',
    tags: 'Replace if exists overwrites the tag color and its parent/child relations from the backup. Neighbouring tags can lose an edge to a replaced tag.',
    file_tags:
        'Only imports links belonging to newly added files. Tags resolve by name and are never created — unmatched links are dropped.',
    canvases:
        'Conflict = same name. Replace keeps the id/name and overwrites the scene; media elements whose file is not imported are dropped.',
    blacklists: 'Conflict = same list_name.',
    aliases: 'Conflict = same real_tag.'
}

const FILE_CONFLICT_OPTIONS: Array<{ label: string; value: FileConflict }> = [
    { label: 'Skip', value: 'skip' },
    { label: 'Merge tags', value: 'merge-tags' },
    { label: 'Replace', value: 'replace' }
]

const CANVAS_CONFLICT_OPTIONS: Array<{ label: string; value: CanvasConflict }> = [
    { label: 'Skip', value: 'skip' },
    { label: 'Rename', value: 'rename' },
    { label: 'Replace', value: 'replace' }
]

const BLACKLIST_CONFLICT_OPTIONS: Array<{ label: string; value: BlacklistConflict }> = [
    { label: 'Skip', value: 'skip' },
    { label: 'Rename', value: 'rename' },
    { label: 'Merge tags', value: 'merge-tags' },
    { label: 'Replace', value: 'replace' }
]

const ALIAS_CONFLICT_OPTIONS: Array<{ label: string; value: AliasConflict }> = [
    { label: 'Skip', value: 'skip' },
    { label: 'Merge tags', value: 'merge-tags' },
    { label: 'Replace', value: 'replace' }
]

const saveDomains = ref<BackupDomain[]>([...ALL_DOMAINS])
const mode = ref<'replace' | 'advanced'>('replace')
const manifest = ref<BackupManifest | null>(null)

// Advanced per-domain settings
const addFiles = ref(true)
const fileConflict = ref<FileConflict>('skip')
const addTags = ref(true)
const replaceTags = ref(false)
const importFileLinks = ref(true)
const addCanvases = ref(true)
const canvasConflict = ref<CanvasConflict>('skip')
const addBlacklists = ref(true)
const blacklistConflict = ref<BlacklistConflict>('skip')
const addAliases = ref(true)
const aliasConflict = ref<AliasConflict>('skip')

const modeOptions = [
    { label: 'Replace', value: 'replace' },
    { label: 'Advanced', value: 'advanced' }
]

const manifestDomainSet = computed(() => new Set(manifest.value?.domains ?? []))
const manifestDomains = computed(() => [...(manifest.value?.domains ?? [])])

function domainInManifest(domain: BackupDomain): boolean {
    return manifestDomainSet.value.has(domain)
}

// File ↔ Tag links is only meaningful while new files are being imported
const linksRowDisabled = computed(() => !domainInManifest('file_tags') || !addFiles.value)

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
        return
    }
    manifest.value = res.data.manifest
}

async function loadAdvanced() {
    if (!manifest.value) return
    const res = await window.api.backup.load({
        mode: 'advanced',
        domains: manifestDomains.value,
        addFiles: addFiles.value,
        fileConflict: fileConflict.value,
        addTags: addTags.value,
        replaceTags: replaceTags.value,
        importFileLinks: importFileLinks.value,
        addCanvases: addCanvases.value,
        canvasConflict: canvasConflict.value,
        addBlacklists: addBlacklists.value,
        blacklistConflict: blacklistConflict.value,
        addAliases: addAliases.value,
        aliasConflict: aliasConflict.value
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
        domains: manifestDomains.value,
        addFiles: true,
        fileConflict: 'skip',
        addTags: true,
        replaceTags: false,
        importFileLinks: true,
        addCanvases: true,
        canvasConflict: 'skip',
        addBlacklists: true,
        blacklistConflict: 'skip',
        addAliases: true,
        aliasConflict: 'skip'
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

// ---- Advanced import help popover -----------------------------------------

const helpPopover = useTemplateRef('helpPopover')

function showHelp(e: Event) {
    helpPopover.value?.show(e)
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

            <template v-if="mode === 'advanced' && manifest">
                <div class="mt-4 flex items-center gap-2">
                    <h3 class="text-surface-700 dark:text-surface-200 text-sm font-semibold">
                        Advanced import
                    </h3>
                    <Button
                        type="button"
                        icon="pi pi-question-circle"
                        text
                        rounded
                        size="small"
                        aria-label="Advanced import help"
                        @click="showHelp"
                    />
                </div>

                <div
                    class="border-surface-200 dark:border-surface-800 mt-2 overflow-x-auto rounded-lg border"
                >
                    <div class="grid min-w-[640px] grid-cols-[150px_1fr_1.4fr]">
                        <div
                            class="bg-surface-100 text-surface-500 dark:bg-surface-800/70 px-3 py-2 text-xs font-semibold tracking-wide uppercase"
                        >
                            Data type
                        </div>
                        <div
                            class="bg-surface-100 text-surface-500 dark:bg-surface-800/70 px-3 py-2 text-xs font-semibold tracking-wide uppercase"
                        >
                            Add if doesn't exist
                        </div>
                        <div
                            class="bg-surface-100 text-surface-500 dark:bg-surface-800/70 px-3 py-2 text-xs font-semibold tracking-wide uppercase"
                        >
                            On conflict
                        </div>

                        <!-- Files -->
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2 text-sm"
                            :class="{
                                'opacity-50': !domainInManifest('files'),
                                'text-surface-400': !domainInManifest('files')
                            }"
                        >
                            <span :title="ROW_TOOLTIPS.files">{{ DOMAIN_LABELS.files }}</span>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center gap-2 border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('files') }"
                        >
                            <Checkbox
                                v-model="addFiles"
                                :binary="true"
                                input-id="adv-add-files"
                                :disabled="!domainInManifest('files')"
                            />
                            <label for="adv-add-files" class="text-sm">import new files</label>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('files') }"
                        >
                            <SelectButton
                                v-model="fileConflict"
                                :options="FILE_CONFLICT_OPTIONS"
                                option-label="label"
                                option-value="value"
                                :disabled="!domainInManifest('files')"
                                class="text-xs"
                            />
                        </div>

                        <!-- Tags -->
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2 text-sm"
                            :class="{
                                'opacity-50': !domainInManifest('tags'),
                                'text-surface-400': !domainInManifest('tags')
                            }"
                        >
                            <span :title="ROW_TOOLTIPS.tags">{{ DOMAIN_LABELS.tags }}</span>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center gap-2 border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('tags') }"
                        >
                            <Checkbox
                                v-model="addTags"
                                :binary="true"
                                input-id="adv-add-tags"
                                :disabled="!domainInManifest('tags')"
                            />
                            <label for="adv-add-tags" class="text-sm">import new tags</label>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center gap-2 border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('tags') }"
                        >
                            <Checkbox
                                v-model="replaceTags"
                                :binary="true"
                                input-id="adv-replace-tags"
                                :disabled="!domainInManifest('tags')"
                            />
                            <label for="adv-replace-tags" class="text-sm">Replace if exists</label>
                        </div>

                        <!-- File ↔ Tag links -->
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2 text-sm"
                            :class="{
                                'opacity-50': linksRowDisabled,
                                'text-surface-400': linksRowDisabled
                            }"
                        >
                            <span :title="ROW_TOOLTIPS.file_tags">
                                {{ DOMAIN_LABELS.file_tags }}
                            </span>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center gap-2 border-t px-3 py-2"
                            :class="{ 'opacity-50': linksRowDisabled }"
                        >
                            <Checkbox
                                v-model="importFileLinks"
                                :binary="true"
                                input-id="adv-add-links"
                                :disabled="!addFiles || !domainInManifest('file_tags')"
                            />
                            <label
                                v-if="domainInManifest('file_tags')"
                                for="adv-add-links"
                                class="text-sm"
                            >
                                links of new files
                            </label>
                            <span v-else class="text-sm">not in backup</span>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2 text-sm"
                            :class="{ 'opacity-50': linksRowDisabled }"
                        >
                            <span class="text-surface-400">— handled by Files</span>
                        </div>

                        <!-- Canvases -->
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2 text-sm"
                            :class="{
                                'opacity-50': !domainInManifest('canvases'),
                                'text-surface-400': !domainInManifest('canvases')
                            }"
                        >
                            <span :title="ROW_TOOLTIPS.canvases">
                                {{ DOMAIN_LABELS.canvases }}
                            </span>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center gap-2 border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('canvases') }"
                        >
                            <Checkbox
                                v-model="addCanvases"
                                :binary="true"
                                input-id="adv-add-canvases"
                                :disabled="!domainInManifest('canvases')"
                            />
                            <label for="adv-add-canvases" class="text-sm">
                                import new canvases
                            </label>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('canvases') }"
                        >
                            <SelectButton
                                v-model="canvasConflict"
                                :options="CANVAS_CONFLICT_OPTIONS"
                                option-label="label"
                                option-value="value"
                                :disabled="!domainInManifest('canvases')"
                                class="text-xs"
                            />
                        </div>

                        <!-- Blacklists -->
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2 text-sm"
                            :class="{
                                'opacity-50': !domainInManifest('blacklists'),
                                'text-surface-400': !domainInManifest('blacklists')
                            }"
                        >
                            <span :title="ROW_TOOLTIPS.blacklists">
                                {{ DOMAIN_LABELS.blacklists }}
                            </span>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center gap-2 border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('blacklists') }"
                        >
                            <Checkbox
                                v-model="addBlacklists"
                                :binary="true"
                                input-id="adv-add-blacklists"
                                :disabled="!domainInManifest('blacklists')"
                            />
                            <label for="adv-add-blacklists" class="text-sm">
                                import new lists
                            </label>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('blacklists') }"
                        >
                            <SelectButton
                                v-model="blacklistConflict"
                                :options="BLACKLIST_CONFLICT_OPTIONS"
                                option-label="label"
                                option-value="value"
                                :disabled="!domainInManifest('blacklists')"
                                class="text-xs"
                            />
                        </div>

                        <!-- Aliases -->
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2 text-sm"
                            :class="{
                                'opacity-50': !domainInManifest('aliases'),
                                'text-surface-400': !domainInManifest('aliases')
                            }"
                        >
                            <span :title="ROW_TOOLTIPS.aliases">
                                {{ DOMAIN_LABELS.aliases }}
                            </span>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center gap-2 border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('aliases') }"
                        >
                            <Checkbox
                                v-model="addAliases"
                                :binary="true"
                                input-id="adv-add-aliases"
                                :disabled="!domainInManifest('aliases')"
                            />
                            <label for="adv-add-aliases" class="text-sm">
                                import new aliases
                            </label>
                        </div>
                        <div
                            class="border-surface-200 dark:border-surface-800 flex items-center border-t px-3 py-2"
                            :class="{ 'opacity-50': !domainInManifest('aliases') }"
                        >
                            <SelectButton
                                v-model="aliasConflict"
                                :options="ALIAS_CONFLICT_OPTIONS"
                                option-label="label"
                                option-value="value"
                                :disabled="!domainInManifest('aliases')"
                                class="text-xs"
                            />
                        </div>
                    </div>
                </div>

                <Popover
                    ref="helpPopover"
                    class="border-surface-300 dark:border-surface-700 bg-surface-0 dark:bg-surface-950 max-w-125 rounded-lg border p-4 shadow-lg"
                >
                    <div class="flex max-w-115 flex-col gap-3 text-sm">
                        <h4 class="text-surface-700 dark:text-surface-200 font-semibold">
                            What is Advanced load?
                        </h4>
                        <p class="text-surface-500 dark:text-surface-400 text-xs">
                            Every domain you import has two settings: whether NEW items (no local
                            match) get added, and what happens when a backup item already exists on
                            this machine. Settings only affect the second case — new items are
                            always imported normally when their "Add if doesn't exist" box is
                            checked.
                        </p>

                        <h4 class="text-surface-700 dark:text-surface-200 font-semibold">
                            The settings
                        </h4>
                        <ul
                            class="text-surface-500 dark:text-surface-400 flex list-disc flex-col gap-1 pl-4 text-xs"
                        >
                            <li>
                                <b>Add if doesn't exist</b> — checked = import items that don't
                                exist here yet; unchecked = skip them (conflicts are still handled
                                by the next column).
                            </li>
                            <li><b>Skip</b> — leave the existing item alone.</li>
                            <li>
                                <b>Rename</b> — import under a new unique name (<code>(2)</code>,
                                <code>(3)</code>, …). Canvases and blacklists only.
                            </li>
                            <li>
                                <b>Merge tags</b> — keep the existing item and its tags, add the
                                backup's tags to it.
                            </li>
                            <li>
                                <b>Replace</b> — use the backup's version (bytes, color, relations,
                                scene or tag list). The item's id is kept, so references never
                                break.
                            </li>
                        </ul>

                        <h4 class="text-surface-700 dark:text-surface-200 font-semibold">
                            Per-row notes
                        </h4>
                        <ul
                            class="text-surface-500 dark:text-surface-400 flex list-disc flex-col gap-1 pl-4 text-xs"
                        >
                            <li>
                                <b>Files</b> — conflict = same non-null <code>source_url</code> on a
                                non-deleted file. For a local upload that's the absolute path it was
                                picked from, so a backup from the same machine can match. Skip
                                leaves that file's tags alone. Merge tags adds the backup's tags
                                onto it. Replace overwrites the file, its metadata, and its tag
                                links.
                            </li>
                            <li>
                                <b>Tags</b> — "Replace if exists" overwrites the color and
                                parent/child relations from the backup. Neighbours can lose an edge
                                to a replaced tag if the backup doesn't have it.
                            </li>
                            <li>
                                <b>File ↔ Tag links</b> — only links of <b>new files</b> added from
                                the backup. Links attach only to tags that exist or are imported — a
                                tag is never created just to attach a link; unmatched links are
                                dropped. Links of existing files are handled by the Files row
                                instead.
                            </li>
                            <li>
                                <b>Canvases</b> — media elements reference files by id; an element
                                whose file isn't imported is <b>dropped</b>. Replace still
                                overwrites the canvas; it can come back with fewer or no media
                                elements. That is intentional.
                            </li>
                            <li>
                                <b>Blacklists / Aliases</b> — tag lists are plain strings;
                                merging/replacing never depends on tags being imported.
                            </li>
                        </ul>

                        <h4 class="text-surface-700 dark:text-surface-200 font-semibold">
                            Good to know
                        </h4>
                        <ul
                            class="text-surface-500 dark:text-surface-400 flex list-disc flex-col gap-1 pl-4 text-xs"
                        >
                            <li>Replace never deletes whole domains — only the matching item.</li>
                            <li>
                                Skipped/dropped items are counted and shown in the task result after
                                loading.
                            </li>
                            <li>This is a one-time operation; the app reloads when it finishes.</li>
                        </ul>
                    </div>
                </Popover>
            </template>

            <div v-if="manifest" class="mt-3">
                <Button
                    label="Load Backup"
                    icon="pi pi-upload"
                    :disabled="taskStore.isLocked"
                    @click="mode === 'replace' ? confirmReplace() : loadAdvanced()"
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

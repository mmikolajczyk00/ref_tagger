# Plan: Database Backups

## Spec (fixed decisions)

- Replace the top-left ThemeSwitcher button in `TabBar.vue` with a settings button that opens a **full-screen Settings overlay**.
- The Settings overlay has a left sidebar (search field on top, scrollable list of fields below; each item = Material icon + title) and a right main panel showing the active field.
- Fields: **Appearance** (theme colors + Dark/Light/System, moved from ThemeSwitcher popover), **Database** (backup save/load), **Background Processes** (task list with progress).
- Save backup → native save dialog → zip the database + selected domains + their files.
- Load backup → native open dialog → read `manifest.json` → **Replace** or **Append**.
- Replace: the zip **becomes** the database; domain checkboxes on the zip's Save are ignored; confirm dialog lists domains present in the local DB but missing from the zip (they will be wiped); after success `app.relaunch()` then `app.exit()`.
- Append: merges the checked subset of the zip's domains into the live DB; after success the renderer calls `location.reload()`.
- Strict lock: while a save/load task is running, upload/delete are disabled in the UI and all DB/service mutations are rejected by the service layer.
- Background tasks show in Settings with progress; on completion/failure show a PrimeVue Toast. No cancel.
- While any task is running, a small **spinner icon** appears on the right side of the TabBar. Hovering it shows a popup listing active tasks with their progress.
- No absolute paths stored in the DB (Phase 0).
- A **Purge database** danger button in the Settings → Database field drops all tables, deletes the media and canvas files on disk, recreates the schema from `initDDL`, and reloads. It is the standard way to start fresh.

## Phase 0 — path inference (required first)

### Target schema

`files` becomes:

```
id INTEGER PRIMARY KEY AUTOINCREMENT
ext TEXT NOT NULL                  -- with leading dot, e.g. '.jpg'
file_name TEXT NOT NULL
media_type TEXT NOT NULL
source_url TEXT
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
deleted INTEGER NOT NULL DEFAULT 0
```

`canvases` loses `data_path`:

```
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL UNIQUE
created_at DATETIME DEFAULT CURRENT_TIMESTAMP
updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
```

All other tables unchanged. Paths are derived exclusively:

- media: `<FILE_ROOT_DIR>/files/<id><ext>`; thumb: `<FILE_ROOT_DIR>/files/<id><ext>_thumb.webp`
- canvas JSON: `<FILE_ROOT_DIR>/canvases/canvas-<id>.json`

### 1.1 `LocalDatabaseService.ts`

1. Update `initDDL`: `files` without `file_path` and with `ext`; `canvases` without `data_path`. Keep every other statement identical.
2. Constructor: keep the plain flow — open `Database`, `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`, `exec(initDDL)`. Do **not** add any migration, schema-detection, or recreate code. Remove the legacy `ALTER TABLE ... ADD COLUMN source_url/deleted` try/catch blocks (`initDDL` already declares both columns). Note: the DB has already been purged manually — the app will not start on an old-schema DB and none exists anymore.

### 1.2 `prisma/schema.prisma`

- `File`: replace `filePath String @unique @map("file_path")` with `ext String`.
- `Canvas`: delete `dataPath String @map("data_path")`.
- Run `npx prisma generate`.

### 1.3 `src/shared/types/models.ts`

- `Canvas` interface: remove `dataPath`.
- `MediaFile` stays unchanged (its `filePath` is now computed).

### 1.4 `FileStorageService.ts`

- Add:
    - `filePathFor(id: number, ext: string): string` → `path.join(this.filesDir, \`${id}${ext}\`)`
    - `thumbPathFor(id: number, ext: string): string` → `\`${this.filePathFor(id, ext)}_thumb.webp\``
- Use `filePathFor` inside `storeDownloadedWebFile`, `storeLocalFile`, `storeWebFile` to build `target`; keep their `(id, ..., ext)` signatures and return shapes.
- `deleteStoredFile(id: number, ext: string)`: unlink `filePathFor(id, ext)` and `thumbPathFor(id, ext)`, both `.catch(() => {})`.
- Remove the private `thumbPathFor(storedPath)` and `tempThumbPathFor(storedPath)`; `tempThumbPathFor` now takes `(id, ext)`.
- Add `getStorageRoot(): string` returning the base `rootDir` (the parent of `files/`); used for the canvases dir and backup paths.
- Rename existing `getRootDir()` → `getFilesDir()` for clarity (it returns the `files/` subdirectory, not the storage root). Update the call site in `handleIPCDownload.ts` accordingly.

### 1.5 `FileService.ts`

- `FileRow`: replace `filePath: string` with `ext: string`.
- Add `filePathOf(id: number, ext: string): string` delegating to `this.fileStorage.filePathFor`.
- `fileToResponse` becomes a method; `filePath: this.filePathOf(f.id, f.ext)`.
- `insertFile`: delete the `pending-<uuid>` placeholder and the follow-up `update`. Single `prisma.file.create` with `ext` set, then `store*` (id, source, ext); on storage failure delete the row (existing rollback branch stays, minus the path update).
- `hardDeleteFiles`: `select: { id: true, ext: true }`, call `this.fileStorage.deleteStoredFile(r.id, r.ext)`.
- All other queries: swap any `filePath` selection/update for `ext`.

### 1.6 `SearchService.ts`

- **Consolidate duplicated `fileToResponse`**: `SearchService` currently has its own copy of `FileRow` and `fileToResponse` (duplicated from `FileService`). Remove the local copies; call `this.fileService.fileToResponse(f)` instead (it's now a public method on `FileService`).
- The Prisma row shape already matches `FileService`'s `FileRow` (now selecting `ext` instead of `filePath`), so no additional mapping is needed.

### 1.7 `CanvasService.ts`

- Remove `dataPath` from `toCanvas`, `createCanvas`, `getCanvas` (read via `this.dataFilePath(row.id)`), `updateCanvasData` (`dataFilePath(id)`), `deleteCanvas` (unlink via `dataFilePath(id)`).
- `createCanvas`: drop the `dataFilePath(-1)` placeholder + second update; single `prisma.canvas.create({ name })`, then `writeJsonAtomic(this.dataFilePath(row.id), data)`.
- `LocalDatabaseService`: construct `CanvasService` with `path.join(fileRootDir, 'canvases')` — canvas JSON lives next to the media under `FILE_ROOT_DIR`, not in `userData`.
- **Breaking change — no migration**: the canvas directory moves from `userData/canvases/` to `FILE_ROOT_DIR/canvases/`. Existing canvas JSON files on disk will not be found at the new location. This is acceptable (placeholder data only; DB has been purged). Any pre-existing canvas files must be manually moved or will be orphaned.

### 1.8 `extFromMediaType` fix (`src/shared/utils/mediaType.ts`)

- Key the map by `MediaType`, not MIME: `{ image: '.jpg', video: '.mp4', audio: '.mp3' }`, fallback `'.bin'`. Keep the signature `(mediaType: string): string`.

### 1.9 `DownloadProgressEvent` type fix

- Fix pre-existing type mismatch: `handleIPCDownload.ts` sends `{ sessionId, percentage }` but `DownloadProgressEvent` in `src/shared/types/models.ts` declares `percent`. Rename the field to `percent` in the handler (or `percentage` in the type — pick one and align both). Update the renderer consumer in `UploadQueueTab.vue` accordingly.

### 1.10 Verify Phase 0

`npm run format` → `npm run lint` → `npm run typecheck` → `npm run build`. App must still list, display (thumb + full via `media://load`), upload, and delete media, with zero renderer changes.

---

## Plan:

### 2. Dependencies and shared types

- `npm install archiver extract-zip`, `npm install -D @types/archiver`
- Add to `src/shared/types/models.ts`:

```ts
export type BackupDomain = 'files' | 'tags' | 'file_tags' | 'canvases' | 'blacklists' | 'aliases'

export interface BackupManifest {
    version: 1
    createdAt: string
    domains: BackupDomain[]
    domainCounts: Partial<Record<BackupDomain, number>> // row counts per domain, for load UI preview
}

export interface BackupSaveOptions {
    domains: BackupDomain[]
}

export interface BackupLoadOptions {
    mode: 'replace' | 'append'
    domains: BackupDomain[] // ignored for replace; append: subset of the manifest, re-validated in main
    skipSameSourceUrl: boolean
    skipSameName: boolean
}

export interface TaskInfo {
    id: string
    label: string
    percentage: number
    status: 'running' | 'done' | 'error'
    error?: string
    warning?: string
}
```

Service layer re-validates dependencies:

- `file_tags` ⇒ `files` + `tags`; `canvases` ⇒ `files`; `aliases` ⇒ `tags`
- append `domains` must be a subset of the manifest's `domains`

### 3. TaskManager

New file `src/main/services/TaskManager.ts`.

- Constructed in `src/main/index.ts` after `app.whenReady()`, alongside `LocalDatabaseService`. Passed to `BackupService` and registered in IPC handlers.
- `createTask(label: string, win: BrowserWindow): string` — captures the window (progress outlives the `invoke`), stores `TaskInfo { id, label, percentage: 0, status: 'running' }`.
- `updateProgress(id, percentage)` — sets and broadcasts.
- `completeTask(id, warning?)` — status `'done'`, optional `warning`.
- `failTask(id, error)` — status `'error'`, sets `error`.
- `hasActiveTasks(): boolean`.
- `getTasks(): TaskInfo[]` — finished tasks retained in memory.
- Every mutation sends `win.webContents.send('api:tasks:updated', task)`.

### 4. Strict lock

`LocalDatabaseService`: add `private _locked = false`, `lock()`, `unlock()`, `get isLocked()`.

Guard at the **IPC handler level** rather than inside individual service methods. This is a single enforcement point per channel group — less error-prone than sprinkling `if (this.dbService.isLocked)` across 20+ methods.

In each `handleIPC*.ts` file, at the top of every mutation handler, check `dbService.isLocked` and return `{ success: false, error: 'Database is locked' }` if true. The `dbService` reference is passed to the registration function.

Guarded handler groups:

- `handleIPCFiles.ts`: `api:files:insert`, `api:files:delete`, `api:files:restore`, `api:files:updateTags`
- `handleIPCTags.ts`: all tag CRUD and relation handlers (create, delete, updateName, updateColor, addSubtags, removeSubtags, addParents, removeParents, addToFiles, removeFromFiles)
- `handleIPCCanvases.ts`: `api:canvases:create`, `api:canvases:rename`, `api:canvases:saveData`, `api:canvases:delete`
- `handleIPCTagsProcessing.ts`: all blacklist and alias mutation handlers
- `handleIPCDownload.ts`: `api:scrape:downloadFile` — guard before `downloadFile(...)` starts

Read-only handlers (get, search, paginate) are **not** guarded.

### 5. BackupService

New file `src/main/services/BackupService.ts` — `(dbService: LocalDatabaseService, taskManager: TaskManager)`.

Helper: `dbPath()` = `path.join(app.getPath('userData'), 'ref-sheeter.sqlite')`; storage root from `dbService.fileStorage` (add `getFilesDir()` and `getStorageRoot()`); media dir = `path.join(storageRoot, 'files')`, canvases dir = `path.join(storageRoot, 'canvases')`.

**`inspect(win)`** → `Result<{ manifest: BackupManifest }>`:

1. `dialog.showOpenDialog(win, { filters: [{ name: 'RefSheeter Backup', extensions: ['zip'] }], properties: ['openFile'] })`; cancelled → `{ success: true, data: { manifest: null } }`.
2. Extract to private temp dir `join(app.getPath('temp'), 'ref-sheeter-backup-' + crypto.randomUUID())` via `extract-zip`. Remember `zipPath` + `tempDir` privately.
3. Read and parse `tempDir/manifest.json`; missing/invalid → `{ success: false, error: 'Not a valid backup' }`.
4. Return manifest.

**`saveBackup(win, options: BackupSaveOptions)`** → `Result<void>`:

1. `dialog.showSaveDialog(win, { filters: [{ name: 'RefSheeter Backup', extensions: ['zip'] }] })`; cancelled → return success, no task.
2. `dbService.lock()`; `taskManager.createTask('Save backup', win)`. Wrap the rest in try/finally to `unlock()` and `failTask`/`completeTask`.
3. Snapshot: `new Database(dbPath, { readonly: true })` → `await conn.backup(snapshotPath)` (temp file), close.
4. Open the snapshot writeable; apply domain filtering (FKs on, order matters):
    - always `DELETE FROM files WHERE deleted = 1`
    - `files` unchecked → `DELETE FROM files` (cascades `file_tags`)
    - `file_tags` unchecked → `DELETE FROM file_tags`
    - `tags` unchecked → `DELETE FROM tags` (cascades `file_tags` and `tag_relations`)
    - `canvases` unchecked → `DELETE FROM canvases`
    - `files` unchecked → `DELETE FROM canvases` as well (canvas scenes reference file ids that no longer exist)
    - `blacklists` unchecked → `DELETE FROM blacklists` (cascades `blacklist_tags`)
    - `aliases` unchecked → `DELETE FROM aliases` (cascades `alias_tags`)
5. Count remaining rows per domain for the manifest's `domainCounts`.
6. Write a temp `manifest.json` with `domains: options.domains` and `domainCounts`.
7. Pre-scan bytes: snapshot + chosen `files/` entries + chosen `canvases/` entries.
8. Stream with `archiver`:
    - `archive.file(snapshotPath, { name: 'db.sqlite' })`
    - `archive.file(manifestPath, { name: 'manifest.json' })`
    - if `files` selected: for each snapshot `files` row, `archive.file(filePathFor(id, ext), { name: 'files/<id><ext>' })` and the thumb if it exists
    - if `canvases` selected: for each `canvases` row, `archive.file(canvasJsonPath(id), { name: 'canvases/canvas-<id>.json' })`
    - `archive.pipe(out)`; `await archive.finalize()`; wait for out `close`.
    - progress: `archive.on('progress', ({ fs }) => taskManager.updateProgress(id, fs.processedBytes / totalBytes * 100))`
9. Save dialog: pass `defaultPath: 'refsheeter-backup-' + dateISO() + '.zip'` for a sensible default filename.
10. Cleanup snapshot + manifest temp files; unlock; complete task.

**`loadBackup(win, options: BackupLoadOptions)`** → `Result<void>`:

Replace:

1. `dbService.lock()`; `taskManager.createTask('Load backup (replace)', win)`.
2. `await dbService.prismaDisconnect()` (add a method on `LocalDatabaseService` calling `$disconnect()`).
3. Delete `dbPath`, `-wal`, `-shm`.
4. Copy `tempDir/db.sqlite` → `dbPath`.
5. Wipe live `files/` and `canvases/`; copy `tempDir/files/*` → `files/`; copy `tempDir/canvases/*` → `canvases/` (missing zip dir ⇒ empty dir).
6. `app.relaunch()`; `app.exit()`.

Append:

1. `dbService.lock()`; `taskManager.createTask('Load backup (append)', win)`.
2. Open `tempDir/db.sqlite` read-only with better-sqlite3. Query its `files`, `tags`, `tag_relations`, `file_tags`, `canvases`, `blacklists`, `blacklist_tags`, `aliases`, `alias_tags`.
3. Use **Prisma** for all writes to the live DB (the Prisma adapter is already connected to `dbPath`; Prisma `create` accepts explicit `createdAt`/`updatedAt` so timestamps are preserved correctly — `@updatedAt` only auto-sets on `update`, not `create`). Wrap everything in `prisma.$transaction(async (tx) => { ... })`.
4. Domain handling (only for checked domains):
    - **files**: skip `deleted = 1`. For each row ordered by `created_at`: if `skipSameSourceUrl` and `source_url` is non-null and matches a live `source_url` (non-deleted row) → **record `oldId → existingRow.id`** (the duplicate already in the DB; canvas elements will reference it). Else `tx.file.create({ data: { ext, fileName, mediaType, sourceUrl, createdAt } })`, copy `tempDir/files/<oldId><ext>` → `files/<newId><ext>` (fail file → skip row, count into `warning`), same for thumb if present. Record `oldId → newId`.
    - **tags**: for each row: if name exists → reuse, keep local row as-is (including its color). Else `tx.tag.create(...)`. Record `oldId → newId`.
    - **tag_relations**: for each row: if both `oldParentId → newId` and `oldChildId → newId` exist in live `tags` and the pair is absent → insert. Only inserted when the parents are part of the append or the same-name reused tag.
    - **file_tags**: for each row: map `oldFileId` through the file merge map (which includes duplicate-file mappings from the files step). If no mapping exists → drop (file copy failed). Else insert `(mappedFileId, tagNewId)` if absent. `newTagId` resolves through the tag merge (reused or new).
    - **canvases**: requires `files` (else skip whole domain, no warning). For each row: if `skipSameName` and name exists → skip. Else if name exists → rename `Name (2)`, `Name (3)`, … until free. `tx.canvas.create(...)`. Read `tempDir/canvases/canvas-<oldId>.json`; for every `media` element replace `fileId` via the old→new map (which includes duplicate-file mappings, so elements referencing a skipped-duplicate file are **remapped to the existing file**, not dropped); **drop only elements whose old id has no mapping at all** (file copy failed). Write `canvases/canvas-<newId>.json`.
    - **blacklists**: for each row: if `skipSameName` and `list_name` exists → skip whole list. Else if name exists → rename like canvases; else keep. `tx.blacklist.create(...)` + copy every `blacklist_tags` entry.
    - **aliases**: requires `tags`. For each row: if `real_tag` exists in live tags (post-merge) → if `skipSameName` skip the group; else insert only the alias strings not already present. Else insert the whole group. Never rename `real_tag`.
5. **Reset SQLite autoincrement counters** after all inserts (Prisma doesn't manage `sqlite_sequence`):
    ```sql
    -- For each table that uses AUTOINCREMENT:
    UPDATE sqlite_sequence SET seq = (SELECT COALESCE(MAX(id), 0) FROM files) WHERE name = 'files';
    -- Repeat for: tags, canvases, blacklists, aliases, blacklist_tags, alias_tags
    ```
    Execute via raw `better-sqlite3` on `dbPath` (single statements, outside the Prisma transaction).
6. Deliver progress per-domain-row (files and canvases get fine-grained updates; others coarse).
7. Cleanup: remove tempDir; unlock; complete task with `warning` if any rows were skipped; return `{ success: true }`. Renderer then reloads.

Zip-slip guard during extraction: after `extract-zip`, verify every file path stays under `tempDir` and that entry names match the whitelist `manifest.json`, `db.sqlite`, `files/*`, `canvases/canvas-<id>.json`.

**`purgeDatabase(win)`** → `Result<void>`:

1. If `dbService.isLocked` → `{ success: false, error: 'Database is locked' }`.
2. `dbService.lock()`; wrap the rest in try/finally to `unlock()`.
3. Open a raw `Database(dbPath)`: `DROP TABLE IF EXISTS` in this order — `file_tags`, `tag_relations`, `blacklist_tags`, `alias_tags`, `files`, `tags`, `canvases`, `blacklists`, `aliases` — then `exec(initDDL)` to recreate the schema. `initDDL` must be exported from `LocalDatabaseService.ts`.
4. Wipe media: delete every entry in `<FILE_ROOT_DIR>/files/` and `<FILE_ROOT_DIR>/canvases/` (`tempThumbs/` is already cleared on startup).
5. Return success; the renderer then calls `location.reload()`.

### 6. IPC handlers and preload

New file `src/main/ipc/handleIPCBackup.ts`, following the existing `handleIPC*.ts` pattern; register in `src/main/index.ts`:

| Channel               | Direction       | Args → Result                                                  |
| --------------------- | --------------- | -------------------------------------------------------------- |
| `api:backup:inspect`  | invoke          | → `Result<{ manifest: BackupManifest } \| { manifest: null }>` |
| `api:backup:save`     | invoke          | `BackupSaveOptions` → `Result<void>`                           |
| `api:backup:load`     | invoke          | `BackupLoadOptions` → `Result<void>`                           |
| `api:backup:isLocked` | invoke          | → `Result<boolean>`                                            |
| `api:backup:purge`    | invoke          | → `Result<void>`                                               |
| `api:tasks:updated`   | main → renderer | `TaskInfo`                                                     |

Each handler resolves `win` via `BrowserWindow.fromWebContents(event.sender)`.

`src/preload/index.ts` — add `backup` namespace: `inspect()`, `save(options)`, `load(options)`, `isLocked()`, `purge()`, `onTaskUpdate(handler)` (registers `ipcRenderer.on('api:tasks:updated', ...)`, returns a cleanup function — same pattern as the download `on*` handlers). Extend the `window.api` type declaration to match.

### 7. Renderer task store

New file `src/renderer/src/core/stores/useTaskStore.ts` (Pinia composition API):

- `tasks: TaskInfo[]` — subscribes to `window.api.backup.onTaskUpdate` in the store setup (on cleanup, call the unsubscriber).
- `isLocked: boolean` — true while a `status: 'running'` backup task exists; seeded by `window.api.backup.isLocked()` on mount.
- On receiving a task with `status: 'done'` → toast success (`label`, plus `warning` text if present, severity `warn`); `'error'` → toast error with `error`.

### 8. Settings overlay

New files under `src/renderer/src/features/settings/ui/`:

- `SettingsOverlay.vue` — `fixed inset-0 z-50` overlay, close button top-right. Two-column layout. Emits `close`.
- `SettingsSidebar.vue` — props: fields `{ id, icon, title }[]`, active id, emits `select`. Top: `InputText` search filter (matches title + icon name). Below: scrollable list; active item highlighted.
- `fields/AppearanceField.vue` — move the ThemeSwitcher popover content in verbatim (theme swatches grid + mode buttons), driven by `useSettingsStore` (`themeId`, `themeMode`, `setThemeId`, `setThemeMode`).
- `fields/DatabaseField.vue` — see step 9.
- `fields/BackgroundProcessesField.vue` — iterate `taskStore.tasks`, show label + `ProgressBar` (value = percentage, only while `running`), status icon (`done`/`error`), `error`/`warning` text.

`useSettingsStore.ts` — add `settingsOpen: boolean`, `activeSettingsField: string` (default `'palette'`). Do not add new persistence keys for these.

Sidebar entries (in order): `{ id: 'palette', icon: 'palette', title: 'Appearance' }`, `{ id: 'database', icon: 'database', title: 'Database' }`, `{ id: 'tasks', icon: 'manufacturing', title: 'Background Processes' }`.

### 9. Database field

`DatabaseField.vue` — three sections.

Save section:

- One `Checkbox` per `BackupDomain`, default all checked. Dependency rules on toggle: unchecking `files` unchecks `file_tags` + `canvases`; unchecking `tags` unchecks `file_tags` + `aliases`; checking a dependent auto-checks its prerequisites (`file_tags` ⇒ `files`+`tags`; `canvases` ⇒ `files`; `aliases` ⇒ `tags`). Checkbox hint text for `canvases`: "└ elements referencing files not in the backup will be empty". For `file_tags`: "└ requires files and tags".
- `Save Backup` `Button` → `window.api.backup.save({ domains })`.

Load section:

- `SelectButton` `[{ label: 'Replace', value: 'replace' }, { label: 'Append', value: 'append' }]`, default `replace`.
- `Choose backup…` `Button` → `window.api.backup.inspect()`. While `manifest === null` (cancelled) reset. On result: store manifest; show its `domains` as chips.
- Append path (visible when mode is `append`): the same domain checkboxes, but each enabled only if present in `manifest.domains`; same dependency rules. Additional checkbox `Skip if source_url matches` (visible when `files` checked). Additional checkbox `Skip if name matches` (visible when `canvases`/`blacklists`/`aliases` checked).
- `Load Backup` `Button`:
    - `append` → `window.api.backup.load({ mode: 'append', domains, skipSameSourceUrl, skipSameName })`.
    - `replace` → open `ConfirmDialog` with message listing the local domains missing from `manifest.domains` ("Files, Tags, … will be deleted. Continue?"); on accept → `window.api.backup.load({ mode: 'replace', domains: manifest.domains, skipSameSourceUrl: false, skipSameName: false })`.
- When `taskStore.isLocked`, disable both sections' buttons.
- After a successful `load`, call `location.reload()` (only observed when the result arrives — Replace relaunches the app first, so this mostly applies to append).

Purge section:

- Danger `Button` `Purge database` → `ConfirmDialog`: "This permanently deletes ALL data: files, tags, canvases, blacklists, aliases, and their files on disk. This cannot be undone." On accept → `window.api.backup.purge()` → on success `location.reload()`.
- Disabled while `taskStore.isLocked`.

### 10. TabBar and Appearance move

- `TabBar.vue`: replace `<ThemeSwitcher />` (line 3) and its import with a `Button` (icon-only, `material-symbols-outlined` span `settings`) that sets `settings.settingsOpen = true`.
- Delete `src/renderer/src/core/ui/ThemeSwitcher.vue` after moving its content into `AppearanceField.vue`.
- Add a **task spinner** to the right side of the TabBar (next to the `+` new-tab button): a small `ProgressSpinner` (PrimeVue) visible when `taskStore.hasRunningTasks`. On hover, show a `Popover` listing active/recent tasks with label, progress bar, and status icon. Subscribes to `useTaskStore`.

### 11. Lock UI

- In `UploadQueueTab.vue` upload/scrape panels: `:disabled="taskStore.isLocked"` on add/upload controls, tooltip "Backup in progress".
- In `ExplorerTab.vue`: disable the delete and restore context-menu actions when `taskStore.isLocked`.
- Tag editor, canvas save, blacklist/alias editors: no UI changes needed; main-process guards cover them.

### 12. App shell and services

- `main.ts`: register `ToastService` and `ConfirmationService` (`app.use(...)`), alongside the existing `DialogService`.
- `App.vue`: add `<Toast />`, `<ConfirmDialog />`, and `<SettingsOverlay v-if="settings.settingsOpen" />` (plus existing `<TabBar>`, `<Tabwindow>`, `<DynamicDialog />`). Verify the `ConfirmDialog` renders above the overlay (PrimeVue appends to `body`; adjust z-index if it does not).

### 13. Validation

`npm run format` → `npm run lint` → `npm run typecheck` → `npm run build`

---

## Implementation order

1. Phase 0: schema + path inference + `extFromMediaType` fix; verify app unchanged behaviorally against a fresh DB
2. Dependencies + shared types
3. TaskManager + strict lock + mutation guards
4. BackupService (`inspect` / `saveBackup` / `loadBackup`, replace + append)
5. IPC handlers + preload bridge
6. Renderer task store
7. Settings overlay + sidebar + fields; TabBar gear button; delete ThemeSwitcher
8. Database field (save checkboxes, inspect-then-load, replace confirm, append options, purge button)
9. Lock UI in Upload and Explorer
10. App.vue + main.ts wiring
11. lint → typecheck → build

## Out of scope (do not build)

- Cancelling a running backup
- Selective replace (replace is always wholesale)
- Renaming tags or alias `real_tag` on conflict (merge-by-name / merge-strings instead)
- Merging blacklist entries into an existing same-named list
- Normalizing `source_url` (trailing slash, http/https)
- Top-bar progress badge (spinner on TabBar is in scope; a full status bar is not)
- `media://` resolution by id from the renderer
- `media://` protocol handler update for the new path-inference schema (deferred; works via computed `filePath` for now)

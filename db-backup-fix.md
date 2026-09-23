# Plan: Advanced backup load (per-field on-conflict resolution)

## Goal

Rework backup **load** so that instead of one global "append" mode there is an
**Advanced** mode with a per-domain **two-axis** import model:

1. **Add new items** — whether backup items with no local match are imported.
2. **On conflict** — what happens when a backup item matches an existing one.

This decouples domains that were wrongly coupled before (notably `file_tags` forcing
`tags`).

## Terminology

- **Top-level mode**:
    - `replace` (unchanged): the zip **becomes** the DB, then relaunch.
    - `advanced` (was `append`): the two-axis per-domain import below, then reload.
- **Per-field on-conflict**: `skip`, `rename`, `merge-tags`, `replace` ("replace on
  conflict", item-level upsert).

## The table UI

A table replaces the flat domain checklist in Advanced mode:

| Data type | Add if doesn't exist | On conflict |
| --- | --- | --- |
| Files | ☑ import new files | [Skip \| Merge tags \| Replace] |
| Tags | ☑ import new tags | ☑ Replace if exists (independent) |
| File ↔ Tag links | ☑ links of new files | — (handled by Files) |
| Canvases | ☑ import new canvases | [Skip \| Rename \| Replace] |
| Blacklists | ☑ import new lists | [Skip \| Rename \| Merge tags \| Replace] |
| Aliases | ☑ import new aliases | [Skip \| Merge tags \| Replace] |

Rows whose domain is absent from the manifest are disabled/greyed. The manifest chip
list stays above the table. Per-row hover tooltips + the main help popup explain
semantics (sections below).

Defaults: all "Add" ☑; Tags "Replace if exists" ☐; conflicts — files `skip`,
canvases `rename`, blacklists `skip`, aliases `skip`.

## Per-domain semantics

### Files (conflict key: `source_url`, non-null, non-deleted)

No content hash. Local uploads already store the absolute path they were picked from
in `source_url` (`DropHandler` sets `originalSourceUrl` to that path). That path is
the conflict key, same as a web URL. A backup loaded on the same machine can match
those files. A backup loaded on another machine will not — paths differ — so those
rows take the Add path. That is fine.

Matching rules for this import:

- Ignore `deleted = 1` live rows. Never resurrect a trashed file by matching it.
- `source_url` is not unique. If several live rows share it, the oldest (`MIN(id)`)
  wins. Extra live copies are left alone and counted in the warning.
- If several backup rows share that URL or path, the first applies skip / merge-tags
  /
  replace; later ones map to the same live id and do not create another row.
- `source_url = null` only happens for rows that were stored with no URL and no path.
  Those never conflict. Add ON → new row. Add OFF → dropped, no id map.

- **Add if doesn't exist**: ON → files with no `source_url` match (or `source_url =
  null`) are imported fresh (bytes + metadata). OFF → they are not imported and get **no
  id map entry** (canvas elements referencing them will drop).
- **On conflict**:
    - `skip` — leave the existing file and its tags untouched; map `backupId →
      existingId` so canvas references keep working.
    - `merge-tags` — keep the file/bytes; map `backupId → existingId`; union the
      backup's file-tag links onto it.
    - `replace` — keep the live `id`; overwrite `file_name`, `media_type` and media +
      thumb bytes. Copy the new bytes to a temp path first; only delete the old file
      and update the row after the copy succeeds. On copy failure, leave the live file
      untouched and count a skip.
- **Link policy (both merge-tags and replace): "add tag to file if exists"** — links
  are only created for tags that exist in the live DB (after the tags step). Tags are
  **never created** just to satisfy a link; unmatched links are dropped and counted.
  These writes do not look at the File ↔ Tag links checkbox. That checkbox only
  covers links of newly added files.

### Tags (conflict key: `name`)

Two **independent** checkboxes:

- **Add if doesn't exist**: ON → new tag names are created (with backup's color). OFF →
  new tag names are not created; backup tags that have no live match get no id mapping
  and their relations/links are dropped.
- **Replace if exists**: ON → an existing tag (same name) is overwritten (deep):
  update `color` and reset its parent/child `tag_relations` to the backup's mapped
  relations. OFF → keep the existing tag as-is (still mapped by id, so file-tag links
  can attach).
- Side effect to spell out in the tooltip: resetting one tag's edges deletes edges
  the other end still "owns". Live `animal → cat` and backup `cat` whose only child is
  `tabby` (and `animal` is not in the backup): Replace on `cat` removes `animal → cat`
  even though `animal` was not replaced. That is intended; the tooltip must say a
  replaced tag's parents/children become exactly the backup's, and neighbors can lose
  that edge.

Mapping note: backup tags whose name exists locally are **always** id-mapped to the
live tag (needed so File ↔ Tag links resolve), even when Add is OFF.

### File ↔ Tag links

- Single toggle: "import links of new files" (links of conflict-resolved files are
  handled by the Files on-conflict setting, not here).
- Links resolve their tag by **name lookup against the live DB** (post-tags-step), not
  via the tagMerge map — this is what makes "import links without importing tags"
  possible. Never creates a tag; unmatched tag names are dropped and counted.

### Canvases (conflict key: `name`)

- **Add if doesn't exist**: ON → new canvases imported. OFF → not imported.
- **On conflict**: `skip` / `rename` (`Name (2)`) / `replace` (keep `id`/`name`,
  overwrite the scene JSON with `fileId`s remapped through the file id map, bump
  `updated_at`).
- Scene media elements resolve through the old→new id map, which is built whenever
  files are imported (Files Add ON) or matched by conflict, covering new +
  skip/merge-tags/replace outcomes. Elements referencing files with no map entry are
  **dropped and counted**. Tooltip warning only — do not refuse the replace. A
  `replace` canvas can come back with fewer or zero media elements if its files were
  not imported; that is the user's choice.
- Rename (`Name (2)`, `Name (3)`, …) must reserve names already chosen in this import,
  not only names already in the live DB, or two backup rows can collide and abort the
  transaction.

### Blacklists / Aliases (conflict keys: `list_name` / `real_tag`)

- **Add if doesn't exist**: ON → new rows imported (with their child tag strings).
  OFF → not imported.
- **On conflict** (blacklists): `skip` / `rename` / `merge-tags` (union child tag
  strings) / `replace` (delete child `blacklist_tags`, insert backup's).
- **On conflict** (aliases): `skip` / `merge-tags` (union alias tag strings) /
  `replace` (delete child `alias_tags`, insert backup's). Conflict detection keys off
  `aliases.real_tag` (@unique), never off the `tags` table — this fixes the current
  crash.
- Do not try to detect alias strings that overlap another group's `real_tag`. That
  case is ignored.
- These two are otherwise self-contained: child tables hold plain strings, so their
  merge/replace never depends on the tags table existing.

## Scenarios (answering the edge cases)

1. **Import file-tag links but no new tags**: Tags row Add OFF (+ Replace OFF),
   File ↔ Tag links ON → links attach to existing tags only, missing tags dropped.
2. **Import canvases but not the removed files**: Files row Add OFF → those files get
   no id map entry → their canvas elements drop (counted). `replace` still overwrites
   the canvas. Files row Add ON → old→new id map is built and elements remap.

## Cross-domain edge cases

- `fileMerge: Map<backupFileId, liveFileId>` — built in the files step for every
  outcome that touches the file: new (Add ON), skip/merge-tags/replace (conflict).
  Failed byte copy → no entry (file + its links dropped, counted).
- `replacedLiveFileIds: Set<liveFileId>` — files resolved as `replace` (their live
  file-tag links are deleted before re-insert).
- file-tag links resolve tags by live **name lookup**; `tagMerge` is no longer used for
  links (kept only inside the tags step for relation handling if needed).
- `replacedTagIds: Set<liveTagId>` — tags with "Replace if exists" ON; the
  tag_relations step deletes their live parent/child edges first, then inserts the
  backup's mapped relations (insert-if-absent). Skipped/new tags keep their own
  relations except edges shared with a replaced tag, which follow the backup.
- canvases remap `fileId` via `fileMerge`; resolution only decides skip/rename/replace/
  new for the canvas row itself.
- Dropped items (unmatched links, unresolved canvas elements, skipped files) are
  counted and surfaced in the task-completion warning.

Order of operations: files → tags (+ tag_relations) → file_tags → canvases →
blacklists → aliases, all in one `prisma.$transaction`, then
`resetAutoincrementCounters()`.

## Save vs load

Save already forces the extra data into the zip. Leave that alone.

- Saving file-tag links also saves files and tags.
- Saving canvases also saves files.
- Saving aliases also saves tags.

Load must not do the same thing. Checking "File-tag links" on load must not import
tags. Checking canvases must not import files. Checking aliases must not import tags.
The zip still has those names and ids, because save put them there. Load just chooses
not to copy them into the live database unless that row is turned on.

The File-tag links checkbox only covers newly added files. Turn "add new files" off
and that checkbox does nothing. Tags on files that already exist are decided only by
the Files conflict setting: skip leaves them, merge-tags adds the backup's tags,
replace swaps them for the backup's tags.

## Type changes — `src/shared/types/models.ts`

```ts
export type FileConflict = 'skip' | 'merge-tags' | 'replace'
export type CanvasConflict = 'skip' | 'rename' | 'replace'
export type BlacklistConflict = 'skip' | 'rename' | 'merge-tags' | 'replace'
export type AliasConflict = 'skip' | 'merge-tags' | 'replace'

export interface BackupLoadOptions {
    mode: 'replace' | 'advanced'
    domains: BackupDomain[] // for advanced: subset of manifest domains
    addFiles: boolean
    fileConflict: FileConflict
    addTags: boolean
    replaceTags: boolean
    importFileLinks: boolean // file_tags domain
    addCanvases: boolean
    canvasConflict: CanvasConflict
    addBlacklists: boolean
    blacklistConflict: BlacklistConflict
    addAliases: boolean
    aliasConflict: AliasConflict
}
```

Remove `skipSameSourceUrl` / `skipSameName`. No schema change. Preload/IPC forward the
type unchanged.

## BackupService changes

- `loadBackup`: `mode === 'replace'` → `loadReplace` (unchanged); `mode === 'advanced'`
  → `loadAdvanced` (renamed from `loadAppend`, generalized).
- Files step: Add gate + skip/merge-tags/replace; build `fileMerge`,
  `replacedLiveFileIds`, `droppedCount`.
- Tags step: Add gate + "Replace if exists"; build `replacedTagIds`; always map
  existing-name tags.
- Tag relations step: union by default; delete-then-reinsert for replaced tags.
- File-tag links step: new files only; resolve tag names against live DB; never create
  tags; drop + count unmatched.
- Canvases step: Add gate + skip/rename/replace. Do not skip a replace because media
  elements dropped. Reserve rename suffixes against names already taken in this import
  (same for blacklists).
- Blacklists / Aliases steps: Add gate + conflict menus; key aliases off
  `aliases.real_tag`; drop `liveTagNames`.
- Update `countAppendSteps` to match the new conditional steps (esp. file_tags counting
  only new files).

## Renderer changes — `DatabaseField.vue`

- Rename mode options: `Replace` (top-level) and `Advanced` (was `Append`).
- Replace the flat domain checkboxes with the **table** (see "The table UI"). Use
  `DataTable`-style layout or simple grid rows with fixed columns; `SelectButton` for
  conflict menus, `Checkbox` for the toggle cells.
- Grey/disable rows for domains absent from the manifest; disable File ↔ Tag links row
  when Files Add is OFF.
- Per-row hover tooltips (short, e.g. Files → "Conflict = same source_url").
- Remove the two shared "Skip if…" checkboxes.
- `loadAdvanced()` sends the new flat option fields; `doReplace()` sends defaults.

## Import help tooltip

Question-mark icon next to the "Advanced" heading; hover opens a PrimeVue `Popover`
(consistent with the TabBar task popup).

### Main popup content

**What is Advanced load?** — Every domain you import has two settings: whether NEW
items (no local match) get added, and what happens when a backup item already exists
on this machine. Settings only affect the second case — new items are always imported
normally when their "Add if doesn't exist" box is checked.

**The settings:**

- **Add if doesn't exist** — checked = import items from the backup that don't exist
  here yet; unchecked = skip them (conflicts are still handled by the next column).
- **Skip** — leave the existing item alone; the backup's version is not imported.
- **Rename** — import the backup's item under a new unique name (`Name (2)`).
  Canvases and blacklists only.
- **Merge tags** — keep the existing item and its tags, add the backup's tags to it.
  For files this merges the file's **tag links**; for blacklists/aliases it merges the
  tag lists.
- **Replace** — use the backup's version: files get the backup's file + metadata, tags
  get the backup's color and tag relations, canvases get the backup's scene,
  blacklists/aliases get the backup's tag list. The item's id is kept, so references
  never break.

**Per-row notes:**

- **Files** — conflict = same non-empty `source_url` on a non-deleted file. For a
  local upload that value is the absolute path it was picked from, so a backup from
  the same machine can match it. A backup from another machine will not. If several
  local files share that path or URL, the oldest is used. Skip leaves that file's tags
  alone. Merge tags adds the backup's tags onto it. Replace overwrites the file, its
  metadata, and its tag links. The File ↔ Tag links checkbox does not change this.
- **Tags** — "Replace if exists" overwrites the tag's color and its parent/child
  relations from the backup. Neighbors can lose an edge to that tag if the backup
  doesn't have it. Unchecked leaves existing tags untouched.
- **File ↔ Tag links** — only imports links belonging to **new files** added from the
  backup. Links only attach to tags that exist (or were imported) — a tag is never
  created just to attach a link; unmatched links are dropped. Links of existing files
  are handled by the Files row instead.
- **Canvases** — media elements reference files by id. Elements whose file isn't being
  imported (not in the backup, or Files "Add" unchecked) are **dropped**. Replace still
  overwrites the canvas; it can come back with fewer or no media elements. That is
  intentional.
- **Blacklists / Aliases** — tag lists are plain strings; merging/replacing never
  depends on tags being imported.

**Good to know:**

- Replace never deletes whole domains or unrelated items — only the matching item.
- Skipped/dropped items are counted and shown in the task result after loading.
- This is a one-time operation; the app reloads when it finishes.

## Decisions

- File-tag links resolve tags by **name lookup against the live DB** and **never
  create tags** ("add tag to file if exists").
- `file_tags` row only imports links of **new** files; conflict-file links belong to
  the Files row.
- Canvas `replace` is not blocked when media elements drop. Tooltip warns that a
  replaced canvas can lose elements whose files were not imported.
- Dropped links/elements/files are counted and surfaced in the task warning.


## Validation

`npm run format` → `npx eslint` on changed files → `npx electron-vite build`.
Manual: (1) import links with Tags Add off; (2) import canvases with Files Add off;
(3) append twice; (4) alias `real_tag` in `aliases` but not `tags`; (5) files `replace`
with a `media_type` change; (6) tags Replace-if-exists with changed relations;
(7) verify dropped-item counts appear in the task warning.
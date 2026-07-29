# Plan: Parent-Child Many-to-Many Tag Relationships

## Goal

Add a many-to-many parent-child relation between tags so that:

- A tag can have multiple parents and multiple children (DAG, not a strict tree).
- Search expands a chip to include all its **ancestors** so a file tagged with a parent matches a search for any of its descendants (e.g. file tagged `car` matches a search for `glass` because `car → window → glass`).
- Subtags are managed inline in `TagEditorTab.vue` via a per-row expand-on-click panel (lazy fetch, add/remove).
- The data is primarily used for search; the UI surface for it is intentionally minimal (only `TagEditorTab.vue`).

## Confirmed design decisions

1. **Search expansion scope (chip modifiers)**

   | Prefix   | Mode              | Recursive to ancestors? |
   | -------- | ----------------- | ----------------------- |
   | `!!name` | requiredExpanded  | yes                     |
   | `!name`  | requiredExact     | no                      |
   | `name`   | normal (any-of)   | yes (always)            |
   | `--name` | excludedExpanded  | yes                     |
   | `-name`  | excludedExact     | no                      |

   The current `!` semantics (required) become `!` = required-exact, and `!!` is the new expanded variant. Normal tags now expand to ancestors by default (today they don't, so this is the user-visible behavior change that makes the feature useful).

2. **Subtags UI in `TagEditorTab.vue`**: view + add/remove. Click button → inline panel with current children (chips + remove X) and an autocomplete input to add. Lazy fetch on first open per row, cached afterwards.

3. **Cycles**: prevent at insertion time. Self-loops blocked at DB level (`CHECK (parent_id != child_id)`). M2M cycles (A→B, B→A or longer) blocked in app code with a reachability check: adding `(parent → child)` is rejected if `parent` is already a descendant of `child`. Cycles in existing data are impossible because we never allow their creation.

4. **Search expansion location**: main process. Renderer sends chip names + modes; main process runs a single recursive CTE to expand names, then reuses the existing `EXISTS`-style `Prisma.findMany` logic.

## Schema changes

### `prisma/schema.prisma`

Add `TagRelation` model (sibling to existing `Tag` and `FileTag`):

```prisma
model TagRelation {
    parentId Int @map("parent_id")
    childId  Int @map("child_id")
    parent   Tag @relation("TagParents", fields: [parentId], references: [id], onDelete: Cascade)
    child    Tag @relation("TagChildren", fields: [childId], references: [id], onDelete: Cascade)
    @@id([parentId, childId])
    @@index([parentId])
    @@index([childId])
    @@map("tag_relations")
}
```

Also add the two back-relations to `Tag`:

```prisma
model Tag {
    id       Int           @id @default(autoincrement())
    name     String        @unique
    color    String
    files    FileTag[]
    parents  TagRelation[] @relation("TagParents")
    children TagRelation[] @relation("TagChildren")
    @@map("tags")
}
```

### `src/main/services/LocalDatabaseService.ts` — `initDDL` (lines 17-41)

Append:

```sql
CREATE TABLE IF NOT EXISTS tag_relations (
    parent_id INTEGER NOT NULL,
    child_id  INTEGER NOT NULL,
    PRIMARY KEY (parent_id, child_id),
    FOREIGN KEY (parent_id) REFERENCES tags (id) ON DELETE CASCADE,
    FOREIGN KEY (child_id)  REFERENCES tags (id) ON DELETE CASCADE,
    CHECK (parent_id != child_id)
);
CREATE INDEX IF NOT EXISTS idx_tag_relations_parent ON tag_relations(parent_id);
CREATE INDEX IF NOT EXISTS idx_tag_relations_child  ON tag_relations(child_id);
```

`CREATE TABLE IF NOT EXISTS` is safe for existing DBs; the CHECK constraint is also created only on fresh DBs (SQLite does not retroactively validate existing rows). Then run `npx prisma migrate dev --name add_tag_relations` for the dev DB and `npx prisma generate` to refresh `src/generated/prisma/`.

## Main process — DB service

Add to `LocalDatabaseService`:

```ts
// Direct children (for the editor's inline panel — one level only)
async getChildrenOfTag(parentId: number): Promise<Tag[]>

// Direct parents (used to populate "This tag is a subtag of..." if ever needed)
async getParentsOfTag(childId: number): Promise<Tag[]>

// All transitive descendants of a tag (for future "subtree" UI; not used by v1 search)
async getDescendantNamesOfTag(parentName: string): Promise<string[]>

// All transitive ancestors of one or more tag names — the workhorse for search expansion.
// Returns a Map<originalName, Set<expandedName>>.
async expandTagNamesWithAncestors(
    names: string[]
): Promise<Map<string, Set<string>>>

// Cycle-safe insert: rejects if (parentId) is already a descendant of (childId).
async addTagRelation(parentId: number, childId: number): Promise<Result<void>>

// Plain delete; returns true if a row was actually removed.
async removeTagRelation(parentId: number, childId: number): Promise<boolean>
```

### `expandTagNamesWithAncestors` — single recursive CTE

```sql
WITH RECURSIVE
input(name) AS (VALUES (?),(?),...),
ancestors(name) AS (
    SELECT t.name FROM tags t JOIN input i ON t.name = i.name
    UNION
    SELECT t.name
    FROM tags t
    JOIN tag_relations tr ON tr.parent_id = t.id
    JOIN ancestors a      ON a.id      = tr.child_id
)
SELECT i.name AS input_name, a.name AS ancestor_name
FROM input i
LEFT JOIN ancestors a ON 1=1;
```

`prisma.$queryRaw` with parameter binding for the `VALUES (?,...),...` clause; rebuild the map in JS. For an empty input, return an empty map.

### `addTagRelation` — cycle check

```sql
WITH RECURSIVE descendants_of_child(id) AS (
    SELECT id FROM tags WHERE id = ?   -- childId
    UNION
    SELECT tr.child_id
    FROM tag_relations tr
    JOIN descendants_of_child d ON d.id = tr.parent_id
)
SELECT 1 AS would_cycle
FROM descendants_of_child
WHERE id = ?   -- parentId
LIMIT 1;
```

If the query returns a row, reject with `{ success: false, error: 'Adding this relation would create a cycle' }`. Otherwise run `INSERT OR IGNORE INTO tag_relations (parent_id, child_id) VALUES (?, ?)`.

## Main process — IPC

In `src/main/index.ts`, add handlers alongside the existing `api:tags:*` block (around lines 120-142):

| Channel                          | Delegates to                          |
| -------------------------------- | ------------------------------------- |
| `api:tags:getChildren`           | `dbService.getChildrenOfTag(id)`      |
| `api:tags:getParents`            | `dbService.getParentsOfTag(id)`       |
| `api:tags:addRelation`           | `dbService.addTagRelation(p, c)`      |
| `api:tags:removeRelation`        | `dbService.removeTagRelation(p, c)`   |

No new IPC for search expansion — that runs internally inside `searchFiles`.

## Main process — `searchFiles` refactor

`LocalDatabaseService.ts:240-297` today builds a `where: { AND: [...] }` for three arrays. New shape:

1. Accept a `chips: SearchChip[]` array (see Shared types below).
2. Bucket chips by mode:
   - `requiredExact`, `requiredExpanded` → required (with expansion flag)
   - `normal` → any-of (always expanded)
   - `excludedExact`, `excludedExpanded` → excluded (with expansion flag)
3. Call `expandTagNamesWithAncestors(allChipNames)` once.
4. For each chip, replace its name with the expanded set (or just its own name if the mode is exact).
5. Feed the resulting per-chip expanded name lists into the same EXISTS-style Prisma `where` builder used today, with one subquery per chip (so multiple required chips remain AND'd; multiple normal chips remain OR'd via a single `OR: [...]` block).

The exclusion logic is unchanged in shape (`NOT EXISTS` per excluded chip), only the names in the `IN (...)` are wider when expansion is on.

Edge case: if expansion returns an empty set (shouldn't happen — every name expands to at least itself), skip the chip to avoid an impossible-to-satisfy `EXISTS` with an empty `IN` list.

## Shared types (`src/shared/types/models.ts`)

Add at the bottom (and update `TagSearchQuery`):

```ts
export type SearchChipMode =
    | 'requiredExact'
    | 'requiredExpanded'
    | 'normal'
    | 'excludedExact'
    | 'excludedExpanded'

export interface SearchChip {
    name: string
    mode: SearchChipMode
}

export interface TagSearchQuery {
    chips: SearchChip[]
    page?: number
    limit?: number
}
```

`SearchChip.name` is the raw name (already lowercased + trimmed by the renderer parser; main process does not re-normalize). If `normalizeTag` should also run on the main side, do it before resolving — but keeping the renderer as the single source of normalization is simpler.

## Preload & globals

`src/preload/index.ts:31-40` — add:

```ts
tags: {
    ...,
    getChildren: (id: number) => ipcRenderer.invoke('api:tags:getChildren', id),
    getParents:  (id: number) => ipcRenderer.invoke('api:tags:getParents',  id),
    addRelation:    (parentId: number, childId: number) =>
        ipcRenderer.invoke('api:tags:addRelation', parentId, childId),
    removeRelation: (parentId: number, childId: number) =>
        ipcRenderer.invoke('api:tags:removeRelation', parentId, childId)
}
```

Mirror the same four entries in `src/renderer/src/index.d.ts:18-25`.

## Renderer — `useTagStore` (`src/renderer/src/core/stores/useTagStore.ts`)

Add a relations cache that survives across `fetchTags`:

```ts
const childrenByParentId = ref(new Map<number, number[]>())   // parentId -> childIds (direct)
const parentsByChildId   = ref(new Map<number, number[]>())   // childId  -> parentIds (direct)
const ancestorsByChildId = ref(new Map<number, number[]>())   // childId  -> all ancestorIds (transitive)
```

API (all in the store, called by the editor and by `useExplorer`):

```ts
async fetchChildren(parentId: number): Promise<Tag[]>            // populates childrenByParentId
async fetchAncestors(childId: number): Promise<number[]>          // populates ancestorsByChildId
async addChild(parentId: number, childName: string): Promise<Result<Tag>>
async removeChild(parentId: number, childId: number): Promise<boolean>
invalidateRelationsForTag(id: number)                            // on delete/rename
```

`addChild` resolves `childName` against the local `tagNamesSet` (or calls `tags.create` if missing) before calling `addRelation`. Cycle errors from main come back through the `Result` and are surfaced in the UI as a `useToast` / inline error.

On `removeTagLocally(id)` (existing `useTagStore.ts:73-81`), also call `invalidateRelationsForTag(id)` and prune any cache entry that referenced `id`.

## Renderer — search chip parser (`src/renderer/src/features/search/ts/parseSearchQuery.ts`)

Replace the current three-bucket output with a flat list. Order of prefix checks is important — check the two-character prefixes first:

```ts
export type SearchChipMode =
    | 'requiredExact'   | 'requiredExpanded'
    | 'normal'
    | 'excludedExact'   | 'excludedExpanded'

export interface SearchChip { name: string; mode: SearchChipMode }

export function parseSearchChips(chips: string[]): SearchChip[] {
    const out: SearchChip[] = []
    for (const raw of chips) {
        const c = raw.trim().toLowerCase()
        if (!c) continue
        if (c.startsWith('!!')) out.push({ name: c.slice(2).trim(), mode: 'requiredExpanded' })
        else if (c.startsWith('!'))  out.push({ name: c.slice(1).trim(),  mode: 'requiredExact'   })
        else if (c.startsWith('--')) out.push({ name: c.slice(2).trim(), mode: 'excludedExpanded' })
        else if (c.startsWith('-'))  out.push({ name: c.slice(1).trim(),  mode: 'excludedExact'   })
        else out.push({ name: c, mode: 'normal' })
    }
    return dedupeByPrecedence(out)
}
```

Dedupe rule: if the same `name` appears multiple times, keep the most "permissive" mode — requiredExpanded > requiredExact > normal > excludedExpanded > excludedExact. This avoids surprise (e.g. user types `!glass` then `--glass`; the expanded exclude wins because it removes more files).

## Renderer — `SearchTagInput.vue`

`src/renderer/src/features/search/ui/SearchTagInput.vue:70-109` — the chip-text builder (the function that turns a typed word into a chip string with the right prefix) currently always picks a single mode. Extend it to:

- Recognize `!` and `!!` as distinct prefixes when committing (peek the input for the second character).
- Same for `-` / `--`.
- Ghost-text suggestions should not auto-prefix; the user types the prefix explicitly.

A small visual hint per chip (e.g. a faint `++` / `--` badge) is optional but recommended for discoverability. Keep it minimal: a second `Chip` inside the first, or a class modifier.

## Renderer — `useExplorer.ts` (`src/renderer/src/features/explorer/ts/useExplorer.ts`)

Replace the `{ requiredTags, excludedTags, normalTags }` payload with the new `chips: SearchChip[]` payload produced by the new `parseSearchChips`. The pagination + merging logic (lines 58-87) stays the same.

## Renderer — `TagEditorTab.vue` UI

`src/renderer/src/features/tag_editor/ui/TagEditorTab.vue:119-210` — add a "Subtags" column and per-row expand panel.

### DataTable change

- New column "Subtags" placed after "Color", before "Delete". Sortable, sortable value = `childCount` (from a precomputed count map in `useTagEditor`).
- Body cell: a `Button` with icon `pi pi-sitemap` (or `pi-chevron-right`), label = current child count (e.g. `3 ▸`). Click toggles the inline panel for that row.
- A small `Tag` badge showing the count is also acceptable.

### Inline expand panel

- Renders directly below the row when expanded (or in an expandable row body via `data-table` row expansion — pick whichever fits PrimeVue 5's DataTable API most cleanly; row expansion is the idiomatic choice).
- Layout:
  - Top: existing child tags as `Chip` components. Each chip has an `X` button → `removeChild(parent.id, child.id)`.
  - Bottom: a small `EditorTagInput` (or a slim `BaseTagInput` instance) bound to a local draft. `Enter` / comma commits → `addChild(parent.id, draft)`. Autocomplete excludes the parent itself and its current children.
- Lazy fetch: on first open, `useTagStore.fetchChildren(parent.id)`. Cache hit on subsequent opens (and on switching rows).
- Loading state: a `ProgressSpinner` while the first fetch is in flight.
- Error state: cycle-prevention errors render as an inline `Message` (severity error) above the input.

### `useTagEditor` composable

`src/renderer/src/features/tag_editor/ts/useTagEditor.ts:11-36` — extend state to:

- `expandedRowId: Ref<number | null>` — single open row at a time.
- `childrenByParentId: Ref<Record<number, Tag[]>>` — local view over the store cache.

And methods:

- `toggleSubtags(tagId)` — flips `expandedRowId`, fetches children if first open.
- `addChild(parentId, name)` / `removeChild(parentId, childId)` — proxy to the store; on success, update the local `childrenByParentId`.

`refetch()` (called on `onActivated`, `useTagEditor.ts:23-25`) should NOT clear the children cache — relations change rarely and the cache is otherwise stable.

## Out of scope (explicitly not in this plan)

- Visual tree view in `TagEditorTab.vue` (only direct children are shown; deeper levels are reachable by clicking into a child's own row).
- Showing the relationship in the Explorer `TagEditorPanel`, in the `SearchTagInput` chips, or on the canvas `ImageElement` (per the user's "only place where you see the subtags" requirement).
- Bulk operations (set all children of X in one call) — single add/remove is enough for v1.
- Persisting ancestor lists on the tag model — always computed from the relation table.
- Tag relation history / undo.

## Edge cases

- **Delete a tag** → cascade removes its `tag_relations` rows (FK `ON DELETE CASCADE`). `useTagStore.removeTagLocally` prunes `childrenByParentId` / `parentsByChildId` / `ancestorsByChildId`.
- **Rename a tag** → relations are by id, no change. Cache keys stay valid.
- **Self-relation** → blocked at DB `CHECK` and at app layer (refuse to dispatch).
- **Cycle attempt** → main process returns `{ success: false, error: 'cycle' }`; UI shows it inline.
- **Search chip with no matches in `tags` table** → today the EXISTS subquery just returns no rows; with the new parser, an unknown name still produces an `EXISTS (... name = ?)` that matches nothing, same behavior. Expansion is a no-op when the name isn't found.
- **Empty expansion result** for a required chip would create `EXISTS (... IN ())` which is always false; guard against that by skipping such chips (a defensive no-op since expansion always includes the input name itself).
- **Migrating existing dev DB** → `initDDL`'s `CREATE TABLE IF NOT EXISTS` creates the new table on next app start. Also run `npx prisma migrate dev --name add_tag_relations` once so Prisma's migration history is in sync; the generated client must be refreshed with `npx prisma generate`.

## Verification (no test framework configured per `AGENTS.md`)

1. `npm run lint` — clean.
2. `npm run typecheck` — clean (covers `vue-tsc` for renderer, `tsc` for main/preload).
3. `npm run build` — clean.
4. Manual smoke (dev):
   - Add relations `car → wheel`, `car → window`, `window → glass`. Try to add `car → car` → blocked. Try to add `glass → car` → blocked (cycle).
   - Delete `window` → both relations involving it disappear.
   - Search `glass` (no prefix) → matches files tagged `car` and `glass`.
   - Search `!glass` (exact) → matches only files tagged `glass`.
   - Search `!!glass` → matches files tagged `car`, `window`, or `glass`.
   - Search `-car` → does NOT exclude `glass` / `wheel` / `window` files.
   - Search `--car` → excludes all four (`car`, `wheel`, `window`, `glass` files).
5. Manual UI smoke: in `TagEditorTab.vue`, expand `car`, add and remove children, verify persistence across tab switches (`onActivated` re-fetches tags but not relations).

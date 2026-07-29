# Plan2: Parent-Child M2M Tag Relationships

DAG. Search expands chip → all ancestors. UI only in `TagEditorTab.vue`.

## Modes

| Prefix | Mode             | expand→ancestors |
| ------ | ---------------- | ---------------- |
| `!!x`  | requiredExpanded | yes              |
| `!x`   | requiredExact    | no               |
| `x`    | normal (any-of)  | yes              |
| `--x`  | excludedExpanded | yes              |
| `-x`   | excludedExact    | no               |

Dedupe precedence: requiredExpanded > requiredExact > normal > excludedExpanded > excludedExact.

## Files to touch

```
prisma/schema.prisma
src/main/services/LocalDatabaseService.ts        (initDDL + methods + searchFiles refactor)
src/main/index.ts                                (4 new ipcMain.handle)
src/preload/index.ts                             (4 new tags.*)
src/renderer/src/index.d.ts                      (mirror preload)
src/shared/types/models.ts                       (TagSearchQuery → chips[])
src/renderer/src/core/stores/useTagStore.ts      (relations cache + actions)
src/renderer/src/features/search/ts/parseSearchQuery.ts
src/renderer/src/features/search/ui/SearchTagInput.vue
src/renderer/src/features/explorer/ts/useExplorer.ts
src/renderer/src/features/tag_editor/ts/useTagEditor.ts
src/renderer/src/features/tag_editor/ui/TagEditorTab.vue
```

## Schema

`prisma/schema.prisma`:

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

model TagRelation {
    parentId Int @map("parent_id")
    childId  Int @map("child_id")
    parent   Tag @relation("TagParents", fields: [parentId], references: [id], onDelete: Cascade)
    child    Tag @relation("TagChildren", fields: [childId],  references: [id], onDelete: Cascade)
    @@id([parentId, childId])
    @@index([parentId])
    @@index([childId])
    @@map("tag_relations")
}
```

`LocalDatabaseService.ts` `initDDL` append:

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

Run `npx prisma migrate dev --name add_tag_relations && npx prisma generate`.

## Shared types

`src/shared/types/models.ts`:

```ts
export type SearchChipMode =
    'requiredExact' | 'requiredExpanded' | 'normal' | 'excludedExact' | 'excludedExpanded'

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

## Main — LocalDatabaseService

New methods (signatures only, file uses existing `prisma` + `$queryRaw` patterns from `LocalDatabaseService.ts:75-91, 189-238`):

```ts
async getChildrenOfTag(parentId: number): Promise<Tag[]>
async getParentsOfTag(childId: number): Promise<Tag[]>
async getDescendantNamesOfTag(parentName: string): Promise<string[]>
async expandTagNamesWithAncestors(names: string[]): Promise<Map<string, Set<string>>>
async addTagRelation(parentId: number, childId: number): Promise<Result<void>>
async removeTagRelation(parentId: number, childId: number): Promise<boolean>
```

### `expandTagNamesWithAncestors` — single recursive CTE

Build `VALUES (?,),(?),...` for input names (n params). One query:

```sql
WITH RECURSIVE
input(name) AS (VALUES <PLACEHOLDER>),
ancestors(id, name) AS (
    SELECT t.id, t.name FROM tags t JOIN input i ON t.name = i.name
    UNION
    SELECT t.id, t.name
    FROM tags t
    JOIN tag_relations tr ON tr.parent_id = t.id
    JOIN ancestors a      ON a.id      = tr.child_id
)
SELECT i.name AS input_name, a.name AS ancestor_name
FROM input i
LEFT JOIN ancestors a ON 1=1;
```

JS: group rows into `Map<input_name, Set<ancestor_name>>`. Always includes input itself (base case). Empty input → empty map.

### `addTagRelation` — cycle check + insert

```sql
WITH RECURSIVE descendants_of_child(id) AS (
    SELECT id FROM tags WHERE id = ?1
    UNION
    SELECT tr.child_id
    FROM tag_relations tr
    JOIN descendants_of_child d ON d.id = tr.parent_id
)
SELECT 1 AS would_cycle
FROM descendants_of_child
WHERE id = ?2
LIMIT 1;
```

If row returned → return `{ success: false, error: 'cycle' }`. Else:

```sql
INSERT OR IGNORE INTO tag_relations (parent_id, child_id) VALUES (?1, ?2);
```

Also pre-check `parentId !== childId` in app before dispatch.

### `getChildrenOfTag` / `getParentsOfTag`

```ts
const children = await prisma.tagRelation.findMany({
    where: { parentId },
    include: { child: true }
})
return children.map((r) => r.child)
```

Mirror for parents.

### `searchFiles` refactor (currently `LocalDatabaseService.ts:240-297`)

```ts
async searchFiles(query: TagSearchQuery): Promise<PaginatedMediaFiles> {
    const { chips = [], page = 0, limit = 50 } = query

    // 1. Resolve expansions once. Wildcards are not expanded — they only
    //    make sense in normal mode and are handled per-chip below.
    const namesToExpand = chips
        .filter((c) => c.mode === 'requiredExpanded' || c.mode === 'normal' || c.mode === 'excludedExpanded')
        .filter((c) => !c.name.includes('*'))
        .map((c) => c.name)
    const expansion = await this.expandTagNamesWithAncestors(namesToExpand)

    // 2. Per-chip resolver. Returns a Prisma `tag` filter directly so
    //    wildcards can use `buildNormalTagFilter` (startsWith/contains/endsWith)
    //    and expansions can use the `{ in: [...] }` shape.
    const resolveTagFilter = (c: SearchChip): Prisma.TagWhereInput => {
        if (c.mode === 'requiredExact' || c.mode === 'excludedExact') {
            return { name: c.name }
        }
        // Wildcards are only supported in normal mode. If a required/excluded
        // chip contains '*', fall through to the literal name (no match,
        // because tag names are alphanum only).
        if (c.name.includes('*')) {
            return c.mode === 'normal' ? buildNormalTagFilter(c.name) : { name: c.name }
        }
        const names = expansion.get(c.name) ?? new Set([c.name])
        return { name: { in: [...names] } }
    }

    // 3. Bucket by group
    const required = chips.filter((c) => c.mode === 'requiredExact' || c.mode === 'requiredExpanded')
    const normal = chips.filter((c) => c.mode === 'normal')
    const excluded = chips.filter((c) => c.mode === 'excludedExact' || c.mode === 'excludedExpanded')

    // 4. Build where (same EXISTS pattern as today, just with expanded names)
    const and: Prisma.FileWhereInput[] = []
    for (const c of excluded) and.push({ NOT: { tags: { some: { tag: resolveTagFilter(c) } } } })
    for (const c of required) and.push({ tags: { some: { tag: resolveTagFilter(c) } } })
    if (normal.length) {
        const or: Prisma.FileWhereInput[] = normal.map((c) => ({
            tags: { some: { tag: resolveTagFilter(c) } }
        }))
        and.push({ OR: or })
    }

    const where: Prisma.FileWhereInput = and.length ? { AND: and } : {}
    // ...same skip/take/orderBy/shape as before
}
```

## Main — IPC (`src/main/index.ts`)

Add after line 142:

```ts
ipcMain.handle('api:tags:getChildren', (_e, id: number) => wrap(dbService.getChildrenOfTag(id)))
ipcMain.handle('api:tags:getParents', (_e, id: number) => wrap(dbService.getParentsOfTag(id)))
ipcMain.handle('api:tags:addRelation', (_e, parentId: number, childId: number) =>
    wrap(dbService.addTagRelation(parentId, childId))
)
ipcMain.handle('api:tags:removeRelation', (_e, parentId: number, childId: number) =>
    wrap(dbService.removeTagRelation(parentId, childId))
)
```

Match the wrap pattern used by existing handlers in the same file.

## Preload (`src/preload/index.ts:31-40`)

```ts
tags: {
    getAll: ...,
    create: ...,
    delete: ...,
    updateName: ...,
    updateColor: ...,
    getAllColors: ...,
    getChildren:   (id: number) => ipcRenderer.invoke('api:tags:getChildren', id),
    getParents:    (id: number) => ipcRenderer.invoke('api:tags:getParents',  id),
    addRelation:    (parentId: number, childId: number) =>
        ipcRenderer.invoke('api:tags:addRelation', parentId, childId),
    removeRelation: (parentId: number, childId: number) =>
        ipcRenderer.invoke('api:tags:removeRelation', parentId, childId)
}
```

Mirror in `src/renderer/src/index.d.ts:18-25`.

## useTagStore (`src/renderer/src/core/stores/useTagStore.ts`)

New state alongside existing `tags` / `isLoaded` / `tagNamesSet` / `tagIdsSet`:

```ts
const childrenByParentId = ref(new Map<number, number[]>())
const parentsByChildId = ref(new Map<number, number[]>())
const ancestorsByChildId = ref(new Map<number, number[]>()) // populated lazily if needed; not used by v1
```

New methods:

```ts
async fetchChildren(parentId: number): Promise<Tag[]>
async addChild(parentId: number, childName: string): Promise<Result<Tag>>
async removeChild(parentId: number, childId: number): Promise<boolean>
function invalidateRelationsForTag(id: number): void
```

`fetchChildren`:

```ts
const cached = childrenByParentId.value.get(parentId)
if (cached) return resolveTagsByIds(cached)
const tags = await window.api.tags.getChildren(parentId)
childrenByParentId.value.set(
    parentId,
    tags.map((t) => t.id)
)
parentsByChildId.value /* update inverse */
return tags
```

`addChild`:

```ts
let child = tags.value.find((t) => t.name === normalizeTag(childName))
if (!child) {
    const res = await window.api.tags.create(childName, '#FFF')
    if (!res.success) return res
    child = res.data
    addTagLocally(child)
}
const rel = await window.api.tags.addRelation(parentId, child.id)
if (!rel.success) return rel
// Refetch instead of local push — INSERT OR IGNORE is a silent no-op
// when the row already exists, so the renderer can't tell new from
// duplicate without re-reading. Cost is one IPC; children lists are small.
await this.fetchChildren(parentId)
return { success: true, data: child }
```

`removeChild`:

```ts
const ok = await window.api.tags.removeRelation(parentId, childId)
if (ok) await this.fetchChildren(parentId)
return ok
```

`invalidateRelationsForTag` — call inside existing `removeTagLocally(id)` (line 73-81):

```ts
function invalidateRelationsForTag(id: number) {
    childrenByParentId.value.delete(id)
    for (const [k, v] of childrenByParentId.value)
        if (v.includes(id))
            childrenByParentId.value.set(
                k,
                v.filter((x) => x !== id)
            )
    parentsByChildId.value.delete(id)
    for (const [k, v] of parentsByChildId.value)
        if (v.includes(id))
            parentsByChildId.value.set(
                k,
                v.filter((x) => x !== id)
            )
    ancestorsByChildId.value.delete(id)
}
```

## parseSearchQuery (`src/renderer/src/features/search/ts/parseSearchQuery.ts`)

Full file replacement:

```ts
export type SearchChipMode =
    'requiredExact' | 'requiredExpanded' | 'normal' | 'excludedExact' | 'excludedExpanded'

export interface SearchChip {
    name: string
    mode: SearchChipMode
}

const PRECEDENCE: Record<SearchChipMode, number> = {
    requiredExpanded: 5,
    requiredExact: 4,
    normal: 3,
    excludedExpanded: 2,
    excludedExact: 1
}

export function parseSearchChips(chips: string[]): SearchChip[] {
    const byName = new Map<string, SearchChip>()
    for (const raw of chips) {
        const c = raw.trim().toLowerCase()
        if (!c) continue
        let chip: SearchChip
        if (c.startsWith('!!')) chip = { name: c.slice(2).trim(), mode: 'requiredExpanded' }
        else if (c.startsWith('!')) chip = { name: c.slice(1).trim(), mode: 'requiredExact' }
        else if (c.startsWith('--')) chip = { name: c.slice(2).trim(), mode: 'excludedExpanded' }
        else if (c.startsWith('-')) chip = { name: c.slice(1).trim(), mode: 'excludedExact' }
        else chip = { name: c, mode: 'normal' }
        if (!chip.name) continue
        const cur = byName.get(chip.name)
        if (!cur || PRECEDENCE[chip.mode] > PRECEDENCE[cur.mode]) byName.set(chip.name, chip)
    }
    return [...byName.values()]
}
```

## SearchTagInput.vue (`src/renderer/src/features/search/ui/SearchTagInput.vue`)

In the chip-commit handler (around lines 70-109), when prefixing the committed chip, check second char first:

```ts
function commit(raw: string) {
    const t = raw.trim().toLowerCase()
    if (!t) return
    if (t.startsWith('!!') || t.startsWith('!') || t.startsWith('--') || t.startsWith('-')) {
        searchChips.value = [...searchChips.value, t]
    } else {
        searchChips.value = [...searchChips.value, t]
    }
    draft.value = ''
}
```

Ghost text / Tab-accept stays as-is (no auto-prefix).

Optional: add a 2nd inner element to the chip showing `!!` / `--` (or a class `is-expanded`).

## useExplorer.ts (`src/renderer/src/features/explorer/ts/useExplorer.ts`)

`search()` and `fetchNextPage()` (lines 21-87) — replace `requiredTags` / `excludedTags` / `normalTags` with `chips`:

```ts
const chips = ref<SearchChip[]>([])

function search(newChips: string[]) {
    chips.value = parseSearchChips(newChips)
    resetAndRefresh()
}

async function fetchNextPage() {
    const page = currentPage.value
    const limit = 50
    const result = chips.value.length
        ? await window.api.files.searchFiles({ chips: chips.value, page, limit })
        : await window.api.files.getMediaFiles(page, limit)
    // ...existing merge/stop logic
}
```

## useTagEditor.ts (`src/renderer/src/features/tag_editor/ts/useTagEditor.ts`)

Add state + methods (compose with existing `useTagStore`):

```ts
const expandedRowId = ref<number | null>(null)
const childrenByParentId = ref<Record<number, Tag[]>>({})
const childLoading = ref<Set<number>>(new Set())

async function toggleSubtags(tagId: number) {
    if (expandedRowId.value === tagId) {
        expandedRowId.value = null
        return
    }
    expandedRowId.value = tagId
    if (!childrenByParentId.value[tagId]) {
        childLoading.value.add(tagId)
        try {
            childrenByParentId.value[tagId] = await tagStore.fetchChildren(tagId)
        } finally {
            childLoading.value.delete(tagId)
        }
    }
}

async function addChild(parentId: number, name: string) {
    const res = await tagStore.addChild(parentId, name)
    if (res.success) {
        // store refetched internally; mirror into local view
        childrenByParentId.value[parentId] = await tagStore.fetchChildren(parentId)
    }
    return res
}

async function removeChild(parentId: number, childId: number) {
    const ok = await tagStore.removeChild(parentId, childId)
    if (ok) {
        childrenByParentId.value[parentId] = await tagStore.fetchChildren(parentId)
    }
    return ok
}
```

`refetch()` (called on `onActivated`, same as existing pattern) additionally re-fetches the children of the currently expanded row so multi-tab edits stay consistent. Other rows refetch lazily on next expand.

## TagEditorTab.vue (`src/renderer/src/features/tag_editor/ui/TagEditorTab.vue`)

DataTable: insert column between Color (lines 166-181) and Delete (lines 182-194).

Column header: `"Subtags"`. Body:

```vue
<Button
    :icon="expandedRowId === data.id ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
    :label="String((childrenByParentId[data.id] ?? []).length)"
    severity="secondary"
    text
    size="small"
    @click="toggleSubtags(data.id)"
/>
```

Row expansion (use PrimeVue 5 `data-table` `expandedRows` + `rowExpansionTemplate`; single-row via `v-model:expandedRows` to an array, sync with `expandedRowId`):

```vue
<DataTable v-model:expandedRows="expandedRowsProxy" ... dataKey="id">
    <template #expansion="slotProps">
        <div class="pl-12 pr-4 py-3 flex flex-col gap-2 border-t border-surface-200">
            <div v-if="childLoading.has(slotProps.data.id)" class="flex justify-center py-2">
                <ProgressSpinner style="width:24px;height:24px" />
            </div>
            <div v-else class="flex flex-wrap gap-2">
                <Chip
                    v-for="child in (childrenByParentId[slotProps.data.id] ?? [])"
                    :key="child.id"
                    :label="child.name"
                    removable
                    @remove="removeChild(slotProps.data.id, child.id)"
                />
                <span v-if="!(childrenByParentId[slotProps.data.id] ?? []).length"
                      class="text-sm text-surface-500">No subtags</span>
            </div>
            <div class="flex gap-2 items-center">
                <BaseTagInput
                    v-model="draftChild[slotProps.data.id]"
                    placeholder="Add subtag..."
                    :excludeIds="[slotProps.data.id, ...(childrenByParentId[slotProps.data.id] ?? []).map(t => t.id)]"
                    @submit="(v: string) => addChild(slotProps.data.id, v)"
                />
            </div>
        </div>
    </template>
    ...
</DataTable>
```

Local refs:

```ts
const expandedRowsProxy = computed({
    get: () => (expandedRowId.value === null ? [] : [expandedRowId.value]),
    set: (rows: number[]) => {
        expandedRowId.value = rows[0] ?? null
    }
})
const draftChild = ref<Record<number, string>>({})
```

Cycle errors from `addChild`: catch in handler, show inline `Message severity="error"`. A local `addError = ref<Record<number, string>>({})` cleared on next successful add.

## Edge cases

| Case                              | Behavior                                                                                           |
| --------------------------------- | -------------------------------------------------------------------------------------------------- |
| Delete tag                        | FK cascade removes relations; `useTagStore.removeTagLocally` calls `invalidateRelationsForTag(id)` |
| Rename tag                        | id-based relations unaffected                                                                      |
| Self-relation                     | app pre-check + DB `CHECK`                                                                         |
| Cycle attempt                     | CTE returns row → main returns `{success:false, error:'cycle'}` → inline error                     |
| Unknown name in chip              | CTE row absent → expansion yields just the bare name → same behavior as today (no match)           |
| Wildcard in normal chip (`foo*bar`) | expand, but `*` handling only meaningful in normal mode — pass through `buildNormalTagFilter` per chip; required/excluded chips with `*` fall through to literal name (no match, since tag names are alphanum only) |
| Empty expansion                   | skip chip in `where` builder (defensive)                                                           |
| Existing dev DB                   | `initDDL` `CREATE TABLE IF NOT EXISTS` adds table on next start; also run `npx prisma migrate dev` |

## Verify

`npm run lint && npm run typecheck && npm run build` clean.

Manual: build graph `car→{wheel,window}, window→glass`. Search `glass` → files with `car/window/glass`. Search `!glass` → only `glass`. `!!glass` → all. `-car` → no exclusion. `--car` → excludes all four. UI: expand `car` row, add/remove children, switch tabs, verify cache persists.

## Input sanitization — `SearchTagInput.vue`

Wildcards are only meaningful on **normal** (unprefixed) chips. In the searchbar input, while the user is typing a chip, if the chip already carries a modifier (`!`, `!!`, `-`, `--`) then `*` characters are not allowed and must be replaced with `_` on input. This keeps required/excluded chips safe from accidental wildcards (which would fall through to a literal-name no-match on the main side).

Implementation: a single `@keydown` or computed sanitizer on the draft input that runs as the user types. Pattern:

```ts
function sanitizeDraft(raw: string): string {
    const trimmed = raw.trim().toLowerCase()
    const hasModifier =
        trimmed.startsWith('!!') ||
        trimmed.startsWith('!')  ||
        trimmed.startsWith('--') ||
        trimmed.startsWith('-')
    return hasModifier ? raw.replace(/\*/g, '_') : raw
}
```

Wire into the input via `@update:modelValue="(v) => (draft = sanitizeDraft(v))"` (or equivalent `BaseTagInput` prop). Normal chips pass through unchanged; prefixed chips strip any `*` the user tries to enter. The existing `normalizeTag` flow already does the same `*` → `_` swap at commit time, so this just makes it visible immediately.

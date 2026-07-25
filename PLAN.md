# Theming — Next Steps

## 1. Switch between actual themes (presets), not just dark/light

**Goal:** users can pick a _named theme_ (e.g. _Aura Teal_, _Aura Indigo_, _Lara Teal_) and the entire app re-themes — not just toggle a dark/light class on the same preset.

**Where it lives:** `src/renderer/src/core/theme/presets.ts`, `useSettingsStore.ts`, `ThemeSwitcher.vue`.

**Implementation steps:**

1. **Theme registry** in `presets.ts`:

    ```ts
    export const themes = {
        'aura-teal':   definePreset(Aura,  { semantic: { primary: { 500: '#14b8a6', ... } } }),
        'aura-indigo': definePreset(Aura,  { semantic: { primary: { 500: '#6366f1', ... } } }),
        'aura-rose':   definePreset(Aura,  { semantic: { primary: { 500: '#f43f5e', ... } } }),
        'aura-amber':  definePreset(Aura,  { semantic: { primary: { 500: '#f59e0b', ... } } }),
    } as const
    export type ThemeId = keyof typeof themes
    ```

2. **Settings store** — add `themeId: ThemeId` alongside `themeMode`, persist both.

3. **Runtime switching** — in `App.vue` (or a new `useApplyTheme` composable) watch the store and call PrimeVue's runtime API:

    ```ts
    const primevue = usePrimeVue()
    watch([() => settings.themeId, () => settings.themeMode], ([id, mode]) => {
        primevue.theme.change({
            preset: themes[id],
            options: { darkModeSelector: '.app-dark', ... }
        })
    })
    ```

    `usePrimeVue()` is a Vue composable; call it inside `<script setup>` (not at module top-level), so the wiring moves from `main.ts` into `App.vue`.

4. **UI** — convert `ThemeSwitcher.vue` from a single-cycle button into a popover/menu showing: theme picker (4 presets) + dark/light toggle + system option. Use `primevue/popover` + `primevue/menu` or a small `Menubar`.

5. **Init flash** — the `<script>` in `index.html` must now also read `themeId` and apply the right preset's primary color CSS variable before Vue mounts. Simplest: write a single `--p-primary-500` value from the chosen preset into a `<style>` tag.

---

## 2. Per-component light/dark polish

**Goal:** all hardcoded "always dark" surfaces flip correctly when light mode is on. Currently the refactor only swapped color _names_; many components still pin themselves to dark via `bg-surface-950`, `text-primary-contrast`, `bg-black`, etc.

**Audit pass (per file):**

For each component, walk every color class and ask "does this need a `dark:` variant, or is the token itself dual-mode?"

| File                                                 | Pinning to fix                                                                                                                                                         |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `App.vue`                                            | `bg-surface-950 text-primary-contrast` → `bg-surface-0 text-surface-950 dark:bg-surface-950 dark:text-primary-contrast` (so light mode gets a light bg with dark text) |
| `NoteElement.vue`                                    | `bg-surface-950`, `border-surface-700`, `ring-primary-500` — wrap in `dark:` so light mode gets near-white notes with a subtle border                                  |
| `UploadQueueTab.vue`                                 | drop-zone `bg-surface-900` → `bg-surface-100 dark:bg-surface-900`; the inner cards `bg-surface-800` → `bg-surface-0 dark:bg-surface-800`                               |
| `BaseTagInput.vue`                                   | input wrapper, suggestions dropdown — flip surface tokens to `dark:`                                                                                                   |
| `TagEditorPanel.vue`                                 | `bg-surface-900` panel → `bg-surface-50 dark:bg-surface-900`                                                                                                           |
| `TabBar.vue`                                         | active/inactive tab `bg-surface-{700,950}` → `dark:` variants                                                                                                          |
| `ExplorerTab.vue`                                    | media-file cards, header, list — flip surface tokens                                                                                                                   |
| `TransformBoxOverlay.vue`, `SelectionBoxOverlay.vue` | fine, they use primary, but `border-primary` looks faint on light — consider `dark:border-primary-400`                                                                 |

**main.css adjustments:**

- Scrollbar thumb uses `bg-primary-500`; on a light bg that disappears — make it `bg-primary-500 dark:bg-primary-400` (or leave and let user style per-theme later).
- `teal-spinner` and `bright-spinner` — review.
- `it-table` — uses `bg-surface-950`; needs light variant.
- `*::-webkit-scrollbar-track { bg-surface-700 }` — flip to `dark:bg-surface-700` (or just leave dark since the scrollbar is system-rendered anyway).

**Approach:** add `dark:` prefix on every pinned token. A linter rule (`tailwindcss/no-dark-mode-classes-without-dark-variant` or custom) can enforce this going forward.

---

## 3. Light-mode surface palette should be zinc, not slate

**Symptom:** when the user switches to light mode, the surface tokens (driven by the Aura preset's `colorScheme.light.surface`) resolve to slate-gray values. The app's dark mode is already zinc-toned; light mode should also be zinc to stay consistent.

**Root cause:** Aura's `colorScheme.light.surface` is defined in the `@primeuix/themes/aura` preset and uses a slate-like ramp. The dark ramp is already zinc-toned. We're not overriding the light one.

**Fix (in `presets.ts`):** add `colorScheme` to every `definePreset`, mirroring the dark zinc ramp but inverted for light:

```ts
const zincLight = {
    0:   '#ffffff',
    50:  '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
    950: '#09090b'
}

export const RefSheeterPreset = definePreset(Aura, {
    semantic: {
        primary: { /* teal ramp */ },
        colorScheme: {
            light: {
                surface: zincLight,
                'surface-ground':  '{surface.100}',
                'surface-section': '{surface.0}',
                'surface-card':    '{surface.0}',
                'surface-overlay': '{surface.0}',
                'surface-border':  '{surface.200}',
                'surface-hover':   '{surface.100}',
                'surface-muted':   '{surface.300}',
                'surface-emphasis':'{surface.400}',
                formField: { background, border, color, ... }, // also override
                // ...other form fields that reference gray
            },
            dark: { surface: /* keep Aura's default (zinc-ish) */ }
        }
    }
})
```

**Verification:**

1. Toggle light mode → `bg-surface-0` should be `#ffffff`, `bg-surface-900` should be `#18181b`-ish. (Currently `bg-surface-900` in light mode is slate-tinted.)
2. Compare the surface ramp against `tailwindcss/colors` `zinc` to confirm parity.
3. Light-mode tab bar, explorer cards, note elements all read as zinc, not slate.

**Optional next step:** since each preset now defines its own light ramp, an `aura-indigo` theme can keep zinc for surface but use indigo for primary — a clean separation between "neutral ramp" and "accent color".

---

## Suggested order of work

1. **Item 3 (zinc override)** first — it's a one-file change in `presets.ts` and unblocks proper light-mode testing.
2. **Item 2 (per-component polish)** second — audit + `dark:` prefixes per file. Easy to verify visually.
3. **Item 1 (multi-preset switching)** last — touches the most architecture (settings, runtime API, UI). Verify items 2 + 3 are solid before introducing more colorways.

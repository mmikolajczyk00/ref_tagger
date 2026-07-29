# ref_tagger

Electron + Vue 3 + TypeScript media tagger with SQLite backend.

## Architecture

Three Electron process layers under `src/`:

- `src/main/` — main process (Node, `better-sqlite3`, IPC handlers). Entry: `index.ts`
- `src/preload/` — context bridge exposing `window.api`. Entry: `index.ts`
- `src/renderer/src/` — Vue 3 SPA with Pinia, PrimeVue 5, Tailwind CSS 4. Entry: `main.ts`, root component `App.vue`

Shared code in `src/shared/` (types, models, axios instance) is aliased as `@shared` in all three layers via `electron.vite.config.ts`.

## Key Commands

| Command               | Action                                                  |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`         | Dev server with HMR                                     |
| `npm run lint`        | ESLint (cached)                                         |
| `npm run format`      | Prettier --write                                        |
| `npm run typecheck`   | `tsc --noEmit` (main/preload) then `vue-tsc` (renderer) |
| `npm run build`       | `typecheck` then `electron-vite build`                  |
| `npm run build:linux` | Build + electron-builder Linux (AppImage, snap, deb)    |

Run `lint -> typecheck -> build` before committing. No test framework is configured.

## Style & Conventions

- **Prettier** (config in `.prettierrc.yaml`): no semicolons, single quotes, trailing comma none, 4-space tab width, 100 print width
- `.editorconfig` specifies 2-space indent but Prettier overrides it — Prettier wins
- Vue SFCs must use `<script setup lang="ts">` (enforced by ESLint rule `vue/block-lang`)
- Use modern vue 3.5 composition API standards
- PrimeVue components are auto-imported by `unplugin-vue-components` — DO NOT manually import them in components; register new ones by using them in templates - But you have to import local components
- Components go in `src/renderer/src/*/ui/*` (the `dirs` config for auto-import resolver)
- IPC returns use Result pattern: `{ success: true, data }` or `{ success: false, error }`

## Quirks & Gotchas

- `media://` custom protocol serves local files via `path` query param — used for displaying media in renderer without `file://` restrictions
- SQLite schema defined in `src/main/services/schema.sql`, loaded as raw string via `?raw` import; DB auto-initialized at `{userData}/ref-sheeter.sqlite`
- never read '.env'
- `postinstall` runs `electron-builder install-app-deps` to rebuild native modules; don't skip it
- `vue-tsc` is used for renderer typechecking (NOT plain `tsc`)

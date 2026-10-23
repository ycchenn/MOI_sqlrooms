# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A high-performance city-mobility trajectory visualizer built on **SQLRooms + Deck.gl + DuckDB-WASM**. It renders 20,000+ Agent-Based Modeling (ABM) trajectories from Parquet entirely in the browser, using zero-copy Arrow → GPU rendering and in-browser SQL aggregation. Originally derived from the official SQLRooms `deckgl-example`; now being redesigned (MOI ABM redesign) around the mentor-provided archive data: one trajectory dataset plus per-agent profile/schedule data, shown with a left dashboard sidebar (city overview / selected-agent detail). An earlier shelter-in-place / mass-evacuation scenario switcher and its overlays belonged to a different project and were removed — recover from git history if ever needed.

## Commands

```bash
yarn install      # install deps (yarn is the lockfile of record; package-lock.json also present)
yarn dev          # Vite dev server
yarn build        # tsc -b && vite build
yarn lint         # eslint .
yarn preview      # preview production build
```

There is no test suite. `.env` needs `VITE_DUCKDB_CONNECTION_STRING` (base URL of a local HTTP server that supports **Range Requests**, default `http://localhost:7780`) — the app reads `data.parquet` and `profiles.json` from the root of that server (`ARCHIVE_DATA_URL`/`ARCHIVE_PROFILES_URL` in `src/constants/data.ts`). `VITE_MAPTILER_API_KEY` is optional: set it to switch the basemap (`MapView.tsx`'s `MAP_STYLE`) from CARTO's `dark-matter-gl-style` (OSM data rebuilt as infrequently as once a year per CARTO's own docs) to MapTiler's `dataviz-dark` (rebuilt weekly) — get a free key at cloud.maptiler.com/account/keys. Missing the key just falls back to CARTO with a console warning, it doesn't break local dev.

### Local data (mentor archive)

The data is the mentor-provided `archive.zip` (git-ignored, never committed — ask for a fresh copy if missing), unzipped to a folder containing `data.parquet` (trajectories; `paths`/`timestamps`/`modes` are **comma-separated strings**, converted to typed lists in SQL via `string_split` + `list_transform`) and `profiles.json` (~13MB, per-agent demographics + schedule). Serve that folder with a standalone static file server with Range + CORS support, e.g.:

```bash
npx http-server path/to/Archive -p 7780 --cors
```

`VITE_DUCKDB_CONNECTION_STRING` just needs to match that server's base URL. (The older `sim_data/20260910/` test batch is no longer read by the app.)

## Architecture

### Single DuckDB engine (SQLRooms connector)
All in-browser SQL goes through **one** DuckDB-WASM instance — the SQLRooms connector created in `src/store.ts` via `createWasmDuckDbConnector()`. It drives the app's data loads below; the RoomShell chrome that used to expose it directly (sidebar with a SQL Editor / Data panel / file-dropzone / command palette toggle) was removed from `src/room.tsx` — it's end-user-facing product now, not a debug dashboard. `DataPanel.tsx` and the `data` panel registration in `src/store.ts` are still there (unreachable, harmless) so the sidebar can be added back trivially if that tooling is needed again later.
- **Trajectory load** — `MainView.tsx` uses the SQLRooms `useSql({query})` hook (`SELECT id, paths, timestamps, modes FROM read_parquet(ARCHIVE_DATA_URL)`, with the string → list conversion above); the resulting `data.arrowTable` is passed as a **prop** to `<MapView arrowTable=... />`, which in turn feeds it to the trips layer, `useHeatmapLayer`, and `usePointsLayer` (all three share the one query result — zero extra DuckDB round-trips).
- **Histogram** — `timebar/TimeLine.tsx` uses `useSql` for the time-bin aggregation query, also against `ARCHIVE_DATA_URL`.
- **OD-arc load (placeholder)** — `hooks/useODArcLayer.ts` is kept for later: the archive has no OD parquet, so it currently runs a guaranteed-zero-row query and the OD Arc layer draws nothing. Swap in a real query (OD file, or origins/destinations derived from trajectories) when available.
- **Profiles load** — `hooks/useProfiles.ts` fetches `profiles.json` once (not via DuckDB); `MainView.tsx` shares it between `AgentOverviewPanel` and `AgentDetailPanel`.

`useSql` returns `{ data: { arrowTable, rows(), toArray() }, isLoading, error }` and handles connector-init timing. Remote `read_parquet('http://...')` works natively in duckdb-wasm via Range requests. (Historically there were three separate DuckDB instances + a `window.globalArrowTable` hack; that was consolidated — do not reintroduce it.)

### State management
- **SQLRooms RoomShell store** (`src/store.ts`, `useRoomStore`) — room layout/panels; `dataSources` intentionally empty (data is loaded on demand via `useSql`). Panels: `main` (the map view, the only one actually reachable from the UI) and `data` (`placement: 'sidebar'` — registered but currently unreachable since `src/room.tsx` no longer renders `<RoomShell.Sidebar>`). `src/room.tsx` also passes `tileClassName="p-0 bg-transparent"` to `<RoomShell.LayoutComposer>` to kill `@sqlrooms/layout`'s default per-tile `p-2 bg-secondary/10` padding/tint — otherwise the light-theme tint shows as a border around the map.
- **Zustand `useMapStore`** (`src/zustand/useMapStore.ts`) — all playback/UI state: `time`, `timeRange`, `displayTimeRange`, `viewTimeRange`, `isPlaying`, `timeScale`, `selectedModes`, `visibleLayers`, `selectedAgentId` (see the comment block at the top of the file for what each time range means).
- The rAF playback loop in `MapView.tsx` reads/writes Zustand via `useMapStore.getState()` to dodge closure-stale-value traps. Components subscribe with `useShallow` + atomic selectors to avoid re-renders during playback.

### Layer registry & visibility
- `src/constants/layers.ts` centralizes layer identity: `LAYER_IDS` (`trips`/`heatmap`/`od-arc`), `LAYER_CONFIG` (id + title + `defaultVisible`), and `INITIAL_VISIBLE_LAYERS` derived from it.
- `useMapStore.visibleLayers` (`Record<LayerId, boolean>`) + `toggleLayer(id)` hold the on/off state; each layer hook/section in `MapView.tsx` reads its own `visibleLayers[LAYER_IDS.X]` to decide whether to build/return the layer.
- `LayerPanel.tsx` renders the checkbox UI (in the left dashboard sidebar) driven by `LAYER_CONFIG`/`toggleLayer` — adding a layer to the panel means adding one entry to `LAYER_CONFIG`, no other UI change needed.
- Trips and Points are zoom-LOD-exclusive and share the **Trips** checkbox (there is no separate Points checkbox): `MapView.tsx` only builds the trips `TripsLayer` when `currentZoom <= ZOOM_THRESHOLD` (11, from `usePointsLayer.ts`), and `usePointsLayer` only builds the per-agent scatter dots above it, gated on `visibleLayers[LAYER_IDS.TRIPS]`. Click-to-select an agent works on both (`trips-layer` and `trips-point`).
- The map's own zoom is clamped to `[MAP_MIN_ZOOM, MAP_MAX_ZOOM]` = `[10, 15]` (`constants/map.ts`, passed as `minZoom`/`maxZoom` props to react-map-gl's `<Map>`) — zooming further than 15 doesn't add resolution this dataset can use.

### Rendering pipeline (zero-copy)
- `MapView.tsx` — MapLibre basemap + `MapboxOverlay` Deck.gl overlay; runs the `requestAnimationFrame` playback loop; composes layers in order heatmap → od-arc → points → trips (later pushes draw on top). Wires `getTooltip` (the hover 資訊框 on Points: path index/mode/speed plus the agent's profile from `profiles.json`, rendered as escaped HTML — `MapView` takes `profiles` as a prop) and `onClick` (agent selection) into the overlay; tooltip text goes through `useT()` (see i18n). While an agent is selected, the sidebar shows only `AgentDetailPanel` (header + Schedule); `ModeSelector`/`LayerPanel` are hidden until the selection is cleared.
- `src/components/custom_layer/arrowTripsLayer/ArrowTripsLayer.ts` — a `CompositeLayer` that reads Arrow `RecordBatch` buffers directly. It slices the underlying `Float32Array`/`Uint8Array` (`paths`, `timestamps`, `modes` columns) via `subarray` using the batch's `valueOffsets`, rebuilds `startIndices` (offset ÷ 2 for [x,y] pairs), and feeds typed-array `attributes` straight into a per-batch `TripsLayer` — no JSON parsing. `updateState` caches the recomputed indices.
- `hooks/usePointsLayer.ts` — builds a single `ScatterplotLayer` (all agents as GPU instance attributes) as the LOD replacement for trips once zoomed in past `ZOOM_THRESHOLD`. Caches the per-agent flattened path/timestamp/mode arrays in a `useRef` keyed on `arrowTable` identity, then re-fills `positions`/`colors` typed arrays every render by interpolating each agent's position at `time` (binary search over each agent's own timestamp array, not a linear scan) — avoids re-parsing the Arrow table every frame.
- `hooks/useHeatmapLayer.ts` — one `ArrowPathLayer` per selected mode (own color + GPU `filterCategories`), additive-blended for a heat-density look; shares the trips `arrowTable` (no second query) and is gated behind a 300ms-debounced `timeRange` (frozen while `isPlaying`) so scrubbing doesn't rebuild layers every frame.
- `hooks/useODArcLayer.ts` — builds one `ArrowODArcLayer` from its own OD parquet query (see above), filtered by `timeRange`/`selectedModes`.
- `arrowODArcLayer/` and `arrowPathLayer/` are **live** — used by `useODArcLayer`/`useHeatmapLayer` respectively, not WIP experiments. `arrowODArcLayer/geoFanceLayer/` (geofence-based OD filtering) is still unused/WIP.

### Mode filtering (GPU bitmask)
- Mobility modes (WALK/CAR/BUS/RAIL) map to bits `[1,2,8,16]` (`src/constants/map.ts`, `MOBILITY_MODE_BITS`; bit `4` is a reserved/unused slot, never present in the source data).
- `ModeSelector` is a hand-drawn SVG donut chart (no chart library): each slice is the number of agents using that mode at the current `time` (`hooks/useModeShares.ts`), and clicking a slice or its legend row toggles that bit in `selectedModes` (multi-select; unselected slices dim but stay clickable, zero-count modes are only in the legend). `MapView` OR-reduces `selectedModes` into a single bitmask passed as `filterBitMask`.
- `src/lib/agentCache.ts` (`getAgentCache` WeakMap-cached per `arrowTable`, `getAgentStateAt`) is the shared per-agent parse + "which segment/mode at time t" logic used by both `usePointsLayer` and `useModeShares`, so the donut counts match the dots on the map.
- `ModeObjectPropsExtension` (`.../arrowTripsLayer/utils/extensions.ts`) is a Deck.gl `LayerExtension` that adds the per-vertex `mode_type` attribute and pushes the bitmask + `colorMap` as a shader uniform (`mode-shader-module.ts`), so show/hide happens in the WebGL shader.

### Timebar
`src/components/timebar/` — `Timebar` (play/pause + speed), `TimeLine` (dual-range slider: display window vs. active range), `AdjustTimeSpeedRatio`. Uses shadcn/ui `Button`/`Card`.

### i18n (中 / EN)
- The left dashboard and the map hover 資訊框 (tooltip) switch between Chinese and English; the basemap's place/road names are out of scope. `<LanguageSwitcher />` sits at the top-left of the sidebar; `useMapStore.language` (`'zh' | 'en'`, default `'zh'`) is persisted to `localStorage` (wrapped in try/catch).
- `src/i18n/index.ts` holds both dictionaries (no i18n library). `zh` defines the keys (`MessageKey`); `en` is typed `Record<MessageKey, string>`, so a missing translation is a type error. Components call `const t = useT()`; `{name}` placeholders are filled from the params object. `modeKey(bit)` / `locationKey(type)` map data codes to keys.
- Rule: with Chinese selected no English shows, and vice versa — never hard-code UI text in components; add a key to both dictionaries. Values that come straight from `profiles.json` (activity names, education, occupation, income, mobility) are displayed as-is and are intentionally **not** translated.
- `usePointsLayer` stores a status code (`'' | 'stopped' | 'slow'`) in `PointMeta.status`, not display text; the tooltip translates it.

## Conventions
- **`apache-arrow` is pinned to `17.0.0`** (exact, plus `resolutions`/`overrides` in `package.json`). Do NOT bump it. The SQLRooms packages pin `17.0.0` and `@duckdb/duckdb-wasm` requires `^17`; if a second arrow version (e.g. 21) gets hoisted, the SQLRooms connector's `new arrow.Table(batches)` receives RecordBatches built by a *different* arrow instance, the internal `instanceof RecordBatch` check fails, and the Table constructor recurses infinitely → `RangeError: Maximum call stack size exceeded` on every query. Keep one arrow version across the whole tree.
- **Time unit is seconds everywhere** (0–86400), in both Zustand and DuckDB queries. Do not mix in JS milliseconds (formatting helpers in `timebar/utils.ts` multiply by 1000 only for display).
- Path alias `@/` → `src/` (configured in `vite.config.ts` and tsconfig).
- shadcn/ui configured via `components.json` (style `radix-nova`, base color neutral); UI primitives in `src/components/ui/`.
- Much of the codebase has Traditional Chinese comments; match the surrounding language when editing existing files.
- Deploy target is Netlify (`netlify.toml`): `npm run build` → `dist`, with `CI=false` and increased Node heap.
- The archive data is not in the repo — local dev depends on it existing on disk plus a standalone http-server pointed at it (see Commands above). Don't assume it's present in CI/build environments.

# 個人偏好

- 預設用 Sonnet 模型回應，除非任務需要深度推理才切 Opus
- 不需要時不要主動讀取整個專案，明確讀取我指定的檔案就好
- 回應簡潔，不需要過多前言鋪陳
- 改檔案前先告訴我會改什麼，等我同意再動手

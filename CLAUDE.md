# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A high-performance city-mobility trajectory visualizer built on **SQLRooms + Deck.gl + DuckDB-WASM**. It renders 20,000+ Agent-Based Modeling (ABM) trajectories from Parquet entirely in the browser, using zero-copy Arrow → GPU rendering and in-browser SQL aggregation. Originally derived from the official SQLRooms `deckgl-example`; now extended into a **civil-protection scenario viewer** with two top-level scenario types (shelter-in-place / mass-evacuation), each with its own trajectory data, OD arcs, and scenario-specific overlay layers (transit stations/waiting crowds vs. shelters/capacity).

## Commands

```bash
yarn install      # install deps (yarn is the lockfile of record; package-lock.json also present)
yarn dev          # Vite dev server
yarn build        # tsc -b && vite build
yarn lint         # eslint .
yarn preview      # preview production build
```

There is no test suite. `.env` needs `VITE_DUCKDB_CONNECTION_STRING` (base URL of a local HTTP server that supports **Range Requests**, default `http://localhost:7780`) — every actual filename is resolved from `src/constants/data.ts`'s `SCENARIO_CONFIG`, keyed by the currently-selected scenario type (see below), not from individual `.env` vars anymore. `VITE_MAPTILER_API_KEY` is optional: set it to switch the basemap (`MapView.tsx`'s `MAP_STYLE`) from CARTO's `dark-matter-gl-style` (OSM data rebuilt as infrequently as once a year per CARTO's own docs) to MapTiler's `dataviz-dark` (rebuilt weekly) — get a free key at cloud.maptiler.com/account/keys. Missing the key just falls back to CARTO with a console warning, it doesn't break local dev.

### Local test data (`sim_data/`)

Local development points at `sim_data/20260910/` — a delivered test batch (git-ignored, ask for a fresh copy if missing) with its own `README.md` describing 5 subfolders (`01_trajectory`, `02_points`, `03_stop_counts`, `04_shelter_capacity`, `05_moi_sim`) across 6 scenarios (`pt10/20/40`, `evac_ratio10/20/40`). This app only wires up **`05_moi_sim`** (trips + OD arc — schema-compatible drop-in for the existing `paths/timestamps/modes` query), fixed to one sub-scenario per type (`pt10` for mass-evacuation, `evac_ratio10` for shelter-in-place — see `SCENARIO_CONFIG`). The `02_points`/`03_stop_counts`/`04_shelter_capacity` overlays (stations, shelters, stop counts, shelter capacity) used to be wired up but were removed — they belong to a different project's scenarios; recover them from git history if ever needed. `01_trajectory` and `05_moi_sim/road_service_*.geojson` are **not** wired up.

Since `sim_data/` isn't served anywhere in production, local dev needs a standalone static file server with Range + CORS support pointed at it, e.g.:

```bash
npx http-server sim_data/20260910 -p 7780 --cors
```

`VITE_DUCKDB_CONNECTION_STRING` just needs to match that server's base URL.

## Architecture

### Scenario switching (shelter-in-place vs. mass-evacuation)

- `useMapStore.scenarioType: 'shelter_in_place' | 'mass_evacuation'` (default `'mass_evacuation'`) is the single source of truth for which dataset is loaded; `setScenarioType(type)` also resets `time`/`timeRange`/`isPlaying` to their defaults, since the two scenario types have wildly different valid time windows (`pt*` ≈ 70h, `evac_ratio*` ≈ 1.5h) and leaving the playhead where it was would silently show nothing.
- `<ScenarioSwitcher />` (top-center of the map) is the only UI for this — two buttons, labels sourced from `SCENARIO_CONFIG[type].label`.
- `src/constants/data.ts`'s `SCENARIO_CONFIG: Record<ScenarioType, ScenarioFileSet>` is the file-path lookup table (`dataUrl`/`odDataUrl` per type). Every consumer (`MainView.tsx`, `timebar/TimeLine.tsx`, `useODArcLayer.ts`) reads `scenarioType` from the store and rebuilds its query string from `SCENARIO_CONFIG` on every render — `useSql` refetches automatically when the query string changes, so switching scenarios is just a state update, no manual invalidation.

### Single DuckDB engine (SQLRooms connector)
All in-browser SQL goes through **one** DuckDB-WASM instance — the SQLRooms connector created in `src/store.ts` via `createWasmDuckDbConnector()`. It drives the app's data loads below; the RoomShell chrome that used to expose it directly (sidebar with a SQL Editor / Data panel / file-dropzone / command palette toggle) was removed from `src/room.tsx` — it's end-user-facing product now, not a debug dashboard. `DataPanel.tsx` and the `data` panel registration in `src/store.ts` are still there (unreachable, harmless) so the sidebar can be added back trivially if that tooling is needed again later.
- **Trajectory load** — `MainView.tsx` uses the SQLRooms `useSql({query})` hook (`SELECT paths, timestamps, modes FROM read_parquet('${SCENARIO_CONFIG[scenarioType].dataUrl}')`); the resulting `data.arrowTable` is passed as a **prop** to `<MapView arrowTable=... />`, which in turn feeds it to the trips layer, `useHeatmapLayer`, and `usePointsLayer` (all three share the one query result — zero extra DuckDB round-trips).
- **Histogram** — `timebar/TimeLine.tsx` uses `useSql` for the time-bin aggregation query, also against the current scenario's `dataUrl`.
- **OD-arc load** — `hooks/useODArcLayer.ts` runs its own `useSql({query: 'SELECT * FROM read_parquet(odDataUrl)'})` against the scenario's OD parquet, since OD data has a different schema/granularity than the trip trajectories. Still the same connector, just a second query.

`useSql` returns `{ data: { arrowTable, rows(), toArray() }, isLoading, error }` and handles connector-init timing. Remote `read_parquet('http://...')` works natively in duckdb-wasm via Range requests. (Historically there were three separate DuckDB instances + a `window.globalArrowTable` hack; that was consolidated — do not reintroduce it.)

### State management
- **SQLRooms RoomShell store** (`src/store.ts`, `useRoomStore`) — room layout/panels; `dataSources` intentionally empty (data is loaded on demand via `useSql`). Panels: `main` (the map view, the only one actually reachable from the UI) and `data` (`placement: 'sidebar'` — registered but currently unreachable since `src/room.tsx` no longer renders `<RoomShell.Sidebar>`). `src/room.tsx` also passes `tileClassName="p-0 bg-transparent"` to `<RoomShell.LayoutComposer>` to kill `@sqlrooms/layout`'s default per-tile `p-2 bg-secondary/10` padding/tint — otherwise the light-theme tint shows as a border around the map.
- **Zustand `useMapStore`** (`src/zustand/useMapStore.ts`) — all playback/UI state: `time`, `timeRange`, `displayTimeRange`, `viewTimeRange`, `isPlaying`, `timeScale`, `selectedModes`, `visibleLayers`, `scenarioType` (see the comment block at the top of the file for what each time range means).
- The rAF playback loop in `MapView.tsx` reads/writes Zustand via `useMapStore.getState()` to dodge closure-stale-value traps. Components subscribe with `useShallow` + atomic selectors to avoid re-renders during playback.

### Layer registry & visibility
- `src/constants/layers.ts` centralizes layer identity: `LAYER_IDS` (`trips`/`heatmap`/`od-arc`), `LAYER_CONFIG` (id + title + `defaultVisible`), and `INITIAL_VISIBLE_LAYERS` derived from it.
- `useMapStore.visibleLayers` (`Record<LayerId, boolean>`) + `toggleLayer(id)` hold the on/off state; each layer hook/section in `MapView.tsx` reads its own `visibleLayers[LAYER_IDS.X]` to decide whether to build/return the layer.
- `LayerPanel.tsx` renders the checkbox UI (in the left dashboard sidebar) driven by `LAYER_CONFIG`/`toggleLayer` — adding a layer to the panel means adding one entry to `LAYER_CONFIG`, no other UI change needed.
- Trips and Points are zoom-LOD-exclusive and share the **Trips** checkbox (there is no separate Points checkbox): `MapView.tsx` only builds the trips `TripsLayer` when `currentZoom <= ZOOM_THRESHOLD` (11, from `usePointsLayer.ts`), and `usePointsLayer` only builds the per-agent scatter dots above it, gated on `visibleLayers[LAYER_IDS.TRIPS]`. Click-to-select an agent works on both (`trips-layer` and `trips-point`).
- The map's own zoom is clamped to `[MAP_MIN_ZOOM, MAP_MAX_ZOOM]` = `[10, 15]` (`constants/map.ts`, passed as `minZoom`/`maxZoom` props to react-map-gl's `<Map>`) — zooming further than 15 doesn't add resolution this dataset can use.

### Rendering pipeline (zero-copy)
- `MapView.tsx` — MapLibre basemap + `MapboxOverlay` Deck.gl overlay; runs the `requestAnimationFrame` playback loop; composes layers in order heatmap → od-arc → points → trips (later pushes draw on top). Wires `getTooltip` (Points hover: agent id/mode/speed) and `onClick` (agent selection) into the overlay.
- `src/components/custom_layer/arrowTripsLayer/ArrowTripsLayer.ts` — a `CompositeLayer` that reads Arrow `RecordBatch` buffers directly. It slices the underlying `Float32Array`/`Uint8Array` (`paths`, `timestamps`, `modes` columns) via `subarray` using the batch's `valueOffsets`, rebuilds `startIndices` (offset ÷ 2 for [x,y] pairs), and feeds typed-array `attributes` straight into a per-batch `TripsLayer` — no JSON parsing. `updateState` caches the recomputed indices.
- `hooks/usePointsLayer.ts` — builds a single `ScatterplotLayer` (all agents as GPU instance attributes) as the LOD replacement for trips once zoomed in past `ZOOM_THRESHOLD`. Caches the per-agent flattened path/timestamp/mode arrays in a `useRef` keyed on `arrowTable` identity, then re-fills `positions`/`colors` typed arrays every render by interpolating each agent's position at `time` (binary search over each agent's own timestamp array, not a linear scan) — avoids re-parsing the Arrow table every frame.
- `hooks/useHeatmapLayer.ts` — one `ArrowPathLayer` per selected mode (own color + GPU `filterCategories`), additive-blended for a heat-density look; shares the trips `arrowTable` (no second query) and is gated behind a 300ms-debounced `timeRange` (frozen while `isPlaying`) so scrubbing doesn't rebuild layers every frame.
- `hooks/useODArcLayer.ts` — builds one `ArrowODArcLayer` from its own OD parquet query (see above), filtered by `timeRange`/`selectedModes`.
- `arrowODArcLayer/` and `arrowPathLayer/` are **live** — used by `useODArcLayer`/`useHeatmapLayer` respectively, not WIP experiments. `arrowODArcLayer/geoFanceLayer/` (geofence-based OD filtering) is still unused/WIP.

### Mode filtering (GPU bitmask)
- Mobility modes (WALK/CAR/BUS/RAIL) map to bits `[1,2,8,16]` (`src/constants/map.ts`, `MOBILITY_MODE_BITS`; bit `4` is a reserved/unused slot, never present in the source data).
- `ModeSelector` toggles bits in `selectedModes`; `MapView` OR-reduces them into a single bitmask passed as `filterBitMask`.
- `ModeObjectPropsExtension` (`.../arrowTripsLayer/utils/extensions.ts`) is a Deck.gl `LayerExtension` that adds the per-vertex `mode_type` attribute and pushes the bitmask + `colorMap` as a shader uniform (`mode-shader-module.ts`), so show/hide happens in the WebGL shader.

### Timebar
`src/components/timebar/` — `Timebar` (play/pause + speed), `TimeLine` (dual-range slider: display window vs. active range), `AdjustTimeSpeedRatio`. Uses shadcn/ui `Button`/`Card`.

## Conventions
- **`apache-arrow` is pinned to `17.0.0`** (exact, plus `resolutions`/`overrides` in `package.json`). Do NOT bump it. The SQLRooms packages pin `17.0.0` and `@duckdb/duckdb-wasm` requires `^17`; if a second arrow version (e.g. 21) gets hoisted, the SQLRooms connector's `new arrow.Table(batches)` receives RecordBatches built by a *different* arrow instance, the internal `instanceof RecordBatch` check fails, and the Table constructor recurses infinitely → `RangeError: Maximum call stack size exceeded` on every query. Keep one arrow version across the whole tree.
- **Time unit is seconds everywhere** (0–86400, though `evac_ratio*`/`pt*` scenario timestamps can exceed 86400 since the underlying sim runs up to 72h), in both Zustand and DuckDB queries. Do not mix in JS milliseconds (formatting helpers in `timebar/utils.ts` multiply by 1000 only for display).
- Path alias `@/` → `src/` (configured in `vite.config.ts` and tsconfig).
- shadcn/ui configured via `components.json` (style `radix-nova`, base color neutral); UI primitives in `src/components/ui/`.
- Much of the codebase has Traditional Chinese comments; match the surrounding language when editing existing files.
- Deploy target is Netlify (`netlify.toml`): `npm run build` → `dist`, with `CI=false` and increased Node heap.
- `sim_data/` is git-ignored (large delivered test batch, not part of the repo) — local dev depends on it existing on disk plus a standalone http-server pointed at it (see Commands above). Don't assume it's present in CI/build environments.

# 個人偏好

- 預設用 Sonnet 模型回應，除非任務需要深度推理才切 Opus
- 不需要時不要主動讀取整個專案，明確讀取我指定的檔案就好
- 回應簡潔，不需要過多前言鋪陳
- 改檔案前先告訴我會改什麼，等我同意再動手

# ArgantaEnergy Cockpit — Battle-Test & Way-Forward

*2026-07-23 · reconciles the v2.0 Spatial Intelligence handoff with the shipped code.
Build is green (tsc 0 errors, vite build ~20s). OSDU-canonical / ATLAS-read-projection
layering is correct and enforced. The gaps below are the delta between the handoff's
spatial-intelligence contract and what actually renders.*

---

## A. Battle-test findings (prioritized)

| # | Sev | Finding | Evidence |
|---|---|---|---|
| P0-1 | **BLOCKER** | Antimeridian defect shipped raw — Russia→US smear on all 3 views | `provinces.geojson` had 4 crossing provinces (Eurasia 258°, Long Strait 360°…); no split logic in `build-cockpit-spatial.mjs`. **FIXED this session.** |
| P1-1 | High | Search is a hardcoded 5-place list, not OSDU-grounded; `cockpit-search.json` never generated | `Cockpit.tsx:67-73,125-129`; §2/§11 unmet |
| P1-2 | High | Default 3D globe renders **zero fields** — province outlines only; §10 reserve towers/clusters absent | `CockpitGlobe.tsx:97` fetches only provinces |
| P1-3 | High | Cross-source identity resolution absent — same field from GOGET/NorthSea/ANP = duplicate records + points | contract "next data step"; no dedup in `build-osdu.mjs` |
| P1-4 | High | Lifecycle field dossier absent — popup is a flat key/value inspector, not §7-8 | `Cockpit.tsx:221-231` |
| P1-5 | High | Tile providers hardcoded (Esri/OSM in 4 places incl CSS) — breaks sovereign §3; OSM/Esri ToS risk at scale | `CockpitLeafletMap.tsx:91,95`, `CockpitGlobe.tsx:17`, `cockpit-map.css:6,56` |
| P1-6 | High | Scale-aware heatmap→cluster→field (§9) missing in mounted renderers; the one with clustering (`CockpitMap.tsx`, maplibre) is **orphaned dead code** | never imported as component |
| P1-7 | Med | GOGET (CC BY 4.0) attribution only on Leaflet; missing on globe + mesh | compliance + §14 |
| P1-8 | Med | 45 MB of OSDU manifests ship in `dist/` (29 MB GOGET is build-only) — publicly exposes full dataset + deploy bloat | `public/osdu/*.manifest.json` |
| P2 | Low | Globe rAF not paused on `document.hidden`; mesh full-redraw per pointermove; per-field Leaflet markers (no aggregation); orphan CSS; 5 `arganta:` schemas unregistered on platform; internal lane empty | §13 |

**Verdict:** the *chrome* (non-scroll shell, theming, lazy-load, WebGL disposal, DPR cap) is
production-grade; the *spatial-intelligence substance* (Cesium/deck.gl scale engine, OSDU
search, field dossier, identity resolution) is substituted-lighter, orphaned, or absent.

---

## B. Fixed this session

- **P0-1 antimeridian gate** — new `scripts/lib/antimeridian.mjs` (unwrap → 360° band split
  with Sutherland-Hodgman strip-clip → wrap-back, + polar-cap safety drop). Wired into
  `build-cockpit-spatial.mjs`: normalizes field polygons and re-emits `provinces.geojson` +
  `aus.geojson`. Result: **4→0 province defects, 7→0 AU defects**, 5,460 matches preserved.
  Follow-up: full polar-cap-aware cutting for deep-arctic Eurasia Basin (currently its polar
  ring is dropped, not stitched through the pole).

---

## C. The one decision that gates everything: the render engine

The handoff mandates **CesiumJS + deck.gl**; the repo ships **three.js + Leaflet + d3-geo**
(+ orphaned maplibre-gl v2). None of the mounted renderers can do §9/§10 (GPU heatmap→cluster
→field transitions, reserve-tower LOD). Pick one before Stream C starts:

- **MapLibre GL v3+ (recommended)** — one engine for globe (v3 globe projection) + 2D + GPU +
  native clustering; fully sovereign (self-hostable style/tiles, no keys); upgrades the
  maplibre already installed; the orphaned `CockpitMap.tsx` clustering is reusable. Add
  **deck.gl** as the overlay for heatmap + reserve columns. Drop three.js globe.
- **CesiumJS** — best-in-class WGS84 globe + GPU reserve towers + LOD + camera flights (the
  max-wow 3D), self-hostable; heavier (~3 MB) and a second engine alongside Leaflet/deck.gl.
- **Keep three+leaflet+d3 + add deck.gl** — least churn, but you rebuild globe field-rendering
  and clustering by hand; weakest globe.

---

## D. Way-forward — streams, owners (Opus/Sonnet), sequencing

**Model-assignment principle:** *Opus* for novel, correctness-critical, judgment-heavy work
(geospatial algorithms, cross-source entity resolution, OSDU governance semantics, render
architecture). *Sonnet* for well-specified, pattern-following, high-volume work the handoff
already pins (dossier UI, per-source adapters, chrome/perf cleanup, search UI).

### Foundational (run first)

| Stream | Scope | Model | Why |
|---|---|---|---|
| **A · Spatial Data Integrity** | Cross-source **identity resolution / dedup** (GOGET↔NorthSea↔ANP, reviewed alias edges, never merge on name); polar-cap-aware cutting; WGS84/lat-lon validation gates; centroid-on-multipolygon fix | **OPUS** | Entity resolution + geospatial correctness = high judgment; a wrong merge corrupts the master |
| **B · OSDU Governance** | Register 5 `arganta:` schemas; internal/confidential lane end-to-end (ACL·LegalTag·dataClass·countries); public/internal manifest separation; lineage + version-on-promote | **OPUS** | Governance-correctness critical; access-control mistakes leak restricted data |
| **C-arch · Render architecture** | Decide engine (§C); design the scale-aware LOD engine (heatmap→cluster→field), reserve-tower model (§10), GPU-buffer strategy, provider-config seam, dispose-on-view-change | **OPUS** | The pivotal architectural decision; sets the ceiling for the whole map |

### Build-out (parallelize on the foundation)

| Stream | Scope | Model | Why |
|---|---|---|---|
| **C-impl · Map layers** | Implement the chosen engine's layers per C-arch: globe field points + reserve towers, 2D heatmap/cluster/field, sovereign provider config, WebGL disposal, `document.hidden` pause | **SONNET** | Mechanical once the architecture + data contracts are fixed |
| **D · OSDU search** | Generate `cockpit-search.json` in the OSDU build (fields·wells·basins·provinces·AUs·operators + aliases, punctuation-insensitive); search UI → fly-to-geometry → open dossier (§11) | **SONNET** (index gen: Opus-light) | Index shape is specified; ranking is light reasoning |
| **E · Lifecycle field dossier** | The §7-8 dossier: header badges, exploration/development/production/reserve sections, lifecycle timeline, product-split bar, `Not reported` handling, 5 contextual actions, mobile bottom sheet | **SONNET** | Fully specified in the handoff; pure information-design build |
| **F · Chrome / perf / compliance** | Delete `CockpitMap.tsx` + `CockpitVectorOverlay.tsx` (drop maplibre if unused) + orphan CSS; GOGET attribution on all views; exclude build-only manifests from `dist`; mesh redraw throttle; per-field aggregation | **SONNET** | Mechanical cleanup + pinned compliance items |
| **G · Source-lane expansion** | BOEM (US), NOPIMS (AU), Canada regulator lanes on the existing GOGET/ANP adapter pattern; formalize ANP licence string | **SONNET** | Pattern-following adapter work |

### Sequencing

1. **Wave 1 (Opus, foundational):** A + B + C-arch in parallel. These unblock everything and are where wrong calls are expensive.
2. **Wave 2 (Sonnet, parallel):** C-impl, D, E, F on top of Wave 1's contracts. G anytime.
3. **Acceptance gate:** re-run the handoff §14 checklist (no antimeridian line ✓ done; all 7,391 fields locatable; search finds field/basin/well/province; 2D/3D resolve same ID; missing data explicit; light/dark/desktop/mobile; attribution visible; sovereign provider swap).

---

## E. Definition of done (per stream, testable)

- **A:** one OSDU Field identity per real field across sources; dedup report; 0 name-only merges; 0 dateline defects incl. polar caps.
- **B:** 5 extensions registered; a confidential record never appears in a public manifest (test).
- **C:** default view shows fields; 45–60 FPS desktop pan/orbit; provider swap via config only.
- **D:** search any field/basin/well/province → flies + opens correct dossier by stable OSDU ID.
- **E:** dossier shows real GOGET context with classifications intact; `Not reported` never 0.
- **F:** `dist/` has no build-only manifest; attribution on all 3 views; no dead components.

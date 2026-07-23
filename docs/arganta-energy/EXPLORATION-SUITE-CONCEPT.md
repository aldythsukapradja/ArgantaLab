# The Exploration Suite — Full Concept

2026-07-23 · Opus. A **ground-up rewrite** of the Exploration lifecycle. The old 7 tabs (Overview/Basemap/Seismic/Wells/Interpretation/Plays&Prospects/Volumetrics/Risk) move to **Legacy**. Exploration becomes a **lightweight suite that reproduces the deterministic backbone of the real exploration software stack** (GeoX · PetroMod · MOVE · Neftex · PaleoScan · Techlog · Merak), driven by a **world petroleum database** for breadth and **Volve** as the one field you can deep-dive to full data.

Realizes [EXPLORATION-PLATFORM-ARCHITECTURE](EXPLORATION-PLATFORM-ARCHITECTURE.md) (multi-field data model, project bundles, moat) as an actual software suite. Supersedes the shallow COSMO `TAB_SPECS.exploration` menu for Exploration — the founder is redefining the taxonomy around real tools, not a vendor menu.

---

## Principle

> **Breadth from the world database, depth from Volve.** You start on a globe of the world's basins (world petroleum DB), drill **World → Region → Basin → Country → Field → Wellbore**, and as you descend, the tools light up with whatever data exists — culminating in Volve, where every tool is fully populated. Each tab is a **lightweight, transparent, evidence-native clone of one industry software** — not the proprietary 3D physics, but the deterministic skeleton the heavyweights wrap.

Two things are built **first**: the **Shell** (the hierarchy navigator) and the **Canvas** (the multi-scale viewport that zooms continuously from world globe to Volve well log). The software tabs are *lenses* that hang off that spine.

---

## Part 1 · The required tabs — mapped to industry software

Each tab reproduces the **screening-grade deterministic core** of the named tool(s); the proprietary heavy physics is cited and explicitly out of scope.

| # | Suite Tab | Industry software cloned | Lightweight core we deliver | Out of scope (cite, don't claim) |
|---|---|---|---|---|
| 0 | **Atlas** *(home)* | IHS/S&P GEPS · WoodMac Lens · Rystad UCube · USGS WEC · ArcGIS | World basins/fields/discoveries/licences map; basin stats; hierarchy entry; ventures screen | Live commercial data feeds |
| 1 | **Regional & Analogues** | Neftex · SAFARI · SAND/FAKTS | Paleogeography/GDE context, plate setting, quantitative reservoir analogues + deterministic match score | Global plate-model reconstruction (GPlates) |
| 2 | **Play Fairway** | SLB Play Chaser · ZetaWare Trinity (map charge) · PBE | Play fairway maps, Common Risk Segments (source/reservoir/seal), lead inventory, play chance | 3D basin-scale migration |
| 3 | **Basin Modeling** | PetroMod · ZetaWare Genesis/Kinex | 1D burial → decompaction → heat-flow → EasyRo maturity → generation → **charge vs trap timing** + events chart | 2D/3D Darcy/invasion-percolation migration, compositional |
| 4 | **Structure** | Petex 2D/3DMOVE | Section construction, **kinematic restoration** (shear/flexural-slip), decompaction, backstrip, trap-timing balance | 3D kinematics, geomechanical FEA, fracture nets |
| 5 | **Seismic** | Petrel · Eliis PaleoScan · dGB OpendTect | 2D lines + horizon/fault picks, attribute maps, well-tie, depth conversion, **closure/DHI detection** | Full 3D SEG-Y volume render, auto-tracking, AVO inversion |
| 6 | **Wells & Petrophysics** | Techlog · Petrel Wells | Composite logs, tops, correlation, **quick-look petrophysics** (Vsh/φ/Sw/net-pay), prognosis-vs-actual | Advanced multi-mineral/NMR/image-log processing |
| 7 | **Prospect & Risk** | SLB GeoX | Lead→Prospect maturation, area-depth GRV, **MC volumetrics P90/50/10**, GCoS = Π(chance), DHI modifier, tornado, EMV | Enterprise dependency stack |
| 8 | **Portfolio & Decision** | GeoX Portfolio · Merak Peep · PetroVR | Portfolio aggregation w/ shared play risk, **creaming curve + Yet-To-Find**, EMV ranking, drill-or-drop, farm-in economics, exploration KPIs | Full corporate fiscal modelling |

**The wedge** (unchanged from doctrine): not physics parity — **auditability + zero-install web + world-DB breadth + evidence-grounding + the cross-field calibration layer** (pre-drill vs actual, Volve = entry #1). The heavyweights own the 3D proprietary physics; we own the transparent deterministic skeleton across *every* basin.

---

## Part 2 · The Shell — the hierarchy navigator (build FIRST)

The left rail is no longer a flat Volve object tree. It is a **drill-down hierarchy** backed by the world petroleum DB:

```
World
└─ Region            (NW Europe · North Sea)              [world DB]
   └─ Basin          (Viking Graben)                      [world DB + USGS AU]
      └─ Country/Block (Norway · block 15/9)              [world DB / NSR]
         └─ Field/Discovery (Volve)                       [world DB → wb bundle]
            └─ Wellbore  (15/9-19 A · 15/9-19 SR)         [wb: full data]
```
- **Cross-cutting overlays** (facet the tree, not extra depth): **Play** (Middle Jurassic Hugin), **Petroleum System** (Draupne→Hugin→BCU), **Operator**, **Status** (lead/prospect/discovery/producing/abandoned), **Age**.
- **Data-density badge** per node: breadth nodes (a basin from the world DB) show *what's known*; Volve shows *full stack available*. Missing data is visible, never faked (doctrine).
- Selecting a node sets the **active scope**; every tab + the canvas re-point to it. Volve is simply the node with a complete `projects/volve/` bundle behind it.

---

## Part 3 · The Canvas — one continuous zoom, world → Volve (build FIRST)

The heart of the rewrite: a **multi-scale, context-aware viewport** — "Google Earth for petroleum" fused with a subsurface workstation. One canvas, five level-of-detail (LOD) regimes that swap as you descend the hierarchy:

| LOD | Scope | Canvas shows | Engine |
|---|---|---|---|
| **L0 World** | globe | Basins as choropleth (resource/maturity from world DB), great-circle context | globe / deck.gl |
| **L1 Basin** | 2D map | Fields, discoveries, creaming footprint, play fairways, licences | MapLibre + deck.gl |
| **L2 Field** | 2D map | Wells, surveys, structural surface, prospect outlines (Volve) | MapLibre + canvas grids |
| **L3 Structure** | section / 3D | Cross-section, depth surface, closure, 3D structural view | three.js (reuse Map3D/GridCube3D) |
| **L4 Well/Seismic** | tracks / line | Composite logs, seismic line, well-tie, prognosis | canvas (reuse Logs/XSection) |
- **Continuous transition**: zooming the canvas or clicking down the hierarchy animates between LODs — the "deep dive." The active **tab** decides which *overlay* renders at a given LOD (e.g. Basin Modeling at L1 draws maturity fairways; Seismic at L4 draws the line).
- **Vertical dimension unlocks at L2+**: descend from map into the subsurface (structure → section → log/seismic).
- Reuses the existing WebGL/canvas engines (Map3D, GridCube3D, XSection, LogsView) — the canvas is a *scale router* over viewers we already have, plus a globe + MapLibre basemap to add.

---

## Part 4 · Data — world DB (breadth) + Volve bundle (depth)

- **Main source = world petroleum database.** From existing work: **USGS** world assessment (public-domain, basins/AUs/undiscovered resource) + **NSR pipeline** (Sodir NO + NSTA UK → `public/nsr/*.json`) + (proprietary, private-only) IHS/WoodMac/Rystad. This populates World/Region/Basin/Country/Field breadth. *(See memory: energy-world-petroleum-db, energy-northsea-opendata.)*
- **Deep-dive = Volve** as a full **Project Data Bundle** (`projects/volve/`, generalized from `/wb` per the platform doc): wells, logs, tops, surfaces, contacts, PVT, and user-created prospect objects.
- **Contract:** every node carries `dataNature` + provenance; a field with only world-DB breadth shows breadth tools; a field with a full bundle (Volve) unlocks the whole suite. **Adding another deep-dive field = dropping a bundle, no code** (platform-doc north-star).

---

## Part 5 · Interaction model — tabs are scale-aware lenses

- The suite is not 9 disconnected screens; it's **one workspace where the tab chooses the analysis and the hierarchy/LOD chooses the subject.** Example flow (the exploration decision pipeline):
  1. **Atlas** (L0/L1): screen basins worldwide → pick Viking Graben.
  2. **Regional & Analogues** (L1): confirm the play concept + pull analogues.
  3. **Play Fairway** (L1): map source/reservoir/seal CRS → a lead.
  4. **Basin Modeling** (L1): does Draupne charge, and before the trap? (critical moment).
  5. **Seismic** + **Structure** (L3/L4): map the closure, restore trap timing.
  6. **Wells** (L4): tie to 15/9-19, quick-look petrophysics.
  7. **Prospect & Risk** (L2/L4): digitize closure → GRV → MC volumes → GCoS → EMV.
  8. **Portfolio** (L0/L1): rank Volve against the world; drill-or-drop.
- Each step writes **evidence-tagged objects** that the next step consumes — and feeds the Field-Dev handoff + the calibration library.

---

## Part 6 · Legacy handling

- Current `src/tabs/exploration/*` + `ExplorationExplorer.tsx` → **`src/tabs/exploration/legacy/`**, reachable via a **"Legacy (v1)"** entry so nothing is lost and the working engines (`explore.ts` GCoS/MC/EMV) can be lifted into Prospect & Risk.
- `explData.ts` Volve constants → demoted into the `projects/volve/` bundle.
- Keep: the evidence/data-nature spine, `exploration.css` token bridge, and every `src/engine/*`.

---

## Part 7 · Phasing (shell & canvas first, then tabs)

- **S0 · Shell + Canvas spine** — hierarchy navigator (World→Volve) + the LOD canvas router (globe → MapLibre basin/field → reuse 3D/section/logs). World-DB breadth + Volve bundle wired. **No analysis tabs yet — just navigate and see data appear.** *(This is the founder's "shell and canvas first.")*
- **S1 · Atlas + Play Fairway** — world brain + play/CRS maps (the breadth tools).
- **S2 · Prospect & Risk + Portfolio** — lift `explore.ts`; the GeoX core + creaming/YTF (the decision tools).
- **S3 · Wells & Petrophysics + Seismic** — the interpretation tools at L4.
- **S4 · Basin Modeling + Structure** — PetroMod-1D (`basin.ts`) + MOVE-2D restoration.
- **S5 · Analogues + Calibration + agent** — the cross-field moat.

---

## Part 8 · Stack additions

Reuse React/TS/Vite + existing canvas/three engines. **Add:** a globe (deck.gl `GlobeView` or a light three globe) + **MapLibre GL** basemap for L1/L2 (already the four-app target stack). World-DB tiles as GeoJSON/vector. Everything else is the existing deterministic engine set. Backend deferred (bundle-first) per platform doc.

---

## Acceptance

1. **Navigate world → Volve** in the hierarchy + canvas, LOD swapping continuously.
2. **Breadth vs depth honored** — world-DB nodes show breadth; Volve unlocks the full suite; missing data visible.
3. **Each tab is a recognizable lightweight of its industry analog**, deterministic + evidence-native.
4. **Old tabs preserved in Legacy**; engines reused.
5. **Second deep-dive field = a bundle, no code.**
6. **Doctrine intact** — deterministic engines own numbers; LLM retrieves/explains/drafts, never invents.

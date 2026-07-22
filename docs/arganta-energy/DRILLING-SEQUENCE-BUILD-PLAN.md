# Drilling Sequence — Build Plan

Rebuild the standalone **NOC Drilling Schedule** Gantt tool
(`COSMO_DRILLING_SEQUENCE.html`, "v8") as the **Drilling Sequence** lifecycle
surface inside `apps/energy` COSMO UI — dressed in COSMO tokens, organized under
COSMO_Final's 5-tab contract, and **grounded in Volve, not Al Shaheen**.

References learned: the standalone Gantt HTML (functional spec), COSMO_Final's
`drilling-sequence` view (design/contract spec), the existing Well Delivery spine
(`WELL-DELIVERY-PROPOSAL-SPEC.md`, built), and memories `cosmo-ui-migration`,
`geavision-four-app`, `arganta-energy`, `arganta-energy-visual-sop`.

---

## 0. Two sources, two roles

| Source | What it gives us | Role in the rebuild |
|---|---|---|
| **`COSMO_DRILLING_SEQUENCE.html`** (standalone, v8) | The **full working tool** — SVG rig-swimlane Gantt, dual-range time slider + histogram, cross-filtering dashboard (phase/DC/well-count/maturation/PM-tracker), canvas Field Map with bidirectional crossfilter, PM markers, revision framing. Data is Al Shaheen/NOC mock (`const D`, inlined). | **Functional blueprint.** Rebuild its mechanics + interaction model 1:1. |
| **`COSMO_Final.html` → `drilling-sequence`** | A **placeholder design-brief** only (Markdown notes in the `.ws` workspace shell). 5 tabs: Overview · Sequence · Rigs · Milestones · Revisions. Accent `#e11d74`. `DRILLING_SEQ_MD` is a rich brief that's defined-but-never-rendered. | **Content contract + COSMO chrome.** Tab structure, tokens, `.ws`/`.insp`/`.tabs` shell, identity color. |

The rebuild = **the standalone tool's engine, wearing COSMO's shell, on Volve data.**

---

## 1. The data decision (doctrine-critical)

The founder rule (memory `cosmo-ui-migration`, applied to the Data tab from a
near-identical Al Shaheen reference) is explicit: **Volve only — rebrand
everything, never use the reference's Al Shaheen tables.** So the NOC `D` object
(rigs Ensco 110/Sapphire/Al Jassra/GDI Dukhan, reservoirs KB/SH/UM/NU, Ruya DC01–DC44,
Gallaf batches) is a **layout blueprint, not a data source.**

**Volve data reality** (verified in `public/wb/index.json` + `traj-*.json`):
- 24 real wells with **x/y, TD (MD/TVD), KB, role** (producer/injector/both/none),
  `is_exploration`; 14 have trajectories, 7 have production.
- Reservoir = **Hugin** (primary) + Skagerrak/Ty (per `surfaces`/`picks`).
- **No drilling calendar dates exist anywhere in the repo** (no spud/TD dates).

Therefore the time axis cannot be "measured." Honest, doctrine-aligned framing
(six-class truth model — the platform's whole point):

- **Well universe & geometry** — the 24 wells' x/y/TD/role/reservoir → tagged
  `measured`/`reported` (drives the Field Map + well-count panels).
- **Schedule timing & sequencing** — `scenario` (planning). It comes from **approved
  Well Delivery proposals** (`DrillingScheduleItem` in `energy_drilling_sequence_v1`,
  each carrying `p50Days` + a back-link to a real Volve target/trajectory) plus
  user-editable placement. This is the genuine forward-planning content and ties
  Drilling Sequence directly to the already-built proposal spine.
- **Historical backdrop** (optional, P5) — reconstruct a Volve drilling campaign
  from public spud/TD dates *if the founder supplies them*; until then, tag any
  historical bars `interpreted` and gate them behind a toggle. Never fabricate dates
  as if measured.

**Panel remap** (Al Shaheen artifact → Volve equivalent):

| NOC panel | Al Shaheen concept | Volve remap |
|---|---|---|
| Rig lanes (4) | Ensco/Sapphire/Al Jassra/GDI | 1–2 lanes: **Mærsk Inspirer** (+ a second scenario rig slot) |
| Reservoir colors | KB/SH/UM/NU | **Hugin / Skagerrak / Ty / other** |
| Phase legend | Phase 1 / Gallaf 1–3 / Ruya | **Volve campaigns** (Development / Infill / Injector / P&A) |
| Ruya DC→WHP map | DC01→UA … | **Slot → Well** (or drop; Volve is a single platform) |
| Basis BOD/SOR/NOC | maturation gates | **reuse the proposal gates** SOR0→SOR2→BOD→APPROVED (already in `proposal-types.ts`) |
| Maturation table | RFD/RFSU by DC | **proposal maturation** (gate × well) |
| PM Tracker | post-mortem 6mo post-TD | **Post-well review tracker** keyed to Volve wells + Well Delivery's Post-Mortem tab |
| Well-count tables | IB26/IB27 DS by well/drain | **Volve well counts** by year × type (OP/WI/both) from real roles |

> **Open decision to confirm with founder:** (A — recommended) Volve-grounded as
> above; or (B) keep the NOC schedule verbatim as a demo — rejected here because it
> violates the saved Volve-only rule. Plan proceeds on A.

---

## 2. Where it plugs in

- Nav item `drilling-sequence` **already exists** in `CosmoShell.tsx`
  (pink `#e11d74`, BETA, icon `CalendarClock`) and renders `DrillingSequencePreview`.
- `DrillingSequencePreview.tsx` is today a **stub** (a flat list of emitted
  `DrillingScheduleItem`s). This plan **replaces it** with `DrillingSequenceView`
  and keeps the forward-link contract intact.
- CSS: new **`drilling-sequence.css`**, scoped under `html[data-ui="cosmo"]`,
  reusing COSMO tokens. **Never edit `cosmo-system.css`** (generated).
- **No new heavy deps.** Hand-rolled SVG Gantt + canvas map (matches the reference
  and the repo's SOP of custom premium visuals; d3-scale/d3-array already present for
  ticks/binning; tiny in-house date util — no Luxon/vis-timeline/DHTMLX).

---

## 3. Tab layout (COSMO_Final contract)

`DrillingSequenceView.tsx` — COSMO `.tabs` strip + `.ws` workspace + toggleable
`.insp` inspector, `#e11d74` identity on icons/edges/badges (chrome stays teal).

| Tab | Content |
|---|---|
| **Overview** | KPI cockpit (`.metric` tiles: wells scheduled, rig utilization %, P50 days total, wells moved/added/removed vs last rev) + rendered design-spec note (`.obs`, from `TAB_SPECS`). |
| **Sequence** | **The tool.** Time slider + histogram (top), rig-swimlane Gantt (SVG, middle, resizable splitter), cross-filtering dashboard (bottom), Field Map drawer (left). This is the money shot. |
| **Rigs** | Rig program: capability, availability windows, utilization timeline, compatibility matrix. |
| **Milestones** | RFD/RFSU/first-oil overlay on the sequence with downstream-impact + risk. |
| **Revisions** | Git-like schedule diff (rev N vs N-1): wells added/removed/moved, date/duration deltas, driver + approver. No silent overwrite. |

---

## 4. Component architecture (`src/cosmo/welldelivery/sequence/`)

```
sequence/
  schedule-model.ts      # types + Volve-grounded seed + selectors (pure)
  schedule-store.ts      # localStorage: revisions of energy_drilling_sequence_v1
  time-axis.ts           # month-index<->date, ppd, window math (pure)
  gantt-geometry.ts      # lane layout + bar styling (pure, unit-testable)
  DrillingSequenceView.tsx   # 5-tab shell (replaces DrillingSequencePreview)
  TimeSlider.tsx         # dual-range + track highlight + histogram + summary
  DrillingGantt.tsx      # SVG swimlane Gantt (bars/axis/bands/markers/tooltips)
  DrillingDashboard.tsx  # remapped panels + filter/dim engine
  DrillingFieldMap.tsx   # canvas map + bidirectional crossfilter (phase 3)
  RigsView / MilestonesView / RevisionsView.tsx
  drilling-sequence.css  # scoped COSMO styling
```

### 4.1 `schedule-model.ts` — types & seed
```ts
type Basis = 'SOR0'|'SOR1'|'SOR2'|'BOD'|'APPROVED';   // reuse proposal gates
type ActKind = 'Dev'|'WO'|'App'|'Rig';
type WellType = 'OP'|'WI'|'WD'|null;
interface ScheduleActivity {
  id: string; rigId: string;
  start: string; end: string; days: number;
  kind: ActKind; well: string; wellType: WellType;
  reservoir: 'Hugin'|'Skagerrak'|'Ty'|null;
  basis: Basis | 'ACTUAL';
  dataNature: 'measured'|'interpreted'|'scenario';
  proposalId?: string;              // back-link when sourced from a proposal
}
interface Rig { id: string; name: string; acts: ScheduleActivity[]; }
interface Milestone { rigId?: string; label: string; date: string; kind:'RFD'|'RFSU'|'FO'; }
```
- **Seed builder** merges: (1) real 24 wells (universe/geometry, from wb index),
  (2) approved `DrillingScheduleItem`s → scenario `Dev` bars sequenced on the
  Inspirer lane by `p50Days`, (3) editable user placement. Epoch anchored at the
  earliest scenario start (default "today"). Derived selectors: PM list (TD+6mo),
  window wells, histogram buckets, well-count pivot, rig utilization.

### 4.2 `DrillingGantt.tsx` — SVG engine (React-idiomatic)
Faithful to the reference, but data→bars mapping instead of manual DOM rebuild:
- Rig lanes (1–2), header axis band (year/month, `HH≈34`), `ppd = max(0.3, availW/days)`.
- Bars styled by `gantt-geometry.gs(a)`: Dev = reservoir color; WO = 50%-alpha +
  dashed; App = amber; Rig = grey (suspension = white/dashed); **WI injectors = 45°
  hatch pattern** (`<pattern>` per reservoir). Basis dot, non-FID red dot, vertical
  well label (contrast via luminance), below-bar pill by width.
- Campaign bands, RFD/milestone triangles, **TODAY** dashed red line, shared tooltip
  (well · basis badge · type · reservoir · period · days · PM-due).
- **PM markers** (pink triangles, TD≥anchor year), toggled by a `pmVisible` prop
  (class `pm-markers-on`).
- Bar click → lifts `activeFilter='well:<id>'` (crossfilter to map).

### 4.3 `TimeSlider.tsx`
Dual overlaid `range` inputs (2-month min), teal `.shlt` highlight, `.slab` label,
24m/5y/**TODAY** presets, stacked-bar histogram (per-month well counts), summary
line. Keyboard: ←/→ pan 3mo, `t` today, `1`/`2` presets.

### 4.4 `DrillingDashboard.tsx` — filter/dim engine
Port the single-`activeFilter` dim mechanism to React state: SVG gets `gantt-dimmed`,
matching bar-groups get `bar-match` (CSS `opacity:.08` vs `1`). Filter types remapped
to Volve: `reservoir:Hugin|…`, `act:Dev|WO|App|Rig`, `basis:SOR|BOD|APPROVED`,
`campaign:*`, `welltype:OP|WI`, `pm:<year>_<res>`, `well:<id>` (from map/bar). Panels:
Campaign legend (pills), Slot map, Well-count tables (real Volve roles by year),
Maturation (gate × well), **PM Tracker** (year × reservoir pivot, clickable cells).
Floating filter badge + clear.

### 4.5 `DrillingFieldMap.tsx` (phase 3)
Canvas map reusing **real Volve** surface x/y (wb index) + `traj-*.json` trajectories
(already fetched by `CosmoExplorer`). Layers: wells (OP/WI/WD colors), trajectories,
scenario future wells, labels, TODAY glow. Pan/zoom/hover + **bidirectional
crossfilter**: click well ↔ `activeFilter='well:…'`; `applyFilter` pushes matched
wellheads to the map. Graceful "geometry not loaded" state (mirrors the reference's
missing-data guard). Y-axis flipped, uniform fit scale, `devicePixelRatio`.

### 4.6 `schedule-store.ts` — revisions
Extend `energy_drilling_sequence_v1` to hold **named revision snapshots** (`IB…`-style
or Volve-appropriate `Rev N`), enabling the Revisions tab's git-like diff. Keep
`emitToDrillingSequence()` from `proposal-store.ts` as the entry point for new units.

---

## 5. Phased build order (each phase shippable)

| Phase | Deliverable | Notes |
|---|---|---|
| **P0** | `schedule-model.ts` + `time-axis.ts` + `gantt-geometry.ts` (pure) + Volve seed from proposals/wb | Unit-testable core; no UI risk |
| **P1** | `DrillingSequenceView` shell (5 tabs, COSMO chrome) + **Sequence** = `DrillingGantt` + `TimeSlider` + resizable splitter | **The money shot.** Replaces the stub |
| **P2** | `DrillingDashboard` panels + filter/dim engine + PM tracker | Cross-filtering |
| **P3** | `DrillingFieldMap` + bidirectional crossfilter | Heaviest; reuses real traj data |
| **P4** | Rigs · Milestones · Revisions tabs + revision snapshots/diff | Planning depth |
| **P5** | Overview cockpit + polish: print (`window.print`), dark mode, mobile (`max-width:820px`), optional historical backdrop | |

## 6. Fidelity checklist (from the reference)
Dual-thumb 2-month min · `ppd` floor 0.3 · injector hatch · basis/non-FID dots ·
luminance-contrast labels · campaign bands · RFD triangles · TODAY line ·
`gantt-dimmed`/`bar-match` dimming · PM markers toggle · dual-range↔histogram sync ·
map↔Gantt crossfilter · splitter min-heights (200 gantt / 80 dash) · unify the
reference's 3 inconsistent "today" constants into one config · every bar tagged
`dataNature`. **All chrome uses COSMO tokens; `#e11d74` stays the stage identity.**

## 7. Risks
1. **Data honesty** — no real Volve dates → schedule is `scenario`; must be labeled,
   not passed off as measured. (Mitigated by truth-class tagging + proposal grounding.)
2. **Scope** — this is the largest single lifecycle surface. Phasing keeps P1 alone
   as a demoable win.
3. **Volume mismatch** — Volve (24 wells, 1 platform) is far smaller than the NOC
   demo (700+ activities, 4 rigs); the tool must feel right at Volve scale (fewer
   lanes, denser info) rather than looking empty. Design P1 for that.
4. **Map dependency** — trajectory JSON is per-well and already used elsewhere; reuse
   the loader, don't refetch.

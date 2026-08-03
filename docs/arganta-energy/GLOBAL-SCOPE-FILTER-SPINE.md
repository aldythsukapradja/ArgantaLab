# The Global Scope Filter — one thread from Cockpit to Drilling

2026-08-02 · Opus. The single scope object that every surface reads, its spine, its UI, and what each layer (database · knowledge · study) digests from it. Extends [BASIN-SPINE-AND-MENTAL-MODEL](BASIN-SPINE-AND-MENTAL-MODEL.md); realises the "one scope filter" acceptance in [EXPLORATION-SUITE-CONCEPT](EXPLORATION-SUITE-CONCEPT.md).

---

## 1 · Strategy in one line

> **One `Scope` object. Every app reads it. No app owns it.**

Scope is **not** a per-tab dropdown set — it is a *session-level, persisted, URL-addressable* object that resolves to an OSDU query. Cockpit sets it broad (a province, a basin); Exploration narrows it (a play, a prospect); Field Development narrows further (a field, a reservoir); Well Delivery lands on a well. **The thread is never broken** — drilling a well always knows which prospect, play, cycle and basin it came from, which is exactly what makes the learning loop (rung 6 → rung 2) possible.

Three rules:
1. **Scope is a set of optional levels, not a strict path.** Any subset may be set.
2. **Selecting deep auto-fills ancestors.** Pick *Volve* → field, basin, province, country resolve automatically (via the ATLAS crosswalk). This makes a faceted set *feel* like a chain.
3. **Contradictions are surfaced, never silently dropped.** Pick a basin + a field outside it → the bar flags it and offers to relax one.

---

## 2 · The scope spine — 4 groups, 14 levels

Your proposed chain is right; it just isn't a single nest. Grouping it honestly is what keeps the filter from lying:

| Group | Levels | Nesting truth |
|---|---|---|
| **A · WHERE** (spatial) | Region › **Country ‖ Province** › Block | **Country and Province are parallel, not nested** — USGS provinces cross borders (the North Sea Graben spans NO/UK/DK). Block hidden until data exists. |
| **B · GEOLOGY** (the stack) | **Basin** › BasinCycle › *PetroleumSystem* › Play › **Opportunity** (lead→prospect) › Segment | `Basin 1:N Cycle`; `Play N:1 Cycle`; **`PetroleumSystem N:M Cycle` — a sibling, not a child** |
| **C · ACCUMULATION** (physical) | Field/Discovery › Reservoir › Pool | Prospect **becomes** Field on discovery — a PRMS state transition, not a parent link |
| **D · WELLS** | Well › Wellbore | **Own axis** — a well penetrates many cycles, plays, reservoirs and pools; it is *not* a child of Pool |

**Basin is the hub.** Group A answers *where am I*, B *what is this like*, C *what was found*, D *what we drilled*.

### Two refinements to your list

1. **Lead and Prospect are one entity, two states.** Model `Opportunity` with `maturity: lead | prospect | drill-ready`. Promoting a lead must not create a second record and orphan its history — PBE practice and PRMS both treat this as maturation. **The filter shows one level, not two.** (ARWANA works "leads" throughout and would promote in place.)
2. **Prospect ↔ Field is a state transition, not containment.** Keep both records, joined by `realizedAs` + PRMS class (Prospective → Contingent → Reserves). This edge *is* the calibration library: pre-drill estimate vs realised outcome.

### Facets (orthogonal to the levels)

Operator/company · PRMS class × category · status · fuel type · discovery-year range · water depth · onshore/offshore · **data availability** (breadth-only vs full bundle) · drawn **AOI polygon** (overrides administrative boundaries — how ARWANA's ~20,000 km² JS area is expressed).

### The object

```ts
interface Scope {
  where:  { region?, country?, province?, block? }
  geology:{ basin?, cycle?, petroleumSystem?, play?, opportunity?, segment? }
  accum:  { field?, reservoir?, pool? }
  wells:  { well?, wellbore? }
  facets: { operator?, prmsClass?, status?, fuel?, yearFrom?, yearTo?, depth?, dataAvailability? }
  aoi?:   GeoJSONPolygon
  resolvedAncestors: Record<Level, id>   // auto-filled, shown greyed
  conflicts: Conflict[]                   // surfaced, never silent
}
```
Serialised into the URL → every scope is shareable and reproducible. Persisted on the **Study** (scope *is* the study definition).

---

## 3 · Where the filter lives — Scope Bar + Scope Palette

**Do not render 14 levels permanently.** That is two rows of chrome for something ~90 % irrelevant at any moment. Use a two-tier UI:

### 3.1 Scope Bar — persistent, one line (~34 px), under the topbar, on **every** lifecycle surface

- Shows **only the levels that are set**, as breadcrumb chips: `Norway › Viking Graben › Hugin play › Volve`.
- Auto-filled ancestors render **greyed** (you didn't choose them; they were derived).
- Right side: **live record count in scope** ("2,143 records · 24 wells"), a **conflict badge** if any, and **Clear**.
- Each chip: click = re-pick that level, ✕ = drop it.
- This bar is the literal thread from Cockpit to Drilling — it never disappears, only changes emphasis.

### 3.2 Scope Palette — on demand (click a chip, or ⌘K)

Full picker: the 4 groups side by side, each level searchable with **live counts**, plus facets, AOI draw, and a map preview. This is where real filtering happens. Backed by the shipped `cockpit-search.json` (12,559 entries with fly-to coords).

### 3.3 Per-app emphasis (same bar, different focus)

| Surface | Groups emphasised | Greyed but still shown |
|---|---|---|
| **Cockpit** | A · WHERE + Basin | B-deep, C, D |
| **Exploration** | B · GEOLOGY (Basin→Segment) | C, D |
| **Field Development** | C · ACCUMULATION | A, B (context) |
| **Well Delivery / Drilling** | D · WELLS | A, B, C (provenance) |
| **Report / Deliverables** | whatever the study scope is | — |

### 3.4 Division of labour with the left rail
The **left rail stays the drill-down browser** (hierarchical exploration); the **Scope Bar states where you are** and enables jumps. Rail = browse, Bar = locate + filter, Palette = search + facet. No duplication.

---

## 4 · What each layer digests from a scope change

The moment scope changes, three consumers react — this is the concrete meaning of "grounded in OSDU, typed by knowledge":

| Layer | Digests | Returns |
|---|---|---|
| **L2 · Database (OSDU)** | scope → an OSDU query (predicates AND-ed; AOI as spatial predicate) | the **instances**: records, geometry, counts, coverage per data type; drives map layers + inventories |
| **L1 · Knowledge (KB)** | the *types* of what's in scope (e.g. cycleFamily = failed-rift sag) | the **semantics**: what this cycle type means, expected facies, applicable methods, **analogue cycles elsewhere**, canon citations (P0) |
| **L3 · Study** | scope as the study key | **your interpretations** in scope: CRS/CCRS, leads, GCoS, volumes — plus `stale` flags if scope moved |

**Worked example — scope = Basin “West Natuna / NB Graben”:**
- **DB** → 22 wells, 1,264 2D lines, 2 3D surveys, 8 fields nearby, coverage map, data-quality QC.
- **KB** → cycles are *extensional / rift-graben / syn-rift* → expected facies templates, thermal priors for the family, **analogue cycles worldwide with the same signature**, and the P0 citations behind each.
- **Study** → your CRS maps, 11 leads, GCF table, ranked inventory — anything upstream-stale flagged.

That is the difference between a filter and an *intelligence* filter: the DB says **what is there**, the KB says **what it is like**, the study says **what we concluded**.

---

## 5 · Final tab design (whole app, one scope)

```
GLOBAL SCOPE BAR  ─────────────────────────────────────────────  (persistent)

COMMAND      Cockpit · Foundation
LIFECYCLE    Exploration  (10)  Atlas · Data Room · Basin Framework · Seismic & Structure ·
                                Petrophysics · GDE · Basin Modeling · Play Fairway & CRS ·
                                Prospect & Risk · Deliverables
             Field Development  (planner tabs — see FD suite concept)
             Well Delivery      Basis · Trajectory · Offset · PP/FG · Ops Geology · Completion ·
                                Post-Mortem · Lessons
             Drilling Sequence  Overview · Sequence · Rigs · Milestones · Revisions
INTELLIGENCE Insights · Agents · Knowledge · Data
REPORT       Manager · Report · Document · Presentation
```
Every one of those surfaces reads the **same** `Scope`. The three typed seams (Exploration→Development→Drilling) carry scope forward with the handoff contract, so a drilled well traces back to its prospect, play, cycle and basin — and its outcome returns to the calibration library.

---

## 6 · Build order

- **S0a** — `Scope` type + resolver (scope → OSDU query) + URL serialisation + persistence on Study.
- **S0b** — **Scope Bar** in the shell (all surfaces) + ancestor auto-fill + conflict detection.
- **S0c** — **Scope Palette** with live counts over `cockpit-search.json` + AOI draw.
- **S0d** — per-app emphasis config; wire Cockpit + Exploration first (widest and deepest), then FD, WD, DS.
- Block level stays **hidden behind a flag** until licence/block data lands.

---

## 7 · Research-verified refinements (2026-08-02, two passes — see [BASIN-SPINE-AND-MENTAL-MODEL](BASIN-SPINE-AND-MENTAL-MODEL.md) §7 for sources)

- **Province is confirmed a container, not a basin** — a single province may hold multiple genetically-related basins. The `Province ⇄ Basin` crosswalk stays explicit, never merged; both set on one scope is legitimate, not a conflict.
- **TPS/AU is a sparse tier.** 937 provinces exist as containers, but only 128 (96 countries + 2 joint areas) were ever populated with TPS/AU detail. The Palette renders unassessed TPS/AU as *"not assessed"* — **never as zero** — and never blocks the geodynamic axis, which runs on Basin → BasinCycle instead.
- **Ancestor auto-fill by CODE is free, but is administrative, not spatial — this changes the resolver design.** USGS AU/TPS/province ids are a fixed 8-digit positional code, so parsing gives the accounting ancestor with zero lookups. **But USGS's own documentation confirms AU polygons cross province boundaries and overlap each other** (they needed ArcInfo *"region"* topology, not simple containment). So the resolver needs **two independent paths**:
  - *Pick by code* (search, breadcrumb click) → parse the id, instant.
  - *Pick by geometry* (map click, drawn AOI) → run a real point-in-polygon/overlap query against the layers; **expect multiple overlapping AUs at one point** and surface all of them — never silently pick one, never infer province from whatever AU code happens to sit under the cursor.
  - If the two paths disagree, that's a legitimate multi-province AU, not a conflict to resolve away.
  - USGS province/AU geometry is ~1:5,000,000 scale with 500 m fuzzy tolerance — **screening-scale only**; never resolve a well-level pick against it, only basin/province-level screening.

**Still open, highest value first:** OSDU native reference types for province/basin/play/stratigraphy (decides adopt-vs-extend — unresearched after two passes); an open global basin id registry; the `cycleFamily` controlled vocabulary. Per §7.3 of the spine doc, non-USGS classification schemes and the textbook canon remain **unverified working assumptions**, not researched findings.

# Exploration Canvas — 9-Tab Spec Sheet

**Status:** spec only, no build. **Date:** 2026-08-04.
**Companion to:** `EXPLORATION-CANVAS-CONCEPT.md` (the reasoning). This file is the reference table.

Rule applied throughout: **every one of the 27 blueprint cards survives.** Where the data supports
the card, its spec is rewritten to the maximum the data allows, using only libraries already
installed in `apps/energy`. Where it doesn't, the card stays, gets a `REMARK`, and a matching
harvest prompt in §5 that fills the gap through `ArgantaEnergy-Master-KB.xlsx`.

**Installed library set (the only allowed values in the JS Library column):**
`maplibre-gl@5` · `@deck.gl/core|layers|mapbox@9` · `d3-array` `d3-axis` `d3-contour` `d3-force`
`d3-format` `d3-geo` `d3-hierarchy` `d3-scale` `d3-selection` `d3-shape` `d3-transition` `d3-zoom` ·
`three` + `@react-three/fiber|drei` · `@equinor/videx-wellog` · `zustand` · `xlsx` · React 18.
*(No recharts, no PixiJS, no plotly in this app — do not spec them.)*

---

## 1. Master summary — the 9 tabs

| # | Group | Tab | Question it answers | Output artifact | Scope states | Data verdict | Hero chart | Live widgets |
|---|---|---|---|---|---|---|---|---|
| 1 | Basin Intelligence | **Atlas & Benchmark** | Where should we focus? | `BasinBenchmark` | World · Dossier · Compare | 🟩 **Full** | Choropleth + field-point map (179 provinces, 7,787 points) | 3 / 3 |
| 2 | Basin Intelligence | **Basin Framework** | What is this basin made of? | `BasinFramework` | Dossier · Compare | 🟨 **Full coverage, 99% recalled** | Tectonic cycle column, time-scaled (630 cycles, all 179 basins) | 3 / 3 |
| 3 | Basin Intelligence | **Basin Analog Library** | Who else looks like this? | `BasinAnalogSet` | Dossier → cohort | 🟩 **Full** | Analogue finder with per-axis similarity decomposition | 3 / 3 |
| 4 | PS Screening | **Stratigraphy & Depositional** | What did it deposit, and what role does it play? | `StratigraphicFramework` | Dossier · Compare | 🟩 **Full** | Role-coded PS column (1,544 element bars, 212 systems) | 3 / 3 |
| 5 | PS Screening | **Basin Model → *Charge Timing*** | Does the system work, and when? | `ChargeTimingCase` | Dossier | 🟥→🟩 **after redefinition** | Magoon–Dow PS events chart + critical moment (1,484 events, all 212 systems) | 2 live + 1 user-input |
| 6 | PS Screening | **Play Fairway & CRS** | How risky is the play? | `PlayFairwayAssessment` | Dossier · Compare | 🟨 **Matrix yes, map no** | Common-risk matrix, TPS × 5 factors, evidence-graded | 2 live + 1 gated |
| 7 | Opportunity | **Prospect Register** | What is on the table? | `OpportunitySet` | World · Dossier | 🟨 **Seeded, not sourced** | Register seeded with 339 AU-as-opportunity rows | 2 live + 1 user |
| 8 | Opportunity | **Volumetrics & Risk** | How big could it be? | `VolumetricCase` | Dossier → cohort | 🟨 **Empirical yes, USGS fractiles missing** | Empirical field-size distribution (3,861 fields) + fitted lognormal | 2 live + 1 assumption |
| 9 | Opportunity | **Portfolio Ranking** | What do we drill? | `ExplorationPortfolio` | World · Compare | 🟨 **Rank yes, EMV assumed** | Chance × resource bubble (339 AUs) with quadrants | 2 live + 1 assumption |

**Totals:** 27 cards · **20 fully live on current data** · 4 user-input/assumption-badged ·
3 gated on harvest (§5).

---

## 2. The (i) affordance — keeping the blueprint as reference

The blueprint text currently rendered by `WidgetBlueprintViewer` is not deleted — it moves behind an
**(i)** button in the top-right of every widget frame.

**Placement.** One (i) per widget header, plus one (i) per tab header (the tab-level
purpose / software / legacyStrength / legacyGap / output).

**Panel contents (widget-level)** — the existing `WidgetBlueprint` fields, verbatim:

| Row | Source field | Purpose |
|---|---|---|
| Purpose | `spec.purpose` | why this widget exists |
| Data source | `spec.dataSource` | **now shows both**: `PLANNED:` original string, `ACTUAL:` the resolved file + record count |
| Visual type | `spec.visual` | as-built |
| JS library | `spec.library` | as-built, from the installed set |
| Component | `spec.component` | the React component name |
| Disposition | `spec.disposition` | reuse / adapt / new / client-gated |
| Legacy reference | `spec.legacyReference` | where it came from |
| **Provenance** | *new* | `SOURCED` / `DERIVED` / `RECALLED` / `USER` + `n=` |
| **Remark** | *new* | populated only when the data is short of the blueprint |

**Type change required (no build yet, just noting it):** `WidgetBlueprint` gains
`dataSourceActual?: string`, `provenance?: 'SOURCED'|'DERIVED'|'RECALLED'|'USER'`, `n?: number`,
`remark?: string`. Nothing existing is removed, so `workflow.ts` stays valid as-is.

**Behaviour.** (i) opens a popover, not a modal — the chart stays visible behind it, because the
point of the panel is to explain *that* chart. Escape / click-away closes. The panel is the same
component for all 27 widgets.

---

## 3. Widget spec sheet — all 27 cards

Columns: **Widget** · **Data source (actual, with counts)** · **Visual** · **JS library** ·
**Component** · **Prov.** · **Remark**.
`—` in Remark = data fully supports the blueprint.

---

### TAB 1 · Atlas & Benchmark 🟩

*Purpose (i): compare the selected province/basin against the global petroleum catalogue without
requiring seismic or wells. Simplified analogue of WoodMac Lens · S&P EDIN · Rystad UCube-lite.*

| Widget | Data source (actual) | Visual | JS library | Component | Prov. | Remark |
|---|---|---|---|---|---|---|
| **Global basin position** | `world/provinces.geojson` 179 polys (`boeMean`) + `osdu/cockpit-points.geojson` 7,787 pts + `cockpit-reserve-towers` 3,861 MMBOE | Choropleth + log-sized scatter, hover card, click-to-pin | `maplibre-gl` + `@deck.gl/layers` (GeoJsonLayer, ScatterplotLayer) | `BasinBenchmarkMap` | SOURCED | — |
| **Basin scorecard** | `spine.province` 179 (`oilMean`,`gasMean`) + `scope-fields.provinces` + towers | 6 percentile bars; global distribution is the track, basin is the marker | `d3-scale`, `d3-array` (quantile), `d3-format` | `BasinScorecard` | DERIVED | Uses **mean** resource only — no fractiles. See gap **G1**. |
| **Peer-basin comparator** | signature vector §Tab 3 over all 179 basins | Ranked table + stacked per-axis similarity bar | `d3-array`, `d3-scale`, SVG | `BasinPeerComparator` | DERIVED | Similarity inherits the recalled-cycle grade; cohort chip = worst input. |

---

### TAB 2 · Basin Framework 🟨

*Purpose (i): build a map- and chronology-based tectonostratigraphic framework from public and
interpreted knowledge. Simplified analogue of Neftex · ArcGIS Pro-lite.*

| Widget | Data source (actual) | Visual | JS library | Component | Prov. | Remark |
|---|---|---|---|---|---|---|
| **Tectonic cycle column** | `spine.basinCycle` 630 across **all 179 basins** (age_top/base, geodynamics, stage, fill, lithology, climate, proximity, dominant_role, units, confidence) + `spine.geologicTimescale` 12 (ICS 2026/06) | Chronostratigraphic column on a **time axis**; fill = geodynamics, hatch = lithology, opacity = confidence; Compare mode = N columns on a shared axis | `d3-scale` (scaleLinear time), `d3-axis`, `d3-shape`, SVG | `TectonicCycleColumn` | **RECALLED** n=630 | **Two remarks.** (a) 626/630 are `literature-recalled`, only 4 `interpreted` — persistent chip required. (b) **No thickness anywhere** → the column is time-scaled, *not* depth-scaled. Depth axis blocked on gap **G5**. |
| **Framework map** | `provinces.geojson` + `scope-fields.assessmentUnits` 339 + field points | Layered 2D GIS: province fill, AU membership as point clusters, no seismic | `maplibre-gl` + `@deck.gl/layers` | `BasinFrameworkMap` | SOURCED | **AUs have no geometry** — membership is shown by point colour, not polygon. Blocked on gap **G2**. |
| **Framework evidence** | `spine.basinCompletion` 179 (`completion_pct`, `completion_stage`, `primary_gap`, `next_action`, `source_citation_ids`) + `basinCompletionRule` 7 + `citation` 69 | Ranked horizontal bars by completion_pct, coloured by stage; row expands to gap + next action | `d3-scale`, `d3-array`, CSS Grid | `FrameworkEvidencePanel` | SOURCED | — *(this widget charts our own audit; it is the honesty surface)* |

---

### TAB 3 · Basin Analog Library 🟩

*Purpose (i): find explainable basin and play analogues using cycle signature rather than hidden
similarity. Simplified analogue of C&C Reservoirs · Neftex analogue workflow-lite.*

**Signature vector (9 axes, all computable today):** geodynamic sequence (Levenshtein over ordered
`basinCycle.geodynamics`) · `basin.setting` (categorical) · fill set (Jaccard) · lithology set
(Jaccard) · age span & cycle count (numeric) · PS role profile from `psElement` counts (cosine) ·
charge-timing shape from `psEvent` critical-moment ↔ trap-formation offset (numeric) · endowment
decile from `province.boeMean` (ordinal) · realisation from field count / median MMBOE / creaming
shape (numeric).

| Widget | Data source (actual) | Visual | JS library | Component | Prov. | Remark |
|---|---|---|---|---|---|---|
| **Analogue finder** | signature over `spine.basin` 179 + `basinCycle` 630 + `psElement` 1,544 + `psEvent` 1,484 + towers | Ranked cards; similarity = **stacked horizontal bar of per-axis contribution**; click a segment to re-rank on that axis alone | `d3-array`, `d3-scale`, SVG | `BasinAnalogFinder` | DERIVED | Reuses `engine/analog.ts` scoring pattern (truth-locked). Grade capped by recalled cycles. |
| **Analogue world map** | selected cohort + province centroids | Great-circle arcs weighted by similarity, from the pinned basin | `maplibre-gl` + `@deck.gl/layers` (ArcLayer) | `BasinAnalogMap` | DERIVED | — |
| **Prior library** | cohort-pooled: towers field sizes, `field-detail.discoveryYear` 5,172, offshore share 98%, role mix | Distribution cards (histogram + fitted lognormal) + provenance table + "use as prior" handoff to tabs 8/9 | `d3-array` (bin, quantile), `d3-scale`, `d3-shape` | `AnalogPriorLibrary` | DERIVED | Priors are **empirical from discovered fields**, so they are biased to what has been found. State the bias on the card. |

---

### TAB 4 · Stratigraphy & Depositional Systems 🟩

*Purpose (i): describe source, reservoir and seal intervals from public knowledge and analogues;
no well or seismic data assumed. Simplified analogue of Neftex-lite.*

| Widget | Data source (actual) | Visual | JS library | Component | Prov. | Remark |
|---|---|---|---|---|---|---|
| **Petroleum-system column** | `spine.psElement` 1,544 (source 457 / reservoir 591 / seal 281 / overburden 215; start_ma, end_ma, effectiveness, confidence) across **all 212 models**, + `formation` 618, + timescale | Role-coded column on the ICS axis, rendered as a **second lane beside the Tab-2 cycle column** (same axis, two lanes: what the basin did ‖ what it made) | `d3-scale`, `d3-axis`, `d3-shape`, SVG | `PetroleumSystemColumn` | RECALLED/DERIVED | Roles are largely inherited/inferred; `effectiveness` is mostly `not-assessed` → render as hatch, never as a filled claim. |
| **Depositional-system matrix** | `basinCycle` fill / lithology / proximity / climate × `geologicTimescale` 12 periods | Chronology × environment heatmap; cell value = cycle count, cell hue = dominant role | `d3-scale` (scaleSequential), `d3-array` (rollup), Canvas | `DepositionalSystemMatrix` | RECALLED | It is a **count** heatmap, not a mapped facies area. Label the units on the legend. |
| **Interval evidence ledger** | `formation` 618 (aliases avg 5, occurrence_count) + `petroleumSystem.essential_elements_note` 211 narratives + `USGS AU Evidence` 272 (source_rocks / reservoir_rocks / traps_seals / maturation / migration) + `citation` 69 | Evidence table with nature badges, expandable to the authority sentence | React + CSS Grid | `IntervalEvidenceLedger` | SOURCED | — *(the USGS narrative text is the strongest sourced asset we hold)* |

---

### TAB 5 · Basin Model → **Charge Timing** 🟥→🟩

*Purpose (i, original): run transparent screening-grade burial, maturity and generation timing.
Simplified analogue of PetroMod · ZetaWare Trinity-lite.*
**Redefinition:** output changes `BasinModelCase` → `ChargeTimingCase`. The burial half is
user-input-only; the timing half ships worldwide.

| Widget | Data source (actual) | Visual | JS library | Component | Prov. | Remark |
|---|---|---|---|---|---|---|
| **1D burial model** *(kept, downgraded)* | **none available** — user-typed layer table, seeded by Tab-3 analog priors | Burial / temperature / maturity tracks, editable input grid | `d3-scale`, `d3-shape`, SVG + `zustand` | `BurialModel1D` | **USER** | **BLOCKED as an auto-populated chart.** A burial model needs present-day depth, thickness, erosion, heat flow and one calibration point (vitrinite / Tmax / corrected BHT). We hold **none** outside Volve. Ships as a sandbox badged `USER-INPUT · uncalibrated`. Unblocks on gap **G5** (thickness) + **G6** (thermal). |
| **Maturity & generation timing** → **PS events chart** | `spine.psEvent` 1,484 — **7 event types × all 212 models** (generation, expulsion, migration, accumulation, trap-formation, preservation, critical-moment) with start_ma/end_ma/certainty/notes + `psElement` bars + timescale | **Magoon–Dow petroleum-system events chart**: element bars above, process bars below, critical moment as a vertical marker; certainty → bar texture | `d3-scale`, `d3-axis`, `d3-shape`, SVG | `GenerationTimingChart` | SOURCED/DERIVED n=212 | Emitted for the **entire world** today. This is the tab's hero and the most recognisable chart in the discipline. |
| **Basin-model cases** | `psChartCompletion` 212 (`chart_row_completion_pct`, `remaining_chart_rows`, `next_gap`, `review_stage`, `model_grade`) + user cases | Case table + delta panel; ranked completion bars | React + `zustand`, `d3-scale` | `BasinModelCaseManager` | SOURCED | Doubles as the **chart-completion ledger** until user cases exist. |

**Derived bonus (no new data):** *timing-risk readout* — does trap-formation precede generation?
Interval-overlap test per TPS, one row each. That boolean **is** the timing chance factor consumed
by Tab 6.

---

### TAB 6 · Play Fairway & CRS 🟨

*Purpose (i): combine charge, reservoir, seal and trap evidence into an auditable common-risk
screen. Simplified analogue of GeoX · Play Chance Mapping-lite.*

| Widget | Data source (actual) | Visual | JS library | Component | Prov. | Remark |
|---|---|---|---|---|---|---|
| **Common-risk map** → **common-risk matrix** | derived per TPS: source/charge (`psElement` source bars + `psEvent` generation certainty) · reservoir (reservoir bars + effectiveness) · seal (seal bars) · trap (`psEvent` trap-formation certainty + `essential_elements_note` parse) · timing (Tab-5 overlap test) | **TPS × 5-factor matrix**, cell = evidence grade (not a fake probability); click → the authority sentence + citation | `d3-scale`, CSS Grid, SVG | `CommonRiskMap` | DERIVED | **A gridded fairway map is not possible.** AUs have no geometry and `Play` holds 1 row — a province-resolution "fairway" would be a lie with a legend. Unblocks on **G2** (AU polygons) + **G4** (play definitions). |
| **Chance-factor editor** | matrix above + `engine/explore.ts` GCoS core (truth-locked) | Factor matrix + probability sliders; user override written as a **separate layer**, never overwriting evidence | React + `zustand` | `ChanceFactorEditor` | USER over DERIVED | — |
| **Play calibration** | predicted chance vs outcome across the **90 provinces with ≥3 dated discoveries**; outcome proxy = discovered Σ MMBOE / (discovered + USGS undiscovered mean) | Reliability plot (binned predicted vs observed) + calibration table with n per bin | `d3-array` (bin), `d3-scale`, `d3-shape` | `PlayCalibrationPanel` | DERIVED | Outcome is a **proxy**, not a drill-success rate — we have no dry-hole record. Say so on the axis label. Real calibration needs a well-outcome dataset (**G7**). |

---

### TAB 7 · Prospect Register 🟨

*Purpose (i): maintain user-defined opportunities and their evidence without requiring seismic
interpretation. Simplified analogue of GeoX opportunity register-lite.*

| Widget | Data source (actual) | Visual | JS library | Component | Prov. | Remark |
|---|---|---|---|---|---|---|
| **Opportunity inventory** | **seeded**: 339 `assessmentUnit` rows as statistical opportunities (`oilMean`, `gasMean`, status, parent TPS chance from Tab 6) + user rows from `Opportunity` (currently 2) | Filterable register, dual-badge, inline creaming sparkline per parent basin | React + CSS Grid, `d3-shape` (sparkline) | `OpportunityRegister` | SOURCED (seed) / USER | Seeds are badged **`USGS STATISTICAL · not a mapped prospect`** and can never share a legend series with user prospects. |
| **Opportunity map** | AU member field points + province polygon | 2D map with selection linking to the register | `maplibre-gl` + `@deck.gl/layers` | `OpportunityMap` | SOURCED | No AU or prospect geometry → points only. Blocked on **G2**. |
| **Maturity gate** | `basinCompletion.primary_gap` + `psChartCompletion.next_gap` + artifact states | Stage gate (lead → prospect → drill/drop) + evidence checklist auto-ticked from what exists | React + `zustand` | `OpportunityGateTracker` | DERIVED | — |

---

### TAB 8 · Volumetrics & Risk 🟨

*Purpose (i): calculate transparent deterministic and probabilistic resources from user geometry and
cited priors. Simplified analogue of GeoX · Oracle Crystal Ball-lite.*

| Widget | Data source (actual) | Visual | JS library | Component | Prov. | Remark |
|---|---|---|---|---|---|---|
| **Volumetric input deck** | user geometry + Tab-3 analog priors + `field-detail.reserves` 4,258 fields | P90/P50/P10 parameter table (area, thickness, NTG, φ, Sw, FVF, RF) | React + `zustand` | `VolumetricInputDeck` | USER over DERIVED | Reservoir parameters (φ, Sw, NTG) exist **only for Volve**. Everywhere else they are analog priors or user input — badge each row with its origin. |
| **Resource distributions** → **empirical field-size distribution** | `cockpit-reserve-towers` **3,861 fields with real MMBOE** (p50 48.7, p90 1,193, p95 2,917, p99 17,200, max 557,000) + `field-detail.reserves` class strings | Log-x histogram + CDF + P90/P50/P10 markers + fitted lognormal overlay; **reserve-class mix as a stacked strip beneath** | `d3-array` (bin, quantile), `d3-scale` (scaleLog), `d3-shape` (line, area), Canvas | `ResourceDistributionViewer` | SOURCED n=3,861 | **170+ distinct reserve-class strings** (`2P reserves` 624, `remaining reserves` 1,505, `STOIIP` 12, `original oil in place` 145, Cyrillic `А+В1+В2+С1` …). **Never pool in-place with recoverable.** Blocked on **G3** (PRMS normalisation). |
| **Risk and value bridge** | Tab-6 GCoS × this tab's volume × assumed unit cost | Decision tree + EMV tornado | `d3-shape`, `d3-hierarchy` (tree), SVG | `RiskValueBridge` | USER/ASSUMPTION | **No cost data exists.** Single per-region unit-cost slider badged `ASSUMPTION`. Unblocks on **G8**. |

**Standing remark for this tab:** `assessmentUnit` carries `oilMean_mmbbl` / `gasMean_bcf` — **means
only, no F95/F50/F5**. Do not synthesise a spread around a mean and label it USGS. Gap **G1** is the
single highest-value fix in the whole plan.

---

### TAB 9 · Portfolio Ranking 🟨

*Purpose (i): rank opportunities under value, risk, evidence maturity and capital constraints.
Simplified analogue of GeoX · Merak Peep-lite.*

| Widget | Data source (actual) | Visual | JS library | Component | Prov. | Remark |
|---|---|---|---|---|---|---|
| **Opportunity ranking** | 339 AU seeds + user prospects; x = Tab-6 CRS composite, y = resource mean/P50, size = parent discovered endowment, colour = evidence grade | Bubble chart with median quadrant lines; brush → ranked table | `d3-scale`, `d3-array`, `d3-shape`, SVG | `OpportunityRanking` | DERIVED | In **World** mode this is a global exploration-opportunity map in one chart — the demo shot. |
| **Portfolio scenarios** | ranked set + capital slider + assumed unit cost | Efficient-frontier scatter + scenario cards | `d3-array`, `d3-scale`, SVG | `ExplorationPortfolioScenarios` | ASSUMPTION | Costs assumed → frontier badged `SCENARIO`, axis reads "assumed unit cost". Unblocks on **G8**. No dependency/correlation data exists → treat opportunities as independent and **say so**. |
| **Drill/drop record** | selected portfolio + full lineage (scope pins, facets, chart versions, provenance grade of every input) | Immutable decision memo panel | React + CSS Grid | `DrillDropDecisionRecord` | DERIVED | — *(this is the artifact the whole lineage story exists for)* |

---

## 4. Gap register

Every remark above maps to one of these. Ordered by unlock value.

| ID | Gap | Blocks | Fix route | Effort |
|---|---|---|---|---|
| **G1** | USGS AU resource **fractiles F95/F50/F5** (we hold means only, 339 AUs) | Tab 1 scorecard spread · Tab 8 probabilistic YTF · Tab 9 ranking confidence | **Transcribe** from DDS-69 / current AU publications → new workbook tab | Medium — must be transcribed, not recalled |
| **G2** | **AU polygons** (339 AUs have no geometry) | Tab 2 framework map · Tab 6 fairway map · Tab 7 opportunity map | GIS fetch from USGS spatial release → `public/world/aus.geojson` | Low — data-engineering, **not an LLM job** |
| **G3** | **Reserve-class normalisation** — 170+ free-text strings → PRMS | Tab 8 distribution pooling · every volume chart | LLM mapping table → new workbook tab | **Low — best LLM job in the list** |
| **G4** | **Play definitions** (`Play` tab = 1 row) | Tab 6 CRS at play level (currently TPS level) | LLM derivation from TPS narratives → extend `Play` tab | Medium |
| **G5** | **Layer thickness / present-day depth** per basin cycle | Tab 2 depth-scaled column · Tab 5 burial model | Literature harvest → new columns on `Basin Cycle` | High |
| **G6** | **Thermal history** (heat flow, gradient, one calibration point) | Tab 5 maturity | Literature harvest → new workbook tab | High |
| **G7** | **Exploration well outcomes** (dry holes) | Tab 6 real calibration | Regulator open data (NPD/NSTA/BOEM already partly mirrored) | Medium — data-engineering |
| **G8** | **Unit cost by region / water depth** | Tab 8 EMV · Tab 9 frontier | LLM benchmark compile → new workbook tab | Low |
| **G9** | **Basin cycle verification** — 626 `literature-recalled` → `cited` | Removes the 🟨 chip from Tabs 2, 3, 4 | LLM research per basin, top 20 by field count first | High but incremental |

---

## 5. Harvest prompts — LLM → XLSX → back into the canvas

**The round trip:**

```
LLM emits CSV (exact schema below)
  → paste as a new/updated sheet in docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx
  → add the sheet to apps/energy/scripts/build-master-kb.mjs
  → npm run data:kbxls
  → public/kb/master-kb-spine.json
  → the canvas reads it
```

```bash
npm run data:kbxls
```

### 5.0 The clause that goes in EVERY prompt

> **PROVENANCE CONTRACT — read before answering.**
> This table enters a truth-locked petroleum database. A wrong row is worse than a missing row.
> 1. Every row MUST carry `provenance` from exactly this set: `authority-transcribed` (copied from a
>    named public publication you can cite), `derived-rule` (deterministic transformation of a value
>    I supplied), `literature-recalled` (from your training data, no document in front of you),
>    `unsourced-inference` (your judgement).
> 2. Every row MUST carry `source_citation_id` and `source_reference`. If you cannot name a real,
>    checkable publication with a title and year, you MUST write `source_citation_id = NONE` and
>    `provenance = unsourced-inference`. **Do not invent a citation. Do not guess a DOI or a URL.**
> 3. Every row MUST carry `confidence` ∈ `high|medium|low` and `review_status = pending-review`.
> 4. If you do not know a value, emit the row with the cell **empty** and note why in `notes`.
>    Never interpolate, never round a guess into a plausible-looking number.
> 5. Output **CSV only** — header row, then data. No prose, no markdown fence, no commentary.
> 6. Do not reorder or rename columns. Do not add columns.

---

### 5.1 — **G3 · Reserve-class → PRMS normalisation** *(do this one first: cheapest, unblocks Tab 8)*

> You are normalising hydrocarbon volume-class labels for a petroleum database.
>
> [PROVENANCE CONTRACT — §5.0]
>
> **Input.** I will paste a list of distinct free-text `classification` strings harvested from the
> Global Oil & Gas Extraction Tracker (GOGET) `reserves[]` field, with an occurrence count each.
> They are in English, Russian (Cyrillic: `А+В1+В2+С1`, `С1+С2`, `В1`), and mixed case, and they mix
> **in-place** with **recoverable** volumes and **reserves** with **resources**.
>
> **Task.** For each input string emit exactly one row mapping it onto PRMS 2018.
>
> **Output schema (CSV, this exact header):**
> `class_id,raw_label,occurrence_count,prms_class,prms_category,volume_basis,certainty_level,poolable_group,fsu_equivalent,notes,provenance,source_citation_id,source_reference,confidence,review_status`
>
> **Column rules.**
> - `class_id` — kebab-case slug of `raw_label`, prefixed `rc-`.
> - `prms_class` ∈ `Reserves | Contingent Resources | Prospective Resources | Production | Unknown`.
> - `prms_category` ∈ `1P|2P|3P|1C|2C|3C|Low|Best|High|Proved|Probable|Possible|Unknown`.
> - `volume_basis` ∈ `recoverable | in-place | unknown`. **This is the most important column** —
>   `STOIIP`, `OIIP`, `GIIP`, `volume in place`, `geological reserves`, `oil in place` are
>   **in-place** and must never pool with recoverable.
> - `certainty_level` ∈ `low|central|high|unspecified` (P90-ish / P50-ish / P10-ish / n-a).
> - `poolable_group` — the bucket this row may be summed within. Use exactly one of:
>   `REC-LOW`, `REC-CENTRAL`, `REC-HIGH`, `INPLACE`, `CONTINGENT`, `PROSPECTIVE`, `DO-NOT-POOL`.
>   When a label is ambiguous, `DO-NOT-POOL` is the correct answer, not a guess.
> - `fsu_equivalent` — for Russian/FSU ABC1C2 labels, the standard PRMS bridge you applied
>   (e.g. `A+B1+C1 ≈ 1P/2P proved-developed bridge`); empty otherwise. FSU bridges are **conventions,
>   not equivalences** — mark them `provenance = derived-rule`, `confidence = low` unless you can cite
>   the SPE/PRMS mapping guidance you used.
>
> **Then paste this list:** *(generate it from `cockpit-field-detail.json` — the distinct
> `reserves[].classification` values with counts; ~170 rows)*
>
> **Target sheet:** new tab `Reserve Class Map` in `ArgantaEnergy-Master-KB.xlsx`.

---

### 5.2 — **G1 · USGS Assessment Unit resource fractiles**

> You are transcribing published resource assessment numbers into a petroleum database.
>
> [PROVENANCE CONTRACT — §5.0]
>
> **Hard constraint specific to this task.** These are *numbers with decimal places from published
> tables*. Recalled numbers are useless and dangerous here. If you do not have the actual USGS
> publication table in front of you (fetched, not remembered), you MUST emit the row with the
> fractile cells **empty**, `provenance = unsourced-inference`, and `notes` naming which publication
> would contain it. **A table of empty rows naming the right 339 sources is a successful answer.**
> A table of plausible numbers is a failed answer.
>
> **Input.** I will paste 339 rows: `au_code, au_name, tps_code, province_code, province_name,
> status, oilMean_mmbbl, gasMean_bcf` from our Assessment Unit tab.
>
> **Task.** For each AU, locate the USGS undiscovered-resource fractiles (F95, F50, F5, and mean) for
> oil, gas and NGL, from USGS DDS-69 series chapters, the World Petroleum Assessment 2000 fact
> sheets, or the current AU-level assessment publications. Our `USGS Publication Registry` tab
> (455 rows: province_code, publication_id, title, url) is the lookup index — use it.
>
> **Output schema (CSV, this exact header):**
> `fractile_id,au_code,au_name,commodity,f95,f50,f5,mean,unit,assessment_vintage,publication_id,table_reference,page,provenance,source_citation_id,source_reference,confidence,review_status,notes`
>
> **Column rules.**
> - One row per AU **per commodity** — `commodity` ∈ `oil|gas|ngl`. 339 AUs × 3 = up to 1,017 rows.
> - `unit` — `MMBO` for oil, `BCFG` for gas, `MMBNGL` for NGL. Do not convert units.
> - `mean` must reconcile with the `oilMean_mmbbl` / `gasMean_bcf` I supplied. **If it does not
>   match, do not adjust either number** — emit both and flag the discrepancy in `notes`. A
>   mismatch is a finding.
> - `table_reference` + `page` are mandatory when `provenance = authority-transcribed`.
> - `assessment_vintage` — the assessment year (e.g. `2000`, `2012`, `2016`), because DDS-69 chapters
>   and current publications disagree and we track both.
>
> **Target sheet:** new tab `AU Resource Fractiles`.

---

### 5.3 — **G9 · Basin cycle verification** *(run in batches of 10 basins)*

> You are upgrading inferred geological records to sourced ones.
>
> [PROVENANCE CONTRACT — §5.0]
>
> **Context.** Our `Basin Cycle` tab holds 630 rows across 179 basins. **626 of them are
> `provenance = literature-recalled`** — written from model knowledge, never checked against a
> document. Your job is to either (a) attach a real citation and promote the row to
> `authority-transcribed`, or (b) **contradict it**. Contradiction is a valuable result, not a
> failure. Do not rubber-stamp.
>
> **Input.** I will paste the existing cycle rows for 10 basins:
> `cycle_id, basin_id, basin_name, title, stage, age_top_ma, age_base_ma, geodynamics, fill,
> lithology, dominant_role, units, confidence`.
>
> **Output schema (CSV, this exact header):**
> `verification_id,cycle_id,basin_name,verdict,corrected_age_top_ma,corrected_age_base_ma,corrected_geodynamics,corrected_fill,corrected_lithology,corrected_units,mean_thickness_m,thickness_basis,publication_title,publication_authors,publication_year,publication_identifier,page_or_figure,provenance,source_citation_id,source_reference,confidence,review_status,notes`
>
> **Column rules.**
> - `verdict` ∈ `confirmed | corrected | contradicted | unverifiable`. Use `unverifiable` freely —
>   most of the world's basins do not have an accessible cycle-level synthesis.
> - `corrected_*` columns: fill **only** when `verdict = corrected`; leave empty otherwise.
> - `mean_thickness_m` + `thickness_basis` — **this is a bonus objective that unblocks gap G5.**
>   If the publication gives an interval thickness, capture it. Empty is fine; a guess is not.
> - `publication_*` must be a real, findable work. Prefer: regional basin syntheses, AAPG/GSL memoirs,
>   national geological survey reports, and USGS province chapters. If your only support is general
>   knowledge, `verdict = unverifiable`, `provenance = literature-recalled`, citation `NONE`.
>
> **Batch order:** start with the 20 provinces with the most fields — 5243 Alberta, 1174 W. Siberian,
> 4025 North Sea Graben, 4036 Anglo-Dutch, 2030 Zagros, 6098 E. Venezuela, 5305 Villahermosa,
> 2024 Mesopotamian, 6035 Campos, 6041 Putumayo-Oriente-Marañón, 7192 Niger Delta,
> 7203 West-Central Coastal, 2019 Rub al Khali, 6096 Llanos, 6055 Neuquén, 5304 Saline-Comalcalco,
> 6058 San Jorge, 3127 Bohaiwan, 4017 (per registry), 6036 (per registry).
>
> **Target sheet:** new tab `Basin Cycle Verification`; a later merge script promotes verified rows
> into `Basin Cycle` and rewrites `provenance` / `citation_status`.

---

### 5.4 — **G4 · Play definitions from TPS narratives**

> You are deriving play definitions from published petroleum-system descriptions.
>
> [PROVENANCE CONTRACT — §5.0]
>
> **Input.** I will paste, for each of 211 total petroleum systems:
> `tps_id, tps_code, tps_name, province_name, source_rock_formation, essential_elements_note`
> — the last being the USGS narrative containing `Source:` / `Reservoir:` / `Traps/seals:` sentences,
> plus the AU rows belonging to that TPS.
>
> **Task.** Decompose each TPS into 1–4 named plays. A play = a reservoir/seal/trap combination that
> would be risked as one unit. **Extract only what the narrative states.** Where the narrative names
> two distinct reservoir intervals or two trap styles, that is two plays. Where it names one, that is
> one play — do not manufacture variety.
>
> **Output schema (CSV, this exact header):**
> `play_id,name,tps_id,province_code,play_type,reservoir_unit,reservoir_age,seal_unit,trap_style,depositional_setting,charge_source_unit,cycle_id_hint,description,extracted_sentence,crs_status,provenance,source_citation_id,source_reference,confidence,review_status,notes`
>
> **Column rules.**
> - `play_id` — `atlas:play:<tps_code>:<nn>`.
> - `play_type` ∈ `structural | stratigraphic | combination | fractured-basement | unconventional-shale | unconventional-tight | unknown`.
> - `trap_style` ∈ `anticline | fault-block | salt-flank | drape | pinch-out | unconformity-truncation | reef-buildup | channel | combination | unknown`.
> - **`extracted_sentence` is mandatory** — the verbatim clause from `essential_elements_note` that
>   supports the row. If you cannot quote a supporting clause, the play does not exist: do not emit it.
> - `cycle_id_hint` — the `Basin Cycle` row whose age range brackets `reservoir_age`, if one does.
> - `crs_status` — always `unassessed` on emission; the app assigns it.
>
> **Target sheet:** extend the existing `Play` tab (currently 1 row) — same column order, appended.

---

### 5.5 — **G8 · Exploration unit-cost benchmarks**

> You are compiling cost benchmarks for exploration screening economics.
>
> [PROVENANCE CONTRACT — §5.0]
>
> **Task.** Produce a screening-grade unit-cost table by region × setting. This drives an EMV slider
> that will be labelled `ASSUMPTION` in the UI, so **wide, honest ranges beat precise, invented
> ones**. If your figure is a general industry range rather than a cited benchmark, say so —
> `provenance = literature-recalled`, `confidence = low` is an acceptable and useful row.
>
> **Output schema (CSV, this exact header):**
> `cost_id,region_code,region_name,setting,water_depth_class,exploration_well_cost_musd_low,exploration_well_cost_musd_high,appraisal_well_cost_musd_low,appraisal_well_cost_musd_high,seismic_3d_cost_usd_per_km2_low,seismic_3d_cost_usd_per_km2_high,development_capex_usd_per_boe_low,development_capex_usd_per_boe_high,opex_usd_per_boe_low,opex_usd_per_boe_high,cost_year,currency,provenance,source_citation_id,source_reference,confidence,review_status,notes`
>
> **Column rules.**
> - `region_code` / `region_name` — the 9 USGS regions: 1 Former Soviet Union, 2 Middle East & North
>   Africa, 3 Asia Pacific, 4 Europe, 5 North America, 6 Central & South America, 7 Sub-Saharan
>   Africa & Antarctica, 8 South Asia, 9 (per our Region tab).
> - `setting` ∈ `onshore | shelf | deepwater | ultra-deepwater | arctic`.
> - `water_depth_class` ∈ `n-a | <200m | 200-1500m | 1500-3000m | >3000m`.
> - `cost_year` mandatory — costs without a year are unusable.
> - Emit **ranges, never point estimates.** A row where low = high is a rejected row.
>
> **Target sheet:** new tab `Unit Cost Assumption`.

---

### 5.6 — Not LLM jobs (flagged so nobody prompts for them)

| Gap | Why an LLM must not do it |
|---|---|
| **G2 · AU polygons** | Geometry. An LLM cannot emit 339 correct polygons and will produce plausible-looking wrong ones. **Fetch the USGS spatial release** and run it through the existing `build-cockpit-spatial.mjs` pipeline. |
| **G7 · Exploration well outcomes** | A well list must come from the regulator. NPD/Sodir, NSTA, BOEM and ANP are already partly mirrored in `build-northsea.mjs` / `fetch-anp.mjs` — extend those, do not prompt for wells. |
| **G6 · Thermal history** | Heat-flow values recalled by an LLM would silently drive a maturity model. Either transcribe from a named basin-modelling paper (fold into §5.3's publication capture) or leave the burial model user-input. |

---

## 6. What this changes in code (for when we do build)

Nothing is deleted. Ordered smallest-first:

1. `workspace-blueprint/types.ts` — add 4 optional fields to `WidgetBlueprint`
   (`dataSourceActual`, `provenance`, `n`, `remark`). Existing `widget()` calls stay valid.
2. `workflow.ts` — populate those 4 fields for all 27 widgets from §3, and rename Tab 5
   (`Basin Model` → `Charge Timing`, output → `ChargeTimingCase`).
3. New `WidgetInfoPopover` component + an (i) button in the widget frame header.
4. `WidgetBlueprintViewer` becomes `WidgetCanvas` — same grid, but each card renders its chart with
   the blueprint moved behind (i). Blueprint-only rendering stays as the fallback for any widget
   without a chart yet, so the tab is never blank.
5. Scope pins (`World`/`Dossier`/`Compare`) in `HeaderBars` + a `zustand` slice; facet chips.
6. Charts, in the wave order from the concept doc.

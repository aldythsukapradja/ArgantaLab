# Exploration Workspace — Canvas Population Concept

**Status:** concept only, no build. **Date:** 2026-08-04.
**Subject:** filling the 9 Exploration sub-tabs (`src/tabs/exploration/workflow.ts`) with real charts
from the USGS + GOGET regional data we already hold.

Today `WidgetBlueprintViewer` renders 27 *descriptions* of widgets. This document decides which of
those 27 become live charts in wave 1, what each one is actually made of, and how scope/filtering
works across them.

---

## 0. Decision summary

| Question | Answer |
|---|---|
| Is the USGS/GOGET data enough for all 9 tabs? | **No — 6 of 9 can go live at 80/20 quality now, 2 need a redefinition, 1 is a user-authoring surface with no source data.** |
| What's the biggest single unlock? | The **spatial join already built**: 5,106 GOGET fields inside 179 USGS province polygons, of which **2,816 have both a discovery year and a volume**. That one join powers Atlas, Analogs, Volumetrics and Ranking. |
| What's the biggest honesty risk? | **626 of 630 basin cycles are `literature-recalled`** (model inference, not a source). They are the backbone of Framework + Stratigraphy + Analogs. Ship them, but never without a provenance chip. |
| Filter model? | **Not a filter. A scope cardinality: World (0) → Dossier (1) → Compare (2–4).** Details in §2. |
| Hard blocker to buy/fetch next? | **USGS AU fractiles (F95/F50/F5).** We hold means only. Without them there is no honest probabilistic YTF. |

---

## 1. What we actually hold

Verified by reading the files, not by assumption.

### 1.1 USGS assessment spine — `public/kb/master-kb-spine.json` (5.4 MB)

| Entity | n | Useful attributes | Verdict |
|---|---|---|---|
| region | 9 | id, code, name | complete |
| country | 96 | oilMean_mmbbl, gasMean_bcf | complete |
| province | 179 | code, name, region, **assessed Y/N, oilMean, gasMean** | complete, + polygons |
| basin | 179 | **setting** (sag/rift/…), classification_status, basis, citation | complete |
| petroleumSystem (TPS) | 211 | source_rock_formation, **essential_elements_note** (long narrative: source / reservoir / traps-seals) | rich text, 100% |
| assessmentUnit | 339 | status Assessed/Not, **oilMean, gasMean** | ⚠️ **mean only — no F95/F50/F5** |
| basinCycle | 630 | age_top/base_ma, geodynamics, stage, fill, lithology, climate, proximity, dominant_role, units, confidence | ⚠️ **626/630 `literature-recalled`** |
| psModel | 212 | grade G1…, timescale ICS 2026/06, provenance | 100% of TPS |
| psElement | 1,544 | unit_name, **role** (source 457 / reservoir 591 / seal 281 / overburden 215), start_ma, end_ma | all 212 models covered |
| psEvent | 1,484 | **7 event types × 212 models, complete grid**: generation, expulsion, migration, accumulation, trap-formation, preservation, critical-moment; start_ma/end_ma, certainty | all 212 models covered |
| formation | 618 | canonical_name, aliases (avg 5), age_hint, basin_ids, occurrence_count | usable index |
| geologicTimescale | 12 | ICS 2026/06 period boundaries | the axis for every chronology chart |
| basinCompletion | 179 | completion_pct, completion_stage, primary_gap, next_action | **self-audit data — chart it** |
| psChartCompletion | 212 | chart_row_completion_pct, remaining_chart_rows, next_gap, review_stage | **self-audit data — chart it** |
| figureRegistry / figureLinks | 557 / 935 | licence_status, redistribution_status, local_asset_path | licence-gated |
| citation | 69 | tier, verified, licence_status | provenance backbone |

### 1.2 GOGET / OSDU field layer

| File | Content | Coverage |
|---|---|---|
| `kb/master-kb-fields.json` | 8,033 fields: name, country, operator (84%), **discovery_year (67%)**, status (97%), hc_type, basin_id (53%) | no volumes here |
| `osdu/cockpit-field-detail.json` | 7,391 fields keyed by OSDU id: **reserves[] (58%)**, **production[] time series (80%, 11,501 obs, 1887→2029)**, fuelType, onshore/offshore (98%), conventional/unconventional (69%), productionStartYear (33%), fidYear (9%), owners (53%), block (31%) | the richest per-field table |
| `osdu/cockpit-reserve-towers.json` | **3,861 fields with one MMBOE-equivalent** (oil + gas@164.3 m³/boe + cond/NGL); percentiles p50 48.7, p90 1,193, p95 2,917, p99 17,200, max 557,000 | the volume axis for every chart |
| `osdu/cockpit-scope-fields.json` | province→fields (179 keys) and AU→fields (339 keys), pre-joined with lon/lat | **the join is already done** |
| `osdu/cockpit-insights.json` | match methodology + rate (65.6%), top provinces by fieldCount and boeMean | the honesty header |
| `world/provinces.geojson` | 179 polygons with prvCode, oilMean, gasMean, boeMean | the map |

**Reserve classification is messy on purpose**: 170+ distinct strings (`2P reserves` 624, `remaining reserves` 1,505, `STOIIP` 12, `original oil in place` 145, `А + В1 + В2 + С1` 2 …). Any volume chart must show the class mix, never silently pool in-place with recoverable.

### 1.3 Creaming-curve readiness (the constraint that shapes everything)

Fields inside a province with **both** a volume and a discovery year: **2,816 of 5,106**.

| Threshold | Provinces qualifying (of 179) |
|---|---|
| ≥ 30 ready fields | **19** |
| ≥ 10 | **53** |
| ≥ 3 | **90** |
| 0–2 | **89** |

Top: Alberta 855, W. Siberian 155, North Sea Graben 145, Anglo-Dutch 131, Zagros 92, E. Venezuela 89.

**Design consequence:** every basin-scoped chart needs a declared `n` and a **degrade ladder** —
full curve (n≥30) → sparse scatter with a caption (n 10–29) → discovery ticks only (n 3–9) →
"insufficient discovery record, showing peer cohort instead" (n<3). Half the world lands in the
bottom two rungs; the UI must make that a *finding*, not a blank panel.

### 1.4 Volve

Deep but singular: 11 wells, 25 wellbores, logs, trajectories, horizons, pressure, production.
**Irrelevant to a regional Exploration canvas.** Keep it in Legacy. Using Volve to fake a regional
chart is the exact hardcoding trap flagged in the Cockpit work.

---

## 2. Scope & filter model — the recommendation

**Do not build a filter. Build a scope cardinality.**

A filter is a boolean that hides things. What this workspace actually needs is *how many basins are
in the frame*, because that changes what a chart means:

```
  World         Dossier          Compare
   n = 0          n = 1           n = 2–4
   ──────        ───────         ─────────
  "where        "is this        "which of
   should        basin any       these is
   we look?"     good?"          better?"
```

### 2.1 One control, three states

The existing `ExplorationScopeBar` gains a **pin** action instead of a filter dropdown.

- **World (default, nothing pinned).** Full 179-province, 8,033-field frame. Every chart is a
  distribution or a map. This is the correct landing state for the Basin Intelligence group — you
  said you want to compare basins, so the app should open *in* the comparison.
- **Dossier (one pinned).** The canvas re-renders for that basin — but **the world never leaves**.
  Every scalar keeps its peer distribution behind it as a faint violin + percentile tick. A basin's
  20 MMBOE median field size is meaningless alone and obvious against the global p50 of 48.7.
- **Compare (2–4 pinned).** Same charts, series-coloured, small-multiple where overlay would be
  unreadable. Cap at 4 — beyond that it's a table, and the table is the World view.

Pins are global and sticky across all 9 tabs. Walking Atlas → Framework → Analogs → Charge Timing
with the same 3 basins pinned *is* the product.

### 2.2 Facets are separate, and they dim rather than remove

Six global facets, always visible as chips, never nested:

`Region (9)` · `Assessed Y/N` · `Onshore/Offshore` · `Conventional/Unconventional` ·
`Fuel type` · `Discovery era (pre-70 / 70–90 / 90–10 / post-10)`

Rule: a facet **dims** non-matching marks to 12% opacity rather than dropping them. You keep the
denominator on screen, which is where the insight is ("this basin's post-2010 discoveries are all
in the bottom decile"). Only the map's choropleth honours facets destructively, because a
half-transparent polygon reads as a data gap.

### 2.3 Cross-filter scope

Brushing a chart filters **its siblings inside the same tab only**. Never across tabs — cross-tab
cross-filtering makes state unexplainable, and this workspace's whole claim is auditability.

### 2.4 What a filtered (Dossier) basin buys you

Five questions the dossier answers that the world view cannot:

1. **How big is the prize?** Discovered endowment (Σ field MMBOE) vs USGS undiscovered mean, side by side.
2. **How mature is the hunt?** Creaming curve + discovery cadence + field-size decline through time.
3. **Does the system work, and when?** PS event chart with the critical moment, per TPS.
4. **Who else looks like this?** Analog cohort with per-axis similarity decomposition.
5. **What's left, and is it worth it?** Field-size tail vs the undiscovered mean, and where it ranks.

---

## 3. The nine tabs

Legend: 🟩 ship in wave 1 · 🟨 ship reduced, gap declared · 🟥 needs redefinition or user data.

---

### GROUP 1 — Basin Intelligence · *"Where should we focus?"*

#### 1. Atlas & Benchmark 🟩 **Strongest tab. Everything needed is on disk.**

*Scope as written:* compare the selected province/basin against the global catalogue without
seismic or wells. Output `BasinBenchmark`.

**Hero — Global basin position.** MapLibre choropleth of 179 provinces coloured by boeMean, with
deck.gl `ScatterplotLayer` of 7,787 field points sized by MMBOE (log10, clamped at p99 — the towers
file already did this maths). Hover → province card. Click → pin.
*Why it works:* one screen shows endowment (fill), realisation (point density) and scale (point
size) simultaneously. That's the 80/20 of a whole atlas product.

**Supporting — Basin scorecard.** Six percentile bars, each with the global distribution as the
track and the basin as the marker: undiscovered boeMean · discovered Σ MMBOE · field count ·
median field size · discovery span · offshore share. Every bar reads "p73 of 179".

**Supporting — Peer comparator.** Ranked table, 8 nearest peers by the §4 signature, each row
expanding into a horizontal similarity decomposition (which axes matched, which didn't).

**Data path:** `provinces.geojson` → `cockpit-scope-fields.provinces[code]` → `reserve-towers` →
`field-detail`. All four already aligned on OSDU field id.
**Gap:** none material. The 65.6% spatial match rate goes in the header, not hidden.

---

#### 2. Basin Framework 🟨 **Works worldwide, but 99% inferred — provenance chip is mandatory.**

*Scope as written:* map- and chronology-based tectonostratigraphic framework. Output `BasinFramework`.

**Hero — Tectonic cycle column.** All 179 basins have cycles (630 total, avg 3.5). Vertical
chronostratigraphic column on the ICS 2026/06 axis: each cycle a band, height = age span, fill =
`geodynamics` (rift / sag / pre-rift / inversion / passive-margin), pattern = `lithology`, right
gutter = `dominant_role` icon. Hover → fill, climate, proximity, units, citation.
In **Compare** mode this becomes the killer view: 2–4 columns side by side on a shared time axis —
you see instantly that two basins share a rift pulse but diverge at the sag stage.

**Critical constraint:** cycles carry `age_top_ma`/`age_base_ma` but **no thickness**. The column is
**time-scaled, not depth-scaled**, and must be labelled as such. Do not fake a depth axis.

**Supporting — Framework map.** Province polygon + AU membership + field points, no seismic layers.
**Supporting — Framework evidence.** The `basinCompletion` ledger charted: 179 basins ranked by
`completion_pct`, coloured by `completion_stage`, each row showing `primary_gap` and `next_action`.
*This is the most honest widget in the product* — it shows the user exactly how much of their own
framework is real.

**Gap (state it on screen):** `provenance` is `literature-recalled` for 626/630 cycles, `interpreted`
for 4 (Viking Graben). Confidence: high 360 / medium 150 / low 120. Render confidence as band
opacity, and put a persistent "recalled framework — pending source verification" chip on the panel.

---

#### 3. Basin Analog Library 🟩 **The sleeper hit. Fully computable today.**

*Scope as written:* explainable analogues by cycle signature, not hidden similarity.
Output `BasinAnalogSet`.

**The signature (per basin), all from data on disk:**

| Axis | Source | Type |
|---|---|---|
| Geodynamic sequence | ordered `basinCycle.geodynamics` | string sequence, Levenshtein |
| Basin setting | `basin.setting` | categorical |
| Fill history | `basinCycle.fill` set | Jaccard |
| Lithology mix | `basinCycle.lithology` set | Jaccard |
| Age span & cycle count | cycle ages | numeric |
| PS role profile | `psElement.element_role` counts | cosine |
| Charge timing shape | `psEvent` critical-moment vs trap-formation offset | numeric |
| Endowment class | province boeMean decile | ordinal |
| Realisation | field count, median size, creaming shape | numeric |

**Hero — Analogue finder.** Ranked cards; each card's similarity is a **stacked horizontal bar of
per-axis contributions**, so "why this analogue" is on the card, not in a tooltip. Click an axis
segment → re-rank by that axis alone.

**Supporting — Analogue world map.** Great-circle arcs from the pinned basin to its cohort, weighted
by similarity. Cheap, beautiful, and genuinely informative about how far the evidence travels.
**Supporting — Prior library.** For the selected cohort, the pooled empirical distributions worth
reusing downstream: field-size lognormal fit, discovery-year cadence, offshore share, role mix —
each with `n`, source citation and a "use as prior" action that hands off to tabs 8/9.

**Gap:** similarity inherits the recalled-cycle caveat. Show a cohort-level "evidence grade" =
worst provenance in the pair.

---

### GROUP 2 — Petroleum-System Screening · *"Can a working play exist?"*

#### 4. Stratigraphy & Depositional Systems 🟩 **1,544 element bars is a real dataset.**

*Scope as written:* source/reservoir/seal intervals from public knowledge and analogues, no wells.
Output `StratigraphicFramework`.

**Hero — Petroleum-system column.** For each of the basin's TPS, a role-coded column on the ICS
axis: 1,544 `psElement` bars (source 457 / reservoir 591 / seal 281 / overburden 215), coloured by
role, opacity by `confidence`, hatched where `effectiveness = not-assessed`. Aligned against the
basinCycle column from tab 2 — same axis, two lanes: *what the basin did* and *what it made*.

**Supporting — Depositional-system matrix.** Chronology (12 ICS periods) × environment
(`basinCycle.fill` / `lithology` / `proximity`) heatmap; cell value = cycle count, cell colour =
dominant role. In World mode it's a global facies-through-time map, which is a genuinely novel view
of the USGS corpus.

**Supporting — Interval evidence ledger.** The 618-formation registry filtered to the basin, with
alias count, occurrence count, and the parsed source/reservoir/trap sentences from
`petroleumSystem.essential_elements_note`. Nature badges: `authority` (USGS text) / `derived-rule`
(alias canonicalisation) / `recalled`.

**Gap:** no thickness, no facies polygons. The matrix is a *count* heatmap, not an area map — label
it so.

---

#### 5. Basin Model 🟥 **Cannot be built as specified. Redefine it as "Charge Timing".**

*Scope as written:* 1D burial, maturity, generation timing (PetroMod / Trinity-lite).
Output `BasinModelCase`.

**Why it fails today.** A burial model needs, per layer: present-day depth, thickness, lithology
compaction parameters, erosion, and a thermal history (heat flow or gradient) plus a calibration
point (vitrinite / Tmax / corrected BHT). **We hold none of these outside Volve.** `basinCycle` has
ages and lithology words — no thicknesses. Building a burial curve from that is fabrication, and it
would fail truth-lock on the first assertion.

**What we *do* hold is the other half of the same chart — and it's complete.** 1,484 `psEvent`
records: all 7 event types for all 212 TPS, with `start_ma`, `end_ma`, `certainty`,
`event_status` and the narrative in `notes`.

**Redefinition — rename the tab "Charge Timing", output `ChargeTimingCase`.**

**Hero — Petroleum-system events chart.** The classic Magoon–Dow chart, generated for any of 212
systems: rows = elements (source/reservoir/seal/overburden bars from tab 4) then processes
(generation, migration, accumulation, trap-formation, preservation), with the **critical moment as a
vertical marker**. Age axis, ICS periods beneath. Certainty → bar texture.
This is the single most recognisable chart in exploration geology and we can emit it for the whole
world today.

**Supporting — Timing-risk readout.** Derived, deterministic, defensible: does trap-formation
precede generation? (yes/no/overlapping) → that *is* the timing chance factor, and it feeds tab 6.
Chart as an interval-overlap diagram, one row per TPS.

**Supporting — Chart-completion ledger.** `psChartCompletion`: 212 models with
`chart_row_completion_pct`, `remaining_chart_rows`, `next_gap`. Ranked bar. Again — the audit is a
feature.

**Deferred (declared, not hidden):** the 1D burial editor stays as a **user-input sandbox** — the
user types thicknesses and heat flow, seeded by analog priors from tab 3, and the engine runs
EasyRo transparently. Badged `USER-INPUT · uncalibrated`. Never auto-populated.

---

#### 6. Play Fairway & CRS 🟨 **No fairway map is possible. A common-risk matrix is.**

*Scope as written:* charge/reservoir/seal/trap evidence → auditable common-risk screen.
Output `PlayFairwayAssessment`.

**Why the map fails.** CRS mapping needs play polygons and gridded factor surfaces. We hold
**province polygons only** — AUs have no geometry, plays don't exist as records (`Play` tab: 1 row).
A province-resolution "fairway map" would be a lie with a legend.

**What works — Hero: common-risk matrix.** TPS (rows, up to 212) × 5 factors (columns:
source/charge · reservoir · seal · trap · timing), each cell scored deterministically from evidence
we hold:

| Factor | Derivation |
|---|---|
| Source/charge | `psElement` source bars present & `psEvent` generation status/certainty |
| Reservoir | `psElement` reservoir bar count & effectiveness |
| Seal | `psElement` seal bar count & effectiveness |
| Trap | `psEvent` trap-formation certainty + narrative parse from `essential_elements_note` |
| Timing | trap-before-generation test from tab 5 |

Cell = evidence-grade colour, not a fake probability. Click → the source sentence and citation.
The user then overrides with a slider — and the override is recorded as a separate `USER` layer,
never overwriting the evidence layer.

**Supporting — Chance-factor editor.** Reuses the truth-locked `engine/explore.ts` GCoS core.
**Supporting — Play calibration.** *This one is genuinely available and rare*: predicted chance vs
outcome, using the 90 provinces with ≥3 dated discoveries. Reliability plot — x = screened chance,
y = observed discovery success proxy (discovered Σ / (discovered + undiscovered mean)). It's a
proxy and must say so, but it's a real calibration loop, which almost no screening tool exposes.

**Gap to close later:** ingest AU polygons (USGS publishes them) → the matrix becomes a map.

---

### GROUP 3 — Opportunity Evaluation · *"What should we mature?"*

#### 7. Prospect Register 🟥→🟨 **Empty by design. Seed it with AU-as-opportunity.**

*Scope as written:* user-defined opportunities without seismic. Output `OpportunitySet`.

`Opportunity` holds 2 rows. There is no worldwide prospect inventory in public data and there
shouldn't be — prospects are user IP.

**80/20 move:** seed the register with **339 "statistical opportunities"**, one per assessment unit,
carrying the USGS undiscovered mean as the resource, the parent TPS's CRS row as the chance, and
`status = Assessed / Not assessed`. Badged unmistakably: **`USGS STATISTICAL · not a mapped
prospect`**. Result: the register opens full of real, citable numbers, the user's own prospects
appear alongside as `USER · mapped`, and the two never merge in a chart legend.

**Hero — Opportunity inventory.** Filterable register, dual-badge, with an inline sparkline of the
parent basin's creaming curve per row.
**Supporting — Opportunity map.** AU-member field points + province polygon (AU geometry pending).
**Supporting — Maturity gate.** Lead → prospect → drill/drop checklist against the evidence
actually present, driven by `basinCompletion.primary_gap`.

---

#### 8. Volumetrics & Risk 🟨 **No USGS fractiles. But 3,861 real field sizes are a better prior.**

*Scope as written:* deterministic + probabilistic resources from user geometry and cited priors.
Output `VolumetricCase`.

**The gap, stated plainly:** `assessmentUnit` carries `oilMean_mmbbl` / `gasMean_bcf` — **means
only**. DDS-69 publishes F95/F50/F5 per AU; we didn't ingest them. Without them there is no honest
USGS-sourced P90/P50/P10. Do not synthesise a spread around a mean and call it USGS.

**What replaces it, and is arguably better — Hero: empirical field-size distribution.** 3,861 fields
with real MMBOE. Per basin (or cohort, when n is thin): log-x histogram + CDF + P90/P50/P10 markers
+ a fitted lognormal overlay, with `n` and the reserve-class mix shown as a stacked strip beneath
(2P 624 · remaining 1,505 · in-place 145 · … — **never pooled silently**). This is a *measured*
prior, not an assumed one, and it feeds the existing truth-locked Monte Carlo engine as the
distribution for field size.

**Supporting — Resource distributions.** The existing `engine/mc.ts` output: unrisked / recoverable
/ risked histograms + CDF, with the empirical prior ghosted behind for reality-check.
**Supporting — Risk-and-value bridge.** GCoS from tab 6 × volume from here → EMV tornado. Costs are
not in the data: expose a single per-region unit-cost slider, badged `ASSUMPTION`.

---

#### 9. Portfolio Ranking 🟨 **Ranking works. EMV needs a declared cost assumption.**

*Scope as written:* rank opportunities under value, risk, maturity and capital constraints.
Output `ExplorationPortfolio`.

**Hero — Opportunity bubble.** x = chance (tab 6 CRS composite), y = resource (tab 8 P50 or USGS
mean), size = discovered-endowment context, colour = evidence grade, one bubble per AU (339) or per
user prospect. Quadrant lines at the portfolio median. Brush → the ranked table below.
In **World** mode this is a global exploration-opportunity map in one chart — the shot that sells the
product.

**Supporting — Portfolio scenarios.** Efficient frontier under a capital slider. Costs are assumed
(see above), so the frontier is badged `SCENARIO`, and the axis label says "assumed unit cost".
**Supporting — Drill/drop record.** Immutable memo capturing scope, pins, facets, chart versions and
the evidence grade of every input. This is the artifact the whole lineage story exists for.

---

## 4. The provenance contract (non-negotiable)

Given that 626/630 cycles are recalled and the reserve classes are a 170-string mess, the canvas
lives or dies on labelling. One chip vocabulary, four values, on **every** chart panel:

| Chip | Meaning | Example |
|---|---|---|
| 🟦 `SOURCED` | Traceable to a cited authority | USGS province oilMean, GOGET reported reserves |
| 🟩 `DERIVED` | Deterministic function of sourced data, rule visible | boeMean percentile, creaming curve, similarity score |
| 🟨 `RECALLED` | Model inference pending verification | 626 basin cycles, most psElement role assignments |
| ⬜ `USER` | Typed by the user this session | burial inputs, chance overrides, cost assumption |

Two rules: (1) a chart's chip is the **worst** grade among its inputs; (2) `n` is always printed
next to the chip. A basin dossier that reads `🟨 RECALLED · n=4` is more valuable than a confident
blank.

---

## 5. Build order (80/20 waves)

**Wave 1 — the spine (4 charts, ~60% of perceived value).**
1. Atlas hero map + scorecard *(no new data work)*
2. Charge-timing PS event chart *(212 systems, complete data)*
3. Empirical field-size distribution *(3,861 fields)*
4. Creaming curve with the degrade ladder *(2,816 fields)*

**Wave 2 — the comparator.** Scope pins (World/Dossier/Compare), facet chips, peer percentile
backdrops, tectonic cycle column in Compare mode. *This is where the product becomes regional
rather than one-basin.*

**Wave 3 — the analog engine.** Signature vector, similarity decomposition, prior library handoff.

**Wave 4 — the judgement layer.** CRS matrix, calibration plot, AU-seeded register, bubble ranking,
decision record.

**Deferred, declared:** 1D burial editor (user-input only), gridded fairway map (needs AU polygons),
probabilistic YTF (needs USGS fractiles).

---

## 6. Data gaps worth closing next, ranked by unlock

1. **USGS AU fractiles F95/F50/F5** (DDS-69 tables, public) → unlocks honest YTF, real P90/P50/P10
   at AU level, and turns tab 8's prior into a validated one. *Highest value, lowest effort.*
2. **USGS AU polygons** (public GIS release) → turns the CRS matrix into the fairway map, and gives
   tab 7's opportunity map real geometry.
3. **Basin cycle verification** — convert `literature-recalled` → `cited` for the top 20 provinces
   by field count. Removes the 🟨 chip from the three tabs that lean hardest on cycles.
4. **Reserve-class normalisation** — map 170 strings onto PRMS (1P/2P/3P/2C/in-place). Mechanical,
   and it makes every volume chart poolable.
5. **A depth/thickness source** (e.g. sediment-thickness grids, published basin cross-sections) →
   the only thing standing between us and a real screening burial model.

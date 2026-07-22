# Exploration Vertical — Concept
2026-07-22 · Fable concept. The first vertical in the O&G lifecycle. Replays the real geological reasoning that took the Volve area from a regional play to a drilled discovery — grounded in the actual Volve exploration data (the 15/9-19 exploration wells, the Jurassic stratigraphy, the Draupne→Hugin→BCU petroleum system), evidence-tagged and deterministic-first.

## Framing
Field Development (V1) starts *after* discovery, with a known reservoir. **Exploration starts before the bit** — with a basin, a play idea, and uncertainty. The tab answers a geologist's real questions in sequence:
1. What is the regional geological setting? (basin, tectonics, stratigraphy)
2. Is there a working petroleum system? (source, reservoir, seal, trap, migration, timing)
3. Did the source rock cook and charge at the right time? (basin/thermal modeling)
4. Did the trap exist when the oil arrived? (palinspastic restoration)
5. Where's the prospect, how big could it be, and what's the chance? (play/prospect + risked volumetrics)
6. How mature is this play — how much is left? (creaming curve, yet-to-find)
7. Is it worth drilling? (EMV, prospect ranking)
8. Where do we put the wildcat and what do we expect? (exploration well design + prognosis)
9. **Could we have discovered Volve?** (discovery simulation — the teaching payload)

Volve is the perfect case study: it's a *real, closed-out* discovery (found 1993 by 15/9-19, produced 2008–2016), so every pre-drill estimate can be scored against the known outcome.

## Data grounding (real Volve, evidence-tagged)
- **Exploration wells (measured):** 15/9-19 A, 15/9-19 B/BT2, 15/9-19 S/SR — the actual wildcat/appraisal wells (our `is_exploration` set); full LFP logs + tops.
- **Stratigraphy (interpreted):** the 16-surface bridge = the Jurassic–Recent column. Roles: **source** = Draupne Fm (Upper Jurassic, Viking Gp — the North Sea "hot shale") + Heather Fm; **reservoir** = Hugin Fm (Middle Jurassic, Vestland Gp, shallow-marine sst) + secondary Skagerrak Fm (Triassic); **seal** = Heather/Draupne shales + the Base Cretaceous Unconformity / Shetland Gp above.
- **Structure (interpreted grids):** Hugin Top/Base, BCU, Ty, Shetland depth surfaces (the `wb/surface-*` grids) → basin-scale structural framework; faulted dome on the Sleipner Terrace, salt-influenced (Permian Zechstein).
- **Basin/thermal constants (published [PEER]/[COMMUNITY]):** regional heat flow, geothermal gradient (~110°C at ~3 km → ~37°C/km), Draupne TOC/HI, kinetics — literature, cited, `derived` outputs.
- **Creaming data (reported):** published discovery history for the 15/9 / Sleipner–Utsira area (NPD/Sodir factpages).
Data-nature law holds throughout: logs/tops = measured/interpreted; basin-model & volumetric outputs = derived; restorations, prospect risking, discovery sim = scenario. Nothing modeled is shown as measured.

## Sub-tabs (the exploration workflow)

### 1 · Regional Geology
- **Basin framework map**: the structural surfaces at basin scale (Hugin/BCU) with the regional elements — Viking Graben margin, Sleipner Terrace, Utsira High flank; major faults; the kitchen (deep graben) vs the trap (structural high).
- **Chronostratigraphic column**: the 16 surfaces as an interactive strat chart — age, lithology, depositional environment, and **petroleum-system role chips** (source/reservoir/seal/overburden) per unit. Click a unit → its evidence (which wells penetrate it, pick depths, log character).
- **Regional cross-section**: a long section (basin margin → graben) showing the megasequences and the source-kitchen-to-trap geometry.
- **Palinspastic slider** (scenario): backstrip/decompact the column to key times (end-Jurassic rifting, BCU, present) — restore structural relief to test trap timing. Labeled a reconstruction.

### 2 · Petroleum System Analysis
- **Play-elements panel**: Source (Draupne) · Reservoir (Hugin) · Seal (Heather/BCU) · Trap (faulted dome) · Migration · Timing/Preservation — each a card with the evidence (real logs/tops), a one-line assessment, and a **chance factor** (0–1) the user sets → drives POS downstream.
- **Petroleum-system events chart**: the classic timing diagram — deposition of each element vs geologic time, with the **critical moment** (generation/migration) marked, and the "does trap pre-date charge?" check tied to the palinspastic result.
- **Common Risk Segment (CRS) map**: per-element risk mapped over the area (e.g. reservoir-presence fairway, seal risk, charge access) → a composite play-fairway/POS map. Deterministic overlay of the element maps.

### 3 · Basin Modeling (1D burial + thermal + maturity)
- **Burial history** at a pseudo-well (15/9-19 location): depth-vs-time curves for each formation from the tops + a deterministic decompaction/subsidence model. `derived`.
- **Thermal & maturity**: heat-flow → temperature history → source-rock maturity via a simple, standard kinetic model (e.g. Easy%Ro / Arrhenius transformation ratio) using published Draupne kinetics + regional heat flow. Outputs: Ro(t), transformation ratio, **generation & expulsion timing**. "Did Draupne reach the oil window before/after the trap formed?" — the charge-timing verdict.
- All deterministic (no LLM), constants cited; a parameter drawer (heat flow, gradient, TOC/HI) for what-if. `derived`/`scenario`.

### 4 · Play & Prospect Volumetrics (risked)
- **Prospect definition** on the map: closure via `engine.closure` at a chosen contact (the map-based, area-depth method) → GRV.
- **Risked resource**: Monte-Carlo (`engine.mc`, seeded) over area/thickness/NTG/φ/Sw/Bo/recovery distributions → prospect **resource distribution (P90/P50/P10)**; **Chance of Success = Π(element chance factors)** from the PSE tab. Result: risked mean + a POS.
- This is the *pre-drill* Volve estimate — later scored against the realized field.

### 5 · Creaming Curve & Play Maturity
- **Creaming curve** for the 15/9 / Sleipner–Utsira play: cumulative discovered volume vs wildcat number (published discovery data, `reported`), showing the big-fields-first "cream" and where Volve sits.
- **Yet-to-find**: a simple parabolic/fractal extrapolation of the curve → remaining potential (`scenario`), with the honest caveat that YTF is an estimate.
- Play-maturity read: is this a frontier, emerging, or mature play?

### 6 · Prospect Ranking / Decision
- **EMV** = POS × NPV(success) − (1−POS) × dry-hole cost. Inputs from Play&Prospect + a dry-hole cost. A small prospect portfolio table (Volve prospect + a couple of scenario satellites) ranked by EMV/risked-resource. `scenario`.

### 7 · Exploration Well Design (the wildcat)
- **Target & prognosis**: pick a wildcat location on the structural map → predicted formation tops (from regional grid trends), predicted reservoir depth/thickness, a pore-pressure prognosis. The pre-drill "well prognosis" sheet.
- **Trajectory & program**: vertical/deviated design (reuse the Field-Dev well designer), casing/mud outline, TD criteria. `scenario`.
- **Pre-drill vs actual**: overlay the prognosis on the *real* 15/9-19 result (actual tops/logs) — the honest "how good was the prediction?" scorecard.

### 8 · Discovery Simulation (the teaching payload — ties to Foundation/training)
- **"Could you have discovered Volve?"** A guided decision-under-uncertainty: given only the regional/pre-drill inputs, the user (or an agent-run) builds the play model, defines the prospect, estimates risked resource + POS, computes EMV, and makes a **drill / no-drill** call. Then the sim **reveals the actual outcome** (15/9-19 discovery, realized in-place ≈22 MMSm³ dynamic, ~63 MMbbl produced) and scores pre-drill vs realized — calibration feedback (were you over/under-confident? was the POS right?).
- Reuses the deterministic engine end-to-end; explicitly `scenario`/training. This is where Exploration feeds **Goal 3 (training material)** — a replayable exploration case built entirely on real Volve data.

## Basin-model constants (researched, cited — for basin.ts / the Basin Modeling tab)
Tag in-app: [OFFICIAL Sodir/Equinor] · [PEER SPE/journal] · [COMMUNITY textbook]. Regional/textbook values are analogs where no Volve-well measurement exists — flagged.

**Stratigraphy (age Ma · environment · PS role):** Nordland Gp ~23–0 overburden · Utsira Fm ~15–3 shallow-marine ovb · Hordaland Gp ~34–15 marine mud seal · Shetland Gp ~100–56 marl/chalk ovb-seal · Ty Fm ~61–58 submarine-fan **2° reservoir** · **BCU ~145** regional seal-top marker · **Draupne Fm ~157–145** anoxic marine shale **1° SOURCE + top seal** · Heather Fm ~168–150 offshore shale **2° source + seal** · **Hugin Fm ~168–157** shallow-marine **1° RESERVOIR** (diachronous, younging S) · Sleipner Fm ~170–165 fluvial · Skagerrak Fm ~237–201 fluvial redbeds **2° reservoir**. [PEER Kieft/Milton; OFFICIAL Sodir]

**Source (Draupne, regional analog):** TOC ~1.7–9.6% (rich >5%); HI 65–531 (upper >350 Type II, lower II/III); oil window Ro ≈0.62–0.88% at ~3400–4400 m in the Viking Graben. At Volve depth (2.7–3.1 km) Draupne is early-mature/immature → **charge from the deep Viking Graben kitchen, not local** (surface this — it's the migration story). [PEER]

**Thermal:** reservoir ~100–110°C at ~2.75–3.12 km → gradient ~32–37°C/km; Viking Graben present-day surface heat flow ≈70 mW/m² (North Sea median 64±7); seabed T ~5°C (model top BC). [PEER Slagstad/Pascal]

**Rifting/subsidence:** main rift Late Jurassic (~157–145 Ma, syn-rift Heather/Draupne); post-rift Cretaceous–Cenozoic McKenzie thermal subsidence (β-stretching, Sclater & Christie 1980 Central-North-Sea calibration); trap = salt-collapse faulted dome on the Sleipner Terrace. [COMMUNITY/PEER]

**EASY%Ro (Sweeney & Burnham 1990) — the maturity kinetics for basin.ts:** frequency factor A = 1×10¹³ s⁻¹; **%Ro = exp(−1.6 + 3.7·F)** (F = cumulative reaction fraction 0→1); 20 parallel 1st-order reactions, Ea 34→72 kcal/mol in 2 kcal/mol steps. ⚠ The per-reaction weight fractions must be taken from the original AAPG Bull. v.74 Table 2 and normalized to 1.0 — do NOT ship the approximate reproduction from the research pass; fetch/verify the canonical weights at build time. (EasyRo%DL variant: A→2×10¹⁴, re-tuned Ea.) [PEER]

**Athy compaction (φ=φ₀·e^(−c·z), Sclater & Christie 1980) — for decompaction:** sandstone φ₀ 0.49 / c 0.27 km⁻¹; shale φ₀ 0.63 / c 0.51; shaly-sst 0.56/0.39; chalk 0.70/0.71. [COMMUNITY North Sea textbook defaults, not Volve-measured]

**Discovery/creaming:** discovery well **15/9-19 SR, 1993**, oil in Hugin; block 15/9, ~5–8 km from Sleipner Øst, WD ~80 m; Volve = a late, small (~10 MMbbl-class oil) tail on an established Sleipner gas fairway → pull exact per-wellbore discovery years from Sodir Factpages (factpages.sodir.no) for the precise creaming curve. [OFFICIAL/PEER]

**Confidence gaps to close before "real not placeholder":** (1) exact Sweeney-Burnham Table-2 weights from the print paper; (2) precise NPD lithostrat Ma per unit; (3) a Volve-well Rock-Eval TOC/HI set — the Equinor open Volve geochem logs likely hold it (could add to the mirror). Until then, the Draupne source numbers are Viking-Graben regional analogs (flag in-app).

## Engine additions (small, deterministic — reuse V1 core)
- `basin.ts` — decompaction/burial history (Athy porosity-depth), 1D heat-flow temperature, EasyRo maturity + transformation ratio. Constants cited.
- `explore.ts` — area-depth GRV from a map + contact (reuses `closure`/`grid`), risked-resource MC (reuses `mc`), POS = Π(chance factors), EMV.
- `creaming.ts` — cumulative-discovery curve + a simple YTF extrapolation.
All parity-testable in `test-engine.mjs` (burial monotonic, Ro increases with burial/time, POS∈[0,1], EMV sign sanity).

## Sub-tab config (when built)
`exploration: [regional, petroleum-system, basin-model, play-prospect, creaming, ranking, well-design, discovery-sim]` (replaces the single Overview stub).

## Phasing
Exploration is a later vertical (after V1 Field Development ships). But it's the richest *story* — and the discovery-simulation is a strong demo + training asset. Suggest: build after V1 exit, or pull **Regional Geology + Petroleum System + Discovery Simulation** forward as a lighter "exploration story" slice if a narrative demo is wanted sooner. Everything reuses the V1 engine + wb data + the 16-surface bridge — low marginal cost.

## Competitor benchmark (2026) — what we screen *toward*, not *against*
The specialist tools each own a piece of the exploration workflow. We reproduce the **deterministic backbone** they wrap in proprietary 3D physics — and we cite them as the reference-grade tools we screen *toward*, never claim parity with.

| Reference tool | Vendor | Owns | Our sub-tab | Our grade |
|---|---|---|---|---|
| **GeoX** | SLB | POS decomposition, MC volumetrics, portfolio aggregation, creaming/YTF, EMV | Petroleum System, Play&Prospect, Creaming, Ranking | screening-grade analogue (single-prospect, transparent) |
| **PetroMod** | SLB | 1D/2D/3D BPSM: burial, thermal, kinetics, generation, **Darcy/IP/hybrid migration**, charge | Basin Modeling | **1D only** (burial+EasyRo+generation timing); migration OUT |
| **ZetaWare Trinity/Genesis/Kinex** | ZetaWare | fast map-based charge, 1D thermal, fill-spill, charge risk | Basin Modeling, Play&Prospect | 1D thermal + map volumetrics analogue |
| **MOVE (2D/3DMove)** | Petex | section construction, **kinematic restoration**, decompaction, fault kinematics, fracture | Regional (palinspastic) | **2D section restoration only** (vertical-shear/flexural-slip + decompaction) |
| Beicip TemisFlow/Dionisos, Landmark Permedia, SKUA Kine3D | — | 3D migration, stratigraphic forward, 3D restoration | — | OUT of scope (cited as reference) |

### What we credibly deliver (screening/teaching grade — deterministic, cheap, browser-side)
1. **1D burial + decompaction** (Athy porosity–depth) + **EasyRo maturity / transformation ratio** + generation-window timing — a closed-form ODE, cheap; the PetroMod-1D / ZetaWare-Genesis backbone.
2. **Monte-Carlo map/area-depth volumetrics** → P90/P50/P10 (the GeoX/Trinity MC backbone).
3. **POS = Π(chance factors)** with an editable source/reservoir/seal/trap breakdown (the GeoX decomposition, without the enterprise stack).
4. **Creaming curve + simple YTF** and **EMV** = POS·NPV(success) − (1−POS)·cost (one-line arithmetic).
5. **2D section restoration** (vertical/inclined shear or flexural slip + decompaction) on a Volve line — illustrates structural balance & trap timing (the 2DMove textbook backbone).

### Explicitly OUT OF SCOPE (label; never claim to match)
- **3D Darcy/invasion-percolation migration & basin-scale charge simulation** (PetroMod / Permedia / TemisFlow) — heavy PDE/percolation, proprietary.
- **Full 3D kinematic restoration, geomechanical FEA, fracture-network prediction** (3DMove / Kine3D).
- **Compositional PVT, multi-basin portfolio aggregation with full dependency** (GeoX enterprise).
- **Stratigraphic forward modeling** (Dionisos/Badlands) and **plate-scale palinspastic reconstruction** (GPlates).

### The wedge (exploration)
Not physics parity with PetroMod or MOVE — it's **auditability + zero-install web + single-field (Volve) focus + sovereign/open data + evidence-grounding + the discovery-simulation teaching layer**. We reproduce the transparent deterministic skeleton; the heavyweights own the proprietary 3D physics, which we cite and screen toward. The **Discovery Simulation** sub-tab has *no direct competitor* — scoring a pre-drill scenario against a known outcome on open data is a teaching asset the enterprise tools don't offer. Open-source parts we can lean on for credibility: PyBacktrack (decompaction/backtracking), EasyRo (published kinetics), GemPy (implicit structural geomodeling) — all citable.

## Truth stance (the wedge, applied to exploration)
Exploration is inherently interpretive — which makes honest data-nature tagging *more* important, not less. Source/seal assignments = interpreted (cited). Basin-model maturity, risked volumes = derived. Palinspastic restorations, prospect risking, YTF, discovery sim = scenario. Every chance factor, heat-flow value, and kinetic constant is user-visible and cited. The discovery simulation's power is precisely that it scores a pre-drill *scenario* against a known *measured* outcome — turning uncertainty into calibrated learning.

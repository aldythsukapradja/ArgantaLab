# M7 — End-to-End Field Development Planner (concept & strategy)
v1.0.0 · 2026-07-22 · Fable. **Concept only.** From a new discovery to a full-field development plan — appraisal program, concept select, well count/type/trajectory, drive mechanism & pattern, spacing, drill centres, phasing, economics — each decision **deterministic/probabilistic/physics-first**, with a stated *why* and an uncertainty range, then explained and reasoned by the **AI ladder (sovereign LLM → frontier)**. Reuses every engine already built (volumetrics/MC, Grid Model, streamline sweep, FDP/break-even, analog + reconcile, decline).

## 0 · The one-line strategy
> A discovery goes in; a defensible field-development *plan with reasoning* comes out — physics computes it, analogs anchor it, judgement derisks it, and the LLM explains and challenges it. Deterministic engines are the source of truth; the LLM never invents a number, it orchestrates and reasons over runs.

## 1 · The lifecycle we automate (stage-gated, like a real operator)
`Discovery → Appraisal → Concept Select → Develop → Optimise → FID`. Each stage is a set of deterministic decisions, each carrying uncertainty and value-of-information. The planner walks the gates, showing the plan *and* what would change it.

## 2 · The decision spine — deterministic engines (each truth-lockable)
Every module: **inputs → physics/rules → recommendation → uncertainty range → the *why* → the analog/benchmark check.**

### 2.1 Discovery framing — "how big could this be?"
- From structure/seismic + the discovery well: GRV & volumetric range (built — Volumetrics/MC), fluid type, likely drive mechanisms. Output **P10/P50/P90 STOIIP + resource class**. Analog prior when data is thin (built — analog engine).

### 2.2 Appraisal well placement — value-of-information driven
- **Uncertainty map** = geostatistical kriging variance (built — geostat) + contact-depth uncertainty + fault/connectivity risk → where knowledge is thinnest.
- **VOI ranking**: place appraisal wells where retiring uncertainty most changes the *development decision* (crest extent, fluid contacts, cross-fault connectivity, deliverability). Not "where's the most oil" — "where's the most *decision-relevant doubt*."
- Output: **N appraisal wells + location + objective per well + expected uncertainty reduction**. Each well tied to the specific unknown it retires (delineate OWC / prove compartment connectivity / test kh & deliverability).

### 2.3 Concept screening — onshore vs offshore, standalone vs tieback
- Drivers: location/water-depth, volume, plateau-rate target, distance to infrastructure.
- **Onshore** → many cheaper wells, denser spacing, land drilling, phased.
- **Offshore** → fewer high-rate wells from **drill centres / platforms / subsea tiebacks**; well cost dominates → maximise rate-per-well.
- Output: 2–3 concept options with well-count implication + cost class + the trade-off.

### 2.4 Well count & spacing — two methods, reconciled
- **Drainage-area method**: area/well = f(permeability, drainage radius, time, economics); wells = productive area ÷ drainage area.
- **Deliverability method**: plateau target ÷ rate-per-well (from PI ∝ kh); wells = rate needed ÷ well rate.
- Reconcile; **optimise spacing on NPV** — more wells accelerate recovery *and* cost; optimum where the marginal well's NPV = 0 (built — FDP/econ engine + MC).
- Output: **well count + spacing (m) + rate/recovery profile**, with a P10–P90 band.

### 2.5 Well type & trajectory — vertical / slanted / horizontal
Physics decision rules + a productivity comparison:
- **Thin pay + coning risk** (thin oil column over aquifer or under gas cap) → **horizontal** (spreads drawdown, delays coning).
- **Thick, layered, moderate perm** → vertical/deviated (access more layers, cheaper).
- **Low perm** → horizontal + stimulation (contact area).
- **Low kv/kh anisotropy** → horizontal gains less vertically; consider multilaterals.
- **PI uplift**: horizontal PI (Joshi) vs vertical PI (Darcy radial) → rate multiple → economics decides. Output **well type + trajectory + expected PI uplift + why**.

### 2.6 Recovery mechanism & flood pattern
- **Drive assessment**: aquifer strength → natural water drive; gas cap; solution gas → primary RF (analog-anchored).
- **Secondary** if primary weak — waterflood or gas injection. **Pattern selection by geometry + mobility:**
  - **Peripheral / edge-water injection** — good perm, dipping, continuous, gravity-stable (fewer injectors).
  - **Pattern flood** (five-spot / line-drive / 9-spot) — low perm, large flat area, needs close injector-producer spacing.
  - **Line drive** — elongated fields.
- **Mobility ratio → sweep efficiency → pattern & VRR** (voidage replacement ratio). **Streamline sim validates sweep + injector→producer allocation** (built — streamline engine). Output: **mechanism + pattern + injector count + I:P ratio + expected sweep**.

### 2.7 Spacing, distance & drill centres
- **Injector-producer spacing** from pattern + perm + time-to-fill-up.
- **Drill centres (offshore)**: cluster wells within **step-out reach** (deviated/horizontal reach ~ a few km); minimise number of centres/platforms; reach geometry gives centre count + locations + max step-out. **Onshore**: pad drilling, surface-location constraints.
- Output: **pattern geometry, well spacing, drill-centre count + locations, step-out radius**.

### 2.8 Phasing & schedule
- Discovery → **appraisal (1–3 wells)** → **early-production system / pilot** (de-risk the flood) → **full-field ramp**. Phased drilling manages uncertainty + cash flow; the pilot proves the waterflood before full commitment (real-options value).

### 2.9 Economics & optimisation
- Every concept → capex/opex → **NPV**; optimise well count / spacing / phasing / pattern for NPV (built — FDP/opportunity/break-even + MC). Honest verdict, uncertainty band, break-even levers.

## 3 · Probabilistic & decision-quality layer
- Every decision carries a **range** (MC over geomodel + fluids + economics — built).
- **Value of Information** on the appraisal program (what each well is worth).
- **Real-options / phasing value** (flexibility to expand/stop after the pilot).
- **Decision tree**: appraisal outcomes → branch to concepts → the plan is *conditional*, not a single guess.
- Every recommendation ships with **basis + P10/P50/P90 + what would change it** (built — analog/reconcile/tornado).

## 4 · The AI ladder (your philosophy, applied)
- **Tier 0 — Deterministic / probabilistic / physics (source of truth).** All §2–§3 engines. They produce the numbers, ranges, and the plan. Truth-locked. *Nothing else is allowed to invent a number.*
- **Tier 1 — Sovereign LLM (local/cheap, private).** Orchestrates the engines (calls buildPlan/placeAppraisal/selectPattern/optimiseWells as tools), **explains every decision in plain language**, drafts the FDP narrative, runs the interactive what-if ("what if the field is 30% smaller?"), retrieves analogs from your knowledge base, and structures the reasoning. Sovereign = your data never leaves. Grounded — cites the run behind each claim.
- **Tier 2 — Frontier LLM (final touch & reasoning).** The hard judgement: **concept trade-off reasoning, red-team the plan** ("what would a top development manager challenge?"), global-analog cross-check, non-obvious risks (coning, compartmentalisation, souring, facilities bottleneck), and the executive-grade synthesis. The capstone — used sparingly, on the finished plan.
- **Hard rule:** the LLM never computes physics or writes a number; it *calls the deterministic tools and reasons over their outputs*, and every recommendation traces to a run + provenance + a review gate.

## 5 · Reuse (this is mostly assembly, not new physics)
| Need | Reuse |
|---|---|
| Volumes + uncertainty | Volumetrics + MC (built) |
| Uncertainty map for appraisal | geostat kriging variance (built) |
| Sweep / pattern validation | streamline + FV sim (built) |
| Well/spacing/phasing economics | FDP + break-even + econ (built) |
| Analog anchor + derisk + range | analog + reconcile + blind test (built) |
| Recovery-mechanism RF prior | analog by drive×lithology (built) |
| The tornado of what matters | reconcileTornado (built) |
New engines: **appraisal-VOI, well-type/PI rules, pattern-selection rules, drill-centre reach geometry, well-count/spacing optimiser** — all small, rule/physics-based, truth-lockable.

## 6 · Roadmap (F-series; Fable numerics/truth-lock → Opus impl → LLM ladder)
| Phase | Deliverable |
|---|---|
| **F1** | Discovery framing + **appraisal VOI placement** (uncertainty map → ranked appraisal wells + objectives) |
| **F2** | Concept screen (onshore/offshore) + **well count & spacing optimiser** (drainage + deliverability, NPV-optimal) |
| **F3** | **Well type & trajectory** (vertical/slanted/horizontal rules + Joshi PI uplift) + recovery mechanism |
| **F4** | **Flood pattern selection** (peripheral/pattern/line-drive) + streamline sweep validation + **drill-centre reach geometry** |
| **F5** | **Phasing & schedule** + full-field economics optimisation + the assembled FDP report object |
| **F6** | **Sovereign LLM orchestration** — explain each decision, draft the FDP narrative, interactive what-if |
| **F7** | **Frontier reasoning** — red-team, concept trade-offs, global-analog cross-check, executive synthesis |

The whole plan is a single **DevelopmentPlan** object (immutable, provenanced, versioned) — every decision, its basis, its range, and the analog/physics behind it — that the LLM ladder reads and reasons over.

## 7 · Honest positioning & limits
- **Screening / concept-select grade** — a defensible *starting point and reasoning*, not a sanctioned FDP. No detailed drilling engineering, geomechanics, facilities design, or reservoir-simulation history match at concept stage.
- Recommendations are **rules + physics + analog**, each with its uncertainty and the assumptions that would flip it.
- The value is **speed, transparency, and a reasoned range** — a competent development concept in minutes with every decision explained, not a black-box answer. The RE/manager stays in control; the tool makes the outside view and the physics cheap.

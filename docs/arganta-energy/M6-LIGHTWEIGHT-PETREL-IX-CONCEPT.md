# M6 — Lightweight Petrel/IX Reservoir Studio (concept)
v1.0.0 · 2026-07-22 · Fable. Parent: M5-STATIC-DYNAMIC-MODELING-CONCEPT.md. **Concept only.** The jump from "a Field Development app" to a **lightweight Petrel + INTERSECT-grade studio**: robust simulation, automatic benchmark vs true history, assisted history matching, uncertainty + sensitivity, and physics-driven development planning / opportunity finding (infill, sidetrack, pattern) — deterministic now, agent/LLM-orchestrated later.

## 0 · Intent & honest positioning
Look and feel of the Petrel/IX stack, but **browser-lightweight, deterministic-first, evidence-native, and reproducible**. We do **not** compete with INTERSECT on physics or scale (no compositional/thermal/unstructured/fracture/exascale-GPU). We compete on **speed, transparency, decision-focus, zero-install, and — later — an agent that drives the deterministic engines** rather than replacing them. Every result is a truth-locked run with provenance; the LLM is an orchestration seam added last, never a source of physics or numbers. *Missing data > fabricated data.*

## 1 · Gap map (Petrel/IX capability → our lightweight version)
| Capability | Petrel / IX | We have | M6 target |
|---|---|---|---|
| Structural + property modeling | full 3D geostats | **BUILT** (SIS/SGS, 3D cube) | reuse |
| Reservoir simulation | ECLIPSE/IX 3-phase black-oil, 3D, wells+schedule, aquifer | 2-phase oil-water IMPES, 2D areal | **P1** 3D black-oil-lite on the geomodel |
| Flow diagnostics / streamlines | FrontSim / 3DSL | **BUILT** (Pollock TOF + allocation) | **P4** remaining-oil + opportunity engine |
| Auto benchmark vs history | Petrel RE history-match plots | decline-only (Field Review) | **P2** sim-vs-history misfit + overlay |
| Assisted history matching | proxy/optimizer, ensemble | — | **P2** ES-MDA ensemble AHM |
| Uncertainty & optimization | experimental design + proxy + Monte Carlo | volumetric MC | **P3** design + proxy + Sobol + P10/50/90 forecast |
| Development planning / opportunities | manual well design + case studies | FDP/break-even (assumed recovery) | **P4** physics-derived infill/sidetrack + NPV optimization |
| Case manager / project tree / schedule | core UX | per-tab state | **P5** Case model + run queue + dashboards |
| Agent / automation | scripting (Ocean, Python) | — | **P6** typed tool API + LLM orchestrator |

## 2 · The architectural key: the **Case** atom + a Worker run-pool
The single idea that makes AHM, uncertainty, and optimization all compose:
- A **Case** = `{ geomodel version · fluid model (PVT) · rock-fluid (kr) · wells + schedule · numerics · aquifer/contacts · parameter multipliers }` → runs to an **immutable, provenanced Run result**. Everything is a Case; you clone, diff, and compare cases. This is exactly the Petrel/IX "case" concept, and it's what lets an optimizer or an ensemble treat "1000 runs" as "1000 cases."
- **Web Worker run-pool**: sim runs off the main thread; N workers run N cases in parallel. This is the lightweight "ensemble/optimization backbone" — history matching, uncertainty, and well-placement search are all just *"generate cases → run pool → rank."* Coarsen slider keeps single-case interactivity.
- Deterministic + seeded ⇒ every case reproducible; the Case object IS the provenance record.

## 3 · The six pillars

### P1 · Robust simulator (3D black-oil-lite)
- Lift the FV engine from 2D areal → **3D on the GridModel cube** (reuse the S4 TPFA kernel, add the K-direction + gravity).
- **Sequential-implicit (SFI)** or adaptive-implicit as the stable path (removes the IMPES CFL cliff), IMPES kept as the fast path; CPR-lite pressure preconditioning for the linear solve.
- **Compressibility + PVT tables** (have the black-oil PVT), **analytic aquifer** (Fetkovich / Carter-Tracy — cheap, and Volve had aquifer support), **gravity**, **Peaceman wells** with rate/BHP/group control on a **schedule**.
- 3-phase (gas/Rs + bubble-point) optional — Volve is undersaturated so oil-water is the honest default.
- Truth-lock: SPE1 (3-phase), Buckley-Leverett, five-spot, material balance, analytic aquifer influx.

### P2 · Automatic benchmark & assisted history matching (AHM)
- **Misfit engine**: weighted least-squares of simulated vs **real Volve** oil/water/gas rates, BHP, water-cut, GOR — per well + field, with measurement-error weighting → one objective + per-observation residual plots. The **benchmark view auto-overlays sim vs history** and scores the match (this alone is a headline feature: "how well does my model reproduce reality?").
- **Assisted history matching via ES-MDA** (Ensemble Smoother, Multiple Data Assimilation) — gradient-free, parallel (perfect for the worker pool), and it returns a **posterior ensemble**: history-matched *and* its uncertainty, for free. Modern industry-standard AHM. (CMA-ES as a single-best-match alternative.)
- **Tunable parameters**: regional permeability multipliers, kr endpoints/exponents, pore-volume multipliers, aquifer strength, contacts (fault transmissibility later).
- Output: matched ensemble, prior→posterior parameter distributions, match quality, and a **calibrated forecast ensemble** (this is what makes the forecast trustworthy — vs the honest 61% blind-test MAPE of pure DCA today).
- Truth-lock: on a synthetic "truth" case, ES-MDA recovers the true parameters and collapses the misfit.

### P3 · Uncertainty & sensitivity
- **Experimental design** (Latin-Hypercube / Plackett-Burman) → run cases in the pool → **proxy/response-surface (or a small GP)** → cheap Monte Carlo on the proxy → **P10/50/90 production + reserves**.
- **Sensitivity**: Morris elementary-effects (cheap screening tornado) → **Sobol indices** (variance-based, main + interaction) on the proxy. This is Petrel's Uncertainty & Optimization module, lightweight.
- Reuse the existing seeded MC engine; add the design + proxy layer.
- Truth-lock: Sobol on an analytic function recovers known indices; proxy R² gate.

### P4 · Opportunity finder & development planning (the wedge)
This is where streamlines earn their keep — it's what 3DSL/FrontSim exist for.
- **Flow-diagnostics / remaining-oil map**: from streamlines + saturation — swept vs unswept volume, TOF-based drainage per well, injector→producer allocation & efficiency, **attic / undrained / bypassed oil**.
- **Automatic opportunity detection**: rank regions by *remaining mobile oil × poor drainage* → candidate targets. Auto-propose, ranked by incremental NPV:
  - **Infill producers** at high-remaining, low-drainage cells.
  - **Sidetracks** from existing wellbores toward the nearest attic/unswept pocket (reuse the Map well-designer + trajectory).
  - **Injector conversions / pattern rebalancing** (streamline rate optimization — reallocate injection to under-swept producers).
- **Well-placement optimization**: gradient-free (CMA-ES / pattern search) or streamline analytic rate-optimization, objective = field NPV; each candidate is a Case → run-pool → economics → rank.
- Feeds the **existing FDP / break-even / opportunity engine** (already built) — but now the incremental-recovery numbers are **physics-derived**, not assumed. The "can we save Volve?" answer becomes model-grounded.
- Truth-lock: on a synthetic case with a known unswept region, the finder flags it; NPV ranking is monotone in incremental oil.

### P5 · The Petrel/IX-like UX
- **Project tree** (wells · surfaces · grids · properties · fluids · cases · results) — the Petrel left-hand navigator.
- **Domain windows**: map · intersection · 3D · well-section · function (kr/PVT curves) · **results** (line plots, bubble maps, recovery).
- **Case manager**: create / clone / diff / run / compare cases; a run-queue on the worker pool.
- **Schedule editor** (well events over time).
- **Results dashboards**: sim-vs-history overlays, field/well rate/pressure/watercut, recovery, tornado, ensemble fans.
- Keep the engineering-control-room aesthetic + evidence badges (not SaaS chrome).

### P6 · The agent / LLM seam (last)
- The deterministic engines expose a **typed tool API**: `buildCase · runSim · benchmark · historyMatch · uncertainty · findOpportunities · optimizeWells · evaluateFDP`.
- An **LLM orchestrator** calls these tools, explains results, drafts the development-plan narrative, and proposes *what to try next* — but **never computes physics or writes a number**. Every agent action = a deterministic run + provenance + a human review gate. This is the Arganta Core / AURA seam, finally grounded in real reservoir tools. Physics-driven now; agent-driven on top, not instead.

## 4 · Mapping to the GeaVision four-app arch
- **P1 · P4 · P5** (sim, opportunity, dev planning, case UX) → **Field Development**.
- **P2 · P3** (history match, uncertainty, surveillance benchmark) → **Reservoir Management**.
- The shared **Case + engine + worker-pool** backbone spans both apps.

## 5 · Roadmap (H-series; Fable numerics/truth-lock → Opus impl)
| Phase | Deliverable |
|---|---|
| **H1** | Case model + Web Worker run-pool + a results dashboard (the backbone everything hangs on) |
| **H2** | 3D black-oil-lite sim on the GridModel + analytic aquifer + schedule (P1) + SPE1/aquifer truth-lock |
| **H3** | Misfit engine + auto **benchmark overlay** vs real Volve history + match score (P2.1) |
| **H4** | **ES-MDA assisted history matching** → posterior ensemble + calibrated forecast (P2.2) |
| **H5** | Experimental design + proxy + **Sobol/Morris sensitivity** + P10/50/90 (P3) |
| **H6** | Streamline **remaining-oil map + opportunity finder** (infill/sidetrack) + well-placement NPV optimization (P4) |
| **H7** | UX consolidation — project tree, case manager, schedule editor, dashboards (P5) |
| **H8** | Agent **tool API + LLM orchestrator** seam (P6) |

Recommended first cut: **H1 → H3** gives the "wow" fast — a real case manager, 3D sim, and an automatic sim-vs-true-history benchmark. **H4 (ES-MDA)** is the credibility unlock (history-matched forecast with uncertainty). **H6** is the commercial wedge (auto-found infill/sidetrack opportunities with NPV).

## 6 · Honest limits (state them plainly, always)
- Not INTERSECT physics: no compositional/thermal/unstructured/fracture/near-well/exascale. Screening + teaching + decision grade.
- 3D sim capped to ~10–100k cells for interactivity (coarsen; worker/WASM for bigger later).
- AHM over a modest parameter set — not a 29-fault field fully calibrated; the posterior is honest about what it did and didn't constrain.
- Proxy-based uncertainty carries proxy error; report the proxy R² and fall back to direct runs when it's poor.
- Every forecast still carries its blind-test / match-quality score. The tool never hides how much to trust it.

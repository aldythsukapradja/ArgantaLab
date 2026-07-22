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

## 5 · Roadmap (H-series; Fable numerics/truth-lock → Opus impl) — TUNED to the benchmark
The measured O(N²) wall means **performance is the gate**, so the solver/time-stepping overhaul (H1) now leads — nothing downstream (3D, ensembles, AHM) is possible without it.

| Phase | Deliverable | Target / gate |
|---|---|---|
| **H1 · Performance core** | Preconditioned pressure solve (CPR / AMG-lite → near-linear) + **sequential-implicit** saturation (kills the CFL sub-step explosion) + **Web-Worker run-pool** + the Case atom | **~50k cells < 5 s/run**; ensembles off the main thread; truth-lock unchanged (breakthrough/mass-balance still pass) |
| **H2 · 3D black-oil-lite** | Lift FV to 3D on the GridModel + gravity + analytic aquifer + schedule (P1) | SPE1 + aquifer-influx analytic truth-lock; 16k-cell 3D case interactive |
| **H3 · Auto-benchmark** | Misfit engine + **sim-vs-real-Volve overlay** + NRMS score (P2.1) | **first honest sim-vs-Volve accuracy number** — the answer to "how accurate is it" |
| **H4 · Assisted HM** | **ES-MDA** → posterior ensemble + calibrated forecast (P2.2) | field oil-rate **NRMS < ~1–2**, posterior brackets history, blind-check improves |
| **H5 · Uncertainty & sensitivity** | Experimental design + proxy + **Sobol/Morris** + P10/50/90 (P3) | Sobol recovers analytic indices; proxy R² gate |
| **H6 · Opportunity finder** | Streamline **remaining-oil map** + infill/sidetrack finder + well-placement NPV optimization (P4) | flags a known unswept region; NPV ranking monotone; feeds the built FDP engine |
| **H7 · Studio UX** | Project tree, case manager, schedule editor, results dashboards (P5) | — |
| **H8 · Agent seam** | Typed tool API + LLM orchestrator over deterministic engines (P6) | every agent action = a provenanced run + review gate |

**Sequence rationale (post-benchmark):** **H1 is non-negotiable and first** — it converts the engine from a ~1k-cell toy into a ~50k-cell tool and is the prerequisite for 3D and for every ensemble method. **H3** is what finally lets us *quote* accuracy vs Volve (today we can't). **H4** is the credibility unlock. **H6** is the commercial wedge. UX (H7) can interleave once H1 lands.

## 5b · Reality check — MEASURED performance & honest accuracy (2026-07-22)
Benchmarked the current 2D oil-water IMPES engine on this machine (Node/V8 ≈ laptop browser), waterflood to 1.2 PVI, 24 report steps:

| grid | cells | time | notes |
|---|---|---|---|
| 20×20 | 400 | **0.25 s** | interactive |
| 30×30 | 900 | **1.1 s** | comfortable one-shot |
| 40×40 | 1,600 | **3.7 s** | usable, noticeable freeze |
| 55×55 | 3,025 | **21 s** | painful |
| 70×70 | 4,900 | **36 s** | impractical |
| 90×90 | 8,100 | **>50 s** | did not finish |

**Scaling is ~O(N²)** — two compounding causes: (1) the pressure solve is **unpreconditioned CG** (iterations grow with grid size, made worse by the stiff well penalty); (2) point injection forces the **CFL sub-step count to grow ∝ N**, each sub-step O(N). So the current engine comfortably handles **~1,000 cells interactively, ~1,600 as a one-shot, and falls apart past ~3,000.** The Field Review/Volumetrics sweep runs use ~400–900-cell grids on purpose → sub-second.

**This is the finding that reshapes the plan:** a credible 3D model (e.g. 40×40×10 = 16k cells) is *far* beyond today's engine. The **solver + time-stepping overhaul is therefore a prerequisite, not a nicety** — it's the difference between 1k and 100k cells. Two fixes unlock it: a **preconditioned/multigrid pressure solve** (CPR/AMG-lite → near-linear scaling) and **implicit/sequential-implicit saturation** (removes the CFL sub-step explosion). Target after the overhaul: **~50k cells in <5 s/run**, and with the **Web-Worker pool**, ensembles of such runs off the main thread.

**H1 DONE (partial), MEASURED (commit 6b58d005):** Jacobi-PCG + sequential-implicit transport (implicit upstream saturation via nonlinear Gauss-Seidel + bisection local solve). Truth-lock preserved (45/45; breakthrough 0.500 vs Welge 0.503). New scaling ≈ **O(N^1.5)** (was O(N²)):

| cells | IMPES (before) | Implicit (now) |
|---|---|---|
| 900 | 1.1 s | **0.67 s** |
| 4,900 | 36 s | **8 s** |
| 10,000 | DNF | **22 s** |
| 20,000 | — | **55 s** |

Engine practical range lifted from ~1.6k → ~10k cells. **Remaining gap to the 50k/<5s target:** the GS sweep count (front propagation) still grows with grid size. Two levers left: (a) **flow-ordered GS** (topological sort of the flux DAG → ~1 sweep, → near-linear), (b) the **Web-Worker pool** (moves any run off the main thread + enables ensembles). Those finish H1.

**Accuracy — two different questions, answered honestly:**
- **Physics correctness (vs analytic):** *excellent.* Buckley-Leverett breakthrough **0.500 PVI vs analytic 0.503** (0.6% error), water mass balance exact to ~1e-8, five-spot conserved, 135 truth-lock assertions. The numerics are right.
- **Predictive accuracy vs REAL Volve:** *not yet measured for the simulator* — because it has **not been history-matched** to Volve. The **61% blind-test MAPE is the decline-curve model's error, not the simulator's.** We can honestly quote physics correctness today, but **not a sim-vs-Volve match number until AHM (H3/H4) exists** — building AHM is literally *how we will earn that number.*

**HM quality vs Eclipse/IX:** we do **not do dynamic history matching yet** (Field Review is decline-curve, not simulation). So there is nothing to compare to IX yet. When built, we use the **same metric IX/Petrel use**: normalized RMS misfit (NRMS) per observation stream (oil/water/gas rate, BHP, water-cut, GOR), water-breakthrough-timing error, and whether the **posterior ensemble brackets the history**. Acceptance target: field oil-rate **NRMS < ~1–2** ("good match" heuristic), breakthrough within a few months, P10–P90 covers observations, plus a **blind/out-of-sample** predictive check.

**Is it good enough for quick-look screening? Is it reliable?** — precise answers:
- **Reliable = consistent / reproducible / physics-validated?** **YES.** Deterministic, seeded, 135 truth-lock assertions, exact mass balance, matches analytics. It will not hand you random or wrong-physics answers.
- **Good for RELATIVE screening** (compare development options, sweep/breakthrough behaviour, sensitivity directions, volumetrics, decline-based economics)? **YES** — that's real value today.
- **Good for ABSOLUTE Volve forecasting** (trust the exact barrels/reserves)? **NO, not without history matching** — and the blind test says so out loud (61% MAPE). Screening = "which option is better / roughly how big / what would it take," *not* "this exact number is the truth."

## 6 · Honest limits (state them plainly, always)
- Not INTERSECT physics: no compositional/thermal/unstructured/fracture/near-well/exascale. Screening + teaching + decision grade.
- 3D sim capped to ~10–100k cells for interactivity (coarsen; worker/WASM for bigger later).
- AHM over a modest parameter set — not a 29-fault field fully calibrated; the posterior is honest about what it did and didn't constrain.
- Proxy-based uncertainty carries proxy error; report the proxy R² and fall back to direct runs when it's poor.
- Every forecast still carries its blind-test / match-quality score. The tool never hides how much to trust it.

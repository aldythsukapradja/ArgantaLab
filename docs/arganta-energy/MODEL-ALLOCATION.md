# ArgantaEnergy — End-to-End Build & Model Allocation
Date: 2026-07-21. Which Claude tier builds each phase, and why. Two axes kept separate: (A) which model BUILDS the work; (B) the product's OWN runtime intelligence tiers (deterministic→ML→LLM).

## Model tiers (capability vs cost)
- 🔴 **Fable 5** — top capability (Mythos-class, above Opus). Use where a subtle error is expensive and hard to catch: architecture, correctness-critical numerics, the semantic-model contract, extraction-rule design, adversarial verification. Highest cost — spend it on judgment, not typing.
- 🟠 **Opus 4.8** — strong implementation with scoped judgment: viewers, decoders, graph integration, router impl. The workhorse for "designed, now build it."
- 🟢 **Sonnet** — mechanical, spec-complete, test-caught work: running approved scripts, boilerplate, wiring, config, doc formatting, repetitive stamping once an exemplar exists. Lowest cost, lowest risk ONLY when the spec fully determines the output.

Rule: **Fable designs & verifies; Opus implements; Sonnet executes the mechanical.** Downgrade only when errors are cheap and caught by tests.

## (A) End-to-end build — model per task

| Phase | Task / deliverable | Model | Why this tier | Risk if downgraded |
|---|---|---|---|---|
| **M1** | **Star-schema contract design** (schema.md + ontology.md + FK ledger w/ orphan counts, cardinalities, join rules) | 🔴 Fable | The linchpin — knowledge graph + every vertical hang from it; subtle FK/cardinality/orphan errors propagate everywhere | **High** — contract drift is the #1 battle-test risk |
| M1 | Generate `schema-meta.ts` FROM the locked .md contract | 🟢 Sonnet | Deterministic codegen once the contract exists | Low (diffable, test-checked) |
| **M2** | Data-pipeline surface (render mirror→decode→validate stages, provenance drill-in) | 🟠 Opus | UI over known data w/ provenance-truth nuance | Med — truthful-state nuances |
| M2 | Pipeline docs / QC formatting, README, licence | 🟢 Sonnet | Pure formatting | Low |
| **M3** | **Deterministic extraction ALGORITHM design** (generator stages, auto-link rules, producer↔injector derivation, fuzzy finder, dedup/orphan policy) | 🔴 Fable | The differentiator; rule correctness = credibility; a wrong auto-edge misleads a geologist | **High** — plausible-but-wrong knowledge |
| M3 | Extraction pipeline IMPLEMENTATION (code the designed generators) | 🟠 Opus | Well-scoped once designed | Med |
| M3 | Vault wikilink/backlink machinery (O(n) title-index + inversion) | 🟠 Opus | Known algorithm, correctness testable | Low-Med |
| M3 | Graph-viz integration (chosen WebGL lib + our data, perf/LOD tuning) | 🟠 Opus | Library integration + perf | Med (perf regressions) |
| **M4** | **Deterministic NLU router design + tier-ladder/governance wall** (DET/SOV/FRO, classification gate) | 🔴 Fable | Routing + sovereignty/data-classification is safety-relevant; must not leak restricted context | **High** — governance/sovereignty breach |
| M4 | NLU router implementation; agent run-envelope | 🟠 Opus | Scoped once designed | Med |
| **V1** | **Engine numerical port + correctness** (Archie petro, GRV/STOIIP/GIIP, seeded Monte-Carlo w/ percentile flip, Arps DCA, economics, unit conversions) + unit tests | 🔴 Fable | A wrong volume/NPV destroys trust; formulas subtle (unit factors 7758/1233.4818, PERT, P90=pct10) | **High** — silent numeric error = credibility death |
| V1 | `adaptVolve(processed + MODEL)` → engine state | 🟠 Opus | Adapter logic, moderate judgment | Med |
| V1 | Viewer implementations (Map/Logs/Section/Structural/Property/Volumetrics/Forecast/Econ) on canvas | 🟠 Opus | Substantial UI; 1st exemplar Fable-reviewed | Med |
| V1 | Repetitive viewer stamping / registry wiring once pattern set | 🟢 Sonnet | Mechanical replication of an exemplar | Low |
| V1 | 20-task geologist battle-test design + adversarial verification | 🔴 Fable | Verification integrity — the gate that certifies the wedge | **High** — false "it works" |
| **Ongoing** | Run scripts (mirror/validate/status), commits, config, bat files, watchlist sweep | 🟢 Sonnet | Fully specified, idempotent, script-checked | Low |
| Ongoing | Architecture decisions, cross-phase synthesis, gate reviews (the main loop) | 🔴 Fable | This is the judgment layer steering everything | — |

**Cost logic:** ~5 Fable design/verify tasks (the linchpins), ~10 Opus implementation tasks, the rest Sonnet. Fable is concentrated on the four things that, if wrong, are expensive and silent: the schema contract, the extraction rules, the governance wall, and the engine numerics.

## (B) The PRODUCT's runtime intelligence tiers (a different axis — no Claude at runtime for 0–ML)
The app itself is deterministic-first; LLMs are an opt-in upgrade behind a data-classification wall.

| Runtime tier | What runs | When | Who BUILDS it |
|---|---|---|---|
| **0A Deterministic code** | typed engine: joins, aggregations, petro/volumetrics/MC/DCA, extraction generators, NLU keyword router | default — always tried first; "a simulation is never a measurement" | 🔴 Fable design → 🟠 Opus impl |
| **0B / ML (local)** | small client-side models (anomaly flags, log QC, facies hint) via onnxruntime-web / tfjs — no server, no Claude | when deterministic rules insufficient AND local model suffices | 🔴 Fable design → 🟠 Opus impl |
| **1–2 Sovereign LLM** | self-hosted model (vLLM/Ollama) for narrative synthesis ON TOP of computed results | only if data-classification permits; restricted context stays here | 🟠 Opus impl (router) |
| **3 Frontier LLM** | Claude API for hardest synthesis | exception-approved, sanitized context only | 🟠 Opus impl (router) |

Key: the deterministic foundation and the ML tier need **zero LLM at runtime** — they're pure code/models. The four-tier `@arganta/ai` router already models this; M4 reconciles the two ladders. LLM tiers only ever *narrate* what deterministic code already computed, always carrying an evidence badge.

## Libraries / visual stack (2026-current, all MIT/Apache/ISC/BSD, Vite-friendly, offline-capable)

**Headline: reuse Equinor's own open-source petroleum stack** (fitting — Equinor owns the Volve data). videx-wellog + webviz-subsurface-components + esv-intersection are MIT and purpose-built for exactly our two hardest categories (well logs, subsurface maps) — a huge "don't rebuild it" win.

| Category | RECOMMENDED pick | Alt / notes | Scale |
|---|---|---|---|
| **Knowledge-graph viz** ("graphify") | **Sigma.js v3 + graphology** | +Cosmograph/cosmos.gl (GPU) for >30k "galaxy" mode; react-force-graph-3d for cinematic 3D | ~10k nodes smooth; Cosmos → 1M |
| **Obsidian-style vault** | **CodeMirror 6 (edit) + remark/`remark-wiki-link` (render + backlink extraction)** | Mirrors Obsidian's own arch; one parser feeds both the rendered note AND the graph edge list. Milkdown if WYSIWYG-first. Avoid TipTap/Lexical (lossy markdown) | — |
| **Well-log / petrophysics** | **@equinor/videx-wellog** (MIT, TS, downsampling, GR/RHOB/NPHI/RT log+linear, dual MD/TVD) | +@equinor/webviz-subsurface-components WellLogViewer for correlation; uPlot only for crossplots | large logs, built-in downsample |
| **Map / structural / contour / geostats** | **deck.gl + MapLibre GL + d3-contour + turf.js + kriging.js (vendored, in a Worker)** | esv-intersection (well cross-sections) + webviz SubsurfaceViewer share the deck.gl base → compose cleanly | GPU, millions of pts |
| **Charts (uncertainty/econ)** | **visx** (tornado, MC hist, CDF/exceedance, P10/50/90 fans) | Recharts (already in deps) for standard dashboards; uPlot for huge series; skip Plotly (bundle/offline) | — |
| **3D (optional)** | **deck.gl** (geospatially-anchored trajectories/horizons) + **react-three-fiber** (free-floating cinematic) | r3f already used elsewhere in ArgantaLab | — |
| **Relational schema canvas** | **React Flow (@xyflow/react) + dagre** | table = custom node w/ per-column handles + crow's-foot edges = Power BI Model view; elkjs only if orthogonal routing needed | — |
| **Browser ML tier** | **simple-statistics + ml.js (classical) → onnxruntime-web (trained ONNX, WASM+WebGPU)** | transformers.js only for note embeddings/semantic backlinks | offline |
| **LLM tiers** | **WebLLM (offline default) → Ollama/vLLM (self-host sovereign) → Claude API (frontier opt-in)** | one OpenAI-compatible adapter, swappable = our @arganta/ai costClass 0–3 | 7–8B in-browser |

**Visual references to study:** Equinor WebViz/webviz-subsurface-components + esv-intersection + videx-wellog storybook (subsurface); Logseq (MIT) + Foam (MIT, closest vault twin) + Obsidian (graph/backlink interaction target); Power BI Model view + dbt docs lineage (schema/provenance canvas).

**One-line stack:** Sigma.js+graphology · CodeMirror6+remark-wiki-link · @equinor/videx-wellog(+webviz) · deck.gl+MapLibre+d3-contour+turf+kriging.js · visx(+Recharts/uPlot) · deck.gl+r3f · React Flow+dagre · simple-statistics+ml.js→onnxruntime-web · WebLLM→Ollama/vLLM→Claude.

**Note vs current app:** O3 shipped hand-rolled canvas/SVG (fine for the 3 mothership tabs). These libraries are for the DEPTH phases (M3 graph, V1 workbench) — adopt per-phase, keep bundle lean, lazy-load the heavy ones (deck.gl/videx) only inside the Workbench vertical.

# ArgantaEnergy — Build Methodology (adopted from founder's prior craft, de-identified)
Date: 2026-07-21. Source: founder's prior multi-app studio, studied read-only for METHOD only (zero names/identities/data carried over; everything here maps to Volve).

This codifies the construction techniques worth inheriting, and how each applies to ArgantaEnergy's remaining phases.

## The core idea
The strongest artifacts in a studio like this are **not the apps** — they are the **spec documents, locked data contracts, and (optionally) a prompt-builder that manufactures build-prompts**. Craft lives in the specs, not the code. ArgantaEnergy should treat spec + contract + ontology as first-class deliverables.

## 10 techniques to adopt
1. **Contract-first, locked-early.** Show each exported shape as a code block and declare it locked before building consumers. Prevents drift; enables parallel Opus batches. → Already partly true (our processed/*.json have implicit shapes). ACTION: write an explicit `contracts/` doc with the canonical shapes (ProductionRecord, LogSample, SurveyStation, FormationMarker, Horizon, EvidenceRecord) and freeze them.
2. **Dictionary/data split + runtime data contract.** Embed a compact schema dictionary; fetch bulk at runtime; the app reads its own directory. Never inline bulk data (their pain: 8–33 MB single-file apps). → We already generate lean `src/data` at build time from `data-energy/`. Keep enforcing: no bulk in the bundle.
3. **Registry + universal contract + adapter seams.** Every capability self-registers with a `manifest {id,name,version,status:stub|alpha|beta|prod}` + a fixed function signature; consumers ask the registry, never hardcode. "New capability = 1 file + 1 line." → ADOPT for the Workbench viewers and (later) agents/tools. Our `nav.ts` is a first step; extend to a viewer registry.
4. **Deterministic-first, LLM-later, per-unit mode flag.** Every decision unit carries `mode: 'deterministic'|'llm'|'hybrid'`; upgrade path is per-unit. → Matches our tri-brain + four-tier router. Bake `mode` into every analytical output (we already show ◆deterministic capsules).
5. **Design tokens as single source of truth; theme-by-attribute; AA-verified; back-compat aliases.** → We have theme.css tokens (handoff §8). ACTION: add a `data-theme` seam + AA annotations if we ever go light-mode; keep alias seam for safe renames.
6. **Definition-of-Done checklist + pre-chosen defaults for open questions.** Every spec ends with numbered acceptance criteria and sensible defaults already chosen (non-blocking). → Our BUILD-PLAN has gates; ADD explicit DoD checklists per batch (EXECUTION-PLAN already trends this way).
7. **Post-mortem-driven data contracts.** Write failures as *What happened → Time lost → Root cause → Rule*; add wrong/right tables, a vocabulary lock (exact enum strings), and a validate-before-deliver function. → ADOPT: our archaeology notes are the seed; formalize a `docs/arganta-energy/DATA-CONTRACT.md` with the locked `dataNature` enum + a validate() gate (we have validate.mjs — reference it there).
8. **Pair a "what" spec with a "why" strategy narrative.** The why-doc keeps future edits aligned with intent. → We have BUILD-PLAN (what) + this + competitor docs; ADD a short WHY.md capturing the sovereignty/evidence/wedge rationale so later batches don't drift.
9. **One content model, many renderers.** presentation/report/docx all consume the same `document={meta,sections[]}`. → Relevant to the future Training Studio (P5): one lesson model → viewer + PDF + deck.
10. **Self-documenting live architecture page + usage tracker from day one.** A page that reads counts from registries so the diagram never goes stale; a universal event shape auto-wired at every layer. → ADOPT: the Foundation schema canvas should read real counts (it does). Add `@arganta/usage` beats later like the other apps.

## Data-architecture pattern (their proven shape, mapped to Volve)
- **Star schema:** a hub key + hierarchy/filter cascade (Field → Well → Wellbore → {records}, plus Date and Depth slicers) + bridge tables + an enumerated FK list. → Our canonical model already is this; ACTION: write the explicit FK list (source.col → target.pk, cardinality, orphan count) into contracts.
- **Column-aligned array rows** (`schema` order + `null` = missing), mapped by index not by guessing. → Consider for the largest log tables to shrink `src/data`.
- **Provenance badge on every value** (measured/reported/interpreted/derived — never simulated-as-measured); null = no-data, never silently interpolated; if interpolated for a chart, label it. → Already our law. Keep.
- **Producer/consumer boundary discipline:** only flat minified JSON crosses; floats sane; `NaN/Infinity → null`; wrapper `{generated_at, engine_version, engine_id}`; consumer reshapes to O(1) lookups + one pure `run…()`. → ADOPT for the build-data step and any future ML output.

## Anti-patterns to AVOID (their hard-won lessons)
- No build script / runtime the target lacks in the shipped artifact.
- No nested files if the deploy target serves flat (subfolder = 404) — flat prefixed names.
- Never generate JSON from line-numbered editor output (embeds `1. ` → corrupt); no unreplaced placeholders; watch `.json.json`; always minify + round + sanitize NaN; parse-validate before delivery.
- One load path per file — no fallback chains to old paths.
- Don't inline bulk data (mega single-file apps).
- Prefer real version control over on-disk `_v6/.tmp/- Copy` sprawl. (We use git — keep to it.)
- Live-preview: text inputs must not trigger full re-render (focus loss); structural controls re-render, text controls don't.
- Contract drift: define the file shape first, then write consumers.

## Transfer recipe for our remaining phases
1. **Now:** write `contracts/` (locked shapes + FK list + vocabulary lock) and a short `WHY.md`. Add DoD checklists to each remaining batch.
2. **O4 Workbench:** build viewers behind a **viewer registry** (manifest + universal `render(container, data, ctx)` contract, `status` field), deterministic-first, adapter for data access. This makes "add a viewer = 1 file + 1 line" and keeps the 20-task battle-test honest.
3. **P5 Training:** one `lesson={meta,sections[]}` model → many renderers.
4. **Optionally:** a small **prompt-builder configurator** that emits copy-ready Markdown build-prompts for each ArgantaEnergy module, so every batch is generated to the same standard.

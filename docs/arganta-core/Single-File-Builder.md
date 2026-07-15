---
title: HQ Single-File Builder — Concept & B-Batch Plan
date: 2026-07-15
category: Architecture
status: concept — NOT built (B1–B5 pending)
tags: [arganta-core, builder, single-file, lovable, apps, websites, moc]
---

# HQ Single-File Builder

Arganta Core's most valuable hand: a founder-controlled app/website creation
loop — **one complete HTML file** (inline CSS/JS, responsive, functional),
created → revised → validated → versioned → published, from one conversation
or from the visual Builder UI. Lovable-inspired, deliberately NOT a multi-file
dev platform in v1. Full founder strategy summary lives in the 2026-07-15
session transcript; this note is the repo-grounded reconciliation + plan.

> Start with one reliable HTML artifact, close the entire loop, scale later.

## Grounded against the repo (what already exists, verified)

| Piece | Where | State |
|---|---|---|
| Shared builder shell (Catalogue/Studio/Analytics, device preview, publish) | `apps/hq/src/surfaces/builders/BuilderShell.tsx` + `pages/` | ✅ built (Game + App builders ride it) |
| 9 app templates (Grocery, Matchday, Cooking, Habits, Album, Coaching, Chatbot, Travel, Budget) | `apps/hq/src/data/appTemplates.ts` | ✅ built — become the first **application archetypes** |
| Single-file app contract (complete HTML, CRUD, states, no TODOs, SDK) | `apps/hq/src/data/circleAppPrompt.ts` | ✅ built — but **external** (copy prompt → ChatGPT/Claude → paste back). The #1 upgrade: generate INSIDE HQ |
| Unified artifact adapter + sandboxed preview runtime w/ SDK injection | `apps/hq/src/surfaces/builders/artifact.ts` | ✅ built (kind: game\|app, html, visibility, plays/ratings) |
| Deterministic website engine (brand palette, hero, features, CTA, footer) | `apps/hq/src/surfaces/studios/engines.ts` `makeWebsite()` | ✅ built — becomes **Stage-0** + the instant fallback + AI's revision seed |
| AI routing / provenance / cost ledger / persistence | four-tier router, `agent_runs`, `media_asset` | ✅ live (this session) |
| Version history table | — | ❌ none (matches the 40–50% estimate) |
| Conversational revision loop | — | ❌ none until C3+B2 |
| Shared public artifact runtime (`build.arganta.app/a/:slug`, `/w/:slug`) | — | ❌ none (v1 target; NOT per-artifact Vercel projects) |

## The two-system mental model

```
ARGANTA CORE (conversation, orchestration — the Face + Brain)
        ↓ calls tools
SINGLE-FILE BUILDER KERNEL (apps/hq/src/builder-core/ — the Hand)
        ↓ produces
ONE COMPLETE HTML FILE → preview → revise → validate → version → publish
```

Core and the visual Builder UI are the **same kernel, two doors** — never two
builder implementations. Both operate on the same artifact records.

## Reconciliation deltas (what I'd adjust from the strategy doc)

1. **Builder tools extend C1's frozen `TOOL_SPECS`, not a second registry.**
   `create_website` / `create_application` / `revise_artifact` /
   `validate_artifact` / `save_version` / `restore_version` /
   `insert_component` / `apply_brand` join the existing registry WITH
   governance metadata. Critical call: `publish_artifact` is
   `sideEffect: true, autonomySafe: false` — a headless mission can never
   publish without an explicit grant (ADR-0004 already enforces this shape).
   Create/revise/validate are autonomy-safe candidates (non-publishing,
   budget-bounded). Final freeze = B1 (Opus).
2. **Unify with the existing `Artifact` type, don't fork it.** `artifact.ts`
   already has `{ id, kind: game|app, html, visibility, ... }` backed by
   Circle-facing tables (PublishedGame/AppManifest, kid-tuned RLS). The B1
   decision: likely a new founder-scoped `hq_artifact` + `artifact_version`
   pair (private-first, versioned, `run_id` lineage into `agent_runs` — same
   discipline as `media_asset`), with optional export INTO the Circle catalog
   as the distribution step. Decide in B1, not here.
3. **Full-file freeform generation will hit output-token ceilings.** A complete
   app HTML easily exceeds free-tier output limits (Gemini flash ~8k out; CF
   Llama less). The component-assembly design is the mitigation, not just a
   nicety: deterministic skeleton (template + selected portable components)
   with the AI writing the variable sections — bounded outputs, higher
   validation pass rate, cheaper. B2 designs generation around this from day 1.
4. **The public runtime is a new attack surface.** `build.arganta.app` serves
   founder-generated HTML to the open internet: sandboxed iframe, strict CSP,
   approved-dependency allowlist, no secrets, no parent-window access — the
   deterministic validator enforces what the generation contract promises.
   Opus security sign-off gates B5 going live, same as ADR-0004 gated C7.
5. **Status correction:** C3 is *next*, not underway. C1 (contracts) + C2
   (substrate) are shipped and live-verified; nothing of the loop is wired yet.

## Kernel shape — B1 ✅ SHIPPED as `@arganta/builder` (contracts) + ADR-0005

B1 landed the PURE contracts (types/classifier, schema+row-mapping,
validation gate, tool specs, generation prompt, component shape+selector) —
84 tests. The kernel below is the SAME shape; B2/B3 add the app-side executors
in `apps/hq/src/builder-core/` (generate/revise/publish call the app engines +
llm-proxy), mirroring the `@arganta/agent` ↔ `lib/core` split.

```
apps/hq/src/builder-core/
├── types.ts        SingleFileArtifact · ArtifactBuildContext · ValidationResult
├── prompts.ts      the generalized Arganta Application Contract (from circleAppPrompt)
├── templates.ts    app archetypes (seeded from appTemplates) + website archetypes
├── components.ts   portable component registry (html/css/js blocks, category, suitableFor)
├── generate.ts     Stage-0 deterministic → Stage-1 AI (tiered, truthful)
├── revise.ts       full-document revision v1 (patch-based later)
├── validate.ts     deterministic structural/security/quality checks
├── versions.ts     immutable versions, restore, provenance per version
├── publish.ts      publish selected version → shared runtime slug
└── tools.ts        the TOOL_SPECS extension Arganta Core calls
```

Two modes, one artifact type: **application** (state, CRUD, charts, forms) vs
**website** (presentation, hero, sections, SEO) — classified from the request
(*manage/do* → application; *present* → website), overridable.

## The proving slice (definition of done for v1)

1. "Create a modern company landing page for Arganta" → website mode, template
   + components + brand kit → one HTML file → validated → v1 saved → previewed
   mobile/tablet/desktop.
2. "Add a section showing the four products" → revision → v2.
3. "Restore the original" → v1 current again.
4. "Publish it" → real public URL, provenance + cost + validation reported.
5. Same loop for an **expense-tracker application** (entry, categories,
   summary metrics, spending chart) — proves application mode.

Everything reports provider · model · cost · duration · validation · version ·
publication — the truthfulness contract, unchanged.

## Deferred (v1 explicitly does NOT block on)
Multi-file/React projects, npm installs, per-artifact repos/Vercel projects,
PRs/branching, DOM-to-source visual editing, plugin marketplace, custom-domain
automation, public billing, autonomous repair.

## See also
- [[Arganta-Core-Concept]] — the six organs; Builder = the strongest Hand
- [[../adr/0004-autonomous-invocation-boundary]] — why publish_artifact can't run headless
- [[../media-center/Compute-Substrate]] — the tiers generation rides on

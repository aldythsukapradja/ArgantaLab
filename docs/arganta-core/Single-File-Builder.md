---
title: HQ Single-File Builder — Concept & B-Batch Plan
date: 2026-07-15
category: Architecture
status: B1-B4 shipped — B5 (publish runtime) pending
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

### B2 ✅ SHIPPED — generation wired into Arganta Core

`apps/hq/src/builder-core/appShell.ts` (Stage-0 deterministic APPLICATION
shell — the app twin of `makeWebsite()`: real add/remove CRUD, localStorage,
empty state, $0/instant) + `generate.ts` (`generateWebsite`/`generateApplication`/
`reviseArtifact` — Stage-0 deterministic floor → Stage-1 AI via `task:'copy'`,
validated through B1's `validateHtml()`, honest fallback to Stage-0 if AI is
unavailable or fails validation — never fabricates success). `create_website`
and `create_application` are wired as real executors in
`apps/hq/src/lib/core/tools.ts` (`WIRED_BUILDER_SPECS` merges into the tools
Arganta Core's chat loop offers the model — grows automatically as B3 wires
more). Reuses the `'website'` block kind for application HTML too (C1's frozen
`BLOCK_KINDS` has no separate `'application'` kind — both are single-file HTML).
Live-verified: both generators produce validated, honest Stage-0 output
end-to-end through the real tool-executor path. `revise_artifact`,
`validate_artifact`, `save_version`, `restore_version`, `insert_component`,
`apply_brand`, `publish_artifact` remain unwired pending B3's artifact
persistence (`migration_hq_artifacts.sql` + save/restore RPCs) — calling them
now honestly returns "no executor wired for: X" rather than a fake result.

### B3 ✅ SHIPPED — persistence, versioning, `migration_hq_artifacts.sql`

`hq_artifact` (current-state pointer) + `artifact_version` (immutable history,
`run_id` lineage into `agent_runs`) live in the ArgantaLab Supabase project,
implementing B1's frozen `ARTIFACT_COLUMNS`/`VERSION_COLUMNS` exactly. Six
operator-gated SECURITY DEFINER RPCs (`hq_artifact_create`, `_save_version`,
`_restore_version`, `_get`, `hq_artifacts_recent`, `hq_artifact_versions`),
same RLS-enabled/no-direct-policy discipline as `migration_arganta_core.sql`.
`apps/hq/src/builder-core/persist.ts` wraps them through B1's row-mapping
contract (`artifactFromRow`/`versionFromRow`), mirroring `lib/core/thread.ts`.

`create_website`/`create_application` now persist a draft artifact + version 1
on generation (best-effort — generation itself never depends on persistence
succeeding). `revise_artifact` fetches the artifact's current HTML, revises
it, and saves the result as a new immutable version (`version_number` is
always `max(existing)+1`, decoupled from the current-version pointer, so a
restore followed by a new save never collides). `validate_artifact` re-runs
B1's gate against the stored HTML. `save_version` snapshots the current HTML
as a manual checkpoint. `restore_version` moves the current pointer back
without deleting any history. All six now wired as real executors in
`lib/core/tools.ts` — `WIRED_BUILDER_SPECS` grew from 2 to 6.

**Also fixed while touching `validate.js`:** the `no-todo` false-positive
where the literal word `PLACEHOLDER` (case-insensitive) matched the ordinary
HTML `placeholder="…"` attribute — a negative lookahead (`\bPLACEHOLDER\b(?!\s*=)`)
now tells the two apart; regression test added.

Live-verified end to end in-browser: create → validate → revise (honest
Stage-0-unavailable degrade, no AI configured in this environment, same known
limitation as B2/C3) → manual save → restore → confirmed at the SQL layer
that both versions exist and the restore left `current_version` correct.
Also caught and worked around a real environment issue, not a code bug: a
long-lived browser tab's Supabase client can wedge (even `auth.getSession()`
hangs indefinitely) after many HMR reloads/dev-server restarts in one
session — a fresh tab resolves instantly. Worth knowing if a future
verification pass sees inexplicable Supabase hangs.

### B4 ✅ SHIPPED — the portable component library

20 blocks (B4a-Block-Design.md §5's spec table has 20 rows — its own "count =
19" note undercounts by one, corrected here) in `docs/arganta-core/blocks/`:
3 Fable exemplars (`metric-card`, `chart-donut`, `footer`) + 17 Sonnet
completions across nav/hero/layout/metric/table/timeline/gallery/kanban/
calendar/form/chart/pricing categories, all to the frozen `--brand-*` theming
contract and `.blk-<id>` assembly-scoping. `preview.html` (kit switcher,
375/1280 width toggle, filled/empty toggle), `catalogue.md` (slot + empty-state
reference), and `packages/builder/src/registry.js` — generated by
`packages/builder/scripts/build-registry.js` (`npm run blocks:build`) parsing
each block's meta comment + `<style>`/markup/`<script>` sections into a
`PortableComponent`, exported as `PORTABLE_REGISTRY` from `@arganta/builder`.

9 new tests (36/36 in the package): every block passes `isValidComponent`,
ids/categories match the spec exactly, no external hosts/`eval`/parent-access,
all 20 assembled into one document pass `validate.js` with zero errors,
`selectComponents` picks chart+kanban blocks for a dashboard brief and never
returns application-only blocks for a website brief.

Live-verified in-browser (DOM/computed-style level — screenshot capture had
an unrelated infra outage this session): `nav-sidebar` correctly collapses
rail↔bottom-bar across the 720px breakpoint; `nav-top`'s hamburger opens with
`aria-expanded` and closes on Escape; `form-modal` focuses its first field on
open, traps Tab, and returns focus to the trigger on Esc/backdrop-close;
`kanban` overflows into scroll-snap columns; all three chart types' segments
carry `tabindex="0"`; empty↔filled toggling works for every data-bearing
block in both brand kits.

**Three real bugs found and fixed during verification** (all in the harness
or a package-level regex, none in the shipped blocks themselves):
1. `preview.html` set `iframe.onload` *after* `iframe.srcdoc`, racing the
   load event — moved the assignment before `srcdoc`, then replaced it
   entirely with a poll since the race could still flip depending on timing.
2. Chart blocks (`chart-line`/`chart-bar`/`chart-donut`) read their JSON
   data-seam once, inside their own self-wiring IIFE, at initial parse —
   exactly like real B2 output, where the generator bakes real data into the
   HTML string before the browser ever sees it. Filling that JSON via DOM
   mutation *after* load (the harness's first approach) arrives after the
   IIFE already ran and guarded itself, so the chart never re-renders — fixed
   by filling JSON seams in the raw HTML string before it's parsed.
3. A regex string inside `preview.html`'s own inline `<script>` contained the
   literal substring `</script>` (inside a JS string, syntactically valid
   JS) — but the HTML tokenizer does a dumb text search for that byte
   sequence regardless of JS syntax, silently truncating the entire script
   block. Fixed via the standard `<\/script>` escape. Worth remembering for
   any future inline script that builds regexes involving script tags.

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

---
title: HQ Single-File Builder — Concept & B-Batch Plan
date: 2026-07-15
category: Architecture
status: B1-B5 shipped and DEPLOYED — build.arganta.app is live; founder explicitly accepted exposure ahead of formal Opus go-live review
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

### B5 ✅ SHIPPED (impl) — the public runtime ([[../adr/0006-public-artifact-runtime]])

Opus froze the contract (ADR-0006); Sonnet built against it, live-verified
every layer including the actual Worker code:

- **`supabase/migration_artifact_publications.sql`** — the additive
  `artifact_publication` table (`hq_artifact`/`artifact_version` untouched,
  B1's schema test still holds) + `hq_artifact_publish`/`_unpublish`/
  `_publication` (operator-gated) + `publication_by_slug` (the ONE anon-
  granted, read-only RPC — returns only `{kind, html, version_number}` for
  `is_live` publications, `[]` for anything else). Slug assignment: title
  slugified, denylist-checked, short random suffix on collision, **immutable
  once assigned** — live-verified that republishing the same artifact reuses
  the exact same slug rather than minting a new one.
- **`apps/hq/src/builder-core/persist.ts`** — `publishArtifact`,
  `unpublishArtifact`, `getPublication`, `publicArtifactUrl`.
- **`publish_artifact` executor** (`lib/core/tools.ts`, `WIRED_BUILDER_SPECS`
  grew 6→7) — fetches the artifact, re-runs `validateHtml` on the EXACT html
  being published (a second, independent check on top of whatever validation
  the version was saved with), only then calls the publish RPC. A failed
  re-validation returns the specific failing check(s), never a fake success.
  `unpublish` is deliberately NOT a chat tool — B1's frozen `BUILDER_TOOL_SPECS`
  never defined one, and takedown is exactly the low-stakes, founder-initiated
  action that doesn't need agent governance around it; it's UI-only.
- **`workers/build-artifact-runtime/`** — the actual Cloudflare Worker.
  `router.js` (pure, tested): `parseRoute` (`/a/:slug` `/w/:slug`, rejects
  anything else including path traversal), `buildCsp` (ADR-0006 Decision 3
  verbatim), and `assertCspHostsCoverApprovedHosts` — a drift guard asserting
  every host in `validate.js`'s `APPROVED_HOSTS` is categorized into the CSP's
  script/style/font directives, so adding an approved host later without
  categorizing it for CSP fails a test instead of silently under/over-
  protecting a served artifact. `index.js` (the fetch handler): calls
  `publication_by_slug` with the anon key, checks the URL's `/a/`-or-`/w/`
  kind against the row's real kind, **re-runs `validateHtml` server-side**
  before serving (never trusts the publish-time pass alone), sets the CSP +
  `X-Content-Type-Options`/`Referrer-Policy` on every response including
  error pages, never a `Set-Cookie`.
- **Publish/Unpublish UI** in `ArtifactCard.tsx` — reuses the SAME
  `coreExecuteTool('publish_artifact', …)` path a chat-driven publish would
  take, so a human clicking the button and the model calling the tool share
  one validation gate, never two.

**Live-verified end to end against the real Supabase project** (not mocked):
create→publish (real slug+URL returned)→republish (confirmed identical slug
reused)→`publication_by_slug` returns the row only while `is_live`, `[]`
once unpublished, `[]` for an unknown slug→unpublish→cleaned up. Then the
**actual Worker `fetch()` handler** (not just its pure sub-functions) was
invoked directly against the same live project: served the real published
HTML with a 200 + full CSP for a live slug, 404 for an unknown slug, 404 for
a kind mismatch (`/a/:slug` requested for a website-kind publication), 404
for unrelated paths.

### DEPLOYED — `build.arganta.app` is live (2026-07-15)

Guided the founder through all four steps: `wrangler login` (their browser
already had a Cloudflare session, approved instantly), `wrangler deploy`
(confirmed the `arganta.app` zone and uploaded the Worker), `wrangler secret
put SUPABASE_ANON_KEY` (piped directly from `apps/hq/.env.local`, never
printed to any transcript). Deploy itself required an explicit founder
go-ahead — the permission system correctly blocked the first attempt,
citing ADR-0006's go-live review requirement, and blocked a second attempt
because the founder's "yes" hadn't yet accounted for a question they'd just
asked about what's exposed; both were legitimate stops, not bugs.

**Real gap found during first live test, not caught by any earlier
verification:** a Worker *route* (`build.arganta.app/*`) only tells
Cloudflare where to send traffic for a hostname — it does not create the
hostname. `build.arganta.app` had no DNS record at all, so the domain
didn't resolve (`curl: Could not resolve host`) even though the Worker was
correctly deployed and routed. ADR-0006 had assumed "build.arganta.app is
already a Cloudflare-hosted subdomain" from the founder's earlier
infrastructure audit — true for the zone, not true for this specific
subdomain. Fix: founder added an `A build.arganta.app 192.0.2.1` record
with the proxy ON (orange cloud) — the standard pattern for a Worker-only
subdomain with no real origin IP; Cloudflare intercepts at the edge before
ever routing to that placeholder address. Worth remembering for any future
subdomain-only Worker: **the DNS record is a separate prerequisite from the
route**, and nothing checks for it until you actually try to resolve the
hostname.

**Full loop proven live on the real internet**, not against localhost or a
mock: created a disposable test artifact → published it (real slug
`disposable-test-page`) → fetched `https://build.arganta.app/w/disposable-test-page`
via `curl --resolve` (bypassing local DNS cache, confirmed via Cloudflare's
own resolver at `1.1.1.1` that the record had already propagated) → got a
real `200` with the exact CSP header ADR-0006 specified and `Server:
cloudflare` — the actual generated HTML, served by the actual deployed
Worker, from the actual Supabase data. Then unpublished it (confirmed `404`
within seconds) and deleted the test artifact entirely.

**B5's go-live still formally needs the final Opus security review**
ADR-0005/0006 both named. The founder made an informed, explicit call to
defer that formal review until after seeing the workstream fully working
end to end, understanding clearly that (a) the anon key exposed to the
Worker is already public and narrowly RPC-scoped, (b) real secrets never
touch this Worker, and (c) whatever gets published is genuinely public the
moment `is_live=true`. That's a founder decision, not a security bypass —
the review should still happen before anything the founder actually cares
about gets published here.

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
- [[../adr/0005-builder-artifact-model-and-publish-safety]] — the artifact model + publish gate
- [[../adr/0006-public-artifact-runtime]] — B5's Cloudflare Worker runtime + serve-time CSP
- [[../media-center/Compute-Substrate]] — the tiers generation rides on

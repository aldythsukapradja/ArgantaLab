---
title: Brand OS Build Plan
product: Arganta (all brands)
type: plan
status: living
tags: [brand, plan, batches]
date: 2026-07-16
owner: Aldyth
confidence: high
---
# Brand OS Build Plan — BF-1 … BF-10

Execution order for [[Brand OS]]. Opus builds, Fable writes voice/creative, founder approves external writes. [[Brand — ArgantaLab]] is the prototype through every batch.

| # | Batch | Deliverable | LLM | Done when |
|---|---|---|---|---|
| ✅ BF-1 | **Schema + registry contract** | `@arganta/brand`: `blankBrand` (7 layers), `lanes.js` (storage-enforced governance), `specs.js` (platform spec library as data), `mark.js` (geometry → canvas + SVG), `registry.js` (resolveBrand/matrix/readiness), `supabase/migration_brand_registry.sql`, HQ vite alias + `brand.d.ts` | Opus 4.8 | ✅ 26/26 tests green; HQ typecheck clean; overlay reaching into the agent lane is provably dropped |
| ✅ BF-2 | **Canonize ArgantaLab** | `packages/brand/brands/argantalab/`: `brand.json` (mark as data), `BRAND.md` (KB), `seed.overlay.json`, `refs/` ×6, `prompts/` ×3 | Opus 4.8 | ✅ Mark verified **pixel-identical** to the pack SVG (mean diff 0.000%); live audit reports 20% overall. Higgsfield end-to-end check still pending |
| ✅ BF-3 | **Multi-brand postEngine** | `PostDoc.brandId` + `RenderEnv.brand`; `brandPalette()`/`platePaint()`/`fontStack()`; procedural K-mark **deleted** and canonized into `brands/kinetikcircle/brand.json`; CTA handle from the doc; brand picker in the Post Studio top bar | Opus 4.8 | ✅ K-mark code→data **pixel-identical** (0.0000%); one doc renders as ArgantaLab *or* KinetikCircle with distinct mark/palette/plate/handle; 30/30 tests, build green |
| BF-4 | **Brand Forge deck** | New HQ Build surface: brand rail, layer strip, matrix, readiness bar, inspector drawer; agents-lane fields read-only | Opus 4.8 | One non-scrollable page; matrix derives state from spec library |
| BF-5 | **MCP brand seam** | `brand_get`/`brand_update` tools; `brand` param on `content_draft`; persona injection in worker | Opus 4.8 | Claude Code round-trips a text edit; draft copy voice-matches the brand |
| BF-6 | **Five personas** | L1 for all brands: voice cards, boilerplates, hashtag banks, touchy rules — EN + ID | Fable 5 | Founder sign-off per persona |
| BF-7 | **Content + ad system** | L3: pillar templates, 9:16 covers, caption formulas, Meta/Google ad kit, OG template | Opus + Fable design pass | Every template renders in all 5 brands |
| BF-8 | **Discovery layer** | L4: fact sheets, llms.txt, schema.org JSON-LD, keyword map; wired into apps/landing | Fable writes · Opus wires | Sites serve brand-consistent meta + llms.txt |
| BF-9 | **Campaign spines** | L5: weekly rhythms ×5, playbooks; 30-day plan re-voiced per brand | Fable 5 | Spine drives a real `content_draft` day |
| BF-10 | **Audio marks** | 2-second stings ×5 via @arganta/audio (+ Higgsfield audio if needed) | Opus + founder approves | Sting plays on Video Builder exports |

## Sequence

**BF-1 → BF-2 → BF-3** = ArgantaLab posts correctly end-to-end (the prototype milestone).
**BF-4 → BF-5** = the cockpit + agent seam. **BF-6 … BF-10** = scale to five brands.

## Where the prototype actually stands (live audit, 2026-07-16)

Reported by `readiness()` — derived, not hand-maintained:

| Layer | | Note |
|---|---|---|
| L0.5 Knowledge base | **100%** | BF-2 delivered BRAND.md + refs + prompts |
| L0 Identity | **50%** | mark ✅ palette ✅ plate ✅ fonts declared ✅ · missing: fonts embedded, icon set, motion, audio mark |
| L1 Voice | **44%** | persona ✅ pillars ✅ CTAs ✅ tagline(en) ✅ · missing: ID copy, hashtag banks, touchy rules, most boilerplates → **BF-6** |
| L2 Presence | **10%** | Instagram only; link ⚠ unverified · other 5 platforms untouched |
| L3 Content · L4 Discovery · L5 Spine | **0%** | not started — BF-7, BF-8, BF-9 |
| **Overall** | **20%** | |

## Founder-only prerequisites

1. **Run `supabase/migration_brand_registry.sql`** ← BF-1 shipped it; this seeds the founder lane
2. Verify `lab.arganta.app` resolves (or choose the real link) — the matrix flags it ⚠ until then
3. Upload avatar/bio/highlights to the live IG profile
4. Decide the Landing brand name (any time — one-field rename)

Wiring: [[Brand OS Integration Map]]

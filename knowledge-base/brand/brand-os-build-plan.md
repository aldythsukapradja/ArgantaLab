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
# Brand OS Build Plan — BF-1 … BF-10 (+ the consolidated brand program)

Execution order for [[Brand OS]]. Opus builds, Fable writes voice/creative, founder approves external writes. [[Brand — ArgantaLab]] is the prototype through every batch.

> **2026-07-16 consolidation** (see [[Brand Handoff Battle Test]]): the ChatGPT master handoff's
> 35-doc program is absorbed below. Portfolio remapped — **Arganta** (masterbrand, ex-`apps/landing`,
> www.arganta.app) · ArgantaLab · **Kinetik Circle** (display name) · LashiraBloom · **Circle HQ**
> (own internal brand). Kingdom parked; "Landing" retired as a brand name. The BF-4 surface is
> renamed **Brand Studio** and additionally hosts the strategy-doc links + the visual-asset
> production tracker for the [[ChatGPT Visual Production Handoff]].

| # | Batch | Deliverable | LLM | Done when |
|---|---|---|---|---|
| ✅ BF-1 | **Schema + registry contract** | `@arganta/brand`: `blankBrand` (7 layers), `lanes.js` (storage-enforced governance), `specs.js` (platform spec library as data), `mark.js` (geometry → canvas + SVG), `registry.js` (resolveBrand/matrix/readiness), `supabase/migration_brand_registry.sql`, HQ vite alias + `brand.d.ts` | Opus 4.8 | ✅ 26/26 tests green; HQ typecheck clean; overlay reaching into the agent lane is provably dropped |
| ✅ BF-2 | **Canonize ArgantaLab** | `packages/brand/brands/argantalab/`: `brand.json` (mark as data), `BRAND.md` (KB), `seed.overlay.json`, `refs/` ×6, `prompts/` ×3 | Opus 4.8 | ✅ Mark verified **pixel-identical** to the pack SVG (mean diff 0.000%); live audit reports 20% overall. Higgsfield end-to-end check still pending |
| ✅ BF-3 | **Multi-brand postEngine** | `PostDoc.brandId` + `RenderEnv.brand`; `brandPalette()`/`platePaint()`/`fontStack()`; procedural K-mark **deleted** and canonized into `brands/kinetikcircle/brand.json`; CTA handle from the doc; brand picker in the Post Studio top bar | Opus 4.8 | ✅ K-mark code→data **pixel-identical** (0.0000%); one doc renders as ArgantaLab *or* KinetikCircle with distinct mark/palette/plate/handle; 30/30 tests, build green |
| BF-4 | **Brand Forge deck** | New HQ Build surface: brand rail, layer strip, matrix, readiness bar, inspector drawer; agents-lane fields read-only | Opus 4.8 | One non-scrollable page; matrix derives state from spec library |
| ✅ BF-5 | **MCP brand seam** | `voiceBlock()` in @arganta/brand; `kb.artDirection`; worker `brandBlock()` + art-directed `imagePrompt()`; MCP `loadBrand`/`getBrand`/`updateBrand`; `brand_get` + `brand_update` tools; `brand` + `lang` params on `content_draft`; drafts remember their brand (`copy.brandId`) and HQ honours it on open | Opus 4.8 | ✅ Live read against Supabase: two-lane merge resolves (persona "The Lab", 20% ready). **⏳ Worker `wrangler deploy` still pending** — until then live generation uses the old prompt |
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

## The consolidated to-do (2026-07-16, post-battle-test)

### Phase 0 · Founder unblocks (only you)
| # | Action | Why |
|---|---|---|
| ~~0.1~~ | ~~Run migration_brand_registry.sql~~ | ✅ done — verified live |
| 0.2 | **Authorize `wrangler deploy` of arganta-core-content** (say it explicitly) | BF-5 voice isn't live until then |
| 0.3 | Restart Claude Code | loads brand_get/brand_update tools |
| 0.4 | Confirm portfolio remap: Arganta external / Circle HQ internal / "Kinetik Circle" display spelling / Ship stays in the ArgantaLab tagline / Spark vs **Seed** | unblocks Fable docs + ChatGPT pack |
| 0.5 | DNS: www/lab/circle/bloom.arganta.app live or redirecting | matrix ⚠ until `linkVerified` |
| 0.6 | **Paste [[ChatGPT Visual Production Handoff]] into ChatGPT** | starts P0 visual production |
| 0.7 | One git worktree per parallel Claude session | two collisions already this week |

### Phase 1 · Fable — strategy core (8 docs, not 35)
The handoff's 35 docs compressed; each maps to registry home-fields so the deck can track it. Bilingual EN+ID throughout.
| Doc | Absorbs handoff §§ | Feeds |
|---|---|---|
| F1 Brand foundation + architecture | 01, 02, 03 | boilerplates → `voice.boilerplates`, endorsement rules |
| F2 Audiences + positioning | 04, 06 | persona targeting, `discovery.keywords` |
| F3 Messaging library ×5 brands | 07 | `voice.taglines/ctas`, `presence.*.bio` |
| F4 Voice matrix + editorial guide | 08 | `voice.persona` per brand (incl. **Buddy's role**) |
| F5 Social architecture + content OS | 14, 15 | `presence.*`, `voice.pillars/hashtags`, `content.captionFormula` |
| F6 90-day launch plan | 16, 17 | `spine.rhythm/playbooks` (the 30-day plan folds in) |
| F7 Adoption + lifecycle copy | 18, 19 | activation events → Growth analytics |
| F8 IP + provenance program | 28, 29, 35 | asset provenance log, first-use evidence |
| Deferred (P2/P3) | 05, 09–13 detail, 20–27, 30, 32 | generate when the thing they document is imminent |

### Phase 2 · ChatGPT — visual production
Per [[ChatGPT Visual Production Handoff]]: P0 = master logo concepts, 4 art-direction packs, 3×3 logo directions, **Buddy character sheet**; P1 = OG/story/banner sets. Returns land with founder → Opus canonizes.

### Phase 3 · Claude Code (Opus)
| # | Item | Note |
|---|---|---|
| 3.1 | Registry remap: `PLANNED_BRANDS` → arganta/circlehq; display "Kinetik Circle"; retire landing | small, agent-lane |
| 3.2 | **BF-4 Brand Studio tab** | deck + strategy links + visual-asset tracker (this list, live) |
| 3.3 | Canonize the 4 packs as they arrive from ChatGPT | marks→data (pixel-verify each), artDirection, refs |
| 3.4 | BF-7 pillar templates + ad kit · BF-8 discovery (llms.txt, schema.org) · BF-10 audio marks | after F5/F8 exist |

## Founder-only prerequisites (superseded — see Phase 0)

Wiring: [[Brand OS Integration Map]]

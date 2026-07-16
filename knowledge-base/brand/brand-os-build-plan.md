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
| BF-1 | **Schema + registry contract** | `BrandDoc` type (all 7 layers, both lanes), `packages/brand/` scaffold, Supabase `brand_registry` migration, lane-enforcement seam | Opus 4.8 | Type compiles; migration ready; deck + MCP + engine share one contract |
| BF-2 | **Canonize ArgantaLab** | Pack → `packages/brand/argantalab/`: SVG marks as code, `brand.json`, `BRAND.md` (KB), `refs/`, `prompts/` | Opus builds · Fable writes BRAND.md | Higgsfield generates an on-brand image from the pack alone |
| BF-3 | **Multi-brand postEngine** | Generic `drawBrandLayer` (registry SVG paths), per-brand palettes/plates/fonts, kill hard-coded K-mark + `@kinetikcircle` | Opus 4.8 | Same doc renders correctly under any of the 5 brands |
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

## Founder-only prerequisites

1. Verify `lab.arganta.app` resolves (or choose the real link)
2. Upload avatar/bio/highlights to the live IG profile
3. Run the `brand_registry` migration when BF-1 lands
4. Decide the Landing brand name (any time — one-field rename)

Wiring: [[Brand OS Integration Map]]

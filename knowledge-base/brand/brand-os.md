---
title: Brand OS
product: Arganta (all brands)
type: moc
status: living
tags: [brand, marketing, moc]
date: 2026-07-16
owner: Aldyth
confidence: high
---
# Brand OS — the single source of truth for all branding

One system, five brands, every platform. A new HQ Build-group surface (**Brand Forge**) renders it as one non-scrollable command deck; a versioned registry stores it; every downstream tool — [[Brand OS Integration Map|the whole pipeline]] — reads from it instead of hard-coding brand facts.

**The five brands:** Arganta (the parent OS · [[HQ]]) · [[Brand — ArgantaLab|ArgantaLab]] · [[KinetikCircle]] · [[LashiraBloom]] · Landing *(name TBD — the registry makes renaming a one-field edit)*.

## The seven layers

| Layer | Contents | Edit lane |
|---|---|---|
| **L0 Identity** | Logo suite (SVG masters, favicons, watermark), palette + plate colors, embedded fonts, branded icon set, motion rules, **audio mark** (real in v1 via @arganta/audio) | 🔵 agents only |
| **L0.5 Knowledge Base** | `brand.json` (tokens) + `BRAND.md` (visual world in words) + `refs/` (style-anchor images) + `prompts/` (per-asset generation briefs) — so ANY media AI (Higgsfield, fal.ai, future APIs) produces on-brand output from the pack alone | 🔵 agents only |
| **L1 Voice & persona** | Persona card, boilerplates (25/50/100/200 words — verbatim everywhere), audience pitches, 3-tier hashtag banks with icons, CTA library, emoji policy, **touchy rules** (founder-story cadence, real-kid framing). **Bilingual EN + ID from day one** | 🟢 founder + DB |
| **L2 Platform presence** | Platform **spec library as data** (IG, TikTok, LinkedIn, FB, X, YouTube built in; any new platform = one new spec entry) × per-brand handle/avatar/banner/bio/link/pinned/highlights | 🟡 both |
| **L3 Content & ads** | Pillar post templates, 9:16 story/reel covers, carousel arcs, caption formulas, ad kit (Meta 1:1/4:5/9:16 · Google RSA 15×30-char headlines + 4×90 descriptions · display banners), OG image template | 🔵 agents only |
| **L4 Discovery** | SEO meta + schema.org JSON-LD, **AEO brand fact sheet** (canonical "what is X" answers) published as llms.txt, keyword map so five brands never cannibalize each other | 🟡 both |
| **L5 Campaign spine** | Weekly rhythm per brand, playbooks (launch / feature / seasonal), tone calendar that schedules the touchy moments | 🟢 founder + DB |

## Governance — the two-lane rule

- 🔵 **Agents only** (L0, L0.5, L3): editable exclusively via Claude Code / Codex / MCP. Lives in git (`packages/brand/`). The HQ deck renders these **read-only — no edit controls exist**. Versioned, rollbackable, deploys with the app.
- 🟢 **Founder + DB** (L1, L5): edited live in the Brand Forge deck, saved to Supabase `brand_registry`. Agents may also patch via MCP.
- 🟡 **Both** (L2, L4): text fields = founder; generated assets (banners, OG images) = agents.
- **Boilerplate cascade:** editing a source text auto-flags every derived platform bio as *stale — re-approve*, so consistency drift is visible, never silent.

## Locked decisions

1. Logos/icons/templates are **code-authored SVG** — deterministic, scalable, git-versioned. AI raster (Higgsfield) is for creative: ad heroes, reels, moodboards. Volume slide backgrounds stay on the own Cloudflare worker.
2. Audio mark is real in v1 (2-second sting per brand), refinable later.
3. The deck is **one non-scrollable page**: brand rail · layer strip · center stage · platform × asset matrix · readiness bar · inspector drawer. Matrix cells derive ✓/✎/⚠/✕ from the spec library — *the page is a permanent battle test*.
4. ArgantaLab is the prototype brand (Instagram profile pack in hand); the other four follow the proven mold.

Execution: [[Brand OS Build Plan]] · Wiring: [[Brand OS Integration Map]]

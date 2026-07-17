# AI Influencer Studio — Design Handoff Spec (v1)

> Surface id `influencer` · Studio group · single page, **non-scrollable** (owns its viewport like Brand Studio / Forge).

## 1. What it is

One command deck for the five Arganta virtual creators — **Arganta, Lashira, Kinney, Bloom, Labz**. It is the operating cockpit for the Creator Studio Bible: character identity, daily story rituals, Reels/Post strategy, wardrobe & spice governance, and a copy-ready Instagram launch kit + reusable visual prompt capsule per character.

The page must answer, at a glance, for the selected character:
1. **Who is this?** (archetype, emotional promise, differentiator, analog benchmark)
2. **What do they publish today?** (morning / afternoon / night story ritual)
3. **How do they grow?** (Reels formula + franchises, feed post strategy)
4. **What do they look like?** (wardrobe ratio, spice distribution, palette)
5. **How do I set up / regenerate them?** (IG kit + guardrail-safe prompt capsule, one-click copy)

## 2. Layout (desktop, 100dvh, no page scroll)

```
┌────────────────────────────────────────────────────────────────────┐
│ TOPBAR 52px  ◆ AI INFLUENCER STUDIO   [ARGANTA][LASHIRA][KINNEY]   │
│              [BLOOM][LABZ]                (character tabs, colored) │
├──────────┬──────────────────────────────────────┬──────────────────┤
│ IDENTITY │  DAILY RITUAL TIMELINE               │  LOOK & LAUNCH   │
│ 280px    │  ┌ Morning ┐ ┌ Afternoon ┐ ┌ Night ┐ │  300px           │
│ portrait │  │ 3–4     │ │ 3 frames  │ │ 3     │ │  wardrobe ratio  │
│ initial  │  │ frames  │ │           │ │frames │ │  bars            │
│ arche-   │  └─────────┘ └───────────┘ └───────┘ │  spice 70/20/10  │
│ type     ├──────────────────────────────────────┤  meter           │
│ promise  │  REELS STRATEGY      │ POST STRATEGY │  IG KIT (copy)   │
│ signature│  hook formula +      │ carousel +    │  PROMPT CAPSULE  │
│ lines    │  franchises chips    │ pillars %     │  (copy)          │
│ bench-   │                      │               │                  │
│ marks    │                      │               │                  │
├──────────┴──────────────────────────────────────┴──────────────────┤
│ FOOTER 40px  weekly ritual ribbon Mon…Sun (mission→failure→payoff) │
└────────────────────────────────────────────────────────────────────┘
```

- Page: `position:fixed inset:0; overflow:hidden`. Cards may internally scroll (`overflow:auto`) but the page never does.
- Character tab switch recolors the whole deck via CSS variable `--ink` (per-character accent) — the deck IS the character.
- Copy buttons on IG Kit and Prompt Capsule write plain text to clipboard with a ✓ flash.

## 3. Character accents

| Character | Accent | Archetype |
|---|---|---|
| Arganta | `#e8b64c` gold | The Impossible Builder |
| Lashira | `#3fb6c9` teal | The AI Systems Architect (AURA) |
| Kinney | `#a06ce8` violet | The Magnetic Connector |
| Bloom | `#e86cb0` pink | The Electric Idol |
| Labz | `#4c8ce8` blue | The Experiment Creator |

## 4. Data model

All content lives in `influencerData.ts` (`Creator` type): identity, rituals (3 dayparts × frames), reels (formula beats + franchises + hooks), posts (pillars with %), wardrobe ratio, spice split, signature lines, differentiator, analog benchmarks, guardrails, `igKit` (username, name, bio, highlights, pinned, cadence) and `promptCapsule` (base identity prompt + scene slots + negative guardrails) — every capsule is written to be safe for ChatGPT/Claude/Midjourney/Flux at maximum *allowable* spice (implied athletic confidence, contextual skin, never explicit).

## 5. Non-goals (v1)

No generation calls, no persistence, no analytics — this is the canonical read/copy deck. Later: wire Prompt Capsule → Media Center, story ritual → Post Studio drafts, metrics from IG.

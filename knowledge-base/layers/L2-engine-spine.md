---
title: L2 · Engine / Spine
type: layer-tracker
layer: engine
status: living
health: green
maturity: proven
leverage: medium
date: 2026-07-11
tags: [arganta, layer, engine, packages, moat]
cssclasses: [wide-tables]
---

# L2 · Engine / Spine — the moat

> [!abstract] Health: 🟢 proven · Leverage: 🟡 medium
> The shared `packages/*` layer — **3,067 LOC** that three games and the HQ all consume. Small in lines, largest in value: this is where the repo *compounds*. Every surface built by reusing it got cheaper; the one risk is duplication creeping back in (the copied Kingdom engine).

## Baseline state (2026-07-11)

| Package | LOC | Consumed by | Owns |
|---|---|---|---|
| `@arganta/combat` | 1,429 | kingdom · lashira · hq | skills (bolt/storm/mend) · damage/heal · scaling · VFX · `ActionCluster` |
| `@arganta/audio` | 931 | lashira · hq | SFX/music playback + library |
| `@arganta/heroes-engine` | 498 | kingdom · lashira | tile movement · walk cycles |
| `@arganta/character` | 209 | all | sprite / equip / slot model |

- **Proven pattern** (§13, 2026-07-07): *"Skill effects come from the hero's Kingdom character — single source."* Kingdom → Lashira → HQ all read the same combat math.
- **Uncounted spine:** the Kingdom canvas-2D compositor (`src/engine/{compositor,data,palettes}.js`) was **copied wholesale** into LashiraBloom during P6 — reuse that shipped fast but was never extracted into a package.

## Maturity × Leverage
- **Maturity 🟢 proven** — small, stable, consumed everywhere; the single-source decision has held.
- **Leverage 🟡 medium** — widening the moat makes *building* cheaper, but building isn't the constraint (users are). High strategic value, low immediate-growth value.

## What changed
*Baseline — the zero point.*
- `2026-07-11` — baseline: 4 packages, 3,067 LOC; Kingdom compositor still copied, not extracted.

## Lessons
- [[reuse-the-spine-dont-rebuild]] — this layer *is* the lesson. One engine, many configs; wrap, don't fork.
- The corollary risk: **copy-now-extract-later is debt** (the Kingdom→Lashira engine copy).

## Debt & risks
- **D3 — the copied compositor** feeds the 3× asset duplication (see [[L4-assets-content]]). Extracting it into `@arganta/engine` would collapse both the code *and* the asset dup.
- No package tests; a combat-math regression would silently hit three games at once.

## Wayforward
1. **Extract the Kingdom compositor** into a shared package — turns a fork back into a spine and unblocks the asset de-dup.
2. Add a thin test around `@arganta/combat` formulas (`boltDamage`, `killReward`) — one regression here breaks three products.
3. Treat every new game as a *config* of this layer, not new code (the P6 farm proved it works).

## Links
[[00-stack]] · [[00-MASTER-KB#6 · Shared Packages — the moat]] · [[L1-data]] · [[L4-assets-content]]

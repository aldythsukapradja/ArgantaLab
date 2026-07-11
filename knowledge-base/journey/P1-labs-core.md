---
type: journey-phase
phase: P1
dates: 2026-06-21 → 2026-06-22
status: frozen
tags: [arganta, journey, P1]
---

# P1 · Labs core

> [!abstract]
> Two days, 11 commits: the kids' learning app grew a face and a spine — Buddy avatar, PlayHome, streaks, Journey/Quests, a Parent page, and the second cut at circles — the identity layer everything later mounts on.

## Shipped

From [[00-MASTER-KB]] §9:

- **Buddy avatar** — the kid's on-screen companion + **outfits** (the first cosmetic surface, seed of the later Shop/Mounts economy)
- **PlayHome** — the daily landing surface for a learner
- **Streaks** — the first retention primitive
- **Journey** + **Quests** — structured progression over the content
- **Parent page** — the guardian-side view
- **Player switcher** — swap between kids on one device
- **circles v2** — the second cut of the identity/grouping model

## Tried & abandoned / superseded

> [!warning] The corpus is doc-light here
> P1 was **pure build** — none of the design docs in the repo are dated Jun 21–22. The doc burst starts the *next* day (P2, [[2026-06-23]]: `CONCEPT_APP_BUILDER`, `SPEC_CIRCLE_APP_SDK`, the App/Game Builder cluster). So P1's dead-ends are visible only in the code's own version numbers and in what the following day overturned.

| Tried in P1 | Fate | Replaced by |
|---|---|---|
| **circles v1** | superseded within the phase | **circles v2** — the "v2" in the ship list *is* the abandonment; v1 was reworked in place |
| **`familyId` / `memberId`** naming | killed | `circleId` / `personId` / `appId` — locked as a decision one day later ([[00-MASTER-KB]] §13, 2026-06-23) |
| **Player switcher** (device-side kid profiles) | superseded | Real **kid PIN login** in P2 — a local convenience became a real auth path |

## Decisions made here

> [!note] No entries logged *on* these dates
> [[00-MASTER-KB]] §13 has **no decision dated Jun 21–22**. But P1's `circles v2` work is what forced the first two logged decisions the very next day:
> - `KinetikCircle uses existing circles, not kinetik_circles` → *one identity model*
> - `Supabase = single source of truth; kill placeholder UI`
>
> The decision was *made* in the P1 code; it was only *written down* in P2. The circles rebuild is the origin of the "the spine is the company" thesis.

## What it taught

- **Rebuild the identity model before it calcifies.** Reaching v2 on circles inside two days — while there were still zero downstream consumers — is exactly why one `circles` table could later carry seven front-ends. Renaming `familyId`→`circleId` here cost nothing; the same rename after P6 would have touched 71 tables. → [[reuse-the-spine-dont-rebuild|one identity model]]
- **A cosmetic layer is an economy seed, not decoration.** Buddy outfits shipped as the first equip surface. It looks like polish, but it's the same slot/equip pattern that compounds into the Shop, Mounts, and `@arganta/character` — the single-character-source instinct started here. → [[reuse-the-spine-dont-rebuild|single character source]]
- **Streaks are the cheapest retention primitive — ship them early, before you have anyone to retain.** P1 built the streak with zero external users; the mechanic was in place long before the distribution problem ([[00-MASTER-KB]] D1) made retention matter.
- **Code-first, doc-later is fine for a spine you're still shaping.** P1 left no design docs and it was the right call — the shape was still moving. The P2 doc burst that "locked" architectures the very next day is the counter-case: several of those "locked" specs were abandoned mid-build. Docs froze plans the code then walked away from. → [[declare-when-you-supersede|lock late]]

## Links

- Neighbors · [[P0-genesis]] → **P1** → [[P2-the-big-day]]
- Master · [[00-MASTER-KB]] §9 (timeline) · §13 (decision log)
- Products seeded here · [[ArgantaLabs]] (Buddy/PlayHome/Journey/Quests/Parent) · [[KinetikCircle]] (circles v2) · [[Circle HQ]] (identity spine it later reads)

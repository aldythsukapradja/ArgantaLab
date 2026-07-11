---
type: lesson
status: living
tags: [arganta, lesson]
---

# The database is the only source of truth; clients are disposable views

> [!quote] The principle
> One schema, one auth, one wallet under seven front-ends. Everything above the substrate is a rewriteable view — so put the truth in exactly one place and let every surface compound off it.

## Evidence
- `supabase/SPINE_CONTRACT.md` — the governing cross-app contract: one identity/family/wallet spine across 3+ apps, "the database is the only source of truth; clients are disposable views." Master KB §13 marks *one identity model* as still holding.
- `docs/COMBAT-SKILLS-CONCEPT.md` → `packages/combat` — "single source of truth = `packages/combat`, edit once both Kingdom and LashiraBloom update." Shipped near-verbatim; KB decision log 2026-07-07 "`@arganta/combat` canonical."
- `docs/lashirabloom/music-builder-concept.md` → `@arganta/audio` — the same author-once-publish-to-a-shared-package pattern deliberately mirrored for a *second* builder surface. The compounding paid off twice.
- `apps/kinetik/README.md` + KB decision 2026-06-23 — KinetikCircle reuses the shared `circles` table, not a bespoke `kinetik_circles` ("one identity model").
- The counter-evidence that proves it: `apps/lashira/web/README.md` copied Kingdom's `compositor/data/palettes` engine wholesale with an "extract to a shared package later" TODO that was never done — becoming debt D2/D3 (3× asset duplication). When you *don't* keep one source, you pay in git bloat.

## The pattern
Value that lives in one authoritative place (a table, an RPC, a shared package) can be consumed by any number of disposable front-ends and gets *better* with each new consumer. Value that is copied gets *worse* with each copy — every fork is a future divergence and a merge you will never do.

## Watch for
- The "extract to a shared package later" TODO. "Later" is where duplication debt is born (D2 939 MB `.git`, D3 4,026 PNGs × 3). Extract at the second use, not the third.
- A client that holds authoritative state the DB doesn't have — that client is now a source of truth you didn't mean to create.
- Two implementations of the same rule drifting apart (see `CHARACTER-LAB-POLISH-DB-BACKED-PLAN.md`: `game_grant()` used `floor(1+sqrt(xp/100))` while the client used `floor(xp/500)+1` — two level formulas, caught only in battle-test, forced into a single `argantalab_level_from_xp()`).

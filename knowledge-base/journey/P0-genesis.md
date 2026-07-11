---
type: journey-phase
phase: P0
dates: 2026-06-19 → 2026-06-20
commits: 24
status: frozen
tags: [arganta, journey, P0]
---

# P0 · Genesis

> [!abstract] Two days, one seam
> Standalone static-HTML games got dragged into a React SPA, given Supabase auth and a Diamond Shop, and pushed to Vercel — the first stones of the spine everything later stands on.

## Shipped
*(from [[00-MASTER-KB#9 · Build Timeline — 22 days|§9]])*

- **Static HTML games → React app** — the initial deliverables were self-contained HTML game files; within the phase they were folded into a single React SPA.
- **Supabase auth** — cloud identity wired from near-day-one, not bolted on later.
- **Guest-first auth** — play first, sign up later; the gate sits *after* the fun, not before it.
- **Diamond Shop** — the first economy primitive: a wallet + a place to spend it.
- **Vercel deploy** — a live URL from the start.

## Tried & abandoned / superseded

> [!note] The supersession is internal to the phase
> None of the design docs in the corpus are dated this early (the earliest is [[2026-06-23]]). P0's only "abandoned" thing is P0's own starting point.

| Tried | Replaced by | Why |
|---|---|---|
| Standalone **static HTML games** | **React SPA** | One shell, shared state, real auth — impossible across loose HTML files |
| (implicit) local-only play | **Supabase from genesis** | Cloud identity had to be the floor, not a retrofit |

This is the first instance of a habit that repeats the whole journey: **rewrite, don't refactor.** The static→React jump previews Godot→PixiJS→NexusTK ([[kingdom]]), Gold→Bloom, and the AppBuilder→BuilderShell convergence. Fast when the domain is understood — but it's why line-numbered plans against specific files keep ageing out downstream.

## Decisions made here

> [!info] Seeded, not yet logged
> The formal [[00-MASTER-KB#13 · Decision Log|decision log]] opens on [[2026-06-23]]. Nothing is stamped Jun 19–20 — but two of its load-bearing entries are *decided in behaviour* here and only ratified later:

- **Supabase = single source of truth** — enacted in P0 auth; written down 2026-06-23. ✅ still holds.
- **One wallet** — the Diamond Shop is the genesis of `diamond_ledger` + `wallet_*`, the single economy that later sits under all seven front-ends. ✅ still holds.

## What it taught

> [!tip] The economy primitive paid the highest compound interest
> The two-day Diamond Shop became the shared wallet spine — `wallet_earn/spend/reconcile`, `diamond_ledger`, one currency under [[ArgantaLabs]], [[KinetikCircle]], [[LashiraBloom]], [[Kingdom]]. Building the money primitive *first*, before there was much to buy, is exactly why the repo compounds into one substrate instead of five parallel apps. → [[reuse-the-spine-dont-rebuild|build the spine first]]

- **Guest-first was the right funnel instinct — aimed at a door no stranger ever walked through.** Play-before-signup is textbook activation design; the phase built the mechanism and every phase after it kept polishing the product behind the gate. The gate works. [[00-MASTER-KB#11 · Debt Register|Zero external users]] (D1) means it was never load-tested by anyone outside the household. → **guest first auth**
- **Cloud-first from genesis is why the spine exists.** Choosing Supabase auth on day one — rather than "local now, sync later" — is the seed of the "database is the only source of truth; clients are disposable views" contract that governs the whole monorepo. Retrofitting identity later would have forced the parallel-apps trap. → [[database-is-the-only-source-of-truth|cloud first from day one]]
- **Rewrite-over-refactor is fast and lossy.** The static→React rewrite shipped in two days, but it set the template for a repo that rebuilds rather than incrementally evolves — a strength for velocity, the direct cause of stale plans and drifting docs later. → [[reuse-the-spine-dont-rebuild|rewrite over refactor]]

## Links

- Phase index: [[00-MASTER-KB#9 · Build Timeline — 22 days|Build Timeline]]
- Next phase: [[P1-labs-core]]
- Products seeded here: [[ArgantaLabs]] · [[Circle HQ]] (wallet ontology)
- Spine: [[00-MASTER-KB#3 · Supabase Schema|one Supabase project]] · [[00-MASTER-KB#6 · Shared Packages — the moat|packages/*]]

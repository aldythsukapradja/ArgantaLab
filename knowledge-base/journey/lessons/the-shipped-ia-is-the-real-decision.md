---
type: lesson
status: living
tags: [arganta, lesson]
---

# Prose is cheap; the shipped IA is where the decision is actually made

> [!quote] The principle
> A "locked" spec, a design brief, a line-numbered refactor plan — all describe intent. The real decision is whatever the running code does. Design in prose all you like, but don't mistake the doc for the choice.

## Evidence
- **Battle Builder redesigned 5× in markdown before converging.** `battle-builder-plan` → `battle-builder-redesign` → `battle-command-center-v2` → `battle-forge-redesign` all collapsed into one shipped `BattleBuilder.tsx` (Overview/Combat/Bestiary/Rewards + Monster Lab). Two "redesign from scratch" docs (v2 and forge) both shipped and *coexist* as overlapping monster-authoring UIs — churn produced duplication, not one converged answer.
- `CONCEPT-bloomwall-real-tower-defense.md` — the same realm re-spec'd ~6 times in one day (v1→v1.5).
- `docs/KINETIKCIRCLE-DESIGN-HANDOFF.md` — pitched a 5-tab IA (Today/Calendar/Moments/**Learn/Circle**); the actual shell shipped Today/Calendar/Moments/**Apps/Me**. "Design briefs describe an intent; the shipped IA is where the real decision was made."
- **"Locked" specs that the code walked away from:** `SPEC_CIRCLE_APP_SDK.md` ("This spec is locked" — production backend never built), `ARCHITECTURE_APP_BUILDER_MODULAR_SCALABLE.md` (bespoke `AppBuilder.tsx` tree "locked," then abandoned for a shared `BuilderShell`), `CONCEPT_JARVIS_CEO.md` (locked premium viz stack → replaced by recharts/d3).
- **Line-numbered plans against monolithic files age out fastest:** `BUILD_PLAN_MOBILE_VISUALS.md` targeted `GameBuilder.tsx` by line number; the file was fully rewritten into a shared shell. Arganta rewrites rather than incrementally refactors, so file-specific plans invalidate on the next rewrite.

## The pattern
The repo's convergence story is *rewrite, not refactor*. Every detailed plan bound to a specific file structure or "locked" architecture aged out when the surface was replaced. The docs that survived were the ones describing *contracts and intent* (a registry, a shell, a provenance rule), not layouts and line numbers.

## Watch for
- The word "locked" in a design doc. It correlates with being abandoned mid-build here more often than with being honored.
- More than two redesign passes on the same surface in prose — that's a signal to build the cheapest version and let the running UI settle the argument.
- Line numbers, exact file paths, and named React components in a plan. Write plans against the *contract* the surface must satisfy, so a rewrite doesn't invalidate them.
- Two "from scratch" redesigns both shipping and coexisting (Bestiary + Monster Lab) — a sign nobody forced convergence.

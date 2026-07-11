---
type: lesson
status: living
tags: [arganta, lesson]
---

# A concept must declare when it supersedes its ancestors — or the churn becomes debt

> [!quote] The principle
> Decisions thrash — currencies, architectures, whole product concepts get overruled within a day. The only defense is an in-doc audit log and an explicit supersede marker, so a reader can tell which version still wins.

## Evidence
- **Currency thrash:** Diamonds-open → Gold → **Bloom**, the last two names living less than 24h apart (`LASHIRABLOOM-FARMVILLE-CONCEPT.md` invented Gold; `LASHIRABLOOM-GAMEPLAY-CONCEPT.md` locked open-Diamonds; both superseded by Bloom, KB decision 2026-07-08). `map-and-asset-manifest.md` literally self-supersedes its own Gold→Bloom mid-file — and its §16 "audit-log-in-a-doc" habit is what kept it usable through the churn.
- **Concept pivots stacked:** `docs/kingdom-of-kin/CLAUDE.md` — Godot rejected for PixiJS-Kin, then PixiJS-Kin rejected for a NexusTK rebuild. Directional thrash before `apps/kingdom` found its shape, only legible because each pivot was dated.
- **Same-day supersession:** `PLAN-inspector-fields-and-prompt-starter.md` absorbed by the v2 pixel-inspector handoff the same day; Fable prompts 03/04 superseded by master prompt 01 within the burst.
- **The motivating gap:** `docs/README.md`'s own "Known gaps" names the exact problem — "nothing marks a doc as current source-of-truth vs superseded" — and this KB (status: current/superseded/partial/archive per doc) is the fix.

## The pattern
In a repo that rewrites fast, docs pile up as "loose papers" where the newest and the dead sit side by side with no status. Two lightweight habits prevent the confusion: (1) an in-file audit log that records each pivot with a date, and (2) an explicit `supersedes:` pointer so any doc knows its ancestor. Naming discipline is the same instinct at the value level — `circleId` not `familyId`, one settled name beats three synonyms drifting apart.

## Watch for
- A "locked" decision that gets overruled the next day with no marker — the reader three weeks later cannot tell Gold from Bloom without archaeology.
- A concept folder with no INDEX declaring which doc is ground-truth (the openworld folder got one; the root "loose papers" didn't).
- A fossil name outliving its rename: `killReward` still comments "Diamonds per kill" long after the currency became Bloom. Rename the value *and* its comments, or the ghost misleads.

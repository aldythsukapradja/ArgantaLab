---
date: 2026-07-18
tags: [arganta, audit, repo]
title: Repo Reality Audit — What Was Actually Built
---

# Repo Reality Audit

What the codebase says the company is, regardless of what any strategy doc says. Feeds [[03-Gap-Analysis]] and [[06-Wayforward-90-Days]].

## Inventory

**7 apps:** `hq` (founder command center — by far the largest), `kinetik` (family circle app — the real product), `landing` (marketing site → being rebuilt as family chatbot), `web` (KinQuest RPG), `lashira` (farming RPG), `kingdom` (MMORPG concept), `mcp` (bridge/tooling).

**11 packages:** agent, ai (4-tier LLM router), audio, brand, builder, character, combat, heroes-engine, media-core, usage, video.

**6 Supabase edge functions**, ~60 planning/handoff docs, plus a `command-center`, `media-center`, `arganta-core`, `jarvis-os`, `repository-archaeology` doc tree.

## Classification: product vs. tooling vs. play

| Bucket | What | Share of effort (est.) | Users it can reach |
|---|---|---|---|
| **Customer product** | kinetik, landing/chat, web (KinQuest) | ~25% | Real families |
| **Founder tooling** | hq + its ~20 studios, mcp bridge, command center | ~50% | 1 person (you) |
| **Engines/infra** | 11 packages, edge functions | ~15% | Indirect |
| **Exploration/play** | lashira, kingdom, character studio, NexusTK extraction, influencer sim | ~10% | 0 today |

**Half the company's output is software whose only user is its founder.** Some of it is genuinely strategic (content pipeline → distribution fuel), but most is elaborate self-directed R&D: a Reactor visualizer, a volumetric brain over the Vault, a karaoke engine, a WebGL keynote deck, an Instagram simulator, a formant-synth video engine. Individually impressive; collectively, this is a *portfolio of demos*, and demos don't compound.

## The "pending migration" pathology

A pattern repeats across at least 8 features: built, verified locally, **SQL migration never run on live Supabase** (`migration_game_scores`, `migration_core_projects`, `migration_post_library`, `migration_ig_plan`, `migration_lashira_my_circles`, `migration_artifact_game_kind`, missions migration, hq_engagement RPC). Meaning: the *feeling* of shipping is being harvested without the *fact* of shipping. This is the clearest behavioral signature in the repo: **completion is consistently abandoned at ~95% in favor of starting the next thing.** A unicorn is built out of the last 5%.

Related known issues: llm-proxy edge function returns non-2xx (builder AI silently mocked for its whole life); Command Center blocked on https→ws (`tailscale serve` fix known, not applied). The *known-fix-not-applied* list is itself a symptom.

## What is genuinely strong (assets, honestly valued)

1. **Kinetik + the learning engine lineage** (KinQuest battle engine, drills→quiz adapter, rings/North Star, ArgantaCup, rank seasons). Years of real pedagogy-adjacent game design. **This is the moat** — see [[05-Unicorn-Path]].
2. **The content production fabric** (Post Studio, Video Builder, Buffer→IG pipeline — actually LIVE). This is a distribution weapon *if pointed at one product's launch* instead of five brands.
3. **The AI plumbing** (@arganta/ai router, media-core, Cloudflare workers, arganta-chat-brain edge fn). Right primitives for the assistant wedge.
4. **Founder velocity.** The raw build throughput here is the top-1% kind. The problem has never been ability; it is allocation.

## What the repo lacks entirely

- Any user-research artifact (interviews, surveys, waitlist data)
- Any external-user telemetry (the usage tracker exists; its aggregation RPC migration is… pending)
- Any App Store / TestFlight / PWA-install path for a stranger's family
- CI, tests on the customer-facing apps, error reporting for real users
- A single public URL a parent could sign up at today and get the wedge experience

Continue to [[03-Gap-Analysis]].

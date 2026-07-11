---
title: L1 · Data
type: layer-tracker
layer: data
status: living
health: green
maturity: hardened
leverage: high
date: 2026-07-11
tags: [arganta, layer, data, supabase]
cssclasses: [wide-tables]
---

# L1 · Data — the single source of truth

> [!abstract] Health: 🟢 hardened · Leverage: 🟢 high (stable)
> One Supabase project under everything: **71 tables · 147 RPCs · 45 migrations**. `schema.sql` (64 KB) + `seed_content.sql` (350 KB curriculum). This is the spine the whole company stands on — mature, load-bearing, and the layer that is *actually* single-source. Its risk isn't capability, it's **untested money paths**.

## Baseline state (2026-07-11)

- **71 tables** across 8 domains (identity/circles · learning · games/builder · economy/cosmetics · lashira/kingdom · kinetik · assets · hq). Verified against `supabase/*.sql`.
- **147 RPCs** — the app never writes tables directly; `log_learn_event`, `wallet_*`, circle admin, etc. are the write surface. `SECURITY DEFINER` gates operator/HQ reads.
- **45 migration files** + base `schema.sql` + `seed_content.sql` + `kinetik_schema.sql`.
- **Invariant (holds):** GitHub stores code/migrations/schema history; Supabase stores game truth, ledgers, live state. Kids' diamonds + education EXP are single-sourced here. (§13, [[database-is-the-only-source-of-truth]])

### Migration tracker (45, grouped by domain)

> [!info] Filenames aren't dated — order is by domain, not time. This table is the standing index; append new migrations as rows.

| Domain | Migrations |
|---|---|
| Identity / circles | `spine` · `circles_admin` · `circle_invites` · `friends` · `dedupe_family` · `hq_family` · `lashira_my_circles` |
| Learning | `kid_stage` · `daily_rings` · `analytics_rewards` |
| Economy / cosmetics | `character_shop` (+`_equip` +`_enhance`) · `mounts` (+`_reprice`) · `operator_diamonds` · `wallet_cleanup` · `lashira_starter_outfit` |
| Games / builder | `game_scores` · `command_graph` |
| Combat · Lashira · Kingdom | `combat_tuning` · `character_registry` · `kingdom_npc_registry` · `nexus` (+`_count`) · `openworld_kin` · `lashira_farm_cloud` · `lashira_multi_farm` · `lashira_pvp` · `lashira_art_egress_fix` |
| Co-op / PvP | `coop` (+`_expire`) · `competitions` |
| Assets | `audio_library` · `audio_usage` (+`_daily`) · `music_library` · `pixel_vault` |
| HQ / growth | `hq_character_admin` · `hq_character_roster_v2` · `growth` (+`_v2`) · `valuation_snapshot` · `clear_featured` |
| Auth | `auth_fix` |

## Maturity × Leverage
- **Maturity 🟢 hardened** — 45 migrations of real iteration; the RPC-only write discipline is enforced; the invariant has held since 2026-06-23.
- **Leverage 🟢 high but *stable*** — everything sits on it, but it's not the bottleneck. Moving it doesn't unlock growth; it just keeps the floor solid.

## What changed
*Baseline — the zero point. Future schema/migration changes get a dated bullet here.*
- `2026-07-11` — baseline captured: 71/147/45.

## Lessons
- [[database-is-the-only-source-of-truth]] — clients are disposable views; this layer is why that holds.
- [[dont-add-a-dependency-before-scale-demands-it]] — 71 tables is already a lot for 0 users; resist adding more before a user needs one.

## Debt & risks
- **D5 — 6 tests / 96k LOC.** The money paths (`wallet_*`, `log_learn_event`, auth RPCs) are untested. Highest-value test target in the repo. → [[00-MASTER-KB#11 · Debt Register]]
- RLS surface is wide (147 RPCs); no automated policy audit.

## Wayforward
1. **Test the money paths** — `wallet_earn/spend/reconcile`, `log_learn_event`, `adopt_kid`. A dozen tests cover the ledger integrity that revenue will depend on.
2. Keep this migration tracker current — one row per new migration, so schema history is legible without `git log`.
3. Freeze new tables until a real user forces one (see [[L7-distribution]]).

## Links
[[00-stack]] · [[00-MASTER-KB#3 · Supabase Schema]] · `supabase/SPINE_CONTRACT.md` · `supabase/schema.sql`

---
title: Table Map — all 71 Supabase tables
type: map
status: living
date: 2026-07-11
snapshot_commit: a00b826
total_tables: 71
tags: [arganta, map, data, supabase]
cssclasses: [wide-tables]
---

# 🧬 Table Map — 71 tables, every one placed

> [!abstract] What this is
> Every table in the single Supabase project, mapped to its **domain**, **purpose**, the **migration/schema file** that defines it (ties back to [[L1-data]]'s migration tracker), its **primary RPC(s)** (the write/read surface — the app never touches tables directly), and the **apps that use it**. Table names + defining files are verified against `supabase/*.sql`; purpose/usage are annotated from [[00-MASTER-KB#3 · Supabase Schema|§3]].

> [!info] One project, one schema, all apps
> 33 tables live in `schema.sql`; the other 38 arrive via `migration_*.sql`. Circle HQ (`hq_*`) is **additive + read-only** over the product tables.


## Identity & Circles  (8)

| Table | Purpose | Defined in | Key RPC(s) | Used by |
|---|---|---|---|---|
| `avatar_state` | Equipped avatar/outfit per person. | `schema.sql` | grant_starter_outfit | web · lashira |
| `child_profiles` | Kid sub-accounts under a guardian. | `schema.sql` | adopt_kid · my_children | web |
| `circle_invites` | Pending circle invitations. | `migration_circle_invites.sql` | invite_to_circle · respond_to_invite | kinetik |
| `circle_members` | Membership + role in a circle. | `schema.sql` | circle_roster · set_member_role | kinetik · web |
| `circles` | The unit — family/friend/app circle. circleType. | `schema.sql` | create_circle · ensure_family_circle | all |
| `friendships` | Friend graph + codes. | `migration_friends.sql` | send_friend_request · my_friends | web · kinetik |
| `guardianships` | Guardian↔kid link. | `migration_spine.sql` | link_kid · unlink_kid | web |
| `profiles` | Root user/account row; role gate (operator). | `schema.sql` | handle_new_user | all |

## Learning · ArgantaLabs  (20)

| Table | Purpose | Defined in | Key RPC(s) | Used by |
|---|---|---|---|---|
| `badges` | Badge catalogue. | `schema.sql` | — | web |
| `content_meta` | Content pack metadata. | `seed_content.sql` | — | web · hq |
| `daily_summary` | Per-kid daily rollup (rings/streak). | `migration_analytics_rewards.sql` | kid_today_rings | web |
| `interaction_types` | Item interaction taxonomy. | `schema.sql` | — | web |
| `item_attempts` | Every answer attempt (raw). | `schema.sql` | log_learn_event | web |
| `items` | The actual question/interaction item. | `schema.sql` | — | web |
| `journey_nodes` | Journey map node (the learning path). | `schema.sql` | — | web |
| `journey_units` | Unit grouping journey nodes. | `schema.sql` | — | web |
| `learn_event` | Canonical learning event (single write path). | `migration_analytics_rewards.sql` | log_learn_event | web |
| `learn_state` | Derived per-kid learning state. | `schema.sql` | recompute_engagement | web |
| `node_progress` | Per-kid progress on a journey node. | `schema.sql` | kid_dashboard | web |
| `quest_progress` | Quest completion state. | `schema.sql` | — | web |
| `skill_mastery` | Per-skill mastery, updated server-side. | `schema.sql` | log_learn_event | web |
| `skills` | Skill under a topic (mastery unit). | `schema.sql` | skill_mastery | web |
| `stages` | Difficulty stage of a skill. | `schema.sql` | — | web |
| `strands` | Curriculum strand under a world. | `schema.sql` | — | web |
| `topics` | Topic under a strand. | `schema.sql` | — | web |
| `user_badges` | Badges earned per user. | `schema.sql` | — | web |
| `world_progress` | Per-kid world completion rings. | `schema.sql` | kid_world_rings | web |
| `worlds` | Curriculum top level (subject worlds). | `schema.sql` | kid_world_rings | web |

## Games & Builder  (7)

| Table | Purpose | Defined in | Key RPC(s) | Used by |
|---|---|---|---|---|
| `artifact_analytics` | Builder artifact analytics. | `builder_analytics.sql` | — | hq |
| `artifact_telemetry` | Builder artifact telemetry events. | `builder_analytics.sql` | — | hq |
| `circle_game_saves` | Shared circle-scoped save. | `migration_lashira_farm_cloud.sql` | save_circle_game_state | web · kinetik |
| `game_saves` | Per-user game save blob. | `schema.sql` | save_game_state · load_game_state | web |
| `game_scores` | Score submissions. | `migration_game_scores.sql` | submit_game_score · get_game_leaderboard | web |
| `game_versions` | Version snapshots of a game. | `schema.sql` | snapshot_game_version | web · hq |
| `games` | Published game/app record (Builder). | `schema.sql` | save_game_state · bump_play | web · hq |

## Economy & Cosmetics  (8)

| Table | Purpose | Defined in | Key RPC(s) | Used by |
|---|---|---|---|---|
| `diamond_ledger` | Append-only diamond wallet ledger. | `migration_analytics_rewards.sql` | wallet_earn · wallet_spend · grant_diamonds | all |
| `mount_catalog` | Mount cosmetics catalogue. | `migration_mounts.sql` | buy_mount | web |
| `person_cosmetic_items` | Cosmetics owned/equipped per person. | `migration_character_shop.sql` | equip_cosmetic_item · enhance_cosmetic_item | web · lashira |
| `person_creatures` | Owned creatures/pets. | `migration_nexus.sql` | — | web |
| `person_mounts` | Mounts owned per person. | `migration_mounts.sql` | my_mounts · equip_mount | web |
| `pvp_rank` | PvP rank/rating. | `migration_lashira_pvp.sql` | pvp_record_ko | lashira |
| `rank_points` | Season rank points. | `rank.sql` | add_rank_points · season_points | web · lashira |
| `shop_cosmetic_catalog` | Cosmetic item catalogue. | `migration_character_shop.sql` | buy_cosmetic_item | web · lashira |

## LashiraBloom  (8)

| Table | Purpose | Defined in | Key RPC(s) | Used by |
|---|---|---|---|---|
| `competition_entrants` | Competition participants + standings. | `migration_competitions.sql` | competition_standings | web · lashira |
| `competitions` | Competition/tournament header. | `migration_competitions.sql` | create_competition · settle_competition | web · lashira |
| `coop_member` | Co-op session participants. | `migration_coop.sql` | coop_join · coop_act | web · lashira |
| `coop_session` | Co-op session header. | `migration_coop.sql` | coop_create · coop_state | web · lashira |
| `lashira_farm_saves` | Farm save state (cloud). | `migration_lashira_farm_cloud.sql` | save_lashira_farm_state · load_lashira_farm_state | lashira |
| `lashira_pixel_art` | Player/pixel art for Lashira. | `migration_lashira_farm_cloud.sql` | — | lashira |
| `nexus_kin_catalog` | Kin creature catalogue. | `migration_nexus_count.sql` | befriend_kin · care_kin | web · lashira |
| `nexus_state` | Nexus (kin world) state. | `migration_nexus_count.sql` | nexus_harvest · nexus_roster | web · lashira |

## Kingdom / combat  (3)

| Table | Purpose | Defined in | Key RPC(s) | Used by |
|---|---|---|---|---|
| `character_registry` | Shared character/hero registry. | `migration_character_registry.sql` | hq_character_save · hq_character_roster | kingdom · lashira · hq |
| `combat_tuning` | Combat balance config (DB-tunable). | `migration_combat_tuning.sql` | hq_combat_publish | lashira · kingdom · hq |
| `kingdom_npcs` | NPC registry for Kingdom. | `migration_kingdom_npc_registry.sql` | hq_npc_save · hq_npc_roster | kingdom · hq |

## KinetikCircle  (1)

| Table | Purpose | Defined in | Key RPC(s) | Used by |
|---|---|---|---|---|
| `kinetik_state` | KinetikCircle app state blob. | `kinetik_schema.sql` | — | kinetik |

## Assets  (6)

| Table | Purpose | Defined in | Key RPC(s) | Used by |
|---|---|---|---|---|
| `audio_library` | SFX/music library. | `migration_audio_library.sql` | hq_audio_publish | lashira · hq |
| `audio_usage` | Audio play/usage events. | `migration_audio_usage.sql` | — | lashira · hq |
| `audio_usage_daily` | Daily audio usage rollup. | `migration_audio_usage_daily.sql` | — | hq |
| `music_library` | Generated/curated music tracks. | `migration_music_library.sql` | hq_music_publish | lashira · hq |
| `pixel_asset` | Pixel Vault asset catalogue. | `migration_pixel_vault.sql` | pixel_query · pixel_get | hq · mcp |
| `pixel_palette` | Palette catalogue for Pixel Vault. | `migration_pixel_vault.sql` | pixel_palettes | hq · mcp |

## Circle HQ (read-only)  (10)

| Table | Purpose | Defined in | Key RPC(s) | Used by |
|---|---|---|---|---|
| `featured_curator_log` | Curator action log. | `builder_analytics.sql` | — | hq |
| `hq_app` | App node in the command graph. | `schema.sql` | hq_growth_overview | hq |
| `hq_event` | Product event (HQ analytics). | `schema.sql` | hq_activity | hq |
| `hq_feature` | Feature node. | `schema.sql` | hq_content_matrix | hq |
| `hq_featured` | Featured/curation records. | `schema.sql` | clear_featured | hq |
| `hq_insight_rule` | Insight/rule definitions. | `schema.sql` | — | hq |
| `hq_metric_def` | Metric definitions. | `schema.sql` | hq_schema_model | hq |
| `hq_ontology` | The knowledge-graph ontology. | `schema.sql` | hq_latest_ontology | hq · mcp |
| `hq_product_northstar` | North-star metric per product. | `schema.sql` | hq_portfolio_rollup | hq |
| `valuation_snapshot` | Valuation snapshots (Treasury). | `migration_valuation_snapshot.sql` | valuation_estimate · valuation_history | hq · mcp |

---

## Links
[[L1-data]] · [[00-MASTER-KB#3 · Supabase Schema]] · [[00-stack]] · `supabase/schema.sql` · `supabase/SPINE_CONTRACT.md`

---
title: Arganta — Master Knowledge Base
type: moc
status: living
date: 2026-07-11
snapshot_commit: a00b826
snapshot_date: 2026-07-11
repo: https://github.com/aldythsukapradja/ArgantaLab
owner: Aldyth Sukapradja
external_users: 0
loc_total: 96000
tables: 71
rpcs: 147
deploy_targets: 7
tags:
  - arganta
  - moc
  - monorepo
  - supabase
  - vercel
  - knowledge-base
aliases:
  - Arganta KB
  - Repo Status
cssclasses:
  - wide-tables
---

# 🜂 ARGANTA — MASTER KNOWLEDGE BASE

> [!abstract] Snapshot
> **Repo** · [ArgantaLab](https://github.com/aldythsukapradja/ArgantaLab)
> **Commit** · `a00b826`
> **Date** · [[2026-07-11]]
> **Verdict** · 96k LOC · 71 tables · 147 RPCs · 7 deploy targets · **0 external users**

**Sections 1–8** = state of the world (regenerate on architecture change).
**Section 9** = history. **§10** = scoreboard. **§11** = debt. **§12** = the only part you edit weekly.

---

## 0 · The One-Paragraph Truth

> [!important] This is not five products. It is one substrate.
> A single Supabase project (71 tables, 147 RPCs), a single identity/circle model, a shared `packages/*` engine layer, and one pixel-art pipeline — with **seven front-ends mounted on it**. [[KinetikCircle]], [[ArgantaLabs]], [[LashiraBloom]] and [[Circle HQ]] are *skins on the same spine*.
> **The spine is the company.** Miss that and you keep building parallel apps that are the same app.

```
                 ┌──────────────────────────────────┐
                 │       ONE SUPABASE PROJECT       │
                 │  profiles · circles · diamonds   │
                 │  items · attempts · saves · art  │
                 └────────────────┬─────────────────┘
                                  │ one schema · one auth · one wallet
  ┌─────────┬─────────┬───────────┼───────────┬─────────┬─────────┐
apps/web  apps/kinetik apps/lashira apps/kingdom apps/hq apps/landing apps/mcp
ArgantaLabs KinetikCircle LashiraBloom  Kingdom   Circle HQ arganta.app The Bridge
 learning    social+cal     RPG/farm   combat lab   Jarvis   marketing   MCP
  └─────────┴─────────┴───────────┴───────────┘
     all consume packages/{audio, character, combat, heroes-engine}
```

---

## 1 · Product Map

| # | Product | Path | Role | Deploy | Maturity |
|---|---|---|---|---|---|
| — | [[Arganta]] | `apps/landing` | Company / umbrella | Vercel · `arganta.app` | Shipped, cosmetic |
| 1 | [[KinetikCircle]] | `apps/kinetik` | Social media + calendar | Vercel + Capacitor | Functional · 0 users |
| 2 | [[ArgantaLabs]] | `apps/web` | Kids daily learning | Vercel + Capacitor | **Most complete** (34k LOC) |
| 3 | [[LashiraBloom]] | `apps/lashira` + `apps/kingdom` | RPG that connects everything | Vercel | Heavy active build |
| 4 | [[Circle HQ]] | `apps/hq` + `apps/mcp` | The Jarvis / OS | Vercel + **Render** | Functional (26k LOC) |

> [!note] Naming locked
> `circleId` · `circleType` · `personId` · `appId` — **never** `familyId` / `memberId`.

---

## 2 · Repo Structure

```
ArgantaLab/                     3.0 GB tree · 939 MB .git ⚠️
├── apps/
│   ├── web/        34,196 LOC · 221 files   ArgantaLabs   React·Vite·Capacitor
│   ├── hq/         25,820 LOC · 153 files   Circle HQ     React·Vite·R3F
│   ├── lashira/    14,070 LOC ·  75 files   LashiraBloom  React·Canvas
│   ├── kinetik/     7,234 LOC ·  42 files   KinetikCircle React·Vite·Capacitor
│   ├── kingdom/     6,904 LOC ·  31 files   Kingdom       React·Canvas
│   ├── landing/     4,197 LOC ·  33 files   arganta.app   React·Three·GSAP
│   └── mcp/           941 LOC ·   7 files   The Bridge    Node·MCP SDK
├── packages/       ← SHARED SPINE, the real asset
│   ├── combat/      1,429 LOC   @arganta/combat
│   ├── audio/         931 LOC   @arganta/audio
│   ├── heroes-engine/ 498 LOC   @arganta/heroes-engine
│   └── character/     209 LOC   @arganta/character
├── supabase/       55 SQL files
├── docs/           129 markdown
├── render.yaml     Bridge → Render
├── vercel.json     root → builds apps/hq
└── start-*.bat     local launchers
```

**Totals** — ~96,000 LOC · 34,768 PNG · 5,254 GIF · 472 WAV · 132 MP3

### 2.1 Surface index

| App | Surfaces |
|---|---|
| **web** | PlayHome · LearnHub · Learn · Wizard · BuilderLab · PitchBuilder · Shop · MountShop · MyGameStore · Discover · Library · Avatar · Fame · Profile · FamilyPulse · Quests · KinWorld · **KinQuest** · Arena · World · Parent · AdminStudio |
| **web/engine** | core · draw · shell · sfx · worlds · genres · **bridge** (Circle Game SDK host) |
| **web/lib** | 45 modules — analytics · wallet · streak · quests · circles · coop · competitions · mounts · rank · parentGate · adaptive · taxonomy |
| **web/data** | contentPack2…14 (13 packs) · drills · learn · kinquest · openworld · promptForge |
| **hq** | Agents · Architecture · Broadcast · Content · Data · **Growth** · Landing · Monetization · Portfolio · Vault · WorldMap · ReactorOrb + `command/ battle/ builders/ character/ pixel/ music/ world/` |
| **kinetik** | Today · Calendar · Moments · Apps · Me · Farm · Login + PadelApp · KitchenApp · TravelApp · VaultApp |
| **lashira** | realms: arena · bloomwall · festival · keep · kitchen |
| **landing** | Hub · PitchDeck · AppShell · decks · stage · three |

---

## 3 · Supabase Schema

> [!info] One project. One schema. All apps.
> `schema.sql` (65 KB) + 50 `migration_*.sql` + `seed_content.sql` (350 KB curriculum).
> **[[Circle HQ]] is additive and read-only** — `hq_*` tables + `SECURITY DEFINER` RPCs reading ArgantaLabs' tables. HQ never mutates the product.

Operator gate:
```sql
update public.profiles set role = 'operator' where email = 'aldhyt.sukapradja@gmail.com';
```

### 3.1 Tables — 71

- **Identity & Circles (8)** · `profiles` `circles` `circle_members` `circle_invites` `child_profiles` `guardianships` `friendships` `avatar_state`
- **Learning · ArgantaLabs (20)** · `worlds` `strands` `topics` `skills` `stages` `items` `interaction_types` `journey_nodes` `journey_units` `node_progress` `world_progress` `item_attempts` `learn_event` `learn_state` `skill_mastery` `daily_summary` `quest_progress` `content_meta` `badges` `user_badges`
- **Games & Builder (7)** · `games` `game_versions` `game_saves` `game_scores` `circle_game_saves` `artifact_analytics` `artifact_telemetry`
- **Economy & Cosmetics (8)** · `diamond_ledger` `rank_points` `pvp_rank` `mount_catalog` `person_mounts` `shop_cosmetic_catalog` `person_cosmetic_items` `person_creatures`
- **LashiraBloom / Kingdom (11)** · `lashira_farm_saves` `lashira_pixel_art` `kingdom_npcs` `character_registry` `nexus_state` `nexus_kin_catalog` `combat_tuning` `coop_session` `coop_member` `competitions` `competition_entrants`
- **KinetikCircle (1)** · `kinetik_state`
- **Assets (6)** · `pixel_asset` `pixel_palette` `audio_library` `audio_usage` `audio_usage_daily` `music_library`
- **Circle HQ (10)** · `hq_app` `hq_event` `hq_feature` `hq_featured` `hq_insight_rule` `hq_metric_def` `hq_ontology` `hq_product_northstar` `valuation_snapshot` `featured_curator_log`

### 3.2 RPCs — 147

| Domain | Key RPCs |
|---|---|
| Auth / identity | `handle_new_user` `auto_confirm_kid_email` `adopt_kid` `link_kid` `link_child` `unlink_kid` `reset_kid_pin` `update_kid` `my_children` |
| Circles | `create_circle` `delete_circle` `ensure_family_circle` `add_kid_to_circle` `invite_to_circle` `respond_to_invite` `revoke_invite` `leave_circle` `remove_circle_member` `set_member_role` `circle_roster` `list_my_circles` `is_circle_owner/admin/member` |
| Social | `send_friend_request` `respond_friend_request` `remove_friend` `my_friends` `gen_friend_code` `find_by_code` `search_users` `social_stats` `kid_friends` |
| Learning | **`log_learn_event`** ← single write path; updates `skill_mastery` + `daily_summary` server-side · `kid_dashboard` `kid_today_rings` `kid_world_rings` `recompute_engagement` |
| Economy | `wallet_balance` `wallet_earn` `wallet_spend` `wallet_reconcile` `grant_diamonds` `adjust_kid_diamonds` `grant_starter_pack` `grant_starter_outfit` |
| Shop | `buy_cosmetic_item` `equip_cosmetic_item` `enhance_cosmetic_item` `buy_mount` `equip_mount` `my_mounts` |
| Games | `save_game_state` `load_game_state` `save_circle_game_state` `submit_game_score` `get_game_leaderboard` `snapshot_game_version` `bump_play` |
| Co-op / PvP | `coop_create` `coop_join` `coop_act` `coop_state` `pvp_record_ko` `create_competition` `settle_competition` `competition_standings` |
| Lashira / farm | `save_lashira_farm_state` `load_lashira_farm_state` `load_member_farm_state` `nexus_harvest` `nexus_roster` `befriend_kin` `care_kin` |
| Rank | `add_rank_points` `season_of` `season_points` `get_leaderboard` `get_kid_leaderboard` `my_cups` |
| **HQ (operator, read-only)** | `hq_is_operator` **`hq_growth_overview`** `hq_dau_mau` `hq_retention` `hq_acquisition` `hq_activity` `hq_economy` `k_factor` `hq_portfolio_rollup` `hq_portfolio_vc` `hq_content_matrix` `hq_family_stats` `hq_game_stats` `hq_kinetik_stats` `hq_schema_model` `hq_schema_insights` `hq_latest_ontology` `surface_health` |
| HQ authoring | `hq_character_save/get/publish/roster` `hq_npc_save/get/delete/roster` `hq_audio_publish` `hq_music_publish` `hq_combat_publish` |

> [!danger] The instrumentation is already done.
> `hq_growth_overview()` computes DAU, WAU, MAU, stickiness, WoW, north-star trend, depth, accuracy. It runs. It works.
> **It is a dashboard pointed at an empty room.** See [[#11 · Debt Register]].

---

## 4 · Deployment

### 4.1 Vercel — 6 targets

| Target | Root | Build | Output | Notes |
|---|---|---|---|---|
| **Circle HQ** | repo root | `cd apps/hq && npm install && npm run build` | `apps/hq/dist` | `installCommand: echo skip` · `framework: null` |
| **ArgantaLabs** | `apps/web` | `build:engine` → `tsc` → `vite build` | `dist` | rewrite `/play/:slug` → `/api/play?slug=:slug` |
| **KinetikCircle** | `apps/kinetik` | `tsc && vite build` | `dist` | SPA fallback |
| **Landing** | `apps/landing` | `npx vite build` | `dist` | framework `vite` |
| **Kingdom** | `apps/kingdom` | `cd web && npm run build && node scripts/build-deploy.mjs` | `dist_site` | `heroes.arganta.app` → `/lab/`; else → `/command/`. `/data/*` cached 7d immutable + CORS `*` |
| **LashiraBloom** | `apps/lashira/web` | `vite build` | `dist` | needs `@arganta/audio` vite alias (fixed 2026-07-10) |

### 4.2 Render — The Bridge

```yaml
service:  circle-hq-bridge     # type: web · runtime: node · plan: free
rootDir:  apps/mcp
build:    npm install
start:    npm run http         # tsx src/server.ts --http
health:   /healthz
env:      MCP_TRANSPORT=http   # PORT injected by Render
```

Live → `https://circle-hq-bridge.onrender.com/mcp` · **no auth** (read-only, deterministic seed).
Lockdown path: add `BRIDGE_TOKEN` → header `Authorization: Bearer <token>`.

### 4.3 Environment variables

| Var | Used by | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | all | project URL |
| `VITE_SUPABASE_ANON_KEY` | all | anon key |
| `VITE_ARGANTA_URL` | landing · kinetik | cross-app deep links |
| `VITE_LASHIRA_GAME_URL` | web · hq | launch LashiraBloom |
| `VITE_LASHIRA_ART_BASE` | lashira | art CDN base (egress fix) |
| `VITE_KINGDOM_DATA_BASE` · `VITE_DATA_BASE` | kingdom · lashira | sprite/data base |
| `MCP_TRANSPORT` · `PORT` · `BRIDGE_TOKEN` | mcp | Bridge |

### 4.4 Native — Capacitor

| App | Platforms | Command |
|---|---|---|
| ArgantaLabs | iOS + Android | `npm run android` / `npm run ios` |
| KinetikCircle | iOS + Android | `npm run cap:android` / `npm run cap:ios` |

---

## 5 · Local Dev

| App | Port | Launcher |
|---|---|---|
| ArgantaLabs | `5176` | `start-argantalab.bat` |
| Landing | `5174` | `start-landing.bat` |
| KinetikCircle | `5180` | `start-kinetik.bat` |
| Circle HQ | `5273` | `start-circle-hq.bat` |
| Kingdom | `5599` | `start-kingdom.bat` |
| LashiraBloom | `5173` | `PlayLashiraBloom.bat` |
| All | — | `start-all.bat` |

Multiplayer rigs → `Player1.bat` `Player2.bat` `KinetikPlayer1.bat` `KinetikPlayer2.bat` `BloomCommand.bat`

> [!warning] Workspace gap
> Root `workspaces` = `packages/*` · `apps/kingdom/web` · `apps/lashira/web` **only**.
> `apps/web` `apps/hq` `apps/kinetik` `apps/landing` `apps/mcp` are **outside** it — five separate `package-lock.json`. → [[#^d7]]

---

## 6 · Shared Packages — the moat

| Package | LOC | Consumed by | Owns |
|---|---|---|---|
| `@arganta/combat` | 1,429 | kingdom · lashira · hq | skills (bolt/storm/mend) · damage/heal · level scaling · VFX · `ActionCluster` |
| `@arganta/audio` | 931 | lashira · hq | SFX/music playback + library |
| `@arganta/heroes-engine` | 498 | kingdom · lashira | tile movement · walk cycles |
| `@arganta/character` | 209 | all | sprite / equip / slot model |

> [!tip] The right instinct, already proven
> *"Skill effects come from the hero's Kingdom character (single source)"* — commit 2026-07-07.
> Extend this pattern to everything. It is the reason the repo compounds.

---

## 7 · Asset Pipeline

- **Generator** — PixelLab MCP · `.mcp.json` → `https://api.pixellab.ai/mcp` · `PIXELLAB_TOKEN`
- **Catalogue** — [[Pixel Vault]] · `pixel_asset` + `pixel_palette` · license-tiered · agent-queryable (7 MCP tools)
- **Sources** — PixelLab + Kenney CC0 (~1,726 sprites) + opt-in Lospec palettes
- **Storage** — Supabase Storage (private) + local import + `pixel-sync` script

> [!bug] 3× asset duplication — root cause of the 939 MB `.git`
> ```
> apps/kingdom/data/client/monsters/            4,026 PNG
> apps/kingdom/dist_site/data/client/monsters/  4,026 PNG  ← build output, committed
> apps/lashira/web/art-mirror/monsters/         4,026 PNG  ← mirror
> ```
> Same for `effects/` (1,290) · `char/hairdec/` (1,032) · `char/body/` (898).
> **Fix** — one CDN base + `VITE_*_DATA_BASE`; delete `dist_site/data` + `art-mirror` from git; `.gitignore`; BFG the history.

---

## 8 · The Bridge (MCP) — 20 tools

`apps/mcp` · read-only · reuses `apps/hq/src/data/graph/*` with zero rebuild · every number carries a provenance badge — `live` / `partial` / `simulated` / `placeholder`. **Nothing fake renders as real.**

| Group | Tools |
|---|---|
| CEO | `ceo_ask` (main entry) · `ceo_brief` · `office_report` |
| Graph | `graph_query` · `node_get` · `verdict_queue` · `root_cause` |
| Models | `financial_model` · `scale_model` |
| Valuation | `valuation_estimate` · `valuation_history` · `valuation_levers` · `valuation_narrative` |
| Pixel Vault | `pixel_query` · `pixel_get` · `pixel_similar` · `pixel_facets` · `pixel_palettes` · `pixel_usage` · `pixel_vocab` |

---

## 9 · Build Timeline — 22 days

**[[2026-06-19]] → [[2026-07-11]]** · 402 commits · 298 Aldyth / 104 Claude · peak **84 commits in one day**

| Phase | Dates | Commits | Shipped |
|---|---|---|---|
| **P0 Genesis** | Jun 19–20 | 24 | Static HTML games → React → Supabase auth → Vercel. Guest-first auth. Diamond Shop. |
| **P1 Labs core** | Jun 21–22 | 11 | Buddy avatar · PlayHome · streaks · Journey · Quests · Parent page · outfits · player switcher · **circles v2** |
| **P2 The Big Day** | **Jun 23** | **84** | KinetikCircle clean rebuild + rebrand · Instagram-style Me · activity rings · calendar Board/Month · **Circle Game SDK spine** · Game Builder + App Builder · kid PIN login · 318 content items |
| **P3 Circles & economy** | Jun 24–26 | 52 | Circle admin RPCs · Family Pulse · diamond give/take · retention cohorts · **Moments** · daily rings · mounts · co-op engine · **Broadcast/Discover** · Kinetik mini-apps · PWA |
| **P4 Landing & KinQuest** | Jun 27–Jul 1 | 44 | `arganta.app` → company profile → cinematic deck · **Capacitor native** · **KinQuest** · rank + pitch |
| **P5 HQ Command** | Jul 1–3 | 61 | HQ P0–P4: Command tab · graph engine · 27 agents → 6 offices · office cockpits · Treasury to 2045 · R1–R3 reports · RCA · verdicts · **The Actuary** · **Pixel Vault** · Studio v2 |
| **P6 LashiraBloom** | Jul 5–8 | 100+ | Farm 1–8 (open economy → real-time crops → living animals → Kin loadout → Bloom currency) · Combat 1–16 (shared `@arganta/combat`, skills, scaling, VFX broadcast, XP to 99) · 82-asset art library · 60×48 castle-center map |
| **P7 Polish** | Jul 9–11 | 30 | Walk cycles · boss scale · sprite wiring · cosmetics sub-tabs · Character Page · Skill Forge · sword clipping |

> [!quote] Read the shape
> P0 → P6 is compounding platform work. **P7 is not.**
> The last ~40 commits are cosmetic polish on a game with zero external players.

---

## 10 · Status Board

| Product | ✅ Built | ⚠️ Partial | ❌ Missing |
|---|---|---|---|
| [[Arganta]] | Cinematic site · portfolio · pitch deck · org chart | — | Signup funnel. Waitlist. Any measured conversion. |
| [[KinetikCircle]] | Auth · circles · Today · Calendar · Moments · Me · 4 mini-apps · rings · Capacitor | Discover/Broadcast (content thin) | Store listing. An invite used by a non-family member. |
| [[ArgantaLabs]] | 13 content packs · learn engine · adaptive · streaks · quests · badges · Parent dash · Shop · Avatar · KinQuest · Arena · Game Builder + SDK · Capacitor | Admin Studio · Wizard · PitchBuilder | **Cambridge educator validation. Any user outside the household.** |
| [[LashiraBloom]] | Farm loop · combat (skills/gear/loot/boss) · economy · Forge · cosmetics · Character Page · 82-asset library · castle map · co-op + PvP | Retention (daily quests + streak) | Onboarding for a stranger. A reason to return that isn't "dad built it." |
| [[Circle HQ]] | Command graph · 6 offices · 27 agents · report engine · Daily Briefing · RCA · verdicts · Treasury + scale models · The Actuary · Growth · Pixel Vault · **Bridge live on Render** | Provenance mostly `simulated` / `placeholder` | **Real numbers to govern.** A cockpit for a plane on the tarmac. |

> [!failure] The one number
> ```sql
> select hq_growth_overview();
> -- { dau, wau, mau, stickiness, wowPct, northStar, learners, attempts7d }
> ```
> **External users: `0`**

---

## 11 · Debt Register

| ID | Item | Evidence | Sev | Fix |
|---|---|---|---|---|
| D1 | **Zero external users** | `hq_growth_overview()` = household only | 🔴 Existential | Distribution, not features. One app, one channel, ten strangers. |
| D2 | **Git bloat** | 939 MB `.git` · 3.0 GB tree | 🔴 High | Art → Storage/CDN · gitignore build output · BFG history |
| D3 | **3× asset duplication** | 4,026 monster PNGs × 3 | 🔴 High | One canonical `data/` + `VITE_*_DATA_BASE` |
| D4 | **No CI** | no `.github/` | 🟠 Med | Action: `tsc --noEmit` + `vitest` on PR. 30 min. |
| D5 | **6 tests / 96k LOC** | `find -name "*.test.*"` | 🟠 Med | Test the money paths: `wallet_*` · `log_learn_event` · auth |
| D6 | **67 commits titled `update`** | `git log` | 🟡 Low | Conventional commits = free milestone tracking |
| D7 | **5 lockfiles** | apps outside `workspaces` | 🟡 Low | Add all `apps/*` to root workspaces ^d7 |
| D8 | **HQ provenance simulated** | Bridge badges | 🟠 Med | Every `simulated` node is an honestly-labelled lie. Fixing D1 fixes this. |

---

## 12 · Milestone Tracker

> [!todo] The rule
> A milestone is **not done** until a person who is not in your family has done the thing.
> Code shipping is not a milestone. **Behaviour is.**

- [ ] **M0 · Repo hygiene** — `.git` < 100 MB · CI green on PR · one lockfile 🔺
- [ ] **M1 · Pick the wedge** — ONE product named as the tip of the spear, in writing, in this file ⏫
- [ ] **M2 · Stranger #1** — `hq_growth_overview().learners` ≥ 1 non-household ⏫
- [ ] **M3 · Ten strangers** — `wau` ≥ 10, none named Sukapradja
- [ ] **M4 · Retention signal** — D7 retention ≥ 20% on those 10
- [ ] **M5 · First revenue** — 1 paid diamond top-up from a stranger
- [ ] **M6 · HQ tells the truth** — `ceo_brief` provenance ≥ 50% `live`
- [ ] **M7 · Investor-ready** — 90-day north-star chart with a real slope

### Weekly log

| Week | Commits | Surfaces **added** | Surfaces **removed** | External users | Note |
|---|---|---|---|---|---|
| 2026-07-05 → 07-11 | ~130 | Skill Forge · Character Page · cosmetics sub-tabs · mounts/emotes | **0** | **0** | Polish week. Net user delta: 0. |
|  |  |  |  |  |  |

> [!caution] Watch the "removed" column
> It has never been non-zero. That single cell is the whole diagnosis.

---

## 13 · Decision Log

| Date | Decision | Rationale | Holds? |
|---|---|---|---|
| 2026-06-23 | KinetikCircle uses existing `circles`, not `kinetik_circles` | One identity model | ✅ |
| 2026-06-23 | Supabase = single source of truth; kill placeholder UI | No fake data | ✅ |
| 2026-07-01 | 27 agents → six offices | Reduce surface | ✅ |
| 2026-07-07 | `@arganta/combat` canonical; Kingdom consumes it | Single source | ✅ |
| 2026-07-08 | Gold → **Bloom** 🌸 | Brand coherence | ✅ |
| — | HQ read-only over ArgantaLabs tables | Cockpit ≠ engine | ✅ |
| — | Bridge = deterministic seed, provenance-badged | Nothing fake renders as real | ✅ |
| **TBD** | **Which product is the wedge?** | ← unanswered · this is **M1** | ❌ |

---

## 14 · Regenerate This Note

```bash
git clone https://github.com/aldythsukapradja/ArgantaLab.git && cd ArgantaLab

# LOC per app
for d in apps/* packages/*; do
  find $d \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) \
    | grep -v node_modules | xargs wc -l | tail -1 | sed "s|total|$d|"
done

# tables + RPCs
grep -rhoiE "create table (if not exists )?(public\.)?[a-z_0-9]+" supabase/*.sql \
  | sed -E 's/.*[. ]([a-z_0-9]+)$/\1/' | sort -u
grep -rhoiE "create or replace function (public\.)?[a-z_0-9]+" supabase/*.sql \
  | sed -E 's/.*[. ]([a-z_0-9]+)$/\1/' | sort -u

# milestone timeline
git log --reverse --format="%ad|%s" --date=short | grep -vE "\|update$|\|Merge "

# the only metric that matters
# → select hq_growth_overview();  (Supabase SQL editor)
```

---

## Related

[[Arganta]] · [[KinetikCircle]] · [[ArgantaLabs]] · [[LashiraBloom]] · [[Circle HQ]] · [[The Bridge MCP]] · [[Pixel Vault]] · [[8 Laws Diagnostic]] · [[Zero-User Problem]] · [[Model Ladder]]

#arganta #moc #repo-status #supabase #vercel #zero-user-problem

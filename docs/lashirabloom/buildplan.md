# LashiraBloom — Complete Build Plan

> A Stardew-Valley-inspired farming RPG for the ArgantaLab universe, built on the
> existing infrastructure (Supabase identity, ArgantaLab levels, Kingdom Heroes
> avatar + controls, Nexus Kins, diamonds economy) and designed from day one to
> grow from *farm* → *full RPG* (dungeons, combat, skills, quests) with **no
> rewrite**.

*Planning document. Nothing in here is built yet. Companion deck:
`docs/lashirabloom/presentation.html`.*

---

## 1. Vision & pillars

**LashiraBloom** = Harvest Moon loop + Pokémon companions + NexusTK persistent
shared world, wearing the ArgantaLab philosophy: **the game is the motivation,
learning is the gate.**

Three genre pillars:
- **Harvest Moon** → the loop: till → plant → water → harvest → sell → care →
  a home that evolves, seasons, festivals, a town of friends.
- **Pokémon** → companions: your befriended **Kins act as Harvest Sprites**
  (assignable helpers that auto-do chores). Livestock (cow/sheep/chicken) is a
  separate husbandry system.
- **NexusTK** → both the *persistent shared-world feel* (real circle members
  visible in the same valley via Supabase Realtime) and the *layered-sprite look*
  (the DSC-style Heroes compositor + the decoded NexusTK art pipeline).

**Design reference: Stardew Valley.** 16px tiles, high top-down 3/4 view, warm
readable palette, depth layering (ground → tilled soil → crops → props →
characters → overhead canopy), buildings bigger than characters. This matches the
existing Nexus/Kingdom art sensibility.

---

## 2. The ArgantaLab philosophy — two logins, one XP rule (LOCKED)

### Two audiences, two logins (mirrors Kingdom Heroes)
- **Adults** — Google OAuth. *"For grown-ups."*
- **Kids** — synthetic `username + 4-digit PIN` (`@kids.argantalab.app`).

Landing/login screen is the ArgantaLab card, re-titled **"Welcome to
LashiraBloom"** (see §11).

### The XP rule (confirmed 2026-07-04, and ALREADY BUILT in Kingdom SQL)
> **XP is earned by *playing* only for ADULTS. KIDS earn XP only by *learning*
> the 6 World problems.** Level drives character power for both.

This is not new work — it is exactly what
`apps/kingdom/supabase/002_kingdom_progression_presence.sql` already enforces:

- `public.argantalab_level_from_xp(xp)` → `level = 1 + floor(xp/500)` — the single
  ArgantaLab level truth.
- `public.kingdom_award_monster_xp(...)` — **grants adults capped XP; returns
  `grantedXp: 0` for kids** (lines 969–980: `if role='kid' or account_type='kid'
  → 0 XP`). Combat/play rewards adults, never kids.
- Kids' XP therefore comes only from the 6-World learning rings (the standard
  `game_grant` learning path), so **a kid levels up by learning.**
- `public.kingdom_computed_stats(...)` — `stat = base + per_level × (level−1)`,
  per class, from `kingdom_stat_policy`. This is Reldens' "Level Modifiers"
  concept, already implemented.

**Why this is perfect for LashiraBloom:** level → character power means:
- Adults get stronger by *playing* the farm/dungeon (they likely won't do rings).
- Kids get stronger by *learning* (the whole point).
- Same engine, same math, two XP sources. Zero philosophy conflict.

### The three reinforcing loops
1. **Your XP → your character power** (farmer speed/stamina, hero combat stats).
   Adults via play, kids via learning.
2. **Your circle's combined rings → the farm's unlocked content** (new seeds,
   house stages, maps). Shared.
3. **Your learning → your diamonds** (cosmetics only). Kids: learning-minted.

### Two-currency wall (schema-enforced)
| | 🌸 **Bloom** (soft) | 💎 **Diamonds** (platform) |
|---|---|---|
| Earned by | playing the farm (both audiences) | learning rings (kids); normal rules (adults) |
| Spent on | seeds, tools, upgrades — stays in-game | cosmetics only |
| Converts to 💎 | **never** (hard wall) | — |
| Scope | **shared per-circle-farm purse** | individual |

Combat (RPG-later) may grant an in-game-only **battle mastery**, never diamonds.

---

## 3. Architecture — build ON the existing infrastructure

### Repo layout (twin of `apps/kingdom`)
```
apps/lashira/                         NEW — mirrors apps/kingdom
├── command/                          Bloom Command — GM/admin dashboard  → /command/
├── web/                              LashiraBloom — React + PixiJS game   → /game/
├── supabase/
│   ├── 001_lashira_core.sql          farms, plots, livestock, kin_assignment, house/barn
│   ├── 002_lashira_spine.sql         reusable RPG spine (entities, levels_set, skills, quests)
│   └── 003_lashira_economy.sql       bloom ledger + RPCs, unlock gates, seasons
└── DEPLOY.md                         domains: bloom.arganta.app / bloomcommand.arganta.app
```

### Three run-modes for the game (copy Kingdom Heroes' `App.jsx` pattern)
1. **Standalone** — own Supabase client + own login gate (kid PIN / adult Google).
2. **ArgantaLab embed** — `<App embedded gameOnly hostSupabase hostUser>` injected
   by a new `apps/web/src/pages/Bloom.tsx`, auth from the host (attaches like
   Kingdom Heroes' Arena).
3. **Command iframe** — session bridged from Bloom Command via **postMessage**
   (Google OAuth 403s inside an iframe — the exact landmine Kingdom solved).

### App linkage map
```
                         ┌────────────────────────────┐
                         │  Supabase (bdagdxgpnlial…)  │
                         │  profiles · diamonds · xp   │
                         │  circles · person_creatures │
                         │  kingdom_characters/appearance
                         └──────────────┬─────────────┘
        ┌───────────────┬───────────────┼───────────────┬───────────────┐
   apps/web         apps/kingdom     apps/lashira      apps/hq        apps/kinetik
  (ArgantaLab)   (Heroes+Command)  (Bloom+Command)  (operator OS)   (circle app)
   identity,      avatar compositor  THIS PROJECT    dashboards      circle roster
   diamonds,      + controls +       reuses ←────────┘ (GM tools
   6-World rings  progression SQL    all of it          pattern)
        │              │                 │
        └── embeds ────┴── embeds ───────┘  (gameOnly / arenaOnly iframe + postMessage)
```

- **Single Supabase project** is the shared source of truth across all apps.
- LashiraBloom **reads** `profiles` (xp/level/diamonds), `circles` (farm owner),
  `person_creatures` (Kins), `kingdom_characters`/`kingdom_character_appearance`
  (the farmer avatar). It **writes** only farm-domain tables + capped RPCs.

---

## 4. Reuse map — concrete files (build on top, don't reinvent)

| Need | Reuse (exact path) | How |
|---|---|---|
| **Level/rank truth** | `apps/kingdom/supabase/002_…sql` → `argantalab_level_from_xp`, `argantalab_rank_tiers`, `argantalab_rank_for_xp` | Call as-is; the level→power engine |
| **XP rule (adult-play / kid-learn)** | same → `kingdom_award_monster_xp` (kids=0 XP), `game_grant` (capped) | Clone shape for farm/harvest XP awards |
| **Level modifiers (stats per level)** | same → `kingdom_stat_policy`, `kingdom_computed_stats` | Reldens-style modifiers, already built |
| **XP policy + audit** | same → `kingdom_xp_policy`, `kingdom_xp_ledger` | Per-source caps + ledger for farm/combat |
| **Enemy/companion templates** | same → `kingdom_monster_templates`, `kingdom_guardian_templates` | Base for dungeon enemies (RPG-later) |
| **Session authority** | same → `kingdom_start/heartbeat/end_character_session` | Single active session, force-logout |
| **Farmer/Hero avatar** | `apps/kingdom/web/src/engine/compositor.js` + `palettes.js` + `data.js`; `kingdom_character_appearance` (spec JSON) | Same composited character is the farmer AND the hero |
| **Controls (trackpad)** | `apps/kingdom/web/src/room/TestRoom.jsx` → **`nipplejs@^0.10.2`** dynamic joystick (bottom-left zone, force-scaled vector, WASD on desktop) | Shared module for farming + fighting |
| **Tile rendering** | `apps/web/src/components/openworld/KinWorldGame.tsx` (PixiJS v8, `TilingSprite`, `sortableChildren`, y-sort depth, camera clamp) | Farm/maps renderer base |
| **Kins (Harvest Sprites)** | `apps/web/src/lib/nexus.ts` (`befriend_kin`/`care_kin`/`nexus_harvest`, happiness 0–100, growth tiers); `apps/web/src/data/openworld/kin.ts` | Assignable helper mechanic, no new creature system |
| **Mounts** | `apps/web/src/lib/mounts.ts`; `apps/web/src/data/openworld/mounts.ts`; `public/assets/mounts/*.png` | Field travel + stable |
| **Auth (kid PIN / adult Google)** | `apps/kingdom/web/src/net/account.js` | Copy the dual-login + heartbeat |
| **Embed + propagate** | `apps/web/src/pages/Arena.tsx` + `apps/web/scripts/sync-arena.mjs` | Model `Bloom.tsx` + `sync-bloom.mjs` on these |
| **Diamonds economy** | `profiles.diamonds` + `game_grant` RPC | Cosmetics only; learning-minted for kids |

**Extract-to-shared (don't copy):** the **nipplejs control module** and the
**compositor** — you're actively polishing Kingdom, so factor these into a shared
location both apps import, so polish flows to both. Everything else can be a
reference-and-adapt.

---

## 5. The reusable RPG spine (the "get it right from the start" core)

Copy Reldens' core idea: **the engine reads data; content is rows, not code.**
Much of this already exists in Kingdom SQL — LashiraBloom generalizes it.

### Already-built (reuse verbatim)
- `argantalab_level_from_xp` · `argantalab_rank_tiers` — levels & ranks
- `kingdom_stat_policy` · `kingdom_computed_stats` — level modifiers
- `kingdom_xp_policy` · `kingdom_xp_ledger` — XP sources, caps, audit
- `kingdom_monster_templates` · `kingdom_guardian_templates` — enemy/companion defs

### New generic tables (Phase 0 — stub now, fill over phases)
```
-- generic content entity (items, crops, livestock, props, enemies, npcs)
entity              (id, kind, name, data_json, sprite_key, enabled)
entity_modifier     (id, entity_id, stat, op, value)          -- Reldens item/level modifiers

-- progression spine (generalizes Kingdom's per-class policy)
levels_set          (id, key, label, auto_fill_multiplier)     -- Reldens Levels Set
level               (id, levels_set_id, key, label, required_experience)
class_path          (id, key, label, levels_set_id)            -- Farmer now; Hero classes later
skill               (id, class_path_id, kind, unlock_level, data_json)  -- kind: attack|effect|tool
target_option       (id, skill_id, mode)                       -- self|enemy|area|tile
owner_condition     (id, skill_id, expr)                       -- validation gate

-- quests (LashiraBloom improves on Reldens, which has no first-class quest)
quest               (id, key, title, giver_npc_id, ring_gate, prereq_json,
                     objectives_json, rewards_json, repeatable, enabled)
quest_progress      (profile_id, quest_id, state, progress_json, updated_at)

-- farm domain (circle-owned)
farm                (id, circle_id, house_stage, barn_level, coop_level, bloom_balance)
farm_plot           (id, farm_id, map_id, x, y, crop_id, planted_at, watered_at, stage)
livestock           (id, farm_id, species, name, affection, fed_at, produce_ready_at)
kin_assignment      (person_creature_id, farm_id, task, assigned_at)  -- Kin = Harvest Sprite
crop_catalog        (id, name, season, grow_hours, sell_bloom, ring_gate)  -- data-file first
npc                 (id, map_id, name, role, vendor_json, friendship_gift_json, quest_ids)
npc_friendship      (profile_id, npc_id, level, last_gift_at)
season_state        (season, day_index, festival_active)
unlock_gate         (farm_id, gate_id, satisfied_by_ring)      -- circle-combined rings

-- economy (hard wall)
bloom_ledger        (farm_id, delta, reason, by_profile_id)    -- RPC-only; NEVER touches diamonds
```

### Two server rules (non-negotiable)
1. **`bloom_grant()` has no code path to diamonds.** The wall is in the schema.
2. **Crop growth is a Postgres function** (like `argantalab_level_from_xp`) so
   elapsed time can't be faked client-side (closes Kingdom's open authority gap).

### Rule of thumb
If a number could ever be balanced, it's a **config/data row**, not a constant.
That is what makes Bloom Command a real RPG-maker and lets you reuse this backend
for a *different* game later.

---

## 6. Controls & avatar (reuse, link, share)

### Controls — nipplejs (already a Kingdom dependency)
- `nipplejs@^0.10.2` is already used in `TestRoom.jsx`: dynamic joystick in a
  bottom-left zone, normalized vector scaled by force, Y-flipped into the world,
  dead-zone via `heldDirection()`, multitouch (steer + tap action), WASD on
  desktop. **One control surface serves farming (move + use tool) AND fighting
  (move + attack/skill).**
- **Action:** extract this into a shared `useNippleControls()` module both
  Kingdom and LashiraBloom import.

### Avatar — the Heroes Kingdom character
- The farmer **is** the player's Heroes character: `compositor.js` (DSC layered
  slots) + `kingdom_character_appearance` spec JSON. The same avatar later becomes
  the dungeon Hero — one identity across farm and combat.
- Add farm-only layers (sunhat, apron, tool-in-hand) as extra compositor slots;
  the compositor already supports 50+.

---

## 7. The maps — wireframes, NPC counts, pixel-art refs

Five areas, connected by a world map + fast-travel (travel unlocked by learning).
One data-driven `<Map>` component (a `MapDef` row + tileset) renders all of them —
new map = data + art, no new engine code.

```
   [FARM] ──► [TOWN: Bloomridge] ──► [CITY: Arganta City]
   per-circle      social hub            commerce/civic
      │                                        │
      └──────────► [MINING: Emberdeep] ──► [DUNGEON HUB: The Hollow Gate]
                    resource + gateway      all dungeon portals (RPG-later)
```

### 7.1 FARM (map 1, Phase 1) — per circle, private/co-op
NPCs: **0 permanent** + 1 traveling merchant (occasional) + a shipping bin.
```
┌───────────────────────────────────────────────────────────────┐
│ 🌸128(farm)  💎48🔒  ☀Spring D4   👨‍👩‍👧 Family Farm ▾    ⚙   │
├───────────────────────────────────────────────────────────────┤
│   🌳🌳        ╔═══════╗                                        │
│              ║🏡 Lv2  ║      ┌─────┐ ┌────┐                    │
│  ▓▓▓▓▓▓▓     ╚═══════╝      │ BARN │ │COOP│   🐄🐑  🐔        │
│  ▓🌱🌿·▓  🍃(Kin waters)    └─────┘ └────┘                    │
│  ▓🌾·▓▓▓                    🍃(Kin → barn)                     │
│  ▓▓▓▓▓▓▓         👩‍🌾(you, Heroes avatar)     📦 shipping bin  │
│  ◇ locked → "your circle's Numeria ring opens the East Field"  │
│  ┌🪣till 🌰plant 🪣water┐              ╭─────╮ nipplejs         │
│  └────────────────────┘               │  ◐  │                  │
└───────────────────────────────────────────────────────────────┘
  [🏡House] [🐄Barn] [🍃Kin] [🛒Shop] [🗺Travel]
```
Structures: farmhouse (evolves Shack→Cottage→Farmhouse→Homestead), barn
(livestock), coop (chickens), tillable plots, Kins roaming as helpers.
Pixel-art ref: **LPC Farming** (soil/fences/wheat) + **LPC Crops** (50 crops,
5-frame growth) + isaiah658 CC0 gap-fill. Stardew farm as visual north star.

### 7.2 TOWN — "Bloomridge" (map 2/Town, Phase 4) — social hub
NPCs: **~12** — Sprout (seed shop) · Hazel (general store) · Bram (carpenter,
building upgrades) · Forge (blacksmith, tool upgrades) · Willa (animal shop) ·
Pippin (café/inn) · Mayor Elder · Fest (festival organizer) · + 4 rotating
**Keeper cameos** (Mira/Sol/Kira/Lyra during festivals).
```
┌──────────────────────────────────────────────────────────────┐
│  BLOOMRIDGE  ·  ☀ Spring · Festival in 2 days                 │
│   [Seed]🌱   [General]🏪   [Carpenter]🔨   [Blacksmith]⚒       │
│      Sprout     Hazel         Bram           Forge            │
│   ══════════════ town square (festival stage) ══════════════   │
│   [Animal]🐮  [Café]☕   NPCs strolling  👥 real circle players │
│      Willa    Pippin      🚶 🚶 🚶        (Supabase presence)   │
│   → to City Center      → to Farm         🎪 Fest · Mayor      │
└──────────────────────────────────────────────────────────────┘
```
Pixel-art ref: **LPC** town/village tiles + buildings (or LimeZu *Serene Village*
if premium-licensed). Stardew Pelican Town for layout feel.

### 7.3 CITY CENTER — "Arganta City" (map 3, Phase 3) — commerce & civic
NPCs: **~8** — Bank/Storage clerk · Cosmetic vendor (💎) · Guild registrar ·
2 Market traders · Archive curator (museum/collection) · Stable master (mounts) ·
Quest-board keeper.
```
┌──────────────────────────────────────────────────────────────┐
│  ARGANTA CITY  ·  civic + commerce                            │
│  🏦 Bank/Storage   💎 Cosmetics   🏛 Archive   📜 Quest Board  │
│  ══════════ grand market plaza ══════════                     │
│  🧺 Trader  🧺 Trader     🐴 Stable master    ⚑ Guild hall     │
│  → to Town        → to Mining                                 │
└──────────────────────────────────────────────────────────────┘
```
Pixel-art ref: **LPC** city/market props (stalls, sacks, tables). Stardew’s
Pierre/JojaMart + the city vibe.

### 7.4 MINING — "Emberdeep Quarry" (map 4/Mining, Phase 3) — resource + gateway
NPCs: **~3** — Foreman/Geologist · Tool-sharpener · Ore trader. Contains the
entrance to the Dungeon Hub.
```
┌──────────────────────────────────────────────────────────────┐
│  EMBERDEEP QUARRY  ·  materials + the descent                 │
│   ⛏ ore nodes  ⛏  ⛏      🪨 rocks    💎 gem pockets           │
│   👷 Foreman   🔧 Sharpener   🧺 Ore trader                    │
│   ▓▓ cart tracks ▓▓        ╔══════════════╗                   │
│                            ║  ▼ THE HOLLOW ║ → Dungeon Hub     │
│   → to City Center         ║    GATE       ║                   │
│                            ╚══════════════╝                   │
└──────────────────────────────────────────────────────────────┘
```
Pixel-art ref: **LPC** cave/mining tilesets (rocks, ore, cart) + Anokolisa
cave CC0. Stardew’s Mines for the descent/tier feel.

### 7.5 DUNGEON HUB — "The Hollow Gate" (map 5, RPG-later) — all dungeons in one place
NPCs: **1** — the Gatekeeper (guide). **6 region-themed dungeon portals** reusing
KinQuest’s worlds; enemies inside reuse `kingdom_monster_templates`.
```
┌──────────────────────────────────────────────────────────────┐
│  THE HOLLOW GATE  ·  one hall, every descent                  │
│                     🧙 Gatekeeper                              │
│   ⟳Numeria   ⟳Wordveil   ⟳Life Meadow                        │
│   ⟳Wonder Sky ⟳World Lagoon ⟳Logic Circuit                    │
│   each portal → an instanced dungeon (level-gated by your XP)  │
│   combat = nipplejs move + attack/skill · Heroes avatar        │
│   → back to Mining                                            │
└──────────────────────────────────────────────────────────────┘
```
Combat/EXP/loot all run on the **already-built** Kingdom spine
(`kingdom_award_monster_xp`, `computed_stats`, `xp_ledger`, monster templates).
Kids: 0 combat XP (learn instead); adults: capped combat XP. Pixel-art ref:
**LPC** dungeon tilesets. Stardew’s deeper mine floors + Skull Cavern.

**World NPC total: ~24** (Farm 0–1, Town 12, City 8, Mining 3, Dungeon 1).

---

## 8. Bloom Command — the gold-standard RPG-maker dashboard

Six sections. Each row is a data-CRUD surface (Reldens-style), tagged
**[v1]** build-now or **[later]** schema-stubbed. See the deck for the visual.

1. **World & Maps** — Maps (`MapDef`) [v1 Farm/later others] · Objects/placements
   [v1] · Respawn/resource areas [v1 crops / later mobs]
2. **Entities & Content** — Items/crops/tools [v1] · Livestock [v1] · Kins [v1] ·
   NPCs [v1] · Enemies [later]
3. **Progression** — Levels Set + Level + Modifiers [build now] · Stats [v1
   subset] · Class Path [v1 Farmer stub] · Skills + Target Options + Owner
   Conditions [schema now, later UI]
4. **Economy & Rewards** — Currencies (Bloom/💎 wall) [v1] · Drop/loot tables
   [v1 harvest] · Shop/vendor inventories [v1] · Scores/leaderboards [later]
5. **Quests & Narrative** — Quests [design now, v1 tutorials/dailies] · Dialogue/
   snippets [v1] · Seasons & festivals / live-ops [v1 seasons]
6. **Players & Ops** — Players (kid/adult, moderation) [v1] · Circles/Teams [v1] ·
   Learning-gate mapping (ring→unlock) [v1] · PixelLab asset status [v1] · Config
   registry [v1] · Audit log / live-ops triggers [v1]

Visual direction: flat, ArgantaLab-native (the brand blue→purple→pink), metric
cards + progress bars, no gradients-as-noise. Static vanilla-JS admin-gated build
(twin of Kingdom Command Center) — or a light React dashboard if richer.

---

## 9. Pixel-art pipeline & references

**Placeholder-first, then PixelLab.** Prototype the loop on open assets, then
regenerate the real look with your PixelLab API (locked "high top-down + detailed
shading" recipe). Because ArgantaLab is commercial, license matters — keep
placeholders in an isolated `public/assets/_placeholder_lpc/` with `CREDITS.md`
and swap them out before shipping.

| Source | License | Use |
|---|---|---|
| **LPC — Liberated Pixel Cup** ([GitHub](https://github.com/OpenGameArt/LiberatedPixelCup), [Crops](https://opengameart.org/content/lpc-crops), [Farming](https://opengameart.org/content/lpc-farming-tilesets-magic-animations-and-ui-elements)) | CC-BY-SA / GPL (viral — placeholder only) | Farm soil/crops (5-frame growth), fences, town/city/cave/dungeon tiles, layered chars |
| **isaiah658 Pixel Pack #1** ([OGA](https://opengameart.org/content/isaiah658s-pixel-pack-1)) | **CC0** | Generic 16px gap-fill, no attribution/share-alike |
| **Kenney** ([kenney.nl](https://kenney.nl)) | **CC0** | UI + prototype filler (already in repo) |
| **Sprout Lands** ([Cup Nooble](https://cupnooble.itch.io/sprout-lands-asset-pack)) | free = non-commercial; **premium = commercial** | Closest cute-Stardew look — only if you buy premium |
| **LimeZu Modern Farm / Serene Village** ([itch](https://limezu.itch.io/modernfarm)) | check pack terms | High-quality farm/village if licensed |

**Real pipeline (PixelLab):** data-driven sprite factory — `crop_catalog`/entity
rows → auto-build PixelLab prompt (locked palette + style-ref) → PNG → atlas →
existing art seam (`KinSprite`/`installAtlas`) → Pixi renders. Split: AI for the
long tail (crops, tiles, generic props), AI+human for hero pieces. Known gotchas
(from prior sessions): call the REST endpoint directly (SDK parser is broken);
ground tiles need "fills entire canvas edge to edge, no border/frame".

**Style bible (Stardew-derived):** 16px tiles, integer scaling only, high top-down
3/4, warm earth + sap-green + one seasonal accent, buildings > characters,
transition tiles not hard seams, no loud repeating fills.

---

## 10. Build strategy — phases

**Phase 0 — Reusable spine & scaffold**
- `apps/lashira/{command,web,supabase}` scaffold (twin of Kingdom).
- Lay the spine: reuse Kingdom’s level/stat/xp SQL; add generic `entity`,
  `levels_set`/`level`, `class_path`/`skill`, `quest`, farm-domain tables.
- Extract shared `useNippleControls()` + compositor import.
- Kid-PIN / adult-Google login (copy `account.js`).
- Style-lock farmer avatar (1 PixelLab batch) or Kenney/LPC placeholder.

**Phase 1 — The Farm loop (single-player, placeholder art)**
- Farm map in Pixi (reuse KinWorldGame patterns) + nipplejs.
- Plots: till/plant/water/harvest, 2 crops, staged growth (server-side growth fn).
- House with 1 upgrade stage (reuse Town Hall maturation).
- Barn/coop + livestock (adopt/feed/affection/produce).
- Kins as Harvest Sprites (assign → auto-chore; wire `care_kin`/`nexus_harvest`).
- Bloom shared purse (RPC), sell → Bloom.
- Level → farmer power (adult XP by play, kid XP by learning — reuse award RPC).
- **GATE:** is one day on the farm genuinely fun? Iterate before expanding.

**Phase 2 — Learning integration + ArgantaLab attach**
- `unlock_gate` wired to real 6-World ring progress (circle-combined).
- Learning-gate prompts + locked-content walls.
- `apps/web/src/pages/Bloom.tsx` embed (gameOnly) + `sync-bloom.mjs`.
- Diamonds shown read-only in HUD (learning-minted).
- Quests: tutorial + daily board (basic).

**Phase 3 — Bloom Command + Mining & City**
- Static admin dashboard (twin of Command Center) — full sections live.
- postMessage auth bridge (Command ↔ game iframe).
- Maps 3 (City) + 4 (Mining) as `MapDef` rows + tilesets.
- PixelLab batch: real crop/building/livestock art.

**Phase 4 — Town, social, seasons**
- Map 2 (Town/Bloomridge) + ~12 NPCs + friendship (no romance) + gifting.
- Seasons + first festival (shared realtime event).
- Supabase presence: see real circle members on farm/town.
- DSC farmer-outfit cosmetics (💎, learn-only).

**Phase 5+ — RPG expansion (dungeons/combat)**
- Dungeon Hub (map 5) + 6 portals + enemies (reuse `kingdom_monster_templates`).
- Combat = nipplejs + skills (`skill`/`target_option`/`owner_condition` rows).
- Hero class paths (new `class_path` rows). All additive — no re-architecture.
- Kids: 0 combat XP (learn); adults: capped combat XP. Battle mastery in-game only.

---

## 11. Landing / login screen

Reuse the ArgantaLab auth card verbatim, re-titled:
```
        [ ◉ LashiraBloom mark ]
        Welcome to LashiraBloom
   Sign in — your farm follows you on every device.

   [ G  Continue with Google ]      ← For grown-ups
   ─────────  OR KIDS SIGN IN  ─────────
   [ username        ]
   [ 4-digit PIN     ]
   [   Log in →   ]   ← brand blue→pink gradient button
   🎉 New here? Create a kid player
```
Copy the exact card/gradient/typography from the ArgantaLab login (blue→purple→
pink wordmark, soft card, gradient CTA). Kid copy nudges toward learning.

---

## 12. Model guidance (Sonnet vs Fable, this project)

- **Sonnet/Opus** — the whole spine: schema, the polymorphic entity/skill/
  levels/quest modeling, RPCs + RLS, the Pixi renderer, control/compositor
  extraction, all implementation and debugging.
- **Fable** — content words only (Phase 2+): quest text, NPC dialogue &
  personalities, festival/crop flavor, the learning-gate nag copy (charm, not
  scold), NPC naming, pitch/marketing copy.
- **Trigger:** "write what X says / name this / give this personality" → Fable.
  "design the schema / wire the RPC / build the map" → Sonnet/Opus.

---

## 13. Open decisions (confirm before Phase 0 build)

1. **Bloom = shared per-circle-farm purse; diamonds individual.** (recommend yes)
2. **Farm content unlocks from circle-combined rings; XP/power from own source**
   (adults play, kids learn); **diamonds from own learning.** (recommend yes)
3. **Build the reusable RPG spine in Phase 0** (levels_set/skill/class_path/quest
   stubbed now) for a rewrite-free farm→RPG path. (recommend yes)
4. **Placeholder LPC/CC0 art → PixelLab regenerate**, isolated + swappable.
   (recommend yes)
5. **Extract nipplejs controls + compositor into shared modules** so Kingdom
   polish flows to LashiraBloom. (recommend yes)
6. Dungeon Hub name "The Hollow Gate", Town "Bloomridge", City "Arganta City",
   Mine "Emberdeep Quarry" — placeholders, easy to rename.

---

*End of build plan. Nothing built — planning only.*

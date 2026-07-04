# Character Lab Polish And DB-Backed Progression Plan

Date: 2026-07-04

Scope: DB-backed Character Lab and Buya Arena polish plan. Initial implementation has started from this document.

## Build Status

Implemented in this pass:

| Area | Status |
|---|---|
| DB migration draft | Added `apps/kingdom/supabase/002_kingdom_progression_presence.sql` |
| Account state contract | Added `kingdom_get_player_state()` client flow with legacy fallback |
| Draft vs synced build | Composer autosaves draft; Save promotes synced; Reset restores synced |
| Session enforcement client | Starts/heartbeats Kingdom sessions and shows forced logout notices |
| Friends online client | Reads `kingdom_get_online_friends()` into Character Lab and Arena |
| Login/claim page | Added full Character Lab login/claim gate |
| Character Lab account panel | Shows DB display name, XP, level, rank, stats, guardian, sync state |
| Scraped skill selection | Three saved skill slots include scraped spell metadata and visual effect IDs |
| Practice ground | Uses draft build and DB-backed hero/guardian stats |
| Buya Arena build source | Uses synced build on entry |
| Buya Arena HUD | Added top-left HP/MP/XP/rank frame and friends-online panel |
| Guardian spawn | Equipped guardian can spawn through the same realtime spawn channel |
| Adult/kid monster XP | Adult kills call `kingdom_award_monster_xp`; kids get no XP toast |
| Monster template seed | Added `apps/kingdom/scripts/seed-monster-templates.mjs` |
| SQL monster template seed | Added `apps/kingdom/supabase/003_seed_monster_templates.sql` |

Deployment/data steps still required:

```text
1. Run apps/kingdom/supabase/002_kingdom_progression_presence.sql in Supabase.
2. Run apps/kingdom/supabase/003_seed_monster_templates.sql in Supabase.
3. Redeploy Vercel with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
```

Alternative seed path:

```text
node apps/kingdom/scripts/seed-monster-templates.mjs with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
```

This plan replaces placeholder thinking with one clear rule:

```text
The client renders.
Supabase decides.
profiles.xp and profiles.level are the single current truth for ArgantaLab level.
Kingdom may award adults into that line only through a capped DB RPC.
Kids only gain XP from ArgantaLab learning events.
```

## Decisions Locked

| Topic | Decision |
|---|---|
| ArgantaLab XP total | `profiles.xp` |
| ArgantaLab level | `profiles.level` |
| Level formula | `level = floor(xp / 500) + 1` |
| Rank source | `profiles.xp` |
| Adult Kingdom XP | Allowed, capped, DB RPC only |
| Kid Kingdom XP | Not allowed |
| Monster XP notification for adults | Show XP granted |
| Monster XP notification for kids | No XP mention |
| Arena HP/MP | Fully reset on arena entry |
| Dungeon HP/MP | Later feature, not in this pass |
| Guardian level | Always equals owner `profiles.level` |
| Guardian display name | Editable and DB-backed |
| User display name | `profiles.display_name` |
| Arena nameplate | `kingdom_characters.name` |
| Friends online status | DB/realtime-backed presence |
| Double online character | Not allowed |
| New login behavior | New session replaces old session |
| Old session behavior | Auto-logout with "logged in somewhere else" notice |

## Current Repo Facts

### Available Today

| Data | Current source |
|---|---|
| Account display name | `profiles.display_name` |
| Account avatar | `profiles.photo_url` |
| Account diamonds | `profiles.diamonds` |
| Account XP | `profiles.xp` |
| Account level | `profiles.level` |
| Account role | `profiles.role` |
| Kingdom nickname | `kingdom_characters.name` |
| Kingdom path | `kingdom_characters.path_id` |
| Legacy Kingdom character level | `kingdom_characters.level`, do not use as gameplay truth |
| Character appearance/spec | `kingdom_character_appearance.appearance_json.spec` |
| Position | `kingdom_character_position` |
| Monster names and scraped XP | `apps/kingdom/data/core/monsters.json` |
| Skill scrape metadata | `apps/kingdom/data/core/skills.json` |
| Client effects | `apps/kingdom/data/client/effects` |

### Must Be Added

| Missing data | Why it matters |
|---|---|
| DB-backed HP/MP formulas | Arena HUD cannot use hardcoded `100/100` |
| DB-backed stat policy | Path, level, gear, and guardian scaling need one authority |
| Adult XP award RPC | Prevents client cheating and enforces caps |
| Kid XP rejection path | Kids must not gain XP from Kingdom |
| XP ledger | Audit trail for adult Kingdom awards |
| Rank tier DB seed | Rank icon should not be hardcoded in the Kingdom UI |
| Guardian template table | Base rarity/stats/assets need a stable source |
| Owned guardian table | Editable display name and ownership |
| Saved build vs draft build | Reset must return to previous synced build, not default |
| Kingdom friends-online RPC | Join existing `public.my_friends()` to active Kingdom sessions |
| Character session table | Prevents the same account/character being online twice |
| Session event table | Lets the old browser receive a forced logout notice |
| Presence heartbeat RPC | Keeps online/offline status trustworthy |

## Single Source Of Truth

### Display Truth

```text
profiles.xp
profiles.level
```

Every client reads these values.

### Write Truth

```text
DB RPCs only
```

No Kingdom component should directly update XP or level.

### Audit Truth

```text
kingdom_xp_ledger
```

The ledger explains how adult Kingdom XP was granted, but the client still reads current XP and level from `profiles`.

This avoids two competing totals.

## Level Formula

Use the formula that matches the current ArgantaLab UI screenshot:

```sql
floor(xp / 500) + 1
```

Examples:

| XP | Level |
|---:|---:|
| 0 | 1 |
| 499 | 1 |
| 500 | 2 |
| 3000 | 7 |
| 3340 | 7 |
| 5000 | 11 |

Implementation target:

```sql
create or replace function public.argantalab_level_from_xp(p_xp bigint)
returns int
language sql
immutable
as $$
  select greatest(1, floor(greatest(coalesce(p_xp, 0), 0) / 500.0)::int + 1)
$$;
```

Important correction:

```text
Do not use the old sqrt formula for Kingdom XP.
Do not use client-side `addXp()` as the Kingdom authority.
```

## Adult XP Cap Policy

Monster XP comes from scraped monster data, but it must be capped.

Recommended first policy:

```text
raw_xp = monster_templates.default_experience
level_cap = 25 + profiles.level * 25
event_cap = kingdom_xp_policy.per_event_cap
daily_remaining = kingdom_xp_policy.daily_cap - today_adult_kingdom_xp

granted_xp = min(raw_xp, level_cap, event_cap, daily_remaining)
```

Initial DB-backed policy seed:

| Source | Per event cap | Daily cap |
|---|---:|---:|
| monster_kill | 250 | 2000 |
| quest | 500 | 3000 |
| gm_adjustment | 10000 | no daily cap |

Why this shape:

- Low-level adults cannot farm giant monsters for huge jumps.
- Monster scrape XP still matters because it is the input.
- The cap lives in DB policy, not in React.
- The daily cap prevents runaway farming.

Kid result:

```text
granted_xp = 0
toast = "You defeated {monster_name}."
```

Adult result:

```text
granted_xp > 0
toast = "+{granted_xp} XP - {monster_name}"
```

## Database Plan

### 1. Rank Tiers

Move the current `apps/web/src/lib/rank.ts` tier data into DB so Kingdom can render the ArgantaLab rank badge without hardcoded UI tiers.

```sql
create table if not exists public.argantalab_rank_tiers (
  id text primary key,
  name text not null,
  xp_min bigint not null unique,
  color text not null,
  glyph text not null,
  icon_asset_key text,
  sort_order int not null
);
```

Seed:

| id | XP min | Name |
|---|---:|---|
| spark | 0 | Spark |
| explorer | 5000 | Explorer |
| adventurer | 15000 | Adventurer |
| maker | 40000 | Maker |
| sage | 85000 | Sage |
| luminary | 160000 | Luminary |

### 2. Character Stats

```sql
create table if not exists public.kingdom_character_stats (
  character_id uuid primary key references public.kingdom_characters(id) on delete cascade,
  base_hp int not null default 100,
  base_mp int not null default 40,
  base_attack int not null default 10,
  base_magic int not null default 10,
  base_defense int not null default 5,
  updated_at timestamptz not null default now()
);
```

Do not store arena `current_hp/current_mp` yet.

Arena entry computes:

```text
current_hp = max_hp
current_mp = max_mp
```

### 3. Stat Policy

```sql
create table if not exists public.kingdom_stat_policy (
  id text primary key,
  path_id text not null,
  hp_per_level int not null,
  mp_per_level int not null,
  attack_per_level numeric not null,
  magic_per_level numeric not null,
  defense_per_level numeric not null,
  metadata_json jsonb not null default '{}'::jsonb
);
```

Initial path policy:

| Path | HP style | MP style | Role |
|---|---|---|---|
| Warrior | highest | low | melee tank |
| Mage | low | highest | spell damage |
| Poet | medium | high | support/heal |
| Rogue | medium | medium | fast attack |

### 4. Adult Kingdom XP Ledger

```sql
create table if not exists public.kingdom_xp_ledger (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.kingdom_characters(id) on delete cascade,
  source text not null,
  source_id text,
  raw_xp int not null,
  granted_xp int not null,
  cap_reason text,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Rules:

- Adults can insert only through security-definer RPC.
- Kids never get rows with `granted_xp > 0`.
- Client cannot insert rows directly.

### 5. XP Policy

```sql
create table if not exists public.kingdom_xp_policy (
  source text primary key,
  per_event_cap int not null,
  daily_cap int,
  enabled boolean not null default true,
  metadata_json jsonb not null default '{}'::jsonb
);
```

### 6. Monster Templates

Create DB-backed monster templates from scraped data that the runtime can trust.

```sql
create table if not exists public.kingdom_monster_templates (
  id text primary key,
  name text not null,
  default_experience int not null default 0,
  client_mob_id int,
  client_palette_id int,
  base_hp int not null default 100,
  base_attack int not null default 10,
  rarity text not null default 'common',
  enabled boolean not null default true,
  source_json jsonb not null default '{}'::jsonb
);
```

### 7. Guardian Templates

Templates define the real guardian identity and stat base.

```sql
create table if not exists public.kingdom_guardian_templates (
  id text primary key,
  monster_template_id text references public.kingdom_monster_templates(id),
  base_name text not null,
  rarity text not null,
  base_hp int not null,
  base_mp int not null default 0,
  base_attack int not null,
  base_magic int not null default 0,
  client_mob_id int,
  client_palette_id int,
  metadata_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default true
);
```

### 8. Owned Guardians

```sql
create table if not exists public.kingdom_guardians (
  id uuid primary key default gen_random_uuid(),
  owner_character_id uuid not null references public.kingdom_characters(id) on delete cascade,
  template_id text not null references public.kingdom_guardian_templates(id),
  display_name text not null,
  equipped boolean not null default false,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Guardian level rule:

```text
guardian_level = owner profiles.level
```

Do not store a separate guardian level unless a later feature intentionally changes this rule.

### 9. Friend Relationships

Friends-online cannot be guessed from localStorage or current room peers. The repo already has the right social graph:

```text
public.friendships
public.my_friends()
public.my_friend_requests()
public.send_friend_request()
public.respond_friend_request()
public.remove_friend()
```

Do not create a second `kingdom_friendships` table unless Kingdom later needs a separate game-only friend graph.

Online friends source:

```text
public.my_friends()
+ kingdom active sessions
```

Important detail:

```text
public.my_friends() returns explicit friends and circle co-members.
Kingdom online status should filter that list through kingdom_character_sessions.
```

This gives Kingdom the social graph already used by ArgantaLab while keeping game presence per character.

### 10. Character Sessions

This is the single-online-character guard.

```sql
create table if not exists public.kingdom_character_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.kingdom_characters(id) on delete cascade,
  session_token uuid not null unique default gen_random_uuid(),
  status text not null default 'active',
  device_label text,
  map_id text,
  connected_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text,
  replaced_by_session_id uuid references public.kingdom_character_sessions(id),
  metadata_json jsonb not null default '{}'::jsonb,
  check (status in ('active', 'replaced', 'ended', 'expired'))
);

create unique index if not exists kingdom_one_active_character_session_uq
  on public.kingdom_character_sessions(character_id)
  where status = 'active';

create unique index if not exists kingdom_one_active_profile_session_uq
  on public.kingdom_character_sessions(profile_id)
  where status = 'active';
```

Rule:

```text
One active Kingdom session per profile.
One active session per kingdom character.
Starting a new session marks the old active session as replaced.
The replaced browser receives a session event and exits to login.
```

### 11. Session Events

The old browser needs a clear message, not a silent disconnect.

```sql
create table if not exists public.kingdom_session_events (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.kingdom_characters(id) on delete cascade,
  target_session_id uuid references public.kingdom_character_sessions(id) on delete cascade,
  event_type text not null,
  message text not null,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  check (event_type in ('force_logout', 'session_started', 'session_expired'))
);
```

Forced logout message:

```text
Your account was logged in somewhere else. This session has been closed.
```

### 12. Saved Build And Draft Build

Current composer autosaves `appearance_json.spec`.

For premium polish, separate draft from synced:

```sql
alter table public.kingdom_character_appearance
  add column if not exists synced_spec_json jsonb not null default '{}'::jsonb,
  add column if not exists draft_spec_json jsonb not null default '{}'::jsonb,
  add column if not exists synced_at timestamptz,
  add column if not exists draft_updated_at timestamptz;
```

Behavior:

| Button | Result |
|---|---|
| Save | Copy draft into synced |
| Reset | Replace draft with last synced |
| Change part | Update draft only |
| Enter arena | Use synced build by default |
| Preview practice ground | Use draft build |

## RPC Plan

### `kingdom_get_player_state()`

One call for the Character Lab and Arena bootstrap.

Returns:

```json
{
  "profile": {
    "displayName": "Aldyth",
    "photoUrl": "...",
    "xp": 3340,
    "level": 7,
    "diamonds": 45120,
    "role": "adult",
    "rank": {
      "id": "spark",
      "name": "Spark",
      "glyph": "*",
      "color": "#f0a83a",
      "iconAssetKey": "rank.spark"
    }
  },
  "character": {
    "id": "...",
    "name": "Aldyth",
    "pathId": "warrior"
  },
  "stats": {
    "maxHp": 260,
    "maxMp": 112,
    "attack": 31,
    "magic": 17,
    "defense": 18
  },
  "guardian": {
    "id": "...",
    "displayName": "Baginda",
    "templateId": "guardian.shadow_tiger",
    "level": 7,
    "rarity": "rare",
    "maxHp": 180,
    "maxMp": 0,
    "attack": 24
  },
  "loadout": {
    "syncedSpec": {},
    "draftSpec": {}
  },
  "presence": {
    "sessionId": "...",
    "sessionToken": "...",
    "onlineFriends": [
      {
        "profileId": "...",
        "displayName": "Keyla",
        "characterName": "Keyla",
        "rankName": "Spark",
        "mapId": "buya_arena",
        "lastSeenAt": "2026-07-04T12:00:00Z"
      }
    ]
  }
}
```

### `kingdom_start_character_session(p_character_id uuid, p_device_label text)`

This must run before Character Lab or Buya Arena starts live presence.

Server-side steps:

1. Resolve `auth.uid()`.
2. Confirm the character belongs to the current profile.
3. Lock existing active sessions for that profile and character.
4. Mark previous active sessions as `replaced`.
5. Insert the new active session.
6. Insert `force_logout` events for replaced sessions.
7. Return the new `session_token`.

Result:

```text
New login wins.
Old login receives a forced logout event.
There is never more than one active session per character.
```

### `kingdom_heartbeat_session(p_session_token uuid, p_map_id text)`

Runs every 15 seconds while Character Lab or Arena is open.

Server-side behavior:

```text
If session is active:
  update last_seen_at and map_id

If session is replaced/ended/expired:
  return forceLogout = true
```

### `kingdom_end_character_session(p_session_token uuid, p_reason text)`

Called on sign out, tab close when possible, or route exit.

Valid reasons:

```text
sign_out
tab_close
manual_exit
replaced
expired
```

### `kingdom_get_online_friends()`

Returns accepted friends with active sessions.

Output:

```json
[
  {
    "profileId": "...",
    "displayName": "Keyla",
    "characterId": "...",
    "characterName": "Keyla",
    "rankName": "Spark",
    "rankColor": "#f0a83a",
    "mapId": "buya_arena",
    "status": "online",
    "lastSeenAt": "2026-07-04T12:00:00Z"
  }
]
```

Online rule:

```text
status = online only if session.status = active and last_seen_at is fresh.
```

Recommended freshness:

```text
online if last_seen_at <= 45 seconds ago
away if last_seen_at <= 5 minutes ago
offline otherwise
```

### `kingdom_ack_session_event(p_event_id uuid)`

Marks session event as acknowledged after the client shows the message.

Required UX:

```text
Show modal:
"Your account was logged in somewhere else. This session has been closed."

Then return to login screen.
```

### `kingdom_save_character_draft(p_spec jsonb)`

Writes draft only.

### `kingdom_sync_character_build()`

Copies draft into synced.

### `kingdom_reset_character_draft()`

Copies synced into draft.

### `kingdom_rename_guardian(p_guardian uuid, p_name text)`

Validates ownership and name length.

### `kingdom_equip_guardian(p_guardian uuid)`

Ensures one equipped guardian per character.

### `kingdom_enter_arena()`

Returns the authoritative synced build and full HP/MP.

```text
current_hp = max_hp
current_mp = max_mp
```

### `kingdom_award_monster_xp(p_monster_template_id text, p_context jsonb)`

Server-side steps:

1. Resolve `auth.uid()`.
2. Load `profiles.role`.
3. Load `kingdom_characters`.
4. Load monster template XP.
5. If role is `kid`, return zero reward and do not update XP.
6. If role is adult, apply caps.
7. Insert `kingdom_xp_ledger`.
8. Update `profiles.xp`.
9. Recompute `profiles.level` using `argantalab_level_from_xp`.
10. Return new XP, level, rank, and toast text.

## Page Layout Wireframes

### 1. Login Page

```text
+--------------------------------------------------------------------------------+
| Kingdom                                                                        |
| Character Lab                                                                  |
|                                                                                |
|        +--------------------------------------------------------------+        |
|        |                         ARGANTALAB                           |        |
|        |                Build your hero. Test your guardian.          |        |
|        |                                                              |        |
|        |  +--------------------------+  +--------------------------+  |        |
|        |  | Adult                    |  | Kids                     |  |        |
|        |  | Continue with Google     |  | Username                 |  |        |
|        |  |                          |  | PIN                      |  |        |
|        |  |                          |  | Play                     |  |        |
|        |  +--------------------------+  +--------------------------+  |        |
|        |                                                              |        |
|        |  Small note: Kids earn XP by learning in ArgantaLab.          |        |
|        +--------------------------------------------------------------+        |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### 1b. Forced Logout Modal

```text
+--------------------------------------------------------------+
| Session moved                                                |
|--------------------------------------------------------------|
| Your account was logged in somewhere else.                   |
| This session has been closed to keep your character safe.    |
|                                                              |
|                         [Back to login]                      |
+--------------------------------------------------------------+
```

### 2. Character Lab Shell

```text
+--------------------------------------------------------------------------------+
| Kingdom / Character Lab                                      Sync: Draft saved |
|--------------------------------------------------------------------------------|
| Left rail                  | Center preview                 | Right inspector   |
|---------------------------|--------------------------------|-------------------|
| Account                   |                                | Saved Build       |
| - profiles.display_name   |        Live character          | - Save            |
| - Arganta rank badge      |        Practice ground         | - Reset to synced |
| - XP / level / diamonds   |        Guardian beside user    |                   |
| - Session: Online         |                                | Friends Online    |
|                           |                                | - Keyla in Arena  |
|                           |                                | - Baginda in Lab  |
|                           |                                | - 3 away          |
|                           |                                | Path              |
| Build tabs                |                                | - Warrior         |
| - Body                    |                                | - Mage            |
| - Armor                   |                                | - Poet            |
| - Weapon                  |                                | - Rogue           |
| - Mount                   |                                |                   |
| - Skills                  |                                | Sync details      |
| - Guardian                |                                | Last synced time  |
+--------------------------------------------------------------------------------+
```

### 3. Character Viewer Card

```text
+----------------------------------------------+
| Aldyth                            Spark badge |
| Level 7    3,340 XP    45,120 diamonds        |
|----------------------------------------------|
|                                              |
|              Character sprite                 |
|              Guardian sprite                  |
|                                              |
| HP  [====================] 260 / 260          |
| MP  [============--------] 112 / 112          |
|                                              |
| Warrior path     Synced build active          |
+----------------------------------------------+
```

### 4. Practice Ground

```text
+--------------------------------------------------------------------------------+
| Practice Ground                                           Uses draft build      |
|--------------------------------------------------------------------------------|
|                                                                                |
|                       [ character + guardian live preview ]                     |
|                                                                                |
| HP/MP top-left mirror                                                           |
| Skill buttons bottom-right                                                      |
| Trackpad bottom-left on mobile                                                  |
|                                                                                |
| Test attack | Test skill 1 | Test skill 2 | Test skill 3 | Test guardian attack |
+--------------------------------------------------------------------------------+
```

### 5. Part Picker Popup

```text
+--------------------------------------------------------------------------------+
| Select Weapon                                             Search: [ spear    ] |
|--------------------------------------------------------------------------------|
| Groups              | Grid                                               Live  |
|--------------------|----------------------------------------------------------|
| Sword              | [thumb] [thumb] [thumb] [thumb] [thumb]                 |
| Spear              | [thumb] [selected] [thumb] [thumb]                     |
| Bow                |                                                          |
| Fan                | Selected: Tiger Spear                                    |
|                    | Source: client asset + DB saved spec                    |
|                    | [Apply to draft] [Cancel]                               |
+--------------------------------------------------------------------------------+
```

### 6. Skill And Path Popup

```text
+--------------------------------------------------------------------------------+
| Skills                                                  Path: Warrior           |
|--------------------------------------------------------------------------------|
| Path tabs: Warrior | Mage | Poet | Rogue                                        |
|--------------------------------------------------------------------------------|
| Slot 1              | Scraped skill list                 | Live preview        |
| Slot 2              | - Slash                            | Selected skill FX   |
| Slot 3              | - Whirlwind                        | Cost / cooldown     |
|                     | - Berserk                          | DB requirement      |
|                     |                                    |                     |
|                     | [Save draft skills]                                      |
+--------------------------------------------------------------------------------+
```

### 7. Guardian Popup

```text
+--------------------------------------------------------------------------------+
| Guardian                                                                          |
|----------------------------------------------------------------------------------|
| Equipped Guardian                                                                 |
| Name: [ Baginda                         ] [Rename]                                |
| Rarity: Rare       Level: 7       Attack: 24       HP: 180                        |
|----------------------------------------------------------------------------------|
| Owned guardians                                                                   |
| [Shadow Tiger] [Panda Bear] [Rabbit Spirit] [Dragon Cub]                          |
|----------------------------------------------------------------------------------|
| Live review                                                                       |
| [guardian sprite]   Basic attack preview   Health bar preview                     |
+--------------------------------------------------------------------------------+
```

### 8. Buya Arena Desktop

```text
+--------------------------------------------------------------------------------+
| Top-left HUD                                                                     |
| +----------------------------------+                                             |
| | portrait | Aldyth        Level 7 |                                             |
| | Spark badge        EXP bar       |                                             |
| | HP red bar         MP blue bar   |                                             |
| +----------------------------------+                                             |
| Top-right presence                                                              |
| +------------------------------+                                                |
| | Friends online: 2            |                                                |
| | Keyla - Buya Arena           |                                                |
| | Mira - Character Lab         |                                                |
| +------------------------------+                                                |
|                                                                                |
|                                    Canvas                                       |
|                                                                                |
|                         player nameplate: kingdom_characters.name               |
|                         guardian nameplate: kingdom_guardians.display_name      |
|                                                                                |
| Bottom-right premium combat cluster                                             |
|                    [skill 3]                                                    |
|             [skill 2] [attack] [skill 1]                                        |
|                    [mount/take]                                                 |
+--------------------------------------------------------------------------------+
```

### 9. Buya Arena Mobile

```text
+--------------------------------------------------------------------------------+
| [compact HP/MP/XP HUD]                                [Friends: 2] [Online dot] |
|                                                                                |
|                                    Canvas                                       |
|                                                                                |
|                                                                                |
| Bottom-left                                  Bottom-right                       |
| +--------------------+                       +------------------------------+  |
| | premium joystick   |                       |        skill 3               |  |
| | thumb + ring       |                       | skill 2  ATTACK  skill 1     |  |
| | fixed/floating     |                       |        utility               |  |
| +--------------------+                       +------------------------------+  |
+--------------------------------------------------------------------------------+
```

### 10. Future Profile / Shop Page

```text
+--------------------------------------------------------------------------------+
| Profile                                                                          |
|----------------------------------------------------------------------------------|
| Account identity               | Character identity                              |
| profiles.display_name          | kingdom_characters.name                         |
| Arganta rank                   | Path / synced build                             |
| XP / level / diamonds          | Guardian equipped                               |
|----------------------------------------------------------------------------------|
| Shop preview                                                                    |
| Cosmetics only                                                                  |
| Diamonds read from wallet/profile truth                                          |
| No power advantage purchases for kids                                            |
+--------------------------------------------------------------------------------+
```

## Visual Design Strategy

### Visual Direction

```text
Premium hand-held RPG console
Pixel art game world
Glass-and-metal HUD
Warm parchment panels for management screens
No default purple-on-white SaaS look
```

### Component Style

| Component | Direction |
|---|---|
| Login | ArgantaLab playful, safe, bright, kid-friendly |
| Character Lab | Polished studio/workbench, clear sync state |
| Practice Ground | Mini arena, live but non-threatening |
| Top-left HUD | Compact RPG unit frame with rank badge |
| Bottom-right controls | Premium radial cluster, glossy but readable |
| Bottom-left joystick | Large, tactile, thumb-friendly |
| Popups | Grouped, searchable, with live preview on the right |

### Sync Status Language

Use clear states:

```text
Synced
Draft changed
Saving draft
Save failed
Using synced build in arena
Using draft build in practice
```

Avoid vague cloud icons as the only signal.

## GitHub Design And Component References

These are references, not mandatory dependencies.

| Reference | Use it for | Notes |
|---|---|---|
| [RonenNess/RPGUI](https://github.com/RonenNess/RPGUI) | RPG-style panels, buttons, sliders, progress bars | Useful pattern for game UI in HTML/CSS. Do not copy the old-school look directly; adapt the concept. |
| [elmarti/react-joystick-component](https://github.com/elmarti/react-joystick-component) | Mobile bottom-left joystick | React component, MIT, small enough to test quickly. |
| [yoannmoinet/nipplejs](https://github.com/yoannmoinet/nipplejs) | Touch joystick event model | Good if we want a custom-skinned joystick with proven math. |
| [ShawnHymel/phaser-plugin-virtual-gamepad](https://github.com/ShawnHymel/phaser-plugin-virtual-gamepad) | Joystick plus action-button overlay pattern | Phaser-specific, but the layout pattern maps well to our canvas HUD. |
| [parnic/ice-hud](https://github.com/parnic/ice-hud) | HUD information hierarchy | Strong lesson: keep health/mana readable without pulling focus away from the character. |
| [ChristopherHButler/awesome-react-gamepads](https://github.com/ChristopherHButler/awesome-react-gamepads) | Later physical controller support | Not required now, but useful once desktop gamepad support matters. |

Recommended choice:

```text
Use custom React/CSS for HUD visuals.
Use react-joystick-component or nipplejs only for joystick input behavior.
Do not import a full UI kit that fights the game's visual identity.
```

## Battle-Test Findings Before Build

### Finding 1: The Repo Already Has Friends

The main Supabase schema already has:

```text
public.friendships
public.my_friends()
public.my_friend_requests()
public.send_friend_request()
public.respond_friend_request()
public.remove_friend()
```

Plan adjustment:

```text
Do not add kingdom_friendships in the first build.
Use public.my_friends() as the relationship source.
Join that list to kingdom_character_sessions for online status.
```

### Finding 2: Existing Profile Presence Is Not Enough

The main app already heartbeats:

```text
profiles.last_seen via public.touch_presence()
```

That is useful for general ArgantaLab presence, but it cannot enforce one active Kingdom character.

Plan adjustment:

```text
Keep profiles.last_seen for broad profile presence.
Add kingdom_character_sessions for game session authority.
Use kingdom_character_sessions, not Realtime presence, to enforce single online character.
```

### Finding 3: Realtime Presence Cannot Enforce Single Login

Supabase Realtime presence can show multiple metas under the same presence key. It is not a lock.

Plan adjustment:

```text
Use a DB partial unique index on active sessions.
Use start-session RPC to replace old sessions transactionally.
Use heartbeat as fallback if the old browser misses the realtime event.
```

### Finding 4: Level Formula Currently Has One Conflict

The ArgantaLab client store already behaves like:

```text
level = floor(xp / 500) + 1
```

But the existing `public.game_grant()` function still uses:

```text
floor(1 + sqrt(xp / 100))
```

Plan adjustment:

```text
Kingdom must never call game_grant() for XP.
The migration should add argantalab_level_from_xp().
For true single-source behavior, public.game_grant() should be updated to call argantalab_level_from_xp().
```

### Finding 5: `kingdom_characters.level` Should Not Be Gameplay Truth

The current MP-0 table has:

```text
kingdom_characters.level
```

But the user decision is:

```text
Kingdom level ties to ArgantaLab level.
```

Plan adjustment:

```text
Read level from profiles.level.
Leave kingdom_characters.level as a legacy/cache column for now.
Do not show or compute gameplay from kingdom_characters.level.
```

### Finding 6: Existing Direct Loadout Upsert Must Become RPC-Based

Current Kingdom saves appearance by direct table upsert.

Plan adjustment:

```text
Replace direct saveLoadout() writes with:
- kingdom_save_character_draft()
- kingdom_sync_character_build()
- kingdom_reset_character_draft()
```

This is required for clean Save/Reset semantics.

### Finding 7: Existing Arena Presence Needs Session Token Guard

Current Arena joins Supabase Realtime directly with `characterId` as presence key.

Plan adjustment:

```text
Start or validate a kingdom session before joining arena.
Include session_token in client-side arena state.
If heartbeat says replaced, leave arena immediately and show the forced logout modal.
```

## Clarifications Before Build

These are the only product decisions that can materially change the implementation.

| Question | Recommended answer |
|---|---|
| Should `public.game_grant()` be updated to use the new level formula too? | Yes. This keeps all future XP writes on one formula. |
| Should existing `profiles.level` rows be backfilled from `profiles.xp`? | Yes, but as an explicit migration step with a comment. |
| Should Kingdom online friends include circle co-members from `public.my_friends()`? | Yes for now, because the existing RPC already treats them as social connections. |
| Should single-session enforcement be per profile, per character, or both? | Both. MP-0 has one character per profile, and the UX says "account logged in somewhere else." |
| What default guardian should existing accounts receive? | Seed one editable starter guardian per character so the UI is never empty. |

## Build Phases

### Phase 0: Safety And Data Audit

Goal: confirm every UI field has a real source before design work.

Tasks:

- Map current `account.profile` fields to the new player state contract.
- Confirm current Supabase migration state.
- Confirm current Vercel env still points to the intended Supabase project.
- Snapshot existing `kingdom_character_appearance.appearance_json.spec`.
- Confirm whether existing users already need friend relationships seeded.

Pass condition:

```text
No field in the plan says "placeholder".
Every HUD field maps to DB, asset data, or a new migration.
```

### Phase 1: DB Migration Draft

Goal: create the new schema and RPCs, but do not wire UI yet.

Tasks:

- Add `argantalab_level_from_xp`.
- Update `public.game_grant()` to use `argantalab_level_from_xp()` if approved.
- Backfill `profiles.level = argantalab_level_from_xp(profiles.xp)` if approved.
- Add rank tier table and seed.
- Add stat policy table and seed.
- Add XP policy table and seed.
- Add monster template table and import seed plan.
- Add guardian template and owned guardian tables.
- Add XP ledger.
- Reuse existing `public.friendships` and `public.my_friends()` for the social graph.
- Add Kingdom friends-online RPC that joins friends to active character sessions.
- Add character session table.
- Add session event table.
- Add draft/synced columns for character appearance.
- Add RLS policies.
- Add RPCs listed above.

Pass condition:

```text
SQL runs cleanly on a fresh Supabase project and on the existing project.
Kids cannot get monster XP from RPC.
Adults can get capped XP from RPC.
Only one active session can exist for a character.
Only one active Kingdom session can exist for a profile.
```

### Phase 2: Account State Refactor

Goal: replace scattered client reads with `kingdom_get_player_state()`.

Tasks:

- Replace `fetchKinetikProfile()` plus `fetchMyCharacter()` with one bootstrap call.
- Keep old functions temporarily behind a fallback only during migration.
- Remove any UI dependency on hardcoded HP/MP.
- Stop using `kingdom_characters.level` for display or gameplay.
- Add typed normalization in the Kingdom account layer.
- Include session token and online friends in the normalized state.

Pass condition:

```text
Reloading account shows the same display name, rank, level, diamonds, character, guardian, HP, and MP from one DB response.
```

### Phase 2.5: Session And Presence Enforcement

Goal: make online status real and prevent double-online characters before heavy UI polish.

Tasks:

- Call `kingdom_start_character_session()` after auth and character selection.
- Store the returned `session_token` only in memory.
- Subscribe to session events for the current session.
- Run heartbeat every 15 seconds.
- If heartbeat or realtime says the session was replaced, show the forced logout modal.
- Call `kingdom_get_online_friends()` for Character Lab and Arena.
- Ensure arena join requires an active session token.

Pass condition:

```text
Opening the same account in a second browser logs out the first browser.
The first browser shows "Your account was logged in somewhere else."
Friends online list updates from active sessions, not local peer guesses.
```

### Phase 3: Login Page Polish

Goal: move from small account bar to a proper login/claim experience.

Tasks:

- Full login page before Character Lab.
- Adult Google card.
- Kids username/PIN card.
- Kid message: "XP comes from learning in ArgantaLab."
- Character claim step if no character exists.
- No offline placeholder mode in production UI.
- Start the character session only after successful login/claim.

Pass condition:

```text
Adult and kid login are visually clear and account type is unmistakable.
Duplicate login replacement message is clear and not scary.
```

### Phase 4: Character Lab Layout Polish

Goal: make Character Lab feel like a real premium profile/shop foundation.

Tasks:

- Build shell layout from the wireframe.
- Add top account summary from DB state.
- Add sync state panel.
- Add friends-online panel from `kingdom_get_online_friends()`.
- Add Save and Reset buttons.
- Practice ground uses draft.
- Arena uses synced.
- Existing part browsers become grouped premium popups.
- Skill picker groups by path: Mage, Poet, Warrior, Rogue.
- Scraped skills and client effects both selectable.

Pass condition:

```text
Changing armor/weapon/mount/skill updates draft only.
Reset restores last synced build.
Save persists the new synced build.
Switching accounts changes all parts, skills, guardian, stats, and rank correctly.
```

### Phase 5: Guardian Composer

Goal: guardian becomes first-class, not "spawn monster but renamed".

Tasks:

- Add Guardian tab.
- Show equipped guardian.
- Rename guardian.
- Select from owned guardians.
- Show rarity, DB-backed stats, and live preview.
- Add guardian attack preview in practice ground.
- Save equipped guardian through RPC.

Pass condition:

```text
Guardian name, rarity, attack, HP, and sprite follow the account and persist after reload.
```

### Phase 6: Buya Arena HUD Polish

Goal: premium game HUD with clear DB-backed values.

Tasks:

- Top-left player HUD with display name, character name, level, rank badge, XP bar, HP, MP.
- Replace face emoji with ArgantaLab rank icon/glyph.
- Add guardian health bar/nameplate.
- Adult monster kill calls `kingdom_award_monster_xp`.
- Kid monster kill shows no XP notification.
- Bottom-right custom radial skill cluster.
- Bottom-left premium joystick on mobile.
- Clear connected/sync indicator.
- Add compact friends-online indicator.
- Block arena join if the session is no longer active.

Pass condition:

```text
Adult kills monster: capped XP updates after RPC and HUD refreshes.
Kid kills monster: no XP reward, no XP toast, HUD XP unchanged.
HP/MP reset to full every arena entry.
```

### Phase 7: Battle Test

Goal: break it before kids do.

Test matrix:

| Test | Expected |
|---|---|
| Adult login | Shows profile display name, level, rank, diamonds |
| Kid login | Shows profile display name, level, rank, diamonds |
| Same account opened in second browser | Second session starts, first session is replaced |
| Replaced first browser | Shows "logged in somewhere else" modal and returns to login |
| Stale session heartbeat | Returns force logout instead of staying online |
| Friends online list | Shows accepted friends with fresh active sessions |
| Friend goes idle | Status changes from online to away/offline after freshness window |
| Adult monster kill | XP capped, ledger row inserted, profile level recalculated |
| Kid monster kill | No XP ledger grant, no profile XP change |
| Huge monster XP | Grant limited by cap |
| Daily adult cap reached | Further kills grant zero XP |
| Switch account | Character, skills, guardian, HP/MP, rank all change |
| Reset draft | Returns to previous synced build |
| Save draft | New synced build persists after reload |
| Arena enter | HP/MP full from computed max |
| Refresh arena | HP/MP full again |
| Guardian rename | Persists and shows in arena |
| Remote player | Nameplate uses `kingdom_characters.name` |
| Guardian health bar | Uses `kingdom_guardians.display_name` |
| Vercel build | No missing asset/data path |

## Risk Notes

| Risk | Mitigation |
|---|---|
| Existing `game_grant` uses a different formula | Kingdom must not use it for XP; add Kingdom-specific RPC and later align `game_grant` if desired |
| Current app has client-side XP helpers | Kingdom should treat them as read-only display helpers only |
| Rank tiers are currently TS constants | Seed them into DB and return rank from RPC |
| Monster XP data may be huge/uneven | Use per-event and daily DB caps |
| Guardian can become another monster placeholder | Add owned guardian table before HUD polish |
| Autosave makes reset confusing | Split draft and synced specs |
| Double browser sessions create ghost players | DB partial unique index plus session-start RPC replaces old sessions |
| Old browser misses realtime event | Heartbeat also detects replaced sessions and forces logout |
| Friends online list leaks kid/adult privacy | RLS only exposes accepted friendships and allowed profile fields |
| Multiplayer remains client-authoritative | Fine for polish testbed; server authority is later |

## Not In This Pass

- Dungeon regeneration rules.
- Persistent dungeon HP/MP.
- Server-authoritative combat simulation.
- Real item inventory.
- Diamond shop purchasing.
- Guardian magic skills.
- Guardian leveling separate from player level.
- Anti-cheat beyond DB XP caps and role checks.

## Final Build Order

```text
1. DB schema and RPCs
2. Account state contract
3. Session and presence enforcement
4. Login page
5. Character Lab shell
6. Save/reset draft model
7. Skill/path picker
8. Guardian composer
9. Practice ground HUD
10. Buya Arena HUD
11. Adult/kid XP and session battle tests
```

This order avoids polishing UI around fake data.

# LashiraBloom Architecture Spine + Circle HQ World Builder Design

Status: concept/design spec only, no build. Created 2026-07-10.

Companions:

- [`openworld-stronghold-command-architecture.md`](./openworld-stronghold-command-architecture.md)
- [`resource-economy-command-center-plan.md`](./resource-economy-command-center-plan.md)
- [`portal-hotspot-plan.md`](./portal-hotspot-plan.md)
- [`parallel-game-realm-matrix.md`](./parallel-game-realm-matrix.md)
- [`roadmap-and-build-plan.md`](./roadmap-and-build-plan.md)
- [`shared-game-shell-component-strategy.md`](./shared-game-shell-component-strategy.md)

## 1. Mental spine

LashiraBloom is a Kingdom-centered platform:

```text
Circle HQ
  controls and observes

Lashira Kingdom Hub
  is the player home / stronghold

Portal Registry
  maps physical hotspots to game realms

Realm Runtime
  launches one game mode at a time

Shared Game Shell
  renders the same four corners in every realm

Reward + Resource Ledgers
  record everything earned/spent

Skin Catalog
  sells identity only, never power

Character Spine
  one XP bracket, one HP curve, one MP curve
```

The product should feel simple to the player:

> Walk to a place in the Kingdom, enter a game, return with rewards for the Kingdom.

The system should feel simple to the operator:

> Create a realm, place its portal, define rewards, publish, watch health, scale or archive.

## 2. Architecture spine

| Layer | Owns | Examples | Must be editable? |
|---|---|---|---|
| Identity | Player, circle, account type, adult/kid rules | profile, circle_id, role, kid flag | Support/admin only |
| Character Spine | XP bracket, HP/MP curve, class/path, skins equipped | level, hp, mp, path | Curves in HQ, player equipment in game |
| Kingdom Hub | Current map, castle, districts, portals, return spawns | Castle, South Gate, Dungeon Gate | Yes, through World Builder |
| Portal Registry | Hotspots that launch realms | `tower_defense`, `dungeon_gate` | Yes |
| Realm Registry | Game modes available around the Kingdom | City, Tower Defense, Dungeon, Event | Yes |
| Realm Runtime | The actual playable game loop | waves, PvP, puzzle board, dungeon room | Per realm implementation |
| Shared Game Shell | Four fixed HUD corners shared by all games | character/resources, settings, location, controller | Yes, design once for all realms |
| Reward Contracts | What each realm can mint or consume | Bloom, Wood, Stone, kid XP blocked | Yes |
| Resource Ledgers | Append-only earn/spend history | resource events, XP events | Audit/view only |
| Stronghold/City | Kingdom growth state | population, safety, culture, district levels | Yes |
| Skins | Diamond-only cosmetics | avatar, tower, city, portal, weapon skins | Yes |
| Telemetry | Health, retention, completions, economy, conversion | entries, D1/D7, minted resources | View/insight |
| LiveOps | Seasonal events and experiments | Event Fountain, weekend tower map | Yes |

## 3. Non-negotiable contracts

### Character contract

```ts
Character = {
  profileId,
  level,
  xp,
  path,
  hpMax: derived(level, path),
  mpMax: derived(level, path),
  equippedSkins,
}
```

Rules:

- One XP bracket across every realm.
- One HP/MP curve across every realm.
- Modes may normalize temporarily for fair PvP, but they do not create a second saved HP/MP system.
- Kids never earn Character XP from game actions.

### Reward contract

```ts
RewardContract = {
  realmId,
  adult: {
    resources,
    xpPolicy,
    diamondPolicy,
  },
  kid: {
    resources,
    xpPolicy: "blocked",
    diamondPolicy: "blocked",
  },
  caps,
  sinks,
}
```

Rules:

- Diamonds are skin-only.
- Kids never receive Diamonds or Character XP from game actions.
- Kids can receive Bloom, Wood, Stone, Food, Ore, Blueprints, event tokens, score, rank, and city progress.
- Every reward event is ledgered with source realm and account type.

### Realm contract

```ts
RealmDefinition = {
  id,
  name,
  kind,
  status,
  portalId,
  runtime,
  tuningVersion,
  rewardContractId,
  skinCategories,
  multiplayerMode,
}
```

Statuses:

- `draft`
- `operator_test`
- `live`
- `seasonal`
- `paused`
- `archived`

Only drafts can be deleted. Anything players touched becomes paused or archived.

## 4. Data spine

Conceptual tables:

| Table | Purpose |
|---|---|
| `world_realms` | Registry of every playable realm |
| `world_portals` | Kingdom hotspot, return spawn, status, linked realm |
| `world_realm_tuning` | Versioned config per realm |
| `world_reward_contracts` | Allowed outputs/sinks/account rules |
| `resource_definitions` | Defines Bloom, Wood, Stone, etc. |
| `resource_ledger` | Append-only play resource events |
| `xp_ledger` | Append-only Character XP events with account-type validation |
| `skin_catalog` | Diamond-only cosmetic catalog |
| `skin_ownership` | Player owned skins |
| `stronghold_districts` | City/stronghold district definitions |
| `stronghold_state` | Circle-level city/kingdom state |
| `liveops_events` | Seasonal/prototype events |
| `realm_metrics_daily` | Aggregated entries, completions, retention, economy, conversion |
| `operator_audit_log` | Who changed/published what |

## 5. Runtime spine

Every game mode should follow the same launch path:

```text
Player taps portal
  -> portal lookup
  -> realm status check
  -> account rule check
  -> save return spawn
  -> launch realm runtime
  -> complete/fail/exit
  -> calculate reward contract
  -> write ledgers
  -> update stronghold if needed
  -> return player to portal
```

This is the reusable engine that lets new games be added, scaled, decreased, or archived without rewriting the hub.

## 6. Circle HQ addition: World Builder

Add one new surface to the HQ Build rail:

```ts
SurfaceId = ... | "world"
label = "World Builder"
icon = Map / Orbit / Waypoints
```

Placement:

- Rail group: `Build`
- Full workspace: yes, like Battle Builder / Character Forge
- Pattern: page tabs similar to Battle Builder, not the generic Game/App Builder

Purpose:

> World Builder controls the openworld topology: portals, realms, stronghold, rewards, events, and realm health.

## 7. HQ access and login page

Existing HQ flow already works:

| State | Page/component | Behavior |
|---|---|---|
| Offline preview | `Shell` | HQ opens without Supabase for design/dev preview |
| Loading | spinner | Auth state resolving |
| Anonymous | `Login` | Operator sees Circle HQ login card and Google button |
| Denied | `Denied` | Signed in but not operator/admin |
| Authorized | `Shell` | Operator enters HQ |

World Builder should require the same operator/admin gate as the rest of HQ.

Login page content should remain simple:

- Circle HQ mark
- "Founder OS · ArgantaLab & KinetikCircle"
- "Operator access only"
- Continue with Google
- Role note: `profiles.role in (operator, admin)`

No separate Lashira login page is needed inside World Builder. It inherits HQ auth.

## 8. World Builder page map

| Page/tab | Job | Primary components | Main actions |
|---|---|---|---|
| Overview | Health summary of the openworld | KPI strip, realm health cards, attention feed, economy warning strip, portal map mini-preview | Jump to broken portal, publish draft, pause realm |
| Portals | Control physical hotspots | Kingdom map preview, portal table, hotspot editor, return spawn picker, status pills | Add/edit portal, link realm, enable/disable, test launch |
| Realms | Registry of game modes | Realm catalogue, detail panel, runtime selector, lifecycle controls, complexity badges | Create realm, clone realm, set status, archive |
| Stronghold | City/kingdom growth layer | District grid, stat meters, upgrade editor, building list, city health simulator | Add district, tune upgrade costs, preview city stats |
| Rewards | Reward contracts and compliance | Reward matrix, adult/kid policy cards, source/sink editor, caps, compliance alerts | Edit outputs, block XP/Diamonds for kids, set caps |
| Events | Seasonal/event portal control | Event calendar, Event Fountain slot, experiment cards, promotion/retirement controls | Schedule event, start/stop, promote to permanent realm |
| Analytics | Retention/economy/skin performance | Realm comparison table, charts, funnel, resource mint/sink, skin conversion | Decide scale up/down/archive |
| Publish | Draft review before live | Diff viewer, validation checklist, audit note, publish button | Publish config, rollback to previous version |

## 9. Page-by-page design

### 9.1 Overview

Purpose: "What is alive, broken, risky, or worth scaling?"

Components:

| Component | Content |
|---|---|
| KPI strip | Live realms, draft realms, active portals, warnings, today's entries |
| Stronghold card | Population, happiness, safety, culture, prosperity |
| Realm health grid | One card per realm: status, entries, completion, retention, economy output |
| Attention feed | Broken portal, over-minting, kid XP blocked, event ending, dead realm |
| Source/sink strip | Bloom, Wood, Stone, Ore net flow |
| Recommended actions | Scale, tune, pause, archive suggestions |

Validation:

- Portal linked to missing realm.
- Live realm has no reward contract.
- Kid XP/Diamond policy not blocked.
- Realm mints resources but has no sink.
- Event is active but has no portal.

### 9.2 Portals

Purpose: "Where are the doors in the Kingdom, and what do they open?"

Components:

| Component | Content |
|---|---|
| Kingdom map preview | Current Lashira map with portal markers |
| Portal list | Portal ID, name, location, realm, status |
| Hotspot editor | `x0, y0, x1, y1`, return spawn, label, icon |
| Portal detail | Description, required level, account restrictions, launch modal copy |
| Test launch panel | Preview the player-facing entry modal |

Starter portals:

- Castle -> `kingdom_city`
- South Gate -> `tower_defense`
- Dungeon Gate -> `dungeon_gate`
- Fountain -> `event_fountain`
- Arena -> `pvp_arena`
- Dock -> `fishing_run`

### 9.3 Realms

Purpose: "What games exist around the Kingdom?"

Components:

| Component | Content |
|---|---|
| Realm catalogue | Cards/table for each realm |
| Runtime selector | city, tower_defense, cooking, dungeon, pvp, puzzle, event, custom |
| Lifecycle controls | draft, operator_test, live, seasonal, paused, archived |
| Complexity badge | start/scale complexity |
| Multiplayer badge | solo, async, realtime, co-op |
| Realm detail | analog, mechanic, start version, scale version |

Actions:

- Create realm from template.
- Clone existing realm.
- Link to portal.
- Set live/pause/archive.
- Open tuning.

### 9.4 Stronghold

Purpose: "The Last War-style endgame, Lashira-safe."

Components:

| Component | Content |
|---|---|
| District map | Castle center with districts around it |
| City stat meters | Population, happiness, safety, culture, knowledge, prosperity |
| District editor | Farm, Market, Academy, Defense, Garden, Housing, Workshop |
| Upgrade cost editor | Wood, Stone, Food, Bloom, Blueprints |
| Effect preview | How upgrade changes stats |
| Skin slots | City theme, building skin, road skin, banner skin |

No pay-to-win:

- Skins affect appearance only.
- Building upgrades consume play resources only.

### 9.5 Rewards

Purpose: "Every realm uses the same economy rules."

Components:

| Component | Content |
|---|---|
| Reward matrix | Realm x resource output |
| Adult policy card | XP allowed? Diamonds? resources? caps? |
| Kid policy card | XP blocked, Diamonds blocked, resources allowed |
| Source editor | What actions mint resources |
| Sink editor | What systems consume resources |
| Compliance panel | Kid XP blocked, kid Diamonds blocked, suspicious grants |
| Economy warnings | Over-mint, no sink, too slow, bottleneck |

Hard validation:

- Kid XP from gameplay must fail validation.
- Kid Diamond from gameplay must fail validation.
- Diamond stat/power fields must not exist.

### 9.6 Events

Purpose: "Use the Event Fountain to test viral mechanics."

Components:

| Component | Content |
|---|---|
| Event calendar | Start/end dates, active state |
| Event slot | Which realm currently occupies the fountain |
| Experiment cards | Draft viral modes |
| Event reward contract | Event tokens, cosmetics, play resources |
| Promotion panel | Promote successful event to permanent realm |
| Retirement panel | Archive failed event, preserve metrics |

### 9.7 Analytics

Purpose: "What should we scale, decrease, or archive?"

Components:

| Component | Content |
|---|---|
| Realm comparison table | Entries, completions, avg session, D1/D7, resource output, skin conversion |
| Retention chart | Repeat play by realm |
| Economy chart | Mint/sink trend |
| Skin chart | Views, purchases, equips by category |
| Cohort table | Adult/kid split, circle split |
| Recommendation column | Scale, tune, pause, archive |

Decision matrix:

| Signal | Recommendation |
|---|---|
| High retention + high skin conversion | Scale |
| High retention + economy over-mint | Tune rewards |
| Low retention + low complexity | Iterate |
| Low retention + high complexity | Pause/archive |
| High kid engagement | Keep kid-safe, add cosmetics |

### 9.8 Publish

Purpose: "No accidental live changes."

Components:

| Component | Content |
|---|---|
| Draft summary | Changed portals, realms, rewards, events |
| Diff viewer | Before/after config |
| Validation checklist | Missing realm, bad reward policy, no portal, compliance issues |
| Audit note | Required publish note |
| Publish button | Writes new active version |
| Rollback | Return to previous active version |

## 10. Component inventory

Reusable components for World Builder:

| Component | Description |
|---|---|
| `WorldBuilderShell` | Full surface with tabs |
| `WorldKpiStrip` | Overview metrics |
| `RealmHealthCard` | Realm status + KPIs |
| `AttentionFeed` | Warnings and suggested actions |
| `KingdomPortalMap` | Static current map preview with portal markers |
| `PortalTable` | Editable list of portals |
| `HotspotEditor` | Tile rectangle and return spawn controls |
| `RealmCatalogue` | Cards/table for game modes |
| `RealmDetailPanel` | Runtime, lifecycle, multiplayer, complexity |
| `StrongholdDistrictGrid` | City district editor |
| `CityStatMeters` | Population/happiness/safety/culture/etc. |
| `RewardMatrix` | Realm x resource grid |
| `AccountPolicyCard` | Adult/kid reward rules |
| `EconomySourceSinkChart` | Mint/sink balance |
| `EventCalendar` | LiveOps schedule |
| `PublishDiffPanel` | Config diff and validation |

## 11. Player-facing launch modal

Every portal should use one modal pattern:

| Element | Example |
|---|---|
| Title | Bloomwall Pass |
| Subtitle | Tower Defense · defend the south gate |
| Difficulty | Easy / Normal / Hard |
| Rewards | Bloom, Stone, Blueprints |
| Kid note | Kids earn play resources, not XP/Diamonds |
| Buttons | Enter, Cancel |

No instant walk-over teleport. Always confirm.

## 12. First design wedge

Build/design first:

1. World Builder shell.
2. Overview page.
3. Portals page.
4. Realms page.
5. Rewards page with kid/adult validation.

Delay:

- Full stronghold district editor.
- Event calendar.
- Deep analytics.
- Full map editor.

The first useful version should answer:

> What portals exist, what games do they open, what do they reward, and are kids protected?

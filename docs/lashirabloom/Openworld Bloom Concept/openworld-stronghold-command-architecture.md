# LashiraBloom Openworld Stronghold + HQ Command Architecture

Status: concept only, no build. Created 2026-07-10.

Companions:

- [`resource-economy-command-center-plan.md`](./resource-economy-command-center-plan.md)
- [`portal-hotspot-plan.md`](./portal-hotspot-plan.md)
- [`parallel-game-realm-matrix.md`](./parallel-game-realm-matrix.md)
- [`architecture-spine-and-world-builder-design.md`](./architecture-spine-and-world-builder-design.md)
- [`roadmap-and-build-plan.md`](./roadmap-and-build-plan.md)

## 1. Battle-tested verdict

The "Last War-style endgame stronghold" idea is the right endgame direction, with one important correction:

> The endgame should not be "many separate minigames." It should be one Kingdom/Stronghold that gets stronger, richer, safer, prettier, and more famous because every orbiting game feeds it.

The current Lashira Kingdom becomes the stronghold center. Each game mode is a portal or district around it:

- Farm feeds Food and Bloom.
- Forest and Mine feed Wood, Stone, and Ore.
- Tower Defense protects the wall and earns defensive blueprints.
- Dungeon earns Relics and rare unlocks.
- City Builder turns resources into population, happiness, safety, culture, and prosperity.
- PvP and Rival modes feed rank, fame, and cosmetic prestige.
- Event Fountain tests new viral games before they graduate.

The stronghold is the long-term retention layer. The orbiting games are the repeatable action loops.

## 2. Why this works

| Test | Result | Notes |
|---|---|---|
| Daily return | Pass | City health, farm timers, upgrades, events, and tower challenges create reasons to return |
| Identity | Pass | One character, one castle, one circle kingdom, one cosmetic inventory |
| Monetization safety | Pass | Diamonds buy skins only, not power |
| Kid learning loop | Pass | Kids never earn Character XP or Diamonds from game actions; learning apps remain the source |
| Scalability | Pass if data-driven | Each game must be a realm row/config, not a custom one-off |
| Development risk | Medium | Real-time multiplayer and async base defense are harder; start with city, tower, dungeon, event |
| Content fatigue | Risk | Too many portals can feel like a menu; solve with statuses, seasons, and promotion/retirement |
| Economy inflation | Risk | Every realm mints resources; solve with Circle HQ source/sink dashboards and caps |

## 3. Architectural principle

LashiraBloom needs a platform architecture:

```text
Kingdom Hub
  -> Portal Registry
      -> Realm Runtime
          -> Reward Ledger
          -> Skin Catalog
          -> Character Stat Model
          -> Circle HQ Metrics
```

Every game is a `realm`.

Every realm has:

- one portal location
- one runtime type
- one reward contract
- one tuning config
- one skin category set
- one telemetry contract
- one status: draft, live, seasonal, paused, archived

The game client should not hardcode every future mode. It should ask:

> Which portals are live for this circle? Which realm does this portal launch? What config does that realm use?

## 4. Scalable data objects

Conceptual data model:

| Object | Purpose | Editable in HQ |
|---|---|---|
| `realm_definition` | Defines a game mode: tower defense, dungeon, city, fishing, event | Yes |
| `portal_definition` | Tile hotspot on the Kingdom map and which realm it opens | Yes |
| `realm_tuning` | Difficulty, wave counts, spawn rates, rewards, timers | Yes |
| `reward_contract` | Allowed resource outputs and account-type rules | Yes |
| `resource_ledger` | Append-only earn/spend events | View/audit |
| `xp_ledger` | Character XP events with kid/adult source compliance | View/audit |
| `skin_catalog` | Diamond-only cosmetic catalog | Yes |
| `skin_ownership` | Player-owned cosmetics | View/support |
| `city_state` | Stronghold health and district levels | Yes/support |
| `realm_metrics_daily` | Entries, completions, session time, retention, minted resources | View/insight |
| `liveops_event` | Seasonal event config and active window | Yes |

## 5. Build/decrease/increase/delete model

Each realm should have lifecycle controls:

| Action | Meaning | Required behavior |
|---|---|---|
| Prototype | Internal draft only | Portal hidden or visible only to operator |
| Enable | Make portal visible | Uses default tuning and reward caps |
| Scale up | Add maps, levels, rewards, skins, or multiplayer | Increment realm version, preserve ledger history |
| Scale down | Reduce rewards, disable maps, simplify loops | Do not delete owned skins or earned ledgers |
| Pause | Temporarily remove portal | Keep data, show "closed" in HQ |
| Archive | Remove from player hub | Keep metrics, ledgers, ownership, and old configs |
| Delete draft | Remove unshipped config | Allowed only before player data exists |

Hard rule:

> Never delete player-owned items or historical ledgers. Delete only draft configs. Archive shipped realms.

## 6. Last War-style stronghold interpretation

Use the "stronghold" fantasy, but keep Lashira's tone:

| Last War-like idea | Lashira version |
|---|---|
| Base/stronghold | Kingdom castle and city districts |
| Power growth | City safety, prosperity, buildings, towers, tools, character level |
| Troops/squads | Kins, defenders, towers, friendly units |
| Waves/zombies | Woodland waves, shadow pests, playful invaders, no horror tone |
| Alliance | Family/circle |
| March/battle | Tower Defense, Warline Camp, Dungeon |
| Monetization | Skins, city themes, tower skins, banners, effects only |

This keeps the retention structure without copying the harsh war/pay-to-win pressure.

## 7. HQ fit: what exists today

Current Circle HQ already has:

- Shell/Rail surfaces: Home, Portfolio, Growth, Data, HQ Vault, Architecture, Command, Pixel Vault, Game Builder, App Builder, Learn Builder, Agent Builder, Content Builder, Battle Builder, Character Forge.
- Builder pattern: `Catalogue`, `Studio`, `Analytics`.
- Command tabs: Lobby, CEO, COO, CTO, CFO/Treasury, GC, CAPO.
- Battle Builder pattern: entity tabs like Overview, PVP, Bestiary, Rewards.

So the openworld system should use two layers:

1. A new Build surface for authoring the openworld platform.
2. New Command tabs/cockpits for operating it.

## 8. Recommended HQ additions

### A. Add new Build surface: `World Builder`

Rail group: Build.

Purpose: author the Kingdom hub, portals, realms, city districts, and event slots.

Tabs:

| Tab | Purpose |
|---|---|
| Overview | Health of the openworld config: live realms, draft realms, broken portals, economy warnings |
| Portals | Edit portal hotspots, location, return spawn, status, realm link |
| Realms | Registry of all game modes: city, tower, dungeon, event, PvP, fishing, outpost |
| Stronghold | City districts, building levels, city stats, upgrade costs |
| Rewards | Reward contracts per realm, kid/adult rules, source/sink caps |
| Events | Seasonal portal/event schedules and promotion/retirement |
| Analytics | Entries, completion, retention, resource output, skin conversion per realm |

Why it should be its own Build surface:

- It authors game topology, not just combat.
- It controls portals and modes, not individual assets.
- It becomes the source of truth for "what exists in LashiraBloom."

### B. Add Command cockpit/tab: `World Command`

Best fit inside Command, probably under COO/Operations or as a new top-level Command tab if it becomes important.

Purpose: operate live realms.

Shows:

- Today active realms
- Realm health
- Retention by realm
- Economy over-mint warnings
- Portals with poor conversion
- Stale/dead realms to pause/archive
- Event performance
- Kid XP/Diamond compliance

### C. Add Treasury sub-surface: `Economy Command`

Best fit: CFO/Treasury already exists.

Purpose: source/sink and no-pay-to-win guardrails.

Shows:

- Bloom minted vs spent
- Wood/Stone/Ore bottlenecks
- Realm reward output
- Skin revenue and equip rate
- Diamond spend by category
- Kid Diamond/XP source compliance
- Inflation alerts

### D. Add Product/LiveOps cockpit: `Realm Portfolio`

Could be inside World Builder Analytics or Command CEO view.

Purpose: decide what to build, scale, decrease, or delete/archive.

Matrix:

| Realm | Retention | Complexity | Economy risk | Skin conversion | Recommendation |
|---|---|---|---|---|---|
| Tower Defense | High | Medium | Medium | Good | Scale |
| Fishing | Medium | Low | Low | Medium | Keep |
| Rival Yard | Unknown | High | Low | High potential | Prototype |
| Weak event | Low | Low | Low | Low | Archive |

## 9. Suggested nav placement

Minimal HQ change:

| Area | Add |
|---|---|
| Build rail | `World Builder` |
| Command tabs | Add `World` or add World cockpit inside COO |
| Treasury | Add economy guardrail cards |
| Data | Add realm/resource/portal tables |
| Architecture | Add Openworld/Realm diagram |

If only one new tab/surface is allowed first:

> Add `World Builder` in the Build group.

It can contain Catalogue/Studio/Analytics like the existing Game/App Builder pattern:

- Catalogue = realms and portals list.
- Studio = edit selected realm/portal/stronghold district.
- Analytics = retention/economy/skin metrics.

## 10. First wedge for HQ

Start with control before content explosion:

1. Realm registry.
2. Portal registry.
3. Reward contract per realm.
4. Stronghold/city district registry.
5. Analytics per portal/realm.

Do not start with a full map editor yet.

The first useful HQ screen should answer:

> What portals exist, what game do they open, what do they reward, and are they healthy?

## 11. Battle-test scenarios

| Scenario | Expected architecture response |
|---|---|
| Add Tower Defense prototype | Create realm row, portal row, default reward contract, status=draft |
| Promote Tower Defense live | Set status=live, portal visible, metrics begin tracking |
| Rewards too generous | Economy Command flags mint/sink imbalance; reduce reward contract version |
| Kid gets XP from gameplay by bug | XP ledger compliance alert fires; reward contract blocks future grants |
| Event fails retention | Archive event portal, keep metrics, keep earned cosmetics |
| Rival mode becomes popular | Promote event realm to permanent realm, assign fixed portal |
| Need to remove a bad mode | Pause or archive, never delete ledgers/owned skins |
| Want a new skin line | Add skins to Skin Catalog, link to realm theme, no stat fields |

## 12. Recommendation

Yes, aim for a Last War-like endgame stronghold, but build it as:

```text
Kingdom Stronghold
  + Portal Registry
  + Realm Registry
  + Reward Contracts
  + Skin Catalog
  + Circle HQ World Builder
  + Command/Economy Analytics
```

The first HQ addition should be `World Builder`, because it is the missing operator surface that controls the openworld topology.

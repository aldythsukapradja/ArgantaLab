# Openworld Bloom Concept - Read First

Status: concept, build-planning spine, and current single HTML prototype handoff. Last updated 2026-07-11.

This folder is the source of truth for the LashiraBloom openworld hub concept. The current Kingdom basemap is the playable headquarters. Five player-facing portals sit on top of that map, and every new game mode must plug into the same economy, account rules, character system, HUD shell, and command-center controls.

## 1. Mental model

LashiraBloom is not a pile of separate games.

It is one Kingdom headquarters with reusable realms around it:

- The Kingdom map is the command center and launcher.
- Each portal opens a realm with its own mechanics.
- All realms reuse the same character, HP/MP, resources, skins, and reward rules.
- Diamonds buy skins only, never power.
- Kids never earn Character XP or Diamonds from game actions. Kids receive those from learning apps or approved guardian/learning events.
- Realms can be added, paused, archived, or removed without breaking the Kingdom ledger.

If a document conflicts with this file, treat this index plus `portal-hotspot-plan.md`, `shared-game-shell-component-strategy.md`, and `roadmap-and-build-plan.md` as the current ground truth.

## 2. Read order for LLMs

| Order | File | Why to read it |
|---|---|---|
| 1 | `INDEX.md` | Current mental model, rules, and file map |
| 2 | `HANDOFF-single-html-5world-current.md` | Current built prototype state, run instructions, controls, limitations, and next steps |
| 3 | `portal-hotspot-plan.md` | Canonical portal IDs, names, coordinates, and reward rules |
| 4 | `shared-game-shell-component-strategy.md` | Shared four-corner game UI and design ground truth |
| 5 | `roadmap-and-build-plan.md` | Today plan, basemap prompts, and implementation sequence |
| 6 | `architecture-spine-and-world-builder-design.md` | Circle HQ page structure, command center, and admin tabs |
| 7 | `resource-economy-command-center-plan.md` | Economy, resources, HP/MP, adult/kid account model |
| 8 | `parallel-game-realm-matrix.md` | Game pillar matrix, mechanics, complexity, and reuse |
| 9 | `retention-pillar-research.md` | Viral analogs and retention rationale |
| 10 | `openworld-stronghold-command-architecture.md` | Battle-tested stronghold/endgame architecture |
| 11 | `MAP-full-element-inventory.md` | Ground-truth element inventory, **auto-synced** — run `npm run map:sync` in `apps/lashira/web` after touching farm-map.js/world-map-registry.js/realms/*.js, before touching any coordinate |
| 12 | `CONCEPT-portal-markers-and-openworld-builder.md` | Simplified circular portal markers + the Openworld Builder (Circle HQ surface) concept and toolset |

## 3. Player-facing portals

Only these five should be presented as the main game pillars. Everything else is a resource zone, shop, submode, or event.

| Marker | Portal ID | Display name | Landmark | Hotspot rect | Return spawn | Pillar |
|---|---|---|---|---|---|---|
| 1 | `lashira_keep` | Lashira Keep | Castle / central plaza | `x27-32, y21-26` | `x30, y25` | City / stronghold |
| 2 | `bloomwall_pass` | Bloomwall Pass | South wall gate | `x28-31, y32-33` | `x30, y33` | Defense / adventure |
| 3 | `hearthrush_kitchen` | Hearthrush Kitchen | Market / kitchen counter | `x29-30, y16-17` | `x30, y18` | Cooking / service |
| 4 | `fountain_festival` | Fountain Festival | Actual fountain | `x14-16, y26-29` | `x15, y29` | Puzzle / seasonal events |
| 5 | `emberring_arena` | Emberring Arena | Arena circle center | `x47-48, y37-39` | `x48, y38` | Social competition |

## 4. Resource zones

These are reusable economy zones, not separate headline games.

| Marker | Zone ID | Display name | Hotspot rect | Feeds |
|---|---|---|---|---|
| A | `sunseed_farm` | Sunseed Farm | `x7-26, y6-15` | Food, Bloom, farming mastery |
| B | `meadowkin_pastures` | Meadowkin Pastures | `x35-55, y4-15` | Food, animal goods, ranching mastery |
| C | `ironroot_crystalvein` | Ironroot + Crystalvein | `x38-57, y18-30` | Wood, stone, ore |
| D | `moonwell_dock` | Moonwell Dock | `x12-15, y37-38` | Fish, Food, fishing mastery |
| E | `petalbloom_garden` | Petalbloom Garden | `x3-9, y20-26` | Bloom, garden events, festival materials |

## 5. Shared game shell

Every realm must use the same four-corner interface shell:

| Corner | Shared component | Fixed responsibility |
|---|---|---|
| Top left | `CharacterStatusPanel` | Character, HP, MP, Wood, Ore, Bloom, Diamonds |
| Top right | `SettingsMenuButton` / `GameMenuSheet` | Settings, audio, help, exit, debug controls |
| Bottom left | `LocationInfoPanel` | Realm, zone, objective, status, coordinates |
| Bottom right | `ActionControllerShell` | Shared controller layout; realm supplies actions/icons/cooldowns |

Hard rule: individual realms should not build custom HUD corners. They only provide data and action definitions to the shared shell.

## 6. Today target

The realistic foundation target is:

1. Approve portal names and hotspot locations.
2. Wire all hotspot rectangles on the current `basemap.png`.
3. Show the character wandering on top of the basemap.
4. Make every portal open a shared launch modal or placeholder realm.
5. Use the shared four-corner HUD shell everywhere.
6. Keep basemap prompts ready for future realm maps at exactly `1394x1128 px`.

The current visual guide is `portal-hotspots-pillar-map.png`.

# LashiraBloom Parallel Game Realm Matrix

Status: concept only, no build. Created 2026-07-10.

Companions:

- [`portal-hotspot-plan.md`](./portal-hotspot-plan.md)
- [`resource-economy-command-center-plan.md`](./resource-economy-command-center-plan.md)
- [`openworld-stronghold-command-architecture.md`](./openworld-stronghold-command-architecture.md)
- [`roadmap-and-build-plan.md`](./roadmap-and-build-plan.md)
- [`retention-pillar-research.md`](./retention-pillar-research.md)

Goal: plan the approved five player-facing game pillars while keeping one reusable economy, one character model, one skin-only Diamond rule, and one Circle HQ command system.

## 1. Shared rules

- Diamonds buy skins only.
- Kids never earn Diamonds or Character XP from game actions.
- Kids can earn play resources, score, rank, city progress, event tokens, and mastery.
- HP/MP/XP use one canonical character curve across all realms.
- PvP or competitive modes may normalize stats temporarily for fairness, but saved character power remains one system.
- Every realm must report sources, sinks, completion, session length, reward output, and skin conversion to Circle HQ.

Complexity index:

- `1-2` = tiny/minigame
- `3-4` = manageable first build
- `5-6` = medium system
- `7-8` = large system
- `9-10` = platform-level or heavy live ops

## 2. Approved five-pillar realm table

| Realm / Portal | Viral game analog | Resources earned | Consumes / sinks | Start mechanic | Scale mechanic | Design style prompt | Multiplayer | Complexity start | Complexity scale |
|---|---|---|---|---|---|---|---|---:|---:|
| Lashira Keep / `lashira_keep` | SimCity BuildIt, Township, Last War stronghold, Clash base layer | City stats, population, Bloom, Blueprints, stronghold progress | Wood, Stone, Food, Bloom, Blueprints | Upgrade 6-8 Kingdom districts; city health bars: population, happiness, safety, culture | Outpost/base layouts, services, city requests, decorative skins, circle projects | Cozy pixel kingdom stronghold, castle-centered districts, readable buildings, soft garden palette, no clutter | Shared circle city, async co-op | 4 | 8 |
| Bloomwall Pass / `bloomwall_pass` | Kingdom Rush, Plants vs Zombies, Last War lanes, Archero-lite boss rooms | Bloom, Stone, Ore, Relics, Blueprints, score | Tower upgrades, repairs, adventure tickets, crafting parts | One defense/adventure map: 10 waves, 4 tower types, hero skill, simple boss | Tower-defense maps, dungeon rooms, lane battles, bosses, weekly challenge ladder, co-op defense | Cozy fantasy defense pass at the south gate, warm kingdom wall, cute woodland enemies, bright readable FX | Solo first; co-op later | 4 | 8 |
| Hearthrush Kitchen / `hearthrush_kitchen` | Dinner Dash, Overcooked, Cooking Fever | Meals/Food value, Bloom, Cooking mastery, city happiness/service progress | Raw Food ingredients, recipe tickets, kitchen upgrades via play resources | Serve 3 customer orders from prep/cook/serve stations; short timed rounds | Multi-station kitchens, recipes, rush hours, co-op roles, restaurant decor skins, festival catering events | Cozy pixel tavern kitchen, top-down service counters, readable food icons, warm lantern light, friendly kitchen chaos | Solo first; same-screen/co-op later | 4 | 8 |
| Fountain Festival / `fountain_festival` | Royal Match, Gardenscapes, Monopoly GO-style events, Roblox/Fortnite UGC islands | Event tokens, Garden mastery, cosmetic eligibility, play resources depending on event | Event recipes, garden tasks, temporary shop | One rotating casual event: match/merge/order board around the fountain | Seasonal event calendar, viral prototypes, puzzle maps, garden decoration unlocks, promote winners to permanent submodes | Magical plaza fountain, seasonal decorations, satisfying puzzle pops, bright festival mood | Solo first; event-dependent later | 3 | 10 |
| Emberring Arena / `emberring_arena` | Brawl Stars, Roblox arena, casual MMO duels | Rank, score, cosmetic eligibility | No power sinks; cosmetic loadout only | Friendly duel / score challenge inside arena | Normalized PvP seasons, rival shooter rounds, tournaments, spectator board, cosmetic frames | Clean circular arena, readable top-down combat, playful competition, bright class FX, no violent tone | Real-time multiplayer | 5 | 9 |

## 2b. Resource zones

These support the pillars but are not separate player-facing game pillars.

| Resource zone | Supports | Main resources |
|---|---|---|
| Sunseed Farm | Lashira Keep, Hearthrush Kitchen | Food, Bloom, Farming mastery |
| Meadowkin Pastures | Lashira Keep, Hearthrush Kitchen | Food, animal goods, Ranching mastery |
| Ironroot + Crystalvein | Lashira Keep, Bloomwall Pass | Wood, Stone, Ore, Mining/Foraging mastery |
| Moonwell Dock | Hearthrush Kitchen, Fountain Festival | Fish/Food, Fishing mastery |
| Petalbloom Garden | Fountain Festival, Lashira Keep | Garden resources, event tokens, Culture |

## 3. Recommended parallel start set

Build the platform as if all five pillars exist, but only start with three live wedges:

| Order | Realm | Why first |
|---|---|---|
| 1 | Lashira Keep | Makes the castle the center and creates daily retention |
| 2 | Bloomwall Pass | Strong active gameplay and directly fits "defend the Kingdom" |
| 3 | Hearthrush Kitchen | Makes Food active and broadens appeal beyond combat |

Keep these in visible draft state:

| Draft pillar | Why draft |
|---|---|
| Fountain Festival | Strong casual/event retention, but can wait until the first three loops exist |
| Emberring Arena | Current PvP exists, but social competition should come after tuning and live playtest polish |

## 4. Shared Circle HQ fields per realm

Every realm should be editable and trackable with the same fields:

| Field | Example |
|---|---|
| `realm_id` | `tower_defense` |
| `portal_id` | `tower_defense` |
| `status` | draft / live / seasonal / disabled |
| `primary_resource_outputs` | Bloom, Stone, Ore |
| `primary_resource_sinks` | tower upgrades, repairs |
| `diamond_categories` | tower skins, projectile skins |
| `kid_xp_allowed` | false |
| `kid_diamond_allowed` | false |
| `adult_xp_policy` | none / quest_only / mode_reward |
| `multiplayer_mode` | solo / async / realtime / co-op |
| `complexity_start` | 4 |
| `complexity_scale` | 8 |
| `retention_metric` | repeat entries, completion, D1/D7 return |
| `economy_metric` | net resource mint, sink pressure, bottlenecks |
| `skin_metric` | views, purchases, equips, conversion |

## 5. Notes for parallel production

- Do not let each realm invent a new economy.
- Give each realm one primary resource identity: city = Food/health, tower defense = Stone/Ore/Blueprints, dungeon = Relics/Ore, farm = Food/Bloom, forest/mine = Wood/Stone/Ore.
- Skins should be themed per realm, but stored in one skin catalog.
- Mechanics can differ, but reward rules must stay consistent.
- The Event Fountain is the test slot for viral mechanics. Successful event islands can graduate into permanent portals.

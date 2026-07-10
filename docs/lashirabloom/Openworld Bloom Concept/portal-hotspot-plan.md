# LashiraBloom Portal Hotspot Plan

Status: concept only, no build. Created 2026-07-10.

Parallel realm companion: [`parallel-game-realm-matrix.md`](./parallel-game-realm-matrix.md).
Stronghold/HQ architecture companion: [`openworld-stronghold-command-architecture.md`](./openworld-stronghold-command-architecture.md).
Roadmap companion: [`roadmap-and-build-plan.md`](./roadmap-and-build-plan.md).

Goal: start without a separate world map. The current Lashira Kingdom map remains the hub, and each new game is entered from a physical portal/hotspot on the existing 60x48 tile map.

## 1. Rule

No world map first.

Use the Kingdom itself as the launcher:

- Walk to a meaningful landmark.
- Tap or press the interaction button.
- Confirm entry into the game mode.
- Return to a stable spawn point near the same landmark when the mode ends.

This keeps the world simple while making every game feel attached to the Kingdom.

## 2. Approved player-facing portal table

Tile coordinates use the current Lashira map grid: `x=0..59`, `y=0..47`.

Only five game portals should be marketed to players. The rest of the map remains useful as resource zones, shops, and sub-activities.

Visual map: [`portal-hotspots-pillar-map.png`](./portal-hotspots-pillar-map.png).

| Priority | Portal ID | Final name | Combines | Current landmark | Suggested hotspot rect | Return spawn | Purpose |
|---|---|---|---|---|---|---|---|
| P0 | `lashira_keep` | Lashira Keep | City builder, stronghold, outpost/base management, castle upgrades | Castle / central plaza | `x27-32, y21-26` | `x30, y25` | The long-term Kingdom/stronghold endgame |
| P0 | `bloomwall_pass` | Bloomwall Pass | Tower defense, dungeon/boss, Last War-style lane battles, PvE adventure | South wall gate | `x28-31, y32-33` | `x30, y33` | Defend and adventure for the Kingdom |
| P0 | `hearthrush_kitchen` | Hearthrush Kitchen | Dinner Dash, Overcooked, market food service, cooking orders | Market / castle kitchen counter | `x29-30, y16-17` | `x30, y18` | Turns Food into meals, happiness, service progress |
| P1 | `fountain_festival` | Fountain Festival | Puzzle/merge, seasonal events, viral tests, garden events | Actual fountain in the west garden | `x14-16, y26-29` | `x15, y29` | Casual and seasonal retention portal |
| P1 | `emberring_arena` | Emberring Arena | PvP arena, rival/shooter mode, score challenges | Arena circle center | `x47-48, y37-39` | `x48, y38` | Contained social/competitive play |

## 2b. Resource zones, not separate games

These zones stay visible and interactive, but they should not be presented as separate games in the main portal set.

| Zone ID | Final name | Function | Hotspot / area |
|---|---|---|---|
| `sunseed_farm` | Sunseed Farm | Crops, Food, Bloom, farming mastery | `x7-26, y6-15` |
| `meadowkin_pastures` | Meadowkin Pastures | Animals, Food, ranching mastery | `x35-55, y4-15` |
| `ironroot_crystalvein` | Ironroot + Crystalvein | Wood, Stone, Ore, mining/foraging mastery | `x38-57, y18-30` |
| `moonwell_dock` | Moonwell Dock | Fish, Food, fishing mastery | `x12-15, y37-38` |
| `petalbloom_garden` | Petalbloom Garden | Garden/event resource area; supports Fountain Festival | `x3-9, y20-26` |

## 3. First wedge portals

Build order recommendation when implementation begins:

1. `lashira_keep` at the Castle.
2. `bloomwall_pass` at the South Wall Gate.
3. `hearthrush_kitchen` at the Market.
4. `fountain_festival` at the actual Fountain.
5. `emberring_arena` at the Arena.

Why:

- Castle -> City Builder makes the Kingdom feel alive.
- South Wall -> Bloomwall Pass is visually obvious: defend the gate.
- Market -> Cooking gives Food a fun active sink and supports the city happiness loop.
- Fountain Festival lets new viral tests appear without changing the whole map.
- Emberring Arena keeps competition contained in one clear place.

## 4. Portal behavior

All portals should follow the same interaction pattern:

| Step | Behavior |
|---|---|
| Approach | Zone pill changes to the landmark name |
| Tap / action | Small modal opens with mode name, difficulty/status, reward preview |
| Confirm | Saves current position, launches the mode |
| During mode | Uses the player's same character, skins, HP/MP model, and account-type reward rules |
| Exit / finish | Returns player near the same portal with rewards summarized |

No instant teleport on walk-over. Use confirmation so kids do not accidentally leave the farm/city.

## 5. Reward and account rules by portal

| Portal | Adults can earn | Kids can earn | Kids never earn from this portal |
|---|---|---|---|
| `lashira_keep` | Bloom/resource spend progress, city stats, approved XP if allowed | Bloom/resource contribution, city stats, score | Character XP, Diamonds |
| `bloomwall_pass` | Bloom, Stone, Ore, Blueprints, Relics, score, approved XP if allowed | Bloom, Stone, Ore, Blueprints, Relics, score | Character XP, Diamonds |
| `hearthrush_kitchen` | Food-to-meals conversion, Bloom, Cooking mastery, city happiness/service progress | Food-to-meals conversion, Bloom, Cooking mastery, city happiness/service progress | Character XP, Diamonds |
| `fountain_festival` | Event tokens, cosmetics if event grants them, play resources | Event tokens, cosmetics if guardian/event rules allow, play resources | Character XP, Diamonds unless from learning |
| `emberring_arena` | Rank/score, cosmetic eligibility | Rank/score, cosmetic eligibility | Character XP, Diamonds |

## 6. Circle HQ tracking per portal

Each portal should be trackable as a first-class realm entry:

| Field | Meaning |
|---|---|
| `portal_id` | Stable ID from the portal table |
| `realm_id` | Game mode launched by the portal |
| `hotspot_rect` | Tile rectangle on the Kingdom map |
| `status` | draft, live, seasonal, disabled |
| `entry_count` | How often players enter |
| `completion_rate` | How often they finish |
| `avg_session_seconds` | Retention signal |
| `rewards_minted` | Resource output |
| `skin_conversions` | Cosmetic purchases/equips tied to this portal/theme |
| `kid_xp_blocked` | Compliance metric proving kids did not get XP from game actions |
| `kid_diamond_blocked` | Compliance metric proving kids did not get Diamonds from game actions |

## 7. Notes

- Keep the current numbered overlay useful: it already teaches where the hub systems are.
- Do not add too many portals at once. Too many doors makes the Kingdom feel like a menu.
- The first experience should make the Castle and South Wall feel important.
- The Event Fountain is the pressure-release valve for experiments: test viral modes there first, then promote winners to permanent portals.

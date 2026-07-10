# LashiraBloom Resource Economy + Circle HQ Command Plan

Status: concept only, no build. Created 2026-07-10 to track the current discussion.

Portal companion: [`portal-hotspot-plan.md`](./portal-hotspot-plan.md).
Parallel realm companion: [`parallel-game-realm-matrix.md`](./parallel-game-realm-matrix.md).
Stronghold/HQ architecture companion: [`openworld-stronghold-command-architecture.md`](./openworld-stronghold-command-architecture.md).

## 1. Product shape

LashiraBloom is a kingdom-centered game platform:

- The current Lashira Kingdom is the permanent center: castle, farm, city, shops, character, family/circle home, and world map.
- New games become orbiting realms around the Kingdom, not separate products.
- Circle HQ is the unified command center for tuning, tracking, economy insight, live ops, skins, and realm performance.
- Diamonds are always skin/cosmetic only. No paid power.

Core sentence:

> One character, one kingdom, many orbiting games, all controlled from Circle HQ.

## 2. Economy principles

1. Keep the resource list small first.
2. Every new game should reuse the same resource families when possible.
3. Diamonds buy visual identity only: skins, themes, effects, decorations, emotes, mounts, and UI frames.
4. Gameplay power is earned by playing, not bought with Diamonds.
5. Competitive modes should use fair/normalized rules, so cosmetics never affect PvP advantage.
6. Circle HQ must track every source, sink, balance, and conversion path.
7. Seasonal/event resources can exist, but they should roll up into the same command model.
8. HP/MP must use one canonical character curve for all players and all orbiting games.
9. Account type controls reward sources, not the core stat system.

## 2b. Character power and account-type rules

LashiraBloom should have one shared character power model:

- One XP bracket from level 1 upward.
- One HP curve.
- One MP curve.
- One character level shown consistently across Kingdom, Tower Defense, Dungeon, PvP, City, and future realms.
- Mode-specific balance can temporarily normalize stats for fairness, especially PvP, but the saved character still uses the same canonical HP/MP/XP model.

Adult and kid accounts use the same visible character model, but their reward sources differ:

| Reward | Adult account | Kid account | Reason |
|---|---|---|---|
| Character XP | May be earned from approved game actions and quests | Never earned from game actions | Preserves learning-driven growth for kids |
| Diamonds | Skin/cosmetic currency only; source controlled by HQ/guardian rules | Never earned from game actions; earned from learning apps / guardian-approved learning events | Keeps learning as the Diamond source |
| Bloom / Wood / Stone / Food / Ore | Earned from play | Earned from play | Kids can still enjoy and help the Kingdom |
| Skins | Bought with Diamonds or granted by guardian/events | Bought with learning-earned Diamonds or guardian grants | Cosmetic only, no power |
| Rank / Score | Earned from play | Earned from play | Competition can exist without granting XP/Diamonds |

This means kids can play every game mode, contribute resources, build the city, defend the Kingdom, and climb scoreboards, but game play never mints their Character XP or Diamonds. Learning apps and guardian-approved learning events are the only kid source for those two progression currencies.

## 3. Reusable resource table

| Resource | Type | Scope | Earned from | Used for | Reusable by orbiting games | Circle HQ tracks |
|---|---|---|---|---|---|---|
| Diamonds | Cosmetic currency | Player | Learning apps, guardian/operator grants, approved non-power sources; never kid game actions | Skins only: avatar, mount, weapon look, tower skin, building skin, city theme, emotes, profile frames | All games, as visual identity only | Grants, spend, skin conversion, ownership, suspicious changes, kid-source compliance |
| Skin ownership | Permanent cosmetic inventory | Player | Diamond purchases, event rewards, gifts | Equipping visual variants across avatar, city, towers, weapons, mounts, pets, UI | All games | Owned count, equip rate, revenue, popularity by realm/theme |
| Bloom | Main play currency | Circle/shared first, player optional later | Farming, tower defense, dungeon, city tasks, events, selling goods | Non-paid gameplay upgrades, crafting fees, city projects, realm unlock chores | City sim, tower defense, dungeon, clan/base, events | Source/sink balance, inflation, reward rates, spend rates |
| Wood | Build material | Circle/shared | Forest, city jobs, tower defense rewards, events | Buildings, decor crafting, city upgrades, tower structures, repairs | City sim, tower defense, clan/base, farm expansion | Production, consumption, bottlenecks, upgrade blockers |
| Stone | Build material | Circle/shared | Mining, dungeon, tower defense, city quarry | Castle, walls, roads, defensive buildings, heavy towers | City sim, tower defense, clan/base, dungeon | Production, consumption, bottlenecks, wall/castle progress |
| Food | Life/support material | Circle/shared | Crops, animals, fishing, market tasks | Population growth, happiness, animal feed, event recipes, soft consumables | City sim, farm, tower defense support, events | Stock, decay if any, consumption by population/buildings |
| Meals | Derived Food output | Circle/shared or session-scored | Cooking Dash / Kitchen Rush converts raw Food into served meals | City happiness, service tasks, event catering, Bloom rewards | Cooking, city sim, events | Food conversion rate, order success, happiness impact |
| Ore | Craft material | Circle/shared | Mining, dungeon, boss rewards | Tools, tower parts, blacksmith recipes, advanced buildings | Tower defense, dungeon, clan/base, city sim | Drop rates, crafting demand, node balance |
| Relics | Rare earned material | Circle/shared or player-bound | Bosses, milestones, hard events | Unlock recipes, prestige decor, special non-paid upgrades | Dungeon, tower defense, city wonders, events | Scarcity, first clears, repeat clears, unlock pacing |
| Blueprints | Unlock item | Circle/shared or player-bound | Realm milestones, quests, bosses, events | Unlock new towers, buildings, city districts, decorations, game modes | All modes with buildable content | Unlock funnel, missing prerequisites, popular builds |
| Realm tickets | Entry/attempt resource | Player or circle | Daily refresh, quests, events | Enter special maps or limited attempts, never sold for Diamonds | Events, dungeon, challenge maps, tower defense trials | Attempts, abandoned runs, retention hooks |
| Realm tokens | Seasonal/event currency | Player or circle | Specific event realm | Temporary event shop, trophies, decor, optional skin discounts if allowed | Event islands only | Event health, token surplus, conversion at event end |
| Character XP | Progress metric | Player | Adults: approved game actions/quests; kids: learning apps only | Levels, titles, access gates, HP/MP curve | PvE, dungeon, tower defense hero role, story | Level curve, progression speed, kid/adult split, source compliance |
| HP/MP | Derived character stats | Player | Derived from canonical XP level and class/path | Combat survivability, skills, fair-mode normalization input | All combat modes and future realms | Curve balance, mode normalization, outlier builds |
| Activity mastery | Progress metric | Player | Farming, fishing, mining, ranching, defense, building | Perks, titles, hiscores, soft gates | All modes | Activity retention, mastery spread, underused loops |
| City stats | Derived sim stats | Circle/shared | Buildings, population, services, decorations, safety | Kingdom health: population, happiness, safety, culture, knowledge, prosperity | Simple SimCity layer, all realms can affect it | City health, shortages, upgrade recommendations |
| Rank/score | Competitive metric | Player/circle | PvP, timed runs, tower defense score | Leaderboards, titles, bragging rights, cosmetic unlock eligibility | PvP, shooter, tower defense, events | Fairness, win/loss, abuse, engagement, rewards |

## 4. Resource alignment by game realm

| Realm | Main loop | Earns | Spends/uses | Diamond role |
|---|---|---|---|---|
| Lashira Kingdom / HQ | Farm, city, shop, character, world map | Bloom, Food, Wood, Stone, mastery | City upgrades, farm expansion, crafting, building | Avatar skins, castle skins, farm themes, decor |
| Simple City Builder | Place/upgrade districts, manage city health | City stats, Bloom, population milestones | Wood, Stone, Food, Bloom, Blueprints | Building skins, road skins, city themes, festival decor |
| Tower Defense | Defend lanes around the Kingdom | Bloom, Stone, Ore, Blueprints, score | Tower upgrades, repairs, tower unlocks | Tower skins, projectile effects, victory effects |
| Dungeon / Boss | Short PvE runs, boss clears | Ore, Relics, Bloom, Blueprints; adult XP only if allowed; kid XP never from play | Entry tickets, crafting unlocks | Boss-themed cosmetics and trophies |
| Kitchen Rush | Prepare and serve food orders | Meals, Bloom, Cooking mastery, city happiness/service progress | Raw Food ingredients, recipe tickets, play-resource kitchen upgrades | Kitchen skins, chef outfits, serving effects, restaurant decor |
| 2D Rival / Shooter | Short competitive rounds | Rank, score, event tokens | None for power in ranked; optional loadout cosmetics only | Weapon skins, outfit skins, hit effects |
| Clan/Base Defense | Build outpost, defend, async raids | Wood, Stone, Bloom, Blueprints | Buildings, walls, traps, decor | Base skins, wall skins, flag skins |
| Warline / Lane Battle | Formation/lane waves | Bloom, score, blueprints, relic chances | Unit/tactic unlocks earned by play | Squad skins, banner skins, lane theme |
| Puzzle/Merge Event Island | Casual daily event | Event tokens, Food/Bloom variants | Event recipes, temporary goals | Event skins, decor bundles, profile frames |

## 5. Circle HQ command center surfaces

| Surface | Purpose | Key questions |
|---|---|---|
| World Map Command | Shows Kingdom center and orbiting realms | Which realms are live, draft, seasonal, or retired? Which realm is driving retention? |
| Economy Command | Tracks sources, sinks, balances, and bottlenecks | Is Bloom inflating? Are Wood/Stone blocking upgrades too hard? Which realm overpays? |
| Skin Shop Command | Edits and analyzes cosmetic catalog | Which skins sell/equip best? Which realm theme converts? What should be featured? |
| City Command | Monitors simple SimCity layer | Is happiness low? Is food short? Which district should be nudged next? |
| Realm Tuning Command | Edits data-driven realm rules | Are waves too hard? Are dungeon drops too rare? Are event rewards too generous? |
| LiveOps Command | Plans events and seasonal islands | Did the event improve D1/D7 retention? Did it create resource surplus? |
| Insight Command | Finds patterns and recommendations | What should we build next? What should be nerfed, buffed, or retired? |

## 6. Data model sketch

These are conceptual tables, not a migration plan yet.

| Table | Purpose |
|---|---|
| resource_definitions | Defines each reusable resource and whether it is currency, material, metric, or cosmetic |
| resource_ledger | Append-only resource earn/spend events |
| xp_ledger | Append-only Character XP events with account-type/source validation |
| character_stat_curves | Canonical XP bracket, HP curve, MP curve, and class/path modifiers |
| skin_catalog | Editable cosmetic catalog |
| skin_ownership | Player-owned skins |
| realm_definitions | Orbiting games around the Kingdom |
| realm_tuning | Editable tuning values per realm |
| economy_sources | Declares which activities mint resources |
| economy_sinks | Declares which systems consume resources |
| city_state | Circle-level city stats and derived health |
| liveops_events | Seasonal/event configuration |
| insight_snapshots | Daily summarized metrics for HQ dashboards |

## 7. First wedge

Recommended first wedge:

1. Lock the reusable resource taxonomy.
2. Lock the single HP/MP/XP character curve and kid/adult reward-source rules.
3. Add the simple city-builder concept around the Kingdom.
4. Add Tower Defense as the first orbiting realm.
5. Make Diamonds skin-only in every plan and screen.
6. Make Circle HQ track sources, sinks, skins, XP source compliance, and realm health before adding more modes.

Why this wedge:

- City sim creates daily return behavior.
- Tower defense creates active gameplay.
- Skins create monetization without pay-to-win.
- Circle HQ gives operator control and insight.
- The orbiting-realm structure lets future viral games plug in cleanly.

## 8. Open decisions

| Decision | Current recommendation |
|---|---|
| Bloom scope | Start as circle/shared for Kingdom resources; add player-bound balances only when needed |
| Food detail | Keep one Food family first; Meals are a derived output of Cooking, not a separate hard currency unless the loop proves it needs one |
| Relics | Use sparingly for boss/milestone unlocks, not as a daily grind currency |
| Realm tokens | Allow only for seasonal events; expire or convert at event end |
| Diamond discounts | Avoid discounts that make gameplay rewards feel like paid power; keep Diamond value clean |
| PvP rewards | Rank and cosmetics only; no Diamond minting and no paid advantage |
| Character HP/MP | One canonical HP/MP curve for all players; modes may normalize temporarily but never create separate saved HP/MP systems |
| Kid XP/Diamond sources | Kids never receive Character XP or Diamonds from game actions; only learning apps / guardian-approved learning events |

## 9. Tracking notes from discussion

- User wants the current Kingdom at the center, with every new game circling outside it.
- User wants a unified command center in Circle HQ: scalable, trackable, editable, and insight-driven.
- User wants the economy to be skin/cosmetic-first: Diamonds buy skins, not power.
- User wants a single HP/MP system and shared XP bracket across all players and games.
- User wants adult/kid rules preserved: kids never get Diamonds or Character XP from game actions; they get those from learning apps / guardian-approved learning events.
- User wants a simple SimCity-like layer.
- User wants to focus on retention wedges before building.
- Current preferred wedge: Kingdom center + simple city builder + tower defense + reusable resource command model.

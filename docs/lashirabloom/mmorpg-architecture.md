# LashiraBloom — MMORPG Systems Architecture (concept, no build)

Status: **CONCEPT for review — nothing built from this doc.** Dated 2026-07-07.

This is the **runtime / systems** companion to the two existing docs:
- [`buildplan.md`](./buildplan.md) — strategy, phases, reuse map, economy (the *why* + *when*).
- [`../LASHIRABLOOM-GAMEPLAY-CONCEPT.md`](../LASHIRABLOOM-GAMEPLAY-CONCEPT.md) — the farm loop in detail.

Where those describe *what to build and in what order*, this describes **the abstractions that let one engine host many mechanics** — Rooms, Mechanic modules, the authority/netcode tiers, per-mechanic data + sync, and the clean-IP art pipeline. It reflects the code that **actually ships today**, not the pre-build plan.

> Scope note: this covers the mechanics the owner listed — **mining, farm, livestock/husbandry+shipping, PvP, PvE, town hall + character expressions, house upgrade, original pixel assets, dungeon system** — and how each plugs into the shared Arganta spine and stays synced with Kingdom / Kingdom Heroes.

---

## 0. The one-sentence thesis

> **LashiraBloom is not a game; it is a *set of Rooms and Mechanic modules* rendered by the Kingdom Heroes engine, sharded per circle, over a shared identity/combat/economy spine. "Becoming an MMORPG" = adding Rooms and modules, plus exactly one new netcode tier (server-adjudicated), not a rewrite.**

Everything below is the shape of that sentence.

---

## 1. What already exists (the proto-MMO we build on)

Confirmed from shipped code — this is the substrate, not a wishlist:

| Capability | Where | Reuse as |
|---|---|---|
| Canvas-2D game loop, tile-step move, camera-follow | `game/FarmRoom.jsx` | The **Room runtime** (generalize to N rooms) |
| Baked terrain canvas + per-frame actors | `game/farm-map.js` `buildFarmMap()` | Per-Room **terrain build** |
| Shared avatar = your Kingdom Heroes character | `engine/compositor.js` + `heroSpec` | **Identity spine** (unchanged everywhere) |
| Shared combat rules | `@arganta/combat` (`resolveMelee/resolveSkill/makeMonster/tickMonsterState`) | **Both PvE and PvP** run on this |
| Arena = a walled zone that flips `combat.on` | `FarmRoom.jsx` `stepBattle`, `farm-map.js` `ARENA` | The **portal/mode-switch** pattern, generalized |
| 3-tier art fallback (DB override ▸ bundled ▸ procedural) | `farm-art-runtime.js`, `farm-art-bundled.js` | The **art pipeline sink** |
| Named art-slot registry w/ status | `data/farm-art.js` | The **asset manifest** (drives generation) |
| Circle-sharded realtime: presence, granular intents, rev snapshots, host election, session-singleton | `farm-presence.js`, `farm-session.js`, `farm-logic.js` | The **netcode spine** |
| Renderer-agnostic mechanic w/ `tapAt` + intents | `farm-logic.js` | The **Mechanic module template** |

**Key insight:** the farm is *already* a circle-sharded, presence-synced, shared-combat, shared-avatar world. Four of the five hard MMO problems (identity, world sync, combat rules, art delivery) are solved. The expansion is mostly **generalization + one new authority tier.**

---

## 2. Layer cake (where every mechanic lives)

```
┌─────────────────────────────────────────────────────────────┐
│  MECHANIC MODULES  farm · mining · husbandry · house ·       │  ← content, per-Room
│                    social(townhall) · dungeon · pvp · pve    │
├─────────────────────────────────────────────────────────────┤
│  ROOM RUNTIME      terrain build · collision · actor sim ·   │  ← one engine
│                    camera · input · portals · draw order     │
├─────────────────────────────────────────────────────────────┤
│  SHARED SPINE      avatar compositor · @arganta/combat ·     │  ← one source, all surfaces
│                    Kins · mounts · progression(level/xp)     │
├─────────────────────────────────────────────────────────────┤
│  NETCODE           presence · intents · snapshots · host-    │  ← 4 authority tiers (§5)
│                    election · session-singleton · RPCs       │
├─────────────────────────────────────────────────────────────┤
│  DATA (Supabase)   profiles/hero (read) · circle shard state │  ← circle = shard
│                    · append-only ledgers · pixel_art         │
└─────────────────────────────────────────────────────────────┘
```

A "mechanic" only ever touches the top two layers. It never re-implements netcode or identity — it *declares* what to sync and *calls* the spine.

---

## 3. The Room / Scene system (generalize `FarmRoom`)

Today there is one hardcoded room. The MMORPG needs a **Room registry** so Farm, Town, Mining, City, and Dungeon-instances are data + a module set, not new engine code (the buildplan's "one `<Map>` component" idea, made concrete).

```
Room = {
  id,                       // 'farm' | 'town' | 'mining' | 'dungeon:<instanceId>' ...
  kind,                     // 'persistent-shard' | 'instance'
  terrain: TerrainDef,      // tileset + layout source (baked like buildFarmMap)
  collision: BlockedSet,    // built alongside terrain
  modules: MechanicModule[],// which mechanics are active here (farm+husbandry; or mining+pve; ...)
  portals: Portal[],        // edge/door transitions to other rooms
  presenceTopic,            // channel name (see §5 sharding)
}
```

- **The runtime is room-agnostic:** loop, movement, camera, input, actor interpolation, and the presence wiring all move out of `FarmRoom.jsx` into a `RoomRuntime` that takes a `Room`. `FarmRoom` becomes `Room({room:farmRoom})`.
- **Portals** generalize the arena gate. A Portal is `{fromRect, toRoomId, toSpawn}`. Stepping onto it (or through a door) unloads the current Room's modules + presence and loads the target's. Same trick `inArena()` already does for combat mode — just promoted to a first-class transition.
- **Persistent-shard rooms** (farm, town, mining) live on a per-circle topic and hold saved state. **Instance rooms** (a dungeon run) are ephemeral, seeded, and party-scoped (§5.4).

**Why this matters:** adding "the Mines" becomes *a TerrainDef + a MiningModule + two portals*. Zero changes to movement, camera, sync, or avatar.

---

## 4. The Mechanic Module interface (formalize `FarmLogic`)

`farm-logic.js` is already a renderer-agnostic module — it just isn't named as a reusable contract. Formalize it so mining/husbandry/house/social/dungeon are siblings, not forks:

```
MechanicModule = {
  id,                                  // 'farm', 'mining', ...
  stateSchema,                         // shape of this module's slice of room state
  init(roomCtx),                       // hydrate from save/cloud
  tick(now, roomCtx),                  // per-frame logic (timestamp-derived where possible)
  interact(tile, roomCtx) -> Intent?,  // the contextual tap (farm's tapAt, mine's dig, npc's talk)
  render(ctx, roomCtx, now),           // draw this module's layer (crops, ore, npc bubbles)
  applyIntent(intent),                 // peer change → local state (per-field, never re-emitted)
  serialize() / hydrate(snap),         // for rev-gated snapshots
  authority,                           // declares tier per state key (§5) — the important part
}
```

Rules that keep it MMO-safe (already true for farm, made universal):
1. **Prefer timestamp-derived state.** Growth, ore respawn, animal produce = `f(now − t0)`, computed identically on every client. No per-tick streaming, no drift. (Farm crops already do this.)
2. **Every mutation is a small intent**, fanned out by the existing channel. Never broadcast whole state on a timer.
3. **Anything that mints value is server-adjudicated** (§5.3), never client-authoritative.

---

## 5. Authority & netcode — the four tiers (the core design)

The single most important architectural decision for an MMORPG is *who is allowed to decide what*. LashiraBloom already runs **three** tiers; the MMO scope adds exactly **one** more.

### 5.1 Timestamp-derived (client-computed, zero authority needed)
Deterministic functions of elapsed time + a synced start stamp. **Crops, hydration, animal produce-ready, ore-node respawn, house-build completion timers.** Every client computes the same answer; sync only carries the *start* intent (`plant{plantedAt}`, `feed{fedAt}`, `dig{minedAt}`). *This is the default — reach for it first.*

### 5.2 Simulated (one owner runs it, broadcasts positions)
- **Host-simulated** (elected peer, lowest id): shared wandering NPCs — farm animals today; town NPCs, roaming PvE mobs in a *shared* room tomorrow.
- **Owner-simulated** (each client runs its own): your Kins, your mount. Broadcast with an owner tag. (Exists.)

Movement/positions ride presence; they're *cosmetic-ish* (a desync just means a mob looks 1 tile off, self-heals next broadcast). Fine for anything that doesn't mint value.

### 5.3 **Server-adjudicated (NEW — required for the MMO)**
The one new tier. A **Postgres RPC / edge function is the referee** for anything that (a) mints or moves value, or (b) is contestable between players. Append-only ledgers, never client writes. This is the buildplan's "bloom_grant has no path to diamonds" + "crop growth is a Postgres function" principle, extended to every value event:

| Event | Referee RPC | Writes to |
|---|---|---|
| Sell produce / ship goods → currency | `bloom_grant(farm, delta, reason)` | `bloom_ledger` (append-only) |
| Ore mined → inventory | `mining_claim(node_id, tool_tier)` | `inventory_ledger` + validates node cooldown server-side |
| Dungeon loot roll | `dungeon_loot(run_id, floor, seed)` | server rolls (seeded), writes drops — client never rolls |
| **PvP match result** | `pvp_report(match_id, result_token)` | `pvp_match` + `pvp_ranking` (see §8) |
| House upgrade purchase | `house_upgrade(farm, tier)` | debits `bloom_ledger`, sets `farm.house_stage` |

**Nothing that affects economy, ranking, or loot is trusted from the client.** The client *requests*; the server *decides + records*. This closes the authority gap the buildplan flagged as open.

### 5.4 Sharding & instancing
- **Shard = circle.** Persistent rooms (farm/town/mining) use topic `room:<roomId>:<circleId>`. Your family/class is your world. (Farm already does exactly this with `farm:<circleId>`.) This is *perfect* for an educational MMO — small, known, safe cohorts — and I recommend keeping it rather than a global world.
- **Instance = party.** A dungeon run mints an `instance_id` (+ seed + member list) on entry; topic `room:dungeon:<instanceId>`. Ephemeral, GC'd when empty. This is how you get co-op dungeons without a global server.
- **Cross-shard is deliberately absent** for v1 (no random strangers). PvP is *opt-in matched* (§8), the only place two circles' players interact.

```
Presence topics
  room:farm:<circleId>        persistent, per family/class
  room:town:<circleId>        persistent  (or a shared 'town:global' if you want a bigger hub — decision D3)
  room:mining:<circleId>      persistent
  room:dungeon:<instanceId>   ephemeral, per party
  pvp:<matchId>               ephemeral, 1v1 duel channel
```

---

## 6. Kingdom ⇄ LashiraBloom sync (the explicit ask)

Three relationships, kept clean by **direction + ownership**:

### 6.1 SHARED — one source of truth, imported by both (no copy, no sync)
Factor into shared packages so polish flows both ways:
- `@arganta/combat` — already shared. PvE + PvP both consume it. ✅
- **Avatar compositor** (`engine/compositor.js` + palettes + data) — currently *copied* from Kingdom. **Extract to `@arganta/avatar`** so a Kingdom rig fix reaches Lashira automatically.
- **nipplejs controls** — extract to `@arganta/controls` (buildplan §6 action).
- **Kin definitions** and **mount resources** — shared data package.
- **Progression math** (`level = 1 + floor(xp/500)`, stat policy, the adult-play/kid-learn XP rule) — this lives in Kingdom SQL today; treat those RPCs as the shared progression service both games call. *Never* re-derive the level formula in a second place (it's currently duplicated as a string in `command/data.js` — that's a doc, not a source).

### 6.2 MIRRORED — Kingdom is source, Lashira reads live
The **character** is owned by Kingdom Heroes; Lashira reads it and never writes it:
```
kingdom_get_player_state() → heroSpec → loadPlayerResources() → compositor
```
Appearance, equipment, class, level, owned mount, owned Kins = **read-only mirror**. This is why "the farmer is your hero" works with zero copy. Character progression earned in Lashira (combat XP, mining) is written *through Kingdom's XP RPCs* (capped, adult-only), so there's one XP truth.

### 6.3 SEPARATE — each surface owns its world
Farm plots, mining depth, house tier, dungeon progress, Bloom purse, PvP ranking = **Lashira-owned**, circle-scoped, never touch Kingdom tables. A Kingdom player with no farm simply has no `farm` row.

```
        KINGDOM HEROES                     LASHIRABLOOM
        ┌──────────────┐  reads (live)  ┌──────────────────┐
        │ character =   │ ─────────────► │ farmer avatar     │
        │ SOURCE OF     │                │ (mirror, RO)      │
        │ TRUTH         │ ◄───────────── │ XP earned in farm │
        └──────────────┘  via capped RPC │ (written to KH)   │
              │                          └──────────────────┘
        shared packages (combat/avatar/controls/kins/progression)
              └──────────── imported by both ───────────────┘
```

---

## 7. Per-mechanic architecture (each = a module + optional Room)

Each mechanic is specified as: **Room**, **authority tier(s)**, **key state**, **reuse**.

### 7.1 Farm — `FarmModule` (exists; formalize)
Room `farm` (persistent-shard). Timestamp-derived crops/hydration; server-adjudicated sell. Reuse: as-is; wrap `farm-logic.js` in the module interface.

### 7.2 Livestock / husbandry + shipping — `HusbandryModule` + `ShippingModule`
> *Assumption: "cow ships" = livestock **husbandry** + the **shipping/economy** pipeline (feed → produce → collect → ship → currency). If you meant something else (cows + sheep? co-ownership?), one word and I'll re-scope — flagged in Open Decisions.*

Room `farm` (shares it). **Husbandry:** feed/pet/collect (timestamp-derived produce-ready, per gameplay-concept §5). **Shipping:** the shipping bin is a *server-adjudicated sink* — dropping goods calls `bloom_grant`; sells resolve on the server so quantities/prices can't be forged. Breeding/affection = extra state keys. Reuse: animal actors + pens exist; add the produce timers + ship RPC.

### 7.3 Mining — `MiningModule`, Room `mining` (Emberdeep)
- Terrain = a grid of **rock/ore nodes** (a TerrainDef with node metadata). Tap a node = **dig** (costs stamina; contextual `interact` exactly like `tapAt`).
- Node depletion + respawn = **timestamp-derived** (`minedAt` + cooldown).
- **Descent tiers:** deeper = rarer ore + **PvE encounters** (reuse `@arganta/combat`, spawn like the arena does).
- Ore → inventory is **server-adjudicated** (`mining_claim` validates the node's cooldown + your tool tier). Ore → currency via shipping/smelting RPC.
- Multiplayer: per-circle shared mine (host-sim mobs) *or* per-player instance — **decision D2**.
- Reuse: tile-tap (farm), monster spawn/AI (arena), ledger (economy). ~90% existing patterns.

### 7.4 PvE battle — `CombatModule` (exists in arena; generalize)
Already shipped as the walled arena. Generalize: any Room can include `CombatModule` (mining depths, dungeon floors). Monsters host-simulated in shared rooms, locally-simulated in solo instances; **loot server-rolled** (§5.3). Skills spend stamina (exists). Reuse: `@arganta/combat` verbatim.

### 7.5 PvP battle — `PvpModule` (new; server-adjudicated)
The one mechanic that *cannot* be host-authoritative (a player can't referee a fight they're in). Design:
```
challenge → server mints match_id + seed + snapshots both heroSpecs (pvp_start RPC)
         → both clients load into pvp:<matchId> instance, run the SAME @arganta/combat
            sim deterministically from the shared seed (lockstep-ish; inputs exchanged as intents)
         → each reports result; server cross-checks the two reports + a result_token
            derived from the deterministic sim (pvp_report RPC)
         → server writes pvp_match + updates pvp_ranking
```
- **Ranking = a season ladder.** Reuse the **rank-season-tuning** rule (memory): season-long marathon, **daily cap + rising curve**, never flat/uncapped. Rating lives in `pvp_ranking` (server-only writes).
- **Anti-cheat:** determinism + dual-report + server token. Mismatch → match voided, logged. No client writes the ladder.
- Reuse: combat rules, avatar, the instance/portal + presence machinery.

### 7.6 Town Hall + character expressions — `SocialModule`, Room `town` (Bloomridge)
- Room `town` (persistent; shard or a bigger shared hub — **decision D3**). Modules: NPC vendors/dialogue, quest/notice board, friendship, presence of real circle members (exists).
- **Character expression system** (the specific ask) has two parts:
  1. **Player emotes** — an overhead bubble/emote sprite layer on any avatar (wave, happy, sad, ❤). Cheap: a small sprite atlas + an `emote{kind}` intent so peers see it. No compositor change.
  2. **NPC (and player) portraits with expressions** — bust portraits with mood variants (neutral/happy/surprised/…) shown in the dialogue box, Stardew-style. **This is a native PixelLab job:** `create_portrait_character` turns a character sprite into a bust portrait; generate a mood set per NPC. Data: `npc.portrait_atlas` + `dialogue` rows tagged with an expression key.
- Reuse: presence (real members already visible), the panel UI system (`Panels.jsx`), the art pipeline.

### 7.7 House upgrade — `HouseModule`
- **Tiered building art:** the house slot becomes `lashira.building.house.t1|t2|t3` (registry already has the slot; add tiers). Upgrading = swap the sprite + expand the building's collision footprint.
- **Interior as a Room:** entering the door portals to `room:house:<circleId>` (a small persistent interior). Higher tiers unlock more interior (storage, kitchen, trophy wall) — literally larger TerrainDefs.
- **Storage** = a state capacity number gating inventory.
- Purchase is **server-adjudicated** (`house_upgrade` debits Bloom, validates prereqs/rings-gate). Reuse: portal system, building art slot, ledger. (Buildplan already frames the house as Shack→Cottage→Farmhouse→Homestead.)

### 7.8 Dungeon system — `DungeonModule`, Room `dungeon:<instanceId>` (instance)
- **Instanced** (§5.4): entering the Hollow Gate mints `instance_id` + seed + party (co-op with circle members). Floors are **procedurally generated from the seed** (same seed = same layout for all party members, computed client-side — a timestamp/seed-derived terrain).
- **PvE waves + boss** via `CombatModule`; boss can be a **Keeper** (reuse KinQuest's 8 regions/Keepers for portal themes — buildplan §7.5).
- **Loot server-rolled** (`dungeon_loot`), gated by rings for content unlock.
- Reuse: instancing, combat, portals, the seeded-generation trick (same idea as timestamp-derived state, but seed-derived).

---

## 8. Data model (Supabase) — circle-sharded, ledger-backed

Extends `001_lashira_core.sql`. **Everything player-mutable is either circle-scoped state or an append-only ledger; RPCs are the only writers of value.**

```
-- READ-ONLY mirrors (owned by platform/Kingdom)
profiles, circles, kingdom_character_appearance, person_creatures   -- Lashira reads, never writes

-- circle-shard world state (one row-set per circle)
farm(circle_id, house_stage, barn_level, coop_level, bloom_balance)
farm_plot(farm_id, room_id, x, y, crop_id, planted_at, ...)         -- room_id generalizes to any room
livestock(farm_id, species, name, affection, fed_at, produce_ready_at)
mining_node(circle_id, depth, x, y, ore_id, mined_at)               -- respawn = mined_at + cooldown
house_interior(circle_id, tier, storage_cap)
kin_assignment(person_creature_id, farm_id, task)

-- append-only ledgers (RPC-only writers; the anti-dupe/anti-cheat spine)
bloom_ledger(farm_id, delta, reason, by_profile_id, at)
inventory_ledger(circle_id, item_id, delta, reason, at)

-- contested / value events (server-adjudicated)
pvp_match(id, a_profile, b_profile, seed, result, season, at)
pvp_ranking(profile_id, season, rating, wins, losses, daily_awarded) -- rank-season-tuning caps
dungeon_run(instance_id, circle_id, seed, floor, members_json, loot_json)

-- assets
lashira_pixel_art(slot_key, image_data, status)                     -- EXISTS; the art sink
```
RLS: read = any authed circle member; write = RPC / `is_admin()` only. Same posture the sync handoff verified for `lashira_pixel_art`.

---

## 9. Original pixel-art pipeline (clean-IP, registry-driven)

The art system is **already the right shape** (3-tier fallback + named-slot registry). The pipeline is an *ops process* over it, not new engine code — and it's how we get Lashira its own IP.

**Principle:** every shippable pixel is **generated original** via PixelLab. Kingdom / NexusTK art is used only as an in-house *style reference image* fed to PixelLab (style-match), **never sliced and shipped**. Output lands in a named slot; the registry tracks status.

**Slot → PixelLab tool mapping:**
| Asset class | PixelLab tool | Notes |
|---|---|---|
| Terrain (grass↔soil, grass↔path, cave floor) | `create_topdown_tileset` (Wang) | Seamless autotiles — solves the *known* terrain-seam gap (`farm-art-bundled.js:21`) |
| Ground variants (flower grass, pebbles) | `create_tiles_pro` | Numbered multi-tile |
| Props (troughs, ore rocks, signs, hay) | `create_map_object` | Style-ref the map for palette lock |
| Animals & NPCs (walk facings) | `create_character` + `animate_character` | Sheet has one pose; real facings need generation |
| **NPC/player portraits + expressions** | `create_portrait_character` | Town-hall dialogue busts, mood sets (§7.6) |
| UI panels (shop, dialogue frame) | `create_ui_asset` | Match the Kingdom action-cluster family |
| Pixel font | `create_font` | Optional, brand consistency |

**Process:** registry row (`data/farm-art.js`, extended per mechanic) → PixelLab job (locked recipe: high top-down, detailed shading, style-ref) → PNG → upsert `lashira_pixel_art` (status `active`) or bundle in `public/farm-art/` → `drawOverride` picks it up, procedural fallback stays as the safety net. **Order:** terrain first (defines the look), then props, animals, buildings, portraits, crops (per the art handoff).

**Registry becomes the manifest for generation** — Bloom Command's "PixelLab asset status" section reads it, so you can see every slot's coverage (today: Tiles 4/20 — the worst-covered class, and exactly what the Wang tilesets fix).

---

## 10. What's genuinely new vs. reused (effort honesty)

| Mechanic | New code | Reused |
|---|---|---|
| Room/portal system | Room registry + `RoomRuntime` extraction | 100% of loop/move/camera/sync |
| Farm | — | all |
| Husbandry + shipping | produce timers, ship RPC | animals, pens, ledger |
| Mining | node terrain, dig, `mining_claim` RPC | tile-tap, combat, ledger |
| PvE | — (generalize) | arena/combat verbatim |
| **PvP** | **the server-adjudication tier + ranking** | combat, avatar, instancing |
| Town hall | NPC/dialogue/quest modules | presence, panels |
| Expressions | emote layer + portrait generation | avatar, art pipeline |
| House upgrade | tier art + interior room + `house_upgrade` RPC | portals, building slot, ledger |
| Dungeon | seeded gen + instancing + loot RPC | combat, portals |
| Original art | (ops, not engine) | the whole art seam |

**The load-bearing new thing is §5.3 — the server-adjudicated tier.** Build that RPC/ledger discipline once and every value-minting mechanic (mining, shipping, PvP, loot, house) inherits it. Everything else is generalization of patterns already in the repo.

---

## 11. Suggested concept-phase sequencing (build later, in this order)

Each is independently valuable and preview-verifiable (per the sync handoff's one-change-per-phase rule):

0. **Extract shared packages** (`@arganta/avatar`, `@arganta/controls`) + formalize the **Mechanic module** + **Room** interfaces around the *existing* farm (pure refactor, no new mechanic). Unlocks everything.
1. **Server-adjudication tier**: `bloom_ledger` + `bloom_grant` RPC; move farm selling behind it. (The anti-cheat spine; small, isolated.)
2. **Original terrain art** via Wang tilesets (the visible win; the gap the code already flags).
3. **House upgrade** (portals + interior room + tier art) — exercises the Room system cheaply.
4. **Mining Room** (first brand-new Room; reuses tile-tap + combat + ledger).
5. **Town Hall + expressions** (SocialModule + portrait generation).
6. **Dungeon instancing** (seeded gen + party + loot RPC).
7. **PvP** (the hardest netcode; do last, on the mature adjudication tier + ranking).

---

## 12. Open decisions (need owner calls before any build)

- **D1 — "cow ships" meaning.** Assumed = livestock husbandry + shipping/economy. Confirm or re-scope.
- **D2 — mine multiplayer.** Per-circle *shared* mine (see each other dig) or per-player *instance*? (Shared is more social; instance avoids node contention.)
- **D3 — town scope.** Town as a per-circle shard (consistent with farm) or a bigger shared hub across circles (more "MMO," but mixes cohorts)? Recommend per-circle for v1 given the kid-safety posture.
- **D4 — PvP audience & stakes.** Adults only, or kids too? Cosmetic-only stakes vs. a visible ladder? (Ties to the XP/economy walls — PvP must not mint diamonds.)
- **D5 — dungeon party size** and whether cross-circle parties are allowed (recommend circle-only for v1).
- **D6 — art IP confirmation.** Confirm Kingdom source art's real license before treating it as reference-only vs. reusable (see the copyright note; NexusTK-derived pixels shouldn't ship).

---

*End. Concept only — nothing built. Companion to `buildplan.md` (strategy) and `LASHIRABLOOM-GAMEPLAY-CONCEPT.md` (farm loop).*

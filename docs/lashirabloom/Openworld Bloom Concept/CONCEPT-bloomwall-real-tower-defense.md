# Bloomwall Pass — Real Tower Defense (v2)

Status: v1, v1.1, and v1.3 (free placement) built and playtested (verified in-browser with real screenshots). **v1.4 scale/lines/animation/controller/fan-out pass is concept only, no build yet**. Created 2026-07-10, revised same day (real bestiary enemies, class-based waves, boss-last, endless mode promoted to core, walking melee), revised again same day (real pixel-art towers, per-tower SFX, single-lane redesign, all built and verified), revised again same day (camera scale fix, traveling projectiles, fan-out tower picker — concept only, superseded/expanded below), revised again same day (free placement replaced the fixed 8-pad system entirely — built and verified), revised again same day (character/tower/monster scale fix, remove drawn lane lines, animation library pick, real PVP/PVE ActionCluster reuse, fan-out extended to existing towers — concept only, triggered by a real screenshot of the live PVP/PVE controller).

Companion ground truth: `INDEX.md`, `parallel-game-realm-matrix.md`, `openworld-stronghold-command-architecture.md`, `roadmap-and-build-plan.md` §"Phase 2 — First playable pillar: Bloomwall Pass".

Scope decision (confirmed): full depth in one pass, hero skill wired to the real Character/Skill Forge equip, real bestiary creatures for enemies (art already exists, currently unused in combat), endless mode built as a core mode alongside the campaign — not a stretch goal, and the hero can now damage enemies just by walking into them, not only via the skill button.

## 0. Build status (v1, already shipped)

`bloomwall.js` was rewritten per this doc's original scope (§§1-4 below) and playtested headlessly through wave 8. One real bug was found and fixed during that pass: `startWave()` used to wipe every placed tower the moment Start was pressed (inherited from the original MVP) — fixed so towers placed during prep now survive into wave 1. Tower/enemy/wave numbers were retuned once after the first playtest run showed the campaign was unwinnable even with full tower+skill+melee effort.

**Known issue from the first real in-game screenshot (not caught by headless testing): the lane self-crosses and looks like a tangled loop, not a road.** Root cause and fix are in §5.

## 0.1 v1.1 scope (built and verified)

1. **Lane redesign** — fixed the self-crossing geometry (§5). Traced from the real basemap art, verified in-browser.
2. **Real pixel-art tower sprites** via PixelLab, replacing the emoji-in-badge pads (§6). Built, 8 assets vendored.
3. **Per-tower "pew" sound effects** via the existing synthesized `sfx.js` system, no new asset files (§7). Built.

## 0.2 v1.2 scope (this revision, concept only — triggered by a real in-game screenshot)

A real screenshot after v1.1 shipped surfaced three problems the headless playtesting couldn't catch:

1. **Everything reads too small** — towers and monsters are barely legible. Root cause is a shared camera setting, not a Bloomwall bug (§8).
2. **The pre-painted decorative turret bases are being removed from the basemap art** (the user is editing the art directly) — Bloomwall's tower rendering needs to stop assuming that art exists underneath it (§9).
3. **Tower shots don't actually travel** — they're a hit-marker flash at the target, not a bolt/beam crossing the distance from tower to monster (§10).
4. **Tower selection needs to happen at the pad** — tap an empty pad, get a fan-out of the 4 tower choices right there, instead of pre-selecting a tool from the bottom-right ring first (§11).

## 0.3 v1.3 scope (built and verified — supersedes the fixed-pad system)

Before §11's fan-out could even matter, the pad model itself changed: **the fixed 8-pad list is gone.** Any tile far enough from the lane, inside the map's walkable bounds, and not already occupied is now a legal build spot — "banish the tab, map every grid tile as a pad." Built and verified live: on-path taps correctly rejected, fan-out opens on any valid empty tile, tapping a placed tower cycles its targeting mode, multiple towers built across scattered tiles all fire/upgrade correctly, full wave runs pass with no errors. The bottom-right ring dropped its 4 direct-placement buttons (Sentry/Bramble/Frostbud/Sunspire) down to just Upgrade + Exit, since placement now happens exclusively through the fan-out.

## 0.4 v1.4 scope (this revision, concept only — triggered by a real screenshot of the live PVP/PVE controller)

The user shared a real screenshot of Bloomwall in play plus a screenshot of the actual PVP/PVE combat action-cluster (numbered skill-slot badges, pie-wipe cooldowns, emote/mount side-orbs). That surfaced five more things:

1. **The character reads too small** — same root cause as §8 (shared camera), but now explicitly about the hero sprite too, not just towers/monsters. Fix is still the camera zoom, scaling all three together (§12).
2. **Remove the drawn lane lines** — the user will paint the path directly into the basemap art and use that as the visual reference; `PATH` stays as pure invisible logic (enemy movement + build-distance checks), nothing gets stroked on canvas anymore (§13).
3. **A real animation library for tower shots**, instead of hand-rolled interpolation (§14).
4. **Reuse the real PVP/PVE `ActionCluster`** instead of `RealmShell`'s own simplified recreation of the same CSS system (§15).
5. **Push Upgrade (and targeting) into the fan-out too** — tapping an existing tower should offer Upgrade + the 3 targeting modes as direct picks, not a blind tap-to-cycle (§16).

---

## 1. What exists today

`apps/lashira/web/src/game/realms/bloomwall.js` is a real, wired MVP, not a placeholder:

- One fixed 5-point path, one Bloom Core with HP.
- 4 pads, **one** tower type, upgrade is a flat `lvl++` (no roles, no targeting choice).
- One fictional enemy type (👾 emoji), HP scales only by `26 + stage*8 + wave*6` — not connected to LashiraBloom's real creatures.
- 3 fixed waves, then loops back to wave 1 forever. No endless mode.
- Hardcoded hero "blast" (28 dmg, 2.6 tile radius, 12s cooldown) — not connected to the player's actual equipped skill, and the hero does nothing by simply walking near an enemy.
- Rewards already flow through `api.grant` into the shared economy (bloom/stone/ore/score), kid-safe (no XP/Diamonds from waves).

This is the wedge the roadmap doc asked for. The gap to "10 waves, 4 tower types" (roadmap §Phase 2) and to a real Kingdom Rush–tier loop is what this doc scopes.

### 1.1 The real creature roster (confirmed from code)

`packages/combat/src/bestiary.js` already defines LashiraBloom's actual monsters — this is what Bloomwall should walk down the lane, not invented enemies:

| Kind | Zone (tier) | HP | ATK | Notes |
|---|---|---|---|---|
| Squirrel | Meadow (easiest) | low | low | fast, low HP |
| Fox | Meadow (easiest) | low-mid | low-mid | baseline |
| Badger | Grove (mid) | mid | mid | tougher |
| Boar | Grove (mid) | mid-high | high | hard-hitting charger |
| Deer | Cavern (hardest) | high | mid | fast, high HP |
| Tiger | **Boss** | 18000 | 280 | `boss: true`, already rendered at 3.4x scale with a gold nameplate in `FarmRoom.jsx` |

`ZONE_MOBS` in `bestiary.js` already groups these by zone (meadow → grove → cavern, "easiest → hardest"), and Tiger is already the game's one confirmed boss. This zone grouping *is* the "monster class" the wave structure should follow — no new taxonomy needs inventing.

Real sprite art already exists for all six kinds via `apps/lashira/web/src/game/creature-sprites.js` (`KINDS`/`WALK` sets, fox/squirrel/badger/boar/deer/tiger folders). Today that art is only used for roaming livestock (`drawAnimalSprite` in `farm-map.js:594`); in combat (`FarmRoom.jsx`) these same monsters currently render as **colored placeholder blobs**, tagged in-code as "placeholder until the PixelLab sheets land." Bloomwall reusing the real sprite art for its walking enemies costs no new asset generation and would make Bloomwall the *first* place these creatures render as their real selves in combat.

Bestiary entries have `hp`/`atk`/`speedMs`/`drops`, but no armor/resist/damage-type fields — those don't exist anywhere in the shared combat package for monsters. See §2.2 for how Bloomwall adds a local overlay without touching shared bestiary balance.

## 2. What changes

### 2.1 Towers — roles, not just levels

| Tower | Icon | Role | Damage type | Tier 2 behavior change |
|---|---|---|---|---|
| Sentry | 🗼 | single-target, fast fire | physical | +range, +fire rate |
| Bramble | 🌿 | AoE splash | physical | adds burn-over-time |
| Frostbud | ❄️ | slow/chill | magic | tier 2 roots briefly instead of just slowing |
| Sunspire | ✨ | armor-piercing bolt | magic | ignores remaining armor entirely |

Each pad can hold any tower type (player chooses on placement, not fixed per pad). Per-tower targeting toggle: first / strongest / nearest — this is the lever that makes placement decisions matter instead of "fill every pad." Tower icons stay emoji/UI-icon based (unchanged) — only the walking enemies switch to real sprite art.

### 2.2 Enemies — the real bestiary, rendered as real sprites, with a TD-local resist overlay

Bloomwall spawns actual `monsterOf(kind)` entries from `packages/combat/src/bestiary.js` (same `hp`/`atk`/`speedMs` the rest of the game already uses, scaled per wave), drawn with the existing `creature-sprites.js` art instead of an emoji blob.

Since the shared bestiary has no armor/resist/damage-type fields, Bloomwall adds a **small, local, TD-only overlay table** keyed by `kind` — it does not mutate `bestiary.js` or affect farm/PvP combat balance:

| Kind | Zone/tier | TD role | TD resist overlay | Countered by |
|---|---|---|---|---|
| Squirrel | Meadow | fast, low HP | none | Bramble (AoE catches groups of fast movers) |
| Fox | Meadow | baseline | none | anything |
| Badger | Grove | armored bruiser | high phys resist | Sunspire, Frostbud |
| Boar | Grove | charger, ignores slow briefly on trigger | resists Frostbud's control | Sentry, Sunspire |
| Deer | Cavern | fast, high HP | none | sustained single-target (Sentry) + Bramble to catch groups |
| Tiger | Boss | huge HP/ATK, telegraphed core-hit attack | flat 30% both, phases at 50% HP | needs sustained multi-tower focus, not any one counter |

### 2.3 Waves — grouped by real monster zone/class, boss always last

Wave composition follows the bestiary's own zone tiers instead of an arbitrary curve:

| Wave block | Waves | Monster pool | Why |
|---|---|---|---|
| Block 1 — Meadow | 1–3 | Squirrel, Fox | matches "easiest" zone tier |
| Block 2 — Grove | 4–6 | Badger, Boar (+ meadow stragglers mixed in for pressure) | matches "mid" tier |
| Block 3 — Cavern | 7–9 | Deer (+ grove mixed in) | matches "hardest" tier |
| Finale | 10 | **Tiger** (boss, solo spawn, telegraphed core attack, phase at 50% HP) | boss is always the last wave of a campaign run, never mid-run |

Per-wave enemy mix stays a data table (`[{kind, count, delayMs}]`), not code, so HQ tuning can rearrange the mix later without touching runtime logic. Spawn intervals tighten within each block; each block transition is a short "wave cleared" breather.

### 2.4 Endless mode — built now, as a core mode

Not a stretch goal: Endless ships in the same pass as the campaign.

- Unlocks the moment the 10-wave campaign (through Tiger) is cleared once.
- Loops Meadow → Grove → Cavern → Boss cycles indefinitely, each full cycle scaling HP/ATK/spawn-density up (reuses the same per-wave data table, extrapolated with a per-cycle multiplier — no separate content to author).
- Boss reappears at the end of every cycle (Tiger, scaled), not just once — this is what makes Endless a real mode instead of "campaign plus a score counter."
- Endless run ends on core-death; final score/wave-reached feeds `api.grant` score same as today, positioning it for a later leaderboard without needing new plumbing now.

### 2.5 Hero participation — real skill *and* real walking melee

Two separate hero actions, not one:

1. **Skill button** (unchanged shape): `primary` action during a wave reads the player's actual equipped skill (name/fx/damage from `SKILL_MATRIX` via the shared combat package) instead of the fixed 28-dmg AOE. Falls back to the hardcoded blast only if no skill is equipped/published yet.
2. **New: walking melee.** The hero now deals light contact damage to any enemy it walks into/adjacent to on the lane — no button press, no cooldown gate beyond a short per-target hit interval (prevents multi-hit-per-frame melting). This makes physically moving into the enemy line a real, constant participation option, not just a periodic skill press — matches how the player already walks around the farm/kingdom map, just now that movement matters mid-wave too.

### 2.6 Map

Stays a single lane for v1 (matches the roadmap's own recommendation), but add one branch-and-merge split so tower placement — and the hero's melee positioning — has real tradeoffs instead of one obvious choke point. The cave/ruin entrance already in the basemap art prompt is reserved as a hook for a later boss/adventure submode — not built this pass.

### 2.7 Meta-progression

- Stars per wave-clear based on core HP remaining (1–3 stars), campaign mode only.
- Blueprints stay the wave-victory currency (already defined in the matrix doc).
- Weekly challenge: fixed tower loadout, score race, reuses the matrix doc's "weekly challenge ladder" line — later addition, not this pass.

### 2.8 Data-driven tuning

Tower stats/tiers, the TD resist overlay, the wave/block table, and the reward curve live in one `bloomwallTuning` config object the realm module reads at runtime — mirrors the `realm_tuning` object `openworld-stronghold-command-architecture.md` assigns to World Builder, so HQ can retune without code changes once that surface exists. Enemy base `hp`/`atk`/`speedMs` still come from the shared `bestiary.js` (single source of truth for those numbers); Bloomwall only adds the TD-specific overlay on top.

## 3. What does not change

- Realm-module contract (`tick/onTapWorld/onAction/controller/hud/drawUnder/drawOver`).
- Shared four-corner HUD shell.
- `api.grant` reward path and kid-safe rule (kids get resources/score only, never Character XP/Diamonds from waves).
- `bestiary.js` itself — Bloomwall reads it, never mutates it.
- Tower/UI icon art was emoji-based in v1; **v1.1 replaces it with real PixelLab sprites — see §6.** Enemies already switched from emoji to real bestiary sprite art in v1.

## 4. Build sequence (v1 — already built, kept here for record)

1. `bloomwallTuning` config object: tower defs, TD resist overlay per bestiary kind, wave/block table, reward curve.
2. Enemy spawn switches from the fictional 👾 type to real `monsterOf(kind)` lookups + `creature-sprites.js` rendering.
3. Tower damage-type resolution against the TD resist overlay in `tick()`.
4. Tower placement UI: pick type on tap instead of one fixed tower; targeting-mode toggle.
5. Wave/block table replaces the fixed 3-wave loop; Tiger boss wired as the fixed finale wave.
6. Walking-melee contact damage on the lane, separate from the skill-button action.
7. Hero skill: read equipped skill from Skill Forge/`SKILL_MATRIX`, fallback to hardcoded blast.
8. ~~Branch-and-merge path segment on the map.~~ Superseded — see §5, this is what caused the self-crossing lane bug. Collapsed to a single lane in v1.1.
9. Stars/rating on campaign wave-clear.
10. Endless mode: cycle-looping wave/block table with per-cycle scaling multiplier, repeat scaled boss per cycle.

## 5. Lane redesign (v1.1, confirmed: single lane, no fork)

**Root cause of the self-crossing lane seen in the first real screenshot:** Branch A approached the merge point from the north, Branch B from the south, both terminating at the *identical* tile — two strokes converging head-on from opposite headings draws a visible X/loop, not a fork. Compounded by quadratic-curve smoothing overshooting on the wide, sharp-angle waypoints used for the lead-in.

**Fix (confirmed over "keep the fork, fix the geometry"):** collapse to one continuous winding lane, no fork/merge, for this pass. Guarantees no self-crossing by construction and matches proven single-lane TD conventions (Kingdom Rush): one line, gentle consistent-radius turns, constant lane width, no sharp direction reversals. The fork returns later as a *second* map once a single lane reads well — more valuable as a deliberate second layout than as a broken first one.

**Also fix:** pad tile coordinates were guessed, not read off the basemap art. The basemap (`bloomwall-pass.png`) already has ~8 pre-painted stone turret-base footprints (visible in the reference screenshot) and a painted dirt trail — the original basemap generation prompt asked for exactly that. Re-derive both the lane waypoints and the `PADS` tile coordinates from the actual painted trail/turret positions instead of arbitrary offsets, so gameplay elements land exactly on the pre-drawn art.

## 6. Tower art (v1.1, confirmed: full 8-asset pass)

Generate with PixelLab's `create_map_object`, `background_image` set to the real `bloomwall-pass.png` basemap (style-matching mode) so towers land in the same palette/lighting as the shipped art, `view: "high top-down"` to match the existing perspective. One base object per tower type, then `create_object_state` per tier-2 variant (an *edit* of the base — "add a glowing rune upgrade" — so tier 2 visually reads as an upgrade of tier 1, not a different building).

| Tower | Base description | Tier-2 edit |
|---|---|---|
| Sentry | stone watchtower with an arrow-slit, small banner | taller, glowing arrow-slit, banner upgraded |
| Bramble | thorny living-vine totem with a seed-pod core | pod glows ember-orange, extra thorns |
| Frostbud | crystalline ice spire on a mossy base | larger crystal, frost mist particles |
| Sunspire | golden sun-crystal obelisk | brighter core, radiant rays |

8 assets total (4 base + 4 tier-2 states), sized to sit in one pad footprint (~1–1.5 tiles). Replaces the emoji-in-badge pad rendering in `drawUnder`.

## 7. Sound (v1.1, confirmed: synthesized, no asset files)

`apps/lashira/web/src/audio/sfx.js` is a WebAudio-synthesized cue system (oscillator sweeps + filtered noise) — no `<audio>` tags, no files to ship or for the embed CSP to block. Realm modules currently call `sfx` zero times; Bloomwall would be the first. New entries in the existing `CUES` table, same style as the existing `hit`/`swing`/`monsterAttack` cues:

| Tower | Character | Rough synth shape |
|---|---|---|
| Sentry | sharp arrow twang | short square-wave downsweep, high→mid, ~0.08s |
| Bramble | soft thorny thump | noise burst, low-pass filtered, punchy |
| Frostbud | crystalline chime | short sine upsweep, bright, slight ring |
| Sunspire | bright energy zap | sawtooth downsweep, wide, longer tail |

Impact/kill reuses the existing `hit` cue rather than inventing a 5th sound, keeping Bloomwall's audio consistent with the rest of the game.

## 8. Scale fix (v1.2, concept)

**Root cause, confirmed by reading the code, not a Bloomwall-specific bug:** `RealmRoom.jsx`'s camera zoom is one formula shared by every realm — `zoom = Math.max(vw/WORLD_W, vh/WORLD_H, 0.42)`. At the viewport size in the real screenshot this resolves to the floor value, `0.42`. At that zoom, one 48px tile renders at ~20px on screen — small enough that a tower sprite sized at `TILE * 1.9` (my v1.1 choice) still only reads as ~38px tall. This formula is correct for the *open-world Kingdom hub* (you want to see a lot of the map while wandering), but wrong for a tower-defense battlefield, where reading tower/monster/projectile detail is the whole point.

**Fix:** give realms a way to request a tighter camera. Concretely, add an optional per-realm minimum zoom — e.g. a `camZoom` field on the realm's `world-map-registry.js` entry, consumed as `Math.max(vw/WORLD_W, vh/WORLD_H, realm.camZoom ?? 0.42)` in `RealmRoom.jsx`. Bloomwall would request something like `0.95–1.1` (roughly 2.3–2.6× tighter than the current floor), which puts a tile at ~46–53px on screen — enough for tower/monster art to actually read, and tight enough that the camera meaningfully follows the player around the lane instead of showing the whole 60×48 world at once (matches how real TD games frame the battlefield). Other realms (Kingdom hub, Kitchen, Arena) keep their current `0.42` default — this is additive, not a global change.

Once the camera is fixed, the v1.1 tower/monster size multipliers (`TILE*1.9` for towers, `42px`/`150px` world-space for regular/boss monsters) should be revisited — they were tuned blind against the wrong zoom level, so they may want a further bump once they're actually being seen at a readable scale for the first time.

## 9. Decorative-art independence (v1.2, concept)

v1.1 leaned on the basemap's own pre-painted stone turret bases for the pad visual — my tower sprites were drawn centered on top of them. The user is now stripping that decorative art out of the basemap image directly, so Bloomwall's pad rendering needs to stop assuming it's there:

- **Good news:** the 8 PixelLab tower sprites already generated each include their own base (Sentry's stone plinth, Bramble's root mass, Frostbud's mossy base, Sunspire's wood crate) — see the images already vendored in `public/farm-art/towers/*/`. Removing the basemap's decorative turret won't leave a "floating tower" look; the sprite is already self-contained.
- **What needs to change:** the *empty*-pad marker. Today it's `drawPad`'s translucent debug-style rounded box with a `+` icon and "Pad" text label — that reads as placeholder UI, not art. Once it's the only thing marking an unbuilt pad (no stone base underneath), it should become a small in-world visual instead: a flattened dirt/grass mat or a faint ground glow ring, styled to match the cozy-pixel basemap rather than a UI-debug box.

## 10. Traveling projectile animation (v1.2, concept)

Today a fired shot (`s.shots` entry) is `{x, y}` = the tower's position, plus a `life` countdown — `drawOver` draws a static dot at the *target's* position for that duration. Visually nothing travels; it's a hit-flash, not a shot. Real fix: interpolate a drawn projectile from the tower's world position to the target's position over the shot's flight time (already have both endpoints — `x,y` is the tower, the target's `x,y` is read live from `s.enemies`), with a distinct look and flight time per tower (matches the per-tower sound design already built):

| Tower | Projectile visual | Flight feel |
|---|---|---|
| Sentry | small arrow/bolt, straight line | fast, ~140ms |
| Bramble | lobbed spore/seed, slight parabolic arc | slower, ~260ms, arcs up then down |
| Frostbud | ice shard with a faint trailing sparkle | medium, ~200ms |
| Sunspire | bright beam — a fading line from tower to target rather than a moving dot, since it's a piercing beam not a thrown object | ~180ms, beam fades out rather than "arriving" |

Each tower's existing `fireMs` (cooldown between shots) stays separate from this new flight-time value — cooldown gates *when* a tower can fire again, flight time is purely the visual travel duration before impact resolves.

## 11. Fan-out tower picker at the pad (v1.2, concept)

**Existing precedent found in the codebase:** `apps/lashira/web/src/ui/Hud.jsx`'s emote picker already does a tap-to-open radial fan-out (`toggleEmoteFan()`, auto-closes after 4s or on pick), styled via `.fan-item`/`.fan-item-1..4` + a `fan-pop` keyframe in `styles.css`. It's capped at exactly 4 items — which happens to match Bloomwall's exactly 4 tower types.

**Why it can't be reused as-is:** that picker is a DOM/CSS overlay anchored to a *fixed HUD corner position* (the bottom-right action ring). Bloomwall's pads are *world positions* that move on screen as the camera pans — there's no existing plumbing (in `RealmShell.jsx`'s controller contract or `realms/util.js`) for "open a picker anchored to a world-space point," and `api` doesn't currently expose the camera transform to realm modules.

**Recommended approach:** draw the fan-out on the canvas instead of in DOM, since Bloomwall already renders everything (pads, towers, enemies) as canvas draws in `drawOver`, and already hit-tests taps against world tile coordinates in `onTapWorld`. Tapping an empty pad would set a `s.fanOpenPad` index (instead of today's silent `s.selPad` selection); `drawOver` draws 4 small tower-icon circles arranged in an arc above that pad (reusing the real tower sprites at a small size, not emoji); `onTapWorld` hit-tests taps against those 4 circle positions first, placing the tapped tower type, or closes the fan if the player taps elsewhere. This keeps the same tap-to-open/auto-close *feel* as the existing emote fan (visual precedent), without inventing new DOM-to-world coordinate plumbing — it's built the same way everything else in this file already is.

**Status:** built in v1.3 (§0.3), superseded the plan above — the canvas-drawn approach worked as designed.

## 12. Character/tower/monster scale, together (v1.4, concept)

Same root cause as §8, now confirmed against a real screenshot of the hero too: `RealmRoom.jsx`'s shared camera zoom (`Math.max(vw/WORLD_W, vh/WORLD_H, 0.42)`) bottoms out at `0.42` for Bloomwall's viewport size, so a 48px tile renders at ~20px — crushing the character sprite, tower sprites, and monster sprites all at once, proportionally. Resizing any one of them in isolation (e.g. just drawing the hero bigger) would break the relative scale between hero/tower/monster/tile and look worse, not better. The fix is still the one in §8: a per-realm `camZoom` override (e.g. on the `world-map-registry.js` entry, consumed as `Math.max(vw/WORLD_W, vh/WORLD_H, realm.camZoom ?? 0.42)`), requesting something like `0.95–1.1` for Bloomwall. That scales the hero, towers, and monsters up together, in the same proportion, and makes the camera meaningfully follow the player instead of showing the whole 60×48 map at once.

## 13. Remove the drawn lane lines (v1.4, concept)

The user is now painting the path directly into the basemap art and will use that painted trail as the visual reference — Bloomwall should stop drawing its own road on top of it. Concretely: drop the `drawSmoothRoad(ctx, PATH, ...)` call and the `drawWaypoint(ctx, PATH[0], '🌲', ...)` entrance marker from `drawUnder`. `PATH` itself does **not** go away — it stays exactly as it is today as pure logic data: enemies still walk it (`advance()`), and `distToPath()` still uses it to keep towers off the lane during placement (§0.3). It just never gets stroked on canvas anymore. This also means the `drawSmoothRoad`/`drawWaypoint` helper functions at the bottom of the file become dead code to remove.

One thing worth flagging back to the user before build: if the painted-in path in the art doesn't line up exactly with the current hand-traced `PATH` waypoints (§5), enemies will visibly walk slightly off the new painted trail. Worth re-deriving `PATH` from the *updated* art (same color-analysis technique used in §5) once the new painted version exists, rather than assuming the old trace still lines up.

## 14. Animation library for tower shots (v1.4, concept)

Today a "shot" (§10) is hand-rolled: a `{x,y,life}` object counted down manually in `tick()`, drawn as a flash at the target. No animation library is in `package.json` today — `nipplejs` (joystick input) is the only third-party runtime dependency; there's no existing tweening/animation engine to match against.

**Recommendation: GSAP (GreenSock).** It doesn't render anything itself — it just tweens plain JS numbers over time with real easing curves, which is exactly what's needed to drive the existing hand-rolled `ctx.drawImage` calls in `drawOver` (this fits the codebase's existing pattern: Canvas2D driven by a manual `requestAnimationFrame` loop in `RealmRoom.jsx`, nothing else changes). Concretely: `gsap.to(shot, { progress: 1, duration: 0.14, ease: 'power2.out', onUpdate: ... })` for Sentry's arrow, with `MotionPathPlugin` (free since 2024) for Bramble's lobbed arc. Small footprint (tree-shakeable core), extremely well documented, and doesn't touch the rendering architecture — it's purely a "what value should this be right now" driver.

**Lighter alternative: anime.js** (~17kb) — same core idea (tween a plain object's properties with easing), less powerful for complex sequencing/motion paths, smaller bundle. Reasonable if GSAP feels heavy for four projectile types.

**Complementary, not competing: tsParticles** — good for the impact-burst VFX (sparks/embers/frost shards on hit) as a separate layer from the travel animation, not a replacement for the tween itself.

**Explicitly not recommended: PixiJS.** It's a full WebGL 2D renderer with its own sprite/particle system — genuinely powerful, but adopting it just for tower projectiles would mean running two renderers side by side (Pixi + the existing Canvas2D loop) or migrating the whole realm, which is a much bigger architectural shift than "animate 4 projectile types" calls for.

## 15. Reuse the real PVP/PVE `ActionCluster` (v1.4, concept)

Traced this precisely (not from the screenshot alone, from the actual components):

- The real, polished battle controller the user screenshotted is `ActionCluster` in `packages/combat/src/cluster.jsx` — a shared, fully presentational component (`skills`, `onSkill`, `onAttack`, `utils`, `cooldowns` 0..1 per skill, `attackCooldown` 0..1, optional `mp`/`skin`). It renders the numbered slot badges (`.slot` "1"/"2"/"3"), the real pie-wipe cooldown (`.cd-wipe` with a `--cd` CSS custom property), and skin-aware icon swapping. `Hud.jsx` imports and renders it for the farm's battle mode (`import { ActionCluster, IconEmote } from '@arganta/combat/cluster'`).
- **`RealmShell.jsx` (what every realm module, including Bloomwall, currently renders through) does NOT use this component.** It hand-rolls its own bottom-right markup that reuses the *same CSS class names* (`cluster`/`small-ring`/`skill-circle`/`attack-circle`) but with simpler behavior: no numbered slot badges, a plain height-bar cooldown fill (`.ra-cool`) instead of the radial pie-wipe, and the primary button shows icon+text label inline rather than ActionCluster's icon-only attack circle. That's the actual source of the visual mismatch between Bloomwall's controller and the real PVP/PVE one — RealmShell was built to *look similar* via shared CSS, not to *be* the same component.
- **This is fixable once, for every realm, not just Bloomwall.** `ActionCluster` is fully prop-driven, so `RealmShell.jsx` can import and render it directly in place of its current hand-rolled block, translating each realm's `controller()` output into `ActionCluster`'s prop shape (`ring` → `utils`, `primary` → the attack button/one skill slot, cooldown fractions computed the same way `cooldownPct()` already does). Since `RealmShell` is the one shared shell all five realms render through, this upgrade lands the real numbered-badge/pie-wipe polish everywhere at once — it's a `RealmShell` fix, not a Bloomwall-specific special case.

## 16. Fan-out for existing towers too (v1.4, concept)

Extends the same canvas-drawn fan-out mechanism (§11, built in v1.3) to tapping an **existing** tower, replacing today's blind tap-to-cycle-target-mode:

- Tapping a placed tower opens a fan with up to 4 slots: **Upgrade** (only shown/enabled while `tier < 2`), and the 3 targeting modes — **Nearest**, **First**, **Strongest** — as direct picks instead of a blind repeated-tap cycle, with the currently active mode visually highlighted.
- Reuses the exact same `s.fan` state shape already built for the build-picker (§0.3) — just a different `icons` array and a different tap handler branch (upgrade this tower / set this mode, instead of place this tower type).
- No new interaction pattern to learn: same tap-to-open, same tap-an-icon-to-pick, same tap-elsewhere-to-cancel feel as the build fan.

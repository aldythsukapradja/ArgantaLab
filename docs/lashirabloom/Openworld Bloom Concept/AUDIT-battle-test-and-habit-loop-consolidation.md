# LashiraBloom Openworld — Audit, Battle Test & Habit-Loop Consolidation

Status: audit + concept, no build. Created 2026-07-10. Reviews the Codex openworld pass against `INDEX.md`, the five concept docs, and the shipped code.

Companion ground truth: `INDEX.md`, `portal-hotspot-plan.md`, `shared-game-shell-component-strategy.md`, `roadmap-and-build-plan.md`.

---

## 0. TL;DR

Codex shipped a **real, correct movement + camera + hero-render + cloud-save spine** for a hub→realm openworld, and the registry/save/routing architecture is clean and scalable. That is genuinely good foundation work.

But measured against the concept and against "make it a habit loop, playable at each step," it is a **walk-on-a-picture demo**, not yet the platform the docs describe. Three things are missing that the concept treats as non-negotiable, and one thing shipped is a live regression.

- 🔴 **Regression:** the 5 portals shadow existing working hotspots (castle, market).
- 🔴 **Concept violation:** instant teleport on tap — the docs explicitly forbid this ("kids must not accidentally leave").
- 🔴 **Concept violation:** RealmMapRoom re-implements its own HUD corners instead of sharing the four-corner shell — the exact anti-pattern the strategy doc bans.
- 🟠 **No loop anywhere:** every realm action (`Command`, `Scout`, `Prep`…) just flashes a toast. Zero habit loop, which is the user's stated #1 focus.
- 🟠 **No reward/compliance spine:** no reward contract, no kid XP/Diamond block, no ledger, no realm status. The economy spine that is the whole point of the docs isn't wired.

The right move is **not** more portals or more realms. It is: fix the regression, add the one shared shell, and give **exactly one realm exactly one real habit loop end-to-end** before touching the other four.

---

## 1. What was actually built (verified against source)

| Area | File | Verdict |
|---|---|---|
| Portal/world registry | `world-map-registry.js` | ✅ Clean data model, `worldMapById`/`worldAssetUrl` fallbacks correct |
| Personal save wrapper | `openworld-save.js` | ✅ Correct — reuses generic game-state RPC, `builtin:openworld`/`default`, merge-safe |
| Reusable realm room | `RealmMapRoom.jsx` | 🟡 Works (movement, camera, hero compositor, debounced save) but HUD is bespoke + no loop |
| App routing | `App.jsx` | ✅ FarmRoom↔RealmMapRoom swap, realm resume on reload via openworld state |
| HQ hotspot wiring | `farm-map.js` | 🔴 Portals inserted first → **shadow existing hotspots** |
| Portal glow | `FarmRoom.jsx` `drawWorldPortalGlows` | ✅ Canvas glow, no sprite artifact (good call vs bitmap overlay) |

**The genuinely good decisions** (keep these):
- One registry → one `RealmMapRoom` → shared `compositor.js` renderer → one DB save. The scalability spine is real.
- Openworld position is personal state, separate `gameId` from the shared circle farm. Correct.
- Glow is drawn, not a sprite overlay — avoids the square-artifact bug class that already bit the basemap.

---

## 2. Battle-test failures (ranked, with repro)

### 🔴 BT-1 — Portals shadow working features (regression)
`HOTSPOTS` puts `...WORLD_PORTALS.map(...)` first (`farm-map.js:121`) and `hotspotAt()` returns the **first** rect match (`farm-map.js:158`).
- `lashira_keep` rect `{27,21,32,26}` == `castle` rect `{27,21,32,26}` → **castle is now dead**. Tapping the castle opens a walking demo instead of the castle UI.
- `hearthrush_kitchen` rect `{29,16,30,17}` overlaps `market` sell rect `{30,16,31,17}` at x30 → part of the market now teleports.
- Repro: load farm, tap the castle. Expected: castle panel. Actual: leaves for Lashira Keep realm.
- **Fix direction:** portals should not sit *on top of* the existing landmark tap. Either (a) give portals a dedicated 1-tile "gate" sub-tile beside the landmark, or (b) make the landmark tap open the **launch modal** whose confirm button enters the realm (see BT-2 — this fix and that fix are the same fix).

### 🔴 BT-2 — Instant teleport violates the confirm rule
`onTap` fires `onPortalTravel` immediately (`FarmRoom.jsx:2238`). Every concept doc says the opposite:
> "No instant teleport on walk-over. Use confirmation so kids do not accidentally leave the farm/city." (`portal-hotspot-plan.md §4`, `architecture-spine §11`).
- Kid-safety + retention issue: a mis-tap yanks you out of the farm loop mid-task.
- **Fix direction:** the launch modal from `architecture-spine §11` (Title / Subtitle / reward preview / kid note / Enter+Cancel). This is Phase-0 work in the roadmap and it's the missing gate.

### 🔴 BT-3 — RealmMapRoom builds its own HUD corners
`shared-game-shell-component-strategy.md §2` hard rule:
> "No realm should create its own HUD corner components."

But `RealmMapRoom.jsx` hand-rolls `left-stack`, `zone-pill`, `realm-settings`, `cluster` — and `FarmRoom` has a *different* HUD. There are now **two** HUD implementations, i.e. the anti-pattern is already happening at n=2 realms. Every future realm makes it worse.
- **Fix direction:** extract the four corners into shared components (`CharacterStatusPanel`, `SettingsMenuButton`, `LocationInfoPanel`, `ActionControllerShell`) that take a `GameShellState`. FarmRoom and RealmMapRoom both render them. Do this **before** realm #2 gets a loop, not after.

### 🟠 BT-4 — No habit loop in any realm
Realm actions call `act()` → `flash()` + a `Get` animation (`RealmMapRoom.jsx:326`). Nothing is earned, spent, tracked, or repeated. This is the user's explicit #1 concern and it is 0% done. See §3–§4 for the fix.

### 🟠 BT-5 — No reward contract / compliance / status
`WORLD_MAPS` entries carry only visual fields (`file`, `color`, `actions`). None of `status`, `rewardContract`, `kid_xp_allowed`, `kid_diamond_allowed` exist. The economy/compliance spine (`resource-economy` + `architecture-spine §3`) is entirely unwired. Acceptable for a walking demo; blocking for "platform."

### 🟠 BT-6 — Collision is a 60×48 border box on every realm
`blockedAt()` in `RealmMapRoom.jsx:16` blocks only the outer ring of a 60×48 grid, but each realm image is a *different scene* (kitchen, arena) scaled to fill `WORLD_W×WORLD_H`. The player walks through counters, walls, the fountain. Spawns like `[30,40]` are arbitrary points on a grid that doesn't match the art. Fine as "demo," wrong as "game."

### 🟡 BT-7 — Double-doors: portals duplicate existing systems
`emberring_arena` (walking demo) coexists with the real PvP arena (`g.combat`, `PVP` rect, `pvprank`). `lashira_keep` duplicates `castle`. `bloomwall_pass` sits near `dungeon`. The map now has two doors to overlapping fantasies. Decide which is canonical per pillar before shipping both.

### 🟡 BT-8 — Basemap size drift
Docs mandate `1394×1128`. Engine world is `60×48×48 = 2880×2304`. Realm PNGs are `1152×928`, basemap variants are `1152×928` / `1394×1128` / untracked `v5`. Everything is `drawImage`-scaled so it *renders*, but nothing is authored at the engine's true resolution → soft/blurry maps. Pick one authoring size = `WORLD_W×WORLD_H` and regenerate, or accept the scale and delete the `1394×1128` mandate from the docs.

### 🟡 BT-9 — Duplicated movement/animation loop
`RealmMapRoom` re-implements the walk/step/facing/motion loop that `FarmRoom` already has (shared renderer, but not shared controller). Two copies will drift. Candidate for a shared `useOverworldController` hook later — not urgent, but note it before it's copied a third time.

---

## 3. Deep benchmark — the ONE habit loop per reference game

The docs list analogs but never distill the *loop*. Habit = a **trigger → action → variable reward → investment** cycle short enough to repeat. Here is the single irreducible loop each reference is actually famous for, and the Lashira minimal version. Build only the middle column first.

| Pillar | Reference | The one loop that made it a habit | Lashira MVP loop (build this, nothing else) | Session |
|---|---|---|---|---|
| **Bloomwall Pass** | Kingdom Rush | Place tower on a pad → watch a wave → earn gold → place/upgrade next tower | Drag 1 tower onto a pad → 1 wave of 5 enemies walks the road → survivors reach core = lose HP → clear wave = Bloom + next tower unlock | 60–90s |
| **Hearthrush Kitchen** | Overcooked / Dinner Dash | Ticket appears → grab→cook→plate→serve before patience bar empties → tip | 1 order ticket → tap pantry→stove→serve window (3 taps, timed) → serve before bar empties = Meals + happiness | 30–45s |
| **Lashira Keep** | Township / SimCity | Timer/resource fills → tap to collect → spend to upgrade → new timer, bigger number | 1 district plot → feed it Wood/Stone from farm → it levels → city "happiness" meter ticks up → longer next timer | async, 5s taps |
| **Fountain Festival** | Royal Match | Board of tiles → make a match → tiles pop (juice) → progress a meter → 1 star | 1 small match-3 / merge board → clear target → event token → meter fills toward a cosmetic | 60–120s |
| **Emberring Arena** | Brawl Stars | 3-min round → out-aim opponent → rank ± → cosmetic flex | Reuse existing PvP combat → best-of-1 friendly duel → rank ±, no XP/Diamond | 60–180s |

**The streamline insight:** four of these five are the *same abstract loop* — **spawn a small demand → satisfy it under a soft timer → get a variable payout → the payout unlocks the next slightly-bigger demand.** Tower waves, kitchen tickets, festival boards, and city timers are all "demand → satisfy → payout → unlock." That means you can build **one shared `RealmLoop` contract** and skin it four ways, instead of four bespoke games. Only Emberring (real-time PvP) is a genuinely different animal — which is exactly why the docs already rank it last.

---

## 4. Consolidated concept — the "one loop, five skins" spine

Do not build five games. Build **one loop engine** with a data-driven demand/payout table, and let each realm supply its verbs and its art. This is the natural extension of the registry the code already has.

```
RealmLoop (shared runtime)
  demand    : a thing that appears and has a soft timer   (enemy wave / order / puzzle target / district timer)
  action    : 1–3 verbs the player taps to satisfy it     (place / cook-serve / match / feed)
  payout    : variable reward on success                  (Bloom, Meals, tokens, city points) — via RewardContract
  unlock    : payout advances a visible meter             (next wave / next recipe / next star / district level)
  compliance: RewardContract decides adult vs kid mint    (kids: resources/score yes, XP/Diamonds never)
```

Every realm becomes a config: `{ demandGenerator, verbs[], rewardTable, meter }`. The shell, movement, save, and compliance are shared. Adding a realm = adding a row + a demand generator, not a new game.

**Why this is the polished/streamlined combination the user asked for:**
- One juice/feedback system (pop, toast, meter fill) tuned once → every realm feels equally good (same argument as the shared HUD).
- One reward/compliance path → kid-safety is enforced in one place, not five.
- One difficulty-curve tuning surface → HQ World Builder edits `rewardTable`/`demand` per realm (the docs' whole point).
- The player learns one grammar ("satisfy the demand before the bar empties") and it transfers across four realms → faster habit formation.

---

## 5. Consolidated battle-test TO-DO — playable at every step

Ordered so that **after each step the whole thing is still playable and better than before.** No step introduces more than one new concept. Stop and playtest after each.

### Step 0 — Stop the bleeding (regression + safety) · smallest, do first
- [ ] Fix BT-1: portals must not shadow `castle`/`market`. Give each portal a distinct gate sub-tile, or fold the landmark tap into the launch modal.
- [ ] Fix BT-2: add the shared **launch modal** (Title / Subtitle / reward preview / kid note / Enter+Cancel). Tap landmark → modal → confirm → travel.
- [ ] **Playable check:** castle & market work again; entering a realm always requires a confirm. Ship-able.

### Step 1 — Lock the shared shell (before any realm gets a loop)
- [ ] Extract `CharacterStatusPanel`, `SettingsMenuButton`, `LocationInfoPanel`, `ActionControllerShell` taking one `GameShellState`.
- [ ] Re-point **both** FarmRoom and RealmMapRoom at them. Delete the bespoke `left-stack`/`zone-pill` duplication.
- [ ] **Playable check:** farm and all realms share one HUD; changing the HUD once changes it everywhere. This is the polish multiplier.

### Step 2 — One reward contract + compliance, wired to ONE realm
- [ ] Add `status`, `rewardContract`, `kid_xp_allowed:false`, `kid_diamond_allowed:false` to the registry.
- [ ] Add a single `grantRealmReward()` path that writes the resource ledger and **hard-blocks** kid XP/Diamond mint.
- [ ] **Playable check:** completing a stub action in one realm grants Bloom to an adult and grants nothing forbidden to a kid. Compliance is real, once.

### Step 3 — First real habit loop: **Hearthrush Kitchen** (not Tower Defense)
Reason to reorder vs the roadmap's "Tower Defense first": kitchen is the **shortest** loop (30–45s), the **simplest** to make feel good, kid-safe, and it turns the farm's Food into a sink — closing an economy loop the game already half-has. Tower Defense is a bigger build; do it second when the loop engine exists.
- [ ] Build the `RealmLoop` engine as the kitchen: 1 order ticket → 3-tap prep/cook/serve → patience bar → Meals + happiness payout → next ticket slightly faster.
- [ ] Collision: replace border-box with 3–4 hand-placed station rects for this one map (BT-6, scoped to one realm).
- [ ] **Playable check:** a genuinely repeatable 45-second loop with a variable payout and a rising meter. This is the first *habit*.

### Step 4 — Prove the engine is reusable: **Bloomwall Pass** as a second skin
- [ ] Same `RealmLoop` engine, new demand generator (enemy wave) + verb (place tower). If the engine needs a rewrite to fit, the engine was wrong — fix the engine, don't fork it.
- [ ] **Playable check:** two realms, one engine, two feels. Validates §4.

### Step 5 — Everything after is data, not code
- [ ] Fountain Festival = match/merge demand + token payout (config).
- [ ] Lashira Keep = async district timers reading the kitchen/tower payouts (config + one meter UI).
- [ ] Emberring Arena = point the portal at the **existing** PvP combat, don't rebuild it (resolves BT-7).
- [ ] HQ World Builder Overview/Portals/Realms/Rewards tabs read the same registry (the docs' Phase 4).

### Deferred on purpose (do NOT build yet)
- Full stronghold district editor, event calendar, deep analytics, map editor (architecture-spine §12 already says defer these).
- Per-realm collision polygons beyond the one realm you're actively shipping.
- Realm #3/#4/#5 loops until #1 and #2 prove the engine.
- Basemap re-authoring at `WORLD_W×WORLD_H` — cosmetic; do it once art is loop-approved (handoff already says regenerate later).

---

## 6. Registry-integrity tests (cheap, prevent regressions like BT-1)
The handoff's suggested test set is right; make it a guard that also catches shadowing:
- [ ] Every portal has a map file that resolves.
- [ ] Every portal has an HQ hotspot and a return spawn.
- [ ] Every map id round-trips through `worldMapById`.
- [ ] **New:** no portal `hqHotspot` rect is a superset of, or equal to, a non-portal `HOTSPOTS` rect (would have caught BT-1).
- [ ] **New:** every `live` realm has a `rewardContract` and `kid_xp_allowed===false` (compliance gate).

---

## 7. One-paragraph verdict

Codex built the right *skeleton* — registry, shared renderer, personal save, resume-on-reload — and that spine is worth keeping verbatim. It did **not** build the two things the concept calls non-negotiable (confirm-to-enter + shared HUD shell) and it introduced a shadowing regression on the castle/market. Most importantly for the stated goal, **no realm has a habit loop yet.** The streamlined path is: fix the regression and the confirm modal (Step 0), lock one shared shell (Step 1), wire compliance once (Step 2), then give **one** realm **one** real 45-second loop (Step 3 — Kitchen) before proving the same engine on a second realm (Step 4). Five games become one loop engine with five configs. Everything else in the docs is correct but premature.

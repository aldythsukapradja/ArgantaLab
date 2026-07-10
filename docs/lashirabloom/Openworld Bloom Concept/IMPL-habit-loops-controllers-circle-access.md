# LashiraBloom — Habit-Loop Implementation Spec (5 Worlds)

Status: implementation spec, **no build yet**. Created 2026-07-10. Extends `AUDIT-battle-test-and-habit-loop-consolidation.md`.

Scope: for each of the 5 worlds — the easy-win habit loop, the exact right-hand controller, adult/kid reward rules, and per-circle access. Plus the shared spine all five plug into.

Grounded in real code: `farm-save.js` (circle RPCs), `world-map-registry.js`, `RealmMapRoom.jsx`, `FarmRoom.jsx` (twin-thumb controls).

---

## 0. Control grammar (fixed for all 5 worlds)

Confirmed from `FarmRoom.jsx`: the game already uses a **twin-thumb mobile layout**. All realms MUST reuse it — no realm invents controls.

```
┌─────────────────────────────────────────────┐
│ [CharacterStatusPanel]      [SettingsButton] │  ← shared shell (top)
│                                              │
│                                              │
│                                              │
│ [LocationInfoPanel]     ┌─ ActionController ─┐│  ← shared shell (bottom)
│  (floating joystick      │   ○ ○ ○ ○ ○  ring ││
│   appears under left      │      ◉  PRIMARY  ││
│   thumb, nipplejs)        └───────────────────┘│
└─────────────────────────────────────────────┘
```

- **Left thumb = movement.** Floating joystick (`nipplejs`, dynamic, under-thumb) — already built, reused as-is. Some realms disable it (puzzle board); it never changes shape.
- **Right thumb = one big PRIMARY (`attack-circle`) + a ring of up to 5 secondary `skill-circle` buttons.**
- **The ONLY thing a realm changes is the right cluster's contents** (primary label/icon/handler + which ring slots are filled + cooldowns + disabled reasons). Everything else is the shared shell.

Each realm below is specified as a `RealmController` = `{ primary, ring[] }` where each slot is `{ id, label, icon, cooldownMs, disabledReason, kind }` (the `GameAction` contract from `shared-game-shell-component-strategy.md §3.4`).

**Design rule for "easy win":** the PRIMARY is *context-sensitive* — one button whose label/effect changes with what you're standing next to. One smart button beats five dumb ones for habit formation and for kid usability.

---

## 1. Per-circle access model (correction to the shipped code)

### 1.1 The bug to fix
`openworld-save.js` calls `saveOpenworldState(profile, null, …)` — **circleId is hardcoded null**, so today the openworld is personal. Your requirement ("all 5 world access is only per circle") is not met yet. But the plumbing already exists: `farm-save.js` routes to `save_circle_game_state`/`load_circle_game_state` (RLS-gated by membership) whenever `circleId` is non-null.

### 1.2 The access gate (hard rule)
> The 5 worlds are the **circle's** worlds. You can only enter them while in **circle scope** with a real `circleId`. No circle → portals are locked.

| Player state | Portals | Behavior |
|---|---|---|
| In circle farm scope (`farmScope.kind==='circle'`, `effCircleId` set) | **Unlocked** | Tap → launch modal → enter realm |
| Personal farm scope | **Locked** | Tap → "The realms belong to your circle. Switch to your circle to enter." |
| Visiting a member's farm | **Locked** | Visit = look-only, already enforced |
| Guest / no cloud | **Locked** | "Sign in and join a circle to play the realms." |

Enforcement is server-side already: `save_circle_game_state` only writes if `auth.uid()` shares the circle. The client gate is UX; RLS is the real wall. **Never trust the client gate alone** — every realm reward write goes through a circle RPC that re-checks membership.

### 1.3 What is circle-shared vs personal (the split)
Two save blobs, both `gameId: 'builtin:openworld'`, different RPCs = no collision:

| State | Where | RPC | Why |
|---|---|---|---|
| Realm unlock/status, city/stronghold meters, shared realm progression (restaurant level, waves cleared, festival meter, arena board), circle resource totals | **Circle blob** | `save_circle_game_state(p_circle)` | One kingdom per circle; everyone advances it together |
| My live avatar position per realm, my last realm, my personal daily reward caps | **Personal blob** | `save_lashira_farm_state` (personal) | Position is mine; caps are per-person for fairness |
| Every earn/spend event (with `memberId` + `accountType`) | **Ledger** (append) | dedicated increment RPC — see §2.3 | Concurrency-safe; audit + compliance |

### 1.4 Concurrency warning (must design around)
The circle blob is **one shared JSON**. If two circle-mates finish a loop at once, blob read-modify-write clobbers. **Do not mint resources by overwriting the circle blob.** Mint via an **append/increment ledger RPC** (`resource_ledger`) and derive circle totals from the ledger. Reserve the circle blob for slow-changing shared config (city levels, realm status), and even there prefer field-scoped writes. This is the #1 forecasted production bug for a family/circle co-op economy — design it out now.

---

## 2. Shared reward + compliance spine (one code path, all realms)

### 2.1 One function guards everything
```
grantRealmReward({ realmId, memberId, accountType /* 'adult' | 'kid' */, rewards })
```
Rules enforced in ONE place (never per-realm):
1. **Diamonds are never minted from gameplay for anyone.** Strip `diamonds` from `rewards` always. (Diamonds = learning apps / guardian grants only.)
2. **If `accountType==='kid'`: strip `xp` entirely.** Kids never earn Character XP from game actions.
3. Adults earn `xp` only if the realm's `rewardContract.adult.xpPolicy !== 'none'`.
4. Everything else (Bloom, Wood, Stone, Food, Ore, Meals, tokens, score, mastery, city points) is allowed for both — these are the "help the kingdom" currencies.
5. Every grant is appended to the ledger with `memberId`, `accountType`, `realmId`, `source`. This is the compliance proof (`kid_xp_blocked`, `kid_diamond_blocked` metrics).

### 2.2 accountType source
Read from the profile/hero (adult vs kid flag from the existing account model — same flag that already governs kid XP/Diamond rules elsewhere in ArgantaLab). Never inferred client-side per realm; passed into `grantRealmReward` from the shell.

### 2.3 Ledger RPC (new, needed)
A definer RPC `append_circle_resource(p_circle, p_member, p_game, p_delta_json, p_source)` that (a) re-checks membership, (b) rejects `diamonds`/kid-`xp` server-side as a second wall, (c) appends and returns new circle totals. Client never trusts its own compliance — server rejects too. Cheap, and it kills BT-5 + the concurrency risk together.

### 2.4 Daily caps (retention + anti-farm)
Per-member, per-realm soft cap in the **personal** blob (not circle) so one member can't drain the shared economy and caps reset fairly. Cap = "full payout for first N loops/day, then reduced." Keeps the loop rewarding without inflation (the docs' economy-health concern).

---

## 3. The five worlds

Each world: **Loop** (trigger→action→reward→invest, with numbers) · **Right controller** · **Adult/kid** · **Circle share** · **Easy-win MVP** · **Forecast**.

Build order = **Kitchen → Bloomwall → (engine proven) → Festival, Keep, Arena as configs.** Reason in the audit: Kitchen is the shortest loop and closes the farm's Food sink.

---

### 3.1 Hearthrush Kitchen — Cooking / Service ⭐ build first

**Loop (30–45s):**
`Trigger` an order ticket slides in (patience bar starts) → `Action` walk to Pantry→Stove→Window doing 3 context taps → `Reward` serve before bar empties = Meals + city happiness + Cooking mastery (variable: perfect timing = tip bonus) → `Invest` Meals feed the circle's city meter; mastery unlocks the next recipe → faster/second ticket appears. Escalates: 1 ticket → 2 → 3 concurrent.

**Right controller** (`primary` is context-sensitive — the easy win):
| Slot | Label (context) | Kind | Cooldown | Disabled when |
|---|---|---|---|---|
| PRIMARY ◉ | **Grab** (@pantry) / **Cook** (@stove) / **Serve** (@window) | primary | — | not adjacent to a station |
| ring 1 | Dash (speed burst) | skill | 4s | on cooldown |
| ring 2 | Plate / Drop (set down held item) | tool | — | empty-handed |
| ring 3 | Clean (clear a fouled station) | tool | — | no fouled station near |
| ring 4 | Emote | utility | — | — |
| ring 5 | Menu (settings/exit) | utility | — | — |
Left joystick: walk the chef. That's the whole scheme — **one smart PRIMARY + Dash.** A 6-year-old can play it.

**Adult vs kid:**
| Reward | Adult | Kid |
|---|---|---|
| Meals, Bloom, Cooking mastery, city happiness | ✅ | ✅ |
| Character XP | ✅ if `adult.xpPolicy!=='none'` | ❌ blocked |
| Diamonds | ❌ (gameplay never) | ❌ |
Consumes: raw **Food** from the circle stock (closes the farm→kitchen sink).

**Circle share:** restaurant level + city happiness = **circle blob**. Meals/Bloom minted = **ledger** (per member). My chef position = **personal**. Two circle-mates can cook the same kitchen; each ticket is claimed by whoever taps it first (claim flag in the ticket, short-lived).

**Easy-win MVP:** 1 kitchen, 1 recipe, 1 station-triple, 1 patience bar, serve loop + Meals payout + a happiness meter that ticks. No co-op, no rush hours yet.

**Forecast:** 🟢 High. Shortest loop = highest session count; kid-safe; turns an existing dormant resource (Food) into demand. Risk: station collision must be hand-placed (BT-6) — scoped to one map, cheap.

---

### 3.2 Bloomwall Pass — Defense / Adventure ⭐ build second (proves the engine)

**Loop (60–90s/wave):**
`Trigger` "Start Wave" → `Action` drag towers onto pads (spend Bloom), tap PRIMARY to fire hero skill → `Action` 5 enemies walk the road; leaks damage the Bloom Core → `Reward` clear wave = Bloom + Stone/Ore + score; survive 10 waves = Blueprint (unlocks a tower) → `Invest` Blueprint/upgrades make the next map's harder waves winnable.

**Right controller:**
| Slot | Label | Kind | Cooldown | Disabled when |
|---|---|---|---|---|
| PRIMARY ◉ | **Start Wave** (idle) / **Hero Skill** (mid-wave) | primary | skill: 12s | skill on cooldown |
| ring 1 | Tower A — place (cost Bloom) | tool | — | can't afford / no pad selected |
| ring 2 | Tower B — place | tool | — | locked (needs Blueprint) |
| ring 3 | Upgrade (tap a placed tower) | tool | — | no tower selected / can't afford |
| ring 4 | Repair Core | skill | 20s | core full |
| ring 5 | Menu | utility | — | — |
Left joystick: move the hero (so the hero-skill has a position). Placement is tap-on-pad.

**Adult vs kid:**
| Reward | Adult | Kid |
|---|---|---|
| Bloom, Stone, Ore, Blueprints, score | ✅ | ✅ |
| Character XP | ✅ if allowed | ❌ |
| Diamonds | ❌ | ❌ |
Consumes: Bloom (tower placement/upgrade) — a real sink for the kitchen/farm output.

**Circle share:** waves-cleared / map-unlocked / Blueprints owned = **circle blob** (the circle defends together). Per-run resources = **ledger**. Hero position + current run = **personal** (each member runs their own attempt; leaderboard of best clears is circle-shared).

**Easy-win MVP:** 1 map, 1 road, 4 pads, 1 tower type, 5-enemy waves ×3, core HP, clear payout. Add tower types/waves as data.

**Forecast:** 🟢 High retention (active strategy), directly serves "defend the Kingdom." It's the **engine-reuse test**: if the Kitchen's `RealmLoop` (demand→satisfy→payout→unlock) can't express "wave→towers→clear→blueprint," the engine is wrong — fix it here, before 3 more realms depend on it.

---

### 3.3 Fountain Festival — Puzzle / Events (config after engine)

**Loop (60–120s):**
`Trigger` a small match/merge board with a target → `Action` swap/merge to clear the target (juicy pops) → `Reward` event tokens + meter fill (variable: combos = bonus) → `Invest` meter fills toward a seasonal cosmetic / decorates the plaza → new board, higher target.

**Right controller** (board mode disables joystick; plaza mode enables it to walk between boards):
| Slot | Label | Kind | Cooldown | Disabled when |
|---|---|---|---|---|
| PRIMARY ◉ | **Play** (plaza) / **Booster** (in board) | primary | booster: limited count | no boosters left |
| ring 1 | Shuffle | tool | 1/board | used |
| ring 2 | Hint | utility | 8s | — |
| ring 3 | Claim (bank the reward) | tool | — | board unfinished |
| ring 4 | Emote | utility | — | — |
| ring 5 | Menu | utility | — | — |
In-board interaction is **direct tap on tiles** (no joystick) — the PRIMARY becomes the limited Booster.

**Adult vs kid:**
| Reward | Adult | Kid |
|---|---|---|
| Event tokens, Garden mastery, play resources | ✅ | ✅ |
| Cosmetics | via tokens/event rules | via guardian/event rules only |
| Character XP | ✅ if allowed | ❌ |
| Diamonds | ❌ | ❌ |

**Circle share:** the festival meter + which cosmetic the circle is unlocking = **circle blob** (a shared community goal — strong retention). Tokens = **ledger**. Current board = **personal**.

**Easy-win MVP:** 1 match-3 board, 1 target type, token payout, 1 shared meter → 1 cosmetic. This is also the **experiment slot** — swap the board type without touching the shell.

**Forecast:** 🟡–🟢 Broad casual reach + a shared circle goal drives "log in so we hit the meter together." Risk: match-3 juice is easy to do badly; reuse one tuned pop/feedback system (§0).

---

### 3.4 Lashira Keep — Stronghold / City (config; async loop)

**Loop (async, 5-second taps across the day):**
`Trigger` a district timer fills (offline) → `Action` tap ready districts to Collect → `Action` spend Wood/Stone/Food to Upgrade → `Reward` district level ↑, city meters (happiness/safety/prosperity) ↑ → `Invest` higher level = longer timer, bigger number, new district unlock. This is the **daily-return spine** — the reason the circle opens the app tomorrow.

**Right controller** (mostly tap-the-map; joystick walks the avatar between districts):
| Slot | Label | Kind | Cooldown | Disabled when |
|---|---|---|---|---|
| PRIMARY ◉ | **Collect** (tap a ready district) | primary | — | nothing ready |
| ring 1 | Build / Upgrade | tool | — | can't afford |
| ring 2 | Assign (put a worker/kin on a district) | tool | — | no free worker |
| ring 3 | City Stats (open meters) | utility | — | — |
| ring 4 | Decorate (cosmetic skins) | utility | — | — |
| ring 5 | Menu | utility | — | — |

**Adult vs kid:**
| Reward | Adult | Kid |
|---|---|---|
| City stats, Bloom, population milestones, contribution | ✅ | ✅ |
| Character XP | ✅ if allowed | ❌ |
| Diamonds | ❌ | ❌ |
Consumes: Wood/Stone/Food/Bloom/Blueprints (the master sink that pulls on every other realm's output).

**Circle share:** **the entire city is the circle blob** — one kingdom, everyone builds it. This is the purest per-circle world. Collect/upgrade actions must go through the **ledger/increment RPC** (§1.4) because many members touch it — do NOT blob-overwrite. My avatar position = personal.

**Easy-win MVP:** 3 district plots, 1 timer→collect→upgrade cycle, 1 happiness meter. No full district editor (deferred per architecture-spine §12).

**Forecast:** 🟢 The long-term retention layer. Highest concurrency risk (everyone edits one city) — the ledger-not-blob rule is mandatory here, not optional.

---

### 3.5 Emberring Arena — Social Competition (reuse, don't rebuild)

**Loop (60–180s):**
`Trigger` queue a friendly duel / score challenge → `Action` twin-stick combat (move + strike + skills) → `Reward` rank ± , score, cosmetic eligibility → `Invest` climb the circle leaderboard. Normalized stats for fairness (no pay-to-win, cosmetics don't affect combat).

**Right controller:** **already built.** `FarmRoom.jsx` combat cluster = PRIMARY **Strike** + ring (Skill 1, Skill 2, Dodge/Interact, Emote, Menu) + left joystick. Emberring = point the portal at the **existing** combat runtime, don't author a new one. (Resolves audit BT-7 double-doors.)

**Adult vs kid:**
| Reward | Adult | Kid |
|---|---|---|
| Rank, score, cosmetic eligibility | ✅ | ✅ |
| Character XP | ✅ if allowed | ❌ |
| Diamonds | ❌ | ❌ |
No power sinks — loadout is cosmetic only.

**Circle share:** the leaderboard/season = **circle blob**. Match results = **ledger**. Stats normalized at match start (temporary), saved character untouched (`resource-economy §2b`).

**Easy-win MVP:** best-of-1 friendly duel between two circle members on the existing combat, rank ±. Real-time matchmaking deferred (highest risk, ranked last in every doc).

**Forecast:** 🟡 Social retention + skill flex, but real-time PvP is the hardest to balance and moderate. Correct call: **last**, and reuse existing combat so it costs almost nothing to stand up as a friendly-duel MVP.

---

## 4. Cross-world consistency checklist (forecast the foundation holds)

| Concern | Rule | Prevents |
|---|---|---|
| Access | All 5 realms require circle scope; RLS re-checks on every write | Non-circle players touching circle economy |
| Rewards | Only `grantRealmReward` mints; server RPC re-validates | Kid XP/Diamond leaks (BT-5 / compliance) |
| Diamonds | Never minted by any realm, any account | Pay-to-win / policy break |
| Concurrency | Shared economy via ledger/increment RPC, not blob overwrite | Circle-mates clobbering each other |
| Controls | Every realm = joystick + (1 PRIMARY + ≤5 ring); realm only fills the cluster | HUD sprawl (BT-3) |
| Shell | Four corners are shared components fed `GameShellState` | Two+ HUDs drifting |
| Caps | Per-member daily soft cap in personal blob | Economy inflation |
| Position vs progress | Position personal, progress circle-shared | Save clobber + wrong ownership |
| Reuse | Realm = config (`demand`, `verbs`, `rewardTable`, `meter`); Emberring reuses combat | 5 bespoke games / double-doors (BT-7) |

## 5. What NOT to spec/build yet (guardrails)
- No co-op/rush-hours, no 2nd map, no district editor, no real-time matchmaking, no event calendar, no analytics dashboards until Kitchen + Bloomwall prove the engine.
- No basemap re-authoring until a loop is art-approved.
- No new portals beyond these 5.

## 6. Verdict on foundation strength
The spine Codex built (registry → shared room → shared renderer → cloud save) is sound. With (a) the per-circle access correction, (b) the one `grantRealmReward` + ledger RPC, (c) the shared four-corner shell, and (d) exactly one real loop before generalizing — this foundation is battle-tested and forecasts well: it enforces compliance in one place, scales realms as data, keeps the economy concurrency-safe, and gives each world one repeatable, kid-safe, circle-shared habit loop. Keep Opus through this design lock-in; switch to Sonnet for the mechanical build.

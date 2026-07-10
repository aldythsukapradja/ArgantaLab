# LashiraBloom — Progression, Character Page & the Competitive Loop

Game-design concept (NO build yet). Written as the game-master/systems-designer pass.
Everything here is **grounded in code that already exists** — cited inline — so it's a
buildable spec, not a wishlist. The goal: one competitive flywheel where hunting,
fishing, farming, and barning all feed a character you level, dress, and show off —
and where the kid/adult split makes *learning* the progression engine for kids.

---

## 0. Why "Wear" restarts the game — and how to make it live

**Cause (confirmed in code).** The player sprite is composited ONCE at mount:
`FarmRoom.jsx` → `loadPlayerResources(avatarSpec)` (net/hero.js) builds `g.resources`
from `hero.spec`. `equip_cosmetic_item` writes the NEW spec server-side, but the
client's `g.resources` + `hero.spec` are now stale — so I took the lazy path of
`window.location.reload()` to force a fresh `fetchHeroState()`. That's the "restart."

**Live equip (the real fix).** `loadPlayerResources(spec)` is already a standalone,
runtime-callable async function. So on a successful equip:
1. Patch the one slot in the in-memory spec (or re-fetch it — cheap).
2. `const res = await loadPlayerResources(newSpec)` → swap `g.resources = res` and set
   `g.heroOk` — the very next `draw()` frame renders the new look. No reload, no
   dropped farm state, no re-auth.
3. Optimistic: show the new part instantly from the shop's already-loaded part sheet,
   reconcile when `loadPlayerResources` resolves.

This is the FIRST thing the Character Page needs, because a character page is a
dressing room — every equip/skin/mount change must reflect **live** on the avatar.

---

## 1. Research digest — proven competitive loops

The brief named Ragnarok; here's what actually makes these loops sticky, and which
pattern each contributes. (Design decisions in §3–7 pull from these.)

| Game | The engine that keeps players hooked | What we borrow |
|------|--------------------------------------|----------------|
| **Ragnarok Online** | **Two parallel XP bars** (Base Level → stat/HP/SP; **Job Level → skill points** into a class tree). Rebirth/transcend prestige. **MVP hunting** (mini-bosses → best gear). **Cards** (mob drops that socket into gear for %). **Refine +N** with break-risk. Zeny player-market. | Dual-track leveling; class skill tree; boss-hunting for rare drops; refine ladder (we keep it **gentle**, no break) |
| **RuneScape** | **A separate 1–99 level for EVERY activity** (Mining, Fishing, Woodcutting, Farming, Combat…). No classes — *doing* a thing levels *that* thing. **Total Level** as the flex stat + hiscores. | **Activity Skills** — the exact map to LashiraBloom's farm/fish/mine/chop/hunt. This is the backbone of "hunting/fishing/farming increase stats." |
| **Stardew Valley** | 5 skills 0–10 via doing them; each level = a recipe/perk; **L5 & L10 = a profession fork** (a tiny skill tree). Cozy, no-fail, kid-safe. | Perks per skill level; profession forks; the wholesome, low-punishment tone that fits kids |
| **Diablo / PoE** | **Loot treadmill** + infinite post-cap **Paragon** levels + **gem sockets**. "One more run for a better drop." | Post-99 prestige track; sockets = our enhancement/cards |
| **Genshin** | Character level **gated by ascension materials** from bosses — you must go *fight the world* to grow, not just grind mobs. | Material-gated power tiers (our gear enhance already spends wood/stone/bloom) |

**The distilled universal loop** (every one of them runs this):
> **Act → Earn → Grow → Access harder Act → Earn better → Show off.**
> The magic is (a) *multiple bars always moving* (never idle progress), (b) *soft
> gates* that make the next tier feel earned, and (c) a *horizontal prestige* layer
> (cosmetics/titles/hiscores) so max-level players still compete on *looks + rank*.

LashiraBloom already has the skeleton for ALL THREE. We just connect them.

---

## 2. What already exists (the skeleton we build on)

- **Base level + path archetypes** — `packages/combat/progression.js`: 4 paths
  (`warrior`/`rogue`/`poet`/`mage`, shown as **Guardian/Shadow/Mystic/Arcanist**),
  each with an HP/MP curve (`pathMaxHp`/`pathMaxMp`), an exponential **L99 XP ladder**
  (`xpForLevel`, `levelFromXp`, `levelProgress`), and **per-path level titles**
  (Recruit→Vanguard, Apprentice→Grandmagus…).
- **Combat power** — `gear.js`: weapon ATK + armor DEF damage model
  (`outgoingDamage`/`incomingDamage`), 5 gear tiers.
- **3 skill slots** — `skills.js`: bolt (single) / storm (AoE) / mend (heal), with
  **per-level power curves** + **per-path power** (`pathSkillPower`, `PATH_POWER`).
- **Bestiary** — 6 mobs (squirrel→tiger boss) with per-mob `xp`/`bloom`/`drops`.
- **The gear shop** — cosmetic items (helmet/coat/weapon/shield) with ATK/DEF/HP,
  bought with diamonds, **enhanced Lv1–5** with wood/stone/bloom (just built).
- **Activities** — farming (plant/harvest), fishing (dock minigame), mining
  (`mine()`), chopping (`chop()`), animal husbandry (feed/collect), hunting (arena/
  dungeon monsters). All live.
- **PvP rank** — `pvp-rank.js` + the on-map rank board (a real leaderboard already).
- **Kid/adult split** — `rewardKill` gives **Bloom to everyone but XP only to adults**
  ("kids level only by real learning"); diamonds are the **learning currency**
  (`log_learn_event`, `grant_diamonds`, `diamond_ledger`; `grant_starter_pack` is
  **grown-ups only**).

The design below is 80% *connecting these*, 20% new.

---

## 3. The progression spine — THREE axes, always moving

Borrowing RO's "never-idle two bars" and RuneScape's per-activity levels, a
LashiraBloom character grows on **three independent tracks** so *something* is always
climbing no matter what you do:

### Axis A — Base Level (the CHARACTER) · exists
Your hero level 1–99 (`xpForLevel`), path title, HP/MP pool. Earned from **combat XP**
(adults) or **learning XP** (kids). Drives survivability + skill power. Post-99 →
**Prestige (Paragon-style)**: infinite "Bloom Stars" that give tiny permanent boosts,
for the endgame flex — new, small.

### Axis B — Activity Skills (the CRAFT) · NEW, the backbone the brief asks for
A separate level per activity — this is literally "hunting, fishing, farming, barning
increase stats." RuneScape-style, 1–**50** each (kid-friendlier than 99):

| Skill | Leveled by | Level perks (examples) |
|-------|-----------|------------------------|
| 🌾 **Farming** | plant/harvest crops | faster growth, +yield %, rare-crop chance |
| 🎣 **Fishing** | dock minigame catches | bigger bite window, +fish, treasure catches |
| ⛏ **Mining** | `mine()` ore nodes | +ore/gem, unlock deeper nodes, less cooldown |
| 🪓 **Foraging** | `chop()` trees | +wood, hardwood access, sapling regrow speed |
| 🐄 **Ranching** | feed/collect animals | faster goods, +produce, animal cap raise |
| ⚔ **Combat** | monster kills | +crit, +skill points (feeds Axis C) |

- **Perk unlocks** at milestone levels (Stardew L5/L10 forks): e.g. Mining L10 →
  choose *Prospector* (+gem odds) or *Blaster* (mine 2 nodes at once).
- **"Mastery" = a horizontal flex**: sum of activity levels → a **Total Mastery** stat
  on the hiscore board (RuneScape total-level prestige).
- **Kid-safe**: activity XP is play-earned for EVERYONE (chores are wholesome). Only
  *Combat* base-XP + diamonds are learning-gated for kids (§6).

### Axis C — Gear & Skills (the POWER + the LOOK) · mostly exists
- **Gear**: the cosmetic-shop items ARE the gear (helmet/coat/weapon/shield, ATK/DEF/
  HP). Buy with diamonds → **wear** (live) → **enhance Lv1–5** (wood/stone/bloom).
  This is where "increase the look" and "increase the stats" are the SAME act — the
  RO headgear-collection prestige + Diablo loot power, fused.
- **Class skills**: Combat levels grant **skill points** → rank up the 3 skill slots
  along a small **per-path tree** (§5). RO's job-level → skill-tree, scoped to 3 slots
  so it stays legible for kids.
- **Cards/sockets (later)**: mob drops that socket into gear for a % — RO's deepest
  min-max loop; a Phase-3 collection layer, optional.

---

## 4. The competitive core loop (the flywheel)

```
        ┌─────────────────────────────────────────────────────────────┐
        │                                                             │
        ▼                                                             │
  HUNT monsters ──► Combat XP (+skill pts) · Bloom · materials · drops │
  (arena/dungeon)        │                                            │
        │                ▼                                            │
        │          LEVEL UP: HP/MP ↑, skill ranks ↑                   │
        │                │                                            │
  FARM / FISH / MINE / CHOP / RANCH ──► activity-skill XP · Bloom ·    │
        │                              materials (wood/stone/ore/gem) │
        │                                       │                     │
        │                                       ▼                     │
        │              BUY gear (💎, Cosmetics) ──► WEAR (live look)   │
        │                                       │                     │
        │              ENHANCE gear (🪵🪨🌸, Forge) ──► +N stats       │
        │                                       │                     │
        └──────────────► STRONGER + BETTER-LOOKING ◄──────────────────┘
                                   │
                                   ▼
                 BEAT tougher mobs · CLIMB PvP rank · TOP the hiscores
                 (Total Mastery · PvP rank · rarest gear = the flex)
```

**Why it's competitive, not just cozy:** the *vertical* loop (power) feeds a *horizontal*
flex (PvP rank board — already exists — plus a **Total Mastery hiscore** and **rarest-
gear showcase**). Cozy players farm forever and climb Mastery; competitive players hunt
+ PvP. Both climb a public ladder. That's the RO "fame" + RuneScape "hiscores" pull.

**Soft gates that pace it (Genshin-style, using tiers we already have):**
- Gold/gem ore needs a **T2 pickaxe** (already). Hardwood needs a **T2 axe** (already).
- Best gear tiers cost **gem/ingot/token/shard** — only from mining deep / smelting /
  **the Tiger boss** (already in the gear cost tables). So the endgame gear *requires
  going to fight the world* — Genshin's ascension principle, already coded.

---

## 5. Per-path design — the 4 classes as real playstyles

Ids are locked (`warrior/rogue/poet/mage`); names shown. Each already has a distinct
HP:MP curve — we give each a **combat identity + a 3-node skill tree** (Combat level →
skill points; RO job-tree, scoped).

| Path (name) | Fantasy | HP:MP @99 | Playstyle | Skill tree (the 3 slots, ranked) |
|-------------|---------|-----------|-----------|----------------------------------|
| ⚔️ **Guardian** (warrior) | frontline tank | 5.0 : 1 | walk in, soak, cleave | Bolt→**Cleave** (melee arc) · Storm→**Ground Slam** · Mend→**Iron Skin** (self-shield) |
| 🗡️ **Shadow** (rogue) | burst duelist | 2.1 : 1 | hit-and-run, crit | Bolt→**Backstab** (crit vs full-HP) · Storm→**Fan of Knives** · Mend→**Vanish** (dodge) |
| ✨ **Mystic** (poet) | support/hybrid | ~1 : 1 | buff + sustain | Bolt→**Chord** · Storm→**Anthem** (party heal-over-time) · Mend→**Grace** (big heal) |
| 🔮 **Arcanist** (mage) | glass-cannon AoE | 0.55 : 1 | nuke from range | Bolt→**Firebolt** · Storm→**Meteor** (biggest AoE) · Mend→**Siphon** (lifesteal) |

- **Same 3 slots for all** (bolt/storm/mend) → no UI explosion; the *per-path power*
  already differs (`pathSkillPower`/`PATH_POWER`). Ranking a slot (1→2→3→max) with
  skill points boosts power + adds a small rider (crit, shield, HoT) per path.
- **Path choice** already derives from weapon (`pathForWeapon`) — the Character Page
  lets you *see* it and (later) respec at a cost. Weapon slot = path identity, so
  buying a bow in the shop and wearing it literally makes you a Shadow. Gear ↔ class ↔
  look are one system.

---

## 6. Kid vs Adult — the learning-gate IS the progression engine

The split already lives in code; the design makes it the *heart*, not a restriction.
Principle: **kids play the exact same game and climb the exact same ladders — but the
fuel for the competitive tracks is real learning.**

| Reward | Adult (grown-up) | Kid | Grounded in |
|--------|------------------|-----|-------------|
| 🌸 **Bloom** (play currency) | play (all actions) | **play** (all actions) | `rewardKill` gives Bloom to everyone |
| 🪵🪨🟨🔷 **Materials** | play (gather/hunt) | **play** (gather/hunt) | `mine()`/`chop()`/drops — no gate |
| 🌱 **Activity-Skill XP** (Axis B) | play | **play** | wholesome; chores level chores |
| ⭐ **Combat/Base XP** (Axis A) | play (kills/quests) | **LEARNING ONLY** | `rewardKill`: XP skipped for kids; kids "level only by real learning" |
| 💎 **Diamonds** (buys gear looks+stats) | play + starter 50k | **LEARNING ONLY** | `grant_starter_pack` grown-ups only; `log_learn_event`/`grant_diamonds` = learning |

**What this produces (the intended magic):**
- A kid can farm, fish, mine, rank up **Mastery**, and stockpile Bloom + materials by
  playing — so the game is fully fun without a single lesson.
- But the **aspirational** layer — leveling their hero's power (Axis A), and buying +
  wearing the cool diamond-gear (Axis C looks + stats) — is **fueled by learning**.
  "Want the Astral sword and to hit level 30? Finish today's lessons → 💎 + ⭐." The
  gear they can *see* on other kids becomes the pull to learn.
- Enhancement (wood/stone/bloom) is play-earned, so a kid who's *learned* enough to buy
  a piece can then grind materials to enhance it — learning unlocks it, play perfects
  it. Both feel earned.
- **No punishment tone** — a kid never *loses* or is *blocked from playing*; they just
  progress the power/prestige tracks through learning. Matches the game's gentle design
  (Dungeon: "Faint = you just leave, keep what you gathered").

**Guardrails already there:** diamonds are a server-authoritative ledger with
security-definer RPCs; kids can't self-grant; guardians grant via `grant_diamonds`;
learning events log via `log_learn_event`. The gate is real, not client-trusted.

---

## 7. The Character Page pop-up (UX spec)

A new panel (slots into `Panels.jsx` beside Shop), opened from the HUD unit-card. It's
the **dressing room + stat sheet + skill planner + mount stable** in one. Tabs:

### Tab 1 · **Character** (stats + live avatar)
- **Big live avatar** (the composed hero, re-renders on any equip — §0), path title +
  level + XP bar (`levelProgress`), Prestige stars if 99.
- **Stat block**: HP/MP (`pathMaxHp/Mp`), ATK/DEF (gear sum), crit (Combat skill),
  and each shown as **base → +gear → +enhance** so the player sees *why* they're strong.
- **Activity skills strip**: the 6 skill levels + Total Mastery + hiscore rank.

### Tab 2 · **Equipment** (the reason we're here)
- All slots as a paper-doll: helmet · coat · weapon · shield · (face/hair/mantle/…).
- Tap a slot → the items you **own** for it (from the shop catalog + ownership) →
  **Equip = live** (§0). Un-owned → "Buy in Shop." Shows the `+N` enhance badge.
- This is the "change my equip for ALL" the brief asks for — one place, live preview.

### Tab 3 · **Skills** (the class planner)
- The 3 slots as cards with current rank + power (`skillPower`/`pathSkillPower`),
  **skill points** available (from Combat level), and Rank-Up buttons → the per-path
  tree (§5). Emote favorites picker (already exists in Hud) folds in here.

### Tab 4 · **Mount** (already a diamond shop)
- Owned mounts (`my_mounts`) → equip (`equip_mount`, already atomic) → live on avatar.
- Locked mounts → buy (`buy_mount`, already exists). Zero new backend.

*Design note:* HQ's Character Forge already IS this composer (`composer.ts` + the
picker components), operator-facing. The player Character Page reuses the same spec
shape + `loadPlayerResources`, so both surfaces stay one truth (the whole point of the
shared cosmetic DB we built).

---

## 8. Phased build roadmap (when approved — smallest valuable slices first)

1. **Live equip** (§0) — kill the reload. Small, unblocks everything. `Shop.jsx` Wear +
   the new Character Page both call a shared `applyEquipLive(spec)` helper.
2. **Character Page v1** — Tabs 1 (stats), 2 (equipment, live), 4 (mount). Reuses
   existing data; no new tables. This alone delivers "character page pop-up where I see
   my stats, change equip, mount."
3. **Activity Skills (Axis B)** — add the 6-skill XP model to farm-mechanics/farm-logic
   (client-trusted like the rest of the farm economy), award XP on each action, show in
   Tab 1. The single biggest "makes hunting/fishing/farming increase stats" payoff.
4. **Skill tree (Tab 3)** — skill points from Combat level → rank the 3 slots per path.
5. **Wire gear stats into real combat** — the deferred decision: sum cosmetic ATK/DEF/HP
   (+enhance) into `outgoingDamage`/`incomingDamage` (`gear.js`). Do this deliberately
   with a balance pass (it touches both games).
6. **Prestige + hiscores + cards** — post-99 stars, a Total-Mastery leaderboard beside
   the existing PvP rank, then RO-style socket cards. Endgame, last.

Nothing above requires ripping anything out; each phase is additive and independently
shippable. Kid/adult gating is enforced at the *reward* seam (§6), which already exists,
so every new earn just asks `isKid()` the same way `rewardKill` does.

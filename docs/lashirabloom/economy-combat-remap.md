# LashiraBloom — Economy, Combat & Retention Remap

Full audit + redesign. Goal: one coherent **gather → craft → fight → gather better**
loop with weapon/gear progression, tiered monsters + bosses, and closed material
sinks. Grounded in the current code (`packages/combat`, `apps/lashira/web/src/game`,
`data/*`, `HotspotPanels.jsx`).

---

## 1. Audit — what exists today

### Combat (packages/combat)
- **Damage:** melee `34` flat; `bolt = 40+12(L-1)` (L50 = 628), `storm = 24+8(L-1)`/mob,
  `mend = 30+10(L-1)`.
- **Player pools:** HP/MP by PATH×level (Warrior 120→10,018 HP; Mage 75→8,013 MP).
- **Monsters:** `makeMonster` → flat `MONSTER_MAX_HP = 100`, 3 kinds (slime/bat/blob)
  that differ ONLY by palette. 5 roam the arena. **No boss** (Tiger dungeon is a stub
  that drops you into the same arena).
- **Kill reward:** `rewardKill` → `killReward(L)=2+⌊L/2⌋` Bloom (everyone) + `killXp(L)=15+5(L-1)`
  XP (adults only; kids never gain play-XP).

### Progression
- Level 1–99, exponential XP (L50 ≈ 24,635). XP from kills (adults) / learning (kids).
- **Power = level only.** No gear, no weapon stat, no crafting.

### Economy
- **🌸 Bloom** — soft currency, earned from everything, spent only on seeds.
- **💎 Diamond** — learning currency, cosmetics-only sink (unwired).
- **🪵 Wood / 🪨 Stone** — build mats (tools, house).
- **🟨 Ore / 🔷 Gem / 🐟 Fish** — gathered, **no sink** (dead-ends).
- Tools (Pickaxe/Axe/Rod) T1–3 gate gathering; House T1–5 gives storage.

### The core problems
1. **No build depth** — you can't make your character stronger except by leveling.
2. **Dead-end materials** — ore/gem/fish go nowhere; gathering has no payoff.
3. **Trivial combat** — 100-HP mobs vs 600+ skill damage; no difficulty curve, no boss.
4. **Two economies that never meet** — Bloom (farm) and materials (gather) don't feed
   a shared progression.
5. **Diamond has no bottom** — learning reward promise is empty.
6. **No retention scaffolding** — no gear ladder, boss cadence, quests, or collections.

---

## 2. The remap — a closed loop

```
  ┌──────────── FARM / GATHER ────────────┐
  │  crops, animals → 🌸 Bloom             │
  │  chop/mine/fish → 🪵🪨🟨🔷🐟          │
  └───────────────┬───────────────────────┘
                  ▼
        CRAFT / UPGRADE (Forge)
   weapon +ATK · armor +DEF/HP · refine mats
                  ▼
  ┌──────────── FIGHT (zones) ────────────┐
  │ tougher mobs → more Bloom + rarer mats │
  │ bosses → gear tokens + rare gems       │
  └───────────────┬───────────────────────┘
                  ▼   better gear → deeper zones → rarer mats → ...
```

Farming **funds** early gear (Bloom + common mats); combat **gates** late gear (boss
tokens + rare gems). Each pillar now needs the other.

---

## 3. Combat stats model (new)

Keep HP/MP (path×level). Add two gear-driven stats:

- **ATK** — from weapon. Added to melee + skill damage: `outDmg = base + ATK`.
- **DEF** — from armor. Reduces incoming: `inDmg = max(1, mobATK − DEF)`.
- (Optional later: **CRIT%** from gem sockets, **elemental** tags.)

Hero carries `gear = { weaponTier, armorTier, sockets[] }`; ATK/DEF derive from tiers.
This is additive to the existing path/level system — level still drives HP/MP + skill base.

---

## 4. Weapon & armor tiers (crafted at the Forge)

Exponential cost so each tier is a multi-session goal (mirrors the XP marathon rule).

| Tier | Weapon | +ATK | Craft cost | Gate |
|---|---|---|---|---|
| 1 | Worn | +0 | (start) | — |
| 2 | Iron | +60 | 🌸 500 · 🪵20 · 🪨15 · 🟨5 | — |
| 3 | Steel | +180 | 🌸 2,500 · 🟨20 · 🔷3 · Ingot×2 | Pickaxe T2 |
| 4 | Mythril | +450 | 🌸 10,000 · 🔷12 · Ingot×4 | Boss token×1 |
| 5 | Astral | +1,000 | 🌸 40,000 · 🔷30 · Astral shard×1 | Boss token×5 |

| Tier | Armor | +DEF | +HP | Craft cost |
|---|---|---|---|---|
| 1 | Cloth | +0 | +0 | (start) |
| 2 | Leather | +20 | +300 | 🌸 400 · 🪵25 · 🐟5 |
| 3 | Chain | +60 | +900 | 🌸 2,000 · 🟨18 · 🪨30 |
| 4 | Plate | +140 | +2,500 | 🌸 9,000 · 🔷10 · Ingot×3 |
| 5 | Aegis | +320 | +6,000 | 🌸 35,000 · 🔷28 · Astral shard×1 |

Balance check: L50 bolt 628 + Iron 60 = 688 vs Grove Blob 800 → ~2 hits; + Mythril 450 =
1,078 → one-shots Grove, ~3 hits Cavern Golem (2,600). Gear meaningfully shifts the curve.

---

## 5. Monster & boss map (rescaled + tiered loot)

Monster HP rescaled to match the damage curve; ATK threatens path HP via DEF.

Kid-safe woodland roster (owner-locked, manifest §8) with the combat tiers mapped on.
"Faint" not "die" — no gore.

| Zone | Monster | HP | ATK | XP | 🌸 | Drops |
|---|---|---|---|---|---|---|
| Meadow (T1) | 🐿️ Squirrel | 130 | 8 | 15 | 3 | 🪵1–2 (25%) |
| Meadow (T1) | 🦊 Fox | 300 | 20 | 22 | 5 | 🐟1 · Hide (15%) |
| Grove (T2) | 🦡 Badger | 1,100 | 40 | 55 | 12 | 🟨1–2 (30%) · 🪨2 |
| Grove (T2) | 🐗 Boar | 1,600 | 70 | 70 | 16 | 🟨2 · Hide (20%) |
| Cavern (T3) | 🦌 Deer | 2,300 | 100 | 130 | 28 | 🔷1 (25%) · Essence |
| Cavern (T3) | 🦡 Dire Badger (elite) | 3,300 | 120 | 200 | 45 | 🔷1–2 · 🟨3 |
| **Boss** | 🐯 **Tiger** | 18,000 | 280 | 1,500 | 400 | **Weapon token×1** · 🔷5 · Astral shard (10%) |

- **Elite variant** (rare spawn): ×3 HP, ×2 loot, guaranteed rare drop.
- **Boss cadence:** Tiger daily (1 token/day) + a rotating weekly boss for retention.
- Zones unlock by clearing the prior tier's boss (or a tool/gear gate).

---

## 6. Currency roles & material sinks (closed)

| Currency | Source | Sink |
|---|---|---|
| 🌸 Bloom | crops, animals, kills, sells | seeds, consumables, **all craft/upgrade Bloom cost** |
| 🪵 Wood | chop, T1 mobs | tools, house, weapon/armor T2 |
| 🪨 Stone | mine, T2 mobs | tools, house, armor |
| 🟨 Ore | mine, Grove mobs | **smelt → Ingots → weapon/armor T3–5** (new) |
| 🔷 Gem | mine, Cavern mobs, boss | **weapon/armor T3–5 + sockets (crit/element)** (new) |
| 🐟 Fish | fishing, bats | **cook → HP/MP potions** (new) |
| Ingot | smelt ore (Forge) | weapon/armor tiers |
| Boss token | bosses | weapon/armor T4–5 gate |
| Astral shard | boss (rare) | T5 endgame gear |
| 💎 Diamond | **learning only** | cosmetics + 1 exclusive "scholar" gear skin (learning flex, no power) |

Every gathered material now has a combat destination. Diamond stays power-neutral
(protects the learning-currency rule) but gains a visible flex reward.

---

## 7. Retention layers

| Horizon | Loop |
|---|---|
| Session (min) | tap-farm, harvest, kill mobs → instant Bloom/mat juice + buy animation |
| Daily | 3 quests (harvest N · clear zone X · craft/upgrade 1) + 1 boss token + login streak |
| Weekly | rotating boss, a gear-tier target, circle mini-event |
| Mid (weeks) | weapon T1→5, armor T1→5, tool + house ladders, crop/animal collection |
| Long (season) | endgame boss, circle leaderboard, prestige weapon, seasonal skins; XP → 99 |

Pacing: keep the exponential curves (XP + craft cost) so each gear tier ≈ a
season-long chunk, honoring the "rank is a marathon, never flat/uncapped" rule.

---

## 8. Build sequencing (proposed phases)

1. **Stat model** — add `ATK/DEF/gear` to the hero; wire `outDmg = base+ATK`,
   `inDmg = max(1, mobATK−DEF)` in `packages/combat`. Rescale monsters to the tier table.
2. **Weapon/armor tiers + Forge crafting UI** — extend the Blacksmith to craft/upgrade
   gear (reuse a shared `<ShopRow>` with the buy animation from the shop-polish work).
3. **Monster zones + loot tables + real Tiger boss** — zone-gated spawns, drop tables,
   boss token on clear.
4. **Material refining** — smelt (ore→ingot), cook (fish→potion), sockets (gem→crit).
   Closes the dead-end sinks.
5. **Daily quests + boss cadence** — the daily retention spine.
6. **Armor/trinkets, collections, circle leaderboard** — mid/long retention.

Phases 1–3 deliver the core loop; 4–6 are depth + retention.

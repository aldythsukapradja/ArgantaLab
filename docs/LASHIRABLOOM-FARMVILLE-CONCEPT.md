# LashiraBloom — FarmVille *feel* layer (subordinate to the manifest)

> **Source of truth = [`docs/lashirabloom/map-and-asset-manifest.md`](./lashirabloom/map-and-asset-manifest.md).**
> That file governs the MAP, ZONES, ECONOMY, CURRENCY, monsters, and upgrades.
> This doc no longer proposes any of those — it now covers only the **feel /
> juice / retention / onboarding** layer the manifest under-specifies, plus the
> **gap between what's built today and the manifest**, and the **login → daily
> habit loop** mapped inside the manifest's world.

Rewritten 2026-07-08 after adopting the manifest (supersedes the earlier
standalone FarmVille draft).

---

## 1. What the manifest already decides (my earlier open questions — answered)

| My earlier question | Manifest's answer (§) |
|---|---|
| Economy on or off? | **On.** 🥇 Gold = play currency (mining · battleground · selling crops/produce/fish). 🪵🪨 materials for upgrades. (§3) |
| Kids free vs adults pay? | **Kids progress freely** — they *earn* Gold/Wood/Stone by playing. Only 💎 Diamonds (learning) is protected: never spent on play, cosmetics only. (§3) |
| Currency name? | 🥇 **Gold** for play; 💎 Diamonds stays the learning/cosmetic currency. (§3, §17) |
| Expansion / progression? | **Yes** — farm expansion, castle evolution (Shack→Castle), greenhouse/wall upgrades, tiered tools, mining/forestry/fishing. (§4–6) |
| Goals / direction? | **Notice board** = quests + daily tasks → Gold / learning. (§4) |
| Monsters? | **Woodland animals + Tiger boss** (kid-safe "faint", not die). (§8) |

So the two big things I flagged as "decide this" are resolved: **the coin loop is
ON, and the kid/adult tension dissolves** — everyone earns **Gold**, and the
learning wall survives because it's a *different* currency (Diamonds).

## 2. Where the CURRENT build diverges from the manifest (migration list)

The shipped farm is an early slice; the manifest is the target. Concrete gaps:

1. **Currency mismatch (do first).** The build pays **Diamonds** for play (kills,
   selling) and I recently made **kids earn nothing**. The manifest says play
   currency is **Gold**, and **kids earn Gold freely**. → Introduce Gold as the
   farm/battle currency; move Diamonds to learning/cosmetic only; **kids earn
   Gold** (reverses the "kids get nothing" step). Operator stays all-free.
2. **Stamina gates farming** — **not in the manifest at all.** FarmVille never
   limits tapping with energy. → remove farming-stamina (keep only as battle mana
   if wanted). *This is the single biggest feel fix.*
3. **Monsters** slime/bat/blob → **woodland + Tiger** (§8).
4. **One field** → the manifest's 60×48 multi-zone map. The map is hardcoded in
   `farm-map.js`; the manifest's #1 scaling gap is **map-as-data + an editor**
   (§14.1). Everything structural depends on this seam.

## 3. The FarmVille FEEL layer (what the manifest under-specifies)

The manifest nails *structure + content + economy*. FarmVille's *compulsion*
still needs these, layered on top:

1. **Free, fast tapping** — no energy gate; plant/harvest a field in seconds.
2. **Withering + return hooks** — a ripe crop stays fresh a grace window, then
   wilts (lost, or a small Gold fee to clear). The manifest has growth *timers*
   but no *loss* — withering is what makes you come back. Pair with a "crops
   ready!" nudge.
3. **Harvest juice** — the manifest already asks for "FarmVille reward-pop" +
   Kingdom coin/level FX (§10b, §12). Formalize it: Gold bursts up from the tile,
   a pop, a harvest-streak counter. (Our slim reward pill is the HUD half.)
4. **Plant-all / harvest-all** (or drag) so working a field is instant.
5. **Daily bonus** — a scaling "welcome back" reward on first open each day; sits
   naturally on the manifest's **Notice board**.
6. **Onboarding** — the manifest has no first-session tutorial. A short starter
   quest chain (plant → harvest → sell → buy → expand) teaches the loop.

## 4. User flow: login → daily habit loop (in the manifest's world)

**Login (§ App.jsx):** sign in (Google / kid PIN) → Kingdom hero → spawn at the
**Castle (home, map center)**.

**First session (onboarded):** Notice-board starter chain walks the core loop:
plant a bed → wait → harvest (juicy) → sell at the market for **Gold** → buy more
seeds/an animal → do one resource action (chop a tree / mine) → see the farm-expand
teaser.

**The daily habit loop:**
```
open at Castle
  → Notice board: claim DAILY BONUS + see today's tasks
  → harvest ripe crops (juice) + replant           ┐ short cadence (minutes)
  → collect animal produce (milk/wool/eggs)         ┘
  → a RESOURCE run: mine Gold+Stone / chop Wood / fish   (mid cadence)
  → sell at market → spend Gold (seeds, animals, feed, tools)
  → LEADER: spend Wood+Stone+Gold on an upgrade
            (expand farm · evolve castle · fortify wall)  (long cadence, aspirational)
  → optional: Battleground / 1-floor Dungeon (Tiger) → Gold + loot
  → optional: PvP duel
  → log off — timers (crops, animals, ore/tree regen) pull you back
```

Three nested cadences = the retention engine: **minutes** (crops/animals),
**a session** (resource runs, quests, selling), **days/weeks** (expansion, castle,
wall, tool tiers). Withering + daily bonus + "ready!" nudges close the loop.

## 5. Reconciled build order

- **Tier 0 — currency migration (unblocks everything):** add 🥇 **Gold** as the
  play currency (kills, selling, mining/forestry later); **kids earn Gold**;
  Diamonds → learning/cosmetic only; operator all-free. Reward pills show Gold.
- **Tier 1 — FarmVille feel on the current slice:** remove farming-stamina;
  **withering**; **harvest juice** (Gold pop); **plant-all/harvest-all**; **daily
  bonus**; a **starter quest**. (All doable on today's single-field map.)
- **Tier 2 — manifest structure, staged on the current map:** Notice-board quests;
  **farm expansion + level-gated crop unlocks**; swap monsters → **woodland +
  Tiger**; first economy loop building (market/seed shop).
- **Tier 3 — the manifest world:** **map-as-data + editor** (§14.1, the key seam),
  then the zones one at a time (mining/forest resources → greenhouse → fishing →
  castle evolution → dungeon → PvP wall tiers).

## 6. Decisions left (only 3 — the manifest answered the rest)

1. **Currency migration now?** Introduce **Gold** for play + **kids earn Gold**
   (per manifest §3) — confirming because it *reverses* the recent "kids get
   nothing / Diamonds for play" step.
2. **Stamina** — remove it from farming (my strong rec; not in the manifest)?
   Keep only for battle skills? Or leave as-is?
3. **Diamonds** — keep as the separate learning/cosmetic currency (manifest §17),
   or drop entirely and go Gold-only?

Confirm those and I'll start with **Tier 0 + Tier 1** on the current build.

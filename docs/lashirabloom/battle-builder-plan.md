# Battle Builder — a new Circle HQ surface (PLAN + page-by-page design)

Status: **CONCEPT — no build.** Dated 2026-07-08. Retargeted from the earlier
Bloom-Command idea to its real home: **Circle HQ (`apps/hq`) — the operator OS.**
Battle Builder joins the Rail's **Build** group next to Game / App / Learn / Agent /
Content Builder. Companion to [pvp-concept.md](./pvp-concept.md) (the balance model) and
[`pvp-balance-sim.mjs`](./pvp-balance-sim.mjs) (the simulator this ports).

Supersedes `battle-command-plan.md` (which targeted Bloom Command — wrong home).

---

## 0. Thesis

> **Combat is a *registry of data* + a *simulator that reads it*, living in HQ as an
> operator tool. The same engine that balances PvP (path-vs-path) balances PvE
> (path-vs-monster). Tuning it here *is* building the PvP foundation — two birds.**

You get an operator surface where you **nerf/buff paths, skills, enemies, and bosses with
sliders**, **map skill/path/enemy scaling by level**, and **simulate + sensitivity-test**
before anything ships — the "every tunable is a row" posture HQ already runs, applied to
combat, with the duel sim I prototyped ported in-browser as live charts.

---

## 1. Where it lives (exact HQ integration)

HQ is a Zustand-driven surface OS: `shell/store.ts` (`SurfaceId` + `SURFACE_LABEL` +
`go()`), `shell/Rail.tsx` (grouped nav — **Products / Analytics / Command / Build**),
`shell/Shell.tsx` (surface `switch`). Battle Builder is **one new surface**, mirroring how
Game/App Builder are registered:

```ts
// shell/store.ts
export type SurfaceId = … | 'battle'
SURFACE_LABEL.battle = 'Battle Builder'

// shell/Rail.tsx — append to the 'Build' group
{ id: 'battle', label: 'Battle Builder', Icon: Swords }   // lucide Swords

// shell/Shell.tsx — <Surface> switch
case 'battle': return <BattleBuilder />
```

New code lives in `apps/hq/src/surfaces/battle/` and follows the **BuilderShell pattern**
(a `.seg` sub-tab bar → pages), reusing:
- **Charts**: `components/charts.tsx` `ChartView` (dependency-free, theme-token coloured).
  Add four variants — `heatmap`, `radar`, `tornado`, `multiline` — registered in
  `CHART_KINDS` (the system is explicitly built to extend this way).
- **Theme**: `theme.css` tokens (`--acc #6366f1`, `--mag`, `--ok/warn/bad/tl`,
  `--bg/bg2/bg3`, `--tx/tx2/tx3`), light/dark via `data-theme`. Classes `.card .kpi .seg
  .pill .h1`.
- **Gate**: operator-only, same posture as every HQ RPC (`hq_is_operator()`), `AgentOrb` +
  `⌘K` palette available (register Battle sub-tabs as palette targets).
- **Source of truth**: import `@arganta/combat` (`PATHS`, `PATH_POWER`, `PVP_PROFILE`,
  `PVP_TUNING`, `SKILL_SLOTS`, monster defs) — HQ adds the workspace dep; the console shows
  the *real* numbers, never a copy.

---

## 2. Combat as a registry (scalable data model)

Everything the tool tunes is a keyed row → adding a monster / subclass / attack = a row.

### 2.1 Attack taxonomy — generalize the current 4
Today: **normal (melee)**, **single magic (Bolt)**, **area magic (Storm)**, **heal (Mend)**.
Make an attack a composition of primitives so #5…#N are data, not code:
```
Attack = { id, name, icon,
  school: physical | magic,                 // which stat amplifies it
  target: self | single | line(reach) | cone | area(r) | all,
  effect: damage | heal | dot | shield | buff | debuff | knockback | summon,
  power:  { base, perLevel } | ×base-curve,  cost, cooldown, castTime, reach, duration }
```
The four map in cleanly (proof); Firebolt (magic/single/dot), Warcry (physical/self/buff),
Cleave (physical/cone/damage), Shield (magic/self/shield) become rows.

### 2.2 Subclasses — paths become a tree
Base 4 (`warrior/rogue/poet/mage`) are roots; a subclass = `{ parentPath, statDeltas,
skills[3] }`. e.g. mage→Pyromancer/Cryomancer, warrior→Guardian/Berserker. Each drops
straight into the sim's win matrix (it's just another profile).

### 2.3 Enemies & bosses
`{ id, name, kind: mob|elite|boss, family, hp{base,perLevel}, attacks[], behavior,
aggro, moveRel, atkInt, levelBand, spawnZones, countCap, loot, boss{telegraph, phases,
enrage} }` — reuses `makeMonster/damageMonster` for rules; the row adds tunables. Scales to
any count (the woodland set + Tiger boss is the seed).

### 2.4 Level curves & 2.5 global tuning
Editable curves (HP/MP pools, damage bases, XP ladder, **PvP HP curve**) + global knobs
(`PVP_TUNING`: bolt reach, variance/crit/miss; PvE: spawns, aggro, loot, enrage) + master
"global magic ×/physical ×" for fast broad nerfs.

---

## 3. Page-by-page design (the sub-tabs)

Battle Builder opens on **Overview**; a `.seg` bar switches pages. Persistent **draft bar**
(bottom): shows N unsaved changes · [Preview diff] · [Publish]. Each page's "fancy chart"
is named.

### P1 · Overview — "is combat healthy?"
- **Fairness score ring** (big, Ultrahuman-style): RMS-from-50% across all matchups → a
  0–100 "balance" score, colour-graded (green/amber/red).
- **Hottest imbalance** callout card: e.g. "⚠ Mage beats Warrior 72% at L25" with a
  one-tap → jump to Simulator on that cell.
- **Per-path win% bars** (horizontal, 4 rows, 50% reference line).
- **PvE clear-rate KPIs** (KPI tiles): % of paths that solo the Tiger by level band, avg
  TTK, "walls" count.
- **Recent tuning** feed (who changed what, revertable).
> Charts: `radar`-free — ring + `bars` + `kpis` (all exist).

### P2 · Roster — Paths & Subclasses
- One **path card** per path: a **radar chart** (5 axes: Magic / Physical / Speed / Tank /
  Sustain) that redraws live as you drag sliders → instantly *see* the archetype.
- **Sliders**: `mag`, `phy`, `atkInt`, `moveRel`, `pvpHpMul`, `healMul`, with the
  ordering-constraint guardrails inline (magic mage>poet>rogue>warrior, etc. — warns on
  violation).
- **Live-impact strip**: this path's overall win% updates as you drag (debounced sim).
- **Subclass tree**: expandable under each root; "+ New subclass" adds a row (delta editor).
> Chart: `radar` (NEW) per path; mini `bars` for live impact.

### P3 · Skills — Attacks
- **Attack registry table**: name · school · target · effect · power · cost · cooldown.
- **Composer** (right rail / sheet): dropdowns for school/target/effect + power curve →
  build attack #N without code. "+ New attack".
- **Scaling preview**: a `multiline` chart of the selected skill's power vs level, per
  path (so you see mage-Bolt vs warrior-Bolt diverge).
> Chart: `multiline` (NEW).

### P4 · Bestiary — Enemies & Bosses
- **Enemy cards** (mob/elite/boss badges) with HP/damage/behavior editors.
- **Scaling chart**: enemy HP & contact-damage vs level (`multiline`).
- **Boss phase timeline**: horizontal band (phases at HP%, enrage marker).
- **Path × Enemy TTK heat-grid** (`heatmap`): rows = paths, cols = enemies, cell =
  time-to-kill / "can't solo" (red) → see at a glance if the Tiger is fair for a L8 mage.
> Charts: `heatmap` (NEW) + `multiline`.

### P5 · Curves — level scaling
- **Multi-line charts** with draggable control feel: HP pools per path, MP pools, damage
  bases (bolt/storm/mend/phys), XP ladder, **PvP HP curve** overlaid with PvE pools (to
  show the compression that fixes level-scaling — pvp-concept §3).
- Level scrubber (1→99) that ghosts a vertical marker across every chart.
> Chart: `multiline` (NEW) ×5, shared level cursor.

### P6 · Simulator — the battle test
- **PvP win matrix** (`heatmap`, 4×4 + subclasses): row win% vs column, cell-coloured
  around 50% (teal fair → magenta skew). Tap a cell → the two combatants' HP-over-time
  duel replay (a sparkline pair).
- **Overall win% bars** + **fairness score** (RMS) headline.
- **Level-sweep** (`multiline`): each path's overall win% across L1→99 → catches
  level-scaling imbalance (the exact bug the sim found).
- **PvE panel**: path (or party) vs enemy/boss → TTK, survivability, "solo-clearable at
  ≥ L", DPS-vs-enrage. Party comp builder.
- Controls: level selector, sample count (speed↔precision), Run, ± confidence bands.
> Charts: `heatmap` + `multiline` + `bars`.

### P7 · Sensitivity — "which knob matters?"
- **Response curve**: pick a knob (e.g. `mage.mag`), sweep ±X% → chart the chosen metric
  (fairness RMS / a matchup / a boss TTK). Flat = safe, steep = knife-edge (rogue's
  `atkInt` was steep).
- **Tornado chart** (`tornado`, NEW): rank all knobs by how far a ±10% nudge moves the
  fairness score → the few load-bearing knobs, at a glance.
- **2-way heatmap** (`heatmap`): sweep two knobs (e.g. `boltReach` × `mage.mag`), colour =
  worst-matchup deviation → find the *fair basin* visually.
- Monte-Carlo **± bands** everywhere (don't chase noise).
> Charts: `tornado` (NEW) + `multiline` + `heatmap`.

---

## 4. Simulator engine (ported, in a web worker)

Port `pvp-balance-sim.mjs` (the tuned A-prime model) into
`surfaces/battle/sim/duel.ts` + a web worker (keeps the UI smooth). Reads the current
**effective** values (package defaults + draft overrides). PvP = win matrix + RMS; PvE =
TTK/survivability. Sensitivity = OAT sweep / tornado / 2-way, all Monte-Carlo with bands.

---

## 5. Data flow & authority (mirrors HQ's RPC + override posture)

```
@arganta/combat constants      (defaults in code — floor + ordering rules)
        ▲ read
hq_combat_tuning (Supabase)     (operator-only override rows, definer RPC like every HQ table)
        ▲ read at runtime
game client                     (effective = override ?? package default)
Battle Builder (HQ)             (edits DRAFT → Publish writes overrides via hq_combat_set)
```
- **Operator-only writes** (`hq_is_operator()`), everyone-nobody reads (same as growth
  RPCs). Live-ops tuning **without a redeploy**.
- **Design tool, not adjudicator** — the sim/console tunes numbers; actual match results
  still flow through pvp-concept's victim-authoritative (v1) / RPC (later) path.
- Package defaults are the floor: a bad/empty override → fall back to code (can't brick).

---

## 6. Why this is the PvP foundation (2nd bird)
The profile the console edits **is** `PVP_PROFILE`; the simulator **is** the balance model;
new subclasses/attacks flow into the matrix automatically. Wiring real PvP later (pvp-concept
§7) = making the live fight obey the numbers validated here. No separate "PvP balance project."

---

## 7. Build phases (later — concept only)
0. **Registry extraction** — expose combat constants as a structured registry in `@arganta/combat`.
1. **Surface scaffold** — `battle` SurfaceId + Rail entry + `BattleBuilder` shell + sub-tabs (read-only tables/curves). Proves the data model + "map by level" view. *No game change.*
2. **Chart variants** — add `heatmap`/`radar`/`tornado`/`multiline` to `charts.tsx`.
3. **Simulator (worker)** — port the sim; Overview + Simulator pages live.
4. **Sensitivity** — response/tornado/2-way.
5. **Editing + draft/publish** — sliders → `hq_combat_tuning` override + game reads it.
6. **Subclasses + extended attacks**; then feed the real PvP build.

Phases 1–4 are a **self-contained operator design tool** (zero game risk) and already
deliver the "simulate + sensitivity" ask. Phase 5 makes it steer the live game.

---

## 8. Open decisions
- **D1 — Live-tune the game (phase 5) or design-tool only for v1?** 1–4 never touch the game.
- **D2 — Registry home:** shared `@arganta/combat` (touches Kingdom PvE) vs a Lashira-only
  tunables package + package rules. (Recommend Lashira-only tunables.)
- **D3 — Subclasses now (schema) or later?** Recommend design the tree, seed 1 subclass.
- **D4 — PvE depth in v1:** HP/damage/level only, or full behavior/phase/loot editing?

---

*End. Plan only — nothing built. A new HQ Build-group surface: data-driven combat console +
ported duel simulator + sensitivity, operator-gated, reusing HQ's chart + theme systems.*

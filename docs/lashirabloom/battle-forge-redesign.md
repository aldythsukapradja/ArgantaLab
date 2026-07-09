# Battle Builder — from-scratch redesign in the Character-Lab feel (CONCEPT)

Dated 2026-07-09. A ground-up redesign of the HQ Battle Builder surface to match the
**Character Forge** atelier feel, restructured to the owner's spec, plus a new
**Monster Catalogue Lab**. Concept only — no code changed. See the mockup for the look.

## The owner's spec
1. **Start the design from scratch**, following the **Character Lab feel** (full-bleed
   atelier: top inventory bar, chunky tabs, 3-column workbench, animated pixel stage).
2. **Rename "Paths" → PVP**, **"Enemies & rewards" → PVE**, and **combine PVP + PVE into
   one page** — with **Publish inside that same page**. Only **Overview** stays separate.
3. **Create a Monster Catalogue Lab** for the future monster roster — same logic as the
   Character Builder: the pixel **mirrors from Kingdom**, has a **1:1 clone with
   LashiraBloom**, and exposes a **dungeon / area picker, XP, health, attack, rewards**,
   etc. per monster.

## 1. Design language (borrowed from `forge.css`, verbatim feel)

- **Full-bleed surface** (`character` is already `full` in Shell; make `battle` `full`
  too so it goes edge-to-edge — kills the side white space for good).
- **Top bar** — a gradient mark, a title (`Battle Builder` · `CIRCLE HQ · GAME COMMAND`),
  and a mono **inventory pill** (`4 paths · 6 monsters · 3 skills · 5 zones`).
- **Chunky tabs** — rounded-top, icon square + bold label + mono sub + right `tnum`,
  active tab underlined in `--acc` (exactly `.forge-tab`).
- **3-column workbench** (`.forge-work`, `250px | 1fr | 330px`) for the lab-style tabs:
  roster left · **animated pixel stage** center · pickers/settings right.
- **Theme-native**: HQ tokens (`--acc/--bg/--tx/--bd…`) + a thin scoped `--forge-*`
  atelier layer; light + dark.

## 2. Tab structure (all populated — no "coming soon")

| Tab | Icon · sub | What it is |
|---|---|---|
| **Overview** | 📊 · pulse | The separate dashboard — fairness, win matrix, PvE clear rates, roster health. |
| **Combat** | ⚔️ · pvp · pve · publish | The **one combined page**: PVP tuning + PVE tuning + Publish. |
| **Monster Lab** | 🐾 · roster · animate | The new **catalogue lab** — author the monster roster (Character-Lab-style). |

## 3. Overview (the only "different" tab)
A calm command dashboard (cards on the HQ canvas, not the 3-col workbench):
- **Fairness ring** + **win-matrix heatmap** + per-path win bars (the live sim).
- **PvE snapshot**: solo-clear level per monster, avg TTK, "walls" count.
- **Roster health**: N monsters · which zones covered · which still use placeholder art.
- **Hottest imbalance** callout → jumps to Combat on that matchup.

## 4. Combat — PVP + PVE + Publish on one page (scrolls)

One page, three stacked sections with a shared sticky **Publish** bar.

### 4a. PVP (was "Paths")
- The 4 path **cards** (Guardian/Shadow/Mystic/Arcanist), each: a **radar** (MAG/PHY/SPD/
  TANK/HEAL, filled in the path color), a role tag, big **live win%**, and **custom
  sliders** (`mag/phy/atkInt/moveRel/pvpHpMul/healMul`) styled like the Forge's controls.
- A compact **fairness strip** (ring + RMS + hottest matchup) pinned above the cards.

### 4b. PVE (was "Enemies & rewards")
- **Global PvE knobs** (Forge-style control rows): spawn **max-concurrent**, **respawn
  interval**, **roster** (which mobs), **XP ×** / **Bloom ×** reward multipliers.
- A **compact enemy quick-grid**: each monster's HP · ATK · XP · Bloom as inline steppers
  (fast balance pass). Deep per-monster authoring lives in the **Monster Lab** (§5).

### 4c. Publish (in-page)
- A **sticky footer** on the Combat page: `N changes staged` · fairness score · **Publish
  to LashiraBloom** (writes `hq_combat_publish`, operator-gated; game applies on boot).
  No separate Publish tab.

## 5. Monster Catalogue Lab — the new lab (the headline)

The Character-Lab pattern, aimed at **monsters** instead of heroes. A 3-column workbench:

### LEFT — the roster (future-extensible)
- A searchable list of monsters: 🐿️ Squirrel · 🦊 Fox · 🦡 Badger · 🐗 Boar · 🦌 Deer ·
  🐯 Tiger (boss) — each a row with a live mini-sprite, name, zone, and a tier badge.
- **＋ New monster** at the bottom → seeds a blank entry (id, emoji, placeholder art) so
  the roster **grows** as new woodland critters are added.

### CENTER — the animated monster stage (mirrors Kingdom, 1:1 with LashiraBloom)
The exact analogue of the Character Forge's `CompositeStage`:
- A big **pixelated stage** playing the selected monster's **walk cycle** (the real
  `farm-art/creatures/<id>/walk/<dir>/0..N.png`), with **direction S/E/N/W · play/pause ·
  speed · zoom** controls — identical control feel to Character Lab.
- Header: monster name · zone · `● live` · a **"1:1 · LashiraBloom"** provenance pill.
- **The art mirror (same logic as Character Forge):** Character Forge renders heroes via
  `@arganta/heroes-engine` with art **mirrored from the Kingdom host**
  (`VITE_KINGDOM_DATA_BASE`) and a plan for a **1:1 LashiraBloom mirror tree** (every
  cat/id/motion/frame twin, drop-a-PNG-to-replace). The Monster Lab mirrors that:
  - **Art source of truth = a shared bestiary-art base** (proposed `@arganta/bestiary-art`
    or the existing `creatures/` tree), authored in the **Kingdom pixel pipeline** so
    monster sprites match hero fidelity.
  - **1:1 LashiraBloom clone** — LashiraBloom keeps a mirror tree with the identical
    `id/direction/frame` geometry, so a Kingdom-authored monster drops straight into the
    game (and the game can override any frame locally). Same "mirror-manifest" idea the
    Character Forge roadmap already has.
  - Fallback chain (as built for the current bestiary): walk cycle → directional still →
    woodland emoji, so a brand-new monster with no art yet never breaks the stage.

### RIGHT — per-monster settings (the "put dungeon picker, XP, health, etc")
Forge-style slot rows, per selected monster:
- **Area / Dungeon picker** — which zone(s) it spawns in: Meadow · Grove · Cavern ·
  Battleground · **Dungeon (floor 1…)** — pills or ◀/▶ (drives `ZONE_MOBS` + a future
  dungeon-spawn table).
- **Role / tier** — Mob · Elite · **Boss** (boss reveals phase/enrage fields).
- **Health** · **Attack** · **XP reward** · **Bloom reward** — steppers/sliders (the real
  `BESTIARY.{hp,atk,xp,bloom}` the pipeline already tunes).
- **Move speed** (`speedMs`) · **spawn weight** · **drop table** (material · count · rate).
- **Boss-only**: telegraph, phases (HP% → add skill), enrage timer (design seams for the
  boss system that isn't built yet).
- A **Save / stage-to-Publish** action so Monster-Lab edits flow into the same
  `combat_tuning` config the Combat page publishes.

**Why this is a "lab," not a form:** like Character Lab, you *see* the creature move as
you tune it — pick a zone, bump its HP, watch its walk — and the roster is built to
**scale to many monsters** (the "future roster" ask), each a row you can add, art-swap,
and place.

## 6. Wiring (concept — reuses what exists)
- **Combat tuning** already flows through `@arganta/combat` (`hq_combat_publish` →
  `combat_tuning_active` → game boot). PVP/PVE/Monster-Lab all edit the **same config**;
  Publish is the same button. No new pipeline.
- **Monster art**: reuse the `creatures/` sprites (already copied into HQ) for the stage;
  formalize a shared bestiary-art package + 1:1 mirror manifest when the roster grows
  (sibling of `@arganta/heroes-engine` + the character mirror plan).
- **Full-bleed**: move `battle` from `wide` → `full` in `Shell.tsx` (like `character`).

## 7. Build phases (later — concept only)
1. Reshell Battle Builder to the Forge layout (top bar + tabs + `full`).
2. Overview dashboard (existing sim + roster health).
3. Combat page: fold PVP + PVE + Publish into one scroll with a sticky Publish footer.
4. Monster Lab: roster + `MonsterStage` (walk-cycle player) + per-monster settings.
5. Shared bestiary-art package + 1:1 mirror manifest (the Kingdom-mirror + drop-in clone).
6. Boss system fields (phases/enrage) once the boss mechanics are built.

*Concept only — the live `BattleBuilder.tsx` is unchanged. Sibling of
[character-registry] (Character Forge) and the `@arganta/combat` pipeline.*

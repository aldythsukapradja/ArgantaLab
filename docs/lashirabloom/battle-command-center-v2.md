# Battle Command Center — v2 concept (Overview + Combat, from scratch)

Dated 2026-07-09. Concept only, **no build.** Supersedes the layout of the current
`BattleBuilder.tsx` (kept building, but the Overview + Combat tabs are re-conceived
here). Sits on the same `@arganta/combat` publish pipeline. Companion to
[battle-forge-redesign.md](./battle-forge-redesign.md) and
[battle-command-audit.md](./battle-command-audit.md).

The ask (owner): rebuild Overview + Combat from scratch; design for **scale** (many
monsters); make it the **command center for monsters · monster drops · PvE · PvP ·
PvP rewards · boss rewards**. Battle-test the concept, find the gaps.

---

## 1. Diagnosis — why it still looks wrong (root causes, not symptoms)

The grid bug is fixed, but the tabs still read as *unfinished*. Four real causes:

1. **No density / no rhythm.** Every card is `flex` with content hugging the left, so
   the right 40–50% is dead space (the fairness ring + text, the win-rate bars that stop
   at 55%, the sparse "roster health" lines). It looks *empty*, which reads as *ugly*.
2. **Inline-style soup.** Everything is `style={{…}}` per element — there's no spacing
   scale, no shared card, no shared control. So nothing lines up to a grid; that's the
   "not pixel-perfect" feeling. There is no design *system*, just 400 one-off decisions.
3. **Layout that reflows on state.** The ordering/range **warning is a full-width card
   in the flow** — when it appears it shoves PvE + the enemy grid down. Validation must
   never move the content you're working on.
4. **Content-authoring masquerading as a dial.** The **enemy quick-grid** is a database
   (N monsters × stats × drops) crammed into a tuning page as flat stepper rows. It
   already overflows at 6 monsters (Tiger clipped). It cannot scale, and it *duplicates*
   the Monster Lab. This is the structural error.

The fix isn't "prettier CSS" — it's a **design system** + an **information architecture**
that separates *balancing* (dials) from *authoring* (a database) from *shipping* (publish).

---

## 2. The reframe — organize by the objects you command

A command center should be organized by **entity**, not by "a page called Combat that
holds everything." Combat conflates three jobs with opposite UI needs:

| Job | UI shape | Belongs to |
|---|---|---|
| **Balance** the 4 classes / world difficulty | dials + live fairness feedback | Combat |
| **Author** monsters (stats · drops · rewards) | a scalable database + detail editor | Bestiary |
| **Ship** a config | review + one commit | a persistent Publish bar |

**Decision: the enemy grid leaves Combat entirely.** Monsters live in the Bestiary
(today's "Monster Lab"), which is *built* to scale (roster list + detail editor). Combat
becomes purely dials. This removes the duplication AND the thing that couldn't scale, in
one move.

**Rewards are the connective tissue.** PvE kills, boss kills, and PvP wins all grant
rewards — but today only PvE kills do (per-monster `xp`/`bloom`/`drops`). PvP mints
*nothing* (rank is pure W/L, by design) and bosses have no special reward. So "the command
center for … PvP rewards, boss rewards" is a **new reward system** (§6), not a tweak — and
it has to respect two shipped rules: **PvP never mints Diamonds** (learning wall) and
**rank stays a season-long marathon** (daily cap + rising curve).

---

## 3. Information architecture

Four tabs, each owning one entity, plus a persistent Publish bar:

```
┌ Battle Builder ─────────────────────────────── 4 paths · N monsters · 3 zones ┐
│  [ Overview ]  [ Combat ]  [ Bestiary ]  [ Rewards ]                           │
├───────────────────────────────────────────────────────────────────────────────┤
│  Overview  — the pulse: fairness · economy · roster health · ⚠ attention feed  │
│  Combat    — DIALS only: PvP path balance  +  PvE world difficulty              │
│  Bestiary  — the scalable monster DB: roster → detail (stats · drops · zone)    │
│  Rewards   — the economy: PvE loot economy · Boss rewards · PvP rewards         │
├───────────────────────────────────────────────────────────────────────────────┤
│  ▲ N staged · fairness 80 · ⚠ 1 rule           [Reset]   [⚡ Publish to game]   │  ← persistent
└───────────────────────────────────────────────────────────────────────────────┘
```

Why **Rewards** is its own tab, not scattered: rewards are an *economy* that must be
reasoned about as a whole (a boss that drops a Mythril token vs. a PvP win that grants
bloom both feed the same wallets). Scattering them hides the total mint rate. The tab
still deep-links: "edit this monster's drops" jumps to the Bestiary detail; "boss reward"
lives here because it's about the *reward*, not the boss's HP.

> This document details the two the owner named — **Overview** and **Combat**. Bestiary
> (§5) and Rewards (§6) are specified enough to build against, since Combat's design
> depends on the enemy grid having somewhere to go.

---

## 4. Tab: Combat (dials only) — redesign

Two stacked sections, **each a self-contained band that never reflows**:

### 4a. PvP — path balance
- **A fairness rail across the top** (not a separate Overview-style card): the balance
  ring (compact, 88px) + the 4-cell win-matrix + "hottest matchup", in ONE horizontal
  strip. This fills the width and gives the section a header with live meaning.
- **4 path cards, one row** (`repeat(4, 1fr)` down to `auto-fit minmax(300px)`). Each card
  is redesigned to *fill*:
  - Left: a **bigger radar** (the identity read) — currently it's a tiny 124px afterthought.
  - Right: the 6 stat sliders, but **the value sits ON the fill** (a bubble on the thumb),
    not floating far right — kills the dead track space.
  - The live **win%** is the card's hero number, top-right, color-graded.
- **Inline validation, zero reflow.** If a stat breaks the owner-locked ordering
  (mage ≥ poet ≥ rogue ≥ warrior magic, etc.), *that slider row* gets a red left-accent +
  a ⚠ that tooltips the exact rule. **No warning card.** The card height is unchanged; the
  content you're tuning never moves. A count ("⚠ 1 rule") surfaces in the Publish bar.

### 4b. PvE — world difficulty (NO enemy grid)
Pure global dials, laid out as a **2×N control grid that fills the width**:
- Spawn: **max concurrent**, **respawn interval**.
- Difficulty: a single **"world difficulty" master** (scales all enemy HP/ATK by a factor)
  + a live "this makes the L10 Boar a X-hit kill" read so the abstract number means
  something.
- Economy: **XP ×**, **Bloom ×** (with a live "mint rate" read — see Rewards).
- A **"per-monster stats & drops → Bestiary"** link card where the grid used to be — an
  intentional hand-off, not an omission.

**Result:** Combat is now two clean bands of dials with live feedback, no database, no
reflow, no dead space.

---

## 5. Tab: Bestiary — the scalable monster database (where the grid went)

This is the answer to "I may add more monsters." Designed for 6 → 60 → 600.

**Layout — a 3-pane database (list · detail · preview), not a flat grid:**
```
┌ Roster (filterable) ─┬─ Detail editor ───────────────┬─ Live preview ─┐
│ 🔍 search            │  Squirrel   [Mob ▾]  [Meadow×] │   (animated    │
│ ─ Meadow (2) ─       │  ❤ 130  ⚔ 8  🏃 520ms         │    walk cycle) │
│  🐿 Squirrel   Mob   │  ⭐ 15xp  🌸 3bloom            │   S E N W ▶    │
│  🦊 Fox        Mob   │  ── Drops ──                   │                │
│ ─ Grove (2) ─        │  🪵 wood ×1-2  25%   [edit]    │  1:1 Lashira   │
│  🦡 Badger    Elite  │  + add drop                    │                │
│  🐗 Boar      Elite  │  ── Rewards → Rewards tab ──    │                │
│ ─ Cavern (1) ─       │                                │                │
│  🦌 Deer      Elite  │                                │                │
│ ─ Boss ─             │                                │                │
│  🐯 Tiger     Boss   │                                │                │
│ ⚠ Unplaced (0)       │                                │                │
│ [＋ New monster]     │                                │                │
└──────────────────────┴────────────────────────────────┴────────────────┘
```

**Scalability mechanisms (the point of the redesign):**
1. **Search + filter + sort** — by name, zone, tier, "unplaced", "boss". At 60 monsters you
   never scroll a flat list.
2. **Grouped roster** — sectioned by zone (with counts), so structure is visible. An
   **"⚠ Unplaced"** group makes the "monster with no zone" failure impossible to miss.
3. **Virtualized list** — only render visible rows; 600 monsters stays smooth.
4. **Detail editor, not inline steppers** — editing one monster at a time means each field
   can be a proper control (not a 3px stepper), and the card count never blows up the page.
5. **Bulk ops** — multi-select → "×1.2 HP", "assign to Grove", "apply drop template". The
   thing you can't do in a flat grid.
6. **Table view toggle** — a dense sortable table for scanning all stats at once (the good
   part of the old grid), *plus* the card/detail view for editing. Two views, one dataset.
7. **Templates** — "Mob / Elite / Boss" stat+drop presets so a new monster starts sane.

**The load-bearing dependency:** truly *adding* a monster (not just tuning the 6) needs the
roster to be **data, not code**. Today `BESTIARY` is a hardcoded object; the pipeline can
override existing keys but can't create new ones, and there's no sprite for a new id. See
§8 — this is the #1 gap.

---

## 6. Tab: Rewards — the economy (the new system)

Today's reward surface = per-monster `xp`/`bloom`/`drops` + global `xpMul`/`bloomMul`. That's
it. The command-center vision needs three reward *domains*, one coherent model:

**A unified reward bundle** (reused everywhere): `{ xp, bloom, drops:[{k,min,max,p}], items:[…] }`.

### 6a. PvE loot economy
- The global `xpMul` / `bloomMul` (moved here from Combat, shown with a **live mint-rate
  read**: "at these rates a 30-min session mints ~X bloom" — so tuning has consequence).
- Drop-table **templates** (edit once, apply to many monsters via the Bestiary).
- A **mint-vs-sink** mini-chart (rewards in vs. shop/upgrade costs out) — the whole reason
  to have a Rewards tab: see the economy, not one number.

### 6b. Boss rewards (NEW)
Bosses need more than a flat drop table. Config extension on `enemies[bossId].boss`:
- **First-clear bundle** — a one-time-per-circle reward (the "we beat the Tiger!" moment).
- **Repeat reward + lockout** — `none | daily | weekly` so a boss isn't farmable infinitely.
- **Party rule** — `everyone-gets-full` vs `split` (co-op fairness).
- **Phase/enrage hooks** — reward seams for when the boss-phase system lands (design seam,
  not wired — honest placeholder).

### 6c. PvP rewards (NEW — and a real design decision)
**This changes the shipped PvP model** (which is "pure W/L, mints nothing" — the migration
says so explicitly). Adding rewards must honor two locked rules:
- **No Diamonds** (learning wall) — PvP may grant **bloom** and cosmetic unlocks only.
- **Season marathon** — a **daily cap** + rising curve, never flat/uncapped
  (rank-season-tuning memory).

Proposed config `pvpRewards`:
- `perWin: { bloom }` — small per-KO trickle.
- `dailyCap: { bloom }` — the marathon guard.
- `rankTiers: [{ atWins, reward:{bloom, cosmeticId?} }]` — milestone bundles (10 wins → …).
- **No `xp`, no `diamonds` fields exist** in the schema — the wall is enforced by the *shape*,
  not just a rule.

All three write to the same `combat_tuning` config → the same Publish button. No new pipeline.

---

## 7. Tab: Overview — redesign (the pulse)

Fix the sparseness with **density + a proper KPI row + an attention feed**:

- **KPI strip (top, 4 tiles):** Fairness score · Economy balance (mint/sink %) · Roster
  (N monsters, M zones) · **⚠ Needs attention** (count). Fills the width, scannable in 1s.
- **Fairness + Win-matrix** side by side (as now, but the fairness card's right half gets
  the per-path win *bars inline* instead of a separate sparse card — kills the dead space).
- **Attention feed** (this is where warnings LIVE): unplaced monsters, broken ordering,
  unpublished changes, "boss has no first-clear reward", economy running hot. Each row
  deep-links to the fix. **This is why Combat needs no warning card** — attention is a
  dashboard concern, surfaced once, here.
- **Roster health** becomes a compact **zone-coverage bar** (visual, not text lines):
  Meadow ██ · Grove ██ · Cavern █ · Boss █, with the unplaced count as a red segment.

---

## 8. Visual design system (the "pixel-perfect" fix)

Stop the inline-style soup. One scoped system (`.battleforge`, `bf-` prefix), tokens + a
handful of real components:

- **Spacing scale:** `4 · 8 · 12 · 16 · 20 · 24 · 32`. Nothing off-scale.
- **`.bf-card`** — one card: 16px pad, 14px radius, `--bd2` border, `--shadow-sm`. Every
  card looks identical.
- **`.bf-sec`** — one section header (icon chip + title + sub + divider). Already added.
- **`.bf-field`** — one labeled control row (label · control · value) at a fixed 32px
  height, value pinned to the control (bubble-on-thumb), so tracks never dead-space.
- **`.bf-grid`** — `display:grid` with a fixed gap; columns are the ONLY per-instance
  decision. (The bug last round was this class never existed.)
- **Density:** fill the width — 4-across path cards, 2-across dial grids, KPI rows. No card
  wider than its content needs while leaving >30% empty.
- **Status color is separate from identity color:** path colors (amber/teal/violet/pink) =
  identity; `ok/warn/bad` = validation only. Never mix.
- **No-reflow rule (hard):** validation, "staged" counts, and async results render into
  **reserved slots** (the Publish bar, an inline slider accent) — never a new block that
  pushes content.
- **Responsive:** path cards `auto-fit minmax(300px)`; Bestiary 3-pane → tabs on narrow;
  the whole surface already full-bleed.

---

## 9. Battle test — stress the concept, find the gaps

| # | Scenario | What the design does | Verdict |
|---|---|---|---|
| 1 | Add a 7th monster ("Wolf") | Bestiary → ＋New → picks a template → lands in **⚠ Unplaced** until a zone is assigned; emoji until art exists | ✅ *design* handles it — ⚠ **needs registry-as-data to actually persist a new id** (§ gap A) |
| 2 | Roster grows to 40 | Search/filter/group/virtualize keep it usable; table view for scanning | ✅ handled by design |
| 3 | Tiger drops a unique weapon on first clear only | Rewards → Boss → **first-clear bundle** + lockout | ⚠ **new schema** (`boss.firstClear`) — not built |
| 4 | PvP wins should give bloom, capped | Rewards → PvP → `perWin.bloom` + `dailyCap` | ⚠ **new schema + changes shipped "mints nothing" model**; must NOT expose a diamonds field |
| 5 | Ordering warning fires while tuning | Inline red accent on the offending slider + count in Publish bar; **nothing moves** | ✅ solves the reported reflow bug |
| 6 | Narrow screen / tablet | path cards wrap, Bestiary 3-pane → sub-tabs | ✅ by design (needs the responsive CSS) |
| 7 | Two operators, or editing while game is live | Draft → Publish is atomic (existing pipeline); last-publish-wins | ⚠ **no draft locking / no diff-review** — acceptable for a solo operator, flag for multi |
| 8 | Undo a bad bulk edit | — | ❌ **gap: no undo / no draft history** — a bulk "×1.2 HP" is one-way |
| 9 | "Is my economy healthy?" | Rewards mint-vs-sink chart + Overview KPI | ⚠ **needs a real economy model** (mint rate is derivable; sink side needs shop/upgrade costs wired) |
| 10 | Preview a monster with no sprite yet | walk→still→emoji fallback (already built) | ✅ |

**Verdict:** the *information architecture* and *visual system* fully solve the "ugly +
doesn't scale" problem (scenarios 1-design, 2, 5, 6, 10). The **reward domains + adding
monsters + undo** are real build dependencies, not just UI.

---

## 10. Gaps & dependencies (what must exist for this to be real)

| Gap | Blocks | Effort |
|---|---|---|
| **A. Registry-as-data** — `BESTIARY`/roster in the DB, not a code const, so HQ can *create* monsters | "Add monster" (scenario 1) — the whole Bestiary scalability promise | Large (the load-bearing one) |
| **B. Boss-reward schema** — `enemies[id].boss.{firstClear, lockout, party}` + game wiring | boss rewards (scenario 3) | Medium |
| **C. PvP-reward schema** — `pvpRewards` + a `pvp_grant` path, respecting no-diamond + daily-cap | PvP rewards (scenario 4); **also a product decision** (changes the "mints nothing" model) | Medium + owner sign-off |
| **D. Economy model** — sink side (shop/upgrade/gear costs) surfaced so mint-vs-sink is real | Rewards tab's whole point (scenario 9) | Medium |
| **E. Draft history / undo** | bulk-edit safety (scenario 8) | Small–Medium |
| **F. Sprite-add pipeline** — the 1:1 mirror tree so a new monster can get real art | new-monster art (not just emoji) | Medium (per battle-forge-redesign §5) |

**Sequencing:** the UI redesign (§4, §7, §8) is buildable *now* on today's data (it just
reorganizes + restyles what exists, minus the moved grid). The **reward tabs and
add-monster** need A–D first. So: **restyle Overview + Combat + move the grid to a scalable
Bestiary now; add the Rewards tab + registry-as-data as the next phase.**

---

## 11. Build phases (when it's time)

1. **Design system** — `bf-card / bf-sec / bf-field / bf-grid` + tokens; kill inline styles.
2. **Overview v2** — KPI strip + attention feed + dense fairness/matrix + zone-coverage bar.
3. **Combat v2** — PvP fairness-rail + fill-the-width path cards + inline validation (no
   reflow); PvE dials only (grid removed, hand-off link).
4. **Bestiary** — 3-pane DB (search/filter/group/virtualize/table-toggle/bulk/templates) —
   the grid's real home. (On today's 6 monsters first; scales for free.)
5. **Registry-as-data (Gap A)** — unlock *adding* monsters.
6. **Rewards tab** — PvE economy + Boss rewards (Gap B) + PvP rewards (Gap C, w/ sign-off).
7. **Economy model (Gap D)** + draft history (Gap E).

*Concept only — nothing built. The mockup shows the visual target for phases 2–3.*

# Curriculum Wave 2 — Implementation Spec (Opus design → Sonnet build)

**Status:** design locked, ready to implement. Every judgment call is resolved below —
there are no open decisions. Build against this verbatim, then commit.

**Goal:** fix "sometimes too hard, sometimes too easy" by making item selection target
the learner's Zone of Proximal Development (~75% success), and replace the single raw-%
mastery bar with Khan-style levels.

**Hard scope boundary (do NOT cross):** this is *client-side only*. No Supabase schema
change, no migration, no RLS, no server RPC change. The learner's ability rating floats
locally; item difficulty stays the authored `seedRating` (static). Adaptive *item* ratings
(which need cross-user aggregation on the server) are explicitly out of scope — future Wave 3.

---

## The model (fixed — do not re-derive)

Standard Elo, scale 400.

- **Item rating** `Ri` = `seedRating(item)` — already implemented in `adaptive.ts`. Static.
  (tiny/d1 = 400 … legend/d5 = 1560; formula `400 + stageIdx*200 + (rung-1)*40`.)
- **Learner rating** `Ru` — per `${world}/${skill}`, floats. Stored locally (see below).
- **Expected success** of learner on item:
  `E(Ri, Ru) = 1 / (1 + 10^((Ri - Ru) / 400))`
- **Target success** `p* = 0.75`. Acceptable window `[0.70, 0.85]`.
- **Update on each attempt** (outcome `S` = 1 correct, 0 wrong):
  `Ru += K * (S - E)`   (item rating is NOT updated — it's static)
- **K-factor (learner responsiveness), by attempts seen in that skill `n`:**
  `n < 5 → K = 40`, `5 ≤ n < 20 → K = 24`, `n ≥ 20 → K = 16`.
  (Responsive early when we know little, stable once we know the kid.)
- **Cold-start learner rating** (first attempt in a skill):
  `STAGE_BASE + 260` where `STAGE_BASE = 400 + stageIdx*200` for the learner's *current*
  stage. This places the 75%-success target near the middle of their stage band, so a
  brand-new learner gets mid-stage items at ~75% success (verified: explorer cold-start
  Ru=1060 → in-stage items span E≈0.64–0.85, centered ~0.75).

Worked sanity check (keep, don't change): explorer STAGE_BASE=800, cold Ru=1060.
Target item rating = Ru − 190 ≈ 870 (rung 2–3). As Ru rises with success the target
climbs toward stage+1 rungs; as it falls it drops toward stage−1. The ±1 stage cap in
`stageFallback` (below) bounds how far it can drift.

---

## File-by-file changes

### 1. `src/lib/adaptive.ts` — learner rating + ZPD selection

**Extend `SkillState`** (line 9) to carry the rating and an attempt counter:
```ts
export interface SkillState { mastery: number; box: number; lastSeen: number; rating?: number; n?: number }
```
`rating`/`n` are optional so old localStorage blobs still parse (treat missing as cold-start).

**Add helpers:**
```ts
const K_SCALE = 400
export function expectedSuccess(itemRating: number, learnerRating: number): number {
  return 1 / (1 + Math.pow(10, (itemRating - learnerRating) / K_SCALE))
}
function kFactor(n: number): number { return n < 5 ? 40 : n < 20 ? 24 : 16 }
function coldStart(stage: string): number {
  const idx = Math.max(0, STAGE_ORDER.indexOf(stage))   // STAGE_ORDER already defined in file
  return 400 + idx * 200 + 260
}
export function getRating(world: string, skill: string, stage: string): number {
  return load()[`${world}/${skill}`]?.rating ?? coldStart(stage)
}
```

**Update `recordAttempt`** (line 23) to also float the rating. Its signature must gain the
item's rating so it can update Elo. New signature:
```ts
export function recordAttempt(world: string, skill: string, correct: boolean, itemRating: number, stage: string)
```
Inside: keep the existing mastery/box logic unchanged (the dashboard still reads those),
then additionally:
```ts
const n = (cur.n ?? 0)
const Ru = cur.rating ?? coldStart(stage)
const E = expectedSuccess(itemRating, Ru)
const rating = Ru + kFactor(n) * ((correct ? 1 : 0) - E)
store[k] = { mastery, box, lastSeen: Date.now(), rating, n: n + 1 }
```

**Rewrite `pickItems`** (line 41) to target the ZPD instead of `(1-mastery)+random`:
```ts
export function pickItems(candidates: Item[], count: number, stage: string): Item[] {
  if (candidates.length <= count) return shuffle(candidates)
  const scored = candidates.map(i => {
    const Ru = getRating(i.world, i.skill, stage)
    const E = expectedSuccess(seedRating(i), Ru)
    // distance from the 0.75 sweet spot; small jitter so sessions vary
    const score = Math.abs(E - 0.75) + Math.random() * 0.05
    return { i, score }
  })
  scored.sort((a, b) => a.score - b.score)
  return scored.slice(0, count).map(s => s.i)
}
```
Note the new `stage` param — update the call site (see §3).

**`repairItem`** (now ~line 70): keep, but retarget from "absolute lowest difficulty" to
"~0.85 success" so the repair item is reliably-but-not-trivially easier:
```ts
export function repairItem(pool: Item[], missed: Item, alreadyUsed: Set<string>, stage: string): Item | null {
  const Ru = getRating(missed.world, missed.skill, stage)
  const cands = pool.filter(i => i.skill === missed.skill && !alreadyUsed.has(i.id) && i.id !== missed.id)
  if (!cands.length) return null
  return cands.sort((a, b) =>
    Math.abs(expectedSuccess(seedRating(a), Ru) - 0.85) -
    Math.abs(expectedSuccess(seedRating(b), Ru) - 0.85))[0]
}
```

### 2. `src/lib/content.ts` — cap stage widening at ±1

**Replace `stageFallback`** (lines 106–117) so it never widens beyond one stage either side:
```ts
function stageFallback(stage: string): string[] {
  const i = STAGE_ORDER.indexOf(stage)
  if (i < 0) return ['explorer']
  const out = [stage]
  if (STAGE_ORDER[i - 1]) out.push(STAGE_ORDER[i - 1])
  if (STAGE_ORDER[i + 1]) out.push(STAGE_ORDER[i + 1])
  return out
}
```
`getItems` (lines 122–133) is otherwise unchanged — it already stops once it has `want`
items. After Wave 1 no cell is starved within ±1, so this is safe. If a pool still comes
back under `want`, that's acceptable (pickItems handles short pools) — optionally
`console.debug('[content] thin cell', world, skills, stage)` to surface it, but do not
re-widen.

### 3. `src/components/learn2/ItemPlayer.tsx` — thread `stage` through

- Line 62: `pickItems(pool, Math.min(node.itemCount, pool.length || node.itemCount), stageKey)`
- Line 79: `recordAttempt(item.world, item.skill, correct, seedRating(item), stageKey)`
  (import `seedRating` from `@lib/adaptive`)
- Line 86: `repairItem(poolRef.current, item, usedRef.current, stageKey)`

`stageKey` is already in scope in this component.

### 4. `src/lib/parentDash.ts` — Khan-style mastery levels

Add a level derivation (do NOT remove `masteryGrid`'s `pct` — keep it; add levels alongside
so nothing else breaks). Uses only existing server fields (`mastery`, `box`) — no new data:
```ts
export type MasteryLevel = 'not-started' | 'attempted' | 'familiar' | 'proficient' | 'mastered'
export function masteryLevel(m: { mastery: number; box: number } | undefined, attempted: boolean): MasteryLevel {
  if (!m && !attempted) return 'not-started'
  const x = m?.mastery ?? 0, box = m?.box ?? 1
  if (x >= 0.85 && box >= 4) return 'mastered'
  if (x >= 0.6)  return 'proficient'
  if (x >= 0.35) return 'familiar'
  return 'attempted'
}
```
Thresholds are FINAL (do not tune): mastered needs both high mastery AND a survived
spaced-rep cycle (`box ≥ 4`), matching "retained, not just answered once."

Extend `GridCell` with `level: MasteryLevel` and set it in `masteryGrid` (line 135):
```ts
const m = map.get(`${w.key}/${s.key}`)
return { world: w, skill: {...}, pct: m ? Math.round(m.mastery*100) : null,
         level: masteryLevel(m, !!m) }
```

### 5. UI — swap the single bar for a level chip

Wherever the dashboard renders the mastery grid `pct` bar (grep for `masteryGrid`,
`.pct`, and the "% mastered" copy — likely `FamilyPulse.tsx` and the coverage section),
render `cell.level` as a labelled chip/segment instead of, or above, the raw bar. Five
states, five colors (reuse `STAGE_META`-style palette): not-started (grey), attempted
(amber), familiar (blue), proficient (green), mastered (gold). Keep the numeric `pct` as
a secondary/hover detail — don't delete it, just demote it.

---

## Tests (add `src/lib/adaptive.test.ts`, extend as needed)

Currently zero tests touch `adaptive.ts`/`content.ts`. Add:

1. `expectedSuccess`: equal ratings → 0.5; item 190 below learner → ≈0.75 (±0.01);
   item 400 above → <0.1.
2. `recordAttempt` raises rating on correct, lowers on wrong; magnitude of first update
   (n=0) larger than the 25th (n≥20) for the same E gap (K decay).
3. Cold-start: `getRating` for an unseen skill returns `STAGE_BASE + 260` for that stage.
4. `pickItems`: given a pool spanning difficulties, a learner seeded low gets items whose
   mean `expectedSuccess` is closer to 0.75 than a random draw would be; a learner seeded
   high gets harder items. (Seed the local store directly, then assert on selection.)
5. `stageFallback`: returns at most `[stage, stage-1, stage+1]`; never length > 3; edges
   (tiny, legend) don't throw and don't include out-of-range stages.
6. `masteryLevel`: table test across the five bands incl. the `box ≥ 4` gate for mastered.

Also re-run the existing suite — `content.test.ts` must still pass (108 tests green today).

---

## Definition of done

- `npx vitest run` green (existing 108 + new).
- `npx tsc --noEmit` clean.
- Manual smoke: seed a low learner rating for one skill in localStorage, play that node,
  confirm easier items surface; seed high, confirm harder items surface.
- Commit to **main** (per repo rule — never a feature branch). Suggested message:
  `Curriculum W2: ZPD item selection (Elo) + Khan-style mastery levels`.
  Include: `adaptive.ts`, `content.ts`, `ItemPlayer.tsx`, `parentDash.ts`, the UI file(s),
  `adaptive.test.ts`, and this spec. Leave the unrelated `apps/landing` working changes
  untouched — stage only the files above.

## Explicitly OUT of scope (do not build now)
- Server-side / cross-user adaptive *item* ratings (needs a migration) — future Wave 3.
- Any change to `log_learn_event` or the `skill_mastery` table.
- Reworking the Bloom/competency derivation in `taxonomy.ts`.

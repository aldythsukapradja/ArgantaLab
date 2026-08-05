# Petroleum-system chart — completion state

**2,332 of 2,332 chart cells populated (100.00%).** All 212 models carry all 11 canonical
rows (4 essential elements + 7 processes). All 179 basins carry a cycle framework.

**Read the second table before quoting the first one.** The chart is complete in *shape*.
It is not complete in *evidence*, and the gap between those two is the whole story.

## Where it started and where it is

| | before | after |
|---|---|---|
| chart cells filled | 611 / 2332 (26.2%) | **2332 / 2332 (100.00%)** |
| models with 0 of 11 rows | 110 | **0** |
| models with all 11 rows | 0 | **212** |
| basins with a cycle framework | 1 / 179 | **179 / 179** |
| basin cycle rows | 4 | **630** |

## What the rows actually are

| provenance | rows | meaning |
|---|---|---|
| `evidence-derived` | 918 elements | normalised from a cited USGS narrative |
| `modelled` | 289 events | numeric interval from authority text |
| `derived-rule` | 616 elements + 1,195 events | **inference** — produced by a stated rule |
| `interpreted` | 10 elements | the reviewed Viking Graben framework |

**1,207 of 3,028 rows are evidence-backed. The remaining ~60% is reasoned inference.**
Nine event rows are worse than that and are marked `speculative` — see below.

## The derivation rules

Every derived row names its rule in `notes` and carries `provenance: derived-rule`.

**Elements, from the basin cycle framework**
- a cycle whose `dominant_role` is source/reservoir/seal *is* that element for the basin —
  this makes the tectonostratigraphy and petroleum-system charts consistent by
  construction rather than by coincidence
- seal fallback: the interval directly overlying the youngest reservoir
- overburden: the section above the youngest timed element, to the present
- lithology fallbacks (source→shale/organic/lacustrine/coal, reservoir→sandstone/
  carbonate/reef) used only where no cycle claims the role outright

**Processes, from the Magoon & Dow event-chart convention**
- `expulsion` ≈ the generation window
- `migration` ≈ at/after generation
- `accumulation` ≈ migration, clamped to begin no earlier than the **onset** of trap
  formation — charge cannot pool in a structure that does not yet exist
- `preservation` = onset of accumulation → present
- `critical-moment` = end of the main generation-migration phase. This is a **convention
  pick, not a burial/thermal result**, and must never be read as one
- `trap-formation` = the basin's structuring cycle (compressional, else extensional)

## The nine speculative rows — the weakest thing here

Nine `generation` rows are marked `certainty: speculative`. These are frontier and
oceanic basins — **Eurasia Basin (×4), Lomonosov-Makarov (×2), Long Strait, Vilkitskii,
Yucatán Platform, Farah** — whose source interval is deposited to the present day, so no
post-deposition window exists at all. The permissive envelope written there has *no
burial or thermal basis whatsoever*.

For several of these the honest finding may be that **no petroleum system exists to
chart**. Deciding that is the single highest-value review item in this dataset. Until
then those rows are placeholders, not claims.

## Upstream defects this surfaced

The chronology gate found **35 violations that live entirely in evidence rows** — nothing
this programme wrote. They are reported, deliberately **not** overwritten, because
replacing evidence with a rule to make a test go green destroys the thing that made the
row worth having.

| defect | models | example |
|---|---|---|
| migration precedes generation | 21 | both `modelled` from extraction |
| preservation does not reach the present | 10 | all `modelled` |
| generation precedes source deposition | 4 | one model: generation 66→0 Ma from a **Miocene (23 Ma)** source; another spans 486.85→2.58 Ma, a 484-Myr "window" that is plainly an envelope over disjoint age terms |

These belong to the extraction lane. They indicate age-phrase envelopes being merged
across unrelated AUs.

Separately: **model `201601` was missing its `generation` row entirely** — 6 of 7 process
rows, so the sheet held 1,483 rows where 212 × 7 = 1,484. Added.

## Gates

```bash
cd apps/energy
node scripts/build-master-kb.mjs
node scripts/test-basin-cycles.mjs   # 18 checks — cycle integrity, recall pairing
node scripts/test-ps-chart.mjs       # 16 checks — completeness, chronology, grade discipline
node scripts/test-dataqc.mjs         # 103
node scripts/test-engine.mjs         # 46
```

`test-ps-chart.mjs` separates violations **we** caused (hard fail) from violations in
evidence rows (reported). It also enforces that no model carrying derived rows exceeds
**G1**, and that no G3/G4 model exists without a named reviewer.

## In the UI

Derived bars render at full length — the interval is a real claim — but visibly lighter
with a hatched overlay; speculative bars are near-transparent and dashed. A complete
chart can therefore never be mistaken for a fully evidenced one at a glance. Tooltips
say `— DERIVED by rule, not evidence`.

## What "finishing" now means

Filling cells is done. The remaining work is **replacing inference with evidence**:

1. resolve the 9 speculative rows — confirm or explicitly zero those basins
2. fix the 35 evidence chronology defects in the extraction
3. verify the 626 recalled cycles — see `VERIFICATION-QUEUE-basin-cycles.md`
4. convert `derived-rule` rows to cited rows, highest-value basins first

A model only leaves G1 when its rows stop being inference. Today **none of the 212 has.**

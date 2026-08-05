# Handoff — completing the petroleum-system & tectonostratigraphy charts

Audience: an agent (Sonnet) picking up chart completion. Written 2026-08-03 after a
measured audit. Everything below was produced by running the queries in §7 — re-run
them before trusting any number here, because Codex writes the workbook continuously.

---

## 1. Coordination — read this before touching anything

Three parties can write this repo. Stay in your lane or you will collide.

| Party | Owns | Tool |
|---|---|---|
| **Codex** | `ArgantaEnergy-Master-KB.xlsx`, `.codex/tmp-petsys/build-workbook.mjs` | `@oai/artifact-tool` |
| **You (Sonnet)** | derivation scripts + app integration | ordinary file tools |
| **App** | `apps/energy/**` | — |

**Confirm Codex's state first.** If Codex is still running, do **not** write the
workbook directly — you have no `@oai/artifact-tool` and a concurrent write corrupts
it (observed: `build-master-kb.mjs` failed mid-write once, succeeded on retry).

Safe pattern while Codex runs: **emit candidate rows as JSON** under
`.codex/tmp-petsys/` for Codex's builder to consume, and do all app-side work freely.

---

## 2. Where things actually stand

Petroleum-system chart = **11 canonical rows** (4 essential elements + 7 processes)
across **212 models**. Tectonostratigraphy = **3 tracks** across **180 basins**.

**Element rows** — models covered, of 212:

| row | models | % |
|---|---|---|
| reservoir | 92 | 43% |
| source | 85 | 40% |
| seal | 52 | 24% |
| **overburden** | **3** | **1%** |

**Process rows** (numerically timed):

| row | models | % |
|---|---|---|
| generation | 92 | 43% |
| trap-formation | 66 | 31% |
| migration | 46 | 21% |
| critical-moment | 16 | 7% |
| preservation | 14 | 6% |
| accumulation | 6 | 2% |
| expulsion | 4 | 1% |

**Rows complete per model:** 110 models at **0 rows**; distribution peaks at 5–6; the
best model anywhere reaches **8 of 11**. None has reached 11.

**Tectonostratigraphy:**

| track | coverage |
|---|---|
| geologic period (ICS) | 180 / 180 — universal, always draws |
| timed elements | 80 / 180 |
| **basin cycle** | **1 / 180** (Viking Graben, 4 cycles) |

Net, per basin: **1** basin has all three tracks · **79** have period+elements ·
**100** have the period track only.

---

## 3. The finding that should drive the plan

**The extraction stream is exhausted for 5 of the 11 rows.** Measured against the
feeder tables (`PS Element Candidates` n=775, `PS Process Evidence` n=516):

| feeder | rows | with age terms |
|---|---|---|
| candidate · source | 270 | 222 |
| candidate · reservoir | 270 | 218 |
| candidate · seal | 235 | **0** |
| candidate · overburden | **0 — category absent** | — |
| evidence · generation-maturation | 263 | 209 |
| evidence · migration | 253 | **0** |
| evidence · trap/expulsion/accumulation/preservation/critical-moment | **0 — absent** | — |

So: **more extraction from the same USGS corpus cannot finish the chart.** Seal
candidates carry no ages, overburden was never a candidate category, and five process
types have no evidence rows at all. This is expected — USGS AU narratives report
source/reservoir/seal/trap because those are the *assessment* inputs; they rarely state
overburden or expulsion timing.

Plan accordingly: split the work by **how a row can legitimately be obtained**.

---

## 4. Strategy — four tiers, in priority order

### Tier A · Promote what is already extractable *(highest value / lowest risk)*
Feeder exists **and** carries age terms. Pure normalisation, no new interpretation.

- ~222 source + ~218 reservoir candidates with `reported_age_terms` not yet promoted
- ~209 `generation-maturation` evidence rows with age terms

Normalise the age phrase against ICS 2026/06 and write a `PS Elements` / `PS Events`
row with `provenance: evidence-derived`, the `source_reference` URL and the
`source_citation_id` carried through. **Keep the original phrase in `notes`.**

Expected: lifts source/reservoir/generation coverage toward ~90% of the 102 G1 models.

### Tier B · Derive by rule from data already held *(needs explicit "derived" provenance)*
No new source, but this **is** inference — it must never be labelled authority-sourced.

- **overburden** = stratigraphic section younger than the youngest timed seal/reservoir
  in that model. Derivable wherever a strat column or timed elements exist.
- **seal timing** = the interval immediately overlying a timed reservoir, where the
  candidate names a seal but gives no age.
- **migration** = conventionally at or shortly after generation. 253 migration
  evidence rows exist with no ages; generation timing is known for 92 models.

Mark every Tier-B row `certainty: derived-rule`, `event_status: derived`, and add it to
the gap ledger as *still requiring review*. **Do not let a Tier-B row raise a model's
grade above G1.**

### Tier C · Requires new research
- **trap-formation** — structural restoration; not in the AU narratives
- **expulsion / accumulation / preservation** — rarely stated separately
- **critical moment** — gate this hard. Handoff rule stands: require explicit
  peak-generation timing or an integrated burial/charge interpretation. **Never infer
  one from a general maturity sentence.**
- 110 TPS with no exact DDS-60 narrative alignment
- 9 catalogue-only basins (Eurasia, Franklinian Shelf, Helmund–Baluchistan, Jan Mayen,
  Katawaz, Long Strait, Mezen', Novaya Zemlya, Tunguska)

### Tier D · Basin cycles — the biggest *visible* gap
**1 of 180.** The middle column of the tectonostratigraphy chart is empty for 99.4% of
basins, and **no feeder stream exists** — `PS Element Candidates` and `PS Process
Evidence` feed the petroleum-system chart only.

Bootstrap order:
1. The **10 basins with a reviewed classification** (`Basin.classification_status =
   source-classified`) — Neuquén and Rub al Khali are the named next two.
2. Basins with **timed elements** (80) — element age clusters plus the province
   narrative's tectonic vocabulary ("rift", "passive margin", "foreland") give a
   defensible first cycle stack.
3. Everything else needs genuine interpretation.

Each cycle row needs: numeric start/end, geodynamic stage, basin fill, dominant
lithology, PS contribution, citation. **`cycle_id` must match the value
`PS Elements.basin_cycle_id` points at** — the in-code seed uses short ids
(`pre-rift`) that will never join; use the full `atlas:basin-cycle:...` form.

---

## 5. Known data defect to fix at source

**22 of 714 `PS Elements` name a LITHOLOGY where a formation belongs** — `Coal`×8,
`Shale`×6, `Carbonate`×5, `Sandstone`×3, across North Sea Graben (8), Tarim (5),
Junggar (4), Middle Caspian (2), Alberta (2), Dnieper-Donets (1). The extractor lifted
a lithology word out of prose as a unit name.

The app **flags** these (hatched bar + `?`, via `isLithologyName()` in
`basin-insight.ts`) rather than hiding them. **Fix belongs in the extraction**, not the
app. Add a lithology stop-list to the candidate parser.

Related: a TPS can carry both an auto-normalised `catalog-v1` model and a reviewed AU
model, **both graded G1**. The app now prefers the more curated one (share of elements
with assessed `effectiveness`). Consider grading auto-normalised models **G0** so the
distinction lives in the data.

---

## 6. Hard constraints — do not violate

- **Never fabricate geological timing.** Unknown stays `not-modelled`; never zero.
- **`modelled` process row = an evidence-derived numeric interval exists.** It is *not*
  a claim of burial-history calibration. Keep the milestones separate:
  `G0` catalogue · `G1` evidence-derived · `G2` complete + peer checked ·
  `G3` burial/thermal calibrated · `G4` reviewed and approved.
- Carry `source_reference` + `source_citation_id` on every promoted row.
- **Never** turn a province-level publication into TPS-level bars without explicit
  scope evidence — multi-province USGS pubs contain formations from unrelated provinces.
- No placeholder reviewers. No model currently has a named technical reviewer; leave it
  empty rather than inventing one.
- Age phrases normalise against **ICS 2026/06**.

---

## 7. Query recipes — re-measure before and after

```bash
cd apps/energy && node scripts/build-master-kb.mjs   # regenerate; RETRY on failure
```

Chart-row coverage (§2):
```bash
python -c "
import json,collections
d=json.load(open('apps/energy/public/kb/master-kb-spine.json',encoding='utf-8'))
ROLES=['source','reservoir','seal','overburden']
el=collections.defaultdict(set); ev=collections.defaultdict(set)
for e in d['psElement']: el[e['model_id']].add(e['element_role'])
for e in d['psEvent']:
    if e.get('start_ma') is not None and e.get('end_ma') is not None: ev[e['model_id']].add(e['event_type'])
print('elements:', collections.Counter(r for s in el.values() for r in s if r in ROLES))
print('processes:', collections.Counter(t for s in ev.values() for t in s))
print('rows/model:', collections.Counter(len(el[m['model_id']]&set(ROLES))+len(ev[m['model_id']]) for m in d['psModel']))
"
```

Tectonostratigraphy coverage (§2) and feeder exhaustion (§3) — same pattern over
`basinCycle`, `psElementCandidate`, `psProcessEvidence`.

---

## 8. Validation after every change

```bash
node .codex/tmp-petsys/build-workbook.mjs      # Codex's lane only
cd apps/energy
node scripts/build-master-kb.mjs
node scripts/test-dataqc.mjs                   # currently 89 passed
node scripts/test-engine.mjs                   # currently 46 passed
npx tsc --noEmit -p .
npx vite build
```

---

## 9. Files

- Workbook — `docs/arganta-energy/knowledge-base/ArgantaEnergy-Master-KB.xlsx`
- Workbook builder (Codex) — `.codex/tmp-petsys/build-workbook.mjs`
- App export — `apps/energy/scripts/build-master-kb.mjs`
- App payload — `apps/energy/public/kb/master-kb-spine.json`
- Types — `apps/energy/src/dataqc/masterkb.ts`
- Dossier — `apps/energy/src/tabs/exploration/KnowledgeBank.tsx`
- Charts — `apps/energy/src/tabs/exploration/BasinCharts.tsx`
- Chart model + QC — `apps/energy/src/tabs/exploration/basin-insight.ts`
- Time model — `apps/energy/src/tabs/exploration/geo-time.ts`

Working queues in the workbook: `PS Chart Completion` (per model, 213 rows, has
`next_gap`), `Basin Completion` (per basin, has `primary_gap`/`next_action`),
`PS Gap Ledger`, `PS Batch Plan`.

---

## 10. Scope boundary worth knowing

**The United States is absent from the catalogue** — Permian, Williston, Anadarko,
Appalachian, Gulf of Mexico, San Juan, Denver, Powder River, Fort Worth, Illinois,
Michigan, San Joaquin all ABSENT; only Arctic Alaska is present (via the circum-Arctic
assessment). This is the source's scope: **USGS DDS-69 is the *World* assessment and
excludes the US**, which is covered separately by the USGS National Oil and Gas
Assessment (NOGA), never ingested.

Consequence: **1,998 field records (25% of the catalogue) can never resolve to a basin**
under the current sources, and completing all 180 basins still leaves that hole.
Ingesting NOGA is a separate decision, not part of this programme.

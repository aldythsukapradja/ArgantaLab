# Figure governance — Phases 0–2

Figures are evidence objects, not decoration. Three sheets now carry that:

| sheet | rows | what it is |
|---|---:|---|
| `Figure Registry` | **557** | one row per figure — the evidence object, independent of who uses it |
| `Figure Links` | **935** | junction: which entities use it, how, and which is *preferred* |
| `Formation` | **618** | formations as entities, with aliases — was free text |

## Coverage after the monograph harvest (Phase 4a)

USGS **Bulletin 2201–2207** and **Professional Paper** province monographs are a
different source class from the Fact Sheets harvested first: full province geology
reports, not 2-page summaries. 110 publications discovered via the pubs-services API,
74 PDFs downloaded, **222 figures** extracted across 21 provinces.

| figure type | basins | before |
|---|---:|---:|
| cross-section | **34 / 179 (19%)** | 26 (15%) |
| stratigraphic chart | **18 / 179 (10%)** | 7 (4%) |
| events chart | **18 / 179 (10%)** | 0 |
| depositional | **13 / 179 (7%)** | 4 (2%) |
| burial history | **9 / 179 (5%)** | 0 |
| basin / TPS map | 170 / 179 (95%) | 170 |

**68 of 557 figures are not redistributable** (27% of the monograph corpus; 50% of
Bulletin 2204-C). Verified live: **0 restricted figures hold a preferred slot anywhere.**

The app now reads the **registry**, not a file manifest — `redistribution_status` is the
only gate, so an ungoverned image cannot reach the screen.

Gate: `node scripts/test-figure-registry.mjs` — **20 checks**.

## The three design decisions that matter

**1. Licence and redistribution are separate fields.**
"We hold a local copy" and "we may publish it" are different facts. Conflating them is
exactly how an internal-reference plate ends up deployed. `licence_status` says what the
rightsholder allows; `redistribution_status` says what we may do. **The UI gates on
redistribution, never on licence and never on the presence of a file.**

**2. Rights now FAIL CLOSED.**
The old classifier returned `usgs-public-domain` whenever it found no credit line —
anything unrecognised was assumed safe. Fine while every input was a USGS report, wrong
the instant anything else is ingested. The default now keys off the **source**: a USGS
publication is a US Government work and *is* public domain (17 U.S.C. § 105); an
unidentified source grants nothing and is quarantined as `rights-unknown` — no local
copy, no manifest entry. Unit-tested across all five cases.

**3. `preferred_for_scope` lives on the LINK, not the figure.**
A chart preferred for one basin may be an alternate for its neighbour. Holding preference
on the figure forces one global winner and silently loses the rest — the symptom was
4 basins receiving a `preferred_petroleum_system` where there should be 170. Now every
one of the 170 linked basins carries all three slots: `preferred_general`,
`preferred_petroleum_system`, `preferred_high_resolution`.

## Scoring is deliberately partial, and says so

`candidate_score` is a weighted average over the criteria that can actually be assessed
from what we hold — authority, basin match, formation resolution, petroleum-system
relevance, recency, legibility, reuse rights. **Age clarity, coverage and scientific
quality are NOT scored**: they need the source read, which is Phase 4.

Scoring them 0 would punish every figure; scoring them 1 would inflate every figure.
Instead `score_coverage_pct` records that the score represents **80% of the rubric**, and
the gate fails any auto-classified row claiming 100%. Current range: **0.512 – 0.902**.

## Formations

1,306 free-text unit strings across PS Elements and Basin Cycles → **621 formations**,
with every input string retained as an alias. **459 PS Elements now carry a
`formation_id`, 0 unresolved.** The remaining 1,085 are legitimately blank — derived
overburden placeholders and generic intervals like *"Eocene source interval"*, which were
never formations.

Two bugs found while building it:

- **`^[a-z]` under `re.IGNORECASE` also matches uppercase**, so the reject rule threw out
  every string starting with a letter — the first run produced **0 formations**.
- **Hyphenated age qualifiers weren't stripped**, so `Permo-Triassic Khuff Formation`
  never merged with `Khuff Formation`. Fixing it merged 20 duplicate clusters; Khuff went
  from 36 occurrences/4 aliases to 44/5.

Clustering verified by inspection: `Shu'aiba` merged its curly-vs-plain apostrophe
variants, `Batu Raja Limestone` merged with `Baturaja Fm`. 53 formations span more than
one basin (Khuff 7, La Luna 6, Unayzah 5) — correct, those are regional units.

**What the registry does NOT assert:** parent unit, nomenclature authority, true
stratigraphic position. Those need the literature. `review_status` is
`auto-canonicalised` on every row for that reason.

## State

`figure_scope` is `basin` on all 325 figures; **0 are formation-scoped**. That is the
honest position — every figure harvested so far came from basin-level USGS assessments.
Formation-scoped figures arrive with Phase 4 retrieval.

## Next: Phase 3, and why it needs a different setting

Phase 3 is the vertical slice — one basin, ~10 formations, all figure types, end to end —
and it is where the method gets calibrated: the retrieval rubric, the claim-extraction
discipline, and the specification for an original schematic. Getting that wrong is
expensive to unwind across 3,000 downstream tasks, and the schematic spec is genuine
synthesis rather than rubric-following.

**Run Phases 3 and 5a at high effort.** Phase 4 (retrieval at scale) reverts to medium —
it is rubric-following, and 3,000 tasks at high effort buys little.

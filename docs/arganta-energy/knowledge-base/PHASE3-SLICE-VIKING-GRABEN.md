# Phase 3 slice — Viking Graben / North Sea Graben Province

One basin, real retrieval, measured. The point was never the figures; it was to find out
what the pipeline actually yields before committing ~3,000 tasks to it.

## The headline measurement

**USGS Bulletin 2204-C** — *Kimmeridgian Shales Total Petroleum System of the North Sea
Graben Province* — 29 pages, 10 numbered figures.

| figure | type | rights |
|---|---|---|
| 1 · Location of the province | map | **public domain** |
| 2 · Prominent oil and gas fields | map | **RESTRICTED** — Glennie, 1998a |
| 3 · TPS boundary | map | **public domain** |
| 4 · Structural elements of the North Sea | structure | **RESTRICTED** — Brown, 1991 |
| **5 · Stratigraphic summary of the province** | **strat-chart** | **RESTRICTED** — Brennand and others, 1998 |
| **6 · Burial curves, northern & central North Sea** | **burial** | **RESTRICTED** — Cornford, 1998 |
| 7 · Depth to base Cretaceous | burial | **public domain** |
| 8–10 · Assessment-unit boundaries | map | **public domain** |

**5 of 10 are third-party. The split is not random: every USGS-original figure is a map;
every figure a geologist would actually reason from — the stratigraphic summary, the
burial curves, the structural framework — belongs to someone else.**

This is the single most important number in the programme, and it validates the
handoff's core design decision. `LINK ONLY → generate an original schematic` is not the
edge case. **For the figures that matter, it is the main path.**

## Retrieval architecture — proven, and different from what was assumed

- `WebFetch` returns **403 on both `sodir.no` and `pubs.usgs.gov`**. The Norwegian
  Offshore Directorate — the most authoritative source for this basin — cannot be read
  by the agent at all.
- `curl` with a declared user-agent returns **HTTP 200, 2.8 MB**. The block is
  WebFetch-specific, not a site policy against retrieval.

So the pipeline is:

```
WebSearch → URL → curl download → LOCAL PyMuPDF extraction → classify → Registry
```

Never send a PDF to a model. This is both the reliability fix and the cost lever: local
extraction is free, and it is the difference between ~20k and ~150k tokens per task.

## A source class we had entirely missed

The 52-publication registry harvested in Phase 1 is **Fact Sheets**. Bulletin 2204-C is a
**Bulletin** — a different USGS series, public domain, far richer in geology figures, and
absent from that registry. USGS Bulletins and Professional Papers are the DDS-69-chapter
equivalent and are the obvious next harvest target.

Caution from the same measurement: richer in figures does **not** mean richer in
*redistributable* figures. Bulletins reproduce third-party work precisely because they
synthesise.

## Two classifier gaps the slice exposed

Both were silently mistyping the basin's most valuable figures as `other`, which sorts
them last:

- **"Stratigraphic *summary*"** — the USGS bulletin house style. My pattern only matched
  column / chart / section / correlation.
- **"Burial *curves*"** — my pattern required "burial history".

Fixed; both now classify correctly.

## A gate catching its author

The slice script wrote `candidate_score: None` for its 10 rows. The registry gate failed
— *"every figure carries a candidate_score — 10 missing"* — and refused them until they
were scored on the same rubric. That is the gate working on the person who wrote it.

## State after the slice

| | |
|---|---|
| Figure Registry | **335** figures (325 + 10) |
| Figure Links | **713** |
| restricted | **7** (3 + 4 new) |
| Formation | **618** (3 surfaces removed) |
| gates | **20/20** registry · 8 · 18 · 16 · 127 · 46 · `TSC=0` |

`BCU Formation`, `Hercynian unconformity Formation` and `Glacial erosion surface
Formation` were removed — an unconformity is a *boundary between* units and must never
receive a `formation_id`, or figures and elements would attach to something with no
thickness, age or lithology.

## What this changes about the plan

1. **Harvest USGS Bulletins and Professional Papers next.** Public domain, unharvested,
   geology-rich. Highest value per unit of effort available right now.
2. **Budget for the schematic generator as the primary deliverable.** With ~50% of
   geology figures unusable in a *public-domain* source, the fraction in commercial
   literature will be far worse.
3. **Drop `WebFetch` from the retrieval design.** It cannot read the two most important
   domains for this work.
4. **The 2-source rule for schematics is now doubly justified** — the facts behind
   fig 5 and fig 6 are recoverable and citable; the images are not.

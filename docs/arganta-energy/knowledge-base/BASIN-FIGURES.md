# Basin figures — the published picture on every dossier card

The Basin Dossier's picture card carries **published plates** — the cross-section,
stratigraphic chart or depositional map a geologist would expect to see. A chart drawn
from our own tables is not a substitute for one, so drawn plates were demoted to a
fallback and the card now leads with real literature.

## Coverage

| | |
|---|---|
| figures | **703** (322 unique images, deduped) |
| basins with any published figure | **170 / 179 (95%)** |
| · cross-section | 26 / 179 (15%) |
| · stratigraphic chart | 7 / 179 (4%) |
| · depositional | 4 / 179 (2%) |
| · basin / TPS map | 170 / 179 (95%) |
| restricted (not shippable) | 4 |
| on disk | 59 MB |

**Cross-section coverage is 15%, and that is the honest ceiling of the sources
currently on disk.** DDS-60 is a maps-and-results publication: its province sheets are
TPS location maps, not geology plates. The 26 cross-sections come almost entirely from
Fact Sheets and one Open-File Report. Raising this needs DDS-69 chapters and per-basin
Open-File Reports / Professional Papers — that is the next phase, not a tuning problem.

**Nine basins have no published figure at all** and fall back to the USGS province
outline: Katawaz · Helmund-Baluchistan · Franklinian Shelf · Novaya Zemlya · Tunguska ·
Mezen' · Eurasia Basin · Long Strait · (one more). For genuinely frontier and oceanic
basins that is the correct answer, not a gap to paper over.

## Card order

`cross-section → strat-chart → depositional → map → events-chart → burial → creaming`

then drawn plates. The first figure is the one you asked for; swipe or arrow-key
through the rest, star one to pin it as the basin's main picture (persisted per basin).

## Rights — the load-bearing part

USGS publications are US Government works and therefore **public domain**
(17 U.S.C. § 105). Those ship in `apps/energy/public/basin-figures/`.

A figure **reproduced inside** a USGS report from a copyrighted source is **not** public
domain — USGS credits it, and citation is not a licence. Those are written to
`apps/energy/public/basin-figures-restricted/`, which is **gitignored**, so the boundary
is enforced by the filesystem rather than by anyone remembering it.

Four figures were caught this way, all in the Bohaiwan Basin Open-File Report:

| credit | figure |
|---|---|
| Hu and Krylov, 1996 | geologic cross section A–A′ through the Jizhong, Huanghua and Jiyang subbasins |
| Hu and Krylov (1996); Chang (1991); Allen and others (1997) | basin location and structure |
| modified from Lee, 1989 | stratigraphy of the Bohaiwan subbasins |

Every restricted figure renders its credit and an *"Internal use only; not cleared for
redistribution"* line, styled amber. That condition is what makes displaying them
legitimate at all.

## How it is built

```bash
python docs/arganta-energy/knowledge-base/harvest_basin_figures.py
cd apps/energy && node scripts/test-basin-figures.mjs     # 8 checks
```

Two extraction modes, because the sources differ in kind:

- **page-as-figure** — a DDS-60 province or TPS sheet *is* a map; detected by vector-draw
  density (a results table has almost none) and rendered whole
- **caption-anchored** — a Fact Sheet or OFR has numbered figures. The clip is the union
  of the actual **graphic** bounds above the caption, grown to swallow text blocks that
  hug the artwork (axis labels, scale bars, `A–A′`) but not distant paragraphs. Clipping
  naively from page-top drags in the reference list; clipping to graphics alone loses
  the depth axis. Both were observed and fixed.

## Three bugs worth remembering

1. **Multi-province attribution.** The registry is publication × province — 454 rows over
   only **52 unique publications**, because one assessment covers several basins. Keying
   by `publication_id` kept one province and silently discarded the rest, hiding figures
   from **56 basins**. Coverage went 114 → 170 when fixed.
2. **Duplicate images.** Attaching a shared figure to N basins wrote the same PNG N
   times — **381 MB**. Writing once and pointing every manifest entry at that file gives
   **59 MB** for identical content.
3. **Plural in captions.** USGS writes *"Locations of 23 provinces assessed…"*; a
   `location of` pattern misses it, so 102 basin maps were typed `other` and sorted last.
   Now 8.

## Next

- DDS-69 chapters and per-basin OFR/PP retrieval — the only route to real cross-section
  coverage above ~15%
- CC-licensed and restricted literature for the basins USGS never covered
- Depositional-environment plates are the thinnest type at 2%

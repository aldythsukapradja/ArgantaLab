# ArgantaEnergy — O2 QC Summary

Refinery product: decoded raw Volve bytes → canonical OSDU-aligned tables + per-file QC. Every processed row carries a `source_id` resolving to `mirror-manifest.json` (path + sha256). No unit conversion, no silent renames. Licence: Volve field dataset, © Equinor (and Volve licence partners), Equinor Open Data Licence.

## Per-domain decode results

| Domain | Files decoded | Rows / values | dataNature | Units (source) | Deferred / anomalies |
|---|---|---|---|---|---|
| Production | 1 xlsx (2 sheets) | 15634 daily + 526 monthly rows | reported | Sm3, bar, hrs (verbatim) | multiple flow_kinds/day = expected dup keys |
| Well logs | LAS 116/164, DLIS 81/81 | 65,742,300 values (LAS 18,657,384 + DLIS 47,084,916) | measured | GAPI, V/V, OHMM, M, G/CM3, US/F… | 48 LAS 3.0 pressure runs now decoded (see below) |
| Pressure logs (LAS 3.0) | 48/48 runs | 48 MWD FPWD/pretest time-series | measured | S, M, BAR, DEGC (verbatim) | hand-rolled LAS 3.0 parser; 0 deferred ([pressure-logs.md](pressure-logs.md)) |
| Trajectory | 29 definitive of 29 wellbores (63 objects) | 1 survey/wellbore | measured | m, dega (degrees) | 1 plan traj excluded; F-1 tie-in TVD>MD 3mm (source rounding) |
| Depth horizons | 6 .dat surfaces | 1,592,946 grid points | interpreted | m (ED50 UTM 31N, Z +down) | full grid stays in raw; decimated preview stored |
| Well masters | 24 wellbores / 11 wells | survey headers | reported | m, ED50/UTM31N | exploration 15/9-19* kept distinct |
| Formation markers | 1 .dat (Well_picks_Volve_v1) | 409 picks / 16 surfaces / 35 wells | interpreted | m, ms TWT, ED50/UTM31N (verbatim) | P1 gap-fill mirror; 28 source wells unresolved, carried verbatim ([formation-markers.md](formation-markers.md)) |

## Row counts vs source

| Item | Decoded | Source expectation | Match |
|---|--:|---|:--:|
| Daily production rows | 15634 | ~15,634 (xlsx Daily sheet, 15,635 incl header) | ✅ |
| Monthly production rows | 526 | 526 (xlsx Monthly, minus header+units rows) | ✅ |
| Trajectory objects | 63 | 63 WITSML trajectory XMLs | ✅ |
| LAS files | 164 | 164 in Well_logs_pr_WELL | ✅ |
| DLIS files | 81 | 81 in Well_logs_pr_WELL | ✅ |
| Depth horizons | 6 | 6 .dat in Horizons_DEPTH | ✅ |
| LAS 3.0 pressure runs | 48 | 48 in Well_logs_pr_WELL/*/03.PRESSURE (LAS 3.0) | ✅ |
| Formation-marker picks | 409 | 409 pick rows in Well_picks_Volve_v1.dat | ✅ |

## P1 gap-fill (2026-07-21)

Both O2 gaps are now closed:

- **Formation tops** — `Geophysical_Interpretations/Wells/Well_picks_Volve_v1.dat` (+ perforations + README) added to the selection rule and mirrored 1:1 (verify --deep ok). Decoded to `processed/formation-markers.json`: **409 picks, 16 distinct surfaces, 35 source wells** (7 resolved to a master wellbore/well, 28 carried verbatim — the source uses `15/9-F-10`-style ids while some masters use `F-10`, so no forced link). dataNature `interpreted`.
- **LAS 3.0 pressure logs** — the 48 previously-deferred MWD FPWD/pretest runs decoded with a hand-rolled LAS 3.0 section parser (honours declared `DLM`/`NULL`, pairs `~*_Definition`↔`~*_data`). **48 of 48 decoded, 0 deferred.** All time-indexed, ~58 curves each; dataNature `measured`. → `processed/pressure/<well>__<run>.json` (+ `full/` for large runs).

`validate.mjs` extended with marker + pressure checks — all green.

## Deferred decoders / runs

_None — the 48 LAS 3.0 pressure runs below were resolved by the P1 gap-fill (see above). Original deferral list kept for provenance._

- `Well_logs_pr_WELL/15_9-F-10/03.PRESSURE/FM_PRESS_RAW_RUN10_MWD_1.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-10/03.PRESSURE/FM_PRESS_RAW_RUN10_MWD_2.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-10/03.PRESSURE/FM_PRESS_RAW_RUN10_MWD_3.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_1.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_10.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_11.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_12.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_13.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_14.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_2.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_3.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_4.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_5.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_6.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_7.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_8.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-14/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_9.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 A/03.PRESSURE/FM_PRESS_RAW_RUN6_MWD_1.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 A/03.PRESSURE/FM_PRESS_RAW_RUN6_MWD_2.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 A/03.PRESSURE/FM_PRESS_RAW_RUN6_MWD_3.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 A/03.PRESSURE/FM_PRESS_RAW_RUN6_MWD_4.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 A/03.PRESSURE/FM_PRESS_RAW_RUN6_MWD_5.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 A/03.PRESSURE/FM_PRESS_RAW_RUN6_MWD_6.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 A/03.PRESSURE/FM_PRESS_RAW_RUN6_MWD_7.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 A/03.PRESSURE/FM_PRESS_RAW_RUN6_MWD_8.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 A/03.PRESSURE/FM_PRESS_RAW_RUN6_MWD_9.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 B/03.PRESSURE/FM_PRESS_RAW_RUN11_MWD_1.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 B/03.PRESSURE/FM_PRESS_RAW_RUN11_MWD_2.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 B/03.PRESSURE/FM_PRESS_RAW_RUN11_MWD_3.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 B/03.PRESSURE/FM_PRESS_RAW_RUN11_MWD_4.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 C/03.PRESSURE/FM_PRESS_RAW_RUN14_MWD_1.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 C/03.PRESSURE/FM_PRESS_RAW_RUN14_MWD_2.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 C/03.PRESSURE/FM_PRESS_RAW_RUN14_MWD_3.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 C/03.PRESSURE/FM_PRESS_RAW_RUN14_MWD_4.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 C/03.PRESSURE/FM_PRESS_RAW_RUN14_MWD_5.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 C/03.PRESSURE/FM_PRESS_RAW_RUN14_MWD_6.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 C/03.PRESSURE/FM_PRESS_RAW_RUN14_MWD_7.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15 C/03.PRESSURE/FM_PRESS_RAW_RUN14_MWD_8.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_1.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-15/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_2.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-5/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_1.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-5/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_2.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-5/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_3.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-5/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_4.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-5/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_5.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-5/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_6.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-5/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_7.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)
- `Well_logs_pr_WELL/15_9-F-5/03.PRESSURE/FM_PRESS_RAW_RUN5_MWD_8.LAS` — decode deferred: LAS 3.0 (out of LAS-2.0 scope)

## Detailed per-domain QC

- [production.md](production.md) · [well-logs.md](well-logs.md) · [pressure-logs.md](pressure-logs.md) · [trajectory-selection.md](trajectory-selection.md) · [horizons.md](horizons.md) · [formation-markers.md](formation-markers.md) · [identity-mastering.md](identity-mastering.md)

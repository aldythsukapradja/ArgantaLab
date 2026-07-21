# 2026-07-21 — Batch O2: canonical decode + validation (append-only)

Decoded the 1:1 Volve raw mirror (`data-energy/raw/**`, 999 files) into canonical
OSDU-aligned tables + per-file QC. Every processed row carries a `source_id`
resolving to `mirror-manifest.json` (path + sha256). No unit conversion, no
silent renames. Decoders under `apps/energy/scripts/`, outputs under
`data-energy/{interim,processed}` (git-ignored bulk) + `docs/arganta-energy/qc/`.

## Environment
- Python 3.12.10 present; `pip install lasio dlisio` SUCCEEDED (pip not blocked) →
  DLIS decoded natively, not deferred. Node 24 for `validate.mjs` (zero deps).
- openpyxl 3.1.5 for the production xlsx.

## What decoded (all validation checks green)
- **Production** — `Volve production data.xlsx`: **15,634 daily** rows (matches ~15,634 expected)
  + **526 monthly**, exact column names preserved, `dataNature=reported`, Sm3 units untouched.
  7 producing/injecting wellbores. → `processed/production.json` + `.csv`.
- **Well logs** — **116/164 LAS** (lasio, WRAP handled) + **81/81 DLIS** (dlisio) =
  **223 runs, 65.7M values** across 24 wells. Full-fidelity columnar per-run JSON in
  `processed/log-samples/` + downsampled render companion in `log-samples-preview/`.
  Explicit alias map (DTC/DTCO→DT, RDEP/RD→RT, …) — never silent; recorded per curve.
  NULL sentinel taken only from LAS header. `dataNature=measured`.
- **Trajectories** — 63 WITSML objects across 29 wellbores → **29 definitive surveys
  selected** (3,332 stations), `dataNature=measured`, angle unit `dega` (degrees) preserved,
  radians→degrees derivation wired but unused (no radians in Volve). 1 "Plan Traj"
  object correctly EXCLUDED (never stored as measured). 0 ambiguous wellbores.
- **Depth horizons** — 6 `.dat` interpreted surfaces, **1,592,946 grid points**,
  `dataNature=interpreted`; metadata + decimated preview stored, full grid stays in raw.
  CRS: ED50 / UTM 31N, Z positive-down.
- **Well masters** — 24 wellbores / 11 wells from survey header blocks
  (ACTUAL + NPD standard-survey), CRS ED50/UTM31N + surface UTM/lat-lon + parent.
  Identity mastering links WITSML ↔ production ↔ log-folders ↔ masters; only **3
  honestly-unlinked** (F-15S sidetrack, two 15/9-19 &-combined branch names).

## Key decisions / deferrals (truthful)
1. **LAS 3.0 deferred (48 files, all 03.PRESSURE)** — VERS≥3.0 formation-pressure
   recordings are time-indexed, comma-delimited, multi-section; out of the
   "parse LAS 2.0 natively" scope and lasio hangs on them (root cause of an earlier
   pipeline stall). A VERS pre-check now skips them, recorded as
   `decode deferred: LAS 3.0` in the log inventory + QC. The 116 LAS 2.0 (incl. all
   priority CPI/COMPOSITE/LFP + petro outputs) decode fully.
2. **DLIS NOT deferred** — dlisio installed, so all 81 DLIS decoded (contrary to the
   plan's "optional" fallback). MUD_LOG + COMPOSITE DLIS included.
3. **Formation markers = 0 (deferred)** — no pick/tops `.dat` present in the mirror
   (Geophysical_Interpretations/Wells was `_NOT_MIRRORED`). Noted in QC, not faked.
4. **TVD>MD tolerance** — F-1 Main Wellbore tie-in has 2 stations where TVD exceeds MD
   by ~3 mm at ~0.2° inclination — a truthful SOURCE survey-rounding artifact.
   Preserved unaltered; validator treats sub-tolerance excess as a recorded anomaly
   (WARNING), gross excess as a hard fail (decode/unit bug). This keeps truth-
   preservation intact rather than "correcting" source values.
5. **Full-fidelity log storage is columnar** (depth array + per-curve value arrays)
   rather than one JSON object per sample — a faithful long-format encoding that
   avoids 10× key bloat while preserving every sample to double precision. A separate
   long-format view can be projected from it. `processed/`+`interim/` are git-ignored
   (690 MB log-samples), so no bulk is committed — matches the raw-never-committed rule.
6. **Performance** — initial per-element Python `float()` loops were pathologically slow;
   replaced with vectorized numpy `tolist()` (no rounding) → ~50× speedup on big curves.

## Validation
`node apps/energy/scripts/validate.mjs` — ALL CHECKS PASSED (1 warning = the mm-scale
TVD>MD source rounding above). Covers: source_ids resolve, unique PKs, valid dates,
monotonic log depths, trajectory MD monotonic + TVD≤MD + incl∈[0,180] + azi∈[0,360],
no seismic entity, exploration (15/9-19*) vs development F-wells explicit (no forced merge).

## For founder at Gate 2
- Trajectory definitive picks: all 29 unambiguous (see `qc/trajectory-selection.md`).
- Identity unlinked (3): confirm F-15S sidetrack + 15/9-19 B&BT2 / S&SR branch naming.
- 48 LAS-3.0 pressure files + formation markers deferred by design — approve or request
  a dedicated LAS-3.0 decoder in a later batch.

# Volve Mirror Report — Batch S1
Completed 2026-07-21 · source: Databricks Volume /Volumes/equinor_asa_volve_data_village/public/volve

## Result
- **1,002 files** mirrored 1:1, **0 failures**, **2.06 GB** (incl. P1 formation-picks add-on).
- **verify --deep: ok=1002 bad=0** (every file re-hashed against its download-time SHA-256).
- **Idempotent**: re-run = 1002 skips, 0 re-downloads.
- Full 1:1 folder skeleton: **948 dirs** recreated; 111 `_EMPTY_IN_SOURCE` + 596 `_NOT_MIRRORED` markers.

## By top folder
| Folder | Files | Size |
|---|---|---|
| Well_logs_pr_WELL | 722 | 1736.8 MB |
| Reports | 2 | 187.2 MB |
| Geophysical_Interpretations | 6 | 112.5 MB |
| WITSML Realtime drilling data | 92 | 10.6 MB |
| Well_technical_data | 175 | 6.5 MB |
| Production_data | 1 | 2.3 MB |
| HRS and Terms and conditions for license to data - Volve.pdf | 1 | 0.2 MB |

## Integrity
- Byte-exact: each local file size == Databricks listing size.
- SHA-256 recorded per file in `data-energy/manifest/mirror-manifest.json`.
- Resumable (Range + If-Unmodified-Since); atomic .part→final rename.
- Seismic guard: hard-excluded top folders + .sgy/.segy; no seismic volume mirrored.

## Location
- Raw (git-ignored): `data-energy/raw/**` — 1:1 with the Databricks tree, original names.
- Manifests (kept): `data-energy/manifest/{inventory,selection,mirror-manifest}.json`.

## Next
Batch O2 — decode to canonical form (production xlsx, LAS/composite logs, WITSML trajectories→pick definitive per wellbore, depth horizons), OSDU-aligned tables + per-file QC.

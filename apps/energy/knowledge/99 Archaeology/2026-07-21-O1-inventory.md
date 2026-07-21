# 2026-07-21 — Batch O1: Volve inventory + selection (append-only)

- Built `apps/energy/scripts/volve-mirror.mjs` (plan/mirror/verify; resumable Range+If-Unmodified-Since; inline SHA-256; seismic deny-list; concurrency-10 walk after a serial version proved too slow — ~3s/dir listing).
- `plan` walked the whole share: 23,710 entries (948 dirs, 22,762 files). Inventory at `data-energy/manifest/inventory.json` (repo root, outside the app).
- KEY: the Databricks share is 88.95 GB total, NOT the classic ~5 TB. Giant seismic volumes are absent (Seismic folder = 1 KB pointer). Heavyweights: GeoScience_OW_Archive 55 GB, Well_logs & Well_logs_pr_WELL ~15 GB each, WITSML 2.71 GB.
- Deny-list validated as correct: matches were VSP_VELOCITY (seismic-adjacent, inside logs) and seismic-survey-named interpretation files (ST0202/ST10010). Folder-level ⛔ flag is cosmetic; mirror refuses only matching files.
- Log strategy decided: curate by exploration-relevant log-TYPE across all 24 wells (from Well_logs_pr_WELL), not whole wells — drops ~13 GB of LWD/production/integrity dev-phase bulk.
- Trajectory: definitive-vs-plan is NOT in filenames (1.xml..8.xml); requires WITSML content parse. Decision pushed to O2. All 63 tiny trajectory XMLs (10.6 MB) to be mirrored; O2 picks definitive per wellbore.
- Selection proposal written to `data-energy/manifest/selection-proposal.md` with 4 founder decisions. Awaiting Gate 1. No bytes downloaded.

## Batch S1 — mirror complete (2026-07-21)
- Founder Gate-1 approval: full exploration-log scope (all 9 exploration types × 24 wells), depth horizons, defer EDM, trajectory pick at parse time. "Store locally first, 1:1 folder structure, mark empty folders empty."
- Seismic guard refactored: folder-based (Seismic/GeoScience/RMS/Eclipse/PI) + .sgy/.segy extension — replaces the substring deny that wrongly blocked interpreted depth horizons named after seismic surveys (ST10010/ST0202).
- selection.json built deterministically (scripts/build-selection.mjs): 999 files, 2.06 GB.
- Mirror: 999/999 done, 0 fail; verify --deep ok=999 bad=0; idempotent re-run = 999 skips.
- Full 1:1 skeleton: 948 dirs, 111 _EMPTY_IN_SOURCE + 596 _NOT_MIRRORED markers. Raw at data-energy/raw (git-ignored, outside app). Reports: data-energy/manifest/mirror-report.md.
- KEY: share is 88.95 GB total (no giant seismic volumes present); depth horizons carry seismic survey names but are interpretation products, kept.

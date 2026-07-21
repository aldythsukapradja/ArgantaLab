# Volve Mirror — Selection Proposal (★ Gate 1)
Generated from live inventory 2026-07-21 · `data-energy/manifest/inventory.json` (23,710 entries, 948 dirs, 22,762 files)

## Headline finding
This Databricks share is **88.95 GB total — not 5 TB**. The giant seismic volumes are NOT in it (the `Seismic` folder is 1 KB, just a pointer). So "no seismic" is nearly free here. The only true heavyweights are `GeoScience_OW_Archive` (55 GB) and the two well-log trees (~15 GB each).

## Real folder sizes (whole share)
| Folder | Size | Files | Verdict |
|---|---|---|---|
| GeoScience_OW_Archive | 55.05 GB | 3 | ⛔ exclude (OpenWorks archive, huge) |
| Well_logs_pr_WELL | 15.15 GB | 2,671 | ✅ **curate** (per-well layout — our pick) |
| Well_logs | 15.11 GB | 2,670 | skip (same data, by-type layout — redundant with the above) |
| WITSML Realtime drilling data | 2.71 GB | 11,894 | ✅ curate (trajectories only; the 2.7 GB is bulk time-logs we skip) |
| Well_technical_data | 390.93 MB | 5,474 | ✅ curate (well masters + EDM; skip daily drilling reports) |
| Geophysical_Interpretations | 386.91 MB | 42 | ◇ **your call** (interpreted horizons; see Decision 2) |
| Reports | 178.56 MB | 2 | ✅ include (Discovery report + PUD → knowledge/training) |
| Production_data | 2.34 MB | 1 | ✅ include ALL (the production history) |
| licence PDF | 0.2 MB | 1 | ✅ include (attribution) |
| Reservoir_Model-Eclipse / RMS, PI System, Seismic | tiny/pointer | — | ⛔ exclude (dev-phase / not in share) |

## The smarter log strategy (why not "whole wells")
The 24 wells hold 15 GB because most of it is **drilling/production surveillance**, not exploration petrophysics. Breaking `Well_logs_pr_WELL` by log-type across ALL wells:

| Log type | Size | Exploration-relevant? |
|---|---|---|
| 02.LWD_EWL | 7.89 GB | ✗ logging-while-drilling bulk — skip |
| 14.DIV.REPORTS | 2.04 GB | ✗ misc reports — skip |
| 10.PRODUCTION LOGS | 2.04 GB | ✗ production surveillance (dev phase) — skip |
| 11.INTEGRITY LOGS | 1.47 GB | ✗ well integrity (dev phase) — skip |
| 03.PRESSURE | 557 MB | ✅ RFT/pressure → fluid contacts |
| 09.CORE | 283 MB | ✅ core data |
| 01.MUD_LOG | 275 MB | ✅ mud logs |
| 05.PETROPHYSICAL INTERPRETATION | 166 MB | ✅ CPI — the money curves |
| 04.COMPOSITE | 153 MB | ✅ composite logs |
| 06.LFP | 114 MB | ✅ log/formation properties |
| 07.IMAGE | 87 MB | ✅ borehole image |
| 12.BIOSTRAT | 84 MB | ✅ biostratigraphy |
| 13.GEOCHEM | 18 MB | ✅ geochemistry |

Taking the **exploration-relevant types across all 24 wells** keeps every well represented for the digital brain while dropping 13 GB of dev-phase bulk.
(Note: `08.VSP_VELOCITY` = 298 files auto-excluded by the seismic deny-list — VSP is seismic-adjacent. Correct.)

---

## RECOMMENDED SELECTION — "Exploration Core" (~1.75 GB)
| Item | Size |
|---|---|
| Production_data (all) | 2.3 MB |
| Reports (Discovery + PUD) | 187 MB |
| WITSML trajectory XMLs (all 63, definitive chosen at parse time) | 10.6 MB |
| Well_technical_data → WellWellbore master (well/wellbore headers) | 6.5 MB |
| Logs: PETRO-INTERP + COMPOSITE + LFP + MUD_LOG + IMAGE + BIOSTRAT + GEOCHEM + CORE + PRESSURE (all 24 wells) | ~1,735 MB |
| licence PDF | 0.2 MB |
| **TOTAL** | **≈ 1.94 GB** |

Trim options if you want more headroom: drop PRESSURE (−557 MB → 1.38 GB) or CORE (−283 MB). Add-ons: EDM.XML (+289 MB, holds definitive directional surveys + casing + well headers in one engineering file — valuable but needs a WITSML/EDM parser).

---

## Decisions I need from you (Gate 1)

**Decision 1 — Log scope.** Approve the "Exploration Core" log set above (9 log-types × all wells, ~1.74 GB), or tell me to trim (drop PRESSURE/CORE) or go minimal (just PETRO-INTERP + COMPOSITE + LFP + MUD_LOG ≈ 707 MB).

**Decision 2 — Geophysical interpretations (386 MB).** These are interpreted horizon grids (`.dat`) in both TWT (time) and DEPTH — the geological surfaces for a future "Surfaces" tab. Their filenames reference seismic survey names (ST10010/ST0202), so the deny-list flags them. They are **interpretation products, not seismic volumes**. Options: (a) include DEPTH horizons only (~190 MB), (b) include all (~386 MB), (c) skip for now. My recommendation: **(a) DEPTH horizons only** — usable surfaces, no time-domain baggage.

**Decision 3 — EDM.XML (289 MB).** One big engineering-data-model XML with definitive directional surveys, casing, well headers. Include now (richer trajectories + completions) or defer to a later batch? My recommendation: **defer** — the small WITSML trajectory XMLs already give us definitive surveys with a simpler parser; add EDM in P1+ if needed.

**Decision 4 — Trajectory definitive-pick method.** Filenames (`1.xml`…`8.xml`) don't reveal definitive-vs-plan; only the WITSML content does. Plan: mirror all 63 tiny trajectory XMLs (10.6 MB total), and O2 parses each to select the **definitive final survey per wellbore**, tags it `measured`, excludes plans, and flags any ambiguous wellbore for you. Approve this approach? (It honors your "final trajectory only" rule at the correct layer.)

---

## What happens on approval (Batch S1, mechanical)
Your answers → `selection.json` → `node scripts/volve-mirror.mjs mirror` (1:1 byte-exact, resumable, SHA-256 per file) → `verify --deep` → re-run to prove idempotence → `mirror-report.md`. Nothing is downloaded until you approve this page.

Default if you just say "go": Exploration Core (D1) + DEPTH horizons only (D2a) + defer EDM (D3) + trajectory parse-time pick (D4) ≈ **2.13 GB**.

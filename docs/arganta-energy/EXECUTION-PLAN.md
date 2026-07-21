# ArgantaEnergy — Execution Plan (Opus/Sonnet batch handoff)
Date: 2026-07-21 · Parent: `BUILD-PLAN.md` (phases/gates), `data-foundation-research.md` (refinery positioning), `competitor-landscape.md`
Rule: **Opus for anything requiring judgment** (architecture, parsing edge cases, identity decisions, design, agent logic). **Sonnet only for totally mechanical work** (running approved scripts, boilerplate, file moves, report formatting). Every batch is self-contained: an agent can start from this doc + named inputs without this conversation.

Founder time is spent ONLY at the ★ gates.

> **REPRIORITIZED 2026-07-21 — see ARCHITECTURE-VISION.md.** Cosmo = the mothership platform (data+knowledge+agents OS); Workbench = a domain vertical inside it. Build order is now **architecture-first**: M1 star-schema contract → M2 data-pipeline surface → M3 knowledge graph + deterministic extraction → M4 NLU/agents → **V1 Workbench (Field Development mini-Petrel, end-to-end)** → V2+ verticals. The batches below (O2/O3 done) still hold as implementation detail; the M/V phases in ARCHITECTURE-VISION.md are the authoritative order.

---

## Batch F0 — FOUNDER (5 min, blocks everything)
Create a Databricks PAT: workspace `dbc-353519aa-0abf.cloud.databricks.com` → avatar → Settings → Developer → Access tokens → Generate (long lifetime).
Save to `ArgantaLab/apps/energy/.env` (create folder if needed):
```
DATABRICKS_HOST=https://dbc-353519aa-0abf.cloud.databricks.com
DATABRICKS_TOKEN=dapi...
```
Never committed (gitignore is part of O1).

---

## Batch O1 — OPUS · P0 mirror tool + inventory + selection proposal
**Why Opus:** resumable-download correctness, integrity design, and the selection judgment are the riskiest parts of the whole project.

Build `apps/energy/scripts/volve-mirror.mjs` (Node 22, zero deps) with subcommands:
- `plan` — recursive `GET /api/2.0/fs/directories/Volumes/equinor_asa_volve_data_village/public/volve/...` (page_size 1000, follow `next_page_token`; URL-encode each path segment — names contain spaces) → `data-energy/manifest/inventory.json` `{path,size,last_modified,is_directory}` + a size-by-top-folder summary printed for the founder.
- `mirror` — for files in `selection.json`: streaming `GET /api/2.0/fs/files/<enc path>`; `.part` staging → inline SHA-256 → atomic rename; resume with `Range: bytes=N-` + `If-Unmodified-Since: <last_modified>` (412 ⇒ restart file); concurrency 4; backoff on 429/5xx honoring Retry-After; 401 ⇒ abort loudly ("PAT expired"). Manifest entry per file: `{path,size,last_modified,sha256,bytes_written,retrievedAt,status}`.
- `verify` — size equality vs listing (always), `--deep` re-hash. Non-zero exit on any mismatch.
- Hard deny-list regex baked into BOTH plan-summary and mirror: `/seismic|segy|\.sgy|st0202|st10010|4d|vsp|rms.*model|geoscience/i` — refuses to download matches even if selected.
- Raw root `data-energy/raw/**` mirrors the volume tree 1:1, original names. `.gitignore`: raw + .env, keep manifests.
- OneDrive caveat: if `.part` renames misbehave under sync, fall back to `C:\volve-raw` and symlink/record path in manifest (decide at runtime, note in output).

Then RUN `plan` and draft `data-energy/manifest/selection-proposal.md`: real top-level folders with actual sizes mapped to the BUILD-PLAN §2.3 intent (production + well technical + geophysical interpretations + reports = ALL; curated LAS/DLIS for exploration wells 15/9-19* + key F-wells ≈ ≤1.2 GB; trajectories for the same wells; total ≤2 GB; Eclipse deferred; seismic/RMS/GeoScience excluded). List the exact chosen well folders.

**Trajectory rule (founder, 2026-07-21):** from each wellbore's WITSML trajectory objects, select ONLY the **definitive / final as-drilled survey** — never the planned/design trajectory. In WITSML `trajectory` objects distinguish by name/metadata (e.g. `definitive`, `final`, `as-drilled`, "OWSG"/actual survey) vs plan (`plan`, `planned`, `design`, `proposed`). O1 lists all trajectory objects per wellbore and marks which is definitive; if ambiguous, flag for the founder at Gate 1 rather than guessing. O2 ingests only the definitive one and tags it `dataNature: measured`; any plan trajectory encountered is explicitly excluded (never stored as measured).

**★ GATE 1 (founder, ~10 min):** approve/edit the selection proposal.

## Batch S1 — SONNET · run the approved mirror (mechanical)
Convert approved proposal → `selection.json`; run `mirror` then `verify --deep`; re-run to prove idempotence (second run = all skips). Deliver `data-energy/manifest/mirror-report.md`: file count, bytes, duration, failures, hash list. No deviations — any error not covered by the script's handling goes back to Opus, not patched inline.

## Batch O2 — OPUS · P1 canonical data + validation
**Why Opus:** parser edge cases (LAS null sentinels, DLIS frames, WITSML radians, xlsx sheets) and the classic Volve identity trap.

- Decoders → `data-energy/interim/`: production xlsx (both daily+monthly sheets, exact column names preserved), LAS via lasio-equivalent logic in Node or Python `lasio` if a venv exists, DLIS via Python `dlisio` (optional, additive — never blocks), WITSML trajectory XML (preserve radians; derive degrees as separate named fields), picks .dat.
- Canonical → `data-energy/processed/` Parquet+JSON: Field→Well→Wellbore→{ProductionRecord, LogRun/LogSample, TrajectorySurvey/Station, FormationMarker, WorkProduct}. Every row carries `source_id` → manifest evidence. OSDU-aligned group-type tagging (ReferenceData/MasterData/WorkProduct/WPC/Dataset) per `data-foundation-research.md` — aligned, not certified.
- Well identity mastering table with explicit link evidence; exploration wells (15/9-*) never merged with development F-wells without documented proof; unproven candidate matches listed as `unlinked`, not forced.
- Per-file QC report (the refinery's product!): `docs/arganta-energy/qc/<file>.md` — rows decoded, nulls, unit set, depth ranges, anomalies.
- `data:validate` (all BUILD-PLAN §2.5 checks) green.

**★ GATE 2 (founder, ~10 min):** skim QC summary + row counts vs source.

## Batch O3 — OPUS · P2 shell + Data + Knowledge tabs
**Why Opus:** this is the Cosmo-grade design work; a mechanical model will produce a generic dashboard.

Vite/React app in `apps/energy` (port 5279, launch config `energy`): shell per BUILD-PLAN §3.1 (rail/context bar/tab bar/status bar, handoff design tokens, config-driven nav arrays, mono-label language, locked sibling-app switcher slot). **Data tab**: inventory browser over the real manifest (mirrored/selected/excluded-by-rule states, evidence drill-in). **Knowledge tab**: three-pane vault (explorer/markdown/backlinks-evidence), seed notes + Volve report WorkProducts listed with citations. 10/10 visual rubric pass (handoff §13) with real desktop+mobile screenshots. Truthful states everywhere; real values only.

## Batch S2 — SONNET · mechanical wrap for P2
README + Equinor Open Data Licence attribution block; mirror seed notes to `knowledge/*.md` files; `watchlist/watchlist.csv` header + first rows from competitor-landscape.md; type-check/build CI script; anything O3 marked `// TODO(mechanical)`.

**★ GATE 3 (founder):** look at the running app once.

## Batch O4 — OPUS · P3 Workbench v1 (the wedge)
Explorer tree (visibility eyes, counts) + Inspector rail + viewers: Map (UTM well locations, section-line drawing), Logs (multi-track GR/RHOB/NPHI/RT, log-scale RT, MD down, curve inventory, source-unit boundaries), Cross-section (tops correlated, `interpreted` badges), Trajectory (2D + labelled isometric projection), Production (per-well, explicit scales, no conversion). ◆/▲/✦ method capsules on every analytical output. Acceptance = write and pass `docs/arganta-energy/battle-test-20-tasks.md` — 20 scripted geologist tasks on Volve, each demonstrably completable.

**★ GATE 4 (founder):** run 3–5 of the 20 tasks yourself.

## Batch O5 — OPUS · P4 brain + agent seam
Ontology vocab (JSON), KnowledgeClaim records w/ evidence+confidence+valid-time, typed deterministic query tools (production stats, log stats, trajectory geometry), "Exploration Analyst" agent through `@arganta/ai` four-tier router with truthful run envelope + approval gate. LLM-assist entity matching (rules + LLM + human-confirm) per the refinery positioning — this is the differentiator, keep it Opus.

## Batch S3 — SONNET · P6 radar automation (mechanical, recurring)
Weekly scheduled sweep per `competitor-watchlist-workflow.md` → append dated rows to `watchlist.csv` + `watchlist/<yyyy-ww>.md`. Escalate to Opus only for the monthly synthesis memo.

## Batch O6 — OPUS · P5 Training Studio (after wedge validated)
Curriculum generator from brain + workbench (petrophysics on exploration wells; waterflood story on F-4/F-5 injectors). Every lesson cites evidence records; scenarios labelled.

---

## Sequencing & rules of engagement
```
F0 → O1 → ★1 → S1 → O2 → ★2 → O3 → S2 → ★3 → O4 → ★4 → O5 → O6
                                          S3 (recurring, independent after S2)
```
- A Sonnet batch may never modify pipeline logic, schemas, identity links, or design tokens — those changes bounce back to an Opus batch.
- Every batch ends by appending an entry to `knowledge/99 Archaeology/` (append-only decision log) and updating the project memory.
- RMO COSMO checklist at every gate: no external names/identities/data anywhere; all data maps to Volve.

# ArgantaEnergy — Battle-Tested Build Plan
Date: 2026-07-21 · Status: PLAN (no code built — awaiting founder approval)
Home when approved: `ArgantaLab/apps/energy` + `ArgantaLab/data-energy/` (raw mirror outside the app)

---

## 0. Mission recap (founder's goals, verbatim intent)

1. **Digital Brain** for oil & gas **exploration** first — development later.
2. **Digital Face, Body and Hands (Worker)** — a GeaVision-Studio-class workbench ("mini Petrel" for exploration & production). **This is the first wedge.**
3. **Training material** for O&G exploration generated from the brain + the bodies.
4. Scope: **static + dynamic data first** (production, logs, trajectories, picks, reports). No seismic volumes, no grids, no simulation output, nothing overkill.

Ground truth: **Volve Data Village in the founder's Databricks workspace** —
`https://dbc-353519aa-0abf.cloud.databricks.com`, volume `/Volumes/equinor_asa_volve_data_village/public/volve`.
Raw files must be **byte-identical (1:1)** to that source. No third-party mirrors, no pre-cleaned copies.

Constraints: Supabase ≈100 GB **shared** across all Arganta apps → Supabase receives only lean aggregates, never raw bulk. Local raw budget ≈ **≤2 GB**, selective.

Inspiration (read-only, de-identified): the Cosmo landing cockpit (single-file product-cockpit landing, config-driven nav, mono-label design language) and GeaVision Studio (three-pane IDE workbench, 12-tab pipeline spine, provenance-tagged state, agent step-runner with approval gate). **No name, identity or data from that project ever appears here — everything maps to Volve.**

---

## 1. Non-negotiable truth rules

- Never present synthetic / interpolated / forecast / scenario values as measured. `dataNature ∈ {measured, reported, interpreted, derived, forecast, scenario}` on every record.
- Preserve source values, identifiers, units, headers, file bytes. `raw` is immutable and byte-identical to Databricks.
- `raw / interim / processed / sample` kept strictly separate. Every processed row resolves to a `source_id` → evidence record `{volumePath, size, last_modified, sha256, retrievedAt}`.
- No silent unit conversion, no silent well renaming or branch merging. Derived fields are separately named.
- LLMs plan and explain; typed deterministic tools calculate and mutate. All mutations require approval + append-only audit.
- Licence: **Equinor Open Data Licence** (changed from CC BY-NC-SA in 2020) — attribution "Volve field dataset, © Equinor (and Volve licence partners)", no resale, licence notice accompanies any redistribution.

---

## 2. Data pipeline — 1:1 Databricks mirror (P0, the foundation)

### 2.1 Access method (researched, verified against Databricks docs + SDK source)

- **Auth**: Personal Access Token. Create: workspace UI → avatar → Settings → Developer → Access tokens → Generate. Store in `.env` as `DATABRICKS_TOKEN` (never committed). API base is the bare workspace URL — the `?o=7474651318832802` param is UI-only, never sent to the API.
- **List**: `GET /api/2.0/fs/directories/Volumes/equinor_asa_volve_data_village/public/volve/<dir>?page_size=1000` → `{contents:[{path,name,is_directory,file_size,last_modified}], next_page_token}`. Recursive walk with pagination.
- **Download**: `GET /api/2.0/fs/files/<url-encoded volume path>` with `Authorization: Bearer` → raw bytes. Supports `Range: bytes=N-` resume (206) + `If-Unmodified-Since: <last_modified>` so a changed file 412s instead of splicing corrupt bytes. 5 GiB/file API ceiling (irrelevant — we skip everything that big).
- **No server checksums** — the API exposes size + last-modified only. 1:1 integrity = exact byte-count match against the listing **plus** local SHA-256 recorded at stream time into a manifest.
- Gotchas handled by design: URL-encode each path segment (Volve names contain spaces); Windows illegal chars + 260-char path limit → keep local root short and sanitize only the local copy's *directory* representation while recording the exact source path in the manifest; marketplace share is read-only (403 on writes is expected); modest concurrency (4–6) with backoff on 429/5xx; 401 = expired PAT → stop and report, never retry-loop.

### 2.2 Three-phase mirror script (`scripts/volve-mirror.mjs`)

1. **plan** — recursive listing of the whole volume → `data-energy/manifest/inventory.json` (every file: path, size, last_modified). This is cheap (metadata only) and gives us the *actual* marketplace folder layout instead of assuming the classic one. A separate `selection.json` applies the include-list + byte budget.
2. **mirror** — bounded-concurrency streaming downloads of selected files: `.part` file → SHA-256 computed inline → atomic rename → manifest entry `{path, size, last_modified, sha256, bytes_written, retrievedAt, status:done}`. Resume via Range + If-Unmodified-Since. Idempotent re-runs skip verified files.
3. **verify** — always: size equality vs listing; `--deep`: full re-hash. Exit non-zero on any mismatch.

`data-energy/raw/**` mirrors the volume tree 1:1 (byte-identical files, original names). Git-ignored except the manifest.

### 2.3 Selection (fits ≤2 GB, no seismic) — classic inventory, to be confirmed by the `plan` phase against the real listing

| Volume folder (classic name) | Size | Decision |
|---|---|---|
| Production data | 2 MB | **ALL** — daily production/injection, the dynamic-data core |
| Well technical data | 212 MB | **ALL** — picks, trajectories, completion data, well headers |
| Geophysical interpretations | 99 MB | **ALL** — interpreted horizons/markers (labelled `interpreted`) |
| Reports | 162 MB | **ALL** — FDP, discovery reports → knowledge/RAG + training corpus |
| Reservoir model (Eclipse) | 390 MB | **Defer** (development-phase; exploration first) |
| Well logs (~6.9 GB) | selective | **Curated subset**: LAS/DLIS for the exploration wells (15/9-19 family) + key F-wells, ~1–1.2 GB cap |
| WITSML drilling (~5 GB) | selective | **Trajectories only** for mirrored log wells |
| RMS model / GeoScience archive / all Seismic (ST0202, ST10010, 4D, VSP) | 2 GB–2.6 TB | **SKIP — hard-excluded by rule** (validator refuses any path matching seismic patterns) |

Running total target: **≈1.6–1.9 GB**.

### 2.4 Processing + storage tiers

- **interim/**: decoded but unmodified structures (LAS→long table, DLIS via Python `dlisio` optional env, WITSML XML→stations, xlsx→rows). Units and identifiers untouched.
- **processed/**: canonical Parquet + JSON — Field→Well→Wellbore→{ProductionRecord, LogRun/LogSample, TrajectorySurvey/Station, FormationMarker, WorkProduct(report)} with `source_id` on every row. OSDU-**aligned**, explicitly not OSDU-certified.
- **sample/**: lean JSON the viewer imports (downsampled for rendering only, labelled as such).
- **Supabase** (later, optional): wells master, monthly production aggregates, markers, evidence index — a few MB total. Raw bytes never leave the machine.

### 2.5 Automated validation gate (`data:validate`)

Hashes match manifest; processed non-empty; PKs unique; source_ids resolve; dates valid; log depths + trajectory MD monotonic; TVD ≤ MD; incl/azi ranges; no seismic entity instantiated; every committed object <50 MB; well-identity links explicit (no forced matches — the 15/9-12/15/9-19 exploration wells vs F-development-wells distinction is enforced).

---

## 3. Product architecture

### 3.1 The Shell (Cosmo-inspired, Volve-grounded)

A **digital operator workstation**, not a SaaS dashboard: activity rail (58px) · top context bar (54px: brand, field/well selector, Ctrl-K, route badge) · domain tab bar (38px) · workspace · audit status bar (26px, mono). Design tokens from the handoff (§8): `#071014` bg, teal/amber/blue/violet/rose/orange semantic accents, mono for IDs/units/timestamps, square panels, hairline borders, no glassmorphism. Config-driven nav (nav = data arrays, not markup — the Cosmo pattern). Locked "sibling apps" switcher slot for future Arganta products. Floating agent orb (reduced-motion-safe) reserved for P4.

### 3.2 Domain tabs (phased, 9-tab target)

1. **Foundation** — hero, live data metrics (from manifest — real counts only), tri-brain cards, relational schema canvas.
2. **Data** — inventory browser over `inventory.json` + selection status + evidence ledger (the 1:1 manifest rendered honestly: mirrored / selected / excluded-by-rule).
3. **Knowledge** — three-pane Obsidian layout (explorer / markdown / backlinks + claim-quality). Seeded with roadmap, ADRs, evidence packs; Volve **reports** ingested here as WorkProducts with page-level citations.
4. **Workbench** ("mini Petrel", the wedge — GeaVision spine, battle-test first):
   - **Explorer tree** (wells → trajectory/logs/tops; visibility eyes, count badges)
   - **Map** (well surface locations, UTM, section-line drawing)
   - **Logs** (multi-track GR/RHOB/NPHI/RT, log-scale RT, MD down, curve inventory, source-unit boundaries visible)
   - **Cross-section** (wells hung on a line, tops correlated — `interpreted` badged)
   - **Trajectory** (2D + isometric-projection 3D, labelled as projection)
   - **Production** (rates vs time, per-well, no unit conversion, explicit scales)
   - **Inspector** right rail, context-sensitive per tab; ◆ deterministic / ▲ stochastic / ✦ LLM method capsules on every analytical output.
5. **Wells** — cross-domain coverage matrix + identity notes.
6. **Surfaces** — marker → datum/CRS → interpolation case → derived surface workflow; unavailable products labelled, never faked.
7. **Agents** — tier rack (reuse `@arganta/ai` four-tier router), truthful run envelope, approval gate.
8. **Training** — curriculum generator (P5).
9. **Audit** — checks, provenance timeline, issues.

v1 ships tabs 1–4; read-only; no backend mutation.

### 3.3 Tri-brain (unchanged from handoff §7)

Data+Physics (deterministic; an LLM answer is never a measurement) · Knowledge+Evidence (claims, citations, valid time, archaeology) · Decision+Agent (plans, routes tiers 0A→3, cannot self-approve). Intelligence tiers map onto the existing Arganta four-tier router (Sovereign/Sponsored/Economy/Frontier).

---

## 4. Competitive wedge (research 2026-07-21, full docs alongside this plan)

- **SLB Tela** (agentic, ADIPEC Nov 2025) and **Cognite Atlas AI** (Aker BP "AI-first") own the top-down enterprise agentic story — all hyperscaler-resident.
- **"EnergyAI"** disambiguation: energyai.com is an unrelated CA firm; the upstream ENERGYai is **AIQ** (ADNOC+G42+Microsoft+SLB); closest Houston analog is **Collide** ($5M seed 2025).
- Wedge (5 gaps): **sovereignty** (self-hostable brain; only Halliburton markets on-prem and has no modern agent layer) · **evidence-grounding** (auditable citation chains nobody leads with) · **public demonstrability** (a reproducible Volve pipeline as open credibility collateral) · **training bundle** (crew-change whitespace, no competitor bundles upskilling) · **mid-market pricing**.
- **Watchlist workflow**: weekly automated sweep (SLB/Cognite/ADME/AWS-EDI release notes, OSDU GitLab milestones, Crunchbase/LinkedIn alerts) → `docs/arganta-energy/watchlist/watchlist.csv` (date, vendor, signal, category, source, threat 1–5) → monthly memo → quarterly deep-dive → live notes during ADIPEC/EAGE/NAPE. Later surfaced as a "Radar" tab.

See: `competitor-landscape.md`, `competitor-watchlist-workflow.md` (rewritten alongside this plan).

---

## 5. Phases with acceptance gates

| Phase | Deliverable | Acceptance gate |
|---|---|---|
| **P0 Mirror** | volve-mirror.mjs (plan/mirror/verify), inventory of the real volume, ≤2 GB selection mirrored 1:1 | `verify --deep` green; manifest complete; zero seismic paths; re-run is a no-op |
| **P1 Canonical** | interim decoders (xlsx/LAS/DLIS/WITSML/picks), processed Parquet+JSON, evidence ledger | `data:validate` all checks green; row counts reported vs source; F-well vs exploration-well identity explicit |
| **P2 Shell + Data/Knowledge tabs** | Cosmo-grade shell, Data inventory browser, Knowledge vault with report ingestion | 10/10 visual rubric pass on these tabs (handoff §13), desktop+mobile screenshots, real values only |
| **P3 Workbench v1** | Explorer + Map + Logs + Production + Trajectory + Inspector | Battle-test script: 20 scripted tasks a geologist would do on Volve, each completable; states (loading/empty/derived/warning) truthful |
| **P4 Brain + Agents** | ontology, claims, typed query tools, Exploration Analyst agent with citations + approval gate | Every agent answer resolves to evidence records; run envelope shows actual provider/model |
| **P5 Training Studio** | curriculum generator from brain+workbench (petrophysics on exploration wells, waterflood story on F-4/F-5) | Lessons cite evidence; scenarios always labelled |
| **P6 Radar** | watchlist tab + weekly sweep automation | 4 consecutive weekly sweeps land dated signals |

Each phase ends with a founder review; no phase starts on an unapproved predecessor.

---

## 6. Battle test — failure modes & mitigations

| # | Failure mode | Likelihood | Mitigation baked into plan |
|---|---|---|---|
| 1 | PAT leaks into git | Med | `.env` + gitignore from commit #1; plan forbids token in any file/URL; 401 aborts loudly |
| 2 | Marketplace layout ≠ classic inventory | High | Phase `plan` lists the real tree **before** any selection is fixed; selection.json is data, not code |
| 3 | Databricks 429/timeouts mid-mirror | Med | Range-resume + If-Unmodified-Since, atomic .part renames, idempotent re-run, backoff |
| 4 | Silent corruption (no server checksums) | Med | Size match + inline SHA-256 manifest + `--deep` re-hash gate before P1 starts |
| 5 | Budget creep (logs folder is 6.9 GB) | High | Byte-budget enforced in selection phase; script refuses to exceed cap; per-well curation list |
| 6 | Seismic sneaks in via odd folder names | Low | Deny-list regex (seismic/segy/ST0202/ST10010/4D/VSP…) in both selection and validator |
| 7 | DLIS decoding stalls Node-only pipeline | Med | DLIS = optional Python `dlisio` env; LAS-first plan; DLIS decode is additive, never blocking |
| 8 | Well-identity confusion (exploration 15/9-x vs development F-x) | High (classic Volve trap) | Identity mastering table with explicit link evidence; validator forbids unproven merges; UI identity notes |
| 9 | Supabase quota damage | Low | Raw never uploaded; only aggregate tables; size check in publish script |
| 10 | Workbench becomes a demo toy, not a wedge | Med | P3 gate = 20-task geologist battle-test script, not "looks good" |
| 11 | RMO COSMO contamination (names/data leak in) | Must-not-happen | Rule recorded in project memory; only de-identified patterns documented; review checklist item at every phase gate |
| 12 | Wedge compression (Tela down-market, hyperscaler copilots) | Watch | P6 radar cadence; strategy re-check quarterly |
| 13 | OneDrive sync corrupting mid-write mirror files | Med (repo lives in OneDrive) | Mirror to `data-energy/` with `.part` staging; consider local non-OneDrive path for raw if sync interferes — decided at P0 |
| 14 | Licence misstep | Low | Equinor Open Data Licence attribution string hard-coded in footer + README + any export |

---

## 7. Day-1 execution order (when approved)

1. Founder creates PAT (Settings → Developer → Access tokens) → `.env`.
2. Build `volve-mirror.mjs`; run **plan**; present the real volume inventory + proposed selection for founder sign-off.
3. Run **mirror** + **verify --deep** → P0 gate.
4. P1 decoders + validation → then, and only then, the first pixel of UI.

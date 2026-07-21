# ArgantaEnergy — Architecture Vision (Mothership + Verticals)
Date: 2026-07-21. Supersedes the flat 9-tab framing in BUILD-PLAN §3. Reflects founder philosophy: Cosmo = the mothership platform; Workbench = a domain vertical inside it. Architecture-first: data + knowledge before UI depth.

## The two-layer mental model

```
┌────────────────────────────────────────────────────────────────────┐
│  ARGANTA ENERGY CORE  —  THE MOTHERSHIP  (Cognite CDF / Flow /       │
│                          SLB Lumi / Azure ADME equivalent)          │
│  The sovereign, evidence-grounded data+knowledge+agents OS.          │
│                                                                      │
│   Data Pipeline ─ Star Schema ─ Knowledge Graph ─ Agents ─ Govern.   │
│         │              │              │             │        │       │
│         └──────────────┴──────┬───────┴─────────────┴────────┘       │
│                               │  (one governed semantic model +      │
│                               │   evidence spine everything reads)   │
│   ┌───────────────────────────┴──────────────────────────────────┐  │
│   │  DOMAIN VERTICALS  (apps launched from the mothership)        │  │
│   │                                                              │  │
│   │  ▸ WORKBENCH — Field Development (mini-Petrel)  ← BUILD 1st   │  │
│   │  ▸ Reservoir Management            (later)                    │  │
│   │  ▸ Well Delivery / Maturation      (later)                    │  │
│   │  ▸ Exploration screening           (later)                    │  │
│   └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

- **Mothership = the product's moat.** It's what makes us the CDF/ADME/Lumi alternative: a sovereign, self-hostable, *evidence-grounded* data+knowledge+agent OS. Our competitor wedge (sovereignty + verifiable provenance + public Volve demo + mid-market) lives HERE. **Focus first.**
- **Verticals = the proof and the wedge-in.** The Workbench (mini-Petrel) makes the mothership tangible and demonstrable end-to-end on Volve. Every vertical reads the mothership's one governed semantic model + evidence spine — it never owns its own data.
- **The seam between them:** a vertical consumes `MODEL` (star schema) + the canonical tables + the evidence ledger via a read adapter. Verticals compute derived products (surfaces, volumetrics, forecasts) with the deterministic engine and write them back as `derived`/`scenario` claims — never as measured.

## Reflected shell (nav taxonomy) — from flat tabs to platform + launcher

BEFORE (flat): Foundation · Data · Knowledge · Workbench · Wells · Surfaces · Agents · Training · Audit.
AFTER (two zones):

**Zone A — MOTHERSHIP surfaces (the platform OS):**
1. **Core** (was Foundation) — the field picture, live metrics, the semantic-model canvas, tri-brain state.
2. **Data** — the ingestion/refinery pipeline: Databricks mirror ledger, decode stages, QC, provenance drill-in. (Our proven 1:1 pipeline surfaced.)
3. **Schema** (NEW, split from Data) — the star/semantic model: the 3-artifact contract rendered as the relational canvas (tables=nodes, FK=edges, crow's-foot cardinality, orphan-count badges).
4. **Knowledge** — the vault + knowledge graph (Obsidian-style), evidence context, deterministic extraction output.
5. **Agents** — the deterministic-first tier ladder (DET→SOV→FRO), agent rack, truthful run envelope, approval gate.
6. **Governance** (was Audit) — evidence lineage, checks, contradiction flags, portability readiness.

**Zone B — VERTICAL launcher (apps inside the mothership):**
7. **Workbench ▸ Field Development** — the mini-Petrel vertical (its own internal 12-tab spine; Wells & Surfaces fold IN as tabs, not top-level).
8. Reservoir Management · Well Delivery · Exploration — locked "coming" tiles now.
9. **Training** — vertical (later), reads brain + workbench.

The activity rail gets two visual groups: platform icons (top) + a vertical-app switcher (bottom), echoing how a mini-Petrel launches from inside a CDF-like OS. This is the config-driven nav array pattern (add a surface/vertical = one object).

## The Workbench vertical — full end-to-end spine (field development, exploration-grounded)
Richer than the reference's 12 tabs; the founder's stated flow:

1. **Map** — 2D structural (well locations UTM, section lines, polygons).
2. **Logs** — multi-track LAS (real Volve curves), draggable tops/picks.
3. **Structural model** — surfaces from picks + real depth horizons (gridSurface); top/base per interval.
4. **Contacts** — fluid contacts (GOC/OWC/GWC) as `interpreted`/`scenario`.
5. **Property modeling** — petrophysics (Archie: Vsh/PHIT/PHIE/Sw/net) → per-well props → geostatistical distribution to a property field.
6. **Volumetrics — map-based, two scales:**
   - **Field / region level** — GRV×NTG×PHIE×(1-Sw)/Bo over the closure/region, HCPV map.
   - **Well level** — drainage radius, fairway/sweet-spot maps, per-well recoverable (drainage circle ∩ closure × RF).
7. **Static model** — the lightweight integrated earth model (structure + properties + contacts), **computed deterministically** (NOT imported from Eclipse/RMS — see truth rule below).
8. **Uncertainty** — seeded Monte Carlo P90/P50/P10 (mulberry32, PERT/triangular), tornado.
9. **Dynamic forecast** — **simple deterministic simulation**: material-balance / tank model + Arps decline + a streamline-lite / analytical sweep (VRR-aware injector benchmark). Not a full reservoir simulator; a computed forecast labeled `forecast`/`scenario`.
10. **Economics** — NPV, payback, cashflow (mid-year discount).
11. **Presentation** — MBB-style deck (one `evaluate()` → slides).
12. **Report** — prose report (same `evaluate()` → chapters).

Later verticals reuse the SAME engine + semantic model: **Reservoir Management** (surveillance, VRR, pattern balancing), **Well Delivery / Maturation** (candidate ranking, opportunity gating).

## Truth rule reconciliation (important, battle-tested)
"No seismic / no grid / no simulation **data**" = we never DOWNLOAD Eclipse/RMS grids or sim decks from Volve (those folders stay excluded). It does NOT forbid **computing** a lightweight static model or an analytical forecast in our deterministic engine — those are `derived`/`forecast`/`scenario`, clearly labeled, reproducible, and cited to their measured inputs. The mothership's evidence spine enforces: measured inputs (logs/production/picks) → deterministic transform (engine, versioned) → derived output (badged). This is exactly the "an LLM answer is never a measurement" doctrine extended to "a simulation is never a measurement."

## Revised build strategy & phase order (architecture-first)

**MOTHERSHIP (build first — the moat):**
- **M1 — Star schema contract.** `contracts/schema.md` (hierarchy + join rules + FK ledger with our real orphan counts) + `ontology.md` (per-column dictionary) + generated `schema-meta.ts` (TABLES/FKS/GROUPS/CENTERS/COL_META + alias layer). Hub=well, child=wellbore, bridges=formation/interval + campaign/phase, facts=production/injection/pressure, marker=tops, gis=(deferred). Locked-early.
- **M2 — Data pipeline as a governed surface.** Formalize mirror→decode→canonical→validate as the named pipeline the Data tab renders (stages, provenance, orphan ledger). Mostly done; surface + document it.
- **M3 — Knowledge graph + deterministic extraction.** The `build*()` idempotent note generators (kbDistinct/kbCount/kbSlug, id=`kb-<type>-<slug>`), facts→`[[wikilinks]]`→edges, WELLTYPE_* ontology auto-linking, producer↔injector auto-derived from Volve injection allocation, ckFindCol fuzzy finder, vRecomputeLinks O(n) backlinks, Canvas2D LOD graph + schema-as-graph. Evidence-first claims.
- **M4 — Deterministic NLU + agents + tier ladder.** Keyword-bucket router grounded to `MODEL.relationships`; reconcile DET/SOV/FRO with @arganta/ai four tiers; LLM only opt-in synthesis behind the classification wall.

**VERTICALS (build on the moat):**
- **V1 — Workbench: Field Development.** Port the pure `engine` to TS (+unit tests), `adaptVolve(processed+MODEL)`, viewer registry, the 12-tab spine above (Map→Logs→Structural→Contacts→Property→Volumetrics(field+well)→Static→Uncertainty→Forecast→Economics→Deck→Report). Gate on the 20-task geologist battle-test. This is the demonstrable wedge.
- **V2+ — Reservoir Management, Well Delivery, Training** (later; reuse engine + model).

**Sequencing:** M1 → M2 → M3 → M4 → V1 → V2+. Each ends at a founder gate. M1 is the linchpin — lock the contract before extraction (M3) and the vertical (V1) both consume it.

## Battle test — the vision vs reality

| # | Risk / assumption | Verdict | Mitigation |
|---|---|---|---|
| 1 | "CDF/ADME/Lumi equivalent" is enormous scope; we can't out-feature incumbents | REAL | Don't. Compete only on the moat: sovereign + evidence-grounded + Volve-demonstrated + mid-market. Mothership = a *refinery + governed semantic model + evidence spine*, not a hyperscaler data platform. One killer vertical, not ten. |
| 2 | Architecture-first delays a visible wedge (founder momentum) | REAL | M1–M3 produce visible surfaces (Schema canvas, Knowledge graph) — not invisible plumbing. Ship each as a real tab. V1 follows fast on the locked contract. |
| 3 | Star schema contract drift once verticals consume it | REAL (their FK-id collision lesson) | Lock M1 early; auto-generate edge ids from `from|to`; alias layer absorbs name drift; verticals read `MODEL`, never redefine it. |
| 4 | "Static model + simple simulation" vs "no sim data" rule | Reconciled | Compute derived models deterministically from measured inputs; badge `derived/forecast/scenario`; never import Eclipse/RMS. Validator forbids any seismic/grid/sim ENTITY from raw. |
| 5 | Deterministic forecast too crude to be credible | MANAGEABLE | Material-balance + Arps + streamline-lite is legitimate screening-grade; label it screening/scenario, cite inputs, show uncertainty. Never present as full-physics sim. |
| 6 | Knowledge extraction produces plausible-but-wrong links | REAL | Rule-based only (no LLM in extraction); ambiguous merges → orphan ledger + human-confirm (our 28 unresolved picks already model this); link machine cross-refs by ID not title. |
| 7 | Well-level volumetrics (drainage/fairway) needs data we lack | CHECK | Drainage radius + fairway are computable from structure + property grids + well spacing (engine.scanInfill/scopeRegion). No extra data needed; label derived. |
| 8 | Two-zone shell reorg breaks the working O3 app | LOW | Nav is a config array; reorg = edit `nav.ts` + group rendering. Additive; existing tabs keep working. |
| 9 | Scale: Volve has far more log points than the reference's ~100 demo | REAL | Cache grids, downsample-for-render only, Canvas2D LOD, worker for heavy interp; no `JSON.stringify` memo keys. |
| 10 | Vertical sprawl (RM, Well Delivery) before V1 proven | GUARDED | Verticals stay locked tiles until V1 passes its 20-task battle-test. |

**Verdict:** the vision is sound and the wedge-aligned. The one discipline that makes or breaks it is **M1 (the locked semantic-model contract)** — it's the spine both the knowledge graph and every vertical hang from. Build it first, lock it, auto-id its edges, and everything downstream composes.

## Immediate next step
M1 — write the star-schema contract (schema.md + ontology.md + generated schema-meta.ts + FK ledger). It's high-leverage, mostly synthesis of what we already decoded, and unblocks M3 + V1. Recommend committing the current foundation + all architecture docs to main first, then M1.

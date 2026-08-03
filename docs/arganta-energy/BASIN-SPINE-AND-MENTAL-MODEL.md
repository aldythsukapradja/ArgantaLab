# The Basin Spine & Mental Model — end-to-end, exploration → drilling

2026-08-02 · Opus. The organizing model for ArgantaEnergy: what sits above a basin, what hangs below it, how knowledge and data separate, and how it lands on OSDU. Supersedes the tier sketch in [BASIN-CYCLE-KNOWLEDGE-INTEGRATION](BASIN-CYCLE-KNOWLEDGE-INTEGRATION.md) §2.

> **Vision:** open a basin — get everything, end to end.

---

## 0 · Citation strategy: cite the parent, not the compiler

Doust's book is largely a **compilation**: his figures are explicitly *"following"* or *"modified from"* other sources (basin types after **Kingston et al. 1983**; facies associations after **Walker & James 1992**; the depositional model after a public encyclopedia; sequence concepts after **Haq et al. 1987**, **Matenco & Haq 2020**). Cite the **primary source** for those.

**Cite Doust only for what is genuinely his:**
- the **basin-cycle-as-comparable-unit thesis** (cycles compare across basins better than whole basins do);
- his **cycle-family grouping criteria** (the six attributes);
- **Doust 2003**, *Placing petroleum systems and plays in their basin history context*, First Break 21(9);
- **Beglinger, Corver, Doust, Cloetingh & Thurmond 2012**, *A new approach to relating petroleum system and play development to basin evolution*, AAPG Bull. 96(6).

### The provenance ladder (enforced in the KB)

| Tier | What | Cite as | Example |
|---|---|---|---|
| **P0 · Primary** | the work that first established the fact, classification or dataset | default citation | Kingston et al. 1983; USGS province map; Walker & James 1992 |
| **P1 · Synthesis** | reviews/compilations that organise P0 | cite **only** for original synthesis | Doust (cycle thesis); Allen & Allen (framework) |
| **P2 · Derived** | what *our* engines compute from P0/P1 + real data | our engine + version | maturity map from `basin.ts` |

Every reference node in the KB stores `tier`, `primarySource`, and `viaSource` — so the graph itself records when we're standing on a primary source vs. a compiler. **This is the competitive asset:** a platform whose knowledge layer is traced to primaries is defensible; one that mirrors a single textbook is derivative.

> ⚠️ **Licensing reality:** tracing to the parent fixes *attribution* and often improves *access* (USGS is public domain; many primaries are licensable). It does **not** grant rights to copy the parent's artwork either — AAPG/Elsevier figures are copyrighted too. **The clean path: re-draw the concept from primary data in our own visual language and cite the primary.** Facts and classifications aren't copyrightable; specific artwork is. Never trace or copy figures from Doust *or* from the parent papers.

---

## 1 · Mental model — "The Basin Ladder"

Six questions. Each rung is simultaneously a **container**, an **assessment unit** (has geometry, risk, volume) and a **learning unit** (post-well results flow back up).

| # | Question | Rung | Deliverable |
|---|---|---|---|
| 1 | *Where am I?* | Province · Country · Block | acreage, coverage, data inventory |
| 2 | *What is this basin made of?* | **Basin → BasinCycles** | tectonostratigraphic framework, Wheeler chart |
| 3 | *Does it work?* | PetroleumSystem (spans cycles) | source, maturity, charge, timing, PSE chart, YTF |
| 4 | *Where, specifically?* | Play (in a cycle) | GDE, CRS ×3, CCRS, fairway |
| 5 | *How big, how likely, worth it?* | Lead → Prospect → Segment | GRV, P90/50/10, GCoS, EMV, ranking |
| 6 | *Can we drill it — and what did we learn?* | Well → Wellbore → Outcome | prognosis, PP/FG, trajectory, EOWR → **back to rungs 2–5** |

**The loop is the product.** Rung 6 feeds rung 2: every well re-dates a cycle, re-calibrates maturity, and updates the play's CRS. A platform that only goes down the ladder is a report generator; one that closes the loop compounds.

**The two-sentence version:**
> A basin is a **stack of cycles**. Each cycle is a candidate **petroleum system** producing **plays**; each play yields **prospects**; each prospect becomes a **well**; every well updates the stack.

---

## 2 · The spine

### 2.1 Two axes, one hub

`Province` answers *where am I*; `BasinCycle` answers *what is this like*. Conflating them is why most basin databases can't predict.

```
  SPATIAL AXIS (complete · public · "where")        GEODYNAMIC AXIS (process · "how it formed")
  1 World                                          6  BASIN            ◄── THE HUB (entry point)
  2 Region                                         7  BasinCycle       ◄── NEW · comparability unit
  3 Country (GeoPoliticalEntity)                   8  PetroleumSystem  (SPANS cycles)
  4 Province  ── USGS, spatial parent              9  AssessmentUnit   (USGS AU · statistics/YTF)
  5 Block / Licence area                          10  Play             (scoped to ONE cycle)
                                                  11  Lead
                                                  12  Prospect
                                                  13  Segment
                          ╲                    ╱
                       CONVERGENCE (the physical accumulation)
                       14 Field/Discovery → 15 Reservoir → 16 Pool
                                        │
                       WELL AXIS  17 Well → 18 Wellbore → 19 WellboreSegment
                                  → 20 ContactInterval → 21 Completion
                                        │
                       COMMERCIAL 22 Company · 23 Licence · 24 Asset
```

**Cardinality rules that matter**
- `Basin 1:N BasinCycle` — ordered in time; a polyphase basin is *many* cycles (this is what USGS provinces collapse).
- `Play N:1 BasinCycle` — a play lives in one cycle.
- `PetroleumSystem N:M BasinCycle` — **spans** cycles (source in one, reservoir in another). Modelling PS as cycle-scoped is wrong.
- `Province N:M Basin` — a province may hold several basins; a basin may straddle provinces. Keep the crosswalk explicit, never merge.

### 2.2 Cross-cutting dimensions (NOT tiers)

These apply at many rungs; modelling them as tiers is a classic mistake.

| Dimension | Values | Binds to |
|---|---|---|
| **Stratigraphy** | Megasequence → Sequence → Systems tract → Formation → Member → Bed | BasinCycle ↔ Megasequence |
| **Chronology** | age (Ma), events chart, critical moment | every rung |
| **Facies / GDE** | depositional system → facies association → facies | Cycle × area |
| **Risk** | CRS per element → CCRS | Play × area |
| **Maturity** | PRMS class × category | accumulation |
| **Evidence** | measured · reported · interpreted · derived · forecast · scenario | every value |

### 2.3 `BasinCycle` attributes (the comparability signature)

`geodynamicContext` (extensional · sag · compressional) · `cycleFamily` · `cycleStage` (early/climax/late syn-rift · transition · post-rift sag · syn-inversion · inversion) · `fill` · `proximity` · `climate` · `lithology` · `environmentChanged` · `faciesAssociations` · `boundaryType` · `ageRange`.

The **analogue key** is the tuple `(geodynamicContext, cycleFamily, cycleStage, fill, climate, lithology)` — a small categorical vector, deterministically scorable and fully explainable.

---

## 3 · The 12 verticals — what "everything end-to-end" means

Open a basin and every vertical is present, populated to whatever depth the data allows. Each has its own internal stack and a canonical grounding (P0 primaries; finalised by the running research pass).

| # | Vertical | Its own depth | Anchor canon (P0) |
|---|---|---|---|
| V1 | **Tectonics & basin evolution** | plate setting → basin type → cycles → subsidence/backstrip | Kingston et al. 1983; Bally & Snelson 1980; Ingersoll & Busby; Allen & Allen |
| V2 | **Stratigraphy** | megasequence → sequence → systems tract → formation | Vail/Haq et al. 1987; Catuneanu |
| V3 | **Sedimentology / GDE** | depositional system → facies association → facies | Walker & James 1992; Reading; Nichols |
| V4 | **Structure** | stress regime → fault families → trap types → restoration/balance | Dahlstrom; Fossen; Twiss & Moores |
| V5 | **Petroleum system** | source → maturation → expulsion → migration → trap → preservation | Magoon & Dow 1994; Hantschel & Kauerauf |
| V6 | **Geophysics / seismic** | acquisition → processing → interpretation → attributes → depth conversion | Sheriff & Geldart; Yilmaz; Brown |
| V7 | **Petrophysics** | curves → corrections → Vsh/φ/Sw → cutoffs → net pay | Rider & Kennedy; Ellis & Singer; Tiab & Donaldson |
| V8 | **Play & prospect risk** | play → CRS/CCRS → GCoS → probabilistic volumes → portfolio EMV | Rose 2001; Otis & Schneidermann 1997; Newendorp & Schuyler |
| V9 | **Resources classification** | class × category; creaming; YTF | SPE-PRMS 2018 |
| V10 | **Geomechanics & pore pressure** | overburden → NCT → Eaton/Bowers → PP/FG → mud window | Zoback; Aadnøy & Looyeh |
| V11 | **Well engineering** | basis of design → targets → trajectory → casing → mud → AFE | Bourgoyne et al.; Mitchell & Miska |
| V12 | **Operations geology** | prognosis → mudlog/striplog → geosteering → EOWR → lessons | industry practice + SPE |

**V1–V9 = Exploration. V10–V12 = the drilling handoff** — they consume the basin's interpretation and return as-drilled truth to it. That's the "until drilling" span, without duplicating the Well Delivery app: Exploration *plans and prognoses*; Well Delivery *executes*; the loop returns outcomes.

---

## 4 · Knowledge vs. data — three layers

The single most important separation. Most platforms conflate these and become unmaintainable.

| Layer | Contains | Mutability | Store | dataNature |
|---|---|---|---|---|
| **L1 · Reference (KB)** | the canon — concepts, classifications, methods, cycle families, textbook citations, analogue templates | append-only, versioned, **global** (not per-study) | knowledge graph | `reference` |
| **L2 · Instance (OSDU)** | real basins, cycles, wells, logs, surveys, records | governed, immutable records + revisions | **OSDU R3** | `measured` · `reported` |
| **L3 · Interpretation (Study)** | what *our* study concluded — CRS maps, GCoS, volumes, leads | versioned per study, lineage-tracked | `arganta:exploration:*` on OSDU | `interpreted` · `derived` · `scenario` |

**The knowledge layer *types* the data layer.** Every `BasinCycle` instance (L2) points at a `cycleFamily` concept (L1); every computed result (L3) points at the method concept that produced it, which points at its P0 primary. So any number on screen can be traced: *value → engine + version → method → primary citation*. That is the audit chain no competitor ships.

---

## 5 · OSDU mapping — adopt, extend, derive

| Spine tier | OSDU stance |
|---|---|
| World · Region · Country | **adopt** (GeoPoliticalEntity + reference data) |
| **Province** | adopt if a standard reference type exists; else `arganta:` extension carrying the USGS code as the authority ID *(research pass confirming)* |
| Basin | **adopt** (Basin master/reference data) |
| **BasinCycle** | **extend** — `arganta:BasinCycle` (new, the key addition) |
| PetroleumSystem · AssessmentUnit | **extend** (already 2 of your existing 5 extensions) |
| Play · Lead · Prospect · Segment | adopt where OSDU provides; extend the rest |
| Field · Reservoir · Pool | **adopt** |
| Well · Wellbore · Segment · Completion | **adopt** (OSDU/PPDM-aligned; 2 existing extensions) |
| Company · Licence · Asset | adopt/extend (CommercialAsset exists) |
| Stratigraphy dimension | **adopt** OSDU stratigraphic column/unit types |
| L3 interpretations | **extend** — `arganta:exploration:*`, governed by `governanceFor()` |

Rule: **adopt first, extend only where the standard is genuinely silent, never fork.** Every extension records why it exists. IDs stay `{authority}:{nativeId}` (e.g. USGS province code, Sodir NPDID) so nothing is orphaned from its source.

---

## 6 · Worktree structure

```
apps/energy/src/
  atlas/          spine.ts (24 tiers + dimensions) · cycles.ts (families) · provinces.ts · types.ts
  osdu/           kinds.ts · adapter.ts · governance.ts · extensions/
  knowledge/      canon/ (P0 references) · concepts/ · methods/ · analogues/ · graph.ts
  study/          study.ts (the DAG) · artifacts.ts · lineage.ts · scope.ts
  engine/         grid · closure · mc · volumetrics · econ · explore · analog
                  + basin.ts (P4a–d) · creaming.ts · restore.ts · pp.ts
  tabs/exploration/   1 atlas … 10 deliverables   (legacy/ = v1)
  verticals/      v1-tectonics … v12-ops-geology   (per-vertical models + viewers)

data-energy/
  projects/<slug>/    bundles (volve, west-natuna, …)
  reference/          provinces, cycle families, canon citations
  generated/osdu/     manifests

docs/arganta-energy/  concepts, specs, contracts
```

---

## 7 · Verified findings (research, 2026-08-02, two passes)

Run `wwli6gcv8` hit the account session limit; resumed clean as `wmrjmsq2k` (107/107 agents, 0 errors). **Across both passes, 15 claims survived adversarial verification — all 15 on the USGS province/TPS/AU side of the question.** Zero claims survived on Kingston et al. 1983, Bally & Snelson 1980, Ingersoll & Busby, Klemme, or the textbook-canon/OSDU-PPDM-PRMS questions (§7.3 — a real gap, not a formality).

### ✅ Confirmed — and they validate + correct this spine

| # | Finding | Consequence for the model |
|---|---|---|
| 1 | **USGS provinces are descriptive spatial containers** (lithology, strata age, structural style), **not a geodynamic-process classification** — *"[s]ome provinces include multiple genetically-related basins"* | **Province ≠ Basin, cannot be the process parent.** Confirms the spatial ‖ geodynamic axis split. |
| 2 | Hierarchy is **Province → TPS → AU**, reporting flows back up; **TPS only exist inside provinces selected for assessment** | **TPS/AU is a sparse, populated-on-demand layer, not a universal tier.** Confirms `Basin → BasinCycle` as the real backbone. |
| 3 | **937 named, numbered provinces across 8 regions** (WPA 2000, Klett et al. 1997) is the fixed, complete container-level registry — but only **128 provinces** (96 countries + 2 joint areas) got TPS/AU detail: **159 TPS / 270 AU defined, 149/246 assessed** | *(937 now CONFIRMED — reverses the prior pass's "did not verify".)* **Assessment coverage ≠ geometry coverage** — show unassessed provinces as "not assessed", never as zero. |
| 4 | Stable **8-digit positional ID**: digit 1 = region · digits 2–4 = province · digits 5–6 = TPS · digits 7–8 = AU | Adopt as the spatial-axis ID scheme — **with the topology caveat in §7.1**. |
| 5 | **TPS is formally a process/fluid entity**: essential elements (source·reservoir·seal·overburden) + generation-migration-accumulation + trap formation + all petroleum from one pod (or related pods) of active source rock — *"a naturally occurring, mappable hydrocarbon-fluid system"*; may equal one AU or subdivide into several | Adopt this definition verbatim for `arganta:PetroleumSystem`'s scope rule. |
| 6 | **USGS's own docs state 3 operational limitations:** (a) play-level assessment was infeasible — the framework stops one level coarser than play/prospect; (b) **AU boundaries frequently cross province boundaries and AU polygons overlap one another** — USGS needed ArcInfo *"region"* topology, not simple polygons; (c) geometry at **~1:5,000,000 scale, 500 m fuzzy tolerance (max accuracy 1,000 m), no datum/spheroid defined** | **Corrects §7.1** — the clean-tree assumption doesn't hold spatially. USGS geometry is screening-scale only; never use it as an operational (well/prospect) spatial reference. |

Sources: USGS ScienceBase `60ad2fd7d34e4043c850edb3`, `60ad2fa1d34e4043c850ed98`; USGS DDS-060 `PS.pdf`, `IN.pdf`; USGS data catalog `60bfec21d34e86b938917fa7.xml` (public domain). Two primary PDFs 403'd on direct re-fetch during verification — several claims rest on independently convergent secondary corroboration rather than a fresh primary fetch; treat as high-confidence, not primary-certain.

### 7.1 · The USGS code gives a free *administrative* ancestor — CORRECTED

Parsing the id gives the **assessment-accounting** ancestor instantly (`atlas:province:usgs:{R}{PPP}` · `atlas:tps:usgs:{R}{PPP}{TT}` · `atlas:au:usgs:{R}{PPP}{TT}{AA}`). **But finding #6 means this is not a spatial containment tree.** An AU's id says which province its resource estimate is *credited to* — it does **not** guarantee the AU polygon lies inside that province's polygon; AU polygons cross provinces and overlap each other by design.

**Design rule — two resolution paths, never conflated:**
- **By code** (known province/TPS/AU): parse the id → instant, free, administrative ancestor. Use for Scope Bar breadcrumbs and search.
- **By geometry** (map click / drawn AOI): run an actual point-in-polygon/overlap query — **do not** infer the province from whichever AU code sits under the cursor, and expect **multiple overlapping AUs** at one point; surface all of them, let the user pick.
- If code and geometry disagree, that's a **legitimate multi-province AU**, not a bug — show both, never silently choose one.
- USGS geometry is screening-scale only (#6c) — never resolve a well-level pick against it.

### 7.2 · Still open — highest value first
1. **OSDU native reference types** for province/basin/play/stratigraphy — decides adopt-vs-extend; unresearched after two passes.
2. Whether any **open, globally complete basin identifier registry** exists beyond USGS's 937-container/128-assessed split.
3. **Ingersoll & Busby** vs **Kingston et al. 1983** vs a merged vocabulary for `cycleFamily`.
4. Final P0 textbook citations per vertical (V1–V12 anchors remain my own recollection, unverified).

### 7.3 · Honest scope note
Both passes fanned the full 3-part brief out; both times **only the USGS sub-question produced claims that survived verification** — not because the other schemes/standards don't exist, but because the harness couldn't corroborate specific claims about them from ≥2 independent sources (soft 1-2 votes on Doust/Kingston-adjacent claims mean *"not corroborated,"* not *"false"*). **Treat V1–V12 citations and the non-USGS classification comparison as unverified working assumptions** until researched narrowly, one topic at a time — broad multi-part fan-out doesn't reliably surface verifiable claims outside the best-indexed, public-domain source (USGS).

# Basin-Cycle Knowledge Integration — Doust framework → data model, KB, Exploration tabs

2026-08-02 · Opus. How **"Dissecting Sedimentary Basins" (Harry Doust, emeritus prof. Regional Geology, VU Amsterdam)** enters the ArgantaEnergy knowledge base, what it changes in the ATLAS/OSDU data model, and how each Exploration sub-tab consumes it.

**Source:** founder-supplied PDF (Drive, 29 MB, ~180k chars text). **Licence status: unresolved — treat as reference-only.** We encode the *classification scheme* (facts/ideas, properly attributed), **never the book's text or figures**. No passages are copied into the repo or shipped to users.

---

## 1 · Why this material matters

Doust's thesis: **basin cycles, not whole basins, are the comparable unit.** Basins are unique composites; their component tectonostratigraphic cycles recur worldwide with consistent character. He classifies cycles by geodynamic context and a small set of depositional attributes, so that *"with limited knowledge"* one can predict the likely facies succession in an under-explored basin.

That is precisely the **analogue problem** our platform exists to solve — and Doust's own cited programme is literally our Play Fairway tab:
- Doust 2003, *Placing petroleum systems and plays in their basin history context*, First Break 21(9)
- Beglinger, Corver, Doust, Cloetingh & Thurmond 2012, *A new approach to relating petroleum system and play development to basin evolution*, AAPG Bull. 96(6)

So this is not a stray reference — it is the **theoretical backbone for Basin Framework, GDE, Play Fairway and the analogue engine.**

---

## 2 · The data-model gap it exposes (the important finding)

The ATLAS spine runs `world · region · country · **basin · petroleum-system · assessment-unit · play** · prospect · field · reservoir · well …`.

**There is no tectonostratigraphic tier between Basin and PetroleumSystem** — yet the ARWANA gold standard is built entirely on one. Its mega-sequences (**SB-34 · SB-30 · SB-28 · SB-26 · SB-23 · SB-16 · SB-10**) carry the whole study: GDE is mapped *per mega-sequence*, plays are named *per mega-sequence* ("SB-34 Late Eocene Clastic Play"), CRS/CCRS are computed *per play* = per sequence, and the Wheeler diagram *is* the cycle chart.

### Proposal: add `basin-cycle` as an ATLAS tier

```
basin ──1:N(ordered in time)──► basin-cycle (tectonostratigraphic mega-sequence)
                                   │
                    play ──belongs-to──┘        (a play is scoped to a cycle)
petroleum-system ──spans──► many basin-cycles   (source in one, reservoir in another)
```
Cardinality matters: a **play sits inside one cycle**, but a **petroleum system crosses cycles** (ARWANA: the SB-30 play is charged from *both* SB-34 and SB-30 source rock). Modelling PS as cycle-scoped would be wrong.

### `basin-cycle` attributes — Doust's classification, as structured fields

| Field | Values (after Doust) |
|---|---|
| `geodynamicContext` | extensional · sag · compressional |
| `cycleFamily` | rift/graben · failed-rift sag · passive-margin sag · cratonic-interior · peripheral-platform · intracratonic · collision-foreland · Laramide-foreland · post/supra-orogenic · arc-related-peripheral-foreland · accretionary-forearc · accreted-terrane |
| `cycleStage` | early syn-rift · climax syn-rift · late syn-rift · transition · post-rift/sag · syn-inversion · inversion |
| `fill` | marine · non-marine · mixed |
| `proximity` | proximal · distal (marine fills) |
| `climate` | tropical · arid · continental · temperate/boreal |
| `lithology` | clastic · carbonate · mixed |
| `environmentChanged` | boolean (did depositional environment shift within the cycle) |
| `faciesAssociations` | non-marine · paralic/coastal · open-marine · deeper-marine (off-shelf) |
| `boundaryType` | unconformity · transition |

The first six + `environmentChanged` are Doust's own grouping criteria; the facies associations follow his depositional model (after Walker & James 1992); basin-type context follows Kingston et al. 1983.

**ARWANA maps onto it cleanly** — e.g. SB-34 = extensional / rift-graben / early syn-rift / non-marine (lacustrine) / clastic; SB-23 = sag / post-rift; SB-16 = compressional / syn-inversion. **Volve maps too** — Draupne/Heather = late syn-rift, Hugin = climax syn-rift, Shetland/Hordaland/Nordland = post-rift sag.

### OSDU / storage
`basin-cycle` becomes an `arganta:` extension kind (like the existing 5: PetroleumSystem, AssessmentUnit, WellboreSegment, Completion, CommercialAsset), governed by `governanceFor()`. Doust-derived attribute *values* are `interpreted`; the classification vocabulary itself is `reference` with a citation.

---

## 3 · Knowledge-base integration

Current KB (`src/cosmo/knowledge-model.ts`): KTypes `field · reservoir · formation · well · petrophysics · domain · lifecycle · output · standard · analog · concept · decision`; `DataNature` already includes **`reference`**.

Add:
- **KTypes** `basin` and `basin-cycle` (part of the already-planned spine-tier KType expansion), in a new folder `12_Basins` / `16_Cycles`.
- **A reference node** for the Doust framework (`type: concept`, `provenance: 'reference'`, `source: 'Doust, Dissecting Sedimentary Basins'`) plus nodes for the two cited papers — these are *citations with our own summaries*, not copied text.
- **Edges** (existing kinds suffice): `basin --contextualizes--> basin-cycle`; `basin-cycle --applies--> doust-framework`; `play --relates--> basin-cycle`; `basin-cycle --evidences--> gde-map`.
- **Cycle-family concept notes** (one per family) become the **analogue hubs** — every basin cycle worldwide wikilinks to its family, so the KB graph naturally clusters comparable cycles across basins. That is Doust's thesis rendered as a graph.

---

## 4 · How each Exploration sub-tab consumes it

| Tab | Consumes the framework as |
|---|---|
| **1 Atlas** | Classify/screen world-DB basins by `geodynamicContext` + `cycleFamily`; a new **scope facet** ("show me all failed-rift sag cycles") — breadth screening the world DB cannot otherwise do |
| **2 Data Room** | Cycle-aware inventory: which wells/lines penetrate which cycle |
| **3 Basin Framework** | **Primary consumer.** This tab *is* the basin-cycle editor: define/order cycles, assign Doust attributes, render the **Wheeler diagram** and **well-penetration chart** against cycles |
| **4 Seismic & Structure** | Cycle boundaries = the horizons to map (unconformity vs transition); mega-sequence framework drives TSM/DSM/isopach per cycle |
| **5 Petrophysics** | Reservoir-parameter distributions rolled up **per cycle**, so P10/50/90 are cycle-scoped (as ARWANA does per SB-interval) |
| **6 GDE** | Doust's facies associations + per-cycle-type environmental models give the **expected facies template** for each cycle — the prior the GDE map is drawn against |
| **7 Basin Modeling** | Cycle boundaries = burial-history layer boundaries; Doust's cycle-type thermal regimes (Ch. 2) seed heat-flow assumptions where no measurement exists |
| **8 Play Fairway & CRS** | Plays are cycle-scoped; the Doust/Beglinger method **relates play development to basin evolution** — the CRS presence/quality priors come from the cycle's expected facies |
| **9 Prospect & Risk** | **Analogue-driven priors**: where local data is thin, seed reservoir/seal chance and property ranges from same-cycle-family analogues worldwide, flagged `interpreted` + cited |
| **10 Deliverables** | ARWANA §4 "Tectonostratigraphic Mega-Sequence Framework" is generated directly from the cycle objects |

### The engine change this unlocks
`src/engine/analog.ts` currently matches on field-level similarity. Doust's thesis says that is the weaker comparison. **Match on cycle signature instead** — `(geodynamicContext, cycleFamily, cycleStage, fill, climate, lithology)` — a deterministic scorer over a small categorical vector, cheap and explainable. This makes the cross-field moat real: every new basin added enriches the cycle-family population, and analogues get better for everyone.

---

## 5 · Doctrine & licence guardrails

- The **vocabulary** is `reference` (cited); **values assigned to a real cycle** are `interpreted`; anything predicted from analogues is `interpreted`/`scenario` — never `measured`.
- Analogue-seeded priors must always display their source cycle + citation, and be overridable by local data. Missing data stays visible.
- **Licence unresolved → reference-only.** Encode the taxonomy with attribution; do not ingest, redistribute or display the book's text or figures. If the founder secures rights, revisit shipping figure-derived content.

---

## 6 · Build order (fits the existing S-phases)

- **S0** — add `basin-cycle` to the ATLAS spine + OSDU extension kind + the scope-filter facet.
- **S2 (Basin Framework)** — the cycle editor + Wheeler diagram; backfill Volve and ARWANA/West Natuna cycles.
- **S3 (GDE)** — facies-association templates per cycle family.
- **S4 (Basin Modeling)** — cycle-boundary burial layers + per-family thermal priors.
- **S5 (Play Fairway)** — cycle-scoped plays, Doust/Beglinger play-vs-basin-evolution priors.
- **S8** — the cycle-signature analogue scorer in `analog.ts`.

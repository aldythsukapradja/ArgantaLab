# ATLAS — The World Petroleum Data Catalogue (Concept)

*Standardized entity model + knowledge-base mapping for ArgantaEnergy's "central brain of
world petroleum." Concept stage — no build yet. Combines the best of Wood Mackenzie + IHS,
anchored on open standards (OSDU · PPDM · USGS · SPE-PRMS) so it is defensible and portable.*

---

## 1. Why not a single tree

The intuitive chain **World → Basin/Play → Reservoir → Country → Field → Well** mixes two
different axes: a **geographic/political** axis (World · Region · Country) and a **geologic**
axis (Basin · Petroleum System · Play · Reservoir). A basin crosses countries; a field spans
blocks; a play spans fields. Both Wood Mackenzie and IHS resolve this the same way — **two
parallel axes that converge at Field and Well** — so you can drill *by geography* or *by
geology* and land on the same asset. ATLAS adopts that.

Four design rules, taken from the best of both vendors + the open standards:

1. **Canonical names from OSDU** (open, versioned master-data schema) — the neutral backbone.
2. **Two axes converge at Field/Well** (IHS + WoodMac) — geologic and commercial modelled separately, joined by relationships. Never conflate the geologic **Field** with the commercial **Asset**.
3. **Metric–dimension fact model** (Wood Mackenzie) — every quantity is one value decomposed along orthogonal dimensions, not flat columns.
4. **Resource maturity on two orthogonal axes** (SPE-PRMS) — *class* (Prospective/Contingent/Reserves/Production) and *category* (Low/Best/High ↔ 1/2/3 ↔ P90/P50/P10) are separate fields, always.

---

## 2. The canonical entity spine

Every tier has a **stable ID**, a **name**, and **denormalized ancestry** (WoodMac pattern:
a Field carries its region/basin/play as attributes so it stands alone). Volve is the worked
example — every value is real (USGS DDS-69 · Sodir · Equinor Volve).

### Geologic / exploration axis — *where petroleum is*

| Tier | ATLAS entity (OSDU-aligned) | Aligned standards | KB `KType` | Volve example (real) |
|---|---|---|---|---|
| 0 | **World** | — | `world` | Earth |
| 1 | **Region** | USGS Region · WoodMac Region | `region` | 4 · Europe |
| 2 | **Country** (GeoPoliticalEntity) | OSDU GeoPoliticalEntity · UN name | `country` | Norway (NO) |
| 3 | **Basin** | OSDU Basin · Robertson · USGS Province | `basin` | North Sea Graben (USGS 4025) |
| 4 | **PetroleumSystem** | USGS TPS · IHS Petroleum System | `petroleum-system` | Kimmeridgian Shales |
| 5 | **AssessmentUnit** | USGS AU (assessment container) | `assessment-unit` | Viking Graben (40250101) |
| 6 | **Play** | OSDU Play · IHS/WoodMac Play (⊂ AU) | `play` | Middle Jurassic Hugin |
| 7 | **Prospect / Lead** | OSDU Prospect | `prospect` | *(pre-discovery state of Volve)* |
| 8 | **Field** (= Accumulation) | OSDU/PPDM/IHS Field · USGS Accumulation | `field` | Volve (NPDID 3420717) |
| 9 | **Reservoir / Pool** | OSDU Reservoir · PPDM Pool | `reservoir` | Hugin Fm (Pool = regulatory) |

### Well axis — *the physical hole* (PPDM verbatim; universally agreed)

| Tier | ATLAS entity | Definition | KB `KType` | Volve example |
|---|---|---|---|---|
| 10 | **Well** | regulatory/intent object | `well` | 15/9-F-12 (slot) |
| 11 | **Wellbore** | drilled path, origin→terminus | `wellbore` | 15/9-F-12 bore |
| 12 | **WellboreSegment** | original or sidetrack interval | `wellbore` | (sidetracks) |
| 13 | **ContactInterval** | MD range vs strat zone | `completion` | Hugin perf interval |
| 14 | **Completion** | contact intervals as a producing/injecting unit | `completion` | F-12 completion |

### Commercial / fiscal axis — *who owns & produces* (WoodMac; joins at Field/Well)

| ATLAS entity | Aligned standards | KB `KType` | Volve example |
|---|---|---|---|
| **Company** (Organisation) | OSDU Organisation · WoodMac Company | `company` | Equinor Energy AS |
| **FiscalRegime** | WoodMac country fiscal regime | `standard` | Norway PSC/tax |
| **Licence / Block / Contract** | IHS Block/Contract Header · Sodir/NSTA · WoodMac Block | `licence` | PL 046 · 046 BS · block 15/9 |
| **Asset** (commercial wrapper) | WoodMac Asset (field/group under a regime) | `asset` | Volve asset |
| **Interest** (equity fact) | WoodMac ownership | *(edge)* | Equinor 100% |

> **Term-collision guardrails** (from the crosswalk): Basin ≠ Province (geologic vs
> administrative) · Play ⊂ AssessmentUnit ⊂ PetroleumSystem (three granularities, don't merge)
> · Field (geologic) ≠ Asset (commercial) · Reservoir (geologic) ≠ Pool (regulatory) ·
> Well (intent) ≠ Wellbore (physical). Keep each pair distinct with a relationship.

---

## 3. The two drill paths (one graph, two traversals)

- **By geography** (operator view): `World › Region › Country › Field › Well`
- **By geology** (explorer view): `World › Basin › PetroleumSystem › AssessmentUnit › Play › Field › Reservoir › Well`

Both converge on **Field → Reservoir → Well**. The catalogue is a graph; the cockpit lets you
enter from either end. Volve is reachable both ways — the proof that the model is coherent.

---

## 4. Resource maturity — the PRMS cube (two orthogonal enums, never merged)

- **Class** (maturity): `Prospective` (undiscovered: Play/Lead/Prospect) → `Contingent`
  (discovered, not yet commercial) → `Reserves` (commercial, remaining) → `Production`
  (produced) → `Unrecoverable`.
- **Category** (uncertainty): `Low / Best / High` = `1U/2U/3U` (prospective) = `1C/2C/3C`
  (contingent) = `1P/2P/3P` = `P90/P50/P10` (reserves).

This axis is what lets ATLAS carry the **whole lifecycle from exploration to production** on one
volume: a USGS assessment (Prospective/Fmean) *matures into* a discovered Field (Contingent)
*matures into* booked Reserves (2P) *depletes into* Production — same accumulation, moving
classes over time.

---

## 5. The fact model — Wood Mackenzie's metric–dimension pattern (the best idea to steal)

Never store `reserves_2p_oil_remaining_mmbbl` as a column. Store one **Quantity** fact:

```
Quantity {
  entityId,                 // atlas:field:sodir:3420717
  metric,                   // "Reserves recoverable" | "Production" | "Capex" | "NPV" | ...
  value, unit,              // 63.0 · MMBBL
  dims: {
    prmsClass,              // Reserves | Contingent | Prospective | Production
    prmsCategory,           // P90 | P50 | P10  (Low|Best|High)
    productType,            // oil | condensate | NGL | gas
    producedRemaining,      // produced | remaining
    liquidGas,              // liquid | gas
    commercialTechnical,    // commercial | technical | contingent
    year,                   // 2016
    priceDeck, realNominal, capexOpex, discountRate   // for economics
  },
  provenance: { dataNature, source, licence }   // measured|interpreted|derived|reference
}
```

One tidy fact table answers reserves, production, cost, and valuation questions by filtering
dimensions — exactly how WoodMac's UDT `Field reserves` / `Field annual cash flow` work. Your
existing `DataNature` ladder (measured/interpreted/derived/reference) becomes the provenance dim.

---

## 6. Master crosswalk (for the data dictionary)

| ATLAS tier | Wood Mackenzie | IHS / S&P | PPDM | OSDU | USGS | PRMS |
|---|---|---|---|---|---|---|
| Region/Country | Region → Country | Country/Region | `AREA` (typed) | GeoPoliticalEntity | Region/Province | — |
| Basin | Basin | Basin | `BASIN` | Basin | Province/Basin | — |
| PetroleumSystem | (implicit) | Petroleum System | (strat) | (via Play) | **TPS** | — |
| AssessmentUnit | Play | Play (assessment) | `PLAY` | Play | **AU** (Play⊂AU) | Prospective |
| Play | Play | Play | `PLAY` | Play | Play | Play/Lead |
| Prospect | Prospect | Prospect | — | Prospect | Prospect | Prospective |
| Licence/Block | Block/Licence | Block/Contract Header | `AREA` (agreement) | (rights) | — | — |
| Field | **Field / Asset** | Field Header | `FIELD` | Field | **Accumulation** | project |
| Reservoir | reservoir | **Reservoir** | `RESERVOIR` | Reservoir | Reservoir | project |
| Pool | — | Pool | `POOL` | (Reservoir) | Pool | — |
| Well | Well | Well | `WELL` | Well | Well | — |
| Wellbore | (well) | Wellbore | `WELLBORE`→Segment→ContactInterval→Completion | Wellbore | — | — |
| Company | Company | Operator | (BA) | Organisation | — | — |

---

## 7. Mapping to the knowledge base (`cosmo/knowledge-model.ts`)

The KB model is already field-agnostic (`buildGraph(fields: FieldSeed[])`). ATLAS extends it:

**New `KType`s** (add to the existing 12): `world`, `region`, `country`, `basin`,
`petroleum-system`, `assessment-unit`, `play`, `prospect`, `licence`, `company`, `asset`,
`wellbore`, `completion`. (Keep `field`, `reservoir`, `well`.)

**New edge kinds** (add to the existing 8): `located-in`, `held-under`, `operated-by`,
`penetrates`, `matures-to`, `sequenced-in`. Reuse `contextualizes`/`evidences`/`produces` where they fit.

**New folders** (extend `FOLDER_ORDER`): `00_World`, `12_Basins`, `13_Plays`, `14_Licences`, `15_Companies`.

**Extend `FieldSeed`** with structured taxonomy + commercial blocks:
```
taxonomy:  { region, country, basin, petroleumSystem, assessmentUnit, play }
commercial:{ operator, partners[], licences[], asset }
maturity:  { class, discoveredYear, reservesCategory }
spatial:   { sector, block, npdid, lat, lon, boundary? }   // from the NSR work
```
`volveSeed` fills the real chain: Europe › Norway › North Sea Graben › Kimmeridgian Shales ›
Viking Graben › Hugin play › **Volve** › Hugin Fm › 15/9-F-12. The connected twin grows from
~140 Volve notes into a **world graph** with Volve as the lit, proven node.

**Canonical ID scheme:** `atlas:{entity}:{authority}:{nativeId}` —
`atlas:field:sodir:3420717` · `atlas:au:usgs:40250101` · `atlas:basin:usgs:4025` ·
`atlas:country:un:NO` · `atlas:licence:sodir:046`. The authority segment records the source.

---

## 8. Lifecycle coverage — exploration → drilling sequence

ATLAS spans the whole funnel because the maturity axis lets one accumulation move classes:

`Play/AU (Prospective, USGS Fmean)` → `Prospect (risked, GCoS)` → **discovery** →
`Field (Contingent)` → appraisal → `Reserves (2P)` → **well design** (`Well` planned) →
**drilling sequence** (`Well` scheduled on a rig, `sequenced-in`) → `Wellbore/Completion` →
`Production`. Every ArgantaEnergy lifecycle (Exploration → Field Dev → Well Delivery → Drilling
Sequence → Reservoir Mgmt) reads/writes a slice of this one catalogue.

---

## 9. Shippable vs proprietary (carry-over from the licence work)

- **Shippable (open):** USGS world assessment (endowment) + Sodir/NSTA regulator data
  (blocks/licences/fields/wellbores) + Equinor Volve. This is the public ATLAS spine.
- **Private tier only (proprietary):** Wood Mackenzie / IHS content. ATLAS *adopts their
  structure* (which is not copyrightable) but must **not** ingest their data into the public
  app — commercial values live behind auth or as user-supplied private data.

The genius move: ATLAS gives you a WoodMac/IHS-grade **structure** filled with **open data**,
so the public product is legal and credible, and the same schema accepts a customer's licensed
WoodMac/IHS feed privately.

---

## 10. Next steps (when we build)

1. `src/atlas/types.ts` — the canonical entity + Quantity-fact interfaces (this concept, typed).
2. Reshape the USGS + NSR assets already in `public/world` + `public/nsr` into ATLAS entities.
3. Extend `knowledge-model.ts` (KTypes/edges/folders/FieldSeed) — Volve threaded end-to-end.
4. `volve-model.ts` DB schema gains the ATLAS reference groups.
5. Cockpit consumes it: drill by geography *or* geology → Volve.

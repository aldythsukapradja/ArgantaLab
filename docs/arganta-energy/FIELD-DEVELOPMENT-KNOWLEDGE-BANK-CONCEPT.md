# Field Development Knowledge Bank — the Asset Dossier

**Status:** concept + D-KB0 shell built (2026-08-03)
**Sibling to:** `EXPLORATION-SUITE-CONCEPT.md` (the Basin Dossier), `FIELD-DEVELOPMENT-SUITE-CONCEPT.md`

---

## 1. The question the screen answers

The Exploration Knowledge Bank was reframed from a record browser into a **screening
tool**. One screen answers:

> *"Is this basin worth my money, and what do I still need to find out?"*

Field Development is the next decision down the chain, so its Knowledge Bank answers the
next question — and it is a fundamentally **more grounded** question, because the rock has
already been found:

> *"Can this field be developed, how has it actually performed, and what do I still need
> to know before I sanction it?"*

Exploration reasons about **what might be there**. Field Development reasons about **what
is there and what it has done** — dated milestones, filed reserves, produced volumes,
comparable fields. That difference is the whole design brief: where the Basin Dossier
shows *chance and endowment*, the Asset Dossier shows *record and performance*.

### What is being replaced, and why

The current `src/tabs/fielddev/KnowledgeBank.tsx` is a four-panel **record browser**:
Location · Geological alignment · Resource view · Aligned evidence. It reports *what we
have linked* (GOGET ✓, USGS ✓, 105 Volve records) rather than *what we know about this
asset*. It renders no dated milestone, no production history, no benchmark, and no verdict
— and its "Aligned evidence" panel is really a data-plumbing status board pointed at the
user.

That is precisely the failure mode the Basin Dossier was rewritten out of. The Asset
Dossier replaces it wholesale.

---

## 2. The mapping — same skeleton, development semantics

The design *feel* is deliberately identical: one non-scrolling viewport, a header whose
numbers are themselves the buttons, a map holding column 1 across both content rows, a
three-card verdict strip, two analytical panels, and everything deeper behind a modal.

| Basin Dossier (Exploration) | Asset Dossier (Field Development) | Why it is the true analogue |
|---|---|---|
| Scope = basin / province / AU | **Scope = field** | FD operates at field granularity — the shell already requires a field |
| Major fields · Found · Left to find | **Reserves · Lifecycle · Remaining** | endowment → *booked volume and dates* |
| Basemap of the basin | **Field locator map** | same component, field-focused |
| **Maturity** (creaming curve) | **Maturity** (PRMS lifecycle bar) | both answer "how far along is this?" — creaming curve → discovery→FID→first-oil→plateau→decline |
| **Geology** (basin cycles / Doust) | **Reservoir & drive** (lithology · drive · formation) | both answer "what kind of rock am I dealing with?" — the drive mechanism is FD's geodynamic class |
| **Hydrocarbon mix** (donut) | **Production mix** (donut) | discovered fluid type → *produced* fluid split |
| **Petroleum system events chart** (elements/processes in geologic time) | **Development timeline** (milestones + production history in calendar time) | the signature chart of each surface: Ma before present → years AD |
| **Tectonostratigraphy** (ICS ‖ cycles ‖ elements) | **Analog benchmark** (this field ‖ comparable-field cohort) | the "where does this sit in the wider frame" panel |
| **Knowledge gap ledger** | **Development readiness ledger** | identical idea: the missing evidence *is* the work programme |
| **Remaining potential** (USGS YTF) | **Remaining reserves** (booked − produced) | undiscovered → *undeveloped* |
| **Field database inventory** | **Analog cohort inventory** | the browsable table behind the headline |

### The one deliberate divergence

Exploration's geologic-time axis runs **backwards** (Ma before present, oldest left).
Field Development's runs **forwards** (calendar years, discovery left → today right, with
the future greyed). This is not cosmetic — it is the clearest single signal that the user
has moved from "what happened to make this rock" to "what have we done with this asset".

---

## 3. Grounding rules (what makes this the *grounded* sibling)

1. **Never invent a date, a volume, or a verdict.** Every milestone comes from
   `cockpit-field-detail.json` (`discoveryYear`, `fidYear`, `productionStartYear`,
   `status`). A missing date renders as an explicitly *unrecorded* pip, never as an
   interpolated one, and never suppresses the milestone.
2. **"Not assessed" ≠ zero.** Carried over verbatim from the Basin Dossier. A field with no
   reserve filing shows `—`, is excluded from totals, and is *counted* in the readiness
   ledger as a gap.
3. **Reserves are filed reserves, not STOIIP.** GOGET carries reported reserves. The
   dossier says so on the face of the number. Field Development must never re-derive
   volumes — it consumes them by reference.
4. **The benchmark is a class prior, not a peer.** `SEED_ANALOGS` is a *literature-class*
   database (`confidence: 'class'`), so the benchmark panel is labelled a **class band**,
   with `n` and the matched class named. It is never presented as "field X is like field Y".
5. **The gap ledger is the finding.** For a field with only a discovery year and a status —
   which is the *majority* of the 7,787-field catalogue — the honest output is a full
   readiness ledger. That is a result, not an error state.

---

## 4. Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│ HEADER  field id · operator · block   │ Reserves │ Lifecycle │ Remaining │  ← KPIs are buttons
├──────────────┬─────────────────────────────────────────────────────────┤
│              │ VERDICTS   Maturity  │  Reservoir & drive │ Production mix│
│   FIELD MAP  ├─────────────────────────────────────────┬───────────────┤
│  (spans both │ DEVELOPMENT TIMELINE                    │ ANALOG        │
│   rows)      │ discovery→FID→first oil→plateau→decline │ BENCHMARK     │
│              │ + produced-volume history bars          │ (class band)  │
└──────────────┴─────────────────────────────────────────┴───────────────┘
```

Modals: `lifecycle` · `reserves` · `production` · `readiness` · `analogs` · `sources`.

---

## 5. Files

| File | Role |
|---|---|
| `src/tabs/fielddev/asset-dossier.ts` | **pure derivation layer** — milestones, reserves, production, verdicts, gaps, benchmark. No React, no DOM → node-testable |
| `src/tabs/fielddev/AssetCharts.tsx` | chart primitives: `LifecycleBar`, `DevelopmentTimeline`, `BenchmarkBand`, `MixDonut`, `ProductionSpark` |
| `src/tabs/fielddev/AssetDossier.tsx` | the screen — mirrors `ExplorationKnowledgeBank`'s shape |
| `src/tabs/fielddev/fielddev-suite.css` | `fds-ad-*` classes, mirroring `exs-bd-*` |
| `scripts/test-asset-dossier.mjs` | truth-lock for the derivation layer |

The old `KnowledgeBank.tsx` / `field-knowledge.ts` / `KnowledgeMap.tsx` stay for the
geological-alignment content, which the Asset Dossier consumes rather than duplicates.

---

## 6. Build order

- **D-KB0** — derivation layer + shell + charts + CSS + truth-lock ✅ *(this pass)*
- **D-KB1** — real Volve monthly production (`wb/prod-field.json`) into the timeline, so
  the one deep-bundle field shows a true rate history rather than annual GOGET filings
- **D-KB2** — drive mechanism from `KbSpine.reservoir`, and the reservoir-quality facts
  (φ, k, net pay) once a client bundle lands
- **D-KB3** — cohort inventory over the real 7,787-field catalogue (spatial + status
  filtered), replacing the class-prior band with a true peer set where data supports it

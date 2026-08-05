# ArgantaEnergy Agent — Deterministic Lite → Worker Core

2026-08-04 · Opus. Concept + end-to-end build plan for a **real** agent capability in `apps/energy`: first a fully deterministic retrieval/navigation agent (no LLM, no network), then a Cloudflare Worker language layer on top of exactly the same tool surface.

Depends on / delivers: [GLOBAL-SCOPE-FILTER-SPINE](GLOBAL-SCOPE-FILTER-SPINE.md) §6 S0a–S0c · [BASIN-SPINE-AND-MENTAL-MODEL](BASIN-SPINE-AND-MENTAL-MODEL.md) · [EXPLORATION-SUITE-CONCEPT](EXPLORATION-SUITE-CONCEPT.md)

---

## 1 · Strategy in one line

> **The agent is not a chatbot bolted onto the app. It is a second front-end to the same command bus the UI uses — and the deterministic tier is the whole product, not a prototype.**

Three consequences, and they are the reason to build in this order:

1. **Everything the LLM will eventually do, the deterministic tier must already be able to do.** The LLM never touches data, never composes a view, never invents a number. It only maps fuzzy language onto a *typed command* that the deterministic tier already executes today. If the Worker is down, unpaid, or rate-limited, the agent keeps working with a slightly stricter grammar.
2. **The blocking gap is not AI — it is that nothing in the app is addressable.** Scope lives in four `useState` closures inside four shells with no external entry point (`ExplorationShell.tsx:34`, `FieldDevShell.tsx:62`, `ReservoirManagementShell.tsx:17`, `DrillingShell.tsx:20`). `useStore.requestNav(nav, sub)` exists but `CosmoShell.tsx:116` **drops `sub` on the floor**. Until an outside caller can say "scope = Kutei Basin, show the dossier", no agent of any kind is possible.
3. **Building the agent forces the Global Scope Filter to exist.** S0a/S0b in [GLOBAL-SCOPE-FILTER-SPINE](GLOBAL-SCOPE-FILTER-SPINE.md) have been specced since 2026-08-02 and never built. The agent's command bus *is* S0a. This plan does not add a parallel mechanism — it delivers the one already designed and makes the chat panel its first client.

---

## 2 · Ground truth — what actually exists (verified 2026-08-04)

### 2.1 The retrieval layer is ready

| Asset | Path | Shape |
|---|---|---|
| Master search index | `public/osdu/cockpit-search.json` (3.3 MB) | `entries[12562] {id, type, name, aliases[], parent, source, fly{lon,lat}, tokens}` — counts: field 7787 · province 179 · assessment-unit 340 · wellbore 3882 · company 267 · country 107 |
| Province polygons | `public/world/provinces.geojson` | 179 features `{prvCode, prvName, oilMean, gasMean, boeMean}` — **Kutei Basin = 3817, confirmed present** |
| AU polygons | `public/world/aus.geojson` | 340 features |
| Province → member fields | `public/osdu/cockpit-scope-fields.json` | `provinces{prvCode → [{id,name,country,source,fly}]}` + same for AUs |
| Province roll-ups | `public/osdu/cockpit-insights.json` | `topProvinces[131] {prvCode, prvName, fieldCount, boeMean}` |
| Field dossier detail | `public/osdu/cockpit-field-detail.json` (5.7 MB) | 7391 keys → production[], reserves[], operator, status … |
| KB spine | `public/kb/master-kb-spine.json` (5.1 MB) | 25 entity arrays: region 9 · country 96 · province 179 · basin 179 · petroleumSystem 211 · assessmentUnit 339 · basinCycle 630 · psElement 1544 · psEvent 1484 · formation 618 · figureRegistry 335 · figureLinks 713 · basinCompletion 179 |
| KB fields | `public/kb/master-kb-fields.json` | `field[8033] {field_id, name, basin_id, country_id, operator, discovery_year, status, hc_type}` |
| Basin figures | `public/basin-figures/manifest.json` | `figures[703]` — 289 maps, 22 cross-sections, 8 strat charts, 6 burial; 328 public-domain / 7 restricted |
| Volve deep bundle | `public/wb/*` (~65 MB, 82 files) | 27 wells, 6 surfaces, logs/traj/drill/press per well |
| North Sea reference | `public/nsr/*` | quadrants 91 · blocks 839 · licences 394 · fields 360 · discoveries 391 · wellbores 3855 |

Loaders are already pure, memoised and id-addressable: `loadSearchIndex()`, `rankSearch()` (`cosmo/cockpit-search.ts`), `loadFieldDetail(id)`, `loadKbSpine()` / `loadKbFields()` / `resolveKbContext(osduFieldId)` (`dataqc/masterkb.ts`), `wb/load.ts`, `basin-figure-library.ts`.

**Nothing needs to be re-fetched, re-modelled or re-built to answer a retrieval question. The data is there.**

### 2.2 The display layer is ready

Nav ids (`CosmoShell.tsx:47–77`, local `useState` at `:111`):

```
COMMAND       cockpit · fieldcraft
LIFECYCLE     exploration · field-development · reservoir-management · well-delivery · drilling-sequence
INTELLIGENCE  insights · agents · knowledge · data
REPORT        manager · report · document · presentation
```

Wired sub-tabs (`tabs/*/workflow.ts`, 9 per vertical):

| Vertical | Tab ids |
|---|---|
| Exploration | `atlas-benchmark` `basin-framework` `basin-analogs` · `strat-depositional` `basin-model` `play-fairway` · `prospect-register` `volumetrics-risk` `portfolio-ranking` |
| Field Development | `client-data-qc` `petrophysics-lite` `static-model-lite` · `fluids-rock` `simulation-cases` `history-uncertainty` · `recovery-wells` `forecast-phasing` `value-fdp` |
| Reservoir Mgmt | `performance-overview` `surveillance-coverage` `production-validation` · `production-diagnostics` `pressure-pattern` `welltest-decline` · `forecast-cases` `opportunity-screening` `actions-learning` |
| Drilling | `sanctioned-intake` `rig-fleet` `constraints-milestones` · `rig-sequence` `campaign-utilization` `schedule-scenarios` · `lookahead` `progress-resequence` `campaign-learning` |

Plus `knowledge` → `explorer|graph|extraction`, `data` → `overview|catalogue|model|governance|quality`, and each vertical's `mode: knowledge|workspace` dossier.

Map control exists: `CockpitMap.tsx:271` flies on a `focus` prop change; `Cockpit.tsx:154 selectCatalogueResult(entry)` already does type-aware zoom (field 9.5 / wellbore 12 / AU 6.5 / else 4.5).

### 2.3 What is missing (the honest list)

| # | Gap | Evidence |
|---|---|---|
| **G1** | **No addressable scope.** Four shell-local setters, zero external entry points. `useStore` holds theme/drawer/notes — no scope. | `store.ts:27–51` |
| **G2** | **`requestNav` drops the sub-tab.** | `CosmoShell.tsx:116` |
| **G3** | **No country → basin link anywhere.** `province` rows carry `region_id`, never `country_id`. `countries.json` has resource aggregates and no province list. So *"insight about Indonesia"* cannot currently be answered. | `master-kb-spine.json` province rows |
| **G4** | **Taxonomy collision.** "Kutei Basin" is a **province**. "Viking Graben" is an **assessment-unit** under province "North Sea Graben" in the USGS spine, but a **basin** (`atlas:basin:atlas:viking-graben`) in the KB. Users say "basin" for all three. | verified by query |
| **G5** | **Namespace drift.** `atlas:country:un:NO` (141 rows) vs `atlas:country:goget:indonesia` (7892 rows). Search-index `parent` is `"NO"` for Volve but `"Norway"` for GOGET fields. | `master-kb-fields.json` |
| **G6** | **9 GOGET regions masquerade as countries** in the search index: Arctic Ocean, Former Soviet Union, Middle East and North Africa, Asia Pacific, Europe, North America, Central and South America, Sub-Saharan Africa and Antarctica, South Asia — plus a literal `"Offshore"`. 107 "countries" = 96 real + 9 regions + Offshore + strays. | `cockpit-search.json` |
| **G7** | **Chat is a demo.** `CosmoChat.tsx` (38 KB) streams canned strings via `setInterval`; `send()` matches 3 hardcoded phrases. Zero NLU, zero fetch, zero dispatch. It does own 3 working nav callbacks and a proven step-driver. | `CosmoChat.tsx:279, :294` |
| **G8** | **CommandPalette is dead code** — ⌘K listener, never mounted, and its `DomainId` vocabulary (`fielddev`, `resmgmt`) doesn't match CosmoShell's (`field-development`, `reservoir-management`). | grep `<CommandPalette` → 0 hits |
| **G9** | **`apps/energy` has no LLM/Supabase wiring at all** — no `@arganta/*` dependency, no API env var (only map-tile overrides). `src/workers/` is web-workers, not Cloudflare. | `apps/energy/package.json` |

**G3 is solvable today and I verified it.** Deriving country → province from spatially-matched field membership (`cockpit-scope-fields.json`, each field carries `country`) yields:

```
Indonesia → 12 provinces: Kutei 20 fields · East Java 18 · South Sumatra 13 · Bintuni/Sulawati 7 ·
            Central Sumatra 7 · North Sumatra 6 · NW Java 5 · Malay 4 · Banda Arc 2 · Tarakan 1 …
Norway    → 3:  Vestford-Helgeland 47 · North Sea Graben 15 · Barents Platform 3
UK        → 2:  Anglo-Dutch Basin 80 · North Sea Graben 31
Brazil    → 4:  Santos 12 · Campos 7 · Sergipe-Alagoas 4 · Amazonas 1
```

131 of 179 provinces get at least one country; 80 countries get at least one province. The 48 orphans need the polygon∩country fallback (Phase D2). **This is the single highest-value new data artifact in the plan and it is a build-script, not research.**

---

## 3 · Architecture — seven layers, each independently testable

```
                 ┌─────────────────────────────────────────────────────┐
   user types →  │ L5  DIALOGUE       turn state, drill-down ladder,    │
                 │                    clarify / confirm / disambiguate  │
                 ├─────────────────────────────────────────────────────┤
                 │ L4  GRAMMAR        deterministic intent parser       │  ← Worker replaces
                 │                    verb + entity + modifier          │     ONLY this box
                 ├─────────────────────────────────────────────────────┤
                 │ L3  RESOLVER       fuzzy entity resolution over the  │
                 │                    gazetteer; typo, alias, ambiguity │
                 ├─────────────────────────────────────────────────────┤
                 │ L2  CAPABILITIES   typed registry: what can be shown │
                 │                    for entity X, and is data present │
                 ├─────────────────────────────────────────────────────┤
                 │ L1  PLANNER        intent + entity → AgentPlan       │
                 │                    (commands[] + answer card)        │
                 ├─────────────────────────────────────────────────────┤
                 │ L0  COMMAND BUS    typed Scope + ViewIntent in the   │  ← = Scope spine S0a
                 │                    zustand store; shells subscribe   │
                 └─────────────────────────────────────────────────────┘
                                        ↓
                 ┌─────────────────────────────────────────────────────┐
                 │ GAZETTEER  public/agent/gazetteer.json (build-time)  │
                 └─────────────────────────────────────────────────────┘
```

**The Worker replaces L4 only.** L5 → L0 are identical in both tiers. That is the whole architectural bet, and it is what makes Phase 2 cheap.

### L0 · Command bus — `src/agent/bus.ts` + `store.ts` extension

Generalise the existing `navIntent` (which already proved the pattern at `dataqc/ExtractionGate.tsx:54`) into two persistent objects plus one one-shot queue:

```ts
// Persistent — the Global Scope Filter, S0a of GLOBAL-SCOPE-FILTER-SPINE §2
interface Scope {
  where:  { region?: Ref; country?: Ref; province?: Ref; block?: Ref }
  geology:{ basin?: Ref; cycle?: Ref; petroleumSystem?: Ref; play?: Ref; opportunity?: Ref }
  accum:  { field?: Ref; reservoir?: Ref }
  wells:  { well?: Ref; wellbore?: Ref }
  facets: { operator?: string; status?: string; fuel?: string; yearFrom?: number; yearTo?: number }
  resolvedAncestors: Partial<Record<Level, Ref>>   // auto-filled, rendered greyed
  conflicts: Conflict[]                            // surfaced, never silently dropped
}
type Ref = { id: string; name: string; source: string }

// One-shot — consumed by the shell, then cleared (navIntent, done properly)
interface ViewIntent { nav: string; sub?: string; mode?: 'knowledge'|'workspace'; modal?: string }
interface MapIntent  { lon: number; lat: number; zoom: number; highlight?: string }
```

Store surface:

```ts
scope: Scope
setScope(patch: Partial<Scope>, opts?: { autofill?: boolean }): void   // ancestors auto-fill
clearScopeLevel(level: Level): void
viewIntent: ViewIntent | null;  requestView(v: ViewIntent): void;  consumeView(): void
mapIntent:  MapIntent  | null;  requestMap(m: MapIntent): void;   consumeMap(): void
```

Each shell replaces its local `useState` with `useStore(s => s.scope)` + a `useEffect` on `viewIntent`. **This is the only invasive change in the whole plan** — five shells, one hook swap each. It is also the change the app needs regardless of the agent, and it makes scope URL-serialisable (spine §2 "shareable and reproducible") for free.

### L1 · Gazetteer — `public/agent/gazetteer.json`, built by `scripts/build-gazetteer.mjs`

One normalised place graph fusing the search index, KB spine, province/AU polygons and the derived country↔province crosswalk. Node shape:

```ts
interface GazNode {
  id: string                 // canonical: "gaz:province:3817"
  kind: 'region'|'country'|'basin'|'province'|'petroleum-system'|'assessment-unit'
      | 'field'|'well'|'wellbore'|'company'|'formation'
  name: string
  displayName: string        // "Kutei Basin (Indonesia)" — disambiguated at build time
  aliases: string[]          // "Kutai Basin", "3817", native ids, cross-source twins
  normKeys: string[]         // lowercased, de-accented, de-suffixed ("kutei", "kutai")
  trigrams: string[]         // for typo scoring — computed at build, not runtime
  parents: { kind: string; id: string }[]     // MULTI-parent: a province may sit in 3 countries
  children: { kind: string; count: number }[] // "13 fields", "3 assessment units"
  fly: { lon: number; lat: number; zoom: number } | null
  bbox: [number,number,number,number] | null
  capabilities: string[]     // the availability probe result — see L2
  sources: string[]          // provenance chips: USGS · GOGET · Sodir · Volve
  metrics: Record<string, number|null>  // fieldCount, boeMean, oilMean, discoveryYearRange…
}
```

Build steps (all deterministic, all re-runnable):
1. Ingest the 12,562 search entries as the spine.
2. Fold in KB spine entities not in search (basin 179, petroleum-system 211, basinCycle 630, formation 618).
3. **Reconcile G4**: emit `basin` as the user-facing kind, with `province` as a linked sibling when 1:1 (they are, 179/179), and keep `assessment-unit` distinct. "Viking Graben" gets *both* the atlas basin node and the USGS AU node, cross-linked, with a `preferredFor` hint so one answer is chosen and the other offered.
4. **Fix G5/G6**: normalise every country to ISO-3166 alpha-2 + canonical English name; demote the 9 GOGET regions to `kind: 'region'`; drop/flag `"Offshore"`.
5. **Build G3 crosswalk**: country ⇄ province from `cockpit-scope-fields.json` field membership, corroborated against `master-kb-fields.json` `country_id`; then polygon∩country fallback for the 48 orphans; emit `link_confidence: spatial|membership|inferred` on every edge.
6. Compute `capabilities[]` per node by probing what data actually exists (L2).
7. Emit a compact typo index (trigram buckets), not a runtime scan of 12k rows.

Target: **≤ 2.5 MB**, single fetch, memoised — same discipline as the other loaders. Ship a `gazetteer-stats.json` sidecar for the truth-lock test.

### L2 · Capability registry — `src/agent/capabilities.ts`

Every deterministic thing the agent can do, typed, with an **availability probe**. This is the honesty layer and it is non-negotiable: Volve is the only field with logs, and the agent must say so rather than route to an empty viewer.

```ts
interface Capability {
  id: string                       // 'basin.dossier'
  label: string                    // "Basin Dossier"
  kinds: GazNode['kind'][]         // which entities it applies to
  probe: (node: GazNode) => boolean          // is the data actually present?
  plan:  (node: GazNode) => AgentCommand[]   // scope + view + map
  card:  (node: GazNode) => AnswerCard       // what the chat shows inline
  phrases: string[]                // deterministic grammar triggers
}
```

Initial registry (~26 capabilities — this is the product surface):

| Group | Capability ids |
|---|---|
| Map | `map.fly` `map.highlight` `map.towers` `map.points` |
| Country | `country.overview` `country.basins` `country.fields` |
| Basin/Province | `basin.dossier` `basin.figures` `basin.psChart` `basin.eventsChart` `basin.creamingCurve` `basin.fields` `basin.analogs` `basin.completion` |
| Petroleum system | `ps.model` `ps.elements` `ps.evidence` |
| Field | `field.dossier` `field.production` `field.reserves` `field.wells` `field.kbContext` |
| Well | `well.logs` `well.trajectory` `well.drilling` `well.pressure` `well.picks` |
| Data | `data.qc` `data.availability` `data.catalogue` |
| Knowledge | `kb.note` `kb.graph` `kb.figure` |

`probe` is the whole trick. `well.logs` probes `wb/index.json` well list; `field.production` probes `cockpit-field-detail.json[id].production.length > 0`; `basin.figures` probes `figureLinks` for that `basin_id`. A capability that probes false is never planned and is reported as a **known absence with a reason**, e.g.

> Volve is the only field with well logs in the bundle today (27 wells). For Kutei Basin I have field records and USGS assessment, no logs.

### L3 · Resolver — `src/agent/resolve.ts`

Pure, synchronous once the gazetteer is loaded.

```ts
resolve(query: string, opts?: { kinds?: Kind[]; scope?: Scope }): Resolution
type Resolution =
  | { status: 'exact';     node: GazNode }
  | { status: 'corrected'; node: GazNode; from: string; distance: number }  // "kutai" → Kutei Basin
  | { status: 'ambiguous'; candidates: GazNode[] }                          // ≤5, ranked
  | { status: 'none';      suggestions: GazNode[] }                         // nearest 3
```

Scoring ladder, in order, first non-empty wins:
1. exact `normKey` hit
2. exact alias hit
3. prefix / whole-word-token hit (`rankSearch`'s existing behaviour, kept)
4. trigram Jaccard ≥ 0.45, then Damerau-Levenshtein ≤ 2 for strings ≤ 8 chars, ≤ 3 above
5. phonetic (Double Metaphone) — catches *Kutai/Kutei*, *Volve/Volv*, *Sirikit/Sirikith*

Ties broken by: kind priority in current context › in-scope proximity › field count › source authority (Sodir/NSTA/ANP > USGS > GOGET). Only **38** names in the entire index are ambiguous across entries, so disambiguation is rare and cheap.

**Confirmation rule (as requested):** `corrected` never auto-executes on a distance > 1. It renders a confirm chip — *"Did you mean **Kutei Basin**? (you typed 'kutai')"* — with Yes / show alternatives. Distance ≤ 1 with a unique hit executes and shows a passive "interpreted as" note that can be undone.

### L4 · Grammar — `src/agent/grammar.ts` (deterministic tier)

Rule-based, no model. A query is `[verb] [entity] [modifier]`, any part optional.

```ts
parse(q: string): Intent[]     // ranked; [] means "no rule matched"
interface Intent { verb: Verb; capability?: string; entityQuery?: string; modifiers: Mod[]; confidence: number }
```

- **Verb lexicon** — `show|display|open|map|fly|go to|take me to` → `show`; `insight|tell me about|brief|overview|summar*` → `brief`; `list|which|what are|how many` → `list`; `compare|vs|versus|benchmark` → `compare`; `find|search|where is` → `locate`; `explain|why|what is` → `explain`.
- **Capability phrases** come from each `Capability.phrases` — the registry *is* the grammar, so adding a capability adds language automatically.
- **Bare entity = `brief`.** "kutei basin" → brief on Kutei Basin. This is the single most common real query and it must work with no verb.
- **Pronoun/anaphora**: "it", "there", "that basin", "this field" bind to the dialogue's current focus (L5). "show me its fields" after a basin brief resolves without re-naming.
- **Failure is a first-class output.** No rule matched → return `[]`, and L5 renders the *"I can't parse that — here's what I can do for `<resolved entity>`"* card with the entity's live capability chips. This is what makes the deterministic tier feel intelligent rather than brittle: **even a total parse failure lands on a useful, entity-specific menu.**

### L5 · Dialogue — `src/agent/dialogue.ts`

A small explicit state machine, not free-form memory.

```ts
interface Turn {
  focus: GazNode | null           // current subject — the anaphora target
  ladder: GazNode[]               // breadcrumb: Indonesia › Kutei Basin › Badak
  pending: | { kind: 'disambiguate'; candidates: GazNode[]; forIntent: Intent }
          | { kind: 'confirm-correction'; node: GazNode; from: string; forIntent: Intent }
          | { kind: 'drill-down'; parent: GazNode; childKind: Kind; options: GazNode[] }
          | null
  history: TurnRecord[]
}
```

**The drill-down ladder, exactly as requested:**

| User says | Agent does |
|---|---|
| "insight about Indonesia" | Sets `scope.where.country`, flies map to country bbox, renders **country brief** (12 basins, 101 fields, 4 operators, resource totals) **and** offers the 12 basins as ranked chips → *"Which basin?"* |
| "kutei" / "kutai basin" | Corrects if needed → confirms → sets `scope.geology.basin`, auto-fills `country: Indonesia` (ancestor rule), flies + highlights polygon 3817, renders **basin dossier card**, offers **17 fields** as chips → *"Which field?"* |
| "badak" | Sets `scope.accum.field`, opens the field dossier, offers **capabilities present for that field** (production ✓, reserves ✓, logs ✗ with reason) |
| "show me the logs" | Anaphora → focus = Badak → `well.logs` probe fails → honest absence + *"Volve has 27 wells with logs — want that instead?"* |
| "compare with viking graben" | Two-node intent → sets a comparison scope, opens `atlas-benchmark` |

**Drill-down is offered, never forced.** A specific query ("show me Badak's production") skips every rung. The ladder is the *fallback* for underspecified queries, which is precisely what "if I ask basin it will ask which field" means.

### L6 · Answer cards — `src/agent/cards/`

The chat renders **real components**, not markdown about them. `CosmoChat` already lazy-imports 13 real FD viewers into an artifact pane (`CosmoChat.tsx:22–33`) — that mechanism is kept and generalised: each `AnswerCard` is `{ headline, facts[], provenance[], chips[], artifact?: LazyComponent }`.

Every card carries a **provenance strip** (source badges + `link_confidence` when a derived crosswalk was used). No number appears without a source chip. This is the existing house rule from the Basin Dossier and it applies unchanged.

---

## 4 · Phase 1 — Agent Lite (deterministic). Steps D0–D9

| Step | Deliverable | Files | Test gate |
|---|---|---|---|
| **D0** | **Command bus.** `Scope` type, store extension, `requestView/consumeView`, `requestMap/consumeMap`, ancestor auto-fill, conflict detection. Fix G2. | `src/agent/types.ts`, `src/store.ts` | `test-agent-bus.mjs` — autofill, conflicts, one-shot consumption |
| **D1** | **Shell rewiring.** Five shells + Cockpit read `scope` from the store and honour `viewIntent`/`mapIntent`. Delete the four local `useState` scopes. Delivers Scope-spine **S0b**. | `ExplorationShell` `FieldDevShell` `ReservoirManagementShell` `DrillingShell` `Cockpit` `CosmoShell` | manual: every existing scope bar still works; no regression in the 4 verticals |
| **D2** | **Country ⇄ province crosswalk.** Membership derivation + polygon fallback for the 48 orphans + ISO normalisation (G5) + region demotion (G6). | `scripts/build-crosswalk.mjs` | `test-crosswalk.mjs` — Indonesia→12, Norway→3, UK→2, Brazil→4; zero orphan countries with fields; every edge carries `link_confidence` |
| **D3** | **Gazetteer build.** Fuse everything, resolve G4 taxonomy, compute trigrams + capability probes. | `scripts/build-gazetteer.mjs`, `public/agent/gazetteer.json` | `test-gazetteer.mjs` — node count, zero dangling parents, every `fly` valid, size budget, 38 known-ambiguous names all disambiguated |
| **D4** | **Capability registry** with real probes for all ~26 capabilities. | `src/agent/capabilities.ts` | `test-capabilities.mjs` — probe truth table vs actual files; **Volve-only logs asserted explicitly** |
| **D5** | **Resolver** — 5-stage ladder, correction, ambiguity, suggestions. | `src/agent/resolve.ts` | `test-resolve.mjs` — a fixture corpus of ≥120 real queries incl. `kutai`, `viking graben`, `volv`, `sumatera`, `n sea`, `EKOFISK` |
| **D6** | **Grammar + planner** — verb lexicon, capability phrases, bare-entity default, anaphora, empty-parse fallback card. | `src/agent/grammar.ts`, `src/agent/plan.ts` | `test-grammar.mjs` — intent truth table; **every capability's `phrases` must parse back to itself** |
| **D7** | **Dialogue machine** — ladder, pending states, confirm/disambiguate/drill-down. | `src/agent/dialogue.ts` | `test-dialogue.mjs` — scripted multi-turn transcripts (Indonesia→Kutei→Badak→logs-absent) |
| **D8** | **Chat surface rebuild.** Replace `CosmoChat`'s canned `send()`/`streamAssistant()` with the pipeline. Keep the artifact pane, well chips, tours. Add autosuggest dropdown (type-ahead over the gazetteer, ≤8 rows, kind-badged). | `src/cosmo/CosmoChat.tsx` | manual + visual sign-off |
| **D9** | **Command palette revival** — mount ⌘K over the *same* resolver+capability registry, fix the `DomainId` vocabulary drift (G8). One brain, two front doors. | `src/components/CommandPalette.tsx` | manual |

**Definition of done for Phase 1:** these 12 queries work end-to-end with correct data, correct navigation and honest absences —

```
show me kutei basin              give me insight about indonesia
kutai basin                      which basins are in norway
viking graben                    list fields in kutei basin
volve                            show me volve's production
badak production                 show me the logs            (after a Badak turn)
compare volve and ekofisk        what can you tell me about the north sea graben
```

---

## 5 · Phase 2 — Agent Core (Cloudflare Worker). Steps W0–W5

### 5.1 What changes and what does not

**Replaced:** L4 grammar only. The Worker returns a `ToolCall[]` against the *same* capability registry; L3/L2/L1/L0 execute it unchanged. If the Worker fails, `grammar.ts` is the fallback — the app degrades, it does not break.

**Added:** narration. The LLM writes the prose around a card whose numbers came from the deterministic tier. It is never handed raw data to summarise — it is handed the *already-computed card* and asked to phrase it. That is the only safe posture for a domain where a wrong STOIIP is a real consequence.

### 5.1b HQ parity — the shared runtime, a different transport

Measured, not assumed (`grep` over apps/hq):

```
apps/hq/src/lib/ai.ts:18        createLLM({ edgeProxy: supabase.functions.invoke('llm-proxy') })
apps/hq/src/lib/core/index.ts:6 runAgentLoop, toOpenAITools, TOOL_SPECS   ← @arganta/agent
apps/hq/src/lib/core/runtime.ts selectModel, isRouteAllowed               ← @arganta/ai
```

**HQ's agent does not run on a Cloudflare Worker.** It runs on the Supabase Edge
Function `llm-proxy`. The Cloudflare Worker in HQ (`VITE_ARGANTA_CORE_URL` →
`arganta-core-content`) is used only by PostStudio and Buffer, for content and
image generation — no agent code touches it.

So "same approach as HQ" means the **contracts**, not the transport. Energy now
uses the identical shared packages:

| | HQ | Energy |
|---|---|---|
| Loop | `@arganta/agent` `runAgentLoop` | **same** |
| Tool registry | `@arganta/agent` `TOOL_SPECS` / `registerToolSpecs` / `availableTools` | **same** |
| Adapter | `@arganta/ai` `createLLM` | **same** |
| Honest degrade | `provider === 'mock'` → no-model | **same** |
| Transport | Supabase `llm-proxy` (edgeProxy) | Cloudflare Worker (`openaiCompat`) |

The transport differs for the reason in §5.2, and `@arganta/ai` supports it
natively — `openaiCompat` exists for exactly this, and brings real SSE with it.

`apps/energy` is not an npm workspace member, so the packages are wired by a
Vite alias plus `file:` deps (single copy, no version drift). Energy's 28
capabilities register into the same frozen registry, with honest governance
metadata: `costClass 0` (local, free), `sideEffect: false`, `autonomySafe: true`,
`dataClass: 'public'`.

### 5.2 Why a new Worker and not `llm-proxy`

`supabase/functions/llm-proxy` is complete and tested but **hard-gates on `OPERATOR = 'aldhyt.sukapradja@gmail.com'` via Supabase JWT (403 at `index.ts:69`)**. `apps/energy` has no Supabase auth at all (G9). Wiring energy into Supabase auth just to reach the proxy is a much larger change than cloning the Worker pattern. Additionally the proxy's Anthropic shape has **no tool-call translation** (`router.js:171–181`, `toolCalls: []` hardcoded), so `needsTools` filters the pool down to groq / groq-8b / gemini anyway — which a Worker can call directly.

Clone `workers/arganta-core-content` — the house pattern (pure `router.js`, thin `src/index.js`, `CORE_TOKEN` bearer, the `isTrustedOrigin` CORS block covering `localhost:*` / `*.arganta.app` / `*.vercel.app` / `*.pages.dev`).

### 5.3 Steps

| Step | Deliverable | Detail |
|---|---|---|
| **W0** | `workers/arganta-energy-agent` scaffold | `wrangler.toml` with `[ai] binding = "AI"`, vars `TEXT_MODEL` / `ALLOWED_ORIGINS`, secrets `AGENT_TOKEN` + provider keys. Copy `router.js`'s CORS + `isAuthed` verbatim. |
| **W1** | **OpenAI-compatible `POST /v1/chat/completions`** | Deliberate choice: `@arganta/ai`'s `createLLM({ openaiCompat: { baseUrl } })` (`packages/ai/src/adapter.js:42`) then works **unmodified**, and its `readSSE` at `:144` gives real streaming — the only real-SSE path in the repo, currently unused. Fan out to groq → gemini → Workers AI with the existing cheapest-first fallback. |
| **W2** | **Tool schema emission** | `capabilities.ts` → OpenAI function specs via `@arganta/agent`'s `toOpenAITools` (`packages/agent/src/tools.js`). The registry stays the single source of truth: one capability = one tool = one grammar rule. |
| **W3** | **Tool loop in the browser** | Reuse `runAgentLoop` from `packages/agent/src/loop.js` — pure, frozen, tested, `maxSteps: 4`. `callModel` = the Worker client; `executeTool` = the deterministic planner. **Tools execute client-side against local JSON — no data ever leaves the browser.** That is also the sovereignty story for client datasets. |
| **W4** | **Client + seam** | `src/agent/llm.ts` mirroring `apps/hq/src/lib/argantaCoreClient.ts:39`. Env `VITE_ENERGY_AGENT_URL` / `VITE_ENERGY_AGENT_TOKEN`, following the existing `cockpit-providers.ts` config-seam convention. `agentEnabled = !!BASE`; when false, L4 grammar runs and the UI shows a "Lite" badge — never a silent mock (the `silentlyMocked` gate from `hq/lib/core/runtime.ts:79` is the precedent). |
| **W5** | **Grounding guard + CI** | System prompt pins the agent to tool output only; a post-check rejects any assistant message containing a number not present in the executed card. Add `workers/arganta-energy-agent/test/*.test.js` to `.github/workflows/ci.yml`'s `node --test` list (worker tests are currently **not** in CI). |

---

## 6 · Effort map

Effort in **sessions** (one focused working block). Risk = chance of overrun or rework.

### Phase 1 — Agent Lite

| Step | Sessions | Risk | Why |
|---|---|---|---|
| D0 Command bus | 1 | Low | Small, pure, well-specced by the Scope spine |
| D1 Shell rewiring | **2** | **High** | Five shells, live surfaces, easy to regress. The riskiest step in the plan. |
| D2 Crosswalk | 1 | Low | Derivation already proven; only the 48-orphan fallback is new |
| D3 Gazetteer | **2** | Med | Taxonomy reconciliation (G4) is the judgement-heavy part |
| D4 Capabilities | 1.5 | Med | 26 probes × real file checks; tedious, not hard |
| D5 Resolver | 1.5 | Med | Phonetic + trigram tuning needs the fixture corpus to converge |
| D6 Grammar + planner | 1.5 | Med | Lexicon breadth is the variable |
| D7 Dialogue | 1 | Low | Small state machine once L1–L5 are typed |
| D8 Chat rebuild | **2** | Med | UI work + autosuggest + keeping the existing tours alive |
| D9 Command palette | 0.5 | Low | Mostly deletion of the vocabulary drift |
| **Phase 1 total** | **14** | | ≈ 2 working weeks at 1 session/day |

### Phase 2 — Agent Core

| Step | Sessions | Risk | Why |
|---|---|---|---|
| W0 Worker scaffold | 0.5 | Low | Copy of a working worker |
| W1 OpenAI-compat + SSE | 1.5 | Med | First real streaming path in the repo |
| W2 Tool schema emission | 0.5 | Low | Mechanical from D4 |
| W3 Tool loop | 1 | Low | `runAgentLoop` is already tested |
| W4 Client + seam | 0.5 | Low | Copy of `argantaCoreClient` |
| W5 Grounding guard + CI | 1 | Med | The number-check is the novel bit |
| **Phase 2 total** | **5** | | ≈ 1 working week |

**Grand total ≈ 19 sessions.** Phase 1 is 74 % of it — correct, because Phase 1 is the product.

### Critical path

```
D0 ─▶ D1 ─────────────────────────────────────────┐
D2 ─▶ D3 ─▶ D4 ─▶ D5 ─▶ D6 ─▶ D7 ─▶ D8 ─▶ D9 ─▶ W0…W5
```
D0/D1 (bus + shells) and D2/D3 (crosswalk + gazetteer) are **independent and parallelisable** — the two halves only meet at D8. If you want a demo fastest, D2→D3→D5 alone (4.5 sessions) already answers *"show me kutei basin"* as a card without navigating anything.

### Suggested milestones

| Milestone | Steps | Sessions | Demo |
|---|---|---|---|
| **M-A · It knows the world** | D2 D3 D5 | 4.5 | Type "kutai" → corrected → Kutei Basin card with real numbers |
| **M-B · It drives the app** | D0 D1 D4 | 4.5 | Chat says "show me Kutei Basin" → map flies, scope sets, dossier opens |
| **M-C · It converses** | D6 D7 D8 D9 | 5 | Full drill-down ladder, autosuggest, honest absences |
| **M-D · It talks** | W0–W5 | 5 | Natural language, streaming, same tools, graceful Lite fallback |

---

## 7 · Decisions I need from you

1. **D1 is invasive.** Rewiring five live shells to a store-backed scope will briefly destabilise Exploration / FD / RM / Drilling. Alternative: run the new store scope *in parallel* with the local state for one milestone (shells write both, read local) and cut over at M-C. Costs ~0.5 session, removes the regression risk. **My recommendation: do the parallel run** — these four verticals are your demo surfaces and each has a truth-locked test suite behind it, not the UI.

2. **Basin vs province naming (G4).** I propose the gazetteer presents **"basin"** as the user-facing word for USGS provinces (they're named `* Basin` 115/179 anyway), keeps `assessment-unit` as a distinct sub-level, and shows the exact USGS tier in the provenance strip. The alternative — teaching users the province/basin/AU distinction up front — is more correct and much worse UX. **Recommendation: user-facing "basin", provenance tells the truth.**

3. **The 48 country-less provinces.** Polygon∩country-boundary fallback needs a countries polygon file, which the repo does not have (`public/world/countries.json` is resource aggregates only, no geometry). Options: (a) ship a small Natural Earth 1:110m admin-0 GeoJSON (~250 KB, public domain), (b) leave them country-less and reachable only by name/region. **Recommendation: (a)** — it's public domain, tiny, and also fixes country bbox fly-to.

4. **Indonesia will look thin.** USGS gives 12 basins with fields; the national count is ~128 ([NATIONAL-SOURCE-OVERLAY-PLAN](NATIONAL-SOURCE-OVERLAY-PLAN.md)). The agent must say *"12 basins in the USGS baseline"*, not *"Indonesia has 12 basins"*. Do you want the national overlay pulled forward into this plan (+3–4 sessions, and it's a data-sourcing task with its own unknowns), or is the honest-baseline framing acceptable for now? **Recommendation: honest baseline now**, overlay as its own track.

5. **Phase 2 model tier.** Tool-calling today only routes to groq / gemini / Workers AI. Grammar-to-tool mapping is an easy task — an 8B instruct model handles it. **Recommendation: `TEXT_MODEL` default to groq llama-3.3-70b with Workers AI llama-3.1-8b as the free fallback**, and keep Anthropic out of the loop until the proxy learns tool translation.

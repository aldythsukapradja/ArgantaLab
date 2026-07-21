# ArgantaEnergy — Digital Brain Architecture (schema · knowledge graph · deterministic extraction)
Date: 2026-07-21. Method learned read-only + de-identified from the founder's prior studio; ALL content here maps to Volve, zero external names/data.

Three subsystems, each a reusable pattern. This is the spec for P3 (brain) and the Knowledge/Workbench surfaces.

---

## SUBSYSTEM 1 — Data schema (star, three-artifact contract)

**Three artifacts = one source of truth:**
1. `schema.md` (compact) — entity hierarchy, join rules, and the **FK ledger**: `FK# | source table | FK col → target table | PK col | cardinality | orphan_count | why-orphans`. Orphan counts are first-class data-quality facts.
2. `ontology.md` (verbose) — per-column dictionary: `Col | Name | Type{TEXT,NUM,DATE,BOOL,TEXT(JSON)} | Unit | FK?{★PK, FK→T(#n), DIM, —} | Description(+derivation)`.
3. `schema-meta.js/ts` (generated) — runtime single source of truth: `TABLES, FKS, GROUPS, CENTERS, COL_META`, "derived from schema.md + ontology.md", with an **alias layer** absorbing name drift (ontology name vs physical export key).

**Model shape:** dual/single-center star with a **rule-ordered join hierarchy**:
- R1: table has hub-id col (any alias) → join hub.
- R2: else has child-id col → join child dimension.
- R3: chain child→hub (transitive reach to hub).
- Rn: derived identities (e.g. an injection *pattern* = producer's hub-id; 1 producer : N injector), alias resolution.

**Table roles** (each tagged): `hub` (dimension center, PK), `dimension`, `bridge` (small hand-authored cross-filter tables — bridge PK ← many FK cols; also own option ordering), `fact` (time-series/per-entity, no PK, carries `fkKey`), `gis/geometry` (serialized geometry), `marker/detail` (depth-keyed tops/core/tests), `aggregate` (pre-rolled summaries).

**Column-alias tolerance:** the same logical key appears under several physical names; schema records *which* column carries identity, so joins are declared centrally, never by column-name coincidence. Unmatched rows → **orphans with counts + reasons**, never silently merged. A small **alias bridge** rejoins known old→new code mappings.

**Two bulk-data encodings (by density):**
- *Relational tables:* `{ _meta:{generated, source, tables_summary:{T:{rows,columns[]}}}, tables:{T:[{col:val,...}]} }` — keyed-object rows (self-describing); `_meta.tables_summary` renders schema/counts **without parsing the body**.
- *Dense curves/logs:* `{ meta:{...,curves_union[]}, schema:[{name,type,unit,role:'key'|'measure'}], entities:{ID:{strt,stop,n_rows,available_curves[],rows:[[...]]}} }` — columnar, **index-aligned to `schema`**; null/absent = "not measured," never zero.

**Loading:** chunked, lazy, **idempotent, order-preserving** (script-injection with `async=false`, seed file 1 then `Promise.all` the rest); alias-aware `getTable(name)` / `getRows(schemaId)`.

**Filter cascade + cross-filter:** explicit H1..Hn (field → type[bridge] → phase[bridge] → location → pattern → hub → child) + orthogonal **date** and **depth** slicers. Filters = `{dim:[...]}`, empty = no constraint, predicate ANDs active dims. Option lists come from **bridges when present** (authoritative ordering: phase by chronological order, formations youngest→oldest), else `distinct()`.

### Volve mapping
hub = **well** (well_id), child dimension = **wellbore** (wellbore_id, FK well_id, 1:N sidetracks), bridges = **formation/interval** and **campaign/phase**, facts = production/injection/pressure, marker = formation tops, gis = (deferred). We already have wells.json/wellbores.json/production/trajectory/logs/markers — ACTION: write the 3 artifacts + FK ledger (with real orphan counts — we already found 28 unresolved pick well-names, that IS the orphan ledger).

---

## SUBSYSTEM 2 — Knowledge graph / Obsidian vault (dependency-free)

**Two graph surfaces, both hand-built, no graph lib:**

**2a. Schema-as-graph (data-model graph):** nodes = tables, satellites = columns, edges = FKs. Node radius ∝ role/degree (hub biggest), color by source group. **Deterministic radial layout:** hubs pinned center, others on concentric rings by `ring`, clustered into arcs by group. Interaction: pan, zoom-to-cursor, drag, click→ontology popup; hover computes **neighbor set from `fksFor(key)`** and dims the rest; edges brighten only when both endpoints in focus. (Our Foundation schema canvas is the seed of this.)

**2b. Note vault (three-pane Obsidian clone):**
- **Note schema (frontmatter):** `{ id, title, type, folder, event_date, version, tags[], body_md, links[], backlinks[], <provenance flags>, wattrs{}, modelTables[] }`. `type` enum (concept, well, wellbore, reservoir, field, pattern, datatable, report, decision, event, evidence, …), each color-mapped; ~18 numbered folders.
- **Wikilinks (deterministic):** `[[Title]]`/`[[Title|alias]]`/`[[Title#heading]]` via one regex. Forward links: build **title→id index once (O(n))**, scan bodies, normalize, resolve, dedupe → `links`. **Backlinks: invert the link map in one pass.** Recompute after every generation phase. Markdown renderer turns `[[…]]` into `.wikilink` anchors, or `.wikilink.dead` on index miss (dead-link detection = index miss).
- **Layout:** CSS grid `tree(folders+search) | center(Graph⇄Note tabs) | context(backlinks/metadata)`. Big graph = single **batched, culled, LOD Canvas2D** surface (~8–10k nodes, zero per-node DOM).
- **Nodes are both entities AND claims:** entity notes are **generated from data** (Subsystem 3); concept/decision notes are hand-authored. The **FK graph and the note graph are isomorphic by construction** (a well note wikilinks to its reservoir/phase/platform/supporting-injector notes).

**Evidence-first (tri-brain), the truth spine:**
- Every figure carries a **data-nature badge** (measured/reported/derived/interpreted/simulated/placeholder) — nothing synthetic shown as measured.
- Every **claim links to evidence or is flagged** as unsupported hypothesis. Bitemporal (**valid-time vs recorded-time**), citations, contradictions, content hash for integrity.
- Document-derived notes carry a `_Source: DOC-ID (revision)_` line + explicit **conflict flags** ("⚠ requires validation", "⚠ DRAFT"). Evidence is its own node type.

### Volve mapping
Our Knowledge tab already has the three-pane shell + evidence context. ACTION: upgrade to this note schema, generate entity notes from data (below), make the note-graph isomorphic to the FK graph, and add the schema-as-graph as a second graph surface. Reports (Discovery/PUD) become document-derived notes with `_Source_` lines.

---

## SUBSYSTEM 3 — Deterministic-first knowledge extraction (the differentiator)

**Governing principle — the sovereignty tier ladder (0A→3):** `0A deterministic code → 0B local fast → 0C operator strong → 1 external → 2 economy API → 3 frontier`. Hard rule: restricted context always Tier 0, "shares code, never data." **Default = 0A: typed deterministic code, no LLM.** LLM is an opt-in per-unit upgrade, never the source of a measurement. (This is exactly our four-tier router — reconcile the two ladders.)

**Deterministic extraction pipeline (NO LLM) — multi-stage generator, each stage provenance-flagged so it's idempotently droppable/rebuildable:**
1. Field/root note — `distinct()`/`count()` over hubs/children/reservoirs/phases/production rows.
2. Per-type notes — one per bridge row (formation, phase) + deterministic count of hubs with that attribute.
3. Location/platform + inventory — group hubs, type-splits, dominant reservoir by frequency mode.
4. Data-table notes — one per physical table; FK refs rendered as wikilinks from the FK registry.
5. Log-coverage note — scan columnar log store: wells-with-data, curve union, depth span, avg samples/well.
6. **Entity notes (core):** for every hub/child/pattern —
   - resolve type via deterministic normalizer (exact-match set, else substring rules: "oil"+"produc"→producer);
   - build child-by-hub index + **producer↔injector support map derived purely from the allocation/split table** (rule: pattern = producer hub-id; 1:N) → **auto-derives edges from data**;
   - cumulative production via **fuzzy column finder** (`findCol(table,[regex,...])` — fuzzy COLUMN location, not fuzzy record matching) + sum;
   - emit note whose body is **auto-wikilinked** into the KB (type→concept, reservoir→reservoir, phase→phase, children→child notes, injectors→their notes) + **ontology-driven auto-tagging** via lookup tables keyed on entity type.

**Facts→graph path:** `table row → structured wattrs + markdown body with [[wikilinks]] → link/backlink recompute → graph`. Every join/aggregation/classification/edge is rule-based and reproducible.

**Deterministic NLU/intent router (no LLM at routing):** lowercase prompt → keyword/synonym buckets (chart/plot→artifact; table/model/relationship→schema answer from FK registry; production/decline/anomaly→deterministic summary; image→asset), fallthrough→capability. Checks **data classification** then selects tier; if deterministic, explicitly "no LLM call." Trace: *classify intent → check classification → select route → ground to hub tables → attach evidence.* Schema answers are generated from `MODEL.relationships`, not prose.

**Entity resolution — alias-first, rule-based, human-confirm for ambiguity:** alias bridge (old→new codes), table-name aliases, type normalizer (exact set → substring). Fuzzy **column** location only. Unmatched → **orphans with counts + reasons**; conflicting doc revisions → "requires validation" flags. **Ambiguous merges deferred to a human-confirm step**, never auto-resolved.

**LLM seam:** NOT in measurement/calc/joins/aggregation/edge-derivation/note-gen/backlinks/intent-routing/option-lists. Optionally in narrative synthesis **on top of** computed deterministic results, gated by data classification. Agent client is a thin stub (`listAgents/invoke/orchestrate`) so the LLM layer is pluggable behind the deterministic core.

### Volve mapping
This is P3/P4. We already embody the spirit (deterministic decoders, no fabrication, orphan ledger, ◆ capsules). ACTION: build the generator pipeline that turns our processed tables into vault entity notes (well→reservoir/formation/wellbore/injector wikilinks), the deterministic intent router grounded to our FK registry, and reconcile the sovereignty ladder with @arganta/ai's four tiers. The producer↔injector support map is directly buildable from Volve F-5/F-4 injection.

---

---

## CONCRETE MECHANICS (from the founder-provided Cosmo reference, read at code level)
De-identified; maps to Volve. This upgrades the patterns above into reimplementable code idioms.

### Data model — three decoupled layers (never couple column order into logic)
1. **`MODEL`** (structural skeleton, hand-authored): `{ tables:[{id,name,type:'dim|fact|bridge',role:'hub|fact|bridge|agg|gis|dim',rows,source,columns:[{name,dtype,pk?,fk_to:'TABLE.Col'}]}], relationships:[{id,from:'T.Col',to:'T.Col',cardinality:'*-1',direction:'single|both'}], layout:{} }`.
2. **`ONT_COLS`** (semantic dictionary, decoupled): `table → column → {t:type, u:unit, d:desc}` + `ONT_ROLES` one-line table roles.
3. **Bulk rows** lazy-loaded as **keyed objects** `tables[id]=[{col:val}]` (self-describing; resolve columns by name, never by order).
FKs declared **twice** (inline `fk_to` for cards + first-class `relationships[]` for canvas/NLU). LESSON: **auto-generate edge ids from `from|to`** — their hand-typed `FK16/17/20/32` collide; never key logic on a manual id.

### Relational canvas
jsPlumb was **abandoned** for offline reliability (`ensureJP(){return null}`). Working path: **dagre** DAG layout (`rankdir:'LR'`) OR a **star layout** (two hubs center, others on concentric rings by polar `radius/count`), positions cached to `MODEL.layout` + localStorage. Cards = absolutely-positioned divs; **custom SVG orthogonal connector router** (`colAnchor(tid,col)` → pixel center of a column cell; elbow `M…L…` with mid-x break; **crow's-foot cardinality markers** from `cardinality.split('-')`).

### Knowledge extraction — the core pipeline (NO LLM)
Orchestrator `buildKnowledge()` is **idempotent**: each `build*()` stage (a) strips its own prior output by a provenance flag (`n.gen/wellgen/kbgen`), (b) emits notes stamped with that flag + a deterministic id `kb-<type>-<slug>`, (c) triggers link recompute. Stages: field overview → per-reservoir (from bridge rows) → per-phase (sorted by chronological order) → location/platform + well inventory → per-table (FK refs → wikilinks) → log-coverage → then agents/datasets/wells.

Three reusable primitives do all the aggregation:
```
kbDistinct(rows,col)   // → Map(value→count)  group-by
kbCount(rows,col,val)  // filtered count
kbSlug(s)              // stable id: lowercase, [^a-z0-9]→'-', slice(48)
```
**Facts→graph:** each generator writes `[[Entity]]` wikilinks into the note body → the link machinery turns text into edges for free.

**Auto-linking without inference — ontology lookup tables keyed on entity type:** `WELLTYPE_NOTE / WELLTYPE_DATASETS / WELLTYPE_AGENTS` map a type code (OP/WI/GI/WD/OBS/ABD) → label / related datasets / monitoring agents. A well note auto-emits `## Data` and `## Monitored by` sections of `[[…]]` purely from its type code.

**Relationship auto-derivation from fact rows:** read the allocation/split table (1 producer : N injectors), build `supByProd`/`supByInj` maps, inject reciprocal `## Supported by (injectors)` / `## Supports (producers)` wikilink sections — a real domain relation reconstructed from joins, no ML. → **Directly buildable from Volve F-5/F-4 injection allocation.**

**Fuzzy column finder (load-bearing robustness — Volve LAS/CSV headers vary):**
```
ckFindCol(rows,[/oil.*rate/i,/^oil/i,/bopd/i,/oil/i])  // ordered-regex fallback → column name
fkbTypeCode(v)  // free-text → code by keyword tests (oil&produc→OP, water&inj→WI)
```
Never hard-code a column name; always ordered-regex resolve.

### Vault link machinery (O(n), scalable)
```
vRecomputeLinks(): build title→id index once (O(n), first title wins);
  regex [[Target|alias#anchor]] over bodies → n.links (deduped);
  invert links map in one pass → n.backlinks
md2html: resolved title → <a class=wikilink>, unresolved → <span class=wikilink dead>  // dead=index miss
```
LESSON: **for machine-generated cross-refs, link by ID not title** (they had to add `linkDatasetsToTables` id-based edges because friendly names collide). Reserve title-wikilinks for human prose.

### Graph render — batched Canvas 2D LOD (8–10k nodes, zero per-node DOM)
`vgBuild` (nodes=visible notes, `deg=links+backlinks`, edges if both endpoints visible) → swappable layouts (spiral/shells/rings/phyllotaxis via golden-angle `π(3−√5)`, or `d3.forceSimulation` with pos cache) → `vgPaint` (viewport cull from pan/scale, degree-scaled radius, focus/neighbor highlight, optional synapse-pulse "living" layer), rAF-gated single draw.

### Deterministic NLU router (no LLM)
```
low=prompt.toLowerCase()
 chart|plot        → build chart artifact from aggregated rows
 table|model|relationship → answer straight from MODEL.relationships (markdown FK table)
 production|decline|anomaly → deterministic summary
 else → capability fallback
```
Grounded to MODEL/FK registry; visible "thinking" trace states the classification + routing. **Tier ladder** `tier:'DET'|'SOV'|'FRO'` gated by `ctxClass` (controlled context blocks Frontier, forces Sovereign); DET's first entry is literally "Typed-code (deterministic) — no LLM call" = current engine IS tier-0, LLM tiers are a declared upgrade seam.

### Provenance vocabulary (typed pills + inline conflict flags)
`badge(k)`: LIVE / DERIVED / PROVISIONAL / SAMPLE / DEMO / NOT CONNECTED / NOT TESTED / TARGET (default → SAMPLE). Synthetic rows carry `data_nature:'sample'`; derived facts print `(derived)`. Claims carry `conf:'existing-case|documented|preliminary|provisional'` + `basis`. Conflict flags embedded in note bodies: `⚠ Revision conflict — requires validation`, `⚠ DRAFT`. Partial bitemporal via `event_date` (valid) + `version` (recorded).

### Seed = f(entity identity) — reload-stable synthetic (only where we lack real data)
`seeded(s){let x=s;return()=>{x=(x*9301+49297)%233280;return x/233280}}`; per-entity seed offset (`1000+i*7`). We mostly DON'T need this (real Volve data), but useful for any placeholder series — reload-stable, diff-able, no storage.

### Fragilities to avoid (their hard-won)
Auto-gen edge ids (manual FK ids collide); keep only the O(n) indexed link recompute (title index silently drops duplicate titles — dedupe/namespace by type); global-mutable + full-innerHTML re-render won't scale to 10k+ notes (virtualize the tree/list; the Canvas graph is fine); id-based linking for machine cross-refs from the start; split bulk data into lazy chunks (megabyte lines choke tooling).

---

## Consolidated adoption plan for ArgantaEnergy
1. **P3a — Schema contract:** write `contracts/schema.md` + `ontology.md` + generated `schema-meta.ts` (TABLES/FKS/GROUPS/CENTERS/COL_META + alias layer + FK ledger with our real orphan counts). Locked-early.
2. **P3b — Extraction pipeline:** deterministic multi-stage generator (`scripts/extract-knowledge.mjs`) → vault notes with wikilinks isomorphic to the FK graph; provenance-flagged, idempotent, rebuildable.
3. **P3c — Graph surfaces:** schema-as-graph (nodes=tables, edges=FKs, radial+neighbor-focus) + note-graph (Canvas2D LOD) in the Knowledge tab.
4. **P3d — Deterministic NLU router** grounded to the FK registry + evidence attach; reconcile sovereignty ladder ↔ four-tier router; LLM only as opt-in synthesis behind the wall.
5. Keep the **evidence-first law** everywhere (data-nature badge, claim→evidence-or-flagged, bitemporal, human-confirm for ambiguous merges).

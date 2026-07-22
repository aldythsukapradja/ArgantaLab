# ArgantaStudio — Knowledge Architecture Alignment

**What ArgantaLab already does for data schema, the Obsidian-clone graph, and deterministic-first extraction — and how ArgantaStudio should align its data layer with it.**
*2026-07-21. Learned from source (three parallel code studies of apps/hq/src/vault, apps/hq/src/knowledge, packages/media-core). Written before finalizing the A3 schema so the studio reuses the spine instead of forking it.*

---

## 1. What exists (the three systems, from source)

### A. The Vault — entity + frontmatter + wikilink model
`apps/hq/src/vault`. Local-first Obsidian clone, no ORM, hand-rolled TS types.

- **Entity:** `VaultNote { id, fm: Frontmatter, body, createdAt, updatedAt }`. `id` = stable slug = filename. `fm` is *typed* frontmatter (`title, product, type, status, tags, updated, owner, confidence`) with an index-signature escape hatch `[key: string]: string | string[] | undefined` — so arbitrary fields (`model`, `seed`, `prompt`) attach with no interface change.
- **Taxonomy:** three orthogonal dimensions — `Product` (HQ/KinetikCircle/ArgantaLabs/LashiraBloom/…), `NoteType` (note/spec/decision/…), `NoteStatus` (living/frozen/…). `normalizeFrontmatter` coerces unknown type→`note`, status→`living` (so a `type: image` would collapse unless the union is extended — a real watch-out).
- **Storage:** localStorage is store-of-record, key `hq_vault_<SEED_VERSION>` (seed version baked into the key so a bump can't be shadowed). 600ms-debounced autosave of a `VaultSnapshot`.
- **Links:** `[[target|alias#heading]]` → `buildBacklinks` → `LinkIndex { outgoing, backlinks, broken }` (the adjacency structure), rebuilt on every mutation.
- **Ingestion:** `knowledge-base/**/*.md` (single source, opens in Obsidian too) → `build-vault-seed.mjs` → `kb.generated.ts` (`KB_NOTES: {id, md}[]`). **CI (`vault-kb.yml`) regenerates and `git diff --exit-code`** — the derived file cannot drift from source. Plus in-app CRUD.
- **RAG hook:** `embed.ts` is the *only* server touchpoint — chunks bodies (1600 chars), embeds via Cloudflare `bge-base-en-v1.5`, upserts to Supabase `memory_chunk` via RPC `memory_chunk_upsert` with `{ source:'vault', ref, content, data_class, embedding }`.

### B. The Graph — a generic renderer with a thin vault adapter
`apps/hq/src/vault/graph/*` (PixiJS v8 + d3-force worker, v3 default; `?graph=v1` = legacy).

- **The engine is domain-agnostic.** `GraphEngine` consumes only `EngineNode {id, title, r, color:number, deg}` + `EngineEdge {a, b, suggested?}` + a `Float32Array` of cluster centroids. The worker/`protocol.ts`/`simClient.ts` speak only `{id, r, x, y}` + `{source, target}`. **Zero knowledge of notes.**
- **The vault binding is a thin, replaceable adapter** — `graph.ts buildGraph` (wikilink → nodes/edges) + `palette.ts` (color/group hard-typed to product/layer/type). Swap those and the same engine renders *any* `{nodes, edges}`.
- **Layer derivation** = priority cascade (`deriveLayer`): explicit `fm.layer` → id prefix `L{n}-` → atomized type → hub-link inheritance → structural type → tag heuristics → `L?` fallback. 8 layers L0–L7.
- **Suggested edges** (`buildSuggestedEdges`) = heuristic links (≥2 shared tags / unlinked mentions), shape `{source, target, weight, reason}` — explicitly "the future agent contract."

### C. Deterministic-first — the repeatable pattern (media-core + cortex)
`packages/media-core` + `apps/hq/src/knowledge`.

The one philosophy, everywhere: **derive the cheapest reproducible provenance-honest result first; escalate to AI/premium only behind an explicit gate.**

1. **One numbered ladder** `MATURITY 0..3` (DETERMINISTIC/FREE_API/ECONOMICAL/PREMIUM) === four-tier `costClass` === Sovereign/Sponsored/Economy/Frontier. One taxonomy across packages.
2. **Default stage 0.** Router *walks DOWN* to the cheapest capable provider, never silently escalates; `mockAdapter` so it never hard-fails.
3. **Deterministic = reproducible + free + no secrets.** FNV-1a hash of input → `mulberry32` PRNG → same input → same bytes, checksummed. (This is exactly the `comfy-sovereign → deterministic` fallback ArgantaStudio A2 already rides.)
4. **Uniform result envelope, mandatory provenance:** provider, tier, `maturityStage/Label`, `cost`, `estimated`, `seed`, `checksum`, `spec`, `correlationId`. Estimated cost never shown as measured; simulated never shown as live (`provenance.ts` downgrades conservatively).
5. **Approval gate at PREMIUM.** Stage 3 refuses without `approved:true`.
6. **Defer, don't call.** Browser/paid work returns a `deferred` descriptor `{engine|tool, call, args}` an operator fulfills — the package holds no secrets.
7. **Single source → generated → CI no-drift** (the vault-seed pipeline).
8. **Regex/heuristic priority-cascade extractors** (`deriveLayer`, `deriveOntologyType`, `build-jarvis-digital-twin.mjs`) turn raw text → typed entities/edges with zero LLM. `deriveOntologyType` "falls back to Document — never invents authority."
9. **Design the deterministic output shape to BE the future AI contract** (suggested-edges, karaoke word-timing) so an agent swaps in without changing callers.

---

## 2. What this means for ArgantaStudio (the decision)

The studio's A3 tables (`studio_runs / studio_assets / characters`) are correct as a job ledger, but to align with the spine I'm adjusting the model along four axes. **A generation is a knowledge entity, not just a ledger row.**

### Alignment 1 — Entity model mirrors VaultNote
Treat each generation/asset as an entity with the same bones: stable `id`, a typed `kind` (image/video/audio/character/post — the studio's `NoteType` analogue), `tags`, a `body` (prompt/caption), timestamps, and an open metadata bag (`params` jsonb) for `model/seed/aspect`. This keeps studio entities loadable by the same mental model as vault notes and makes a future "media notes in the Vault" merge trivial.

### Alignment 2 — Relationships as edges → reuse the graph engine verbatim
The studio's natural graph is **character → generation → post** (and brand → everything). Because the graph *engine* is domain-agnostic (`EngineNode/EngineEdge` + centroids), ArgantaStudio can render its own knowledge graph by writing a ~100-line adapter (studio entities → `{nodes, edges}`) instead of touching `engine.ts / sim.worker / protocol`. Add a lightweight `studio_edges` derivation (from foreign keys: `generation.character_id`, `post.run_id`) so the graph is free. This is a real differentiator: a *visual map of every character, what it generated, and where it was published* — nobody in Higgsfield/Buffer has that.

### Alignment 3 — Provenance envelope on every run
Extend `studio_runs` to carry the media-core envelope fields it's missing: `estimated` (bool — cost is a guess for paid tiers), `checksum` (repro proof for sovereign), `correlation_id`. Never show an estimated cost as measured; badge sovereign vs premium. This makes the studio's cost ledger honest by construction and CFO-rollup-ready (C9).

### Alignment 4 — Deterministic-first metadata extraction
Before any LLM captioning, derive metadata from a generation **deterministically** via a priority cascade (mirroring `deriveLayer`/`deriveOntologyType`):
- dominant colors / palette (sample the PNG — pure function),
- aspect/orientation (from dimensions),
- brand + tags (from the prompt via keyword rules + the requesting brand kit),
- `kind` (from the studio surface).
Output shape = the future AI-caption/auto-tag contract, so an agent swaps in later without changing callers. Zero-cost, reproducible, and it means every asset is searchable/graphable the instant it's made.

### Alignment 5 (later, cheap) — RAG via the existing hook
When useful, push asset metadata to Supabase `memory_chunk` with `source:'studio'` through the *same* `memory_chunk_upsert` RPC the vault uses — media becomes searchable in Arganta Core alongside notes, no new infra.

---

## 3. Concrete A3 schema revision

Additive only — the A3 migration already run/pending stays valid; this is a follow-up migration:

- `studio_runs`: **+** `estimated boolean default false`, `checksum text`, `correlation_id text`, `tags text[] default '{}'`, `character_id uuid references characters(id)`.
- `studio_assets`: **+** `palette jsonb` (deterministic dominant colors), `orientation text`.
- **new** `studio_posts` (already planned for C6) gets `run_id` + `character_id` + `platform` so the character→generation→post edge chain is queryable.
- **new (derived, optional)** a `studio_graph_edges` view or client-side builder from those FKs — feeds the reused graph engine.

Deterministic extractor lives at `packages/studio/src/extract.js` (pure functions, no LLM), called inside `fabric.generateImage` right after bytes arrive, writing derived fields onto the run before `updateRun(complete)`.

---

## 4. Net

ArgantaStudio should **not** invent a knowledge layer. It should: model generations as VaultNote-shaped entities, carry the media-core provenance envelope, extract metadata deterministic-first (LLM later, same contract), and render its character→generation→post graph on the *existing* generic PixiJS engine via a thin adapter. That turns the studio from "a generator with a library" into "a generator whose entire output is a navigable, searchable, provenance-honest knowledge graph" — consistent with every other ArgantaLab surface, and built mostly from parts that already exist.

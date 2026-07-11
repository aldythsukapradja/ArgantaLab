# HANDOFF — Arganta Knowledge Base + HQ Vault

> Everything you need to run, maintain, and extend the unified knowledge base and
> the HQ Vault graph — locally, cold, with no prior context.
> **State at handoff:** `main` @ `2a750081` · **319 KB notes** (58 curated + 261 atomized graph nodes).

---

## 1. The one idea

**One markdown knowledge base is the single source of truth, rendered in two places:**

```
knowledge-base/**/*.md   ──────────────┐   (the single source)
   │                                    │
   ├─▶ Obsidian: open the folder        │   same markdown, same format
   └─▶ HQ Vault: a generator turns it into apps/hq/src/vault/kb.generated.ts
                 → seed.ts → the vault UI (file tree, graph, bases, canvas)
```

There is **no second copy**. The vault's notes are *derived* from the markdown, so the
two surfaces can't silently disagree. A GitHub Action fails the build if the derived
file ever drifts from the source.

Read `knowledge-base/METHOD.md` for the full philosophy (verify against code; mark & date any
genuine contradiction; git is the ledger).

---

## 2. Run it locally

```bash
git checkout main && git pull origin main
cd apps/hq
npm install
npm run dev          # Circle HQ on http://localhost:5273
```

Open **localhost:5273** → click **HQ Vault** in the left rail → the **graph icon** (top-left of the
vault) → you should see ~319 nodes clustered by product colour.

### If the vault shows OLD content (e.g. "Argons Economy")
That's a stale `localStorage` snapshot, not the code. The storage key is now
`hq_vault_<SEED_VERSION>` (see `apps/hq/src/vault/storage.ts`), so a fresh pull + restart fixes it:
- **Fully restart** the dev server (Ctrl+C, then `npm run dev` again) and **hard-reload** (Ctrl+Shift+R).
- Or clear it by hand: DevTools → Application → Local Storage → `localhost:5273` → delete any `hq_vault_*` key → reload.

### See it in Obsidian instead (no build)
Open the `knowledge-base/` folder as an Obsidian vault → Graph view. Same 319 notes, instantly.

---

## 3. Repo map (what lives where)

### The knowledge base — `knowledge-base/`
| Path | What |
|---|---|
| `00-MASTER-KB.md` | The living master MOC (by product). |
| `README.md` · `METHOD.md` | How the KB works · the maintenance ritual + contradiction rule. |
| `layers/` | The stack tracker: `00-stack` + `L0-toolchain … L7-distribution`, scored Maturity × Leverage. |
| `journey/` | The build story: `00-arc` + `P0…P7` + `lessons/` (9) + `tech-evolution`. |
| `atlas/00-doc-atlas.md` | All 130 repo docs judged against code (the summary table). |
| `maps/` | `table-map` (71 tables) · `tech-evolution`. |
| `founder/` | 23 founder/strategy notes (HQ, KinetikCircle, The Economy, decisions, prompts…). |
| `graph/` | **The atomized nodes** — `docs/` (130), `tables/` (71), `deps/` (60). |
| `2026-07-11-baseline/` · `_templates/` | Baseline snapshots + delta/lesson templates. |

### The HQ Vault app — `apps/hq/src/vault/`
| File | Role |
|---|---|
| `types.ts` | Data model + `SEED_VERSION` (bumping it = fresh reseed). |
| `markdown.ts` | Front-matter parse, wikilink resolve, block tokenizer (**incl. callout rendering**). |
| `storage.ts` | localStorage persistence; `KEY = 'hq_vault_' + SEED_VERSION`. |
| `store.ts` | Zustand store; reseed-on-version-change. |
| `seed.ts` | Builds vault notes from `KB_NOTES`. **Does not hold note text.** |
| `kb.generated.ts` | **DERIVED — never hand-edit.** The KB markdown, emitted by the generator. |
| `components/` | FileExplorer, GraphView, BasesView, Preview, DecisionsView, etc. |

### Generators & CI — `apps/hq/scripts/` and `.github/`
| File | Role |
|---|---|
| `scripts/build-vault-seed.mjs` | Reads all `knowledge-base/**/*.md` → writes `kb.generated.ts`. Note id = file basename. |
| `scripts/build-graph-nodes.mjs` | Atomizes atlas/table-map/deps → `knowledge-base/graph/{docs,tables,deps}/*.md`. |
| `.github/workflows/vault-kb.yml` | Regenerates the seed, **fails on drift**, then builds HQ (`tsc && vite build`). |

---

## 4. The regeneration loop (IMPORTANT)

The markdown is the source; `kb.generated.ts` is derived. **After editing any KB note, regenerate and commit both**, or CI fails on drift:

```bash
cd apps/hq
npm run build:vault-seed      # knowledge-base/ → kb.generated.ts
git add ../../knowledge-base apps/hq/src/vault/kb.generated.ts
git commit -m "…"
```

To reseed existing local vaults after a content change, bump `SEED_VERSION` in
`apps/hq/src/vault/types.ts` (any new string).

---

## 5. Front-matter schema (single format, both surfaces)

```yaml
---
title: ...
type: moc | layer | journey | lesson | atlas | map | method | note | decision | prompt | strategy | doc-node | table-node | dep-node
status: living | baseline | frozen | current | superseded
date: 2026-07-11
tags: [...]
product: HQ | KinetikCircle | ArgantaLabs | LashiraBloom | Investor | Research   # drives vault colour/grouping
# layer notes only:
maturity: ... · leverage: ... · health: ...
---
```
Obsidian ignores the vault-only fields; the vault normalises unknown values to safe defaults. Legacy
vault statuses (active/draft/…) still parse.

---

## 6. Next build — toward "thousands" of nodes

Same pattern as `build-graph-nodes.mjs`; each reads repo data and emits atomic notes into
`knowledge-base/graph/<kind>/`, then you re-run `build-vault-seed`.

| Add | Source (all local, in-repo) | ~count |
|---|---|---|
| **RPC nodes** | `supabase/*.sql` — `create or replace function …` | 147 |
| **Migration nodes** | `supabase/migration_*.sql` (one per file) | 45 |
| **Agent / office nodes** | `apps/hq/src/data/graph/agents.ts` | ~33 |
| **Surface nodes** | master KB §2.1 surface list | ~40 |

That takes 319 → ~580. Finer atomization (content-pack items, asset categories, per-file LOC) goes further.

> Note: `build-graph-nodes.mjs`'s **doc** nodes read an atlas assessment from a session temp file
> (`/tmp/.../w4107dlid.output`) that does NOT exist locally — so running the script locally regenerates
> `tables/` + `deps/` (from the repo) and **skips docs** (already committed). To re-judge docs you'd
> re-run the atlas pass (a multi-agent review of the 130 docs against code) — not needed unless docs change.

### Wiring a new node kind (recipe)
1. In `build-graph-nodes.mjs`, add a block that reads the source and calls `write('<kind>', 'prefix-'+id, {front-matter}, body)`.
2. Give each node a **globally-unique** basename (prefix it: `rpc-`, `mig-`, `agent-`…) — the seed generator errors on duplicate ids.
3. Link each node to a hub that exists (`[[00-doc-atlas]]`, `[[table-map]]`, `[[L1-data]]`, `[[L0-toolchain]]`, or a product note like `[[LashiraBloom]]`).
4. `node scripts/build-graph-nodes.mjs` → `npm run build:vault-seed` → bump `SEED_VERSION` → typecheck → commit.

---

## 7. Verify before you commit

```bash
cd apps/hq
npm run type-check                 # tsc --noEmit
npm run build                      # tsc && vite build (what CI + Vercel run)
git diff --exit-code apps/hq/src/vault/kb.generated.ts   # must be clean after build:vault-seed
```

---

## 8. Known issues / follow-ups
- **3 new lashira docs** merged from main (`docs/lashirabloom/audio-audit-2026-07.md`, `music-forge-3d-wow-research.md`, `…pinch-zoom…`) are not yet in the atlas / doc-nodes. Fold in on the next atlas pass.
- **Vercel free tier = 100 deploys/day.** Many pushes exhaust it and production lags ~24h. Batch commits; test locally meanwhile.
- **`type: doc-node/table-node/dep-node`** aren't in the vault's `NoteType` enum, so they normalise to `note` (fine functionally). Add them to `types.ts` + a FileExplorer icon if you want distinct type filtering.
- The vault graph gets dense at 319+ — use the type/tag filters at the top of the graph, or product pills, to slice it.

---

## 9. Command cheat sheet
```bash
# run the vault
cd apps/hq && npm run dev                 # localhost:5273 → HQ Vault → graph icon

# regenerate after editing KB markdown
npm run build:vault-seed                  # (in apps/hq)

# atomize more nodes
node scripts/build-graph-nodes.mjs        # (in apps/hq) → then build:vault-seed

# verify
npm run type-check && npm run build

# open in Obsidian
#   open the knowledge-base/ folder as a vault → Graph view
```

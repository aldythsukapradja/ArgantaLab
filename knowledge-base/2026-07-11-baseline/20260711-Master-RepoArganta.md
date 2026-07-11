---
extracted: 2026-07-11
type: Master
domain: Repo
entity: repo-arganta
status: baseline
supersedes:
impacts: []
matters:
tags: [kb/baseline, repo]
---

# Master — Repo Arganta

> The ArgantaLab monorepo: shared packages consumed by the `apps/*` Vite projects, plus the
> Circle HQ / KinetikCircle / game surfaces. This note is the baseline state of the *codebase* as a
> thread. #known

## State as of baseline

### Shape
- Monorepo, npm workspaces: `packages/*`, `apps/kingdom/web`, `apps/lashira/web`. #known
- **Apps:** `hq` (Circle HQ / Founder OS) · `kinetik` (family OS) · `kingdom` (NexusTK-style MMORPG)
  · `lashira` (LashiraBloom) · `landing` · `mcp` (the Bridge, an LLM seat over Circle HQ) · `web`
  (ArgantaLab shell). #known
- **Shared packages:** `audio · character · combat · heroes-engine`. #known
- **Cloud:** `supabase/` — cloud setup, Pixel Vault, and the shared identity **spine contract**. #known
- Deploy targets present: `vercel.json`, `render.yaml`. #known

### Invariants (the rules everything else must respect)
- **GitHub** stores code, migrations, seeds, schema history.
  **Supabase** stores game truth, ledgers, user state, live config. #known
- **ArgantaLabs is the single source of truth for diamonds + kids' education EXP.** Kids never earn
  Character XP or diamonds from game actions — only from learning apps / approved guardian events. #known
- **Adult and kid progression are separate models.** #known
- Diamonds buy skins only, never power. #known

### Documentation
- ~130 markdown docs across root, `apps/*`, `docs/*`, `supabase/`, indexed by a static
  `docs/README.md` in the repo (the "what exists" map). #known
- Self-indexed subtrees exist for the MMORPG docs, the Openworld Bloom concept, and the fable vault. #known

## Why it's here / what it's for
The repo is the substrate under every product thread. Changes to the invariants above (data spine,
kids-vs-adults, diamond rules) ripple into *every* game and app — so the repo gets its own thread and
its deltas are worth watching closely.

## Open threads
- LashiraBloom carries three overlapping doc layers not yet reconciled against each other. #assumed
- Likely-stale build artifact: `apps/kingdom/dist_site/data/derived/audit.md` duplicates the source
  audit. #assumed
- Top-of-funnel instrumentation is blind — activation is the weakest lever while it's unmeasured. #known

## Links
- Related threads: (add `[[…]]` as you author them — e.g. the AI stack, the knowledge-graph brain)

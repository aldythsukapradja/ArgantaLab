---
title: METHOD — how this KB is built and kept alive
type: method
status: living
date: 2026-07-11
tags: [arganta, knowledge-base, method, ritual]
cssclasses: [wide-tables]
---

# 🛠️ METHOD — how this KB is built and kept alive

> [!abstract] Why this note exists
> A living knowledge base is only as good as the discipline that maintains it. This is that discipline, written down — the repeatable ritual behind every note in this vault, so the next extraction (yours or an agent's) follows the same standard the baseline was built to.

## The one principle

> [!important] Verify against the code. Never trust the doc.
> Every number, every verdict, every "it shipped" is checked against real source — `grep` the app, read the migration, count the files — before it's written. A doc describes *intent*; the code is *truth*. This is [[write-the-audit-first]] applied to the KB itself, and it's the single thing that makes this vault trustworthy instead of merely tidy.

## The loop — every artifact, same shape

```
Align → Verify → Synthesize → Wire → Audit → Commit → Deliver
```

| Step | What it means | The tripwire it avoids |
|---|---|---|
| **Align** | Brainstorm/confirm the *cut* before writing | Building the wrong shape beautifully |
| **Verify** | Read the actual source; check every claim in code | A confident doc that's quietly false |
| **Synthesize** | Write Obsidian-native, opinionated, in the house voice | A neutral dump nobody reads |
| **Wire** | Every internal `[[link]]` resolves; source docs shown as `code` paths | Dangling links / a non-portable bundle |
| **Audit** | Script-check links + numbers before commit | Rot shipped as truth |
| **Commit** | Push to the branch, one clear message | Lost work in an ephemeral container |
| **Deliver** | Hand over a self-contained zip | "Where do I even open this?" |

## House rules

- **Front-matter on every note** — `type`, `status`, `date`, `tags` at minimum; controlled vocab (see [[README]]).
- **Obsidian-native** — callouts (`> [!abstract]`, `> [!danger]`…), tight tables, `[[wikilinks]]`, ASCII diagrams. Match [[00-MASTER-KB]]'s voice.
- **Portable** — links point *inside* the bundle; repo source files are referenced as `code` paths, never links, so the folder survives being dropped into any vault.
- **Opinionated** — a verdict, a "so what", a wayforward. Neutral inventory is the Master KB's job; everything else takes a position.
- **Provenance** — mark facts `#known` (verified) vs `#assumed` (belief). Never render a guess as a fact.

## One KB, two surfaces — no silent contradictions

The knowledge base is **one set of markdown files**, rendered in two places. There is no second copy to drift.

```
knowledge-base/**/*.md   ── the single source ──┐
   │                                            │
   ├─▶ Obsidian: open the folder (plug-and-play)│  same markdown,
   │                                            │  same format,
   └─▶ HQ Vault: node apps/hq/scripts/build-vault-seed.mjs
          → apps/hq/src/vault/kb.generated.ts (DERIVED — never hand-edit)
```

- **`knowledge-base/founder/*.md`** is what the HQ Vault seeds from. Edit the markdown, run
  `npm run build:vault-seed` in `apps/hq`, commit the `.md` **and** the regenerated file together.
- Both surfaces speak the same front-matter (the vault's `types.ts` adopted the main-KB schema:
  `type: moc/layer/…`, `status: living/baseline/…`, `maturity/leverage`). Obsidian ignores the
  vault-only extras (`product`, `confidence`); the vault ignores nothing.
- Callouts (`> [!abstract]`) now render in the vault too, so the format is faithful in both.

### The contradiction rule
Because there is one source, two notes can't *silently* disagree. When they genuinely must diverge
(a concept was replaced, a number changed), the divergence is made **explicit and versioned**, never
left implicit:

1. Mark the losing note `status: superseded` and point `supersedes:` / a link at what replaced it
   (the [[00-doc-atlas|atlas]]'s superseded-chains are exactly this).
2. State *why* and *when* in the note — a dated line, `#known` vs `#assumed` provenance.
3. Commit it. **git is the version control**: the diff is the record of what changed and why.

A contradiction that isn't marked-and-dated is a bug in the KB, not a fact about the world.

## Playbooks

### ▸ Run an extraction (the weekly delta)
1. New folder `knowledge-base/YYYY-MM-DD/`.
2. For each thread that **moved**, copy `_templates/delta.md` → `YYYYMMDD-Delta-<Title>.md`, reuse the `entity` slug, answer the four questions (changed / why / impacted / **does it matter?**).
3. Threads that didn't move need no note. **Silence = unchanged.**
4. A high-`matters` delta triggers edits to [[00-MASTER-KB]] + the relevant [[00-stack|layer card]] + a new note in `journey/lessons/` if it crystallized a lesson.
5. `_SUMMARY.md` for the folder. Commit.

### ▸ Update a layer card
1. Append a dated bullet under **What changed** in the `layers/L#-*.md` card.
2. Re-score **Maturity × Leverage** if it shifted; update **Wayforward**.
3. Re-generate the money table in [[00-stack]] if any score changed.

### ▸ Re-judge the doc atlas (on a doc sprawl)
1. Cluster docs by product/area.
2. Per cluster: read each doc, **cross-check code** for whether it shipped, assign verdict + reason + lesson + front-matter.
3. Fan out with a workflow when the corpus is large (the baseline used 14 assessor agents + 8 journey writers + 1 lesson editor).
4. Assemble `atlas/00-doc-atlas.md`; highlight superseded chains.

### ▸ Regenerate the Master KB (on architecture change)
Re-run the counts in [[00-MASTER-KB#14 · Regenerate This Note|§14]], refresh §1–8 (state), leave §9 (history) append-only, update §10–13.

## What "done" means here

> [!quote]
> A KB note is done when a stranger to the context could act on it — and when every claim in it would survive being checked against the code. Tidy is not done. **Verified is done.**

## Links
[[README|How this KB works]] · [[00-MASTER-KB]] · [[00-arc|The Journey]] · [[00-doc-atlas|The Atlas]] · [[00-stack|The Layer Tracker]]

---
type: Index
entity: knowledge-base
status: current
tags: [kb/index]
---

# Knowledge Base — living, extraction-dated

The **temporal layer** of my knowledge system: dated snapshots of what's true, and diffs of what
changed between them. It answers *"how is this evolving?"*

**Baseline:** `2026-07-11`. Everything after it is measured *against* it.

> This folder is self-contained. Drop it anywhere inside your Obsidian vault and every internal link
> resolves. Source docs in the repo are referenced as `code` paths, never links, so nothing dangles.

## Start here (the baseline)

Today's baseline has four pillars — read them in this order:

1. [[00-MASTER-KB]] — the living **NOW**: one-substrate truth, schema, deploy, status board, debt.
2. [[00-arc|The Journey]] — how we got here in 8 phases (`journey/P0..P7`), each with what shipped,
   what was **abandoned**, and what it **taught**.
3. **Lessons** (`journey/lessons/`) — 9 distilled, reusable learnings, each evidenced against real
   docs + code. Linked from [[00-arc]].
4. [[00-doc-atlas|The Doc Atlas]] — all 130 markdown files, each judged against the code:
   current / partial / superseded / concept-unbuilt / reference / archive.
5. [[00-stack|The Layer Tracker]] — the vertical cut: 8 stack layers (`layers/`, L0–L7), each a
   living health card scored on **Maturity × Leverage**, with its own *what changed / lessons /
   wayforward*. Detail maps hang off it: [[maps/table-map|Table Map]] (all 71 tables) and
   [[tech-evolution|Tech Evolution]] (what entered the stack, when, why it drifted).

> [!info] The four axes
> **Master KB** = by product · **Layer tracker** = by stack layer · **Journey** = by time ·
> **Atlas** = by document. Same baseline, four ways to slice it.

For *how* any of this gets built and kept alive, see [[METHOD]] — the ritual behind every note.

---

## The model in one picture

```
        TODAY (baseline)          NEXT TIME           LATER
        ───────────────          ─────────          ───────
repo →  "what's true now"  ──▶   "what changed?" ──▶ "what changed?"
idea →  "what's true now"  ──▶   (didn't move,        "what changed?"
                                  no note)
```

- A **baseline note** states the current state of one *thread* (an idea, a system, the repo).
- A **delta note** re-visits that same thread later and records only the change.
- They're tied together by a stable **`entity:`** slug in the front-matter — every note about the
  repo carries `entity: repo-arganta`, whatever its date. That's how Obsidian lines them up as one
  timeline even though the files are filed by date.

Each extraction lives in its **own dated folder**. Files keep the `YYYYMMDD-…` prefix so note names
stay unique → clean `[[wikilinks]]`.

---

## The delta schema (the four questions)

Every note dated after the baseline uses [`_templates/delta.md`](_templates/delta.md). Its body is
exactly:

1. **What changed** — vs the last extraction of this `entity`.
2. **Why** — the driver. External event? A decision? A discovery?
3. **What's impacted** — links to the threads this touches.
4. **Does it matter?** — a verdict, plus `matters: high | medium | low` so the index surfaces the
   ones that do and lets the rest sink.

That last field is the whole point of a *living* KB: signal (shifts the plan) vs churn (just happened).

---

## Front-matter schema

Copy from the templates; don't hand-type. Fixed vocabularies keep the queries honest.

```yaml
---
extracted: 2026-07-11      # date of THIS extraction (matches the folder)
type: Baseline             # Baseline | Delta | Idea | Analysis | Reference | Master
domain: Repo               # Repo | Tech | AI | Startup | Business | Learning | Product | Strategy
entity: repo-arganta       # STABLE slug — the thread. Deltas reuse the baseline's slug.
status: baseline           # baseline | current | superseded
supersedes:                # [[prior note]] this replaces, or blank
impacts: []                # [[wikilinks]] to affected threads
matters:                   # high | medium | low  — set on deltas; blank on baseline
tags: [kb/baseline]
---
```

> **Type vs domain.** Filenames like `…-Tech-AIStack` and `…-Tech-KnowledgeGraph…` used "Tech" as
> both a *type* and a *category*. In front-matter they're separate fixed fields (`type`, `domain`),
> so that ambiguity disappears — while the filename stays scannable exactly as you have it.

---

## The living index (needs the Dataview plugin)

With [Dataview](https://blacksmithgu.github.io/obsidian-dataview/) enabled, these build themselves.
Without it they render as plain code — use the inventory list below instead.

**Current truth — latest extraction per thread:**
```dataview
TABLE extracted AS "Last seen", domain, status
FROM "knowledge-base"
WHERE entity AND type != "Index"
SORT extracted DESC
GROUP BY entity
```

**What moved recently — deltas, newest first:**
```dataview
TABLE extracted AS "When", matters, impacts
FROM "knowledge-base"
WHERE type = "Delta"
SORT extracted DESC
```

**Things that matter — high-impact changes to act on:**
```dataview
TABLE extracted AS "When", entity, impacts
FROM "knowledge-base"
WHERE type = "Delta" AND matters = "high"
SORT extracted DESC
```

---

## Baseline inventory (2026-07-11)

The map of my existing flat notes into this scheme. Slugs are the stable thread-IDs.

| Existing note | `type` | `domain` | `entity` |
|---|---|---|---|
| [[20260711-Master-RepoArganta]] *(authored)* | Master | Repo | `repo-arganta` |
| `20260711-Idea-Tech-AIStack` | Idea | Tech | `ai-stack` |
| `20260711-Analysis-Strategy-8LawsVsQUDT` | Analysis | Strategy | `8laws-vs-qudt` |
| `20260711-Reference-Tech-KnowledgeGraphHQ` | Reference | Tech | `knowledge-graph-hq` |
| `20260611-Idea-Startup-100MFounderPrompts` | Idea | Startup | `100m-founder-prompts` |
| `20260611-Idea-Business-LeverageFrameworks` | Idea | Business | `leverage-frameworks` |
| `20260610-Idea-Tech-OpenSourceDevStack` | Idea | Tech | `oss-dev-stack` |
| `20260520-Idea-AI-AgenticStartupResources` | Idea | AI | `agentic-startup-resources` |
| `20260410-Idea-Learning-ProfessionalGrowth` | Idea | Learning | `professional-growth` |

Only **RepoArganta** is authored (I could build it from the actual repo). For the rest: paste your
content in, add the front-matter above, drop the file in `2026-07-11-baseline/`, and it joins the
index automatically.

---

## How to run an extraction (the ritual)

1. Make a folder `YYYY-MM-DD/` (or `-baseline` for the first).
2. For each thread that **moved**, copy `_templates/delta.md` → name it `YYYYMMDD-Delta-<Title>.md`,
   reuse the thread's `entity` slug, answer the four questions.
3. For each **new** thread, copy `_templates/baseline.md` instead.
4. Write a `_SUMMARY.md` for the folder — one paragraph + the high-`matters` items.
5. Threads that didn't move need no note. **Silence = unchanged.**

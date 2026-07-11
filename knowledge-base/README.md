---
type: Index
entity: knowledge-base
status: current
tags: [kb/index]
---

# Knowledge Base — living, extraction-dated

This is the **temporal layer** of the Arganta knowledge system: dated snapshots of what's
true, and diffs of what changed between them. It answers *"how is this evolving?"* — not
*"what exists?"* (that's [`docs/README.md`](../docs/README.md)) and not *"what's the distilled
current truth?"* (that's the [[HOME|fable vault]] under `docs/fable handoff/vault/`).

**Baseline:** `2026-07-11`. Everything after it is measured *against* it.

---

## The model in one picture

```
2026-07-11-baseline/     ← today. A full snapshot. Each note = "what's true now."
   20260711-Master-RepoArganta.md
   20260711-Idea-Tech-AIStack.md
   ...
2026-07-18/              ← next extraction. DELTAS only, one per thread that moved.
   20260718-Delta-RepoArganta.md   → What changed / Why / Impacted / Does it matter?
   ...
```

- A **baseline note** states the current state of one *thread* (an idea, a system, the repo).
- A **delta note** re-visits that same thread later and records only the change.
- They're tied together by a stable **`entity:`** slug in the front-matter — e.g. every note about
  the repo carries `entity: repo-arganta`, whatever its date or title. That's how Obsidian can show
  you the whole timeline of one thread even though the files are filed by date.

Each extraction lives in its **own dated folder** (the "date of extraction" you asked for). Files
keep the `YYYYMMDD-…` prefix so note names stay globally unique → clean `[[wikilinks]]`.

---

## The delta schema (your four questions)

Every note dated after the baseline uses [`_templates/delta.md`](_templates/delta.md). Its body is
exactly:

1. **What changed** — vs the last extraction of this `entity`.
2. **Why** — the driver. External event? A decision? A discovery?
3. **What's impacted** — `[[wikilinks]]` to the entities/decisions this touches.
4. **Does it matter?** — a verdict, plus a `matters: high | medium | low` field so the index can
   surface the ones that do and let the rest sink.

That last field is the whole point of a *living* KB: it separates signal (things that shift the
plan) from churn (things that just happened).

---

## Front-matter schema

Copy from the templates; don't hand-type. Controlled vocabularies keep Dataview honest.

```yaml
---
extracted: 2026-07-11      # date of THIS extraction (matches the folder)
type: Baseline             # Baseline | Delta | Idea | Analysis | Reference | Master
domain: Repo               # Repo | Tech | AI | Startup | Business | Learning | Product | Strategy
entity: repo-arganta       # STABLE slug — the thread. Deltas reuse the baseline's slug.
status: baseline           # baseline | current | superseded
supersedes:                # [[prior note]] this replaces, or blank
impacts: []                # [[wikilinks]] to affected entities
matters:                   # high | medium | low  — set on deltas; blank on baseline
tags: [kb/baseline]
---
```

> **Why lift Type/Category into front-matter?** Your filenames used "Tech" as both a *type*
> (`…-Tech-KnowledgeGraph…`) and a *category* (`…-Idea-Tech-AIStack`). In front-matter, `type` and
> `domain` are separate fixed fields, so that ambiguity disappears and Dataview can group cleanly —
> while the filename stays human-scannable exactly as you have it.

---

## The living index (needs the Dataview plugin)

If you have [Dataview](https://blacksmithgu.github.io/obsidian-dataview/) enabled, these tables
build themselves. If not, they render as code — skip to the plain list below.

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

Plain-markdown fallback + the map of your existing Obsidian notes into this scheme. Slugs in the
`entity` column are the stable thread-IDs.

| Existing note | → filed as | `type` | `domain` | `entity` |
|---|---|---|---|---|
| `20260711-Master-RepoArganta` | [[20260711-Master-RepoArganta]] | Master | Repo | `repo-arganta` |
| `20260711-Idea-Tech-AIStack` | `20260711-Idea-Tech-AIStack` | Idea | Tech | `ai-stack` |
| `20260711-Analysis-8LawsVsQUDTStrategy` | `20260711-Analysis-Strategy-8LawsVsQUDT` | Analysis | Strategy | `8laws-vs-qudt` |
| `20260711-Tech-KnowledgeGraphBrainOfHQ` | `20260711-Reference-Tech-KnowledgeGraphHQ` | Reference | Tech | `knowledge-graph-hq` |
| `20260611-Idea-Startup-100MFounderPrompts` | `20260611-Idea-Startup-100MFounderPrompts` | Idea | Startup | `100m-founder-prompts` |
| `20260611-Idea-BusinessLeverageFrameworks` | `20260611-Idea-Business-LeverageFrameworks` | Idea | Business | `leverage-frameworks` |
| `20260610-Idea-Tech-OpenSourceDeveloperStack` | `20260610-Idea-Tech-OpenSourceDevStack` | Idea | Tech | `oss-dev-stack` |
| `20260520-Idea-AI-AgenticStartupResources` | `20260520-Idea-AI-AgenticStartupResources` | Idea | AI | `agentic-startup-resources` |
| `20260410-Idea-Learning-ProfessionalGrowth` | `20260410-Idea-Learning-ProfessionalGrowth` | Idea | Learning | `professional-growth` |

Only **RepoArganta** is fully authored so far (I could build it from the actual repo). The rest are
your Obsidian content — drop each in with the front-matter above and it joins the index automatically.

---

## How to run an extraction (the ritual)

When you sit down to capture — daily, weekly, whenever:

1. Make a folder `knowledge-base/YYYY-MM-DD/` (or `-baseline` for the very first).
2. For each thread that **moved**, copy `_templates/delta.md`, name it `YYYYMMDD-Delta-<Title>.md`,
   reuse the thread's `entity` slug, and fill the four questions.
3. For each **new** thread, copy `_templates/baseline.md` instead.
4. Write a `_SUMMARY.md` for the folder — one paragraph: what this extraction was about + the
   high-`matters` items. (See the baseline's [`_SUMMARY.md`](2026-07-11-baseline/_SUMMARY.md).)
5. Commit. The git history *is* the second, redundant timeline — the folders are the human one.

Threads that didn't move need no note. Silence = unchanged.

---

## Relationship to the rest of the system

| Layer | Lives in | Question it answers | Update style |
|---|---|---|---|
| **Static doc map** | [`docs/README.md`](../docs/README.md) | *What docs exist, where?* | On new docs |
| **Distilled truth** | `docs/fable handoff/vault/` ([[HOME]]) | *What do I currently believe about X?* | In place |
| **This KB** | `knowledge-base/` | *What changed, when, and did it matter?* | Append-only, dated |

The KB feeds the vault: a high-`matters` delta here is the trigger to go edit the distilled note there.

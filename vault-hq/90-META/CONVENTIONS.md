---
title: CONVENTIONS
product: HQ
type: spec
class: operational
status: active
canonical: true
version: v1
updated: 2026-07-08
owner: aldyth
confidence: high
domain: [ai-context]
tags: [rail, meta, operating-manual]
---

# Conventions — naming, links, placement

> Small rules that keep the vault portable and the graph view meaningful.

## Naming

- **Captures**: `YYYY-MM-DD-HHMM-<kebab-slug>.md` in `60-CAPTURES/_INBOX/`.
- **Distilled notes**: `kebab-slug.md`, no date prefix (they're living, not dated events).
- **Session/event logs**: `YYYY-MM-DD-<slug>.md` (dated — they're a point in time).
- Folders use `NN-NAME/` numeric prefixes to control Obsidian's sort order.

## Links

- Use `[[wikilinks]]` by **basename** (`[[persona-core]]`, not a path). Obsidian resolves them
  regardless of folder, so notes can move without breaking links. Keep basenames unique.
- No absolute paths, no `../`. If you need to point outside the vault, you're breaking
  the One-Folder Principle — copy the material in or summarize it instead.
- Every note should have at least one inbound or outbound link. Orphans get lost.

## Attachments

- Images/screenshots go in `attachments/`, referenced as `![[filename.png]]`.
- Name them after the note that uses them where possible.

## Placement

- Raw input → `60-CAPTURES/_INBOX/` (always, no exceptions).
- Interesting-but-not-now → `60-CAPTURES/_ARCHIVE/`.
- Distilled knowledge → `00-CORE` … `50-PROFESSIONAL` per [[DIGEST]] §4.
- Historical build docs / one-time handoffs → `90-META/_provenance/`.
- Frozen version snapshots → `_versions/` beside the living note.

## The status badge (top of every operational note)

Right under the frontmatter, a one-line callout so "latest or not?" is instant:

```markdown
> [!success] 🟢 CANONICAL v3 · updated 2026-07-08
```
Other states: `> [!warning] ⚠️ SUPERSEDED → [[topic-current]]` ·
`> [!caution] 🕒 STALE — verify before trusting` · `> [!note] 🗄️ ARCHIVED`.
Brainstorm notes need no badge (their `class` says it). Badge must match the frontmatter.

## Versioning a note (living-file default)

1. Keep the filename/slug — links and backlinks must survive.
2. Bump `version` + `updated`; update the badge; append to `## Changelog`.
3. To retire one in favour of another: set old `canonical: false` + `superseded_by: [[new]]`,
   new gets `canonical: true` + `supersedes: [[old]]`. Exactly one canonical per topic.

## Maps of Content (the mind-map spine)

- Each numbered folder has an index note named `_MOC.md` (e.g. `10-PROJECTS/_MOC.md`) that
  links every note in it. `HOME` links the MOCs. This gives the graph a hub-and-spoke shape
  instead of a hairball.
- A note with no inbound/outbound link is an orphan — link it from its MOC.

## Portability check (run before "done")

- No file references anything outside `vault-hq/`.
- All links resolve (no broken `[[ ]]`).
- No half-finished note presented as done.
- Frontmatter matches [[TAXONOMY]].

## Links
- Governed by: [[DIGEST]] · vocabulary in [[TAXONOMY]]

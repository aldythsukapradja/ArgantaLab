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

## Portability check (run before "done")

- No file references anything outside `vault-hq/`.
- All links resolve (no broken `[[ ]]`).
- No half-finished note presented as done.
- Frontmatter matches [[TAXONOMY]].

## Links
- Governed by: [[DIGEST]] · vocabulary in [[TAXONOMY]]

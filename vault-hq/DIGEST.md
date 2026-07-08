# DIGEST — how raw input becomes organized knowledge

> The operating manual for this vault. Human-readable and AI-readable.
> Any Reasoner (me, Claude, a future model) reads this file to know how to file things.
> The Skill `digital-brain-capture` is a thin pointer to *this* — one source of truth.

---

## 0. What this vault is

The **distilled** layer of my brain — not a transcript dump. Everything here is either
raw-in-the-inbox (untrusted) or reviewed-and-distilled (trusted). The line between them is
**me, at harvest**. Nothing crosses it automatically.

The honesty rule applies everywhere: never present raw as truth, never present
inferred as known, never present simulated as measured. Flag inference as inference.

---

## 1. The intake law (how raw input enters)

Every piece of raw input — screenshot, link, idea, note, chat log, article, code, inspiration —
becomes **ONE NEW FILE** in `60-CAPTURES/_INBOX/`.

- Filename: `YYYY-MM-DD-HHMM-<kebab-slug>.md`
- Never append to a shared file. One capture = one file. (New files never cause git conflicts —
  this is what makes multi-writer sync safe.)
- The capturing agent (Claude Code) writes **only** inside `60-CAPTURES/`. It never edits a
  distilled note or a core file.
- Images go to `attachments/`, linked from the capture note.

---

## 2. The frontmatter schema (the query contract — keep it stable)

Every note carries this YAML. Stable field names = future AI can query the whole vault.

```yaml
---
title:              # short, clear
status: raw         # raw | reviewing | distilled
intent:             # capture | digest | decision | action | repo-context | fable-brief | archive
captured: 2026-07-08
source:             # where it came from (URL, "Instagram", "meeting", etc.)
domain:             # one or more from TAXONOMY (see 90-META/TAXONOMY.md)
confidence:         # low | medium | high
promoted: false     # flips to true only when I harvest it into the distilled vault
related:            # [[wikilinks]] to connected notes
---
```

Full vocabulary (domains, tags, allowed values) lives in [[TAXONOMY]].

---

## 3. The 7 intent classes (how to classify a capture)

Pick the **primary** one; note a secondary only if strong. Default to the lowest-commitment
class that fits — most inputs are Capture or Digest, not Decision or Action.

1. **capture** — unprocessed inspiration / screenshot / link / idea / note.
2. **digest** — should be summarized, interpreted, connected to existing areas.
3. **decision** — implies a choice, direction, tradeoff, or principle.
4. **action** — should become a task, build step, repo update, or follow-up.
5. **repo-context** — affects Arganta, code, product direction, or AI instructions.
6. **fable-brief** — should become visual/story/dashboard/UI *text* direction (never copied art).
7. **archive** — interesting but not useful now → `60-CAPTURES/_ARCHIVE/`.

Extract the **principle**, not the source text. Never copy third-party assets, layouts, copy,
characters, brand, or IP — distill the reusable lesson only.

---

## 4. Where distilled notes land (the placement map)

When I harvest a capture, it moves out of `_INBOX/` and its content lands here:

| If the note is about… | It belongs in… |
|---|---|
| who I am / how I decide / how the system thinks | `00-CORE/` |
| a specific product (Arganta / Kinetik / Circle HQ) | `10-PROJECTS/` |
| a skill, connector, rail, routing rule | `20-SYSTEM/` |
| measurement, graph, sensors, coverage | `30-DATA/` |
| initiative status / what's being built | `40-ROADMAP/` |
| career, paper, positioning | `50-PROFESSIONAL/` |
| a decision | a decision note (link it from the relevant area) |
| a visual/design direction | a fable-brief note (text direction, in `10-PROJECTS/` or `40-ROADMAP/`) |

Raw specs and build artifacts do **not** enter the distilled vault. Distill them into a note
or leave them in the source repo. The vault stays the distilled layer.

---

## 5. The harvest ritual (raw → distilled — this is human)

Runs in the evening loop (see [[daily-loop]]). Not automated.

1. Open `60-CAPTURES/_INBOX/`. Read each un-promoted note.
2. Decide: distill it (into the folder from §4), archive it, or drop it.
3. When distilling: extract the principle into the right note, add `[[wikilinks]]`,
   set `status: distilled` and `promoted: true` on the source, then move/merge it.
4. Nothing in `_INBOX/` is trusted until this happens.

---

## 6. The promotion gate (what protects truth)

Core and "current truth" files — persona, mental-model, and any `*_CURRENT` file —
change **only by my hand**. An agent may *propose* a patch and say which file it targets;
it never applies one. This is the immune system against truth drift.

---

## 7. Conventions

Naming, wikilink style, and folder-placement rules: [[CONVENTIONS]].
Controlled vocabulary (domains + tags + field values): [[TAXONOMY]].

---

## Links
- Entry point: [[HOME]]
- Rules: [[TAXONOMY]] · [[CONVENTIONS]]
- Lived through: [[daily-loop]] · powered by [[persona-core]]

---
title: DIGEST
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

### The guardrail (read this first)
Two independent axes govern every note — never collapse them:
- **`class`** = *can I rely on this?* → `brainstorm` | `operational` | `reference`
- **`canonical` / `version`** = *is this the latest one?*

**The one hard rule the whole system obeys:**
> Only a note with `class: operational` **AND** `canonical: true` may be treated as truth.
> `brainstorm` is never citable as truth. `reference` is a source, not truth.

Vocabulary + full field list: [[TAXONOMY]].

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

Every note carries the **unified schema** — the same fields the HQ Vault app uses, so a note
opens in Obsidian *and* loads into the app's GraphView/DecisionsView unchanged.

A fresh **capture** in `_INBOX/` starts minimal (`class: brainstorm`, `status: seed`):

```yaml
---
title:
product:            # HQ | KinetikCircle | ArgantaLabs | LashiraBloom | Investor | Research | Life
type: capture       # note | strategy | decision | prompt | research | plan | spec | capture
class: brainstorm   # ← untrusted until harvested
status: seed        # seed | draft | active | shipped | archived
canonical: false
version: v1
updated: 2026-07-08
source:             # where it came from
confidence: low
domain: []
tags: []
related: []
---
```

When harvested into an operational note it gains `class: operational`, `status: active`,
`canonical: true`, and an `owner`. Full field list + allowed values: [[TAXONOMY]].

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

1. Open `60-CAPTURES/_INBOX/`. Read each note (all `class: brainstorm`).
2. Decide: distill it (into the folder from §4), archive it, or drop it.
3. When distilling: extract the principle into the right note, add `[[wikilinks]]`, then
   **flip the axes** — `class: operational`, `status: active`, `canonical: true`, set `owner`.
   The source capture moves/merges out of `_INBOX/`.
4. Nothing in `_INBOX/` is trusted until this happens. Brainstorm → operational is the gate.

---

## 6. Versioning operational truth (is this the latest?)

Every operational note answers "latest or not?" at a glance via a **badge callout at the top**
(see [[CONVENTIONS]]) driven by its frontmatter:

| Badge | Frontmatter | Meaning |
|---|---|---|
| 🟢 **CANONICAL vN · latest** | `canonical: true`, fresh `updated` | this IS the truth |
| 🕒 **STALE · verify** | `canonical: true`, `updated` past its freshness window ([[TAXONOMY]]) | latest that exists, but aging |
| ⚠️ **SUPERSEDED → [[newer]]** | `canonical: false`, `superseded_by` set | not latest — follow the link |
| 🗄️ **ARCHIVED** | `status: archived` | retired |

**Cutting a new version (living-file style — the default):**
1. Keep the file's name and slug (so links/backlinks survive).
2. Bump `version:` and `updated:`; append a `## Changelog` entry (`vN — date — what changed`).
3. Git history holds the old bytes. No new file.

**Only one `canonical: true` note per topic.** If you must *freeze* an old version (a shipped
spec, a made decision), copy it to `_versions/<slug>-vN-<date>.md`, mark it `status: archived`
+ `superseded_by`, and leave the living file canonical.

---

## 7. The promotion gate (what protects truth)

Core and canonical files — persona, mental-model, and any `canonical: true` operational note —
change **only by my hand**. An agent may *propose* a patch and say which file it targets;
it never applies one, and it never sets `canonical: true` itself. This is the immune system
against truth drift.

---

## 8. The mind map (one schema, two renderers)

The graph builds itself from `[[wikilinks]]` + `tags`. Two views, same notes:
- **Obsidian graph** — open `vault-hq/` in Obsidian.
- **HQ Vault app GraphView** — the same frontmatter loads into `apps/hq/src/vault`.

To keep the graph readable, each folder has a **Map-of-Content** index note (`_MOC`) that links
its notes; `HOME` links the MOCs. Filter/color by `class` to see the bright operational-canonical
core vs the dim brainstorm halo; filter `product: KinetikCircle` to see just that world.

---

## 9. Conventions

Naming, wikilink style, badge callouts, folder-placement rules: [[CONVENTIONS]].
Controlled vocabulary (domains + tags + field values): [[TAXONOMY]].

---

## Links
- Entry point: [[HOME]]
- Rules: [[TAXONOMY]] · [[CONVENTIONS]]
- Lived through: [[daily-loop]] · powered by [[persona-core]]

# Taxonomy — the controlled vocabulary

> The words the whole vault agrees on — and the words the **HQ Vault app** already uses
> (`apps/hq/src/vault/types.ts`). One schema, two renderers: Obsidian graph + the app's
> GraphView/DecisionsView. If a word isn't here, add it here first; don't invent silently.

---

## The two axes (never collapse them)

- **`class`** = *can I rely on this?* — the **guardrail**.
- **`canonical` / `version`** = *is this the latest one?* — the **freshness/version** marker.

A note can be operational-but-stale, or brainstorm-and-fresh. Keep the axes separate.

---

## Unified frontmatter (every note carries this)

```yaml
---
title:                # short, clear
product:              # HQ | KinetikCircle | ArgantaLabs | LashiraBloom | Investor | Research | Life
type:                 # note | strategy | decision | prompt | research | plan | spec | capture
class:                # brainstorm | operational | reference     ← guardrail
status:               # seed | draft | active | shipped | archived  ← lifecycle (app-compatible)
canonical:            # true | false   — is this THE latest truth for its topic? (operational only)
version: v1           # v1, v2, …
updated: 2026-07-08   # ISO date — drives the STALE check
owner: aldyth
confidence:           # low | medium | high
supersedes:           # [[older-note]]   (optional)
superseded_by:        # [[newer-note]]   (optional — set when this note is retired)
domain: []            # self | family | work | arganta | health | learning | money | relationships | decisions | ai-context
tags: []
related: []           # [[wikilinks]]
---
```

---

## `class` — the guardrail (3 values)

| Class | Meaning | Lives in | Citable as truth? |
|---|---|---|---|
| `brainstorm` | ideas, captures, drafts, exploration | `60-CAPTURES/`, any `draft` | **No — never** |
| `operational` | reviewed, load-bearing; the system runs on it | `00-CORE`…`50-PROFESSIONAL` | **Only if `canonical: true`** |
| `reference` | external/source material, provenance | `90-META/_provenance/`, `attachments/` | As a *source*, not as your truth |

**Hard rule:** only `class: operational` **and** `canonical: true` may be treated as truth.

## `status` — lifecycle (app-compatible)

`seed → draft → active → shipped → archived`
- `seed`, `draft` ⇒ always `class: brainstorm`.
- `active`, `shipped` ⇒ `class: operational`.
- `archived` ⇒ retired (superseded or no longer relevant).

## `canonical` + `version` — "is this the latest?"

- Exactly **one** `canonical: true` note per topic. Cutting a new version flips the old to
  `canonical: false` + `superseded_by`.
- **STALE**: a canonical note whose `updated` is older than its freshness window ⇒ still latest,
  but must be re-verified before trusting.

### Freshness windows (when `updated` older than this ⇒ 🕒 STALE)
| type | window |
|---|---|
| `decision`, `strategy`, `spec` | 90 days |
| `note`, `plan`, `research` | 60 days |
| `prompt` | 45 days |
| core (`persona-core`, `mental-model`) | 120 days |

## `product` / `type` / `confidence`

Values as listed in the frontmatter block above — identical to the HQ Vault app so notes load
into it unchanged. `Life` is the vault-only product for personal/family/health notes.

---

## Tags (cross-cutting, `#tag` in body)

- `#inferred` — a guess, not observed. **Required** on anything not evidenced.
- `#known` — observed / sourced.
- `#decision` · `#action` · `#principle` · `#reference` · `#inspiration`
- `#privacy` — sensitive personal/family detail; handle with care.
- `#ip-risk` — third-party material; principle-only, never copy.

## Provenance discipline

Every persona/truth claim carries `#known` / `#inferred`. Every metric carries measured-vs-simulated.
No orphan opinions — a claim with no source is a claim to verify, not to trust.

## Links
- Applied by: [[DIGEST]] · [[CONVENTIONS]]

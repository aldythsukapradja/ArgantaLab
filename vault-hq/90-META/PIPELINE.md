# PIPELINE — from data dump to one truth, shown in two places

> How raw material you hand me becomes a single source of truth that renders identically in
> Obsidian and the HQ Arganta webapp. This is the data contract for the whole system.

---

## The single source of truth

**`vault-hq/*.md` — plain Markdown + YAML frontmatter — is the ONE source of truth.**
Not the app's localStorage. Not a database. The files. Everything else is a *renderer* of them.

```
                       ┌─────────────────────────────┐
   raw data dump  ──►  │   vault-hq/*.md   (SSOT)     │  ──►  Obsidian        (reads natively)
   (you, Claude)       │   markdown + frontmatter    │  ──►  HQ Arganta app  (reads via loader)
                       └─────────────────────────────┘
```

Both readers parse the *same bytes*. Obsidian does it out of the box. The HQ app already ships
the parser (`apps/hq/src/vault/markdown.ts` → `parseFrontmatter` + `normalizeFrontmatter`); it
just needs a loader that points at these files instead of the hardcoded `seed.ts`.

---

## The pipeline, step by step

1. **DUMP** — you paste/attach raw material into a Claude Code web session (screenshot, link,
   note, chat log, article, code, idea).
2. **CAPTURE** — Claude writes it as **one new file** in `60-CAPTURES/_INBOX/`
   (`YYYY-MM-DD-HHMM-slug.md`, `class: brainstorm`, `status: seed`, `canonical: false`).
   Untrusted. Never touches distilled notes. (See [[DIGEST]] §1.)
3. **DISTILL** — the principle is extracted; the source text is not copied. Intent is
   classified (capture/digest/decision/action/repo-context/fable-brief/archive).
4. **HARVEST (human gate)** — you review the inbox in the evening [[daily-loop]] and promote
   keepers: flip to `class: operational`, `status: active`, `canonical: true`, file into the
   right folder per [[DIGEST]] §4. This is the only way raw becomes truth.
5. **STORE** — the note now lives in the SSOT with app-compatible frontmatter + a status badge.
6. **SYNC** — git push (Claude) → git pull (your machine) keeps the files identical everywhere.
   Disjoint write domains keep it conflict-free: Claude writes only `60-CAPTURES/`, you edit the
   distilled notes. (See the SYNC design.)
7. **DISPLAY** — Obsidian renders the vault + graph; the HQ app renders the same notes in its
   GraphView / DecisionsView. One truth, two windows.

---

## Why the same bytes render in both

The frontmatter schema ([[TAXONOMY]]) is deliberately a **superset** of what the HQ app validates:

| Field | Obsidian | HQ app (`normalizeFrontmatter`) |
|---|---|---|
| `title, product, type, status, tags, updated, owner, confidence` | shown as properties | **validated + used** (graph color, filters, inspector) |
| `class, canonical, version, domain, related, supersedes` | shown as properties / links | **preserved untouched** (ignored today, ready for the guardrail UI) |

Nothing in our schema breaks the app parser; nothing the app needs is missing. That's the
contract that lets one file serve both.

### Known coercions (honest gaps)
- `product: Life` isn't in the app's enum → the app defaults it to `HQ`. Use `Life` only for
  personal/family/health notes you don't need mirrored in the app, or add `Life` to the app enum.
- `type: capture` isn't in the app's enum → defaults to `note`. Fine (captures aren't promoted anyway).

---

## The one piece of code still to build (the bridge)

To make the app read the SSOT instead of `seed.ts`, a **loader** is needed — the app *reader*,
not new truth:

- **Option A (build-time):** a script globs `vault-hq/**/*.md`, runs each through the app's own
  `parseFrontmatter` + `normalizeFrontmatter`, and emits the notes map the app boots from.
  Deterministic; the app ships with the vault baked in at build.
- **Option B (runtime import):** an "Import vault folder" action reads the `.md` files into
  localStorage on demand. Good for live editing without a rebuild.

Recommended: **A** for canonical builds, **B** later for live edit. Until then, `seed.ts` and
`vault-hq/` are two copies — the folder is the source, the seed is a stale mirror.

---

## Links
- Rules: [[DIGEST]] · [[TAXONOMY]] · [[CONVENTIONS]]
- Entry: [[HOME]]

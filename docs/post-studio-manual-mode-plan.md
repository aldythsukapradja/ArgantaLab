# Post Studio — Manual Mode + Style Recipe

**Status: BUILT + verified (M1–M5), 2026-07-16.** Conceived and shipped same day.
No migration to run — `docJson` rides inside the existing `content_draft.copy`
jsonb, the same trick `brandId` already used.

## What shipped

| Step | What | Where |
|---|---|---|
| M1 | Compose / Style / Post tabs replace the 9-panel scroll | `PostStudio.tsx`, `post.css` |
| M2 | Compose form bound to named layers | `compose.ts` |
| M3 | Style Recipe save/apply/copy/import | `postStyle.ts` |
| M4 | Verbatim `docJson` draft channel | `contentDrafts.ts`, `PostStudio.tsx`, MCP `core.ts`/`tools.ts` |
| M5 | `/post-batch` command | `.claude/commands/post-batch.md` |

Verified live in the browser (hq-offline): the form reads the starter doc's real
layers, writes them back through the alias list (`Headline`/`Subline`), toggles
add/remove the right layers, recipes extract to `{title}`/`{body}`/`{pill1}` with
the handle correctly left literal, and `fillStyle` round-trips with no unfilled
slots leaking.

**Known behavior (by design):** a row's `image` only lands if the recipe has an
image layer on that slide. A style saved from an image-less slide has no
`{image}` slot, so image data for it is ignored — the design wins over the row.

---

## Original concept (below, for the reasoning)

## The problem (why the right drawer feels unintuitive)

The inspector in `apps/hq/src/surfaces/broadcast/PostStudio.tsx` is nine panels stacked
in one fixed scroll, and they mix four different *scopes* with no visual separation:

| Panel | Scope |
|---|---|
| Layout templates | this slide |
| Look (palette / bg variant / grain) | whole post + this slide, mixed |
| Text (add headline/body/badge) | this slide |
| Elements (pager/swipe/brand/divider) | this slide |
| Stickers | this slide |
| Media (generate/upload/stock) | this slide |
| IG-ready checklist | whole post |
| Caption + platform | whole post |
| Layers + **Layer properties (appears/disappears)** | this slide / selected layer |
| Brand name/handle | whole post |

Pain points:
1. **The manual essentials are buried.** The core manual loop — *upload an image, set
   the title, add a pill, add the swipe arrow, place the logo* — is spread across four
   panels in the middle/bottom of the stack, below templates and palettes you may not touch.
2. **Layer properties jump around.** Selecting a layer injects a panel mid-stack; deselect
   and the drawer reflows. You never build muscle memory for where things are.
3. **"Add" ≠ "edit".** Panels only *add* new layers; editing what's already on the slide
   requires knowing to click the layer first (on canvas or in the Layers list).
4. **No scope signal.** Nothing tells you which controls change one slide vs. the whole post.

## The concept — three pieces

### 1. Tabbed inspector: **Compose · Style · Post**

Replace the single scroll with three tabs (state only — same patch functions underneath):

- **Compose** (default, the manual mode) — a *form for this slide*, not a layer toolbox.
- **Style** — templates, palette, bg variant/grain/vignette, brand picker, stickers,
  the Layers list + selected-layer properties (the power-user stuff, out of the way).
- **Post** — caption, hashtags, alt, platform rules, IG checklist, brand name/handle,
  Drafts/publish helpers. Everything whole-post lives here and only here.

### 2. Compose tab = the "simple manual" form

One card, always the same shape, bound to *named layers* on the current slide
(Headline / Body / Badge / Pager / Swipe / Brand / bg image — the engine already names
layers this way, see `slideContent()`; Compose reads/writes them by name, creating the
layer on first edit and deleting it when cleared/toggled off):

```
┌ Compose — slide 2/5 ─────────────────┐
│ [ 🖼  Upload image ]  [ library ▾ ]   │  ← bg image slot, drag-drop target
│   darken ▂▂▂▂▂▃                       │
│ Title      [ Big headline……        ] │  ← text input, live on canvas
│ Subtitle   [ supporting line       ] │
│ Pills      [NEW ×] [TIPS ×] [+ pill] │  ← chip editor → badge layers
│ Toggles    ◉ logo ◉ handle ◉ swipe   │
│            ◯ pager dots              │
│ Quick size  title ▂▂▃  A- A+         │
└──────────────────────────────────────┘
```

Everything is edit-in-place: typing in Title edits the existing Headline layer; the
Upload button is the first thing you see. No layer concepts needed for the 90% path.
Export/Publish stays in the top bar unchanged — manual posts flow to Moment/Buffer/PNG
exactly like AI ones.

### 3. Style Recipe — the handoff-to-Claude artifact

A **PostStyle recipe** = a `PostDoc` with the *content stripped out and slots marked*:
format, palette, brandId, per-slide template id, every layer's styling (position, size,
font, weight, color, highlight, pill style, dim, toggles) — but text/images replaced by
slot names (`{title}`, `{body}`, `{image}`, `{pills}`).

- **"Save style" button** (Style tab): serializes the current doc → recipe JSON, copies
  to clipboard and/or saves to a `post_styles` list (localStorage first, Supabase later).
- **"Apply style"**: the inverse — pour a recipe over existing content (reuses the
  `slideContent()` keep-the-words mechanics that `applyTemplate` already has).
- **Claude skill `post-batch`** (new, in `.claude/skills/`): given a recipe file + a
  content table (markdown/CSV: title, body, pills, image path/prompt per row), emit one
  `PostDoc` JSON per row and deliver via the existing `content_draft` MCP tool.

**Known gap to close:** today `openDraft()` runs drafts through `coercePost`, which
re-templates copy and *discards exact styling*. The drafts pipeline needs a raw-doc
channel — `ContentDraft.docJson?: PostDoc` that, when present, loads verbatim (images
patched in) and skips `coercePost`. That one field is what makes "Claude replicates my
manual design in batch" pixel-faithful instead of approximate.

## Build order (small, independent)

1. **M1 — Tabs**: split the existing panels into Compose/Style/Post (pure reshuffle, no engine change).
2. **M2 — Compose form**: named-layer binding, pill chip editor, toggles, upload-first image slot.
3. **M3 — Style Recipe**: save/apply recipe, recipe JSON format doc.
4. **M4 — Raw-doc drafts**: `docJson` on ContentDraft (worker + MCP tool + `openDraft` fast path).
5. **M5 — `post-batch` skill**: recipe + content table → drafts inbox.

M1+M2 alone fix the intuitiveness complaint; M3–M5 unlock the batch workflow.

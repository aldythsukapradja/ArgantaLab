# Post Studio v2 — Canvas-first editing + Post Library (handoff plan)

**Status: CONCEPT — batched for execution. 2026-07-16.**
Builds ON TOP of the shipped manual mode (commit `914dfe1e`, see
docs/post-studio-manual-mode-plan.md). Read that first — it defines the tab
structure, `compose.ts` named-layer binding, `postStyle.ts` recipes, and the
verbatim `docJson` draft channel this plan assumes.

## The founder's mental model (design north star)

> **Claude Code generates the first pass. HQ is for manual work or fine-tuning
> — sharpening one element at a time.**

Every feature below serves that: the canvas is the primary editing surface
(not the drawer, not popups), and each refinement action is scoped to ONE
element — one text layer, one image, one slide.

## What's being asked

1. **Direct on-canvas text editing** — no extra popups. The existing inline
   textarea (double-click) stays, but becomes the ONLY text-editing path.
2. **PowerPoint-style floating toolbar** — when a text layer is selected, a
   small toolbar pops up NEXT TO IT on the canvas: font size (on the fly),
   alignment, font selection, weight, color role, highlight style.
3. **Font settings** — a GLOBAL font choice for the whole doc (in Style tab)
   plus per-layer font override in the canvas toolbar.
4. **Dedicated image prompt** — Compose's "Generate" opens a small prompt
   popover scoped to THIS slide's background only, instead of silently reusing
   the media search box.
5. **✦ Polish capsule per text box** — a sparkle button on every text field
   (and the floating toolbar) that sends that ONE text to Arganta Core with a
   polish prompt ("make it polished, fancy, premium") and replaces it in place.
6. **Post Library** — a folder of every finished post: reusable, organized by
   timeline, with metadata (where posted, when), the full doc JSON, and a
   content summary. **Published posts are immutable** — re-saving one always
   creates a NEW entry, never overwrites.

Plus carry-over fixes from the same session (Arganta Core chat, Batch 0).

---

## Batch 0 — Arganta Core chat fixes (Sonnet · small · independent)

Files: `apps/hq/src/surfaces/core/StarterMenu.tsx`, `ThreadsRail.tsx`, `core.css`.

0a. **Broken ✦ Start popover** (see founder screenshot): the pill list clips
    every row ("North star — weekly engaged" etc. are cut off mid-glyph).
    Cause is in `core.css` — `.core-starter-pill` uses `white-space: nowrap`
    with `overflow: hidden` but the pills render taller than their line box
    (descenders clipped). Fix: give pills a proper `line-height`/padding and
    let long prompts ellipsize, not clip vertically. Verify in the browser at
    both desktop and mobile widths — the screenshot was mobile-ish.
0b. **Mobile drawer close button**: in `ThreadsRail` sheet mode there is no
    visible way to dismiss. Add an X button next to the "New chat" (SquarePen)
    button in `.core-rail-head` — `sheet` mode only — wired to `onToggle`.
0c. **Chats grouped by date**: replace the flat list in `ChatsSection` with
    date buckets: Today · Yesterday · This week · This month · Older (the
    Claude/ChatGPT convention). Pinned stays a bucket above all. Small
    sticky-ish section labels, same row component inside.
0d. **Hide the Projects tab** (for now): filter `SECTIONS` to exclude
    `projects`. Keep all the code — one line hides it, founder may want it back.

## Batch 1 — Canvas text toolbar (Opus · the big one)

Files: `PostStudio.tsx`, `postEngine.ts`, `post.css`; new `CanvasTextToolbar.tsx`.

1a. **Selection → floating toolbar.** When `selLayer` is a text layer (or
    badge), render a toolbar `div` absolutely positioned above/below the
    layer's canvas bounds (reuse the `layerBounds` + scale math the inline
    editor already does at `onCanvasDoubleClick`). Flip below when near the
    top edge; clamp inside the stage box; follow the layer during drag
    (re-derive from doc state, don't track pointer).
1b. **Toolbar contents** (PowerPoint muscle memory, one row):
    `A- [72] A+ · B · L C R · font ▾ · color ● ● ● · pill/underline/none · ✦`
    - size stepper + editable number (writes `size`)
    - weight toggle 500/700/800 (writes `weight`)
    - alignment L/C/R (writes `align` + the xN snap the drawer already does)
    - font dropdown (see 1c)
    - color role dots ink/soft/accent
    - highlight cycle none/pill/underline
    - ✦ polish (Batch 3 wires it; render disabled until then)
    Everything writes through the existing `patchLayer` — no new state model.
1c. **Font selection.** Today `PostFont = 'sans'|'serif'|'mono'` maps to
    system stacks inside the engine. Extend the engine with a FONT registry:
    `POST_FONTS: {id, label, stack, display?: url}` — keep the three system
    entries, add ~6 curated display fonts (self-hosted woff2 in
    `apps/hq/public/fonts/`, loaded via `FontFace` + `document.fonts.ready`
    before `drawSlide`; NEVER a Google Fonts link — export must not depend on
    third-party CSS). `TextLayer.font` becomes a font id (old values are valid
    ids, so existing docs migrate for free).
1d. **Global font** (Style tab): `doc.fontId?: string` — the default every
    text layer without an explicit override inherits. Resolution order:
    layer.font if explicitly set ≠ inherited → doc.fontId → brand font →
    'sans'. Recipe extraction (postStyle.ts) must carry doc.fontId + per-layer
    fonts — they're style, byte-for-byte.
1e. **Retire drawer duplication:** once the toolbar ships, the LayerProps text
    controls (size/color/style/font/align sliders) collapse to position-only;
    Compose's title-size slider goes away (the toolbar owns it). Keep
    double-click-to-edit exactly as is — it already satisfies "edit directly
    on the canvas"; the toolbar appears on single-click select.

## Batch 2 — Dedicated image prompt popover (Sonnet · small)

Files: `PostStudio.tsx`, `post.css`.

2a. Compose's Generate button opens a small anchored popover: a textarea
    pre-seeded from the slide's words (the same fallback chain
    `genImageForSlide` uses today), a "Generate for this slide" button, and a
    hint line showing format+palette so the founder knows what rides along.
2b. Submits to the existing `genImageForSlide(overridePrompt)` — the plumbing
    already accepts an override; this just finally gives it a UI. The media
    search box stops double-duty as an image prompt (placeholder reverts to
    'stock search…').
2c. Remember the last prompt per slide (`slide.imagePrompt?: string` on the
    doc — also useful metadata for the Library and for recipes) so "Variant"
    regenerates from the same prompt instead of the words.

## Batch 3 — ✦ Polish capsule (Sonnet · needs Arganta Core client)

Files: `PostStudio.tsx`, `compose.ts` (nothing), `lib/argantaCoreClient.ts`, `post.css`.

3a. A small ✦ capsule on: each Compose text field (Title, Subtitle, each
    pill) and the canvas toolbar. Click → sends THAT text to `generateCopy`
    with a rewrite instruction; result replaces the text in place via the
    existing `setRoleText`/`patchLayer`. Show a subtle busy shimmer on the
    capsule; on failure keep the original + status line.
3b. Default prompt: "Polish this line for a premium social post: keep the
    meaning and length, make it sharper and more premium. Return ONLY the
    rewritten line." Long-press / right side chevron reveals 3 presets:
    Polish · Punchier · Simpler. (No free-text prompt here — that's what the
    Copilot is for.)
3c. Guardrails: single line in, single line out — strip newlines/quotes from
    the response, clamp to ~1.6× original length, never touch other layers.
    Offline (no core): capsule hidden entirely, not disabled — this feature
    doesn't exist without the worker.

## Batch 4 — Post Library (Opus · schema decision, then plumbing)

New files: `apps/hq/src/surfaces/broadcast/postLibrary.ts`, `PostLibrary.tsx`
(a drawer panel or a strip-level button + modal); Supabase
`supabase/migration_post_library.sql`.

4a. **Schema** (`post_library` table — this one DOES need a migration, unlike
    docJson, because it must outlive the browser):
    - `id uuid pk`, `created_at`, `title text` (from slide-1 headline)
    - `doc jsonb` — the full PostDoc, verbatim
    - `summary text` — caption first line + per-slide headlines, generated at
      save time (local string building; Core polish optional later)
    - `meta jsonb` — { format, palette, brandId, slideCount, hashtags }
    - `published jsonb[]` — [{ dest: 'moment'|'buffer'|'feed'|'export',
      label, postId?, at }] — appended by the SAME code paths that publish
      today (doPublishMoment / doPublishBuffer / publishToFeed / doExport)
    - `locked bool` — becomes true on first `published` append
    - RLS: hq_is_operator(), same as content_draft.
4b. **Immutability rule** (the founder's explicit contract): saving over a
    `locked` row is refused at the API layer — `savePost` on a locked id
    INSERTS a new row with `title + ' (v2)'` and returns the new id. The UI
    shows a lock badge on published entries. Local fallback (offline):
    localStorage `hq_post_library_v1`, same shape, same rule.
4c. **Timeline UI**: a Library button in the strip head ("Start over" gets a
    sibling). Opens a panel listing entries newest-first, grouped by date
    (reuse Batch 0c's bucket helper), each row: thumbnail (render slide 1 to
    a small canvas — SlideThumb already does this), title, slide count,
    publish badges (♥ moment / IG buffer / ⬇ export + timestamp), summary on
    hover/expand. Actions: **Open a copy** (loads a cloned doc with fresh ids,
    never the stored one), **Copy JSON**, **Save style from this** (bridges to
    M3 recipes), delete (unlocked rows only).
4d. **Auto-save on publish**: every successful publish path saves-or-appends
    the library entry BEFORE showing its success modal, so "anything that has
    been published" is in the library by construction, not by founder
    discipline. Export counts as a publish destination ('export').

## Batch order & model routing

| Batch | Model | Depends on | Why |
|---|---|---|---|
| 0 Core chat fixes | Sonnet | — | mechanical, well-specified, verifiable in browser |
| 1 Canvas toolbar + fonts | **Opus** | — | engine change (font registry), positioning math, retires drawer controls |
| 2 Image prompt popover | Sonnet | — | tiny; plumbing exists |
| 3 Polish capsule | Sonnet | 1 (toolbar slot) | small; guardrails are spelled out |
| 4 Post Library | **Opus** | — (4d touches publish paths) | schema is load-bearing + immutability contract |

0, 1, 2 can run in parallel sessions; 3 after 1; 4 anytime but its migration
must be run in Supabase before the cloud path works (offline fallback works
immediately).

## Verification (every batch)

Use the **hq-offline** launch config (real `hq` sits behind Google auth).
Gotchas: vite may land on a different port than the preview harness proxies —
read preview_logs for the real port and navigate there; read_page/screenshot
hit the 0x0 preview-pane readback bug — drive and read the DOM with
javascript_tool instead. Typecheck `apps/hq` AND `tools/arganta-core-mcp`.
Commit to **main** only.

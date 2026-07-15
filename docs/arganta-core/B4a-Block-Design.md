---
title: B4a — portable block library design system + full block specs
date: 2026-07-15
category: Design
status: design frozen — exemplars in docs/arganta-core/blocks/; Sonnet completes via /build-portable-blocks
tags: [arganta-core, fable, builder, blocks, b4a, b4b]
---

# B4a — the portable block design system

Blocks are what make a founder-generated app look like a product, not a
wireframe. This doc freezes the **theming contract**, the **scoping
convention**, and the **per-block design spec** for all 19 blocks. Three
exemplar blocks in `docs/arganta-core/blocks/` are fully built and set the
quality bar; `/build-portable-blocks` (Sonnet) builds the rest to these specs
and wires the B4b registry.

Ground truth this is built against (verified in repo):
- `packages/builder/src/components.js` — frozen `PortableComponent` shape,
  the 11 `COMPONENT_CATEGORIES`, `isValidComponent`, `selectComponents`.
- `packages/builder/src/validate.js` — every block must pass the security
  checks when assembled (no eval, no parent access, approved hosts only —
  blocks use ZERO external hosts anyway).
- `apps/hq/src/surfaces/studios/engines.ts` `makeBrand()` — the real
  `BrandKit` the variables mirror.

## 1. Theming contract — the `--brand-*` variables (frozen)

Exactly seven variables, mirroring `makeBrand()`'s output 1:1 so `apply_brand`
is a trivial `:root` block with zero translation:

```css
:root {
  --brand-bg:        /* BrandKit.colors.bg     — page background */
  --brand-mid:       /* BrandKit.colors.mid    — secondary surface / chart series 2 */
  --brand-accent:    /* BrandKit.colors.accent — CTAs, links, chart series 1 */
  --brand-ink:       /* BrandKit.colors.ink    — text on bg */
  --brand-paper:     /* BrandKit.colors.paper  — text/surfaces on accent */
  --brand-font-head: /* BrandKit.fonts.head */
  --brand-font-body: /* BrandKit.fonts.body */
}
```

**Rules:**
- Blocks reference ONLY these seven — never a raw hex except inside a
  `var(--brand-*, fallback)` default. Every `var()` carries a fallback (the
  "Nocturne" values below) so a block previews correctly standalone.
- All tints/borders/shadows are derived, never new colors:
  `color-mix(in srgb, var(--brand-ink) 12%, transparent)` for hairlines,
  `…8%…` for soft fills, `…55%…` for muted text. Accent tints likewise from
  `--brand-accent`.
- Fallback kit ("Nocturne", tuned for contrast): bg `#12101f` · mid `#2a2450`
  · accent `#8b7bff` · ink `#f4f2ff` · paper `#ffffff` · head
  `Georgia, serif` · body `system-ui, sans-serif`.
- Contrast duty: text is always `--brand-ink` on bg/mid or `--brand-bg` on
  accent — never accent-on-mid or other unguaranteed pairs.

## 2. Scoping convention (frozen — assembly-safety)

Blocks get concatenated into ONE HTML file. Therefore:

- **Root class per block:** the outermost element is
  `<section class="blk blk-<id>">` (nav/footer may use `<nav>`/`<footer>`).
  Every CSS selector starts with `.blk-<id>` — zero bare-element or generic
  class selectors. Shared conventions (spacing etc.) are *repeated per block*,
  not hoisted; standalone-ness beats DRY here.
- **No `id` attributes** except ARIA-required relationships, and those must be
  suffixed `-<id>` (e.g. `for="field-email-blk-form-modal"`).
- **JS is one IIFE** that does
  `document.querySelectorAll('.blk-<id>')` and wires each instance from its
  own subtree only. No globals, no `window.*` writes, no `eval`, no
  parent/top access, idempotent if run twice (guard with a `data-wired` attr).
- **Zero external requests.** No CDN, no fonts, no images — icons are inline
  SVG, imagery is CSS/SVG placeholders slots.

## 3. Shared design language (applied inside every block)

- **Spacing:** 8px scale (8/16/24/32/48); section padding
  `clamp(48px, 8vw, 96px) clamp(16px, 5vw, 64px)`.
- **Radius:** 14px cards · 10px inputs/buttons · 999px pills/avatars.
- **Type:** headings `--brand-font-head`, sizes via `clamp()`; body 15–16px
  `--brand-font-body`, line-height 1.55; overline labels 12px uppercase
  `letter-spacing:.14em` at 55% ink.
- **Surfaces:** cards = `color-mix(ink 6%, transparent)` fill + 1px
  `color-mix(ink 12%, transparent)` border. No drop shadows on dark kits —
  borders carry the depth (brand kits are dark-bg today).
- **Interactive:** min 44px touch targets; visible `:focus-visible` ring
  (`2px solid var(--brand-accent)`, offset 2); hover = 4% ink fill shift.
- **Responsive:** mobile-first, single breakpoint `@media (min-width:720px)`
  unless a block genuinely needs two. Must look right at 375 AND 1280.
- **Motion:** transitions ≤ .2s ease-out on hover/expand only; everything
  honors `prefers-reduced-motion`.

## 4. Data seam + empty states (frozen pattern)

- Fillable content carries `data-fill="<slot-name>"` on the element; the
  generator (B2) replaces inner text/attrs. Slot names are documented per
  block in the catalogue.
- Every data-bearing block ships its **empty state in the markup**, shown
  when the container has `data-empty`: a centered glyph (inline SVG), one
  quiet line ("No entries yet"), and — where natural — the action that fills
  it. No fake numbers anywhere: exemplar values live ONLY in the harness's
  filled variant, not in the shipped block markup.

## 5. The 19 blocks — spec table (id → frozen)

| id | category | suitableFor | key design notes | data slots |
|---|---|---|---|---|
| `nav-top` | navigation | both | sticky top bar, brand mark left, ≤4 links, hamburger → full-width sheet below 720px (checkbox-free, JS toggle, `aria-expanded`) | brand-name, links |
| `nav-sidebar` | navigation | application | 232px fixed rail ≥720px, collapses to `nav-bottom`-like bar below; active item = accent tint pill | app-name, items(icon+label) |
| `nav-bottom` | navigation | application | mobile bottom tab bar, 3–5 items, inline SVG icons, safe-area padding, `aria-current` | items |
| `hero-centered` | hero | website | overline + clamp(34px,7vw,64px) head + sub + accent pill CTA; subtle radial accent glow (color-mix, no image) | overline, title, sub, cta |
| `hero-split` | hero | website | text left / media slot right (stacks mobile); media slot = 4:3 rounded panel with inline-SVG placeholder pattern | title, sub, cta, media |
| `feature-grid` | layout | website | 3-up ≥720px / 1-up mobile; icon chip (accent tint) + title + 2-line body | items(icon,title,body) |
| `metric-card` | metric | application | ✅ EXEMPLAR BUILT — overline label, big mono-ish value, delta pill (▲ accent / ▼ 55% ink — never red/green: not in the kit), empty state | label, value, delta |
| `metric-grid` | metric | application | 2×2 mobile / 4-up desktop of metric-card anatomy | items |
| `data-table` | table | application | hairline rows (no zebra), sticky header, right-aligned numerics, <720px: table → stacked label/value cards; empty state | columns, rows |
| `activity-feed` | timeline | application | vertical line + dot per entry, time in 55% ink, newest first; empty state | items(actor,action,time) |
| `kanban` | layout | application | horizontal scroll-snap columns (fixed 280px), count pill per column, cards draggable-LOOKING but v1 static; empty column state | columns(title,cards) |
| `calendar` | layout | application | month grid, 44px cells, today = accent ring, event dots (max 3 + “+n”); mobile: weekday initials | month, events |
| `gallery` | gallery | website | masonry-ish via CSS columns (2/3), items = SVG-placeholder panels with caption overlay on hover/focus | items(media,caption) |
| `chart-line` | chart | application | hand-rolled SVG polyline + area fill (accent 12%), 4 gridlines, hover dot+tooltip via JS, `<title>` a11y; empty state | series, labels |
| `chart-bar` | chart | application | vertical bars, rx 4 tops, accent fill / mid for series 2, value on hover; empty state | series, labels |
| `chart-donut` | chart | both | ✅ EXEMPLAR BUILT — stroke-dasharray segments (accent/mid/ink-tints), center total, legend list, empty state | segments, total-label |
| `form-modal` | form | both | dialog card on ink-8% backdrop, labeled inputs (never placeholder-as-label), accent submit, Esc/backdrop close, focus trap-lite, `role="dialog"` | title, fields, submit |
| `pricing` | pricing | website | 3 tiers (1-up mobile), middle = accent border + "Popular" pill, ✓ list with inline SVG checks | tiers(name,price,features,cta) |
| `testimonials` | layout | website | 2-up cards, oversized serif quote mark in accent, avatar = initials circle (no images) | items(quote,name,role) |
| `footer` | footer | website | ✅ EXEMPLAR BUILT — brand line, 2 link columns, legal row at 55% ink, hairline top | brand, columns, legal |

(Handoff's original list mapped to frozen categories: feature grid/kanban/
calendar/testimonials → `layout`, activity feed → `timeline`; count = 19.)

## 6. Chart design rules (the blocks most likely to go wrong)

- Pure inline SVG, `viewBox` + `preserveAspectRatio`, width 100% — no chart
  libs, no d3.
- Series colors: 1 = `--brand-accent`, 2 = `--brand-mid`, 3 =
  `color-mix(ink 45%, transparent)`. Never more than 3 series — a generated
  dashboard isn't an analytics suite.
- Axis/grid: 4 horizontal gridlines at ink 10%; labels 11px at ink 55%.
- Each chart has `role="img"` + `aria-label` summarizing the data, and a
  visually-hidden data list fallback.
- Data enters as JSON in a `<script type="application/json" data-fill="series">`
  child — the JS reads, scales, renders. Empty/malformed JSON → empty state.

## 7. Deliverable layout

```
docs/arganta-core/blocks/
├── README.md          theming contract + scoping rules (condensed from §1–4)
├── preview.html       harness: all blocks, brand-kit switcher (Nocturne + 2
│                      real PALETTES kits), 375/1280 width toggle,
│                      filled/empty toggle
├── catalogue.md       per block: PortableComponent fields + slot docs
└── <id>.html          one standalone file per block:
                       <!-- meta --> comment (id/name/category/suitableFor/
                       description/tags) + <style> + markup + <script>
```

B4b (Sonnet) parses the meta comment + sections into
`packages/builder/src/registry.js` entries — mechanical, no judgment. A test
runs `isValidComponent` over every entry and assembles all 19 into one
document that must pass `validate.js` with zero errors.

## See also
- [[Fable-Handoff-C4a-B4a]] — the original brief
- [[Single-File-Builder]] — why component assembly is mandatory
- `.claude/commands/build-portable-blocks.md` — the Sonnet execution workflow

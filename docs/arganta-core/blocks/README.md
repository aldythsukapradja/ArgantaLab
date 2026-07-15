# Portable blocks — theming + scoping contract

The blocks the Single-File Builder assembles apps/websites from. Full design
system: `docs/arganta-core/B4a-Block-Design.md`. Frozen shape + selector:
`packages/builder/src/components.js` (B1).

## File anatomy (every `<id>.html` in this folder)

```html
<!--
id / name / category / suitableFor / description / tags   ← registry meta
-->
<style>   ← css field (all selectors under .blk-<id>)
<section class="blk blk-<id>">…</section>   ← html field
<script>  ← optional javascript field (one IIFE, per-instance wiring)
```

Each file opens standalone in a browser and looks right with no brand kit
(every `var()` carries a Nocturne fallback).

## Theming — the seven `--brand-*` variables

Mirrors `makeBrand()`'s BrandKit 1:1. Apply a kit by setting these on `:root`
(or any ancestor) — nothing else is themeable, nothing else is needed:

| Variable | BrandKit source | Used for |
|---|---|---|
| `--brand-bg` | colors.bg | page background |
| `--brand-mid` | colors.mid | secondary surface, chart series 2 |
| `--brand-accent` | colors.accent | CTAs, links, active states, chart series 1 |
| `--brand-ink` | colors.ink | text on bg/mid |
| `--brand-paper` | colors.paper | text on accent |
| `--brand-font-head` | fonts.head | headings, big numbers |
| `--brand-font-body` | fonts.body | everything else |

Every other color in a block is derived via `color-mix()` from these
(hairlines = ink 12%, soft fills = ink 6%, muted text = ink 55%). Blocks never
contain a raw hex outside a `var(…, fallback)` default.

## Assembly-safety rules (why blocks can be concatenated into one file)

1. Root element: `class="blk blk-<id>"`; every CSS selector starts `.blk-<id>`.
2. No `id` attributes except ARIA relationships, suffixed `-blk-<id>`.
3. JS: one IIFE, `querySelectorAll('.blk-<id>')`, per-instance wiring from its
   own subtree, `data-wired` idempotency guard, no globals, no eval, no
   parent/top access.
4. Zero external requests — icons/imagery are inline SVG.
5. Must pass `packages/builder/src/validate.js` security checks when assembled.

## Data seam

- Fillable elements carry `data-fill="<slot>"` — the generator (B2) replaces
  their content. Slots per block: `catalogue.md`.
- Chart data enters as `<script type="application/json" data-fill="…">`.
- Data-bearing blocks ship with `data-empty` set and render their built-in
  empty state; remove the attribute (charts do it themselves on valid data)
  when filled. **No fake numbers in shipped markup — ever.**

## Preview

Open `preview.html` — all blocks, brand-kit switcher, 375/1280 toggle,
filled/empty toggle.

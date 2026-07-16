---
description: Execute B4 completion — build the remaining 16 portable blocks to the frozen B4a design system, the preview harness, and the B4b registry in packages/builder
---

# /build-portable-blocks — B4a completion + B4b registry (Sonnet)

You are completing the portable block library. The design system, per-block
specs, and three exemplar blocks are ALREADY DONE (Fable) — your job is
faithful production of the remaining blocks to those exact specs, the preview
harness, and the mechanical registry wiring. No re-design.

## Read first, fully

1. `docs/arganta-core/B4a-Block-Design.md` — THE spec. §1–4 are the frozen
   system (theming vars, scoping, shared language, data seam); §5 is the
   19-block table with per-block design notes and slots; §6 the chart rules;
   §7 the deliverable layout.
2. `docs/arganta-core/blocks/README.md` — the condensed contract.
3. The three exemplars — study them line by line; they ARE the quality bar
   and the file-anatomy pattern you replicate:
   - `docs/arganta-core/blocks/metric-card.html` (empty-state pattern)
   - `docs/arganta-core/blocks/chart-donut.html` (JSON data seam, SVG chart,
     a11y, idempotent IIFE)
   - `docs/arganta-core/blocks/footer.html` (structural block, link a11y)
4. `packages/builder/src/components.js` — frozen `PortableComponent` shape,
   `COMPONENT_CATEGORIES`, `isValidComponent`, `selectComponents`.
5. `packages/builder/src/validate.js` — the security/quality gate assembled
   blocks must pass.

## Hard rules

- Only the seven `--brand-*` variables; every `var()` carries its Nocturne
  fallback; all other colors via `color-mix()`. Zero raw hex outside
  fallbacks (grep-checkable).
- Every CSS selector starts with `.blk-<id>`; JS per §2 of the spec
  (IIFE, per-instance, `data-wired` guard, no globals/eval/parent access).
- Zero external requests. Inline SVG only.
- No fake data in shipped markup — `data-empty` + built-in empty states for
  every data-bearing block. Filled examples live ONLY in the harness.
- 44px touch targets, `:focus-visible` rings, labeled controls,
  `prefers-reduced-motion` honored, works at 375 AND 1280.
- Category values must be from `COMPONENT_CATEGORIES` exactly as mapped in
  spec §5 (kanban/calendar/feature-grid/testimonials = `layout`,
  activity-feed = `timeline`).
- Commits to **main** only.

## Execution order

**Step 1 — harness first:** `docs/arganta-core/blocks/preview.html` —
renders every block file (fetch + inject, or build-inline), brand-kit
switcher (Nocturne fallback + 2 kits derived from real `PALETTES` values),
375/1280 width toggle (iframe), filled/empty toggle that populates
`data-fill` slots with realistic sample content and valid chart JSON.
Verify the three exemplars render in it, both kits, both widths.

**Step 2 — blocks, category order** (structural→simple→complex; verify each
in the harness at both widths + both kits + filled/empty before the next):
1. `nav-top`, `nav-sidebar`, `nav-bottom`
2. `hero-centered`, `hero-split`
3. `feature-grid`, `metric-grid`, `data-table`, `activity-feed`, `gallery`,
   `testimonials`, `pricing`
4. `kanban`, `calendar`, `form-modal`
5. `chart-line`, `chart-bar` (follow chart-donut's pattern + spec §6)

**Step 3 — catalogue:** `docs/arganta-core/blocks/catalogue.md` — per block:
the six registry fields + slot table + empty-state description.

**Step 4 — B4b registry:** `packages/builder/src/registry.js` — a small
build script (`packages/builder/scripts/build-registry.js`, run via
`npm run blocks:build` in the package) parses each block file's meta comment
+ `<style>`/markup/`<script>` sections into `PortableComponent` entries and
writes `registry.js` (generated, with AUTO markers). Export
`PORTABLE_REGISTRY` from `index.js`.

**Step 5 — tests** (`packages/builder/test/registry.test.js`):
- all 19 entries pass `isValidComponent`
- ids/categories match spec §5 exactly
- no block html/css/js contains an external URL, `eval(`, or parent access
- all 19 assembled into one document (styles+markup+scripts concatenated
  inside a minimal `<!doctype html>` shell) passes `validateArtifact` from
  `validate.js` with zero errors
- `selectComponents` sanity: a "dashboard with charts and a kanban" brief
  (kind application) returns chart + kanban blocks
- Run the full package test suite; all existing tests stay green.

## Definition of done — prove every line

- [ ] 19 block files, each opens standalone and looks right with no kit
- [ ] Harness screenshot set: 375 + 1280, two kits, filled + empty
- [ ] `grep -E '#[0-9a-fA-F]{3,6}' <block>.html` hits only var() fallbacks
- [ ] Registry builds; all tests green (paste output)
- [ ] Assembled 19-block document passes validate.js with zero errors
- [ ] Keyboard pass: nav-top hamburger, form-modal (Esc/backdrop/focus), kanban scroll, chart segment focus

Then update `docs/arganta-core/Arganta-Core-Concept.md`'s B-batch table:
B4 → ✅ SHIPPED, and add a line to `Single-File-Builder.md`'s grounded table.

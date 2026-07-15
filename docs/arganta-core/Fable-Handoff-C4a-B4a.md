---
title: Fable handoff — C4a design language + B4a portable blocks
date: 2026-07-15
category: Design
status: ready to start — no dependency on C3/B1-B3
tags: [arganta-core, fable, design, handoff]
---

# Fable handoff — C4a + B4a

Both batches are **pure design work with no runtime dependency** — they don't
touch `@arganta/agent`, the loop, or the builder kernel. Safe to do in
parallel with the Sonnet track (B1→B2→B3→C4b). Read
[[Arganta-Core-Concept]] and [[Single-File-Builder]] first for the product
context; this note is the actionable brief.

## C4a — the design language for Arganta Core's chat surface

**Brief:** "your own ChatGPT, more polished, more fancier" — but Arganta-native,
not a reskin. Analog = ChatGPT / Claude Code / Codex chat. The founder's
explicit mobile rule (frozen in `@arganta/agent/embed.js`, do not violate it):
**on mobile, the chat is full-screen and covers the bottom nav bar entirely.**

Deliver as a design spec (motion timing, states, copy) — NOT React code. C4b
(Sonnet) implements it against the real theme tokens in
`apps/hq/src/theme.css` (`--bg/--tx/--bd/--acc/--stage/--r-*` etc — the SAME
tokens every other HQ surface uses; inventing new ones broke dark mode once
already this session, see [[../adr/0001-four-tier-llm-router]] lessons).

### What to design

1. **The reactor orb as conversation avatar.** Reuse `CoreSlot`
   (`apps/hq/src/reactor/CoreSlot.tsx`) — don't invent a new avatar system.
   Map orb states to the loop's real lifecycle: `idle` (waiting for input) →
   `thinking` (model call in flight — and per C3's live test, this can last
   15-40+ seconds on the free tier, so the idle/thinking transition needs a
   design that reads as "working," not "stuck," over a LONG wait) →
   `tool-running` (a specific tool executing — maybe a distinct pulse per tool
   category: image/voice/data) → `speaking` (streaming the reply).
2. **Message choreography.** How a message with a tool-trail + rich block
   (image/audio/chart/website preview) enters — the trail line
   (`→ generate_image · cloudflare-flux · 4.1s`) should read as "showing its
   work," not clutter. Design the trail as collapsed-by-default with an
   expand affordance, or always-visible-but-quiet — your call, but justify it.
3. **The artifact preview card.** One card design that renders EVERY block
   kind from `@arganta/agent/thread.js` (`image, audio, website, deck, brand,
   chart`) consistently — same corner radius, same provenance chip placement
   (provider · cost · saved✓), same accept/reject affordance pattern already
   proven in Model Rack's run-detail popup (`apps/hq/src/surfaces/rack/
   ModelRack.tsx` — reuse that visual language, don't reinvent).
4. **Empty states + microcopy.** First-open, no-threads-yet, thinking-too-long
   (given the 15-40s finding, a "still working…" secondary state after ~8s
   matters), tool-failed-honestly (never hide a failure behind cheerful copy).
5. **Mobile fullscreen mount.** Design the transition INTO fullscreen
   (opening Core from wherever it's launched) and the close affordance that
   works with a covered nav bar (a visible back/close control, not reliance on
   the hidden system nav). Verify your design against `Z_LAYERS.CORE_FULLSCREEN
   > Z_LAYERS.COPILOT > Z_LAYERS.APP_NAV` (`embed.js`) — Core must visually sit
   above the floating copilot orb too, not just the nav.

### Constraints (non-negotiable, already decided)
- Real theme tokens only (`apps/hq/src/theme.css`), light + dark both.
- No inventing new component patterns where Model Rack / Media Center already
  established one (provenance chips, tier pills, drawer/rail patterns).
- The orb is `CoreSlot`, not a new avatar.

### Deliverable
A design note (markdown + inline SVG/mockup as needed, or a visualize-tool
artifact) covering the 5 items above, specific enough that C4b can build
against it without re-deciding anything.

---

## B4a — the portable component block library

**Brief:** 15-20 self-contained HTML/CSS(/JS) blocks the Single-File Builder
assembles websites and apps FROM — the mitigation for the output-token-ceiling
problem (`docs/arganta-core/Single-File-Builder.md` §"component-assembly
generation is mandatory"). Each block must be genuinely standalone: valid
inside a sandboxed iframe, no external dependencies beyond an approved
allowlist, no build step.

### The list (from the strategy doc, unchanged — build these)
Navigation: mobile top nav, desktop sidebar, mobile bottom nav.
Hero: centered hero, split hero.
Content: feature grid, metric card, metric grid, data table, activity feed,
kanban board, calendar view, gallery.
Charts: line chart, bar chart, donut chart (SVG-based, no chart.js dependency
— matches the zero-external-dep constraint; d3-shape primitives are fine if
truly needed, but prefer hand-rolled SVG for a block this small).
Forms/commerce: form modal, pricing grid, testimonials.
Structural: footer.

### Per-block deliverable shape
For each block, produce:
```
{
  id, name, category, suitableFor: ['application'|'website'],
  description, tags,
  html, css, javascript?  // vanilla only — no framework runtime
}
```
This is literally B1's `PortableComponent` contract (Opus freezes the exact
TypeScript shape in B1 — build against the FIELDS above now; B1 will slot your
blocks into `components.ts`'s registry once it lands, no rework expected
since the shape is already specified in the strategy doc verbatim).

### Design constraints (non-negotiable)
- **Theme-able via CSS custom properties**, not hardcoded colors — a generated
  app/website gets a brand kit (`makeBrand()` — palette + font pair) applied
  on top; blocks must accept `--brand-bg/--brand-accent/--brand-ink` style
  variables rather than baking in fixed hex values. (Different constraint from
  the visualize-tool artifact design system — these blocks live in FOUNDER-
  generated artifacts, not in this chat, so they don't inherit `--surface-*`
  tokens; define your own small variable contract and document it in the
  deliverable.)
- **Mobile-first, responsive**, works at 375px and 1280px both.
- **No placeholder-as-real-data.** A metric card block ships with an empty
  state, not a fake "$12,450" that looks live.
- **Accessible**: labeled controls, real touch targets, keyboard-navigable nav.
- Each block should look GOOD standalone (Fable's design judgment is exactly
  why this is B4a not B4-Sonnet) — these are the blocks that make a founder's
  generated app look like a real product, not a wireframe.

### Deliverable
20 files (or one annotated catalogue doc + code blocks — your call on format),
each satisfying the shape above, plus a short README-style note per category
explaining the theming variable contract you chose so B1/B4b's registry
wiring doesn't have to guess.

## See also
- [[Arganta-Core-Concept]] — the six organs, C-batch plan
- [[Single-File-Builder]] — B-batch plan, the component-assembly rationale
- `apps/hq/src/surfaces/rack/ModelRack.tsx` — the provenance-chip/popup visual language to match
- `apps/hq/src/reactor/CoreSlot.tsx` — the existing orb component C4a extends, not replaces

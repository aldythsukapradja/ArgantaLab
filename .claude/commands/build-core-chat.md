---
description: Execute C4b — build the Arganta Core chat surface (ChatGPT/Claude-grade) in apps/hq against the frozen C4a design spec
---

# /build-core-chat — C4b execution (Sonnet)

You are executing **C4b**: the Arganta Core chat UI in `apps/hq`, built
exactly against the frozen design spec. The design decisions are ALREADY MADE
— your job is faithful implementation + verification, not re-design.

## Read these first, fully, before writing any code

1. `docs/arganta-core/C4a-Design-Language.md` — THE spec. §§0–7 are the
   design contract; the "C4b — end-to-end execution workflow" section is your
   step list. Follow the steps in order; each ends with a browser
   verification and a commit to **main** (founder rule: never feature
   branches).
2. `packages/agent/src/embed.js` — mount contract. Import `Z_LAYERS`,
   `resolveMountMode`, `MOUNT_MODES`; never hardcode z-indexes or the 640px
   breakpoint.
3. `packages/agent/src/thread.js` — the frozen block kinds your renderer
   switches on.
4. `apps/hq/src/lib/core/index.ts` — the runtime you wire to:
   `createThread`, `loadMessages`, `listRecentThreads`,
   `sendMessage(threadId, text) → {text, blocks, stopReason, costUsd}`.
5. `apps/hq/src/theme.css` — the only styling vocabulary. Zero new hex
   colors in your CSS (final check: `grep '#' core.css` returns nothing).
6. `apps/hq/src/surfaces/rack/ModelRack.tsx` — provenance/feed-row/run-modal
   language you must match, not reinvent.
7. `apps/hq/src/reactor/CoreSlot.tsx` + `reactor/contract.ts` — the orb you
   wrap (2D renderer at avatar size — hard rule).
8. `apps/hq/src/shell/{store.ts,Rail.tsx,Shell.tsx,CommandPalette.tsx}` —
   surface registration pattern.

## Hard rules (violating any of these = the build is wrong)

- Rail placement: `'core'` surface, label "Arganta Core", FIRST item in the
  **Command** group.
- Mobile ≤640px: ALWAYS fullscreen, covering bottom nav AND copilot orb —
  via `resolveMountMode` + `Z_LAYERS`, verified at 375×812.
- Every assistant message shows truthful provenance (tier · model · cost);
  every artifact card carries the chip row. Never render an unlabeled
  artifact. Never rewrite the runtime's honest fallback texts.
- Tool trail: always visible, quiet (spec §3) — no collapse machinery.
- Orb: wrap `CoreSlot`, `renderer='2d'` at 32px avatar size, full state
  machine incl. `thinking-long` (8s), `blocked`, `error`;
  `prefers-reduced-motion` static frames.
- Microcopy: use spec §5 verbatim — copy is design-frozen.
- Blocked-tool card is dismiss-only in v1 — do NOT add a fake approve button.
- Additive runtime changes only: `sendMessage` may gain an optional
  `AbortSignal` param; nothing else in `lib/core` changes.
- Cortex panel v1 = toggle + session cost + tool activity only; no empty
  placeholder sections for future C5/C6 content.

## Execution

Work through Steps 1–9 of the spec's workflow section in order. After each
step: launch the `hq` dev server (launch.json config `hq`), verify in the
browser (light + dark), then commit to main with message
`feat(core): C4b step N — <what>`.

## Definition of done — prove every line

- [ ] Surface opens from rail Command group, command palette, and copilot
- [ ] Live turn: "make me a brand kit" → trail line → brand card w/ chips
- [ ] Live turn producing image / audio / chart cards renders all correctly
- [ ] Accept/discard updates the media_asset accept metric
- [ ] Offline turn shows the runtime's honest no-model text unmodified
- [ ] thinking-long copy appears after 8s on a slow turn
- [ ] Orb cycles all 8 states; static under reduced-motion
- [ ] Mobile 375×812: fullscreen covers nav + copilot; back button exits
- [ ] Keyboard-only pass: switch thread → compose → send → accept card
- [ ] Dark mode sweep clean; `grep '#' apps/hq/src/surfaces/core/core.css` → empty
- [ ] All existing node tests still pass
- [ ] Screenshots attached: desktop w/ image card, mobile fullscreen, dark mode

Report each checked item with its proof (screenshot or output), then update
`docs/arganta-core/Arganta-Core-Concept.md`'s batch table: C4b → ✅ SHIPPED.

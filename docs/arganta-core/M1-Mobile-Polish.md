---
title: M1 — Mobile Polish (Fable spec → Opus runs end to end)
date: 2026-07-16
author: Fable (design) → Opus (implementation, end to end)
status: frozen
---

# M1 · Mobile Polish — Arganta Core chat + Agent orb + Content Builder

Founder brief (2026-07-16, screenshots on file): the mobile chat composer is
**crushed** (the model-picker pill shares the input row and squeezes the
placeholder into a wrapped mess), the overall chat isn't yet Claude/ChatGPT-grade,
the dock's "A" button should be a **wow** visual representing Arganta Core, the
Build tab should default to Content Builder, and Content Builder must be mobile
responsive. **Focus is the mobile view.** Desktop behavior must not regress.

Fable owns this spec; **Opus runs it end to end** (implement → live-verify at
375px and ~820px → docs → commit/push). Opus is the right executor because M1d
touches a **C1-frozen contract file** (see below) — that's an Opus-level call.

Everything below is FROZEN unless physically impossible; deviations get a note
in the commit message.

---

## M1a · Chat composer + chrome — Claude/ChatGPT-grade (≤980px)

### The crush, and the fix
Today `Composer.tsx` renders `.core-composer-field` as ONE row:
`[ModelPicker pill ~167px] [textarea] [mic] [send]`. On 375px the pill eats half
the row. **Fix: a two-row composer card** — the exact ChatGPT/Claude mobile
pattern (input on top, controls rail beneath, one rounded container):

```
╭──────────────────────────────────────────╮
│  Message Arganta Core            (input) │   ← row 1: textarea, full width
│                                          │
│  [● Groq 3.3 ▾]              [mic] [➤]  │   ← row 2: controls rail
╰──────────────────────────────────────────╯
```

Frozen details:
- Container: keep `.core-composer-field` but switch to `flex-direction:column`
  at ≤980px (desktop keeps the current single row — this is a media-query
  restructure, not a rewrite). Radius 22px, border `--bd`, focus ring as today.
- Row 1: the existing auto-grow textarea, `min-height:24px`, padding `14px 16px
  6px`. Placeholder stays `Message Arganta Core…` — it must NEVER wrap.
- Row 2 (`.core-composer-rail`): `display:flex; align-items:center; gap:8px;
  padding:0 10px 10px 10px`.
  - Left: the ModelPicker pill, **compact variant** — dot + short model name
    only, no "Auto · " prefix (when Auto is active, show the resolved model name
    with the dot; the FULL "Auto (recommended)" labeling lives inside the menu).
    `max-width:46%; overflow:hidden; text-overflow:ellipsis`.
  - Spacer, then mic button (unchanged), then send: **36px** round accent
    circle (up from 28px — this is the thumb target).
- ModelPicker menu on ≤980px renders as a **bottom sheet**, not a popover:
  fixed to viewport bottom, `border-radius:18px 18px 0 0`, drag-handle bar
  (36×4px, `--bd2`, centered, 8px top), scrim `color-mix(in srgb, var(--bg) 55%,
  transparent)`, `padding-bottom:calc(12px + env(safe-area-inset-bottom))`,
  z-index above CORE_FULLSCREEN (reuse the CoreHelp overlay's 1200). Same
  options + note content as today.
- **Status row moves off the canvas on mobile.** `.core-status-row`
  (session cost + neuron/Gemini/Groq quota chips) → `display:none` at ≤980px.
  Its content relocates INTO the picker bottom sheet as a final section titled
  `Today's free usage` (three quota lines + session cost line, same
  `useCoreStatus` data — no new fetching). Desktop keeps the row as-is.
  Rationale: ChatGPT/Claude show zero telemetry under the composer; meta
  belongs one tap away, not permanently on screen.
- Composer outer padding: `10px 12px calc(10px + env(safe-area-inset-bottom))`.

### Top bar (fullscreen mount)
Keep the existing `[title ▾sheet] … [?] [X]` structure — it's already right.
Polish only:
- Height 52px, `backdrop-filter:blur(14px)`, background
  `color-mix(in srgb, var(--bg) 82%, transparent)`, hairline bottom border.
- Title 15px/600. Add a 5px chevron-down after the title (it opens the threads
  sheet — today that affordance is invisible).
- X stays top-right (founder-approved), 40px target.

### Conversation body
- Column max-width `680px`, side padding `16px`.
- User bubble: `--acc-soft` bg, radius `18px 18px 4px 18px`, self-end,
  max-width 84%.
- Assistant: flat text (no bubble), 15px/1.6, orb avatar 26px.
- Tool-trail lines: 10.5px mono, single line each, `--tx3`.
- Provenance footer: 10px.
- Starter chips: 2-col grid `gap:8px`, pill height 34px (they already read well
  in the founder's screenshot — keep).

## M1b · The Agent orb — a reactor, not a letter

Replace the flat "A" disc in `MobileNav.tsx` with a **miniature reactor core**,
CSS-only. Do NOT mount CoreSlot/Core2D at this size — `CoreOrb.tsx`'s own header
comment documents why the cockpit scene is illegible small; this is the same
"token-driven small visual" discipline as the 32px chat avatar.

Markup (replaces `.mnav-orb-mark`):
```tsx
<span className="mnav-orb" aria-hidden>
  <span className="mnav-orb-core" />
  <span className="mnav-orb-ring" />
  <span className="mnav-orb-sats"><i/><i/><i/></span>
</span>
```

Frozen visual (theme.css, replacing the current `.mnav-orb` block):
- Well: 58px circle, background `radial-gradient(circle at 50% 38%, #101826, #0a0e16)`,
  raised `margin-top:-26px`, ring `0 0 0 4px var(--bg)` (unchanged knock-out).
- Core: 20px circle, `radial-gradient(circle, #f2fdff 0%, #7fe3ff 45%, #2aa6d6 100%)`,
  glow `0 0 14px 2px rgba(57,198,242,.55)`, breathing scale 1↔1.08 @ 3.2s.
- Ring: 32px, `1.5px solid rgba(57,198,242,.45)`.
- Satellites: a 44px rotating wrapper (`animation: mnav-orbit 9s linear
  infinite`) holding three 5px dots at 120° spacing, colors **#f2b544 (amber),
  #3fd0a4 (teal), #7f77dd (purple)** — the hero orb's product-pod palette, which
  is what makes it read as "Arganta Core" and not a generic spinner.
- Active (`.mnav-agent.on`): core brightens (glow radius ×1.6), orbit speeds to
  4.5s, plus one outer halo ring `1px solid rgba(57,198,242,.3)` at 52px.
- `prefers-reduced-motion`: all animations off; static core + dots.
- The cyan family here is INTENTIONAL and exempt from `--acc` theming — the
  reactor core is cyan in every HQ theme (same as the hero orb). Label "Agent"
  under it keeps `--acc-text`.

## M1c · Build tab default + Content Builder responsive

1. **Default surface**: in `MobileNav.tsx` MGROUPS, move `'broadcast'` to the
   FRONT of the build group's surfaces array (`go(g.surfaces[0])` makes it the
   tap target). Mirror the same reorder in the desktop `Rail.tsx` build group
   ONLY if the rail derives its order from the same list; do not re-sort the
   rail's visual list otherwise.
2. **PostStudio mobile** (`surfaces/broadcast/{PostStudio.tsx,post.css}`) —
   grounded in the real skeleton (`.pbx` grid rows top/main/strip; `.pbx-main`
   = stage + 340px `.pbx-insp`; glass copilot `.pbx-bot` absolute-left 340px;
   existing queries at 900/960 already stack `.pbx-main`). Add a ≤980 block
   (align with the app's dock breakpoint) that delivers:
   - Top bar: hide `.pbx-status`; `.pbx-export` collapses to icon-only 40px
     (keep the aria-label); `.pbx-ghost` buttons keep icons, drop text via a
     `.pbx-ghost span{display:none}` pattern if they have label spans —
     otherwise leave.
   - Stage: `.pbx-stagebox{inset:12px}`.
   - Inspector: `.pbx-insp{max-height:44vh}` (it already becomes a bottom row
     at ≤960) + `-webkit-overflow-scrolling:touch`.
   - Copilot: `.pbx-bot{left:8px; right:8px; top:auto; bottom:8px; width:auto;
     max-height:52%}` and `.pbx-stage--bot .pbx-stagebox{left:12px}` (full-width
     bottom sheet, canvas stays visible above it).
   - Strip: thumbnails ~64px tall, horizontal scroll with
     `scroll-snap-type:x mandatory`.
   - Dock clearance: broadcast is a `content-flush` surface, so the fixed
     `.mnav` overlays it — give `.pbx` (≤980 only)
     `padding-bottom:calc(76px + env(safe-area-inset-bottom))` or margin on
     `.pbx-strip`, whichever keeps the strip fully tappable above the dock.
   - **File-ownership warning**: `PostStudio.tsx` + `post.css` carry the
     parallel content-worker session's UNCOMMITTED edits. Check `git status`
     first. CSS-only changes in `post.css` are safest; if the founder's other
     session has since committed, proceed normally. Stage ONLY your own hunks
     (`git add -p` if needed) — do not scoop up the Buffer/moment work.

## M1d · The stale frozen breakpoint (root cause; Opus's call)

`packages/agent/src/embed.js` — C1-frozen — already promises: *"on mobile the
chat is FULL SCREEN and covers everything, including the bottom nav bar"*, and
its `MOBILE_MAX_WIDTH = 640` comment says *"matches the app's mobile nav"*. The
app's mobile nav moved to **980** (commit 2070d1d2), so the constant no longer
does what its own comment claims: at 641–980 the Core mounts INLINE (threads
rail + convo squeezed side by side, dock visible under it — the founder's
tablet screenshot).

**Decision for Opus to ratify and implement**: raise `MOBILE_MAX_WIDTH` to 980.
This is a value correction that RESTORES the frozen contract's stated intent,
not a contract change. Check `packages/agent/test/embed.test.js` (or wherever
the mount/z-order assertions live) and update the breakpoint fixtures; the
Z_LAYERS ordering assertions must keep passing untouched.

With that done, `.core-fullscreen` covers the dock at every mobile/tablet width
(z 1000 > 100) — verify the dock is genuinely invisible while chatting and
reappears on X.

## Definition of done (verify live, 375px AND ~820px)

- [ ] Composer: placeholder on its own row, never wraps; pill/mic/send on the
      rail; send 36px; nothing crushed at 320px either.
- [ ] Model picker opens as a bottom sheet; quota + session info lives inside
      it; `.core-status-row` gone from under the composer on mobile (still
      present on desktop >980).
- [ ] Dock orb: reactor core + 3 orbiting satellites, breathing glow; faster +
      halo when active; static under reduced-motion; still dead-center.
- [ ] Tap Agent at 375 AND 820 → fullscreen chat covers the dock completely;
      X returns to the origin surface with the dock back.
- [ ] Build tab lands on Content Builder; PostStudio usable at 375px (canvas
      fits, inspector reachable, strip scrolls, export tappable, nothing under
      the dock).
- [ ] `apps/hq` type-checks clean; agent-package tests green after the
      embed.js change; desktop (1100px+) chat and PostStudio unchanged.
- [ ] Commit discipline: stage only owned files; PostStudio per the warning
      above; update `docs/arganta-core/Changelog.md` (the in-app field guide)
      with a dated entry; update founder memory.

---
title: C4a — Arganta Core chat design language + C4b execution workflow
date: 2026-07-15
category: Design
status: spec complete — C4b (Sonnet) executes; no code in this doc is shipped
tags: [arganta-core, fable, design, chat-ui, c4a, c4b]
---

# C4a — the design language for Arganta Core's chat surface

**One line:** ChatGPT/Claude-grade chat, Arganta-native — flat light-first
surfaces, hairline borders, one indigo accent, truthful provenance on every
message, and the reactor orb as a living avatar. Fancier than ChatGPT not by
decoration but by *honesty made visible*: the orb, the tool trail, and the
provenance footers show real work happening on real infrastructure.

**Placement (founder decision 2026-07-15):** new HQ surface `id: 'core'`,
label **"Arganta Core"**, icon `MessageCircle` (lucide), badge `'new'`, in the
rail's **Command** group — first item, above Command and Copilot.

Everything below uses only real tokens from `apps/hq/src/theme.css`
(`--bg/--bg2/--bg3/--canvas/--tx/--tx2/--tx3/--bd/--bd2/--acc/--acc-soft/
--acc-text/--ok/--warn/--bad/--r-*/--dur/--ease/--shadow-*/--stage`), light +
dark both. No new color values. No new component patterns where Model Rack /
Media Center already set one.

---

## 0. Layout skeleton

Desktop (`inline` mount, edge-to-edge workspace like `rack`):

```
┌──────────┬──────────────────────────────┬───────────┐
│ Threads   │  Conversation                │  Cortex    │
│ rail      │  (max-width 760px, centered) │  panel     │
│ 248px     │                              │  300px     │
│ bg2,      │  canvas bg                   │  collapsed │
│ bd right  │                              │  by default│
└──────────┴──────────────────────────────┴───────────┘
             composer pinned bottom, same 760px column
```

- Conversation column: `max-width: 760px; margin: 0 auto` — the ChatGPT
  reading measure. Background `var(--canvas)`.
- Threads rail: `var(--bg2)`, `border-right: 1px solid var(--bd)` — the same
  anatomy as the HQ rail and Media Center drawer. Collapsible (chevron in its
  header) to an icon strip on narrow desktop.
- Cortex panel (right): collapsed by default into a thin toggle tab; v1 ships
  the toggle + cost ticker + tool-activity list only (region activation and
  recalled-memory cards arrive with C5/C6 — do NOT build empty placeholders).
- `panel` mount: conversation + composer only (no threads rail, no cortex),
  width 420px, slide-over from the right, `var(--shadow-lg)`.
- `fullscreen` (mobile): see §6.

## 1. Motion token scale (extends theme.css)

Add to `:root` in `theme.css` — the ONLY additions this spec makes to it:

```css
--dur-med:.28s;              /* panel slides, card entry */
--dur-slow:.5s;              /* fullscreen mount, orb state cross-fade */
--breathe:2.8s;              /* orb idle/thinking breathing loop */
--ease-out:cubic-bezier(0,0,.2,1);   /* entries */
--ease-in:cubic-bezier(.4,0,1,1);    /* exits */
```

Rules: entries use `--ease-out`, exits `--ease-in`, in-place state changes the
existing `--ease`. Under `prefers-reduced-motion: reduce` every looping
animation stops (orb holds a static frame per state, §2) and entries become
opacity-only fades at `--dur`.

## 2. The orb avatar

**Component: `CoreOrb` — a thin wrapper around `CoreSlot`, never a new
avatar system.** Two sizes:

- **Avatar size (32px, next to each assistant message + in the composer
  status row):** ALWAYS `renderer='2d'` (Core2D). Running the R3F WebGL core
  per message is a battery/perf bug, not a nicety — hard rule.
- **Hero size (96px, empty-state centerpiece only, one instance max):**
  `renderer='r3f'` allowed on desktop, `'2d'` on mobile or
  `prefers-reduced-motion`.

### State machine (maps the REAL loop lifecycle, incl. states the handoff missed)

`CoreOrb` takes a simple `orbState` prop; the wrapper translates it to a
`SceneState` (CoreSlot's actual contract). Mapping table — C4b implements
exactly this, no re-deciding:

| orbState | Trigger (from `sendMessage` lifecycle) | SceneState `sceneId` | Visual (2D) | Static frame (reduced-motion) |
|---|---|---|---|---|
| `idle` | no request in flight | `idle` (reuse `IDLE_SCENE`) | slow breathe, ~4% scale, `--breathe` loop | full opacity, no ring |
| `listening` | composer mic active | `idle` + faster pulse | ring pulses to mic input level (reuse copilot mic's level signal) | steady ring, `--acc` |
| `thinking` | `callModel` in flight | `idle`, elevated energy | breathe at 2× rate + slow hue shimmer on the accent ring | ring at 60% opacity |
| `thinking-long` | thinking > 8s (free Llama runs 15–40s) | same | adds an orbiting satellite dot (progress-without-progress) + microcopy line (§5) | ring + static dot |
| `tool-running` | `executeTool` in flight | `idle`, category tint | ring color per category: media `--acc` · data `--tl` · office `--mag` | tinted ring |
| `speaking` | reply streaming/rendering | `idle` | crisp pulse synced to text reveal cadence | full ring |
| `blocked` | loop trail `blocked: true, needsApproval` | `idle`, dimmed | ring turns `--warn`, breathe stops — deliberate stillness | `--warn` ring |
| `error` | `stopReason: 'error' \| 'no-model'` | `idle`, dimmed | ring `--bad`, single fade, then rests | `--bad` ring |

State transitions cross-fade over `--dur-slow`. **The long-wait design rule:**
`thinking` must read as *working, not stuck* — motion never freezes, and the
`thinking-long` escalation at 8s adds a visible change so a 40s wait shows two
distinct phases, not one endless spinner.

## 3. Message choreography

- **User messages:** right-aligned bubble, `var(--acc-soft)` bg,
  `var(--acc-text)` text, `--r-lg` radius, max 85% column width. No avatar.
- **Assistant messages:** full column width, no bubble — plain text on canvas
  (the Claude pattern), 32px `CoreOrb` avatar top-left, gap 12px. Entry:
  translateY(6px)→0 + fade, `--dur-med --ease-out`.
- **Streaming/reveal:** v1's `sendMessage` returns whole turns (no token
  streaming yet), so design the reveal as a fast word-cadence typewriter over
  the final text — cap total reveal at 1.2s regardless of length (never make
  the founder wait twice). When real streaming lands, the same reveal renders
  live tokens. Skippable: click anywhere on the message → snap to full.
- **Tool trail — decision: always-visible-but-quiet.** Justification: the
  trail IS the product's honesty ("shows its work"); collapsing it hides the
  differentiator, and trails are short (maxSteps 4). Each `tool-trail` block
  renders as one 12px `--mono` line in `var(--tx3)`:
  `→ generate_image · cloudflare-flux · $0.0000 · 4.1s ✓`
  (failure: `✗` in `var(--bad)`, never hidden). Trail lines appear ONE AT A
  TIME as tools actually run (during the turn they render live above the
  thinking indicator), each fading in at `--dur`. Hover reveals args summary
  in a `title` tooltip. No expand/collapse machinery in v1.
- **Delegation blocks** (`consult_office`): same trail line style, prefixed
  with the office glyph, e.g. `→ consult_office · CFO · $0.0002 · 2.3s ✓`.

### Provenance footer (every assistant message, not just cards)

The truthfulness contract applies to plain text replies too. Bottom of every
assistant message, one quiet row (11px, `var(--tx3)`, `--mono` for numbers),
reusing Model Rack's feed-row vocabulary exactly:

`sponsored · llama-3.3-70b · $0.0000` — plus `📎 saved` when any block
persisted, and the stop reason ONLY when abnormal
(`· stopped: budget` in `var(--warn)`).

## 4. The artifact card

One card component renders all six media block kinds (`image, audio, website,
deck, brand, chart`) — same skeleton, kind-specific body:

```
┌─────────────────────────────── --r-lg, --bg, 1px --bd2, --shadow-sm ┐
│  [body — kind-specific, 16:10 max, --bg3 while loading]             │
│──────────────────────────────────────────── hairline --bd ──────────│
│  ◉ cloudflare-flux · $0.0000 · ✓ saved      [Accept] [Discard] [⤢] │
└──────────────────────────────────────────────────────────────────────┘
```

- **Body per kind:** `image` — the image, click → lightbox. `audio` — play
  button + karaoke-highlight transcript line (reuse `apps/hq/src/lib/karaoke`).
  `website`/`deck` — sandboxed `iframe srcDoc` scaled preview (reuse
  `DeviceCanvas`'s sandbox attrs: `allow-scripts allow-same-origin`),
  click ⤢ → full device preview. `brand` — palette swatch strip + font-pair
  specimen ("Ag" in head/body). `chart` — the SVG chart itself.
- **Provenance chip row:** identical vocabulary to Model Rack's run modal
  (`✓ saved to Supabase` / `⚠ no saved artifact`). Never render a card
  without its chip row — an unlabeled artifact violates the conscience.
- **Accept / Discard:** quiet text buttons (`--acc-text` / `--tx3`) wired to
  the existing accept/reject metric on `media_asset`. Accepted state: chip row
  gains `✓ accepted` in `--ok`, buttons disappear.
- Card entry: after its trail line, scale .98→1 + fade, `--dur-med`.

### Blocked/needs-approval card (the trust-critical one)

When the loop blocks a tool (`needsApproval`), render a distinct inline card:
`--warn-bg` tint bar on the left edge, orb in `blocked` state, copy per §5,
and (v1) a single **"Understood"** dismiss — actual approve-and-resume arrives
with C6/C7; do NOT fake an approve button that can't resume the loop.

## 5. Empty states + microcopy voice

Voice rules: first person, plain, no exclamation marks, never cheerful about
failure, never claims capability it lacks. The orb is the visual; copy stays
short.

| Moment | Copy |
|---|---|
| First open (no threads ever) | Hero orb (96px) + "I'm Arganta Core. I can make images, voice, websites, decks, brand kits and charts — for real, on your own infrastructure." + 4 starter chips (`Make a brand kit for…`, `Chart this week's growth`, `Generate an image of…`, `Draft a landing page`) |
| New thread (threads exist) | Hero orb + "What are we making?" |
| Thinking | trail area shows `thinking…` in `--tx3` |
| Thinking-long (>8s) | "Still working — the free tier is slow, not stuck." |
| Tool failed | "generate_image failed — nothing was made. `<error reason>`" (plain, in the trail line + a text block; never a cheerful retry prompt) |
| Blocked tool | "I need your approval to run `publish_artifact` — I don't do that on my own. Approvals arrive in a later build; for now this action stays parked." |
| No model reachable | surfaces `FALLBACK_TEXT_FOR['no-model']` verbatim — runtime copy is already honest; the UI never rewrites it |
| Thread rail empty search | "No threads match." |

## 6. Mobile fullscreen mount

- `resolveMountMode` already forces fullscreen ≤640px — the UI honors it, no
  media-query re-derivation. Container: `position: fixed; inset: 0;
  z-index: var(--z-core-fullscreen)` where C4b defines
  `--z-core-fullscreen: 1000` FROM `Z_LAYERS.CORE_FULLSCREEN` (import the
  constant; a unit test already guards the ordering).
- **Mount transition:** slide-up from bottom + fade, `--dur-slow --ease-out`
  (the ChatGPT sheet feel). Unmount: reverse at `--dur-med --ease-in`.
- **Close affordance:** persistent top bar (52px, `--bg`, hairline bottom):
  `←` back button (44×44 touch target) left, thread title center, `⋯` menu
  right (rename/delete thread). NEVER rely on system nav — it's covered.
- Threads rail becomes a full-screen sheet opened from the top-bar title tap;
  cortex panel is absent on mobile v1.
- Composer sits above the keyboard (`env(safe-area-inset-bottom)` respected),
  input 16px font (prevents iOS zoom).

## 7. Composer

Single rounded field (`--r-xl`, `--bg`, 1px `--bd2`, focus ring
`--acc-soft`), pinned bottom of the column with a canvas-fade gradient above.
Contents, left→right: **tier pill** (reuse Media Center's existing pill;
ceiling = `maxCostClass` prop) · text input (auto-grow to 6 lines, Enter
sends, Shift+Enter newline) · **mic button** (upgrades the copilot mic:
transcribe-into-composer; orb → `listening`) · **send button** (`--acc`
circle, disabled at empty). During a turn the send button becomes a **stop**
square (aborts the loop client-side, keeps completed trail lines). Below the
field: session cost ticker, 11px `--tx3` `--mono`: `session · $0.0003 · 4 runs`.

---

# C4b — end-to-end execution workflow (Sonnet)

Run via `/build-core-chat` (see `.claude/commands/build-core-chat.md`).
Steps are ordered so the surface is demoable from step 3 onward; verify in
the browser after every step (launch config `hq`). Commit per step, to main.

**Step 0 — read first (no code):** this doc top to bottom ·
`packages/agent/src/embed.js` + `thread.js` · `apps/hq/src/lib/core/index.ts`
(`sendMessage/createThread/loadMessages/listRecentThreads`) ·
`apps/hq/src/theme.css` · `ModelRack.tsx` feed rows + run modal ·
`reactor/CoreSlot.tsx` + `contract.ts`.

**Step 1 — surface registration + skeleton.** Add `'core'` to `SurfaceId`
(`shell/store.ts`), Rail Command group (first item, `MessageCircle`, badge
`new`), `Shell.tsx` lazy route + add to the edge-to-edge `full` list,
CommandPalette + CopilotControl surface lists. Create
`apps/hq/src/surfaces/core/` with `ArgantaCore.tsx` (implements
`ARGANTA_CORE_PROP_KEYS`, calls `resolveMountMode` on a resize-observed
viewport width), `core.css`, and the three-pane skeleton (§0) with static
placeholders. Add the §1 motion tokens to `theme.css`. Verify: surface opens
light+dark, rail highlights.

**Step 2 — threads rail.** Wire `listRecentThreads`/`createThread`; new-thread
button, active-thread highlight (`--acc-soft`), relative timestamps, search
filter, collapse toggle. Verify against real `core_thread` rows.

**Step 3 — conversation core.** `loadMessages` render + `sendMessage` turn
loop. Message components: user bubble, assistant block renderer switching on
`block.kind` — `text` (typewriter reveal, skippable), `tool-trail` (§3 quiet
line). Provenance footer (§3) from the trail blocks + `costUsd`. Thinking
indicator + 8s `thinking-long` timer. THIS is the milestone step: a real
conversation with real tools end-to-end in the UI. Verify with a live
"make me a brand kit" turn; confirm honest failure copy by testing offline.

**Step 4 — CoreOrb.** `surfaces/core/CoreOrb.tsx` wrapper per §2: size prop,
`renderer='2d'` at 32px, state machine + SceneState mapping table, reduced-
motion static frames. Mount beside assistant messages + hero size in empty
state. Verify each state by scripting the lifecycle (a dev-only state cycler
is fine; remove before commit).

**Step 5 — artifact cards.** One `ArtifactCard` for the six kinds (§4),
karaoke audio playback, iframe previews via the DeviceCanvas sandbox pattern,
accept/discard wired to the existing media_asset accept metric, blocked-tool
card (§4, dismiss-only). Verify: image + audio + website + chart cards from
live turns; chip row matches Model Rack vocabulary exactly.

**Step 6 — composer.** §7 in full: tier pill reuse, auto-grow, Enter/Shift+
Enter, stop button (AbortController through `sendMessage` — add an optional
`signal` param to `sendMessage`; keep the change additive), mic transcribe-
into-composer reusing the copilot mic hook, session cost ticker. Verify.

**Step 7 — empty states + microcopy.** §5 verbatim — copy is design-frozen,
do not rewrite. Starter chips prefill the composer. Verify first-open and
new-thread states.

**Step 8 — mobile fullscreen.** §6: fixed overlay using `Z_LAYERS` import,
slide-up mount, top bar with back/menu, thread sheet, keyboard-safe composer.
Verify at 375×812 (browser resize tool): Core covers HQ nav AND the copilot
orb; close returns cleanly.

**Step 9 — `panel` mount + polish pass.** 420px slide-over variant; then a
full light/dark/mobile/desktop sweep, reduced-motion check, keyboard-only
walkthrough (thread switch → compose → send → accept card). Run the repo's
node tests. Screenshot proof of: desktop conversation with an image card,
mobile fullscreen, dark mode.

**Definition of done:** the §Definition-of-done checklist in the command file
— every item checked with proof, no placeholder cortex content, zero new hex
colors in `core.css` (tokens only — grep for `#` to prove it).

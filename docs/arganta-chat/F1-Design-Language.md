# F1 · Arganta Chat — Design Language (FROZEN)

**Status:** frozen for Opus build. Change requires founder sign-off, same discipline as C4a.
**North star:** *a warm concierge at the kitchen table — never a terminal.*
The app should feel like a beautifully set breakfast table: warm paper, one calm voice,
everything within reach of a thumb. If a screen would look at home in an ops cockpit, it's wrong.

---

## 1 · The one-sentence test

Every screen must survive this: **"Would a tired parent at 6:45am, holding a phone in one hand
and a toddler in the other, know exactly what to do here in under 2 seconds?"**
If a feature needs explanation, it needs redesign.

## 2 · Foundations

### 2.1 Color — "Ember on Starpaper"

Light is the default. Dark follows the OS. Both come from the Arganta v2 BrandDoc verbatim —
no new colors are invented, only tints of the existing seven.

| Token | Light (default) | Dark | Use |
|---|---|---|---|
| `--ground` | `#F2F1EC` Starpaper | `#15161B` Night Loam | page |
| `--ground-2` | `#EBEAE3` (Starpaper −3%) | `#101116` | cards, composer well |
| `--ink` | `#15161B` | `#F2F1EC` | primary text |
| `--ink-soft` | `#3A3D45` | `#C4C9D4` | secondary text |
| `--ember` | `#DCA254` | `#DCA254` | THE accent |
| `--ember-deep` | `#8F6B3C` | `#8F6B3C` | gradient partner |
| `--line` | `rgba(21,22,27,.08)` | `rgba(242,241,236,.08)` | hairlines |

**The Ember Rule:** the ember gradient (`#DCA254→#8F6B3C`, 135°) is reserved for *life* —
the mark, the thinking shimmer, the send button when ready, the active starter card border,
progress rings. It never fills large areas, never colors text longer than a label. One warm
thing per screen. This scarcity is what makes it feel precious.

Semantic: success reuses ember (no green — warmth IS success here); error is ink at full
strength on a `--ground-2` card with an ember retry chip — never red panic.

### 2.2 Type — "letterpress, not dashboard"

- **Display: Fraunces** (self-hosted, weights 500/600, `optical size` axis on). Greeting,
  card titles, About headlines. Soft wonky serif = the family warmth signature.
- **Text/UI: Inter** (400/500/600). Messages, buttons, chips.
- Base **17px/1.6** for all conversation text (parents, phones, low light). Nothing under 13px.
- Scale: 34/26/20 display (Fraunces) · 17 body · 15 chips/meta · 13 timestamps.
- Line length capped at ~62ch. Assistant prose is short by doctrine (§4.3), not by clipping.

### 2.3 Space & shape

- 4px grid. Column max **720px**, centered; identical composition phone→desktop (desktop is
  just the phone layout with air — one design, zero breakpoint personalities).
- Radii: cards 20 · chips 999 · composer 26 · buttons 14. Soft everywhere; sharp corners
  read technical.
- Shadows: one only — `0 2px 16px rgba(21,22,27,.07)` (light) / none in dark (use `--line`).
  No glassmorphism, no borders-plus-shadows.

### 2.4 The mark

Twin Peaks A from `@arganta/brand` (mark.js renders it; never a raster copy). On the Hearth it
sits at 44px above the greeting and **breathes**: opacity 0.85↔1.0, scale 1↔1.015, 4s
ease-in-out loop. While the assistant thinks, the breath quickens to 1.2s. This is the app's
heartbeat — the only permanently animated element.

---

## 3 · The three stages

The app is ONE column that moves through three states. No tabs inside chat, no sidebar, ever.

### 3.1 The Hearth (home)

Top→bottom, vertically centered until content overflows:

1. **Mark** (breathing, 44px).
2. **Greeting** — Fraunces 34px, time-aware and named: *"Good morning, Aldy."* Sub-line
   15px ink-soft, rotates from F4's greeting pool.
3. **The Pulse card** *(the wow + engagement engine)* — one card, full column width, ember
   hairline top border. One Fraunces sentence composed by the router from today's real data:
   *"Swim at 4, Baginda is on a 6-day streak, and the grocery run is tomorrow."* Tapping it
   opens that conversation pre-answered. If no data yet → onboarding variant (F4 §2).
   The Pulse is why the app gets opened daily; it must never show stale or simulated data —
   if the sources are empty, it says something honest and warm instead.
4. **Starter cards** — 2×2 grid (2×3 max), 15px Fraunces titles + 13px sub. Drawn from F3's
   map, *personalized by data presence* (no padel data → no padel card). Tap = the question
   is sent, composer fills and submits — the parent never types on day one.
5. **Composer** (docked, §5).

### 3.2 The Conversation

- Enter animation: hearth content fades 160ms, first message rises in — chat is a
  continuation, not a new place.
- **Parent message:** right-aligned capsule, `--ground-2`, max 80% width, 17px.
- **Assistant message:** full column, no bubble, no avatar rows — a calm page, not a
  transcript. Small breathing mark appears only beside the thinking shimmer.
- **Answer card pattern** (the response language): one short plain sentence → the component
  (chart / calendar strip / progress ring / story card, from F2) inside a `--ground-2` card →
  **refine chips** (≤3, from F3): `This month · Just Baginda · Remind us`. Chips are how
  parents learn the system's depth without prompt-craft.
- **Thinking:** ember shimmer sweeping a 2px underline beneath the mark + the word
  *"Thinking…"* (or F4 variants). No spinners, no model names, no seconds counters.
  Escalation to Tier 2 is invisible — the shimmer just lasts longer.
- **Errors:** ground-2 card, ink text, one honest sentence (F4 §6) + ember `Try again` chip.
  Never a stack trace, never "Error 500".

### 3.3 The Drawer (history)

`Chats` ghost button, top-right. Slides over (right desktop / bottom-sheet mobile), scrim 40%.
Recency groups (Today · This week · Earlier), auto-titled threads, search only after >12
threads exist. Swipe/hover to delete with 5s undo toast. That's all it does.

---

## 4 · Motion & voice doctrine

### 4.1 Three signature motions — and no others
1. **Breath** (mark, §2.4).
2. **Rise** — new cards/messages: translateY 8px→0 + fade, 240ms `cubic-bezier(.2,.8,.2,1)`.
3. **Shimmer** — ember gradient sweep on the thinking underline, 1.4s loop.

Everything else is instant or a 120ms opacity. No parallax, no confetti, no springs.
`prefers-reduced-motion`: breath and shimmer become static ember; rise becomes fade.
**Delight lives in the words and the usefulness, not in particles.**

### 4.2 Zero-jargon lexicon (enforced in code review)

| Never | Always |
|---|---|
| model, LLM, AI, GPT | *(nothing — it's just "Arganta")* |
| prompt, query, input | question, ask |
| generate, inference | make, write, working on it |
| tokens, context, tier | *(never surfaced)* |
| thread, session | chat |
| error, failed, invalid | "I couldn't do that" + what to try |
| sign in with OAuth | Continue with Google |

### 4.3 Answer voice
First sentence answers the question. Hard cap ~3 sentences before a component takes over.
Numbers get context ("that's 2 more than last week"), never raw dumps. Warm, plainspoken,
lightly playful; never chirpy, never apologetic twice.

---

## 5 · Composer

- Docked bottom, `--ground` with top hairline; safe-area padded; stream gets bottom padding
  = composer + safe area (keyboard rule).
- Pill field 26px radius, placeholder rotates from F4 pool (*"Ask about your week…"*).
- **Mic** left inside the field (dictation via the existing landing mic seam) — multitasking
  parents talk. **Send** right: ink circle at rest → ember gradient when text exists.
- No attachment/tool/model buttons at launch. One field, one mic, one send.

## 6 · Gate & About

- **Login:** Kinetik auth shell (gradient glows recolored to ember-on-loam), Arganta mark +
  wordmark, *"The family's second brain"* sub-line, single `Continue with Google`.
  **No tabs.** Kid-domain sessions → full-screen friendly block (F4 §7), auto sign-out.
- **About (public):** pill bar `Company Profile · About · Products · Pitch` in this design
  language; decks open untouched inside. Footer link on the Hearth: *"About Arganta"* — quiet.

## 7 · Accessibility & floor rules

- Contrast: ink/ground 14.9:1 (light) — AAA. Ember is decorative only at small sizes; any
  ember text ≥15px semibold on loam only. Tap targets ≥44px. Full keyboard path.
- All components labeled; charts get one-sentence text alternatives (the answer sentence
  itself doubles as the aria description).
- Performance budget: Hearth interactive <1.5s on a mid phone; fonts subset + preloaded;
  decks stay lazy.

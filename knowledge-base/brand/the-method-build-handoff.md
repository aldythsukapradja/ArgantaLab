---
title: The Method — Build Handoff
product: Circle HQ
type: handoff
status: shipped
version: 1.1
tags: [brand, brand-studio, method, handoff, sonnet]
date: 2026-07-17
owner: Aldyth
implementation_owner: Claude Code (Sonnet)
confidence: high
---
# Build handoff — The Method (Operator tab) + the pill switcher

> **SHIPPED 2026-07-17 (commit e73e52d4).** All M-1..M-5 built and verified live.
> One real bug caught during verification: the ignition effect listed `phase` in
> its own dependency array, so `setPhase('ignition')` re-ran the effect before
> the 2100ms auto-advance timer fired, and the effect's cleanup cancelled that
> very timer — ignition never auto-cleared without a manual click. Fixed with a
> `ignitedRef` ref guard so the effect depends only on `view`. Verified: the
> auto-advance now completes on its own, and it never replays on re-entry.
>
> Also: while verifying, a concurrent session added a third **Doctrine** pill to
> the same `BrandStudio.tsx`/`brand-studio.css`. Those two files are left
> uncommitted here for that session to land; `Method.tsx`, `methodData.ts` and
> `scenes.tsx` (fully mine, unblended) are committed standalone.

**For: Sonnet.** Mechanical and schema-bound; every design decision is already made. The canon's content is [[The Method]] — copy from it, don't rewrite it. Founder verdicts locked 2026-07-17: **cards-only v1** (no expand-to-stage) · **KB doc + code registry**.

## Why this exists

The founder rejected the Operator overlay: *"I still don't like the operator page… I found it useless."* Correct — it answered *"what's missing?"*, a question they already know the answer to. It is replaced by **The Method**: the mental models that govern every design call, each proving itself with live code.

**The audit is not deleted — it is demoted to evidence.** Readiness rings + the platform matrix become the *specimen for Law 08 ("The audit derives")*. The dashboard stops being a page and becomes proof of a law. Do not build a separate audit view.

## M-1 · The pill switcher *(do this first — it's small and reframes the surface)*

`BrandStudio.tsx` gains a top-level view state: `'operator' | 'cinematic'`, **defaulting to `operator`**.

- Pill sits in the HUD immediately after `BRAND SYSTEM`, before the context chip.
- **Operator is first and default** (daily driver). **Cinematic is second** (the show).
- Markup: `<div class="bs-pill"><button class="on">OPERATOR</button><button>CINEMATIC</button></div>`
- Styling: pill container `background: rgba(255,255,255,.04)`, `1px solid var(--bs-line)`, `border-radius: 99px`, `padding: 2px`; buttons `font: 7.5px var(--bs-mono)`, `letter-spacing: .18em`, `color: var(--bs-soft)`, `padding: 4px 14px`, `border-radius: 99px`; active → `background: rgba(34,211,238,.13); color: var(--bs-cyan)`.
- Cinematic renders the existing flight **unchanged** (ignition, lanes, scenes, dots — all of it).
- Retire the `O` keystroke and `.bs-op-btn`; the old `Operator` component and its `.bs-op*` CSS are **deleted** (its content lives on inside Law 08's specimen).
- Ignition: plays once on **first entry to Cinematic**, not on surface mount — an operator opening their reference page every day must not sit through ceremony. Keep it skippable.
- Keyboard: `1`/`2` switch pills. Flight keys (`←→`, `↑`, `Esc`) only bind while Cinematic is active.

## M-2 · The law registry

New `apps/hq/src/surfaces/brand/method.ts` — **data only, no JSX**:

```ts
export type Provenance = 'repo-verified' | 'kb-declared' | 'founder-locked'
export type SpecimenKind =
  | 'mark-data' | 'twin-render' | 'brand-row' | 'audit'          // II
  | 'provenance' | 'readiness-zero' | 'live-post' | 'gap-frame'  // I
  | 'flight' | 'reveal' | 'ignition' | 'reduced'                 // III
  | 'chrome' | 'wavelengths' | 'plate' | 'composition'           // IV
  | 'voice-pair'                                                 // V
export interface Law {
  n: number; title: string; statement: string
  specimen: SpecimenKind
  source: string            // the file that ENFORCES it — the card footnote
  provenance: Provenance
  note?: string             // why 16/17/19/20 are not repo-verified
}
export interface Family { id: string; roman: string; label: string; blurb: string; laws: Law[] }
export const FAMILIES: Family[] = [ /* I Truth · II Determinism · III Motion · IV Surface · V Voice */ ]
export const CREED = ['Make it data.', 'Render it live.', 'Name the gap.', 'Spend boldness once.']
export const METHOD_NOTE = 'the-method'   // vault note id for the "read the canon" link
```

Fill all 20 laws verbatim from [[The Method]] — same numbers, titles, statements, sources, provenance labels. **Do not invent or reword laws.** Laws 16/17/19/20 carry their honest `provenance` and `note`.

## M-3 · The Operator page

Layout, non-scrollable, three columns (see the approved comp):

```
HUD  [pill] [THE METHOD · 20 LAWS] ······ [REGISTRY · LIVE|SEED] [CONTEXT · <BRAND>]
+--------------+--------------------------------+---------------+
| FAMILY SPINE |  LAWS — 2x2 grid of 4 cards    |  REFERENCE    |
| 186px        |  each: n · title · statement   |  232px        |
| I..V + creed |        · specimen · source     |  live tokens  |
+--------------+--------------------------------+---------------+
```

- **Spine**: 5 family buttons (`roman · label · law count`); active = cyan border + tint. Creed pinned to the bottom in mono.
- **Cards**: `.bs-law` — `LAW 05` mono kicker, 15px/600 title, 11.5px muted statement, specimen box (`flex:1`, `rgba(0,0,0,.35)`), source footnote in 6px mono. Footnote hover → cyan. **v1: cards do not expand** — no click handler beyond an optional vault link.
- A single link `READ THE CANON →` opens the `the-method` vault note (`useVault.getState().openNote('the-method'); go('vault')` — the pattern already in `scenes.tsx`).
- **Brand-aware**: specimens use the *currently selected* brand's palette (HUD shows `CONTEXT · ARGANTALAB`). Reuse the existing `--bs-*` re-ink vars.
- Reuse existing tokens/classes; add `.bs-law*`, `.bs-fam*`, `.bs-ref*`, `.bs-pill*` to `brand-studio.css`. Respect `prefers-reduced-motion`.

## M-4 · The specimens *(what makes it a canon, not a poster)*

Each renders live from real code. **No screenshots, no CSS fakes** — that would violate Law 03 on the page that states Law 03.

| Kind | Law | Build it as |
|---|---|---|
| `mark-data` | 05 | `<Mark>` (existing, `scenes.tsx`) at 54px + the brand's real `identity.mark.variants.core[0].d` and `bbox` as mono text |
| `twin-render` | 06 | `drawMark()` canvas beside `markToSvg()` in an `<img>`, both 44px, with `= 0.0000%` between them (the measured value — see the v2 battle test) |
| `brand-row` | 07 | 5 swatches from `BRAND_ORDER.map(id => BRAND_BASES[id].identity.palette.accent)` + caption `5 brands · 1 loop · 0 branches` |
| `audit` | 08 | **the old Operator's content, miniaturised**: 3 readiness rings (`readiness(doc).layers`) + the first 3 `matrix(doc)` rows as a mono glyph grid |
| `provenance` | 01 | two identical stat tiles, one badged `measured`, one `simulated` |
| `readiness-zero` | 02 | `readiness(blankBrand('x','X')).overall` → `0%` beside the live brand's real score |
| `live-post` | 03 | the existing `LivePost` at ~120px — the actual `drawSlide` pipeline |
| `gap-frame` | 04 | the `.bs-mark-pending` dashed `MARK · P0` frame |
| `flight` | 09 | a 3-cell mini lane that translates on a loop |
| `reveal` | 10 | a ring that fills only while the card is on screen |
| `ignition` | 11 | the `BRAND SYSTEM ONLINE` letter-spacing animation, replayable on hover |
| `reduced` | 12 | the same reveal, 160ms fade, labelled `PREFERS-REDUCED-MOTION` |
| `chrome` | 13 | the mono label scale rendered at 7/7.5/8/9px with tracking values |
| `wavelengths` | 14 | the 5 accents as a hue strip + `oklch L.76 C.13` |
| `plate` | 15 | **the original bug**: the same headline bare vs plated over a generated background |
| `composition` | 16 | dark ground + one lit subject frame |
| `voice-pair` | 17–20 | a ❌ before / ✅ after copy pair from [[F4 — Voice Matrix]] |

Cheap-and-correct beats clever. If a specimen would cost more than ~25 lines, render a static-but-real value from the registry instead of animating it.

## M-5 · The reference column

Reads from **live code**, never a transcribed table — Law 08 applied to the page itself.

- Geometry: from the active brand's `identity.mark` (`viewBox`, strut = `variants.core[?].strokeWidth`, gradient count, star count).
- Colour: `BRAND_ORDER.map(...palette.accent)` + `palette.bg` / `plateBg`.
- Motion: read `--bs-fly` etc. via `getComputedStyle(document.querySelector('.bs'))`.
- Lanes: from `LAYERS` + `lanes.js` (`LAYER_LANES`).
- Footer, mono, green: `▲ EVERY VALUE READ FROM LIVE CODE — THIS PAGE CANNOT GO STALE`.
- If a value cannot be read live, show `—` and a `not wired` note. **Never hardcode a number here** — a stale reference is the exact failure this page prevents.

## Verify (gates)

1. `npx tsc --noEmit` in `apps/hq` clean; `npm run build` green.
2. Brand Studio opens on **Operator**; pill switches to Cinematic and the flight still works end-to-end (ignition on first entry, `←→` scenes, `Esc` hub).
3. All 5 families render 4 cards each = 20 laws; every card shows a specimen and a source footnote.
4. Zero scroll: assert `el.scrollHeight === el.clientHeight` on `.bs` in both pills.
5. Switching brands re-inks the Operator specimens.
6. `prefers-reduced-motion` → no looping specimen animations.
7. **Screenshots time out on this surface** and html2canvas cannot parse `color-mix()` — verify with `javascript_tool` DOM/pixel probes, and scope queries to the active view (there are 5 `.bs-post` canvases; a bare `querySelector` hits an inactive one).

## Do not

- Do not build expand-to-stage (v1 is cards-only — founder verdict).
- Do not keep a standalone audit page.
- Do not reword the laws or invent new ones; [[The Method]] is the canon.
- Do not hardcode reference values.
- Do not touch `apps/hq/src/surfaces/influencer/*` — another session owns it.

Related: [[The Method]] · [[Brand Studio Design Spec]] · [[Brand OS]]

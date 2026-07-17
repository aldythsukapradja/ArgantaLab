/**
 * THE METHOD — the design canon, as data.
 *
 * Twenty laws in five families: the mental models that decide every design call
 * in the Brand OS. This file is the code half of the two-lane pattern the whole
 * Brand OS uses — knowledge-base/brand/the-method.md is the canon for humans and
 * the Vault; this is what the Operator page renders from. Keep them in sync by
 * hand (there is no generator yet); never invent or reword a law here that the
 * canon doesn't say.
 *
 * A law's `provenance` is honest, not aspirational:
 *   repo-verified  — a real file enforces it today
 *   kb-declared    — written down, not yet wired into code (e.g. art direction
 *                    paragraphs that don't exist yet for most brands)
 *   founder-locked — a decision the founder made; enforced by review, not code
 */

export type Provenance = 'repo-verified' | 'kb-declared' | 'founder-locked'

export type SpecimenKind =
  | 'provenance' | 'readiness-zero' | 'live-post' | 'gap-frame'   // I  Truth
  | 'mark-data' | 'twin-render' | 'brand-row' | 'audit'           // II Determinism
  | 'flight' | 'reveal' | 'ignition' | 'reduced'                  // III Motion
  | 'chrome' | 'wavelengths' | 'plate' | 'composition'            // IV Surface
  | 'voice-pair'                                                   // V  Voice (17–20 share one kind)

export interface Law {
  n: number
  title: string
  statement: string
  specimen: SpecimenKind
  source: string
  provenance: Provenance
  note?: string
}

export interface Family {
  id: string
  roman: string
  label: string
  blurb: string
  laws: Law[]
}

export const CREED = ['Make it data.', 'Render it live.', 'Name the gap.', 'Spend boldness once.']

/** The vault note id the "Read the canon" link opens. */
export const METHOD_NOTE = 'the-method'

export const FAMILIES: Family[] = [
  {
    id: 'truth', roman: 'I', label: 'Truth',
    blurb: 'How we relate to reality. The family that makes everything else believable.',
    laws: [
      {
        n: 1, title: 'Measured or marked', specimen: 'provenance',
        statement: 'Every number carries its provenance. Simulated never wears measured’s clothes.',
        source: 'Architecture v2 provenance badges; agent_runs ledger', provenance: 'repo-verified',
      },
      {
        n: 2, title: 'Never flatter', specimen: 'readiness-zero',
        statement: 'An undesigned thing scores zero. blankBrand() ships nulls, not placeholder greys, because a brand nobody has designed must not report progress.',
        source: 'packages/brand/src/schema.js → blankBrand', provenance: 'repo-verified',
      },
      {
        n: 3, title: 'The demo is real', specimen: 'live-post',
        statement: 'Embed the live thing. A mockup is a lie with good lighting — the landing deck embeds running apps; the brand book renders real carousels with the code that publishes them.',
        source: 'apps/landing/src/stage/scenes.tsx → AppEmbed; surfaces/brand/scenes.tsx → LivePost', provenance: 'repo-verified',
      },
      {
        n: 4, title: 'Name the gap first', specimen: 'gap-frame',
        statement: 'MARK · P0. AWAITING VOICE. link — unverified. Say what is missing before anyone else finds it. Honesty is a feature of the surface, not an apology.',
        source: 'packages/brand/src/registry.js → matrix()', provenance: 'repo-verified',
      },
    ],
  },
  {
    id: 'determinism', roman: 'II', label: 'Determinism',
    blurb: 'How things are made. The family that makes the system cheap to change.',
    laws: [
      {
        n: 5, title: 'Marks are code', specimen: 'mark-data',
        statement: 'Geometry, not pixels. Diffable, infinitely scalable, identical forever. A logo is data in a viewBox — never an AI raster, never hand-copied twice.',
        source: 'packages/brand/src/mark.js; brands/<id>/brand.json → identity.mark', provenance: 'repo-verified',
      },
      {
        n: 6, title: 'One source, two renderers', specimen: 'twin-render',
        statement: 'Canvas and SVG draw the same data, so they cannot drift. Proven, not claimed: every transcribed mark measures 0.0000% against its source artwork.',
        source: 'drawMark() / markToSvg()', provenance: 'repo-verified',
      },
      {
        n: 7, title: 'Data over hardcode', specimen: 'brand-row',
        statement: 'Brand six is a document, never a commit. Proof: handoff v2 replaced every mark, every palette and the typography — and cost zero surface code.',
        source: 'packages/brand/src/index.js → BRAND_ORDER', provenance: 'repo-verified',
      },
      {
        n: 8, title: 'The audit derives', specimen: 'audit',
        statement: 'A checklist you maintain is a checklist that lies. Add one platform spec and every brand re-audits itself on the next render.',
        source: 'registry.js → readiness() / matrix() ← specs.js', provenance: 'repo-verified',
      },
    ],
  },
  {
    id: 'motion', roman: 'III', label: 'Motion',
    blurb: 'How it moves. The family that makes it feel like a place.',
    laws: [
      {
        n: 9, title: 'Fly, don’t scroll', specimen: 'flight',
        statement: 'Scenes are positions in space; the camera travels between them. Scroll is a document metaphor — this is a cockpit.',
        source: 'apps/landing/src/stage/registry.tsx; brand-studio.css → .bs-camera', provenance: 'repo-verified',
      },
      {
        n: 10, title: 'Reveal on arrival', specimen: 'reveal',
        statement: 'Nothing is merely there. A ring fills, a line rises — but only when the camera lands on it.',
        source: 'apps/landing/src/stage/active.tsx → useIsActive; .bs-scene.in', provenance: 'repo-verified',
      },
      {
        n: 11, title: 'Ignition', specimen: 'ignition',
        statement: 'A system announces itself once, then gets out of the way. Every ignition is skippable — ceremony that cannot be skipped is a toll.',
        source: '.bs-ignition; Landing reactor ignition', provenance: 'repo-verified',
      },
      {
        n: 12, title: 'Reduced motion is a path, not a fallback', specimen: 'reduced',
        statement: 'The same scene, 160ms fades, nothing lost. Someone who turns motion off is not a second-class viewer.',
        source: '@media (prefers-reduced-motion: reduce) in brand-studio.css', provenance: 'repo-verified',
      },
    ],
  },
  {
    id: 'surface', roman: 'IV', label: 'Surface',
    blurb: 'How it looks. The family with the tightest constraints, on purpose.',
    laws: [
      {
        n: 13, title: 'Cockpit chrome', specimen: 'chrome',
        statement: '7–9px mono micro-labels, .14–.3em tracking, cyan instrument eyebrows, and a status vocabulary (LIVE SIGNAL · AWAITING SIGNAL · REGISTRY · SEED). Instruments, not decoration.',
        source: 'apps/hq/src/surfaces/landing.css → .ld-*', provenance: 'repo-verified',
      },
      {
        n: 14, title: 'One accent per composition', specimen: 'wavelengths',
        statement: 'Spend boldness once. One light, five wavelengths: a single oklch recipe (L .76, C .13) hue-rotated per brand — shared ground, different hue, so five products read as one company.',
        source: 'handoff v2 §2; brands/*/brand.json → identity.palette.accent', provenance: 'repo-verified',
      },
      {
        n: 15, title: 'The plate rule', specimen: 'plate',
        statement: 'Copy never floats on artwork. Every generated line rides a solid plate — because bare white text vanished into a real generated background, and that failure is now structurally impossible.',
        source: 'postEngine.ts → drawTextLayer / platePaint', provenance: 'repo-verified',
      },
      {
        n: 16, title: 'Dark ground, one lit subject', specimen: 'composition',
        statement: 'Vast calm negative space; the subject is lit from within; the void carries weight. Never stock photography, never a neon wash.',
        source: 'brands/argantalab/BRAND.md → art direction', provenance: 'kb-declared',
        note: 'v2 replacement paragraphs pending — battle-test M1',
      },
    ],
  },
  {
    id: 'voice', roman: 'V', label: 'Voice',
    blurb: 'How it speaks. The family that keeps automation from sounding automated.',
    laws: [
      {
        n: 17, title: 'Show finished things', specimen: 'voice-pair',
        statement: 'The build log is the pitch. Never promise what has not shipped; never invent traction, users or partnerships.',
        source: 'F1 — Brand Foundation & Architecture', provenance: 'founder-locked',
      },
      {
        n: 18, title: 'Silence over nonsense', specimen: 'voice-pair',
        statement: 'A brand with no voice claims no persona. Telling a model to "write as X" with no idea what X is produces confident nonsense — worse than a generic voice.',
        source: 'packages/brand/src/voice.js → voiceBlock()', provenance: 'repo-verified',
      },
      {
        n: 19, title: 'Specificity is the warmth', specimen: 'voice-pair',
        statement: 'One real kid’s creation beats any adjective. A post that could have been about any product is off-brand no matter how correct the colours are.',
        source: 'F5 — Social & Content OS → touchy rules', provenance: 'founder-locked',
      },
      {
        n: 20, title: 'Never a child’s face', specimen: 'voice-pair',
        statement: 'Silhouettes, hands, or from behind — and always secondary to the thing they made.',
        source: 'F4 — Voice Matrix; every generation brief', provenance: 'founder-locked',
      },
    ],
  },
]

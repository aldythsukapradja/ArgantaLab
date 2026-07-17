// @arganta/brand — the Brand OS contract.
//
// One BrandDoc per brand across 7 layers. The two-lane rule is enforced by
// storage: agent lane (identity/KB/templates) in git, founder lane (voice/
// spine/text) in Supabase, merged by resolveBrand(). See README.md and
// knowledge-base/brand/brand-os.md.

export * from './lanes.js'
export * from './schema.js'
export * from './specs.js'
export * from './kit.js'
export * from './mark.js'
export * from './registry.js'
export * from './voice.js'

import arganta from '../brands/arganta/brand.json' with { type: 'json' }
import argantalab from '../brands/argantalab/brand.json' with { type: 'json' }
import kinetikcircle from '../brands/kinetikcircle/brand.json' with { type: 'json' }
import lashirabloom from '../brands/lashirabloom/brand.json' with { type: 'json' }
import circlehq from '../brands/circlehq/brand.json' with { type: 'json' }

import argantaSeed from '../brands/arganta/seed.overlay.json' with { type: 'json' }
import argantalabSeed from '../brands/argantalab/seed.overlay.json' with { type: 'json' }
import kinetikcircleSeed from '../brands/kinetikcircle/seed.overlay.json' with { type: 'json' }
import lashirabloomSeed from '../brands/lashirabloom/seed.overlay.json' with { type: 'json' }
import circlehqSeed from '../brands/circlehq/seed.overlay.json' with { type: 'json' }

const noNote = ({ _note, ...rest }) => rest

/**
 * The founder-lane SEEDS — what migration_brand_registry*.sql inserts once.
 *
 * The database is authoritative the moment it has a row; these exist so an
 * offline surface (and dev without a connection) still shows the truth instead
 * of an empty brand. Consumers must prefer the DB overlay and fall back here —
 * never merge both, or a founder edit would fight its own seed.
 */
export const SEED_OVERLAYS = {
  arganta: noNote(argantaSeed),
  argantalab: noNote(argantalabSeed),
  kinetikcircle: noNote(kinetikcircleSeed),
  lashirabloom: noNote(lashirabloomSeed),
  circlehq: noNote(circlehqSeed),
}

/** The git-side (agent lane) bases that ship with the repo. Founder-lane
 *  overlays come from Supabase at runtime — see resolveBrand().
 *
 *  Everything a RENDERER needs (mark, palette, plate, fonts) is agent lane, so
 *  postEngine can draw any brand from these bases alone — no database round-trip
 *  on the render path. */
export const BRAND_BASES = { arganta, argantalab, kinetikcircle, lashirabloom, circlehq }

/** The brand a doc renders as when it names none. KinetikCircle was the only
 *  brand the engine knew before BF-3 (its mark was hard-coded), so defaulting
 *  here keeps every pre-existing doc pixel-identical. */
export const DEFAULT_BRAND_ID = 'kinetikcircle'

/** Agent-lane lookup for the render path. */
export const brandBase = (id) => BRAND_BASES[id] || BRAND_BASES[DEFAULT_BRAND_ID] || null

/**
 * The portfolio, in the order it is presented — masterbrand first, then the
 * three public products in funnel order, then the internal OS.
 *
 * Locked 2026-07-16 (knowledge-base/brand/brand-handoff-battle-test.md): five
 * brands, no more. "Landing" is retired as a brand name — apps/landing is the
 * repo path of ARGANTA, the masterbrand and external gateway. Kingdom is parked
 * and is not a brand. Circle HQ is its own (internal-only) brand and was missing
 * from this file entirely until BS-0.
 */
export const BRAND_ORDER = ['arganta', 'argantalab', 'kinetikcircle', 'lashirabloom', 'circlehq']

/** Public-facing brands (Circle HQ is internal — never marketed, never audited
 *  for social presence). */
export const PUBLIC_BRAND_IDS = ['arganta', 'argantalab', 'kinetikcircle', 'lashirabloom']

/** One-line role per brand — the constellation's micro-labels. */
export const BRAND_ROLE = {
  arganta: 'The gateway',
  argantalab: 'Kids create',
  kinetikcircle: 'Family rhythm',
  lashirabloom: 'The shared world',
  circlehq: 'Internal OS',
}

/** Every brand in presentation order, resolved against its overlay. */
export const orderedBases = () => BRAND_ORDER.map((id) => BRAND_BASES[id]).filter(Boolean)

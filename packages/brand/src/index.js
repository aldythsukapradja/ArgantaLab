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

// ── Masterbrand + the three companies (the endorsed house, WF1 2026-07-22) ──
import arganta from '../brands/arganta/brand.json' with { type: 'json' }
import argantalife from '../brands/argantalife/brand.json' with { type: 'json' }
import argantaenergy from '../brands/argantaenergy/brand.json' with { type: 'json' }
import argantastudio from '../brands/argantastudio/brand.json' with { type: 'json' }
// ── Products (rendered by explicit id; grouped under a company via MEMBERS) ──
import kinetikcircle from '../brands/kinetikcircle/brand.json' with { type: 'json' }
import argantalab from '../brands/argantalab/brand.json' with { type: 'json' }
import lashirabloom from '../brands/lashirabloom/brand.json' with { type: 'json' }
import geavision from '../brands/geavision/brand.json' with { type: 'json' }
// ── Internal OS ──
import circlehq from '../brands/circlehq/brand.json' with { type: 'json' }

import argantaSeed from '../brands/arganta/seed.overlay.json' with { type: 'json' }
import argantalifeSeed from '../brands/argantalife/seed.overlay.json' with { type: 'json' }
import argantaenergySeed from '../brands/argantaenergy/seed.overlay.json' with { type: 'json' }
import argantastudioSeed from '../brands/argantastudio/seed.overlay.json' with { type: 'json' }
import kinetikcircleSeed from '../brands/kinetikcircle/seed.overlay.json' with { type: 'json' }
import argantalabSeed from '../brands/argantalab/seed.overlay.json' with { type: 'json' }
import lashirabloomSeed from '../brands/lashirabloom/seed.overlay.json' with { type: 'json' }
import geavisionSeed from '../brands/geavision/seed.overlay.json' with { type: 'json' }
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
  argantalife: noNote(argantalifeSeed),
  argantaenergy: noNote(argantaenergySeed),
  argantastudio: noNote(argantastudioSeed),
  kinetikcircle: noNote(kinetikcircleSeed),
  argantalab: noNote(argantalabSeed),
  lashirabloom: noNote(lashirabloomSeed),
  geavision: noNote(geavisionSeed),
  circlehq: noNote(circlehqSeed),
}

/** The git-side (agent lane) bases that ship with the repo. Founder-lane
 *  overlays come from Supabase at runtime — see resolveBrand().
 *
 *  Everything a RENDERER needs (mark, palette, plate, fonts) is agent lane, so
 *  postEngine can draw any brand from these bases alone — no database round-trip
 *  on the render path. Includes companies AND products; a product is rendered by
 *  its explicit id (e.g. brandBase('kinetikcircle')). */
export const BRAND_BASES = {
  arganta, argantalife, argantaenergy, argantastudio,
  kinetikcircle, argantalab, lashirabloom, geavision,
  circlehq,
}

/** The brand a doc renders as when it names none. KinetikCircle was the only
 *  brand the engine knew before BF-3 (its mark was hard-coded), so defaulting
 *  here keeps every pre-existing doc pixel-identical. */
export const DEFAULT_BRAND_ID = 'kinetikcircle'

/** Agent-lane lookup for the render path. */
export const brandBase = (id) => BRAND_BASES[id] || BRAND_BASES[DEFAULT_BRAND_ID] || null

/**
 * THE ENDORSED HOUSE, in presentation order — masterbrand first, then the three
 * companies, then the internal OS. (WF1, 2026-07-22, replacing the old flat
 * "five product-brands" model — see docs/arganta-design-system/Brand-Studio-
 * Audit.md.)
 *
 * Arganta.ai is the masterbrand/gateway. ArgantaLife / ArgantaEnergy /
 * ArgantaStudio are the three companies; their PRODUCTS live under MEMBERS and
 * are rendered by explicit id, not by iterating this list. Circle HQ is the
 * internal cockpit — a brand, never marketed. "Landing" is retired (apps/landing
 * IS Arganta). Kingdom is parked.
 */
export const BRAND_ORDER = ['arganta', 'argantalife', 'argantaenergy', 'argantastudio', 'circlehq']

/** Products grouped under their company. The constellation shows a company;
 *  drilling in reveals its members. Studio's offering is services, not product
 *  brands, so it has no members yet. */
export const MEMBERS = {
  argantalife: ['kinetikcircle', 'argantalab', 'lashirabloom'],
  argantaenergy: ['geavision'],
  argantastudio: [],
}

/** Reverse lookup: which company a product belongs to. */
export const PARENT = Object.fromEntries(
  Object.entries(MEMBERS).flatMap(([company, kids]) => kids.map((k) => [k, company]))
)

/** Public-facing brands (Circle HQ is internal — never marketed, never audited
 *  for social presence). Companies + their products. */
export const PUBLIC_BRAND_IDS = [
  'arganta', 'argantalife', 'argantaenergy', 'argantastudio',
  'kinetikcircle', 'argantalab', 'lashirabloom', 'geavision',
]

/** One-line role per brand — the constellation's micro-labels. */
export const BRAND_ROLE = {
  arganta: 'The gateway',
  argantalife: 'Family ecosystem',
  argantaenergy: 'Energy AI & subsurface',
  argantastudio: 'AI creative studio',
  kinetikcircle: 'Family rhythm',
  argantalab: 'Kids create',
  lashirabloom: 'The shared world',
  geavision: 'Exploration platform',
  circlehq: 'Internal OS',
}

/** Every top-level brand in presentation order, resolved against its overlay. */
export const orderedBases = () => BRAND_ORDER.map((id) => BRAND_BASES[id]).filter(Boolean)

// @arganta/brand — the Brand OS contract.
//
// One BrandDoc per brand across 7 layers. The two-lane rule is enforced by
// storage: agent lane (identity/KB/templates) in git, founder lane (voice/
// spine/text) in Supabase, merged by resolveBrand(). See README.md and
// knowledge-base/brand/brand-os.md.

export * from './lanes.js'
export * from './schema.js'
export * from './specs.js'
export * from './mark.js'
export * from './registry.js'
export * from './voice.js'

import argantalab from '../brands/argantalab/brand.json' with { type: 'json' }
import kinetikcircle from '../brands/kinetikcircle/brand.json' with { type: 'json' }

/** The git-side (agent lane) bases that ship with the repo. Founder-lane
 *  overlays come from Supabase at runtime — see resolveBrand().
 *
 *  Everything a RENDERER needs (mark, palette, plate, fonts) is agent lane, so
 *  postEngine can draw any brand from these bases alone — no database round-trip
 *  on the render path. */
export const BRAND_BASES = { argantalab, kinetikcircle }

/** The brand a doc renders as when it names none. KinetikCircle was the only
 *  brand the engine knew before BF-3 (its mark was hard-coded), so defaulting
 *  here keeps every pre-existing doc pixel-identical. */
export const DEFAULT_BRAND_ID = 'kinetikcircle'

/** Agent-lane lookup for the render path. */
export const brandBase = (id) => BRAND_BASES[id] || BRAND_BASES[DEFAULT_BRAND_ID] || null

/** Brands still to be canonized — declared so the Brand Forge rail can show
 *  them as empty rather than pretending the portfolio is only one brand. */
export const PLANNED_BRANDS = [
  { id: 'arganta', name: 'Arganta', note: 'The parent OS — HQ' },
  { id: 'lashirabloom', name: 'LashiraBloom', note: 'The retention world' },
  { id: 'landing', name: 'Landing', note: 'Name TBD — rename is one field' },
]

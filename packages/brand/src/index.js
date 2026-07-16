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

import argantalab from '../brands/argantalab/brand.json' with { type: 'json' }

/** The git-side (agent lane) bases that ship with the repo. Founder-lane
 *  overlays come from Supabase at runtime — see resolveBrand(). */
export const BRAND_BASES = { argantalab }

/** Brands still to be canonized — declared so the Brand Forge rail can show
 *  them as empty rather than pretending the portfolio is only one brand. */
export const PLANNED_BRANDS = [
  { id: 'arganta', name: 'Arganta', note: 'The parent OS — HQ' },
  { id: 'kinetikcircle', name: 'KinetikCircle', note: 'The family circle' },
  { id: 'lashirabloom', name: 'LashiraBloom', note: 'The retention world' },
  { id: 'landing', name: 'Landing', note: 'Name TBD — rename is one field' },
]

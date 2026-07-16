import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  laneFor, canEdit, assertEditable, illegalOverlayPaths, AGENT, FOUNDER,
} from '../src/lanes.js'
import { blankBrand, validateBrand, deepMerge, LAYERS } from '../src/schema.js'
import { validateField, requiredAssets, platformSpec, MATRIX_COLUMNS } from '../src/specs.js'
import { markToSvg, markVariants } from '../src/mark.js'
import { resolveBrand, createRegistry, matrix, readiness, platformRow, OK, WARN, MISSING, NA } from '../src/registry.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const base = JSON.parse(fs.readFileSync(path.join(here, '../brands/argantalab/brand.json'), 'utf8'))
const seed = JSON.parse(fs.readFileSync(path.join(here, '../brands/argantalab/seed.overlay.json'), 'utf8'))
const overlay = { ...seed }; delete overlay._note

// ── Lanes: the governance rule ────────────────────────────────
test('lanes: layers map to the documented owner', () => {
  assert.equal(laneFor('identity.palette.accent'), AGENT)
  assert.equal(laneFor('kb.brandMd'), AGENT)
  assert.equal(laneFor('content.templates'), AGENT)
  assert.equal(laneFor('routing.bufferChannelId'), AGENT)
  assert.equal(laneFor('voice.persona.title'), FOUNDER)
  assert.equal(laneFor('spine.rhythm'), FOUNDER)
})

test('lanes: mixed layers resolve per field — art is agent, text is founder', () => {
  assert.equal(laneFor('presence.instagram.avatar'), AGENT)
  assert.equal(laneFor('presence.instagram.banner'), AGENT)
  assert.equal(laneFor('presence.instagram.bio'), FOUNDER)
  assert.equal(laneFor('presence.instagram.handle'), FOUNDER)
  assert.equal(laneFor('discovery.ogImage'), AGENT)
  assert.equal(laneFor('discovery.factSheet'), FOUNDER)
})

test('lanes: the founder cannot edit the agent lane; agents can edit everything', () => {
  assert.equal(canEdit('identity.mark', FOUNDER), false)
  assert.equal(canEdit('voice.persona.title', FOUNDER), true)
  assert.equal(canEdit('identity.mark', AGENT), true)
  assert.equal(canEdit('voice.persona.title', AGENT), true)
  assert.throws(() => assertEditable('identity.palette.accent', FOUNDER), /agent-lane/)
  assert.doesNotThrow(() => assertEditable('identity.palette.accent', AGENT))
})

test('lanes: unknown paths default to the safe lane (founder locked out)', () => {
  assert.equal(canEdit('somethingNew.field', FOUNDER), false)
})

test('lanes: illegal overlay paths are detected', () => {
  assert.deepEqual(illegalOverlayPaths({ voice: { persona: { title: 'x' } } }), [])
  const bad = illegalOverlayPaths({ identity: { palette: { ink: '#fff' } }, voice: { taglines: { en: 'y' } } })
  assert.deepEqual(bad, ['identity.palette.ink'])
})

// ── Schema ────────────────────────────────────────────────────
test('schema: a blank brand is structurally valid and has every layer', () => {
  const b = blankBrand('demo', 'Demo')
  assert.deepEqual(validateBrand(b), [])
  for (const l of LAYERS) assert.ok(b[l.id] !== undefined, `missing ${l.id}`)
})

test('schema: validation catches a bad id and a non-hex palette', () => {
  const b = blankBrand('Demo Brand', 'Demo')
  assert.ok(validateBrand(b).some((e) => /lowercase slug/.test(e)))
  const c = blankBrand('demo', 'Demo'); c.identity.palette.ink = 'white'
  assert.ok(validateBrand(c).some((e) => /not a hex/.test(e)))
})

test('schema: deepMerge lets the overlay win and replaces arrays wholesale', () => {
  const m = deepMerge({ a: { b: 1, c: 2 }, list: [1, 2, 3] }, { a: { c: 9 }, list: [7] })
  assert.deepEqual(m, { a: { b: 1, c: 9 }, list: [7] })
})

// ── Specs ─────────────────────────────────────────────────────
test('specs: field limits report overflow without mutating', () => {
  assert.equal(validateField('tiktok', 'bio', 'x'.repeat(80)).ok, true)
  const over = validateField('tiktok', 'bio', 'x'.repeat(90))
  assert.equal(over.ok, false)
  assert.equal(over.over, 10)
  assert.equal(over.max, 80)
})

test('specs: instagram has no banner, linkedin does', () => {
  assert.equal(platformSpec('instagram').assets.banner, null)
  assert.deepEqual(platformSpec('linkedin').assets.banner, { w: 1128, h: 191 })
  assert.ok(requiredAssets('instagram').every((a) => a.kind !== 'banner'))
})

// ── Mark: one geometry source, two renderers ──────────────────
test('mark: argantalab defines both variants', () => {
  assert.deepEqual(markVariants(base.identity.mark).sort(), ['core', 'profile'])
})

test('mark: SVG export contains the real pack geometry, not an approximation', () => {
  const svg = markToSvg(base.identity.mark, { size: 1080, variant: 'core' })
  assert.match(svg, /viewBox="0 0 1080 1080"/)
  // the tile
  assert.match(svg, /<rect [^>]*width="660"[^>]*height="660"[^>]*rx="205"/)
  // the gradient the tile is painted with, in pack order
  assert.match(svg, /<linearGradient id="brand"/)
  assert.match(svg, /stop-color="#34E5FF"/)
  assert.match(svg, /offset="0.72" stop-color="#8B5CF6"/)
  // the cube's top face, verbatim from the pack
  assert.match(svg, /points="540,328 724,434 540,540 356,434"/)
  // the cube group's translate survives
  assert.match(svg, /<g transform="translate\(0,8\)">/)
  // the core dot
  assert.match(svg, /<circle [^>]*r="13"[^>]*fill="#8B5CF6"/)
})

test('mark: the profile variant adds the orbit ring and satellite', () => {
  const svg = markToSvg(base.identity.mark, { variant: 'profile' })
  assert.match(svg, /<circle [^>]*cx="540" cy="540" r="392"[^>]*stroke="url\(#brand\)"/)
  assert.match(svg, /<circle [^>]*cx="836" cy="285" r="28"/)
})

// ── Registry: resolve = the two lanes merged ──────────────────
test('registry: git base + DB overlay resolve into one valid doc', () => {
  const { doc, errors, dropped } = resolveBrand(base, overlay)
  assert.deepEqual(errors, [])
  assert.deepEqual(dropped, [])
  // from git (agent lane)
  assert.equal(doc.identity.palette.plateBg, '#FFC24B')
  assert.ok(doc.identity.mark.variants.core.length)
  // from the DB (founder lane)
  assert.equal(doc.voice.persona.title, 'The Lab')
  assert.equal(doc.presence.instagram.handle, 'argantalab')
  // merged within one platform: avatar from git, bio from the DB
  assert.match(doc.presence.instagram.avatar, /profile-dark\.png$/)
  assert.match(doc.presence.instagram.bio, /Enter the Lab/)
})

test('registry: an overlay that reaches into the agent lane is dropped, not honoured', () => {
  const evil = { ...overlay, identity: { palette: { plateBg: '#ff0000' } } }
  const { doc, dropped } = resolveBrand(base, evil)
  assert.deepEqual(dropped, ['identity.palette.plateBg'])
  assert.equal(doc.identity.palette.plateBg, '#FFC24B', 'git must win — the DB cannot shadow it')
})

test('registry: strict mode throws instead of dropping', () => {
  assert.throws(() => resolveBrand(base, { identity: { mark: null } }, { strict: true }), /agent-lane/)
})

test('registry: brand-new brand with no overlay is still structurally complete', () => {
  const { doc, errors } = resolveBrand({ id: 'fresh', name: 'Fresh' }, {})
  assert.deepEqual(errors, [])
  assert.ok(doc.voice && doc.spine && doc.discovery)
})

// ── The matrix: a derived, never-stale audit ──────────────────
test('matrix: instagram reflects the real state of the pack', () => {
  const { doc } = resolveBrand(base, overlay)
  const ig = platformRow(doc, 'instagram')
  assert.equal(ig.cells.handle.state, OK)
  assert.equal(ig.cells.avatar.state, OK)
  assert.equal(ig.cells.bio.state, OK)
  assert.equal(ig.cells.pinned.state, OK)
  // Instagram has no banner — not a gap, genuinely not applicable
  assert.equal(ig.cells.banner.state, NA)
  // the unverified lab.arganta.app link is the honest warning from the battle test
  assert.equal(ig.cells.link.state, WARN)
  assert.match(ig.cells.link.note, /unverified/)
  // no templates yet — that's BF-7
  assert.equal(ig.cells.templates.state, MISSING)
})

test('matrix: untargeted platforms show up as gaps rather than hiding', () => {
  const { doc } = resolveBrand(base, overlay)
  const rows = matrix(doc)
  assert.ok(rows.length >= 6, 'every known platform is audited')
  const tiktok = rows.find((r) => r.platformId === 'tiktok')
  assert.equal(tiktok.cells.handle.state, MISSING)
  assert.equal(tiktok.cells.bio.state, MISSING)
})

test('matrix: an over-limit bio warns with the exact overflow', () => {
  const { doc } = resolveBrand(base, deepMerge(overlay, { presence: { tiktok: { bio: 'x'.repeat(95) } } }))
  const row = platformRow(doc, 'tiktok')
  assert.equal(row.cells.bio.state, WARN)
  assert.match(row.cells.bio.note, /15 chars over the 80 limit/)
})

test('matrix: the boilerplate cascade surfaces a stale bio as a draft', () => {
  const { doc } = resolveBrand(base, deepMerge(overlay, { presence: { instagram: { bioStale: true } } }))
  assert.equal(platformRow(doc, 'instagram').cells.bio.state, 'draft')
})

test('matrix: every column is covered for every platform', () => {
  const { doc } = resolveBrand(base, overlay)
  for (const row of matrix(doc)) {
    for (const col of MATRIX_COLUMNS) {
      assert.ok(row.cells[col.id], `${row.platformId} missing ${col.id}`)
      assert.ok(['ok', 'draft', 'warn', 'missing', 'na'].includes(row.cells[col.id].state))
    }
  }
})

// ── Readiness ─────────────────────────────────────────────────
test('readiness: reports every layer and an honest overall score', () => {
  const { doc } = resolveBrand(base, overlay)
  const r = readiness(doc)
  for (const l of LAYERS) assert.ok(r.layers[l.id], `missing layer ${l.id}`)
  assert.ok(r.overall > 0 && r.overall < 100, `expected a partial score, got ${r.overall}`)
  // identity is the strongest layer — the pack delivered it
  assert.ok(r.layers.identity.pct >= 50)
  // the layers we have not built yet must read as empty, not as fake progress
  assert.equal(r.layers.content.pct, 0)
  assert.equal(r.layers.discovery.pct, 0)
  assert.equal(r.layers.spine.pct, 0)
})

test('readiness: the next-actions queue names real gaps', () => {
  const { doc } = resolveBrand(base, overlay)
  const r = readiness(doc)
  assert.ok(r.next.length > 0 && r.next.length <= 3)
  assert.ok(r.next.every((s) => typeof s === 'string' && s.length))
})

test('readiness: a blank brand scores 0, a fully-checked one would score 100', () => {
  assert.equal(readiness(blankBrand('x', 'X')).overall, 0)
})

// ── Registry over many brands ─────────────────────────────────
test('registry: createRegistry resolves and exposes brands by id', () => {
  const reg = createRegistry({ argantalab: base }, { argantalab: overlay })
  assert.deepEqual(reg.ids(), ['argantalab'])
  assert.equal(reg.get('argantalab').voice.persona.title, 'The Lab')
  assert.deepEqual(reg.errorsFor('argantalab'), [])
  assert.equal(reg.get('nope'), null)
})

// ── BF-3: the engine must be able to render any brand ─────────
test('bases: every shipped brand is structurally valid and carries a mark', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  const ids = Object.keys(BRAND_BASES)
  assert.ok(ids.includes('argantalab') && ids.includes('kinetikcircle'))
  for (const [id, b] of Object.entries(BRAND_BASES)) {
    const { doc, errors } = resolveBrand(b, {})
    assert.deepEqual(errors, [], `${id} is invalid`)
    assert.ok(doc.identity.mark?.variants?.core?.length, `${id} has no core mark — postEngine would draw nothing`)
    assert.ok(doc.identity.palette.accent, `${id} has no accent`)
  }
})

test('bases: an unknown brand id falls back to the default rather than rendering blank', async () => {
  const { brandBase, DEFAULT_BRAND_ID } = await import('../src/index.js')
  assert.equal(DEFAULT_BRAND_ID, 'kinetikcircle')
  assert.equal(brandBase('nope').id, 'kinetikcircle')
  assert.equal(brandBase('argantalab').id, 'argantalab')
  assert.equal(brandBase(undefined).id, 'kinetikcircle')
})

test('bases: the two brands are genuinely distinct — no shared hard-coded identity', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  const a = BRAND_BASES.argantalab.identity
  const k = BRAND_BASES.kinetikcircle.identity
  assert.notEqual(a.palette.accent, k.palette.accent)
  assert.notEqual(a.palette.bg, k.palette.bg)
  assert.notEqual(a.mark.viewBox, k.mark.viewBox)
  // ArgantaLab overrides the plate to Quest Gold; KinetikCircle takes the engine's default
  assert.equal(a.palette.plateBg, '#FFC24B')
  assert.equal(k.palette.plateBg, '#FFD64B')
})

test('bases: the kinetikcircle mark is the K-mark that used to be hard-coded', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  const svg = markToSvg(BRAND_BASES.kinetikcircle.identity.mark, { size: 512 })
  assert.match(svg, /viewBox="0 0 512 512"/)
  assert.match(svg, /stop-color="#22D3EE"/)   // the tile gradient's cyan end
  assert.match(svg, /stop-color="#8B5CF6"/)   // ...and its violet end
  assert.match(svg, /<circle [^>]*cx="256" cy="256" r="106"[^>]*stroke-width="40"/) // the ring
  assert.match(svg, /<circle [^>]*cx="332" cy="180" r="34"/)                        // the satellite
  assert.match(svg, /<circle [^>]*cx="256" cy="256" r="22"/)                        // the core
})

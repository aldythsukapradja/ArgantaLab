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
test('mark: SVG export contains the real pack geometry, not an approximation', () => {
  // Wire Cube (handoff v2) — the hexagon shell, verbatim from the delivered SVG.
  const svg = markToSvg(base.identity.mark, { size: 120, variant: 'core' })
  assert.match(svg, /viewBox="0 0 120 120"/)
  assert.match(svg, /d="M60 18 L92 37 L92 75 L60 94 L28 75 L28 37 Z"/)
  assert.match(svg, /<linearGradient id="volt"/)
  assert.match(svg, /stop-color="#7BAEE8"/)
  assert.match(svg, /stop-color="#4C7BB8"/)
  // the summit star
  assert.match(svg, /<circle [^>]*cx="60" cy="18" r="4"[^>]*fill="#7BAEE8"/)
})

// ── BS/A1: the path kind — what v2's marks actually need ──────
test('mark: path shapes survive the round trip with their exact data', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  // Bloom's centre leaf is a quadratic bézier. Its TRUE bbox is x54.5/w11; its
  // control points span 49→71. Storing the control-point box would silently
  // restretch the one gradient in the mark, so the bbox is measured, not guessed.
  const leaf = BRAND_BASES.lashirabloom.identity.mark.variants.core[0]
  assert.equal(leaf.kind, 'path')
  assert.equal(leaf.d, 'M60 22 Q71 44 60 66 Q49 44 60 22 Z')
  assert.deepEqual(leaf.bbox, { x: 54.5, y: 22, w: 11, h: 44 })
  assert.equal(leaf.stroke, '@leaf')
  const svg = markToSvg(BRAND_BASES.lashirabloom.identity.mark)
  assert.match(svg, /d="M60 22 Q71 44 60 66 Q49 44 60 22 Z"/)
  assert.match(svg, /stroke="url\(#leaf\)"/)
})

test('mark: an elliptical arc round-trips (Kinetik Circle\'s broken ring)', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  const svg = markToSvg(BRAND_BASES.kinetikcircle.identity.mark)
  // The break IS the strategy — participation, not tracking. Losing the arc
  // would close the ring and invert the brand's argument.
  assert.match(svg, /d="M60 36 A24 24 0 1 1 39 48"/)
  assert.match(svg, /stroke-linecap="round"/)
})

test('mark: colour tokens flip the theme without touching geometry', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  const mark = BRAND_BASES.arganta.identity.mark
  const dark = markToSvg(mark)
  const light = markToSvg(mark, { tokens: mark.tokensLight })
  assert.match(dark, /stroke="#C4C9D4"/)
  assert.match(light, /stroke="#3A3D45"/)
  assert.ok(!light.includes('#C4C9D4'))
  // identical geometry — only the token differs (the pack's own rule)
  assert.equal(dark.replace(/#C4C9D4/g, 'X'), light.replace(/#3A3D45/g, 'X'))
})

test('mark: variantForSize picks the ladder rung, falling back honestly', async () => {
  const { variantForSize } = await import('../src/mark.js')
  const { BRAND_BASES } = await import('../src/index.js')
  const mark = BRAND_BASES.argantalab.identity.mark
  // No compact/glyph exist yet (battle-test M2), so everything falls to core —
  // which is exactly the gap: a 2.5px stroke on a 120 viewBox is 0.83px at 40.
  assert.equal(variantForSize(mark, 16), 'core')
  assert.equal(variantForSize(mark, 512), 'core')
  const laddered = { variants: { core: [], compact: [], glyph: [] } }
  assert.equal(variantForSize(laddered, 16), 'glyph')
  assert.equal(variantForSize(laddered, 64), 'compact')
  assert.equal(variantForSize(laddered, 400), 'core')
})

test('identity v2: every brand wears the monoline system', async () => {
  const { BRAND_BASES, BRAND_ORDER } = await import('../src/index.js')
  const ACCENT = { arganta: '#DCA254', argantalab: '#7BAEE8', kinetikcircle: '#EC93B5', lashirabloom: '#6EC492', circlehq: '#AF9BE8' }
  for (const id of BRAND_ORDER) {
    const i = BRAND_BASES[id].identity
    assert.ok(i.mark, `${id} has no mark — v2 delivered all five`)
    assert.equal(i.mark.viewBox, 120, `${id} is not on the v2 canvas`)
    assert.equal(i.palette.accent, ACCENT[id], `${id} is not on its wavelength`)
    // one light, five wavelengths: the ground and ink are shared, the hue is not
    assert.equal(i.palette.bg, '#15161B')
    assert.equal(i.palette.ink, '#F2F1EC')
    assert.equal(Object.keys(i.mark.gradients).length, 1, `${id} must have exactly one gradient`)
    assert.equal(i.fonts.display, 'Space Grotesk')
  }
  // ...and no two brands share a hue
  const hues = BRAND_ORDER.map((id) => BRAND_BASES[id].identity.palette.accent)
  assert.equal(new Set(hues).size, 5)
})

// ── Registry: resolve = the two lanes merged ──────────────────
test('registry: git base + DB overlay resolve into one valid doc', () => {
  const { doc, errors, dropped } = resolveBrand(base, overlay)
  assert.deepEqual(errors, [])
  assert.deepEqual(dropped, [])
  // from git (agent lane)
  assert.equal(doc.identity.palette.plateBg, '#F2F1EC')
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
  assert.equal(doc.identity.palette.plateBg, '#F2F1EC', 'git must win — the DB cannot shadow it')
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

// ── BF-5: the brand, compacted for a language model ───────────
test('voice: voiceBlock carries what a model needs to sound like the brand', async () => {
  const { voiceBlock } = await import('../src/voice.js')
  const { doc } = resolveBrand(base, overlay)
  const v = voiceBlock(doc, { lang: 'en', platform: 'instagram' })
  assert.equal(v.id, 'argantalab')
  assert.equal(v.persona.title, 'The Lab')
  assert.equal(v.handle, '@argantalab')
  assert.equal(v.tagline, 'Play. Learn. Build. Ship.')
  assert.match(v.summary, /kid-powered creation studio/)
  assert.equal(v.pillars.length, 4)
  assert.ok(v.ctas.includes('Enter the Lab'))
  assert.ok(v.persona.forbidden.includes('corporate buzzwords'))
  // Art direction is NULL after identity v2: the old "late-night workshop inside
  // a nebula" paragraph described the superseded visual world, and v2's
  // replacement lives on an art-director canvas that wasn't in the handoff zip
  // (battle-test M1). Shipping the old one would art-direct the wrong brand.
  assert.equal(v.artDirection, null)
})

test('voice: a declared language returns its own copy, never the English', async () => {
  const { voiceBlock } = await import('../src/voice.js')
  const { doc } = resolveBrand(base, overlay)
  const id = voiceBlock(doc, { lang: 'id' })
  assert.equal(id.lang, 'id')
  // F3 wrote ArgantaLab's Indonesian. Serving English here would silently ship
  // the wrong language to an ID audience — worse than an obvious gap.
  assert.equal(id.tagline, 'Main. Belajar. Bikin. Rilis.')
  assert.equal(voiceBlock(doc, { lang: 'en' }).tagline, 'Play. Learn. Build. Ship.')
})

test('voice: a language with no copy falls back rather than inventing it', async () => {
  const { voiceBlock } = await import('../src/voice.js')
  const { BRAND_BASES, SEED_OVERLAYS } = await import('../src/index.js')
  // Circle HQ is internal and declares English only — asking for ID must give
  // the English line, not an empty string and never a hallucinated translation.
  const { doc } = resolveBrand(BRAND_BASES.circlehq, SEED_OVERLAYS.circlehq)
  assert.equal(voiceBlock(doc, { lang: 'id' }).tagline, 'Complexity into clarity.')
})

test('voice: a brand with nothing said about it does not claim a voice', async () => {
  const { voiceBlock, hasVoice } = await import('../src/voice.js')
  const { doc } = resolveBrand(JSON.parse(JSON.stringify(base)), {})  // no founder overlay
  assert.equal(hasVoice(doc), false)
  const v = voiceBlock(doc)
  assert.equal(v.persona, undefined, 'no persona should be asserted for a voiceless brand')
  assert.equal(v.name, 'ArgantaLab')
  // Art direction would ride along here even for a voiceless brand (it is
  // agent-lane) — but v2 hasn't delivered it yet, so there is nothing to carry.
  assert.equal(v.artDirection, null)
})

test('voice: handle is normalised to @form regardless of how it was typed', async () => {
  const { voiceBlock } = await import('../src/voice.js')
  const { doc } = resolveBrand(base, deepMerge(overlay, { presence: { instagram: { handle: 'argantalab' } } }))
  assert.equal(voiceBlock(doc).handle, '@argantalab')
})

// ── BF-3: the engine must be able to render any brand ─────────
test('bases: every shipped brand is structurally valid and has a palette', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  for (const [id, b] of Object.entries(BRAND_BASES)) {
    const { doc, errors } = resolveBrand(b, {})
    assert.deepEqual(errors, [], `${id} is invalid`)
    assert.ok(doc.identity.palette.accent, `${id} has no accent`)
  }
})

test('bases: all five carry a real mark — handoff v2 delivered the set', async () => {
  const { BRAND_BASES, BRAND_ORDER } = await import('../src/index.js')
  // Before v2 only two brands had artwork and three rendered an honest
  // "MARK · P0". The monoline constellation completed the portfolio, so the
  // placeholder path is now unused — but it stays in the renderer, because the
  // next new brand will need it again.
  for (const id of BRAND_ORDER) {
    assert.ok(BRAND_BASES[id].identity.mark?.variants?.core?.length, `${id} has no mark`)
  }
})

// BS-0: the portfolio the founder locked — five brands, no "Landing", and
// Circle HQ present (it was missing from this file entirely).
test('portfolio: BRAND_ORDER is the locked five, in presentation order', async () => {
  const { BRAND_ORDER, BRAND_BASES, PUBLIC_BRAND_IDS, BRAND_ROLE, orderedBases } = await import('../src/index.js')
  assert.deepEqual(BRAND_ORDER, ['arganta', 'argantalab', 'kinetikcircle', 'lashirabloom', 'circlehq'])
  assert.equal(Object.keys(BRAND_BASES).length, 5)
  assert.ok(!('landing' in BRAND_BASES), '"Landing" is retired — apps/landing IS Arganta')
  assert.ok('circlehq' in BRAND_BASES, 'Circle HQ is a brand, not a surface')
  assert.ok(!PUBLIC_BRAND_IDS.includes('circlehq'), 'Circle HQ is internal — never audited for social presence')
  assert.equal(orderedBases().length, 5)
  for (const id of BRAND_ORDER) assert.ok(BRAND_ROLE[id], `${id} has no role label`)
})

test('portfolio: Kinetik Circle uses its public spelling', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  assert.equal(BRAND_BASES.kinetikcircle.name, 'Kinetik Circle')
  assert.equal(BRAND_BASES.kinetikcircle.id, 'kinetikcircle', 'the code id never changes')
})

test('portfolio: every brand routes to its locked domain', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  assert.equal(BRAND_BASES.arganta.routing.siteUrl, 'https://www.arganta.app')
  assert.equal(BRAND_BASES.argantalab.routing.siteUrl, 'https://lab.arganta.app')
  assert.equal(BRAND_BASES.kinetikcircle.routing.siteUrl, 'https://circle.arganta.app')
  assert.equal(BRAND_BASES.lashirabloom.routing.siteUrl, 'https://bloom.arganta.app')
  assert.equal(BRAND_BASES.circlehq.routing.siteUrl, 'https://hq.arganta.app')
})

test('seeds: every brand has a founder-lane seed that is legal to store', async () => {
  const { SEED_OVERLAYS, BRAND_ORDER } = await import('../src/index.js')
  for (const id of BRAND_ORDER) {
    const s = SEED_OVERLAYS[id]
    assert.ok(s, `${id} has no seed`)
    assert.ok(!('_note' in s), `${id}'s seed leaks its _note into the overlay`)
    // The seed goes into the DB — it must contain founder-lane fields only.
    assert.deepEqual(illegalOverlayPaths(s), [], `${id}'s seed carries agent-lane fields`)
    assert.ok(s.voice?.persona?.title, `${id} has no persona`)
  }
})

test('seeds: base + seed resolves into a brand that can actually speak', async () => {
  const { BRAND_BASES, SEED_OVERLAYS } = await import('../src/index.js')
  const { voiceBlock } = await import('../src/voice.js')
  for (const id of ['arganta', 'kinetikcircle', 'lashirabloom', 'circlehq']) {
    const { doc, errors } = resolveBrand(BRAND_BASES[id], SEED_OVERLAYS[id])
    assert.deepEqual(errors, [], `${id} invalid after seed`)
    const v = voiceBlock(doc)
    assert.ok(v.persona.title, `${id} still has no voice`)
    assert.ok(v.tagline, `${id} has no tagline`)
  }
})

test('seeds: Circle HQ stays internal — no social presence seeded', async () => {
  const { SEED_OVERLAYS } = await import('../src/index.js')
  assert.equal(SEED_OVERLAYS.circlehq.presence, undefined)
  assert.deepEqual(SEED_OVERLAYS.circlehq.voice.languages, ['en'], 'internal tooling needs no ID copy')
})

test('bases: an unknown brand id falls back to the default rather than rendering blank', async () => {
  const { brandBase, DEFAULT_BRAND_ID } = await import('../src/index.js')
  assert.equal(DEFAULT_BRAND_ID, 'kinetikcircle')
  assert.equal(brandBase('nope').id, 'kinetikcircle')
  assert.equal(brandBase('argantalab').id, 'argantalab')
  assert.equal(brandBase(undefined).id, 'kinetikcircle')
})

test('bases: brands are one system — shared ground, distinct wavelength', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  const a = BRAND_BASES.argantalab.identity
  const k = BRAND_BASES.kinetikcircle.identity
  // "One light, five wavelengths": identity v2 SHARES the ground, ink and canvas
  // on purpose — that is what makes five brands read as one company. Only the
  // hue and the geometry separate them. (Pre-v2 they shared nothing, which is
  // why the portfolio looked like five startups.)
  assert.equal(a.palette.bg, k.palette.bg)
  assert.equal(a.mark.viewBox, k.mark.viewBox)
  assert.notEqual(a.palette.accent, k.palette.accent)
  assert.notDeepEqual(a.mark.variants.core, k.mark.variants.core)
})

test('bases: kinetikcircle wears Resonance Rings — the K-mark is superseded', async () => {
  const { BRAND_BASES } = await import('../src/index.js')
  const svg = markToSvg(BRAND_BASES.kinetikcircle.identity.mark, { size: 120 })
  assert.match(svg, /viewBox="0 0 120 120"/)
  assert.match(svg, /stop-color="#EC93B5"/)                       // Pulse
  assert.match(svg, /<circle [^>]*cx="60" cy="60" r="38"/)        // the outer ring
  assert.match(svg, /d="M60 36 A24 24 0 1 1 39 48"/)              // the BROKEN ring
  assert.match(svg, /<circle [^>]*cx="60" cy="22" r="4"/)         // the star on orbit
  // the procedural K-mark BF-3 rescued out of postEngine is gone from the data
  assert.ok(!svg.includes('#22D3EE'), 'the old cyan tile must not survive')
})

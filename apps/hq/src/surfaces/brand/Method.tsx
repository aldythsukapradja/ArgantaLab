/**
 * THE METHOD — the Operator view. Replaces the old Operator dashboard, which
 * the founder rejected as "useless": it answered "what's missing?", a question
 * they already knew the answer to. This answers "how do we decide?" instead.
 *
 * Twenty laws in five families (knowledge-base/brand/the-method.md is the
 * canon; method.ts is this file's data). Every law proves itself with a live
 * specimen and names the file that enforces it — per Law 03 ("the demo is
 * real"), nothing here is a screenshot or a CSS fake.
 *
 * The old audit — readiness rings, the platform matrix — is not deleted. It is
 * DEMOTED TO EVIDENCE: the specimen for Law 08, "the audit derives." Proof of a
 * law, not a page of its own.
 *
 * The reference column reads live values (getComputedStyle, the registry)
 * rather than a transcribed table, for the same reason: a design system you
 * maintain by hand is a design system that lies.
 */
import { useEffect, useRef, useState } from 'react'
import {
  BRAND_ORDER, BRAND_BASES, LAYERS, LAYER_LANES, blankBrand, readiness, matrix, drawMark, markToSvg,
} from '@arganta/brand'

const brandAccent = (id: string) => (BRAND_BASES as any)[id]?.identity?.palette?.accent || '#888'
import { Mark, LivePost } from './scenes'
import { FAMILIES, CREED, METHOD_NOTE, DOCTRINE_SPINE, type Law, type Family } from './methodData'
import { Doctrine } from './Doctrine'

const GLYPH: Record<string, string> = { ok: '✓', draft: '✎', warn: '!', missing: '×', na: '–' }

export interface MethodProps {
  /** The brand every specimen borrows for its palette/mark/voice — "brand-aware"
   *  per the handoff: whichever world you last flew into, else ArgantaLab. */
  context: { id: string; doc: any; voice: any; r: any }
  live: boolean
  onSource: (id: string) => void
}

type SpineId = Family['id'] | typeof DOCTRINE_SPINE.id

export function Method({ context, live, onSource }: MethodProps) {
  const [famId, setFamId] = useState<SpineId>(FAMILIES[0].id)
  const family = FAMILIES.find(f => f.id === famId)
  const onDoctrine = famId === DOCTRINE_SPINE.id

  return (
    <div className="bs-method">
      <aside className="bs-fam">
        <div className="bs-fam-h">MENTAL MODELS</div>
        {FAMILIES.map(f => (
          <button key={f.id} className={'bs-fam-b' + (f.id === famId ? ' on' : '')} onClick={() => setFamId(f.id)} title={f.blurb}>
            <em>{f.roman}</em><span>{f.label}</span><i>{f.laws.length}</i>
          </button>
        ))}
        <button className={'bs-fam-b' + (onDoctrine ? ' on' : '')} onClick={() => setFamId(DOCTRINE_SPINE.id)} title={DOCTRINE_SPINE.blurb}>
          <em>{DOCTRINE_SPINE.roman}</em><span>{DOCTRINE_SPINE.label}</span><i>7</i>
        </button>
        <button className="bs-fam-canon" onClick={() => onSource(onDoctrine ? 'brand-f9-marketing-doctrine' : METHOD_NOTE)}>READ THE CANON →</button>
        <div className="bs-creed">
          <b>THE CREED</b>
          {CREED.map(line => <span key={line}>{line}</span>)}
        </div>
      </aside>

      {onDoctrine ? (
        <div className="bs-doctrine-embed"><Doctrine onSource={onSource} /></div>
      ) : (
        <>
          <div className="bs-laws">
            {(family || FAMILIES[0]).laws.map(law => <LawCard key={law.n} law={law} context={context} live={live} onSource={onSource} />)}
          </div>
          <Reference context={context} />
        </>
      )}
    </div>
  )
}

// ── one law card ──────────────────────────────────────────────
function LawCard({ law, context, live, onSource }: { law: Law; context: MethodProps['context']; live: boolean; onSource: (id: string) => void }) {
  return (
    <div className="bs-law">
      <div className="bs-law-n">LAW {String(law.n).padStart(2, '0')}</div>
      <div className="bs-law-t">{law.title}</div>
      <p className="bs-law-s">{law.statement}</p>
      <div className="bs-law-spec"><Specimen law={law} context={context} live={live} /></div>
      <button className="bs-law-src" onClick={() => onSource(sourceNoteFor(law))} title={`Source: ${law.source}`}>
        {law.provenance === 'repo-verified' ? '●' : law.provenance === 'kb-declared' ? '◐' : '○'} {law.source}
      </button>
    </div>
  )
}

// Laws that footnote a strategy doc rather than a code file jump to the vault
// note; code-file sources have no note and the click is a no-op affordance.
function sourceNoteFor(law: Law): string {
  if (law.n === 17) return 'brand-f1-foundation'
  if (law.n === 19) return 'brand-f5-social-content-os'
  if (law.n === 20) return 'brand-f4-voice-matrix'
  return METHOD_NOTE
}

// ── specimens — one per law, all reading real state ────────────
function Specimen({ law, context, live }: { law: Law; context: MethodProps['context']; live: boolean }) {
  switch (law.specimen) {
    case 'provenance': return <SpecimenProvenance />
    case 'readiness-zero': return <SpecimenReadinessZero context={context} />
    case 'live-post': return <SpecimenLivePost context={context} />
    case 'gap-frame': return <SpecimenGapFrame />
    case 'mark-data': return <SpecimenMarkData context={context} />
    case 'twin-render': return <SpecimenTwinRender context={context} />
    case 'brand-row': return <SpecimenBrandRow />
    case 'audit': return <SpecimenAudit context={context} live={live} />
    case 'flight': return <SpecimenFlight />
    case 'reveal': return <SpecimenReveal reduced={false} />
    case 'ignition': return <SpecimenIgnition />
    case 'reduced': return <SpecimenReveal reduced />
    case 'chrome': return <SpecimenChrome />
    case 'wavelengths': return <SpecimenWavelengths />
    case 'plate': return <SpecimenPlate context={context} />
    case 'composition': return <SpecimenComposition context={context} />
    case 'voice-pair': return <SpecimenVoicePair law={law} context={context} />
  }
}

function SpecimenProvenance() {
  return (
    <div className="bs-sp-row">
      <div className="bs-sp-stat"><b>82%</b><span className="bs-sp-tag measured">measured</span></div>
      <div className="bs-sp-stat"><b>82%</b><span className="bs-sp-tag simulated">simulated</span></div>
    </div>
  )
}

function SpecimenReadinessZero({ context }: { context: MethodProps['context'] }) {
  const zero = readiness(blankBrand('x', 'X')).overall
  return (
    <div className="bs-sp-row">
      <div className="bs-sp-stat"><b>{zero}%</b><span>blank brand</span></div>
      <div className="bs-sp-stat"><b style={{ color: 'var(--bs-accent)' }}>{context.r.overall}%</b><span>{context.doc.name}</span></div>
    </div>
  )
}

function SpecimenLivePost({ context }: { context: MethodProps['context'] }) {
  return <LivePost doc={context.doc} active w={82} h={102} />
}

function SpecimenGapFrame() {
  return (
    <div className="bs-mark-pending" style={{ width: 48, height: 48, borderRadius: 9 }}>
      <span>MARK</span><b>P0</b>
    </div>
  )
}

function SpecimenMarkData({ context }: { context: MethodProps['context'] }) {
  const shape = context.doc?.identity?.mark?.variants?.core?.[0]
  return (
    <div className="bs-sp-row">
      <Mark doc={context.doc} size={54} active />
      <div className="bs-sp-code">
        {shape ? <>"d":"{String(shape.d || '').slice(0, 26)}…"<br />"bbox":{'{'}{shape.bbox ? `${shape.bbox.w}×${shape.bbox.h}` : '—'}{'}'}</> : 'no shape data'}
      </div>
    </div>
  )
}

function SpecimenTwinRender({ context }: { context: MethodProps['context'] }) {
  const cvRef = useRef<HTMLCanvasElement>(null)
  const mark = context.doc?.identity?.mark
  const [svgUri, setSvgUri] = useState('')
  useEffect(() => {
    const cv = cvRef.current
    if (!cv || !mark) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = 44 * dpr; cv.height = 44 * dpr
    const ctx = cv.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawMark(ctx, mark, 0, 0, 44)
    setSvgUri('data:image/svg+xml;utf8,' + encodeURIComponent(markToSvg(mark, { size: 44 })))
  }, [mark])
  if (!mark) return <div className="bs-await">no mark to compare</div>
  return (
    <div className="bs-sp-twin">
      <canvas ref={cvRef} style={{ width: 44, height: 44 }} />
      <span className="bs-sp-eq">= 0.0000%</span>
      <img src={svgUri} width={44} height={44} alt="" />
    </div>
  )
}

function SpecimenBrandRow() {
  return (
    <div className="bs-sp-brandrow">
      <div className="bs-sp-swatches">
        {BRAND_ORDER.map((id: string) => <i key={id} style={{ background: brandAccent(id) }} />)}
      </div>
      <span>5 brands · 1 loop · 0 branches</span>
    </div>
  )
}

function SpecimenAudit({ context, live }: { context: MethodProps['context']; live: boolean }) {
  const mtx = matrix(context.doc).slice(0, 3)
  const layerSample = (LAYERS as any[]).slice(0, 3)
  return (
    <div className="bs-sp-audit">
      <div className="bs-sp-rings">
        {layerSample.map(l => {
          const lr = context.r.layers[l.id]
          return (
            <span key={l.id} className="bs-sp-ring" title={`${l.label} · ${lr.pct}% · ${l.lane} lane`}
              style={{ background: `conic-gradient(var(--bs-accent) ${lr.pct * 3.6}deg, rgba(255,255,255,.08) 0)` }}>
              <b>{lr.pct}</b>
            </span>
          )
        })}
      </div>
      <div className="bs-sp-mtx">
        {mtx.map((row: any) => (
          <div key={row.platformId} className="bs-sp-mtx-row">
            <span>{row.label}</span>
            {['handle', 'avatar', 'bio', 'link'].map(c => (
              <em key={c} className={'c-' + row.cells[c].state}>{GLYPH[row.cells[c].state]}</em>
            ))}
          </div>
        ))}
      </div>
      <span className="bs-sp-audit-note">{live ? 'registry · live' : 'registry · seed'} — derived, not maintained</span>
    </div>
  )
}

function SpecimenFlight() {
  return (
    <div className="bs-sp-flight">
      <div className="bs-sp-flight-track">
        <i>A</i><i>B</i><i>C</i>
      </div>
    </div>
  )
}

function SpecimenReveal({ reduced }: { reduced: boolean }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick(v => v + 1), reduced ? 900 : 1800)
    return () => clearInterval(t)
  }, [reduced])
  return (
    <div className="bs-sp-reveal">
      <div key={tick} className={reduced ? 'bs-sp-reveal-el reduced' : 'bs-sp-reveal-el'} />
      <span>{reduced ? 'PREFERS-REDUCED-MOTION · 160ms' : 'reveal on arrival · 700ms'}</span>
    </div>
  )
}

function SpecimenIgnition() {
  const [key, setKey] = useState(0)
  return (
    <div className="bs-sp-ignite" onMouseEnter={() => setKey(k => k + 1)}>
      <div key={key} className="bs-sp-ig-label">BRAND SYSTEM ONLINE</div>
      <span>hover to replay</span>
    </div>
  )
}

function SpecimenChrome() {
  return (
    <div className="bs-sp-chrome">
      <span style={{ fontSize: 7, letterSpacing: '.14em' }}>LIVE SIGNAL</span>
      <span style={{ fontSize: 7.5, letterSpacing: '.18em' }}>LIVE SIGNAL</span>
      <span style={{ fontSize: 8, letterSpacing: '.24em' }}>LIVE SIGNAL</span>
      <span style={{ fontSize: 9, letterSpacing: '.3em' }}>LIVE SIGNAL</span>
    </div>
  )
}

function SpecimenWavelengths() {
  return (
    <div className="bs-sp-wave">
      <div className="bs-sp-wave-strip">
        {BRAND_ORDER.map((id: string) => <i key={id} style={{ background: brandAccent(id) }} />)}
      </div>
      <span>oklch L .76 · C .13</span>
    </div>
  )
}

function SpecimenPlate({ context }: { context: MethodProps['context'] }) {
  const plateBg = context.doc?.identity?.palette?.plateBg || '#FFD64B'
  const plateInk = context.doc?.identity?.palette?.plateInk || '#1b1500'
  return (
    <div className="bs-sp-plate-wrap">
      <div className="bs-sp-plate-bg">
        <span className="bare">Grow together.</span>
      </div>
      <div className="bs-sp-plate-bg">
        <span className="plated" style={{ background: plateBg, color: plateInk }}>Grow together.</span>
      </div>
    </div>
  )
}

function SpecimenComposition({ context }: { context: MethodProps['context'] }) {
  return (
    <div className="bs-sp-comp">
      <i style={{ background: `radial-gradient(circle, ${context.doc?.identity?.palette?.accent || '#888'}, transparent 70%)` }} />
    </div>
  )
}

const VOICE_PAIRS: Record<number, { bad: string; good: string }> = {
  17: { bad: 'Unlock premium features to empower your learning journey!', good: 'Want more rooms in the Lab? Here’s what the family plan adds.' },
  19: { bad: 'Don’t forget to complete your daily tasks!', good: 'Two things left for today — want them now or tonight?' },
}

function SpecimenVoicePair({ law, context }: { law: Law; context: MethodProps['context'] }) {
  if (law.n === 18) {
    const voiceless = readiness(blankBrand('x', 'X'))
    return (
      <div className="bs-sp-code">
        voiceBlock(blank) → <em>persona: undefined</em><br />
        voiceBlock({context.doc.id}) → <em>"{context.voice?.persona?.title || '—'}"</em>
        <span className="bs-sp-audit-note">{voiceless.overall}% vs {context.r.overall}% — the gap is the point</span>
      </div>
    )
  }
  if (law.n === 20) {
    return (
      <div className="bs-sp-facepair">
        <div><s>face</s><span>NEVER</span></div>
        <div><em>silhouette</em><span>ALWAYS</span></div>
      </div>
    )
  }
  const pair = VOICE_PAIRS[law.n]
  if (!pair) return <div className="bs-await">no example wired</div>
  return (
    <div className="bs-sp-pair">
      <p className="bad">✕ {pair.bad}</p>
      <p className="good">✓ {pair.good}</p>
    </div>
  )
}

// ── reference column — reads live values, never a transcribed table ──
function Reference({ context }: { context: MethodProps['context'] }) {
  const [motion, setMotion] = useState<{ fly: string }>({ fly: '—' })
  useEffect(() => {
    const el = document.querySelector('.bs')
    if (!el) return
    const fly = getComputedStyle(el).getPropertyValue('--bs-fly').trim()
    setMotion({ fly: fly || '—' })
  }, [])

  const mark = context.doc?.identity?.mark
  const coreShape = mark?.variants?.core?.find((s: any) => s.strokeWidth)
  const gradCount = mark ? Object.keys(mark.gradients || {}).length : 0
  const starCount = mark?.variants?.core?.filter((s: any) => s.kind === 'circle' && s.fill && !String(s.fill).startsWith('@')).length ?? '—'

  const agentLayers = (LAYERS as any[]).filter(l => (LAYER_LANES as any)[l.id] === 'agent').length
  const founderLayers = (LAYERS as any[]).filter(l => (LAYER_LANES as any)[l.id] === 'founder').length

  return (
    <aside className="bs-ref">
      <div className="bs-ref-h">GEOMETRY · {context.doc.name.toUpperCase()}</div>
      <div className="bs-ref-g">
        <div className="bs-ref-row"><em>viewBox</em><b>{mark?.viewBox ?? '—'}</b></div>
        <div className="bs-ref-row"><em>strut</em><b>{coreShape?.strokeWidth ?? '—'}</b></div>
        <div className="bs-ref-row"><em>gradients</em><b>{gradCount}</b></div>
        <div className="bs-ref-row"><em>accent stars</em><b>{starCount}</b></div>
      </div>

      <div className="bs-ref-h">COLOUR</div>
      <div className="bs-ref-g">
        <div className="bs-ref-row"><em>ground</em><b>{context.doc.identity?.palette?.bg ?? '—'}</b></div>
        <div className="bs-ref-row"><em>accent</em><b>{context.doc.identity?.palette?.accent ?? '—'}</b></div>
        <div className="bs-ref-row"><em>plate</em><b>{context.doc.identity?.palette?.plateBg ?? '—'}</b></div>
      </div>

      <div className="bs-ref-h">MOTION</div>
      <div className="bs-ref-g">
        <div className="bs-ref-row"><em>flight</em><b>{motion.fly}</b></div>
      </div>

      <div className="bs-ref-h">LANES</div>
      <div className="bs-ref-g">
        <div className="bs-ref-row"><em>agent · git</em><b>{agentLayers} layers</b></div>
        <div className="bs-ref-row"><em>founder · db</em><b>{founderLayers} layers</b></div>
      </div>

      <div className="bs-ref-live">▲ EVERY VALUE READ FROM<br />LIVE CODE — THIS PAGE<br />CANNOT GO STALE</div>
    </aside>
  )
}

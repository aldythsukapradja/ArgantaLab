/**
 * BRAND STUDIO — the scenes of a brand's lane.
 *
 * Five scenes per world: Cover · Belief · World · Voice · In the Wild. Each is
 * sized to the viewport and reveals on arrival (nothing is merely *there* — the
 * house language, from apps/landing's stage).
 *
 * Two rules run through every scene:
 *  1. REAL OR HONEST. Everything is rendered from the registry by the same code
 *     that ships it — drawMark stamps the mark, drawSlide renders the carousel.
 *     Where a brand has nothing yet, the scene says so in cockpit vocabulary
 *     (AWAITING VOICE · MARK · P0). It never invents a placeholder.
 *  2. THE SOURCE IS NAMED. Each scene footnotes the strategy doc it embodies,
 *     so the operator can jump from the show to the canon.
 */
import { useEffect, useRef, useState } from 'react'
import { drawMark } from '@arganta/brand'
import { drawSlide, postFormat, type PostDoc } from '../broadcast/postEngine'
import { makeSlide } from '../broadcast/postTemplates'

export interface SceneProps { doc: any; voice: any; active: boolean; onSource: (id: string) => void }

// ── shared bits (the house grammar: kicker, gradient-em, mono footnote) ──
export function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="bs-kicker"><i className="bs-kdot" />{children}</div>
}
export function Source({ id, label, onSource }: { id: string; label: string; onSource: (id: string) => void }) {
  return <button className="bs-source" onClick={() => onSource(id)} title={`Open ${label} in the HQ Vault`}>SOURCE · {label}</button>
}
const langLine = (v: any, key: string) => v?.[key]

/** The mark, drawn by the same function that stamps every carousel — or an
 *  honest dashed frame when ChatGPT's P0 concept hasn't landed yet. */
export function Mark({ doc, size, variant = 'core', active }: { doc: any; size: number; variant?: string; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const mark = doc?.identity?.mark
  useEffect(() => {
    const cv = ref.current
    if (!cv || !mark || !active) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    cv.width = size * dpr; cv.height = size * dpr
    const ctx = cv.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)
    drawMark(ctx, mark, 0, 0, size, variant)
  }, [mark, size, variant, active])

  if (!mark) {
    return (
      <div className="bs-mark-pending" style={{ width: size, height: size, borderRadius: size * 0.19 }}>
        <span>MARK</span><b>P0</b>
      </div>
    )
  }
  return <canvas ref={ref} className="bs-mark" style={{ width: size, height: size }} />
}

// ── I · COVER ─────────────────────────────────────────────────
export function SceneCover({ doc, voice, active, onSource }: SceneProps) {
  const t = voice?.tagline
  const tId = doc?.voice?.taglines?.id
  const internal = doc.id === 'circlehq'
  return (
    <div className={'bs-scene bs-cover' + (active ? ' in' : '')}>
      <div className="bs-cover-glow" />
      <div className="bs-r bs-r1"><Mark doc={doc} size={200} variant="core" active={active} /></div>
      <h1 className="bs-r bs-r2 bs-display">{doc.name}</h1>
      {t ? <p className="bs-r bs-r3 bs-tag">{t}</p> : <p className="bs-r bs-r3 bs-await">AWAITING TAGLINE · FOUNDER LANE</p>}
      {tId && <p className="bs-r bs-r4 bs-tag-id">{tId}</p>}
      <p className="bs-r bs-r5 bs-partof">
        {internal ? <>INTERNAL SURFACE · NOT MARKETED</> : doc.id === 'arganta' ? <>THE MASTERBRAND · THE GATEWAY</> : <>PART OF <b>ARGANTA</b></>}
      </p>
      <Source id="brand-f1-foundation" label="F1 FOUNDATION" onSource={onSource} />
    </div>
  )
}

// ── II · BELIEF ───────────────────────────────────────────────
export function SceneBelief({ doc, voice, active, onSource }: SceneProps) {
  const head = doc?.voice?.beliefHeadline?.en as string | undefined
  const headId = doc?.voice?.beliefHeadline?.id as string | undefined
  const body = voice?.summary || doc?.voice?.boilerplates?.en?.w50
  // The headline's last word carries the gradient — one emphasis, never two.
  const parts = head ? head.split(' ') : []
  const lead = parts.slice(0, -1).join(' ')
  const last = parts.slice(-1)[0]?.replace(/[.!?]$/, '')
  const punct = parts.slice(-1)[0]?.match(/[.!?]$/)?.[0] || ''
  return (
    <div className={'bs-scene bs-belief' + (active ? ' in' : '')}>
      <Kicker>ACT II · WHAT WE BELIEVE</Kicker>
      {head ? (
        <h2 className="bs-r bs-r1 bs-belief-h">{lead} <em>{last}</em>{punct}</h2>
      ) : (
        <h2 className="bs-r bs-r1 bs-belief-h bs-await-h">AWAITING BELIEF<br /><span>founder lane · F1</span></h2>
      )}
      {body && <p className="bs-r bs-r2 bs-belief-p">{body}</p>}
      {headId && <p className="bs-r bs-r3 bs-belief-id">{headId}</p>}
      {voice?.tagline && (
        <div className="bs-r bs-r4 bs-promise"><b>{voice.tagline}</b>{langLine(doc?.voice?.taglines, 'id') && <span>{doc.voice.taglines.id}</span>}</div>
      )}
      <Source id="brand-f1-foundation" label="F1 FOUNDATION" onSource={onSource} />
    </div>
  )
}

// ── III · THE WORLD (palette + art direction) ─────────────────
const ROLE_NAME: Record<string, string> = {
  bg: 'Ground', bgAlt: 'Depth', ink: 'Ink', soft: 'Muted', accent: 'Accent', plateBg: 'Text plate', plateInk: 'Plate ink',
}
export function SceneWorld({ doc, active, onSource }: Omit<SceneProps, 'voice'> & { voice?: any }) {
  const pal = doc?.identity?.palette || {}
  const accents = doc?.identity?.accents || {}
  const art = doc?.kb?.artDirection
  const bands = Object.entries(pal).filter(([, v]) => v) as [string, string][]
  return (
    <div className={'bs-scene bs-world' + (active ? ' in' : '')}>
      <Kicker>ACT III · THE VISUAL WORLD</Kicker>
      <div className="bs-bands">
        {bands.map(([k, v], i) => (
          <div key={k} className="bs-r bs-band" style={{ background: v, animationDelay: `${120 + i * 60}ms` }}>
            <div className="bs-band-l" style={{ color: pickInk(v) }}>
              <b>{ROLE_NAME[k] || k}</b>
              <span>{v.toUpperCase()}</span>
            </div>
          </div>
        ))}
      </div>
      {Object.keys(accents).length > 0 && (
        <div className="bs-r bs-r3 bs-accents">
          {Object.entries(accents).map(([k, v]) => (
            <span key={k} className="bs-acc" title={`${k} · ${v}`}><i style={{ background: String(v) }} />{k}</span>
          ))}
        </div>
      )}
      {art ? (
        <p className="bs-r bs-r4 bs-art">{art}
          <em>This paragraph ships inside every image generation for this brand — the style guide is executable.</em>
        </p>
      ) : (
        <p className="bs-r bs-r4 bs-art bs-art-await">AWAITING ART DIRECTION · AGENT LANE
          <em>ChatGPT returns the pack (P0) → Claude Code canonizes it into kb.artDirection → every generated image obeys it.</em>
        </p>
      )}
      <Source id="chatgpt-visual-production-handoff" label="VISUAL HANDOFF" onSource={onSource} />
    </div>
  )
}
function pickInk(hex: string) {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const r = parseInt(v.slice(0, 2), 16), g = parseInt(v.slice(2, 4), 16), b = parseInt(v.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5 ? 'rgba(255,255,255,.92)' : 'rgba(0,0,0,.8)'
}

// ── IV · VOICE ────────────────────────────────────────────────
export function SceneVoice({ voice, active, onSource }: Omit<SceneProps, 'doc'> & { doc?: any }) {
  const p = voice?.persona || {}
  return (
    <div className={'bs-scene bs-voice' + (active ? ' in' : '')}>
      <Kicker>ACT IV · WHO IS SPEAKING</Kicker>
      <div className="bs-voice-grid">
        <div>
          {p.title ? <div className="bs-r bs-r1 bs-persona">{p.title}</div>
            : <div className="bs-r bs-r1 bs-persona bs-await-h">AWAITING VOICE</div>}
          {p.adjectives?.length > 0 && <div className="bs-r bs-r2 bs-adj">{p.adjectives.join(' · ')}</div>}
          {p.speaksAs && <p className="bs-r bs-r3 bs-speaks">{p.speaksAs}</p>}
          {p.forbidden?.length > 0 && (
            <div className="bs-r bs-r4 bs-never">NEVER — {p.forbidden.join(' · ')}</div>
          )}
          {!p.title && <p className="bs-r bs-r3 bs-speaks bs-dim">No persona in the registry. A brand told to speak with no voice writes confident nonsense — so it stays silent until the founder lane says otherwise.</p>}
        </div>
        <div className="bs-pillars">
          {(voice?.pillars || []).map((pl: any, i: number) => (
            <div key={pl.id} className="bs-r bs-pillar" style={{ animationDelay: `${200 + i * 80}ms`, borderColor: hexA(pl.accent, 0.4) }}>
              <i style={{ background: pl.accent }} />
              <b>{pl.label}</b>
              <span>{pl.description}</span>
            </div>
          ))}
          {!(voice?.pillars || []).length && <div className="bs-await">AWAITING PILLARS · FOUNDER LANE</div>}
        </div>
      </div>
      <Source id="brand-f4-voice-matrix" label="F4 VOICE MATRIX" onSource={onSource} />
    </div>
  )
}
const hexA = (hex: string, a: number) => {
  if (!hex?.startsWith('#')) return `rgba(255,255,255,${a})`
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return `rgba(${parseInt(v.slice(0, 2), 16)},${parseInt(v.slice(2, 4), 16)},${parseInt(v.slice(4, 6), 16)},${a})`
}

// ── V · IN THE WILD — the live engines ────────────────────────
/** The actual publishing pipeline, drawing on stage. Not a mockup: makeSlide +
 *  drawSlide with RenderEnv.brand — the same calls Post Studio makes before it
 *  queues to Instagram. Change a hex in brand.json and this changes. */
function LivePost({ doc, active }: { doc: any; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [i, setI] = useState(0)
  const handle = doc?.presence?.instagram?.handle
    ? '@' + String(doc.presence.instagram.handle).replace(/^@/, '')
    : '@' + doc.id

  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setI(v => (v + 1) % 2), 3600)
    return () => clearInterval(t)
  }, [active])

  useEffect(() => {
    const cv = ref.current
    if (!cv || !active) return
    const post: PostDoc = {
      v: 1, format: 'portrait', palette: 'kinetik', brandId: doc.id,
      slides: [
        makeSlide('hook', { headline: doc?.voice?.taglines?.en || doc.name, body: doc?.voice?.boilerplates?.en?.w25?.slice(0, 60), badge: 'START HERE' }),
        makeSlide('cta', { headline: 'Enjoyed this?', body: (doc?.voice?.ctas?.en || [])[0] || 'Follow for the build log.', handle }),
      ],
      caption: '', hashtags: '', brand: { name: doc.name, handle },
    }
    const f = postFormat('portrait')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const W = 300, H = 375
    cv.width = W * dpr; cv.height = H * dpr
    const ctx = cv.getContext('2d')!
    ctx.setTransform((W / f.w) * dpr, 0, 0, (H / f.h) * dpr, 0, 0)
    drawSlide(ctx, post, i, f.w, f.h, { getImg: () => null, brand: doc })
  }, [doc, i, active])

  return <canvas ref={ref} className="bs-post" style={{ width: 300, height: 375 }} />
}

export function SceneWild({ doc, active, onSource }: Omit<SceneProps, 'voice'> & { voice?: any }) {
  const ig = doc?.presence?.instagram || {}
  const internal = doc.id === 'circlehq'
  return (
    <div className={'bs-scene bs-wild' + (active ? ' in' : '')}>
      <Kicker>ACT V · IN THE WILD — RENDERED LIVE</Kicker>
      {internal ? (
        <div className="bs-r bs-r1 bs-internal">
          <b>Circle HQ has no wild.</b>
          <p>It is the cockpit, not a product with an audience. No account, no feed, no app-store page — by decision, not by omission.</p>
          <span className="bs-await">NO PUBLIC PRESENCE · BY DESIGN</span>
        </div>
      ) : (
        <div className="bs-wild-grid">
          <div className="bs-r bs-r1 bs-device"><LivePost doc={doc} active={active} /></div>
          <div className="bs-r bs-r2 bs-profile">
            <div className="bs-pf-head">
              <div className="bs-pf-ava"><div className="bs-pf-ava-in"><Mark doc={doc} size={58} variant={doc?.identity?.mark?.variants?.profile ? 'profile' : 'core'} active={active} /></div></div>
              <div className="bs-pf-id">
                <b>{ig.handle ? '@' + String(ig.handle).replace(/^@/, '') : <span className="bs-await">NO HANDLE CLAIMED</span>}</b>
                <span>{ig.category || '—'}</span>
              </div>
            </div>
            {ig.bio ? <p className="bs-pf-bio">{ig.bio}</p> : <p className="bs-pf-bio bs-dim">AWAITING BIO · FOUNDER LANE</p>}
            {ig.link && <p className={'bs-pf-link' + (ig.linkVerified ? '' : ' unver')}>{ig.link.replace(/^https?:\/\//, '')}{!ig.linkVerified && <i> · UNVERIFIED</i>}</p>}
            <div className="bs-pf-high">
              {(ig.highlights || []).map((h: string) => <span key={h}>{h}</span>)}
              {!(ig.highlights || []).length && <span className="bs-dim">no highlights</span>}
            </div>
          </div>
        </div>
      )}
      <p className="bs-r bs-r3 bs-wild-note">
        {internal ? 'THE DECISION IS THE ASSET' : 'RENDERED LIVE BY POSTENGINE — THE SAME CODE THAT PUBLISHES TO INSTAGRAM'}
      </p>
      <Source id="brand-f5-social-content-os" label="F5 SOCIAL OS" onSource={onSource} />
    </div>
  )
}

export const BRAND_SCENES = [SceneCover, SceneBelief, SceneWorld, SceneVoice, SceneWild]
export const SCENE_NAMES = ['Cover', 'Belief', 'World', 'Voice', 'In the wild']

/**
 * BRAND STUDIO — the brand book as a flight through the universe.
 *
 * "One universe, five worlds" is the brand architecture, so the surface enacts
 * it instead of describing it. The constellation is the hub; each brand is a
 * world you fly into; the cockpit re-inks in that world's palette; and Act V
 * renders real Instagram carousels with the same engine that publishes them.
 *
 * Design DNA (deliberately the founder's, not an agency's):
 *  · camera-flight lanes        — apps/landing/src/stage/registry.tsx
 *  · reveal-on-arrival          — stage/active.tsx useIsActive
 *  · Jarvis cockpit chrome      — surfaces/landing.css .ld-* (mono micro-labels,
 *                                 cyan instrument eyebrows, LIVE SIGNAL vocabulary)
 *  · the demo is real           — AppEmbed embeds live apps in deck scenes
 *  · provenance discipline      — nothing simulated is shown as measured
 *
 * The Operator tab is not an audit dashboard — it is THE METHOD: 20 design laws
 * in 5 families, the mental models behind every call this system makes. The old
 * audit (readiness, matrix) still exists, demoted to the specimen for Law 08
 * ("the audit derives") rather than a page of its own. See ./Method.tsx and
 * knowledge-base/brand/the-method.md. THE DOCTRINE (how we speak to the
 * outside world) is folded into that same spine as item VI, after Voice — one
 * spine, not a fourth pill.
 *
 * Three pills: BRANDING (default — the Fitting Room: every platform, worn
 * live), OPERATOR (the daily design reference), CINEMATIC (the flight through
 * the universe, for showing someone). Ignition plays once, on first entry to
 * Cinematic — not on mount, so opening your reference page costs no ceremony.
 *
 * Keys: 1/2/3 switch pills · (Cinematic) ← → scenes · ↑ / Esc constellation ·
 * any key skips ignition.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BRAND_ORDER, BRAND_ROLE, BRAND_BASES, SEED_OVERLAYS,
  resolveBrand, voiceBlock, readiness,
} from '@arganta/brand'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { useHQ } from '../../shell/store'
import { useVault } from '../../vault/store'
import { BRAND_SCENES, SCENE_NAMES, Mark } from './scenes'
import { Method } from './Method'
import { Branding } from './Branding'
import './brand-studio.css'

const SCENES_PER_LANE = BRAND_SCENES.length
type View = 'branding' | 'operator' | 'cinematic'

export function BrandStudio() {
  const { go } = useHQ()
  const [view, setView] = useState<View>('branding')
  const [overlays, setOverlays] = useState<Record<string, any> | null>(null)
  const [lane, setLane] = useState(0)          // 0 = constellation, 1..5 = worlds
  const [scene, setScene] = useState(0)
  // Ignition is scoped to Cinematic's first entry — 'unseen' until you switch
  // to that pill at least once, so the daily Operator view never sits through it.
  const [phase, setPhase] = useState<'unseen' | 'ignition' | 'flying'>('unseen')
  const rootRef = useRef<HTMLDivElement>(null)

  // Founder lane: the DB is authoritative the moment it has rows; the git seed
  // is the offline fallback. Never merged — a founder edit must not fight its
  // own seed.
  useEffect(() => {
    if (!cloudEnabled) { setOverlays(null); return }
    supabase.from('brand_registry').select('brand_id, overlay').then(({ data }) => {
      if (data?.length) setOverlays(Object.fromEntries(data.map((r: any) => [r.brand_id, r.overlay || {}])))
    })
  }, [])

  const live = !!overlays
  const worlds = useMemo(() => BRAND_ORDER.map((id: string) => {
    const ov = (overlays && overlays[id]) || (SEED_OVERLAYS as any)[id] || {}
    const { doc } = resolveBrand((BRAND_BASES as any)[id], ov)
    return { id, doc, voice: voiceBlock(doc), r: readiness(doc), role: (BRAND_ROLE as any)[id] }
  }), [overlays])

  const world = lane > 0 ? worlds[lane - 1] : null
  const pal = world?.doc?.identity?.palette || {}

  // The Method is "brand-aware": whichever world you last flew into in
  // Cinematic, else ArgantaLab (the most complete brand — the best classroom).
  const context = world || worlds.find((w: any) => w.id === 'argantalab') || worlds[0]

  // ── ignition: plays once, on first entry to Cinematic — never on mount.
  // The Operator view (the default) is a reference page opened many times a
  // day; it must never sit through ceremony.
  //
  // The guard is a REF, not the `phase` state itself. Including `phase` in this
  // effect's own dependency array was the first version's bug: setPhase
  // ('ignition') changes `phase`, which re-runs the effect before the timeout
  // fires, and the effect's cleanup then cancels its own timer — phase gets
  // stuck at 'ignition' forever, auto-advance never happens. Depending only on
  // `view`, with a ref to remember "already ignited", breaks that self-trigger.
  const ignitedRef = useRef(false)
  useEffect(() => {
    if (view !== 'cinematic' || ignitedRef.current) return
    ignitedRef.current = true
    setPhase('ignition')
    const t = setTimeout(() => setPhase('flying'), 2100)
    return () => clearTimeout(t)
  }, [view])

  const fly = useCallback((l: number, s = 0) => { setLane(l); setScene(s) }, [])

  // ── keyboard: 1/2 switch pills everywhere; flight keys only in Cinematic ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (view === 'cinematic' && phase === 'ignition') { setPhase('flying'); return }
      const k = e.key
      if (k === '1') { setView('branding'); return }
      if (k === '2') { setView('operator'); return }
      if (k === '3') { setView('cinematic'); return }
      if (view !== 'cinematic') return
      if (k === 'Escape' || k === 'ArrowUp') { fly(0, 0); return }
      if (lane === 0) return
      if (k === 'ArrowRight') { e.preventDefault(); setScene(s => Math.min(s + 1, SCENES_PER_LANE - 1)) }
      if (k === 'ArrowLeft') { e.preventDefault(); setScene(s => Math.max(s - 1, 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, phase, lane, fly])

  // Re-ink: the whole cockpit takes the active world's palette. At the hub (or
  // in Operator) it takes the context brand's — never a hardcoded default.
  const style = {
    '--bs-accent': pal.accent || context?.doc?.identity?.palette?.accent || '#3DE08A',
    '--bs-bg': pal.bg || context?.doc?.identity?.palette?.bg || '#070A12',
    '--bs-ink': pal.ink || context?.doc?.identity?.palette?.ink || '#F8FAFF',
    '--bs-soft': pal.soft || context?.doc?.identity?.palette?.soft || '#9AA8BF',
    '--bs-plate': pal.plateBg || context?.doc?.identity?.palette?.plateBg || '#FFC24B',
  } as React.CSSProperties

  // Both views link to the canon: a law or a scene footnotes the doc it
  // embodies, and this lands the operator on that note in the Vault.
  const openVault = (noteId: string) => {
    try { useVault.getState().openNote(noteId) } catch { /* vault store lazy-inits on its surface */ }
    go('vault')
  }

  const igniting = view === 'cinematic' && phase === 'ignition'

  return (
    <div className={'bs' + (view === 'cinematic' ? ' bs-cine' : '') + (igniting ? ' bs-igniting' : '')} style={style} ref={rootRef}>
      {/* ── ignition (Cinematic only, first entry) ── */}
      {igniting && (
        <div className="bs-ignition" onClick={() => setPhase('flying')}>
          <div className="bs-ig-mark"><Mark doc={worlds[1]?.doc} size={120} active /></div>
          <div className="bs-ig-label">BRAND SYSTEM ONLINE</div>
          <div className="bs-ig-sub">5 WORLDS · ONE UNIVERSE</div>
        </div>
      )}

      {/* ── cockpit HUD ── */}
      <div className="bs-hud">
        <div className="bs-hud-l">
          <span className="bs-hud-mark" />
          <b>BRAND SYSTEM</b>
          <div className="bs-pill">
            <button className={view === 'branding' ? 'on' : ''} onClick={() => setView('branding')}>BRANDING</button>
            <button className={view === 'operator' ? 'on' : ''} onClick={() => setView('operator')}>OPERATOR</button>
            <button className={view === 'cinematic' ? 'on' : ''} onClick={() => setView('cinematic')}>CINEMATIC</button>
          </div>
          {view === 'branding' && <span className="bs-chip">THE FITTING ROOM</span>}
          {view === 'operator' && <span className="bs-chip">THE METHOD · 20 LAWS + DOCTRINE</span>}
          {view === 'cinematic' && <span className="bs-crumb">{world ? <>CONSTELLATION <i>/</i> {world.doc.name.toUpperCase()} <i>/</i> {SCENE_NAMES[scene].toUpperCase()}</> : <>CONSTELLATION</>}</span>}
        </div>
        <div className="bs-hud-r">
          <span className={'bs-sig' + (live ? ' on' : '')}><i />{live ? 'REGISTRY · LIVE' : 'REGISTRY · SEED'}</span>
          <span className="bs-lane-k"><i className="a" />AGENT · GIT</span>
          <span className="bs-lane-k"><i className="f" />FOUNDER · DB</span>
          {(view === 'operator' || view === 'branding') && context && <span className="bs-chip">CONTEXT · {context.doc.name.toUpperCase()}</span>}
        </div>
      </div>

      {/* ── BRANDING: the Fitting Room — every platform, worn live ── */}
      {view === 'branding' && context && (
        <Branding worlds={worlds} contextId={context.id} onSource={openVault}
          onSaved={(id, overlay) => setOverlays(o => ({ ...(o || {}), [id]: overlay }))} />
      )}

      {/* ── OPERATOR: The Method (+ The Doctrine, folded in as spine item VI) ── */}
      {view === 'operator' && context && (
        <Method context={context} live={live} onSource={openVault} />
      )}

      {/* ── CINEMATIC: the flight through the universe ── */}
      {view === 'cinematic' && (
        <>
          <div className="bs-flight">
            <div className="bs-camera" style={{ transform: `translate3d(${-scene * 100}%, ${-lane * 100}%, 0)` }}>
              {/* lane 0 · the constellation */}
              <div className="bs-cell" style={{ left: 0, top: 0 }}>
                <Constellation worlds={worlds} active={lane === 0 && phase === 'flying'} onEnter={(i) => fly(i + 1, 0)} />
              </div>
              {/* lanes 1..5 · the worlds */}
              {worlds.map((w: any, li: number) => BRAND_SCENES.map((S, si) => (
                <div key={w.id + si} className="bs-cell" style={{ left: `${si * 100}%`, top: `${(li + 1) * 100}%` }}>
                  <S doc={w.doc} voice={w.voice} active={lane === li + 1 && scene === si && phase === 'flying'} onSource={openVault} />
                </div>
              )))}
            </div>
          </div>

          {/* ── scene dots ── */}
          {lane > 0 && (
            <div className="bs-dots">
              {SCENE_NAMES.map((n, i) => (
                <button key={n} className={'bs-dot' + (i === scene ? ' on' : '')} onClick={() => setScene(i)} title={n}><i /><span>{n}</span></button>
              ))}
              <button className="bs-dot bs-dot-up" onClick={() => fly(0, 0)} title="Back to the constellation (Esc)"><i />↑</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── LANE 0 · THE CONSTELLATION ────────────────────────────────
function Constellation({ worlds, active, onEnter }: { worlds: any[]; active: boolean; onEnter: (i: number) => void }) {
  return (
    <div className={'bs-scene bs-const' + (active ? ' in' : '')}>
      <div className="bs-const-glow" />
      <div className="bs-r bs-r1 bs-const-head">
        <h1 className="bs-display">One universe.<br /><em>Five worlds.</em></h1>
        <p>Every mark, palette, voice and post below is rendered from one registry — the same source that publishes to Instagram. Fly into a world.</p>
      </div>
      <div className="bs-orbit">
        {worlds.map((w, i) => (
          <button key={w.id} className={'bs-r bs-node' + (w.id === 'arganta' ? ' master' : '') + (w.id === 'circlehq' ? ' internal' : '')}
            style={{ animationDelay: `${260 + i * 90}ms`, ['--n-accent' as any]: w.doc.identity?.palette?.accent || '#888' }}
            onClick={() => onEnter(i)} title={`Fly into ${w.doc.name}`}>
            <span className="bs-node-m"><Mark doc={w.doc} size={w.id === 'arganta' ? 92 : 74} active={active} /></span>
            <b>{w.doc.name}</b>
            <span className="bs-node-role">{w.role}</span>
            <span className="bs-node-tag">{w.voice?.tagline || '—'}</span>
            <span className="bs-node-pct">{w.r.overall}%</span>
          </button>
        ))}
      </div>
      <p className="bs-r bs-r5 bs-const-foot">ARGANTA · GROW TOGETHER — <b>add brand six = one document, never a code change</b></p>
    </div>
  )
}

// The old Operator overlay (readiness rings, platform matrix, production
// queue) lived here. It is not deleted — it is demoted to evidence: the
// specimen for Method's Law 08 ("the audit derives"), in ./Method.tsx
// SpecimenAudit. See knowledge-base/brand/the-method.md.

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
 * The audit (readiness, platform matrix, production queue) is NOT the cover —
 * it is the appendix, one keystroke away in Operator mode. Investors get the
 * show; the founder gets the instruments.
 *
 * Keys: ← → scenes · ↑ / Esc constellation · O operator · any key skips ignition.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  BRAND_ORDER, BRAND_ROLE, BRAND_BASES, SEED_OVERLAYS,
  resolveBrand, voiceBlock, readiness, matrix, LAYERS,
} from '@arganta/brand'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { useHQ } from '../../shell/store'
import { useVault } from '../../vault/store'
import { BRAND_SCENES, SCENE_NAMES, Mark } from './scenes'
import './brand-studio.css'

const SCENES_PER_LANE = BRAND_SCENES.length

export function BrandStudio() {
  const { go } = useHQ()
  const [overlays, setOverlays] = useState<Record<string, any> | null>(null)
  const [lane, setLane] = useState(0)          // 0 = constellation, 1..5 = worlds
  const [scene, setScene] = useState(0)
  const [phase, setPhase] = useState<'ignition' | 'flying'>('ignition')
  const [operator, setOperator] = useState(false)
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

  // ── ignition: plays once, any key skips ──
  useEffect(() => {
    const t = setTimeout(() => setPhase('flying'), 2100)
    return () => clearTimeout(t)
  }, [])

  const fly = useCallback((l: number, s = 0) => { setLane(l); setScene(s) }, [])

  // ── flight controls ──
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'ignition') { setPhase('flying'); return }
      const k = e.key
      if (k === 'o' || k === 'O') { setOperator(v => !v); return }
      if (operator) { if (k === 'Escape') setOperator(false); return }
      if (k === 'Escape' || k === 'ArrowUp') { fly(0, 0); return }
      if (lane === 0) return
      if (k === 'ArrowRight') { e.preventDefault(); setScene(s => Math.min(s + 1, SCENES_PER_LANE - 1)) }
      if (k === 'ArrowLeft') { e.preventDefault(); setScene(s => Math.max(s - 1, 0)) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, operator, lane, fly])

  // Re-ink: the whole cockpit takes the active world's palette. At the hub it
  // returns to Arganta's, the parent of the family.
  const style = {
    '--bs-accent': pal.accent || '#3DE08A',
    '--bs-bg': pal.bg || '#070A12',
    '--bs-ink': pal.ink || '#F8FAFF',
    '--bs-soft': pal.soft || '#9AA8BF',
    '--bs-plate': pal.plateBg || '#FFC24B',
  } as React.CSSProperties

  // The show links to the canon: each scene footnotes the strategy doc it
  // embodies, and this lands the operator on that note in the Vault.
  const openVault = (noteId: string) => {
    try { useVault.getState().openNote(noteId) } catch { /* vault store lazy-inits on its surface */ }
    go('vault')
  }

  return (
    <div className={'bs' + (phase === 'ignition' ? ' bs-igniting' : '')} style={style} ref={rootRef}>
      {/* ── ignition ── */}
      {phase === 'ignition' && (
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
          <span className="bs-crumb">{world ? <>CONSTELLATION <i>/</i> {world.doc.name.toUpperCase()} <i>/</i> {SCENE_NAMES[scene].toUpperCase()}</> : <>CONSTELLATION</>}</span>
        </div>
        <div className="bs-hud-r">
          <span className={'bs-sig' + (live ? ' on' : '')}><i />{live ? 'REGISTRY · LIVE' : 'REGISTRY · SEED'}</span>
          <span className="bs-lane-k"><i className="a" />AGENT · GIT</span>
          <span className="bs-lane-k"><i className="f" />FOUNDER · DB</span>
          <button className={'bs-op-btn' + (operator ? ' on' : '')} onClick={() => setOperator(v => !v)} title="Operator mode — readiness, platform audit, production queue (O)">
            <i />OPERATOR<b>O</b>
          </button>
        </div>
      </div>

      {/* ── the flight ── */}
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

      {operator && <Operator worlds={worlds} lane={lane} live={live} onClose={() => setOperator(false)} onPick={(i) => { fly(i + 1, 0); setOperator(false) }} />}
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

// ── OPERATOR MODE · the appendix ──────────────────────────────
const GLYPH: Record<string, string> = { ok: '✓', draft: '✎', warn: '!', missing: '×', na: '–' }

function Operator({ worlds, lane, live, onClose, onPick }: { worlds: any[]; lane: number; live: boolean; onClose: () => void; onPick: (i: number) => void }) {
  const [sel, setSel] = useState(Math.max(0, lane - 1))
  const w = worlds[sel]
  const mtx = useMemo(() => matrix(w.doc), [w])
  return (
    <div className="bs-op" role="dialog" aria-label="Operator mode">
      <div className="bs-op-head">
        <b>OPERATOR MODE</b>
        <span>{live ? 'REGISTRY · LIVE' : 'REGISTRY · SEED'} · the audit derives from the spec library — it cannot go stale</span>
        <div className="bs-hud-r"><button className="bs-op-x" onClick={onClose}>ESC</button></div>
      </div>
      <div className="bs-op-body">
        <div className="bs-op-rail">
          {worlds.map((x, i) => (
            <button key={x.id} className={'bs-op-b' + (i === sel ? ' on' : '')} onClick={() => setSel(i)} onDoubleClick={() => onPick(i)}>
              <span>{x.doc.name}</span><b>{x.r.overall}%</b>
              <i><em style={{ width: `${x.r.overall}%`, background: x.doc.identity?.palette?.accent || '#888' }} /></i>
            </button>
          ))}
          <p className="bs-op-hint">Double-click a brand to fly into its book.</p>
        </div>
        <div className="bs-op-main">
          <div className="bs-op-layers">
            {(LAYERS as any[]).map(l => {
              const lr = w.r.layers[l.id]
              return (
                <div key={l.id} className="bs-op-layer" title={`${l.label} · ${lr.done}/${lr.total} · ${l.lane} lane`}>
                  <i style={{ background: `conic-gradient(${w.doc.identity?.palette?.accent || '#888'} ${lr.pct * 3.6}deg, rgba(255,255,255,.07) 0)` }}><b>{lr.pct}</b></i>
                  <span>{l.n}</span><em>{l.label}</em>
                </div>
              )
            })}
          </div>
          <table className="bs-op-mtx">
            <thead><tr><th /><th>handle</th><th>avatar</th><th>banner</th><th>bio</th><th>link</th><th>pinned</th><th>tmpl</th></tr></thead>
            <tbody>
              {mtx.map((row: any) => (
                <tr key={row.platformId}>
                  <td>{row.label}</td>
                  {['handle', 'avatar', 'banner', 'bio', 'link', 'pinned', 'templates'].map(c => (
                    <td key={c} className={'c-' + row.cells[c].state} title={`${row.label} ${c}: ${row.cells[c].note}`}>{GLYPH[row.cells[c].state]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="bs-op-next"><b>NEXT</b>{w.r.next.length ? w.r.next.join(' · ') : 'canonize this brand — agent lane'}</div>
        </div>
      </div>
    </div>
  )
}

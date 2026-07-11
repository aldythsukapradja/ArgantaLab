import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { scaleBand } from 'd3-scale'
import {
  MUSIC_THEMES, MusicTransport, INSTRUMENTS, KITS, SCALES, CHORD_PROGS, NOTE_BASE,
  ROLES, ROLE_LABEL, createMasterChain, publishMusicLibrary, loadActiveMusic,
} from '@arganta/audio'
import { supabase, cloudEnabled } from '../../lib/supabase'

// The 3D "Conductor Orb" (Three.js) is lazy-loaded (its own chunk). If WebGL is
// unavailable or the scene throws, VizBoundary swaps in the 2D fallback so the
// studio never crashes.
const Conductor3D = lazy(() => import('./Conductor3D'))

class VizBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: any) { console.warn('[music] 3D visualizer failed, using 2D:', e?.message || e) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

// Music Forge — the generative-music STUDIO. A theme (key/scale/tempo/chord-loop
// + an instrument assigned to each musical ROLE) is composed live by the
// MusicTransport; the d3 radial visualizer reacts to real note events + the
// AnalyserNode. Each theme binds to a realm ("map"), and Publish routes the
// themes straight to those maps (scalable: any realm key works). Same engine
// the game plays, so what the operator hears IS what ships.

type Theme = any
const ROLE_COLOR: Record<string, string> = {
  pad: '#8b5cf6', harmony: '#6366f1', bass: '#3b82f6', lead: '#0ea5a3', arp: '#f59e0b', drums: '#ef4444', sparkle: '#ff3d72',
}
const ROLE_ICON: Record<string, string> = {
  pad: '🌫️', harmony: '🎻', bass: '🎸', lead: '🎶', arp: '🎹', drums: '🥁', sparkle: '✨',
}
// canvas colour helpers (for theme-aware, gradient spectrum)
function hexArr(hex: string): [number, number, number] {
  let h = hex.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const lerpStr = (a: number[], b: number[], t: number) => `${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)}`
const hex2 = (a: number) => Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')
// instrument options grouped by category, for the pickers
const INST_BY_CAT: Record<string, { id: string; label: string }[]> = (() => {
  const out: Record<string, { id: string; label: string }[]> = {}
  for (const [id, def] of Object.entries(INSTRUMENTS as any)) { (out[(def as any).cat] ||= []).push({ id, label: (def as any).label }) }
  return out
})()
const KIT_IDS = Object.keys(KITS)
const clone = (o: any) => JSON.parse(JSON.stringify(o))

export function MusicForge() {
  // editable copy of all 6 themes, keyed by realm
  const [themes, setThemes] = useState<Record<string, Theme>>(() => clone(MUSIC_THEMES))
  const [realm, setRealm] = useState('farm')
  const [playing, setPlaying] = useState(false)
  // 3D "Conductor Orb" by default (Canvas2D fallback for reduced-motion / opt-out)
  const [viz3d, setViz3d] = useState(() => !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
  const [publishing, setPublishing] = useState(false)
  const [pubMsg, setPubMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const T = themes[realm]

  // seed from the published library on mount (so a re-publish preserves other maps)
  useEffect(() => {
    if (!cloudEnabled) return
    loadActiveMusic(supabase).then((r: any) => {
      if (r?.music && Object.keys(r.music).length) setThemes(prev => {
        const next = clone(prev)
        for (const rk of Object.keys(r.music)) if (next[rk]) next[rk] = { ...next[rk], ...r.music[rk], roles: { ...next[rk].roles, ...(r.music[rk].roles || {}) } }
        return next
      })
    })
  }, [])

  // ---- audio graph + transport ----
  const audio = useRef<{ ctx: AudioContext; master: GainNode; revBus: GainNode; analyser: AnalyserNode; freq: Uint8Array } | null>(null)
  const transport = useRef<any>(null)
  const events = useRef<{ role: string; born: number }[]>([])

  function ensureAudio() {
    if (audio.current) return audio.current
    const AC = window.AudioContext || (window as any).webkitAudioContext
    const ctx: AudioContext = new AC()
    const { master, reverbBus } = createMasterChain(ctx, 0.55)
    const analyser = ctx.createAnalyser(); analyser.fftSize = 256
    master.connect(analyser)
    audio.current = { ctx, master, revBus: reverbBus, analyser, freq: new Uint8Array(analyser.frequencyBinCount) }
    transport.current = new MusicTransport(ctx, {
      master, revBus: reverbBus,
      onEvent: (role: string) => { events.current.push({ role, born: performance.now() }); if (events.current.length > 120) events.current.shift() },
    })
    return audio.current
  }
  function play() {
    const a = ensureAudio(); if (a.ctx.state === 'suspended') a.ctx.resume()
    transport.current!.setTheme(T); transport.current!.start(); setPlaying(true)
  }
  function stop() { transport.current?.stop(); setPlaying(false) }
  // live-apply edits while playing
  useEffect(() => { if (playing) transport.current?.setTheme(T) }, [JSON.stringify(T)]) // eslint-disable-line
  useEffect(() => () => { transport.current?.stop() }, [])

  function patch(p: Partial<Theme>) { setThemes(prev => ({ ...prev, [realm]: { ...prev[realm], ...p } })) }
  function patchRole(role: string, p: any) { setThemes(prev => ({ ...prev, [realm]: { ...prev[realm], roles: { ...prev[realm].roles, [role]: { ...prev[realm].roles[role], ...p } } } })) }

  async function publish() {
    setPublishing(true); setPubMsg(null)
    try {
      // publish ALL current themes (keyed by realm) so no map's theme is dropped
      await publishMusicLibrary(supabase, themes, { note: 'HQ Music Forge' })
      setPubMsg({ ok: true, text: `Published → ${themes[realm].name}. Live in-game on next boot.` })
    } catch (e: any) { setPubMsg({ ok: false, text: `Publish failed: ${e?.message || e}` }) }
    finally { setPublishing(false); window.setTimeout(() => setPubMsg(null), 5000) }
  }

  return (
    <div className="mf">
      <div className="mf-top">
        <div className="mf-title"><b>Music Forge</b><span>generative backsound · per-map themes</span></div>
        {pubMsg && <span className="mf-toast" style={{ color: pubMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>{pubMsg.text}</span>}
        {!cloudEnabled && <span className="pill pill-mut" style={{ color: 'var(--warn)' }}>offline — run migration_music_library.sql</span>}
        <button className="mf-pub" disabled={publishing || !cloudEnabled} onClick={publish} title="Publishes every map's theme">
          {publishing ? 'Publishing…' : <>Publish → <b>{T.name}</b></>}
        </button>
      </div>

      <div className="mf-body">
        {/* LEFT — map tracks */}
        <div className="mf-rail">
          <div className="mf-railh">The maps</div>
          {Object.entries(themes).map(([rk, th]: [string, any]) => (
            <div key={rk} className={'mf-trk' + (rk === realm ? ' on' : '')} onClick={() => { setRealm(rk); if (playing) { transport.current!.setTheme(th) } }}>
              <div className="ic">{th.icon}</div>
              <div className="nm"><b>{th.name}</b><span>{th.mood} · {th.bpm}bpm</span></div>
              <button className="play" onClick={(e) => { e.stopPropagation(); setRealm(rk); const a = ensureAudio(); if (a.ctx.state === 'suspended') a.ctx.resume(); transport.current!.setTheme(th); transport.current!.start(); setPlaying(true) }}>▶</button>
            </div>
          ))}
          <div className="mf-railnote">Every map is a <b>theme</b> — a parameter set. Publish routes it straight to that map. Add a zone → add a theme with a new <code>realm</code>. Same engine, no files.</div>
        </div>

        {/* CENTER — stage + visualizer (3D Conductor Orb, or Canvas2D fallback) */}
        <div className="mf-stage">
          <div className="mf-now">
            <button className="mf-bigplay" onClick={() => (playing ? stop() : play())}>
              {playing
                ? <svg width={22} height={22} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
                : <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
            </button>
            <div className="mf-meta"><b>{T.name}</b><div className="sub">{T.mood} · {T.root} {T.scale} · {T.prog}</div></div>
            <div className="mf-vizseg">
              <button className={viz3d ? 'on' : ''} onClick={() => setViz3d(true)}>3D</button>
              <button className={!viz3d ? 'on' : ''} onClick={() => setViz3d(false)}>2D</button>
            </div>
            <div className="mf-ro"><b id="mf-chord">—</b><span id="mf-key">press play</span></div>
          </div>
          {viz3d
            ? <VizBoundary fallback={<Visualizer audioRef={audio} transportRef={transport} eventsRef={events} playing={playing} />}>
                <Suspense fallback={<div className="mf-viz mf-vizloading">loading 3D…</div>}>
                  <Conductor3D audioRef={audio} transportRef={transport} eventsRef={events} playing={playing} />
                </Suspense>
              </VizBoundary>
            : <Visualizer audioRef={audio} transportRef={transport} eventsRef={events} playing={playing} />}
        </div>

        {/* RIGHT — theme editor */}
        <div className="mf-ctrl">
          <h4>Feel</h4>
          <div className="mf-selrow"><label>Key</label>
            <select value={T.root} onChange={e => patch({ root: e.target.value })}>{Object.keys(NOTE_BASE).map(n => <option key={n}>{n}</option>)}</select>
            <select value={T.scale} onChange={e => patch({ scale: e.target.value })}>{Object.keys(SCALES).map(n => <option key={n}>{n}</option>)}</select>
          </div>
          <Slider label="Tempo" val={T.bpm} lo={50} hi={160} step={1} fmt={v => v + ' bpm'} onChange={v => patch({ bpm: v })} />
          <Slider label="Swing" val={T.swing} lo={0} hi={0.5} step={0.01} fmt={v => v.toFixed(2)} onChange={v => patch({ swing: v })} />
          <Slider label="Density" val={T.density} lo={0.2} hi={1} step={0.02} fmt={v => v.toFixed(2)} onChange={v => patch({ density: v })} />
          <Slider label="Reverb" val={T.reverb} lo={0} hi={0.8} step={0.02} fmt={v => v.toFixed(2)} onChange={v => patch({ reverb: v })} />

          <h4>Chord loop</h4>
          <div className="mf-progpills">
            {Object.keys(CHORD_PROGS).map(p => <button key={p} className={T.prog === p ? 'on' : ''} onClick={() => patch({ prog: p })}>{p}</button>)}
          </div>

          <h4>Orchestra — instrument per part</h4>
          {(ROLES as string[]).map((role: string) => {
            const r = T.roles[role]
            return (
              <div key={role} className="mf-role">
                <div className="mf-rolehead">
                  <span className="dot" style={{ background: ROLE_COLOR[role] }} />
                  <span className="rl">{ROLE_LABEL[role]}</span>
                  <div className={'mf-sw' + (r.on ? ' on' : '')} onClick={() => patchRole(role, { on: !r.on })} />
                </div>
                <div className="mf-rolebody">
                  {role === 'drums' ? (
                    <select value={r.kit} onChange={e => patchRole(role, { kit: e.target.value })}>{KIT_IDS.map(k => <option key={k}>{k}</option>)}</select>
                  ) : (
                    <select value={r.inst} onChange={e => patchRole(role, { inst: e.target.value })}>
                      {Object.entries(INST_BY_CAT).map(([cat, list]) => <optgroup key={cat} label={cat}>{list.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}</optgroup>)}
                    </select>
                  )}
                  <input type="range" min={0} max={1} step={0.02} value={r.level} onChange={e => patchRole(role, { level: +e.target.value })} style={{ accentColor: ROLE_COLOR[role] }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Slider({ label, val, lo, hi, step, fmt, onChange }: { label: string; val: number; lo: number; hi: number; step: number; fmt: (v: number) => string; onChange: (v: number) => void }) {
  return (
    <div className="mf-sl"><label>{label}</label>
      <input type="range" min={lo} max={hi} step={step} value={val} onChange={e => onChange(+e.target.value)} />
      <span className="v">{fmt(val)}</span>
    </div>
  )
}

// ---- d3 + canvas radial visualizer (the "wow") ----
function Visualizer({ audioRef, transportRef, eventsRef, playing }:
  { audioRef: any; transportRef: any; eventsRef: any; playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef<number>(0)
  // live `playing` (the rAF loop closes over the mount-time value otherwise)
  const playingRef = useRef(playing); playingRef.current = playing
  // role positions around the ring (d3 scaleBand → angle)
  const angle = useMemo(() => {
    const s = scaleBand<string>().domain(ROLES as string[]).range([0, Math.PI * 2]).padding(0)
    return (r: string) => (s(r) || 0) + s.bandwidth() / 2 - Math.PI / 2
  }, [])

  useEffect(() => {
    function frame() {
      const c = canvasRef.current; if (c) draw(c)
      raf.current = requestAnimationFrame(frame)
    }
    raf.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf.current)
  }, []) // eslint-disable-line

  function draw(c: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1, rect = c.getBoundingClientRect()
    c.width = Math.max(1, rect.width * dpr); c.height = Math.max(1, rect.height * dpr)
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0)
    const W = rect.width, H = rect.height, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.32
    g.clearRect(0, 0, W, H)

    // theme-aware palette — read live off the canvas (picks up --acc from :root
    // and --mbf-mel from the .mbf ancestor), so the stage is light in light
    // mode, dark in dark mode.
    const cs = getComputedStyle(c)
    const tok = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
    const web = tok('--bd2', '#2c2c37'), tx2 = tok('--tx2', '#888')
    const accA = hexArr(tok('--acc', '#6366f1')), melA = hexArr(tok('--mbf-mel', '#0ea5a3'))

    const a = audioRef.current
    const freq = a?.freq
    if (a) a.analyser.getByteFrequencyData(freq)
    const tr = transportRef.current
    const theme = tr?.theme
    if (tr && theme) {
      const chEl = document.getElementById('mf-chord'), kEl = document.getElementById('mf-key')
      if (chEl) chEl.textContent = playingRef.current ? '♪' : '—'
      if (kEl) kEl.textContent = playingRef.current ? `${theme.root} ${String(theme.scale).split(' ')[0]} · bar ${(tr._bar || 0) + 1}` : 'press play'
    }
    const now = performance.now(), rot = now * 0.00003
    const energy = playingRef.current && tr ? (tr.energy?.() ?? 0.5) : 0.3
    const evs = eventsRef.current
    const lastByRole: Record<string, number> = {}
    for (const e of evs) lastByRole[e.role] = Math.max(lastByRole[e.role] ?? -9999, e.born)

    // node positions
    const nodePos: Record<string, [number, number]> = {}
    ;(ROLES as string[]).forEach((role: string) => { const ang = angle(role); nodePos[role] = [cx + Math.cos(ang) * R, cy + Math.sin(ang) * R] })

    // spokes center→node (light up when the role recently fired) + outer polygon
    ;(ROLES as string[]).forEach((role: string) => {
      const [x, y] = nodePos[role], hot = now - (lastByRole[role] ?? -9999) < 220
      g.strokeStyle = hot ? ROLE_COLOR[role] + '99' : web; g.lineWidth = hot ? 2 : 1
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke()
    })
    g.strokeStyle = web; g.lineWidth = 1; g.beginPath()
    ;(ROLES as string[]).forEach((r: string, i: number) => { const [x, y] = nodePos[r]; i ? g.lineTo(x, y) : g.moveTo(x, y) }); g.closePath(); g.stroke()

    // === central radial spectrum — fuller, slowly rotating, accent→cyan gradient, mirrored ===
    if (freq) {
      const bars = 110
      for (let i = 0; i < bars; i++) {
        const ang = (i / bars) * Math.PI * 2 - Math.PI / 2 + rot
        const v = freq[Math.floor((i / bars) * freq.length * 0.6)] / 255
        const col = lerpStr(accA, melA, Math.min(1, v * 1.15))
        const inner = R * 0.30, outer = inner + (0.04 + v) * R * 0.62
        g.strokeStyle = `rgba(${col},${0.35 + v * 0.55})`; g.lineWidth = 2.6; g.lineCap = 'round'
        g.beginPath(); g.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner); g.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer); g.stroke()
        const inner2 = Math.max(6, inner - v * R * 0.16)
        g.strokeStyle = `rgba(${col},${0.08 + v * 0.16})`; g.lineWidth = 1.6
        g.beginPath(); g.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner); g.lineTo(cx + Math.cos(ang) * inner2, cy + Math.sin(ang) * inner2); g.stroke()
      }
    }
    // energy core
    const coreR = R * 0.26 + energy * 10
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, coreR)
    grad.addColorStop(0, `rgba(${accA.join(',')},${0.45 + energy * 0.4})`); grad.addColorStop(0.6, `rgba(${accA.join(',')},0.1)`); grad.addColorStop(1, `rgba(${accA.join(',')},0)`)
    g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, coreR, 0, Math.PI * 2); g.fill()

    // particles: note events shoot from center to their role node
    for (let i = evs.length - 1; i >= 0; i--) {
      const e = evs[i], age = now - e.born
      if (age > 900) { evs.splice(i, 1); continue }
      const [nx, ny] = nodePos[e.role] || [cx, cy]
      const p = Math.min(1, age / 380)
      const px = cx + (nx - cx) * p, py = cy + (ny - cy) * p
      g.fillStyle = ROLE_COLOR[e.role] + hex2(1 - age / 900)
      g.beginPath(); g.arc(px, py, 3.4 * (1 - p * 0.4), 0, Math.PI * 2); g.fill()
    }

    // === role nodes: icon orb + level gauge + glow (the "instrument" richness) ===
    ;(ROLES as string[]).forEach((role: string) => {
      const [x, y] = nodePos[role]
      const hot = now - (lastByRole[role] ?? -9999) < 220
      const col = ROLE_COLOR[role]
      const on = theme?.roles?.[role]?.on ?? true
      const level = theme?.roles?.[role]?.level ?? 0.5
      const orbR = hot ? 22 : 19
      if (hot) { g.shadowBlur = 22; g.shadowColor = col }
      g.beginPath(); g.arc(x, y, orbR, 0, Math.PI * 2); g.fillStyle = col + (on ? (hot ? '33' : '20') : '10'); g.fill()
      g.shadowBlur = 0
      g.globalAlpha = on ? 1 : 0.45; g.lineWidth = 2.5; g.strokeStyle = on ? col : web
      g.beginPath(); g.arc(x, y, orbR, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1
      // level gauge: 270° arc, gap at the bottom
      const gr = orbR + 5, a0 = Math.PI * 0.75, span = Math.PI * 1.5
      g.lineWidth = 3; g.lineCap = 'round'
      g.strokeStyle = web; g.beginPath(); g.arc(x, y, gr, a0, a0 + span); g.stroke()
      g.strokeStyle = col; g.beginPath(); g.arc(x, y, gr, a0, a0 + span * (on ? level : 0)); g.stroke()
      // instrument icon
      g.globalAlpha = on ? 1 : 0.4; g.font = '19px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'
      g.fillText(ROLE_ICON[role] || '●', x, y + 1); g.globalAlpha = 1
      // label — bigger, uppercase, role-coloured, with the assigned instrument beneath
      const ang = angle(role), lx = cx + Math.cos(ang) * (R + 42), ly = cy + Math.sin(ang) * (R + 40)
      g.textAlign = 'center'; g.textBaseline = 'middle'
      g.font = '700 13.5px "Segoe UI", system-ui, sans-serif'
      try { (g as any).letterSpacing = '0.07em' } catch { /* older browsers */ }
      g.fillStyle = on ? col : tx2
      g.fillText(ROLE_LABEL[role].toUpperCase(), lx, ly)
      try { (g as any).letterSpacing = '0px' } catch { /* noop */ }
      const instId = role === 'drums' ? (theme?.roles?.drums?.kit || '') : (theme?.roles?.[role]?.inst || '')
      const instName = role === 'drums' ? instId : ((INSTRUMENTS as any)[instId]?.label || '')
      if (instName) { g.font = '10.5px ui-monospace'; g.fillStyle = tx2; g.fillText(instName, lx, ly + 15) }
    })
  }

  return <canvas ref={canvasRef} className="mf-viz" />
}

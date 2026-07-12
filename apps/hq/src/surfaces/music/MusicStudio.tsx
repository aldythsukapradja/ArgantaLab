/**
 * MUSIC STUDIO — the Music Builder's main surface. The third studio in the
 * family (Video Builder · Post Studio · this): same chrome — top bar, stage,
 * right inspector, bottom strip. The stage is the rebuilt audio-reactive
 * scene (Stage3D, with Stage2D as guaranteed fallback); the strip holds the
 * map themes (every map = one generative theme); Composer is the AI seam;
 * Record captures real bars off the master bus; Publish ships every theme
 * to its map through the existing music-library pipeline.
 */
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Music2, Wand2, X, Send, Play, Pause, Plus, Disc3, History, Rocket,
  SlidersHorizontal, ListMusic, Drum as DrumIcon, Download, Library, Music3,
} from 'lucide-react'
import {
  MUSIC_THEMES, MusicTransport, INSTRUMENTS, KITS, SCALES, CHORD_PROGS, NOTE_BASE,
  ROLES, ROLE_LABEL, createMasterChain, publishMusicLibrary, loadActiveMusic,
  CLASSICAL_PIECES, CLASSICAL_MOODS, REALM_ANTHEM, classicalPiece, scheduleClassicalPiece,
} from '@arganta/audio'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { ai, aiLive } from '../../lib/ai'
import { ROLE_COLOR, ROLE_ICON } from './roles'
import { Stage2D } from './Stage2D'
import { MUSIC_SCHEMA, composerMessages, coerceTheme, localCompose } from './composer'
import './musicstudio.css'

const Stage3D = lazy(() => import('./Stage3D'))

class VizBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: any) { console.warn('[music] 3D stage failed, using 2D:', e?.message || e) }
  render() { return this.state.failed ? this.props.fallback : this.props.children }
}

type Theme = any
const clone = (o: any) => JSON.parse(JSON.stringify(o))
const KIT_IDS = Object.keys(KITS)
const INST_BY_CAT: Record<string, { id: string; label: string }[]> = (() => {
  const out: Record<string, { id: string; label: string }[]> = {}
  for (const [id, def] of Object.entries(INSTRUMENTS as any)) { (out[(def as any).cat] ||= []).push({ id, label: (def as any).label }) }
  return out
})()

function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'map'

export function MusicStudio({ onLegacy }: { onLegacy: () => void }) {
  const [themes, setThemes] = useState<Record<string, Theme>>(() => clone(MUSIC_THEMES))
  const [realm, setRealm] = useState('farm')
  const [playing, setPlaying] = useState(false)
  const [viz3d, setViz3d] = useState(() => !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches))
  const [status, setStatus] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [recBars, setRecBars] = useState(8)
  const [recording, setRecording] = useState(false)
  // classical library — a curated set of public-domain themes, one anthem per map
  const [anthems, setAnthems] = useState<Record<string, string | null>>(() => ({ ...REALM_ANTHEM }))
  const [classicalMood, setClassicalMood] = useState<string>('all')
  const [anthemPlayingId, setAnthemPlayingId] = useState<string | null>(null)
  const anthemTimerRef = useRef<number | undefined>(undefined)
  // composer chat
  const [botOpen, setBotOpen] = useState(false)
  const [botPrompt, setBotPrompt] = useState('')
  const [botBusy, setBotBusy] = useState(false)
  const [botMsgs, setBotMsgs] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: 'Describe a mood — “cozy rainy-day kitchen, gentle” — and I’ll compose this map’s theme: key, tempo, chords, instruments. You fine-tune anything on the right.' },
  ])
  const T = themes[realm]

  // seed from the published library (so a re-publish preserves other maps)
  useEffect(() => {
    if (!cloudEnabled) return
    loadActiveMusic(supabase).then((r: any) => {
      if (r?.music && Object.keys(r.music).length) {
        setThemes(prev => {
          const next = clone(prev)
          for (const rk of Object.keys(r.music)) {
            if (next[rk]) next[rk] = { ...next[rk], ...r.music[rk], roles: { ...next[rk].roles, ...(r.music[rk].roles || {}) } }
            else next[rk] = r.music[rk]
          }
          return next
        })
        // anthem picks ride along inside each published theme (an extra field
        // the game's own sanitizer ignores) — pull them back out here.
        const loaded: Record<string, string | null> = {}
        for (const rk of Object.keys(r.music)) if ('anthem' in r.music[rk]) loaded[rk] = r.music[rk].anthem
        if (Object.keys(loaded).length) setAnthems(prev => ({ ...prev, ...loaded }))
      }
    })
  }, [])

  // ---- audio graph + transport (one context, shared with the stage) ----
  const audio = useRef<{ ctx: AudioContext; master: GainNode; revBus: GainNode; analyser: AnalyserNode; freq: Uint8Array } | null>(null)
  const transport = useRef<any>(null)
  const events = useRef<{ role: string; born: number }[]>([])
  const recDest = useRef<MediaStreamAudioDestinationNode | null>(null)

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
  function play(theme?: Theme) {
    const a = ensureAudio()
    if (a.ctx.state === 'suspended') a.ctx.resume()
    transport.current!.setTheme(theme || T)
    transport.current!.start()
    setPlaying(true)
  }
  function stop() { transport.current?.stop(); setPlaying(false) }
  // live-apply edits while playing
  useEffect(() => { if (playing) transport.current?.setTheme(T) }, [JSON.stringify(T)]) // eslint-disable-line
  useEffect(() => () => { transport.current?.stop(); window.clearTimeout(anthemTimerRef.current) }, [])

  const patch = (p: Partial<Theme>) => setThemes(prev => ({ ...prev, [realm]: { ...prev[realm], ...p } }))
  const patchRole = (role: string, p: any) => setThemes(prev => ({ ...prev, [realm]: { ...prev[realm], roles: { ...prev[realm].roles, [role]: { ...prev[realm].roles[role], ...p } } } }))

  function selectMap(rk: string, alsoPlay = false) {
    setRealm(rk)
    if (alsoPlay) play(themes[rk])
    else if (playing) transport.current?.setTheme(themes[rk])
  }
  function addMap() {
    const name = prompt('Name the new map (a theme is cloned from the current one):')
    if (!name?.trim()) return
    const rk = slug(name)
    if (themes[rk]) { setStatus('That map already exists.'); return }
    setThemes(prev => ({ ...prev, [rk]: { ...clone(prev[realm]), realm: rk, name: name.trim() } }))
    setAnthems(prev => ({ ...prev, [rk]: prev[realm] ?? null }))
    setRealm(rk)
    setStatus(`Added “${name.trim()}” — publish routes it to realm “${rk}”.`)
  }

  async function publish() {
    setPublishing(true)
    try {
      // fold each map's anthem pick into its theme payload — the game's own
      // sanitizer drops unknown fields, so this is purely an HQ-side extra.
      const withAnthems = Object.fromEntries(
        Object.entries(themes).map(([rk, th]) => [rk, { ...(th as object), anthem: anthems[rk] ?? null }]),
      )
      await publishMusicLibrary(supabase, withAnthems, { note: 'HQ Music Studio' })
      setStatus(`Published ${Object.keys(themes).length} map themes — live in-game on next boot.`)
    } catch (e: any) { setStatus(`Publish failed: ${e?.message || e}`) }
    finally { setPublishing(false) }
  }

  // ---- classical library: preview + per-map anthem assignment ----
  const anthemFor = (rk: string) => anthems[rk] ?? null
  const setAnthemForRealm = (rk: string, id: string | null) => setAnthems(prev => ({ ...prev, [rk]: id }))

  function playAnthem(id: string) {
    const piece = classicalPiece(id)
    if (!piece) return
    if (playing) stop() // the anthem plays through the same master bus — don't let the generative bed clash
    const a = ensureAudio()
    if (a.ctx.state === 'suspended') a.ctx.resume()
    const onNote = (role: string) => { events.current.push({ role, born: performance.now() }); if (events.current.length > 120) events.current.shift() }
    const { duration } = scheduleClassicalPiece(a.ctx, a.master, a.revBus, piece, { onNote })
    setAnthemPlayingId(id)
    window.clearTimeout(anthemTimerRef.current)
    anthemTimerRef.current = window.setTimeout(() => setAnthemPlayingId(null), duration * 1000)
    setStatus(`“${piece.title}” — ${piece.composer} · public-domain melody, synthesized live (no audio file).`)
  }

  const classicalList = classicalMood === 'all' ? CLASSICAL_PIECES : CLASSICAL_PIECES.filter((p: any) => p.mood === classicalMood)
  const currentAnthem = anthemFor(realm)

  // ---- record N bars off the master bus (the studio's Export) ----
  async function record() {
    if (recording) return
    const a = ensureAudio()
    if (!recDest.current) { recDest.current = a.ctx.createMediaStreamDestination(); a.master.connect(recDest.current) }
    if (!playing) play()
    const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
    const rec = new MediaRecorder(recDest.current.stream, { mimeType: mime, audioBitsPerSecond: 192000 })
    const chunks: Blob[] = []
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime })
      downloadBlob(blob, `${slug(T.name)}-${recBars}bars.webm`)
      setRecording(false)
      setStatus(`Recorded ${recBars} bars of “${T.name}” · ${(blob.size / 1024).toFixed(0)} KB — drop it anywhere.`)
    }
    const ms = recBars * 4 * (60 / T.bpm) * 1000
    setRecording(true)
    setStatus(`Recording ${recBars} bars (${(ms / 1000).toFixed(0)}s)…`)
    rec.start()
    window.setTimeout(() => rec.stop(), ms)
  }

  // ---- composer ----
  async function runComposer(prompt: string) {
    if (!prompt.trim() || botBusy) return
    setBotBusy(true); setBotPrompt('')
    setBotMsgs(m => [...m, { role: 'user', text: prompt }])
    try {
      const r = await ai.chatJSON({ task: 'copy', schema: MUSIC_SCHEMA, messages: composerMessages(prompt) })
      const useLocal = r.provider === 'mock' || !r.json || typeof r.json !== 'object'
      const next = useLocal ? localCompose(prompt, T) : coerceTheme(r.json, T)
      setThemes(prev => ({ ...prev, [realm]: next }))
      const via = useLocal ? (aiLive ? 'local draft — model returned nothing usable' : 'local draft — connect a model for finer taste') : 'AI · ' + r.provider
      setBotMsgs(m => [...m, { role: 'agent', text: `Composed **${next.mood}** — ${next.root} ${next.scale} · ${next.bpm} bpm · ${next.prog}. Press play; nudge anything on the right. _(${via})_` }])
      if (playing) transport.current?.setTheme(next)
    } catch (e: any) {
      setBotMsgs(m => [...m, { role: 'agent', text: 'Failed: ' + (e?.message || e) }])
    } finally { setBotBusy(false) }
  }

  const stage = useMemo(() => ({ audioRef: audio, transportRef: transport, eventsRef: events }), [])

  return (
    <div className="msx">
      {/* ── top bar ── */}
      <div className="msx-top">
        <div className="msx-mark"><Music2 size={15} /></div>
        <div className="msx-title"><b>Music Builder</b><span>Music Studio · generative · zero-asset</span></div>
        <div className="seg" role="group" aria-label="Stage">
          <button className={viz3d ? 'on' : ''} onClick={() => setViz3d(true)}>3D</button>
          <button className={!viz3d ? 'on' : ''} onClick={() => setViz3d(false)}>2D</button>
        </div>
        <div className="msx-spacer" />
        {status && <span className="msx-status" title={status}>{status}</span>}
        {!cloudEnabled && <span className="msx-status" style={{ color: 'var(--warn, #F59E0B)' }}>offline — publish needs Supabase</span>}
        <button className="msx-ghost" title="The previous Music Builder (Overview · SFX Forge · Music Forge)" onClick={onLegacy}>
          <History size={14} /> Legacy
        </button>
        <button className={'msx-ghost' + (botOpen ? ' on' : '')} onClick={() => setBotOpen(o => !o)}>
          <Wand2 size={14} /> Composer
        </button>
        <button className={'msx-ghost' + (recording ? ' rec' : '')} disabled={recording} onClick={record} title={`Record ${recBars} bars of the live mix as an audio file`}>
          <Disc3 size={14} /> {recording ? 'Recording…' : 'Record'}
        </button>
        <button className="msx-export" disabled={publishing || !cloudEnabled} onClick={publish} title="Publishes every map's theme to the game">
          <Rocket size={14} /> {publishing ? 'Publishing…' : 'Publish → maps'}
        </button>
      </div>

      {/* ── stage + inspector ── */}
      <div className="msx-main">
        <div className="msx-stage">
          <span className="msx-stagebadge">{T.name} · {T.mood} · {T.bpm} bpm</span>
          <span className="msx-stageplat">{T.root} {T.scale} · {T.prog}</span>

          {viz3d
            ? <VizBoundary fallback={<Stage2D {...stage} playing={playing} theme={T} />}>
                <Suspense fallback={<div className="msx-viz msx-vizloading">loading the stage…</div>}>
                  <Stage3D {...stage} playing={playing} theme={T} />
                </Suspense>
              </VizBoundary>
            : <Stage2D {...stage} playing={playing} theme={T} />}

          <button className={'msx-playbig' + (playing ? ' playing' : '')} onClick={() => (playing ? stop() : play())} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause /> : <Play style={{ marginLeft: 3 }} />}
          </button>

          {botOpen && (
            <div className="msx-bot">
              <div className="msx-bot-head">
                <Wand2 size={14} /> <b>Composer</b>
                <span className="msx-bot-tag">{aiLive ? 'AI connected' : 'local mode'}</span>
                <button className="msx-ic" onClick={() => setBotOpen(false)} aria-label="Close"><X size={14} /></button>
              </div>
              <div className="msx-bot-msgs">
                {botMsgs.map((m, i) => (
                  <div key={i} className={'msx-bot-msg ' + m.role}>
                    <div className="bubble" dangerouslySetInnerHTML={{ __html: m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_\((.+?)\)_/g, '<span class="via">($1)</span>') }} />
                  </div>
                ))}
                {botBusy && <div className="msx-bot-msg agent"><div className="bubble"><span className="msx-dots"><i /><i /><i /></span></div></div>}
              </div>
              <div className="msx-bot-quick">
                {['cozy rainy-day kitchen, gentle', 'epic boss battle, driving drums', 'mysterious moonlit forest'].map(q => (
                  <button key={q} className="msx-chip" disabled={botBusy} onClick={() => runComposer(q)}>{q.slice(0, 26)}…</button>
                ))}
              </div>
              <div className="msx-bot-input">
                <input value={botPrompt} disabled={botBusy} placeholder="Describe the mood of this map…"
                  onChange={e => setBotPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && botPrompt.trim()) runComposer(botPrompt.trim()) }} />
                <button className="msx-bot-send" disabled={botBusy || !botPrompt.trim()} onClick={() => runComposer(botPrompt.trim())} aria-label="Send"><Send size={14} /></button>
              </div>
            </div>
          )}
        </div>

        {/* ── inspector ── */}
        <div className="msx-insp">
          <div className="msx-panel">
            <div className="msx-ph"><SlidersHorizontal size={13} /> Feel<span className="badge">{T.root} {T.scale}</span></div>
            <div className="msx-row">
              <select className="msx-sel" value={T.root} onChange={e => patch({ root: e.target.value })}>
                {Object.keys(NOTE_BASE).map(n => <option key={n}>{n}</option>)}
              </select>
              <select className="msx-sel" value={T.scale} onChange={e => patch({ scale: e.target.value })}>
                {Object.keys(SCALES).map(n => <option key={n}>{n}</option>)}
              </select>
            </div>
            <Slider label={`Tempo · ${T.bpm} bpm`} min={50} max={160} value={T.bpm} onChange={v => patch({ bpm: v })} />
            <Slider label={`Swing · ${T.swing.toFixed(2)}`} min={0} max={0.5} step={0.01} value={T.swing} onChange={v => patch({ swing: v })} />
            <Slider label={`Density · ${T.density.toFixed(2)}`} min={0.2} max={1} step={0.02} value={T.density} onChange={v => patch({ density: v })} />
            <Slider label={`Reverb · ${T.reverb.toFixed(2)}`} min={0} max={0.8} step={0.02} value={T.reverb} onChange={v => patch({ reverb: v })} />
          </div>

          <div className="msx-panel">
            <div className="msx-ph"><ListMusic size={13} /> Chord loop</div>
            <div className="msx-chipwrap">
              {Object.keys(CHORD_PROGS).map(p => (
                <span key={p} className={'msx-chip' + (T.prog === p ? ' on' : '')} onClick={() => patch({ prog: p })}>{p}</span>
              ))}
            </div>
          </div>

          <div className="msx-panel">
            <div className="msx-ph"><DrumIcon size={13} /> Orchestra<span className="badge">instrument per part</span></div>
            {(ROLES as string[]).map((role: string) => {
              const r = T.roles[role]
              const Icon = ROLE_ICON[role]
              const col = ROLE_COLOR[role]
              return (
                <div key={role} className={'msx-role' + (r.on ? '' : ' off')} style={{ ['--rc' as any]: col }}>
                  <div className="msx-rolehead">
                    <span className="ric"><Icon size={12} strokeWidth={2.4} /></span>
                    <span className="rl">{ROLE_LABEL[role]}</span>
                    <div className={'msx-sw' + (r.on ? ' on' : '')} onClick={() => patchRole(role, { on: !r.on })} role="switch" aria-checked={r.on} />
                  </div>
                  <div className="msx-rolebody">
                    {role === 'drums' ? (
                      <select className="msx-sel" value={r.kit} onChange={e => patchRole(role, { kit: e.target.value })}>
                        {KIT_IDS.map(k => <option key={k}>{k}</option>)}
                      </select>
                    ) : (
                      <select className="msx-sel" value={r.inst} onChange={e => patchRole(role, { inst: e.target.value })}>
                        {Object.entries(INST_BY_CAT).map(([cat, list]) => (
                          <optgroup key={cat} label={cat}>{list.map(i => <option key={i.id} value={i.id}>{i.label}</option>)}</optgroup>
                        ))}
                      </select>
                    )}
                    <input type="range" className="msx-range" min={0} max={1} step={0.02} value={r.level}
                      onChange={e => patchRole(role, { level: +e.target.value })} style={{ accentColor: col }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="msx-panel">
            <div className="msx-ph"><Library size={13} /> Classical Library<span className="badge">public domain</span></div>
            <div className="msx-row">
              <span className="msx-mini">this map's anthem</span>
              {currentAnthem ? (
                <>
                  <button className="msx-chip on" onClick={() => playAnthem(currentAnthem)}>
                    <Play size={10} /> {classicalPiece(currentAnthem)?.title}
                  </button>
                  <button className="msx-ic" title="Clear anthem" onClick={() => setAnthemForRealm(realm, null)}><X size={12} /></button>
                </>
              ) : <span className="msx-mini">none set</span>}
            </div>
            <div className="msx-chipwrap">
              <span className={'msx-chip' + (classicalMood === 'all' ? ' on' : '')} onClick={() => setClassicalMood('all')}>all</span>
              {CLASSICAL_MOODS.map((m: string) => (
                <span key={m} className={'msx-chip' + (classicalMood === m ? ' on' : '')} onClick={() => setClassicalMood(m)}>{m}</span>
              ))}
            </div>
            <div className="msx-classicallist">
              {classicalList.map((p: any) => (
                <div key={p.id} className={'msx-classicalrow' + (anthemPlayingId === p.id ? ' live' : '')}>
                  <button className="msx-ic" title={`Preview “${p.title}”`} onClick={() => playAnthem(p.id)}><Play size={11} /></button>
                  <div className="meta">
                    <b>{p.title}</b>
                    <span>{p.composer}{p.died ? ` · d. ${p.died}` : ''} · {p.year}</span>
                  </div>
                  {currentAnthem === p.id
                    ? <span className="msx-chip on">this map's anthem</span>
                    : <button className="msx-chip" onClick={() => setAnthemForRealm(realm, p.id)}>set as anthem</button>}
                </div>
              ))}
            </div>
            <span className="msx-mini">Public-domain melodies — every composer died 70+ years ago, or (Spanish Romance) is historically anonymous — synthesized live here, zero audio files. A modern <i>recording</i> of the same piece is still copyrighted; only the notes are free.</span>
          </div>

          <div className="msx-panel">
            <div className="msx-ph"><Download size={13} /> Output<span className="badge">master bus</span></div>
            <div className="msx-row">
              <span className="msx-mini">record</span>
              {[4, 8, 16].map(b => (
                <span key={b} className={'msx-chip' + (recBars === b ? ' on' : '')} onClick={() => setRecBars(b)}>{b} bars</span>
              ))}
            </div>
            <button className="msx-btn accent" disabled={recording} onClick={record}>
              <Disc3 size={12} /> {recording ? 'Recording…' : `Record ${recBars} bars (~${Math.round(recBars * 4 * 60 / T.bpm)}s)`}
            </button>
            <span className="msx-mini">Captures the live mix as .webm audio. Publish ships the theme itself — the game composes it live, no files.</span>
          </div>
        </div>
      </div>

      {/* ── maps strip (every map = one theme) ── */}
      <div className="msx-strip">
        <div className="msx-striphead">
          <span className="msx-stripcount">Maps · {Object.keys(themes).length}</span>
          <span className="msx-striphint">every map is a theme — publish routes each one straight to its map</span>
          <button className="msx-chip" style={{ marginLeft: 'auto' }} onClick={addMap}><Plus size={11} /> Add map</button>
        </div>
        <div className="msx-thumbs">
          {Object.entries(themes).map(([rk, th]: [string, any]) => (
            <div key={rk} className={'msx-map' + (rk === realm ? ' on' : '')} onClick={() => selectMap(rk)}>
              <Signature theme={th} active={rk === realm && playing} />
              <div className="meta">
                <b>{th.name}</b>
                <span>{th.mood} · {th.bpm} bpm · {th.root}</span>
                {anthemFor(rk) && <span className="anthem"><Music3 size={9} /> {classicalPiece(anthemFor(rk)!)?.title}</span>}
              </div>
              <button className="msx-mapplay" onClick={e => { e.stopPropagation(); if (rk === realm && playing) stop(); else selectMap(rk, true) }}
                aria-label={rk === realm && playing ? 'Pause' : 'Play'}>
                {rk === realm && playing ? <Pause size={12} /> : <Play size={12} style={{ marginLeft: 1 }} />}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Slider({ label, min, max, step = 1, value, onChange }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="msx-field">
      <label>{label}</label>
      <input type="range" className="msx-range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </div>
  )
}

/** A deterministic 12-bar "audio fingerprint" per theme — the strip's visual id. */
function Signature({ theme, active }: { theme: any; active: boolean }) {
  const bars = useMemo(() => {
    let h = (theme.bpm * 7 + Math.round(theme.density * 100) * 13 + (theme.prog?.length || 4) * 31) | 0
    return Array.from({ length: 12 }, () => {
      h = (h * 16807) % 2147483647
      return 0.25 + (h % 1000) / 1400
    })
  }, [theme.bpm, theme.density, theme.prog])
  return (
    <div className={'msx-sig' + (active ? ' live' : '')}>
      {bars.map((b, i) => <i key={i} style={{ height: `${Math.round(b * 100)}%`, animationDelay: `${i * 90}ms` }} />)}
    </div>
  )
}

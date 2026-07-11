import { useEffect, useMemo, useRef, useState } from 'react'
import {
  blankProject, formatList, PALETTES, textLayer, captionLayer, waveLayer,
  recomputeDuration, drawFrame, renderVoice, voiceList, bufferPeaks,
  exportVideo, downloadBlob, startClips,
} from '@arganta/video'
import { DEFAULT_SFX_RECIPES, createMasterChain, playRecipe } from '@arganta/audio'
import { Play, Pause, Plus, Eye, EyeOff, Trash2, ChevronUp, ChevronDown, Mic, Music2, Film, Download, Layers } from 'lucide-react'
import './video.css'

// cinematic first — GSAP-choreographed; the rest are the simple built-ins
const TEXT_ANIMS = ['cascade', 'cinematic', 'typewriter', 'pop', 'fade', 'slide', 'kinetic']
const BG_VARIANTS = ['aurora', 'rays', 'gradient', 'solid']
const FX_TOGGLES: [string, string][] = [
  ['camera', 'Camera push-in'], ['grain', 'Film grain'], ['vignette', 'Vignette'],
  ['sweep', 'Light sweep'], ['letterbox', 'Letterbox'],
]
const SFX_CUES = ['reward', 'quest', 'collect', 'harvest', 'tap', 'mount', 'take', 'sell']
  .filter((c) => (DEFAULT_SFX_RECIPES as any)[c])

// track hues (fixed, but clips sit on token-neutral lanes with color-mix so they read in both themes)
const HUE = { background: '#64748b', text: '#6366f1', caption: '#a855f7', waveform: '#06b6d4', voice: '#f59e0b', sfx: '#10b981' } as const

const fmt = (s: number) => { s = Math.max(0, s); const m = Math.floor(s / 60); const r = s - m * 60; return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}` }

async function renderCue(recipe: any): Promise<AudioBuffer> {
  const OAC = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext
  const ctx = new OAC(2, Math.ceil(1.8 * 44100), 44100)
  const { master, reverbBus } = createMasterChain(ctx, 0.8)
  playRecipe(ctx, master, reverbBus, recipe)
  return await ctx.startRendering()
}

export function VideoBuilder() {
  const [project, setProject] = useState<any>(() => blankProject('short'))
  const [selId, setSelId] = useState<string | null>(null)
  const [voiceText, setVoiceText] = useState('Three things your family calendar quietly nailed this week. And the third one is huge.')
  const [voiceId, setVoiceId] = useState('narrator')
  const [busy, setBusy] = useState<'' | 'voice' | 'export'>('')
  const [exportPct, setExportPct] = useState(0)
  const [status, setStatus] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)

  const projectRef = useRef(project); useEffect(() => { projectRef.current = project }, [project])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const timeRef = useRef<HTMLSpanElement>(null)
  const phRef = useRef<HTMLDivElement>(null)          // timeline playhead line
  const lanesRef = useRef<HTMLDivElement>(null)
  const playingRef = useRef(false)
  const playheadRef = useRef(0)
  const seekBaseRef = useRef(0)
  const startPerfRef = useRef(0)
  const actxRef = useRef<AudioContext | null>(null)
  const srcsRef = useRef<AudioBufferSourceNode[]>([])
  const [laneW, setLaneW] = useState(600)

  const fmtDef = project.format
  const sel = useMemo(() => project.layers.find((l: any) => l.id === selId) || null, [project, selId])
  const pps = laneW / Math.max(0.5, project.duration)

  // measure the lanes width for clip positioning
  useEffect(() => {
    const el = lanesRef.current; if (!el) return
    const ro = new ResizeObserver(() => setLaneW(el.clientWidth))
    ro.observe(el); setLaneW(el.clientWidth); return () => ro.disconnect()
  }, [])

  // one persistent draw + playhead loop
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const cv = canvasRef.current, P = projectRef.current
      if (cv) {
        if (cv.width !== P.format.w || cv.height !== P.format.h) { cv.width = P.format.w; cv.height = P.format.h }
        const ctx = cv.getContext('2d')!
        if (playingRef.current) {
          playheadRef.current = seekBaseRef.current + (performance.now() - startPerfRef.current) / 1000
          if (playheadRef.current >= P.duration) { playheadRef.current = P.duration; stopPlayback() }
        }
        drawFrame(ctx, P, playheadRef.current, P.format.w, P.format.h)
        if (timeRef.current) timeRef.current.firstChild!.textContent = fmt(playheadRef.current) + ' '
        const w = lanesRef.current?.clientWidth || laneW
        if (phRef.current) phRef.current.style.left = `${(playheadRef.current / P.duration) * w}px`
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf)
  }, []) // eslint-disable-line

  function ensureCtx() { if (!actxRef.current) { const AC = (window as any).AudioContext || (window as any).webkitAudioContext; actxRef.current = new AC() } return actxRef.current! }
  function stopSources() { srcsRef.current.forEach((s) => { try { s.stop() } catch { /* */ } }); srcsRef.current = [] }
  function stopPlayback() { playingRef.current = false; stopSources(); setIsPlaying(false) }
  function play() {
    const P = projectRef.current
    if (playheadRef.current >= P.duration - 0.01) playheadRef.current = 0
    const actx = ensureCtx(); actx.resume()
    seekBaseRef.current = playheadRef.current; startPerfRef.current = performance.now(); stopSources()
    srcsRef.current = startClips(actx, actx.destination, P.audio, actx.currentTime + 0.03, playheadRef.current)
    playingRef.current = true; setIsPlaying(true)
  }
  function pause() { playingRef.current = false; stopSources(); setIsPlaying(false) }
  function togglePlay() { playingRef.current ? pause() : play() }
  function seekTo(frac: number) { playheadRef.current = Math.max(0, Math.min(1, frac)) * projectRef.current.duration; if (playingRef.current) play() }
  function onLaneClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.vbx-clip')) return
    const r = lanesRef.current!.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width)
  }

  // ---- edits ----
  function update(mut: (p: any) => void) {
    setProject((prev: any) => { const p = { ...prev, layers: prev.layers.map((l: any) => ({ ...l })), audio: prev.audio.map((a: any) => ({ ...a })) }; mut(p); recomputeDuration(p); return p })
  }
  const patchLayer = (id: string, patch: any) => update((p) => { const l = p.layers.find((x: any) => x.id === id); if (l) Object.assign(l, patch) })
  function addText() { const t = textLayer('New line', { yN: 0.5, anim: 'pop' }); update((p) => p.layers.push(t)); setSelId(t.id) }
  function removeLayer(id: string) { update((p) => { p.layers = p.layers.filter((l: any) => l.id !== id) }); if (selId === id) setSelId(null) }
  function moveLayer(id: string, dir: -1 | 1) { update((p) => { const i = p.layers.findIndex((l: any) => l.id === id); const j = i + dir; if (i < 0 || j < 1 || j >= p.layers.length) return; const a = p.layers;[a[i], a[j]] = [a[j], a[i]] }) }
  function setPalette(pid: string) { const pal = PALETTES.find((x: any) => x.id === pid) || PALETTES[0]; update((p) => { const bg = p.layers.find((l: any) => l.type === 'background'); if (bg) { bg.colors = [...pal.colors]; bg.accent = pal.accent } p.palette = pal.id }) }
  function setFormat(id: string) { update((p) => { const f = formatList().find((x: any) => x.id === id); if (f) p.format = { ...f } }) }
  // move a clip's start along the timeline (layers use .start, audio uses .start)
  function setClipStart(kind: 'layer' | 'audio', id: string, start: number) {
    update((p) => { const arr = kind === 'layer' ? p.layers : p.audio; const c = arr.find((x: any) => x.id === id); if (c) c.start = Math.max(0, Math.round(start * 10) / 10) })
  }

  async function generateVoice() {
    if (!voiceText.trim()) { setStatus('Paste some text first.'); return }
    setBusy('voice'); setStatus('Synthesizing voice…')
    try {
      const { buffer, words, duration } = await renderVoice(voiceText.trim(), voiceId)
      const peaks = bufferPeaks(buffer, 220)
      const pal = PALETTES.find((x: any) => x.id === project.palette) || PALETTES[0]
      setProject((prev: any) => {
        const layers = prev.layers.filter((l: any) => !l.fromVoice).map((l: any) => ({ ...l }))
        const cap = captionLayer(words, { dur: duration, accent: pal.accent, yN: 0.8 }); (cap as any).fromVoice = true
        const wav = waveLayer(peaks, { dur: duration, color: '#06b6d4', yN: 0.63 }); (wav as any).fromVoice = true
        layers.push(wav, cap)
        const audio = prev.audio.filter((a: any) => a.kind !== 'voice')
        audio.push({ id: 'voice', kind: 'voice', buffer, start: 0, dur: duration, gain: 1, text: voiceText })
        const p = { ...prev, layers, audio, meta: { ...prev.meta, voiceText, voiceId } }; recomputeDuration(p); return p
      })
      setStatus(`Voice ready · ${duration.toFixed(1)}s · ${words.length} words. Captions + wave added.`)
    } catch (e: any) { setStatus('Voice failed: ' + (e?.message || e)) } finally { setBusy('') }
  }
  async function playVoiceOnly() {
    const clip = project.audio.find((a: any) => a.kind === 'voice'); if (!clip) return
    const actx = ensureCtx(); await actx.resume(); const src = actx.createBufferSource(); src.buffer = clip.buffer; src.connect(actx.destination); src.start()
  }
  async function addSfx(cue: string) {
    try { setStatus(`Rendering ${cue}…`); const buffer = await renderCue((DEFAULT_SFX_RECIPES as any)[cue])
      update((p) => { p.audio.push({ id: 'sfx_' + cue + '_' + Date.now(), kind: 'sfx', cue, buffer, start: Math.round(playheadRef.current * 10) / 10, dur: buffer.duration, gain: 0.7 }) })
      setStatus(`Added SFX “${cue}” at playhead — from Music Builder library.`)
    } catch (e: any) { setStatus('SFX failed: ' + (e?.message || e)) }
  }
  async function doExport() {
    if (playingRef.current) pause()
    setBusy('export'); setExportPct(0); setStatus('Recording — plays through once in real time…')
    try {
      const { blob, ext, duration } = await exportVideo(projectRef.current, { onProgress: setExportPct })
      const name = `video-forge-${Date.now()}.${ext}`; downloadBlob(blob, name)
      setStatus(`Exported ${name} · ${duration.toFixed(1)}s · ${(blob.size / 1024).toFixed(0)} KB`)
    } catch (e: any) { setStatus('Export failed: ' + (e?.message || e)) } finally { setBusy(''); setExportPct(0) }
  }

  // ---- timeline model ----
  const tracks = useMemo(() => {
    const P = project
    const layerClips = (type: string) => P.layers.filter((l: any) => l.type === type).map((l: any) => ({ kind: 'layer' as const, id: l.id, start: l.start || 0, dur: l.dur || P.duration, label: l.type === 'text' ? (l.text || 'text').replace(/\n/g, ' ').slice(0, 18) : l.name, peaks: l.peaks }))
    const audioClips = (k: string) => P.audio.filter((a: any) => a.kind === k).map((a: any) => ({ kind: 'audio' as const, id: a.id, start: a.start || 0, dur: a.dur || 1, label: a.kind === 'voice' ? 'voice' : (a.cue || 'sfx') }))
    return [
      { key: 'text', label: 'Text', hue: HUE.text, clips: layerClips('text') },
      { key: 'caption', label: 'Captions', hue: HUE.caption, clips: layerClips('caption') },
      { key: 'waveform', label: 'Wave', hue: HUE.waveform, clips: layerClips('waveform') },
      { key: 'voice', label: 'Voice', hue: HUE.voice, clips: audioClips('voice') },
      { key: 'sfx', label: 'SFX', hue: HUE.sfx, clips: audioClips('sfx') },
      { key: 'background', label: 'BG', hue: HUE.background, clips: P.layers.filter((l: any) => l.type === 'background').map((l: any) => ({ kind: 'layer' as const, id: l.id, start: 0, dur: P.duration, label: 'background' })) },
    ]
  }, [project])

  // clip drag
  const dragRef = useRef<{ kind: 'layer' | 'audio'; id: string; x0: number; s0: number } | null>(null)
  function onClipDown(e: React.PointerEvent, kind: 'layer' | 'audio', id: string, start: number, layerId?: string) {
    e.stopPropagation(); if (layerId) setSelId(layerId)
    dragRef.current = { kind, id, x0: e.clientX, s0: start }
    const move = (ev: PointerEvent) => { const d = dragRef.current; if (!d) return; const dx = ev.clientX - d.x0; setClipStart(d.kind, d.id, d.s0 + dx / pps) }
    const up = () => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }

  const dotColor = (t: string) => (HUE as any)[t] || HUE.sfx
  const ticks = Math.max(1, Math.ceil(project.duration))
  const toggleFx = (k: string) => update((p) => { p.fx = { ...(p.fx || {}), [k]: !(p.fx?.[k]) } })

  return (
    <div className="vbx">
      {busy === 'export' && <div className="vbx-expbar"><i style={{ width: `${exportPct * 100}%` }} /></div>}
      <div className="vbx-top">
        <div className="vbx-mark"><Film size={15} /></div>
        <div className="vbx-title"><b>Video Builder</b><span>Circle HQ · deterministic · zero-asset</span></div>
        <div className="seg" role="group" aria-label="Format">
          {formatList().map((f: any) => (
            <button key={f.id} className={project.format.id === f.id ? 'on' : ''} onClick={() => setFormat(f.id)}>{f.label}</button>
          ))}
        </div>
        <div className="vbx-spacer" />
        {status && <span className="vbx-status" title={status}>{status}</span>}
        <button className="vbx-export" disabled={busy !== ''} onClick={doExport}>
          <Download size={14} /> {busy === 'export' ? `Rendering ${Math.round(exportPct * 100)}%` : 'Export video'}
        </button>
      </div>

      <div className="vbx-main">
        <div className="vbx-stage">
          <span className="vbx-stagebadge">{fmtDef.label} · {fmtDef.w}×{fmtDef.h} · {fmtDef.aspect}</span>
          <div className="vbx-stagebox">
            <canvas ref={canvasRef} className="vbx-canvas" />
          </div>
          <button className="vbx-playbig" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <Pause /> : <Play />}
          </button>
        </div>

        <div className="vbx-insp">
          <div className="vbx-panel">
            <div className="vbx-ph"><Mic size={13} /> Voice · paste text<span className="badge">deterministic synth</span></div>
            <textarea className="vbx-ta" value={voiceText} onChange={(e) => setVoiceText(e.target.value)} placeholder="Paste the line to speak…" />
            <div className="vbx-row">
              <select className="vbx-sel" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                {voiceList().map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
              <button className="vbx-btn accent" disabled={busy !== ''} onClick={generateVoice}>{busy === 'voice' ? 'Synthesizing…' : 'Generate'}</button>
            </div>
            {project.audio.some((a: any) => a.kind === 'voice') && (
              <div className="vbx-row"><button className="vbx-btn" onClick={playVoiceOnly}><Play size={12} /> Preview voice</button><span className="vbx-mini">captions + wave auto-added</span></div>
            )}
          </div>

          <div className="vbx-panel">
            <div className="vbx-ph"><Music2 size={13} /> Sound · from Music Builder<span className="badge">@arganta/audio</span></div>
            <div className="vbx-chipwrap">{SFX_CUES.map((c) => <button key={c} className="vbx-chip vbx-cue" onClick={() => addSfx(c)}><Plus size={11} /> {c}</button>)}</div>
            <span className="vbx-mini">{project.audio.filter((a: any) => a.kind === 'sfx').length} SFX on timeline · lands at playhead</span>
          </div>

          <div className="vbx-panel">
            <div className="vbx-ph"><Film size={13} /> Film look<span className="badge">GSAP · deterministic</span></div>
            <div className="vbx-chipwrap">
              {FX_TOGGLES.map(([k, label]) => (
                <span key={k} className={'vbx-chip' + (project.fx?.[k] ? ' on' : '')} onClick={() => toggleFx(k)}>{label}</span>
              ))}
            </div>
          </div>

          <div className="vbx-panel">
            <div className="vbx-ph"><Layers size={13} /> Layers<button className="vbx-chip" onClick={addText} style={{ marginLeft: 'auto' }}><Plus size={11} /> text</button></div>
            <div className="vbx-layers">
              {[...project.layers].slice().reverse().map((l: any) => (
                <div key={l.id} className={'vbx-lrow' + (selId === l.id ? ' on' : '')} onClick={() => setSelId(l.id)}>
                  <span className="dot" style={{ background: dotColor(l.type) }} />
                  <span className="nm">{l.name}{l.type === 'text' ? ` · “${(l.text || '').replace(/\n/g, ' ').slice(0, 14)}”` : ''}</span>
                  <button className="vbx-ic" onClick={(e) => { e.stopPropagation(); moveLayer(l.id, 1) }} title="Up"><ChevronUp size={13} /></button>
                  <button className="vbx-ic" onClick={(e) => { e.stopPropagation(); moveLayer(l.id, -1) }} title="Down"><ChevronDown size={13} /></button>
                  <button className="vbx-ic" onClick={(e) => { e.stopPropagation(); patchLayer(l.id, { hidden: !l.hidden }) }} title="Toggle">{l.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  {l.type !== 'background' && <button className="vbx-ic" onClick={(e) => { e.stopPropagation(); removeLayer(l.id) }} title="Delete"><Trash2 size={13} /></button>}
                </div>
              ))}
            </div>
          </div>

          {sel && (
            <div className="vbx-panel">
              <div className="vbx-ph">{sel.name} · properties</div>
              {sel.type === 'text' && (<>
                <textarea className="vbx-ta" value={sel.text} onChange={(e) => patchLayer(sel.id, { text: e.target.value })} />
                <div className="vbx-field"><label>Animation</label><div className="vbx-chipwrap">{TEXT_ANIMS.map((a) => <span key={a} className={'vbx-chip' + (sel.anim === a ? ' on' : '')} onClick={() => patchLayer(sel.id, { anim: a })}>{a}</span>)}</div></div>
                <div className="vbx-field"><label>Size · {sel.size}px</label><input type="range" className="vbx-range" min={28} max={140} value={sel.size} onChange={(e) => patchLayer(sel.id, { size: +e.target.value })} /></div>
                <div className="vbx-field"><label>Vertical · {Math.round(sel.yN * 100)}%</label><input type="range" className="vbx-range" min={0.1} max={0.9} step={0.01} value={sel.yN} onChange={(e) => patchLayer(sel.id, { yN: +e.target.value })} /></div>
                <div className="vbx-field"><label>Duration · {sel.dur}s (start {sel.start}s)</label><input type="range" className="vbx-range" min={0.5} max={12} step={0.5} value={sel.dur} onChange={(e) => patchLayer(sel.id, { dur: +e.target.value })} /></div>
              </>)}
              {sel.type === 'background' && (<>
                <div className="vbx-field"><label>Style</label><div className="vbx-chipwrap">{BG_VARIANTS.map((v) => (
                  <span key={v} className={'vbx-chip' + ((sel.variant || 'gradient') === v ? ' on' : '')} onClick={() => patchLayer(sel.id, { variant: v })}>{v}</span>))}</div></div>
                <div className="vbx-field"><label>Palette</label><div className="vbx-swatches">{PALETTES.map((p: any) => (
                  <div key={p.id} className={'vbx-sw' + (project.palette === p.id ? ' on' : '')} title={p.id} style={{ background: `linear-gradient(135deg,${p.colors[0]},${p.colors[1]})` }} onClick={() => setPalette(p.id)} />))}</div></div>
              </>)}
              {(sel.type === 'caption' || sel.type === 'waveform') && <span className="vbx-mini">Auto-generated from voice. Re-generate voice to refresh timing.</span>}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- TIMELINE ---------------- */}
      <div className="vbx-timeline">
        <div className="vbx-tlhead">
          <button className="vbx-tbtn" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>{isPlaying ? <Pause size={15} /> : <Play size={15} />}</button>
          <span className="vbx-time" ref={timeRef}><span>0:00.0 </span><span className="dur">/ {fmt(project.duration)}</span></span>
          <span className="vbx-tlhint">drag clips to reposition · click a lane to seek</span>
        </div>
        <div className="vbx-tlbody">
          <div className="vbx-tlheads">
            <div className="rulerpad" />
            {tracks.map((t) => (<div key={t.key} className="vbx-thd"><span className="tdot" style={{ background: t.hue }} />{t.label}</div>))}
          </div>
          <div className="vbx-lanes" ref={lanesRef} onClick={onLaneClick}>
            <div className="vbx-ruler">
              {Array.from({ length: ticks + 1 }).map((_, i) => (
                <div key={i} className="vbx-tick" style={{ left: `${i * pps}px` }}><span>{i}s</span></div>
              ))}
            </div>
            {tracks.map((t) => (
              <div key={t.key} className="vbx-lane">
                {t.clips.map((c: any) => (
                  <div key={c.id} className={'vbx-clip' + (selId === c.id ? ' on' : '')} style={{ left: `${c.start * pps}px`, width: `${Math.max(10, c.dur * pps)}px`, ['--cc' as any]: t.hue }}
                    onPointerDown={(e) => onClipDown(e, c.kind, c.id, c.start, c.kind === 'layer' ? c.id : undefined)}
                    title={`${c.label} · ${c.start.toFixed(1)}s–${(c.start + c.dur).toFixed(1)}s`}>
                    {t.key === 'waveform' && c.peaks && <WaveMini peaks={c.peaks} hue={t.hue} />}
                    <span style={{ position: 'relative' }}>{c.label}</span>
                  </div>
                ))}
              </div>
            ))}
            <div className="vbx-playhead" ref={phRef} />
          </div>
        </div>
      </div>
    </div>
  )
}

function WaveMini({ peaks, hue }: { peaks: number[]; hue: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current; if (!c) return; const x = c.getContext('2d')!; const W = c.width = c.offsetWidth || 120, H = c.height = 22
    x.clearRect(0, 0, W, H); x.fillStyle = hue; const n = peaks.length, bw = W / n
    for (let i = 0; i < n; i++) { const h = Math.max(1, peaks[i] * H); x.fillRect(i * bw, (H - h) / 2, Math.max(1, bw - 0.5), h) }
  }, [peaks, hue])
  return <canvas ref={ref} className="wf" />
}

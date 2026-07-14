// Media Center — the single hub for every output type, as internal segments
// (no separate rail tabs). Real engines: Image (media-core, in-page PNG), Audio
// (@arganta/audio MusicTransport), Video (@arganta/video canvas + export).
// Stubbed engines (shell + maturity/provenance/approval spine ready, generator
// not wired): Website, Brand, Presentation deck, 3D Scene, Campaign.

import { useEffect, useRef, useState } from 'react'
import { generate, MATURITY } from '@arganta/media-core'
import { MUSIC_THEMES, MusicTransport, createMasterChain } from '@arganta/audio'
import { blankProject, textLayer, drawFrame, recomputeDuration, exportVideo } from '@arganta/video'
import { localCompose } from '../music/composer'
import { StudioShell, STAGES, StubStage, type HistoryItem } from '../studios/StudioShell'
import { stubGenerate } from '../studios/stub'

type Kind = 'image' | 'music' | 'video' | 'website' | 'brand' | 'deck' | 'scene' | 'campaign'
const REAL = new Set<Kind>(['image', 'music', 'video'])

const SEGMENTS: { id: Kind; label: string; hint: string }[] = [
  { id: 'image', label: 'Image', hint: 'Deterministic poster art' },
  { id: 'music', label: 'Audio', hint: 'Synthesized music' },
  { id: 'video', label: 'Video', hint: 'Canvas video + export' },
  { id: 'website', label: 'Website', hint: 'Landing pages & sites' },
  { id: 'brand', label: 'Brand', hint: 'Tokens & components' },
  { id: 'deck', label: 'Deck', hint: 'Cinematic presentation' },
  { id: 'scene', label: 'Scene', hint: 'Reusable 3D scenes' },
  { id: 'campaign', label: 'Campaign', hint: 'One brief → every output' },
]

// Metadata for the not-yet-wired segments (stubbed generation + stage card).
const STUB: Record<string, { provider: string; runtime: string; icon: string; title: string; body: string; defaultPrompt: string }> = {
  website: { provider: 'stub-website', runtime: 'browser', icon: '🌐', title: 'Website preview', defaultPrompt: 'A launch landing page for Arganta — hero, three features, a call-to-action.', body: 'A self-contained landing page renders in an iframe here, exportable as one .html. Pulls tokens from Brand and assets from Image/Video.' },
  brand: { provider: 'stub-brand', runtime: 'stub', icon: '🎨', title: 'Brand kit', defaultPrompt: 'Arganta — playful-premium, purple + ember, rounded geometric.', body: 'Color + type tokens, logo lockups, and reusable section blocks — the single source every other segment validates against.' },
  deck: { provider: 'stub-deck', runtime: 'browser', icon: '🎞️', title: 'Cinematic deck', defaultPrompt: '5-scene investor keynote: problem, insight, product, traction, ask.', body: 'A scene-by-scene cinematic HTML deck (canvas + timed narration, à la narrative-studio.html) plays here and exports as one .html.' },
  scene: { provider: 'stub-scene', runtime: 'browser', icon: '🧊', title: '3D scene', defaultPrompt: 'A glowing Arganta reactor core, slow orbit camera, ember rim light.', body: 'A live Three.js scene (camera, lighting, materials as data), exportable as an embeddable module with mobile/standard/cinematic tiers.' },
  campaign: { provider: 'stub-campaign', runtime: 'stub', icon: '🚀', title: 'Campaign', defaultPrompt: 'Launch campaign for the Arganta Family subscription — landing page, keynote, launch film, social pack.', body: 'One brief fans out to every segment above as a coordinated deliverable matrix.' },
}
const MATRIX: [string, string][] = [['🌐', 'Website'], ['🎞️', 'Deck'], ['🧊', 'Scene'], ['🖼️', 'Image'], ['🎬', 'Video'], ['🎵', 'Audio']]

export function MediaCenter() {
  const [kind, setKind] = useState<Kind>('image')
  const [stage, setStage] = useState<number>(MATURITY.DETERMINISTIC)
  const [prompt, setPrompt] = useState('Arganta — launch key art')
  const [result, setResult] = useState<any>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [exportPct, setExportPct] = useState<number | null>(null)
  const [approved, setApproved] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])

  // ---- audio engine (lazy) --------------------------------------------------
  const audioRef = useRef<{ ctx: AudioContext; transport: any } | null>(null)
  function ensureAudio() {
    if (audioRef.current) return audioRef.current
    const AC = window.AudioContext || (window as any).webkitAudioContext
    const ctx: AudioContext = new AC()
    const { master, reverbBus } = createMasterChain(ctx, 0.55)
    const transport = new MusicTransport(ctx, { master, revBus: reverbBus, onEvent: () => {} })
    audioRef.current = { ctx, transport }
    return audioRef.current
  }
  function stopAudio() { audioRef.current?.transport?.stop(); setPlaying(false) }

  // ---- video preview loop ---------------------------------------------------
  const projectRef = useRef<any>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number>(0)
  function paintFrame(t: number) {
    const cv = canvasRef.current, P = projectRef.current
    if (!cv || !P) return
    const ctx = cv.getContext('2d')!
    if (cv.width !== P.format.w) { cv.width = P.format.w; cv.height = P.format.h }
    drawFrame(ctx, P, t, P.format.w, P.format.h)
  }
  function startPreview(project: any) {
    projectRef.current = project
    cancelAnimationFrame(rafRef.current)
    requestAnimationFrame(() => paintFrame(0.35))
    paintFrame(0.35)
    const t0 = performance.now()
    const loop = () => {
      const P = projectRef.current
      if (P) paintFrame(((performance.now() - t0) / 1000) % (P.duration || 6))
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
  }
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); stopAudio() }, [])

  function buildVideoProject(text: string) {
    const p = blankProject('short')
    const bg = p.layers[0]
    const lines = text.split(/[.\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 4)
    const texts = (lines.length ? lines : [text || 'Arganta']).map((line, i) =>
      textLayer(line, { start: i * 1.6, dur: 1.9, yN: 0.4 + (i % 2) * 0.14, anim: i === 0 ? 'cascade' : 'pop' }))
    p.layers = [bg, ...texts]
    recomputeDuration(p)
    return p
  }

  // ---- generate -------------------------------------------------------------
  async function onGenerate(force = false) {
    setBusy(true); setResult(null)
    try {
      let res: any
      if (REAL.has(kind)) {
        const spec = kind === 'image' ? { prompt, width: 768, height: 768 } : { prompt }
        res = generate({ kind, spec, maturityStage: stage, approved: approved || force })
        setResult(res)
        if (res.status === 'failed') return
        if (kind === 'image' && res.status === 'succeeded') {
          if (imgUrl) URL.revokeObjectURL(imgUrl)
          setImgUrl(URL.createObjectURL(new Blob([res.output.bytes], { type: res.output.mime || 'image/png' })))
        } else if (kind === 'music') {
          stopAudio()
          const a = ensureAudio()
          if (a.ctx.state === 'suspended') await a.ctx.resume()
          a.transport.setTheme(localCompose(prompt || 'calm bright', Object.values(MUSIC_THEMES)[0]))
          a.transport.start(); setPlaying(true)
        } else if (kind === 'video') {
          setVideoUrl(null)
          startPreview(buildVideoProject(prompt))
        }
      } else {
        const meta = STUB[kind]
        res = stubGenerate(kind, stage, approved || force, meta.provider, meta.runtime)
        setResult(res)
        if (res.status === 'failed') return
      }
      const label = kind === 'music' ? 'audio' : kind
      setHistory(h => [{ label, sub: STAGES[stage]?.label, cost: res.provenance?.cost ?? 0, status: res.status }, ...h].slice(0, 12))
    } finally { setBusy(false) }
  }

  async function onExportVideo() {
    if (!projectRef.current) return
    setExportPct(0)
    try {
      const { blob } = await exportVideo(projectRef.current, { onProgress: setExportPct })
      setVideoUrl(URL.createObjectURL(blob))
    } finally { setExportPct(null) }
  }

  function switchKind(next: Kind) {
    setKind(next); setResult(null); setApproved(false)
    if (!REAL.has(next) && STUB[next]) setPrompt(STUB[next].defaultPrompt)
  }

  const seg = SEGMENTS.find(s => s.id === kind)!
  const genVerb = kind === 'music' ? 'audio' : (REAL.has(kind) ? kind : seg.label.toLowerCase())

  const controlsExtra = (
    <>
      {kind === 'music' && playing && <button className="ghost" onClick={stopAudio}>■ Stop</button>}
      {kind === 'video' && projectRef.current && (
        exportPct == null
          ? <button className="ghost" onClick={onExportVideo}>⬇ Render real video file</button>
          : <div className="prog"><i style={{ width: `${Math.round(exportPct * 100)}%` }} />{Math.round(exportPct * 100)}%</div>
      )}
    </>
  )

  return (
    <StudioShell
      title="Media Center"
      segments={SEGMENTS}
      segment={kind}
      onSegment={(id) => switchKind(id as Kind)}
      stage={stage}
      onStage={(s) => { setStage(s); setApproved(false); setResult(null) }}
      prompt={prompt}
      onPrompt={setPrompt}
      promptLabel={REAL.has(kind) ? 'Prompt / spec' : 'Brief'}
      generateLabel={`Generate ${genVerb}`}
      onGenerate={() => onGenerate()}
      busy={busy}
      result={result}
      onApprove={() => { setApproved(true); onGenerate(true) }}
      history={history}
      controlsExtra={controlsExtra}
    >
      {kind === 'image' ? (
        imgUrl ? <img className="preview-img" src={imgUrl} alt="generated" /> : <div className="empty">Your image will appear here</div>
      ) : kind === 'music' ? (
        <div className={'audio-stage' + (playing ? ' live' : '')}>
          <div className="eq">{Array.from({ length: 7 }).map((_, i) => <span key={i} style={{ animationDelay: `${i * 0.08}s` }} />)}</div>
          <p>{playing ? 'Playing synthesized audio…' : 'Generate to play audio'}</p>
        </div>
      ) : kind === 'video' ? (
        <div className="video-stage">
          <canvas ref={canvasRef} className="preview-canvas" />
          {videoUrl && <video className="preview-video" src={videoUrl} controls autoPlay loop />}
        </div>
      ) : kind === 'campaign' ? (
        <div className="matrix">
          {MATRIX.map(([ico, label]) => (
            <div className="cell" key={label}>
              <span className="m-ico">{ico}</span><b>{label}</b>
              <i>{result && result.status !== 'failed' ? 'queued' : '—'}</i>
            </div>
          ))}
        </div>
      ) : (
        <StubStage icon={STUB[kind].icon} title={STUB[kind].title} body={STUB[kind].body} result={result} />
      )}
    </StudioShell>
  )
}

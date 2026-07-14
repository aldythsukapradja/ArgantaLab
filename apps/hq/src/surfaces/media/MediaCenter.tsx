// Media Center — the single hub for every output type, as internal segments.
// Every segment produces a tangible result at Stage-0 (deterministic & free):
//   Image  → real PNG (media-core)          Website → self-contained landing HTML
//   Audio  → synthesized music (@arganta)    Brand   → seeded palette + type kit
//   Video  → canvas video + real export      Deck    → cinematic HTML slides
//   Scene  → live Three.js scene (R3F)       Campaign→ fan-out matrix of the above
//   Analytics → types a question → the right chart, grounded in real repo data

import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { generate, MATURITY } from '@arganta/media-core'
import { MUSIC_THEMES, MusicTransport, createMasterChain } from '@arganta/audio'
import { blankProject, textLayer, drawFrame, recomputeDuration, exportVideo } from '@arganta/video'
import { localCompose } from '../music/composer'
import { StudioShell, STAGES, type HistoryItem } from '../studios/StudioShell'
import { stubGenerate } from '../studios/stub'
import { makeBrand, makeWebsite, makeDeck, type BrandKit } from '../studios/engines'
import { analyze, SAMPLES, type Analysis } from '../studios/analytics'

const SceneCanvas = lazy(() => import('../studios/SceneCanvas').then(m => ({ default: m.SceneCanvas })))
const AnalyticsChart = lazy(() => import('../studios/AnalyticsChart').then(m => ({ default: m.AnalyticsChart })))

type Kind = 'image' | 'music' | 'video' | 'website' | 'brand' | 'deck' | 'scene' | 'campaign' | 'analytics'
const REAL = new Set<Kind>(['image', 'music', 'video'])

const SEGMENTS: { id: Kind; label: string; hint: string }[] = [
  { id: 'image', label: 'Image', hint: 'Deterministic poster art' },
  { id: 'music', label: 'Audio', hint: 'Synthesized music' },
  { id: 'video', label: 'Video', hint: 'Canvas video + export' },
  { id: 'website', label: 'Website', hint: 'Self-contained landing page' },
  { id: 'brand', label: 'Brand', hint: 'Palette + type kit' },
  { id: 'deck', label: 'Deck', hint: 'Cinematic HTML slides' },
  { id: 'scene', label: 'Scene', hint: 'Live 3D (Three.js)' },
  { id: 'campaign', label: 'Campaign', hint: 'One brief → every output' },
  { id: 'analytics', label: 'Analytics', hint: 'Question → the right chart' },
]

const DEFAULT_PROMPT: Partial<Record<Kind, string>> = {
  image: 'Arganta — launch key art',
  website: 'A launch landing page for Arganta — hero, three features, a call-to-action.',
  brand: 'Arganta — playful-premium, purple + ember, rounded geometric.',
  deck: 'Problem, Insight, Product, Traction, The ask',
  scene: 'Arganta reactor core',
  campaign: 'Launch campaign for the Arganta Family subscription.',
  analytics: 'ARR as we scale families',
}

export function MediaCenter() {
  const [kind, setKind] = useState<Kind>('image')
  const [stage, setStage] = useState<number>(MATURITY.DETERMINISTIC)
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT.image!)
  const [result, setResult] = useState<any>(null)
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [siteHtml, setSiteHtml] = useState<string | null>(null)
  const [deckHtml, setDeckHtml] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandKit | null>(null)
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [campaign, setCampaign] = useState<any>(null)
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
    const ok = approved || force
    try {
      let res: any
      if (REAL.has(kind)) {
        const spec = kind === 'image' ? { prompt, width: 768, height: 768 } : { prompt }
        res = generate({ kind, spec, maturityStage: stage, approved: ok })
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
          setVideoUrl(null); startPreview(buildVideoProject(prompt))
        }
      } else if (kind === 'analytics') {
        res = stubGenerate('analytics', stage, ok, 'analytics-engine', 'browser', 0, 'succeeded')
        if (res.status !== 'failed') {
          const a = analyze(prompt); setAnalysis(a)
          res.provenance.provider = `analytics · ${a.chart}`
          res.descriptor = { engine: a.source, kind: 'analytics' }
        }
        setResult(res)
      } else {
        // deterministic HTML / brand / scene / campaign engines
        const provider = 'deterministic-' + kind
        res = stubGenerate(kind, stage, ok, provider, 'browser', 0, 'succeeded')
        if (res.status !== 'failed') {
          const b = makeBrand(prompt)
          if (kind === 'website') setSiteHtml(makeWebsite(prompt, b))
          else if (kind === 'deck') setDeckHtml(makeDeck(prompt, b))
          else if (kind === 'brand') setBrand(b)
          else if (kind === 'scene') setBrand(b)
          else if (kind === 'campaign') {
            const img = generate({ kind: 'image', spec: { prompt, width: 512, height: 512 }, maturityStage: 0 })
            const url = img.status === 'succeeded' ? URL.createObjectURL(new Blob([img.output.bytes], { type: 'image/png' })) : null
            setCampaign({ brand: b, site: makeWebsite(prompt, b), deck: makeDeck(prompt, b), img: url })
          }
          res.provenance.seed = b.seed
        }
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
    if (DEFAULT_PROMPT[next]) setPrompt(DEFAULT_PROMPT[next]!)
  }

  const seg = SEGMENTS.find(s => s.id === kind)!
  const genVerb = kind === 'music' ? 'audio' : seg.label.toLowerCase()

  const controlsExtra = (
    <>
      {kind === 'music' && playing && <button className="ghost" onClick={stopAudio}>■ Stop</button>}
      {kind === 'video' && projectRef.current && (
        exportPct == null
          ? <button className="ghost" onClick={onExportVideo}>⬇ Render real video file</button>
          : <div className="prog"><i style={{ width: `${Math.round(exportPct * 100)}%` }} />{Math.round(exportPct * 100)}%</div>
      )}
      {kind === 'analytics' && (
        <div className="samples">{SAMPLES.map(s => <button key={s} className="samp" onClick={() => setPrompt(s)}>{s}</button>)}</div>
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
      promptLabel={kind === 'analytics' ? 'Ask a question' : REAL.has(kind) ? 'Prompt / spec' : 'Brief'}
      generateLabel={kind === 'analytics' ? 'Analyze' : `Generate ${genVerb}`}
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
      ) : kind === 'website' ? (
        siteHtml ? <iframe className="preview-frame" title="website" srcDoc={siteHtml} /> : <div className="empty">Your landing page will render here</div>
      ) : kind === 'deck' ? (
        deckHtml ? <iframe className="preview-frame" title="deck" srcDoc={deckHtml} /> : <div className="empty">Your slide deck will play here</div>
      ) : kind === 'brand' ? (
        brand ? <BrandPreview b={brand} /> : <div className="empty">Your brand kit will appear here</div>
      ) : kind === 'scene' ? (
        <div className="frame-stage"><Suspense fallback={<div className="empty">Loading 3D…</div>}><SceneCanvas color={brand?.colors.mid} accent={brand?.colors.accent} /></Suspense></div>
      ) : kind === 'campaign' ? (
        <CampaignMatrix c={campaign} />
      ) : (
        analysis ? <Suspense fallback={<div className="empty">Rendering chart…</div>}><AnalyticsChart a={analysis} /></Suspense> : <div className="empty">Ask a question — I'll pick the right chart</div>
      )}
    </StudioShell>
  )
}

function BrandPreview({ b }: { b: BrandKit }) {
  const c = b.colors
  return (
    <div className="brand-preview">
      <div className="swatches">
        {[['bg', c.bg], ['mid', c.mid], ['accent', c.accent]].map(([n, v]) => (
          <div key={n} className="sw" style={{ background: v }}><span>{n}</span><b>{v}</b></div>
        ))}
      </div>
      <div className="brand-type">
        <div style={{ fontFamily: b.fonts.head, fontSize: 30, fontWeight: 800 }}>{b.name}</div>
        <div style={{ fontFamily: b.fonts.body, opacity: .7, fontSize: 14 }}>Palette “{b.palette}” · type pairing “{b.fonts.name}” · seed {b.seed}</div>
      </div>
    </div>
  )
}

function CampaignMatrix({ c }: { c: any }) {
  const cells = [
    { ico: '🎨', label: 'Brand', node: c?.brand ? <div className="tile-brand" style={{ background: `linear-gradient(135deg,${c.brand.colors.bg},${c.brand.colors.accent})` }} /> : null },
    { ico: '🌐', label: 'Website', node: c?.site ? <iframe className="tile-frame" title="c-site" srcDoc={c.site} /> : null },
    { ico: '🎞️', label: 'Deck', node: c?.deck ? <iframe className="tile-frame" title="c-deck" srcDoc={c.deck} /> : null },
    { ico: '🖼️', label: 'Image', node: c?.img ? <img className="tile-img" src={c.img} alt="" /> : null },
  ]
  return (
    <div className="matrix">
      {cells.map(({ ico, label, node }) => (
        <div className="cell" key={label}>
          {node || <span className="m-ico">{ico}</span>}
          <b>{label}</b><i>{c ? 'ready' : '—'}</i>
        </div>
      ))}
    </div>
  )
}

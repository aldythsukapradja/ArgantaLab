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

const PLACEHOLDER: Record<Kind, string> = {
  image: 'Describe an image…', music: 'Describe the music…', video: 'Paste a script or line…',
  website: 'Describe the site you want…', brand: 'Describe the brand…', deck: 'Outline your deck…',
  scene: 'Describe a 3D scene…', campaign: 'Describe the campaign…', analytics: 'Ask about your data…',
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
  async function onGenerate(opts: { force?: boolean; prompt?: string; kind?: Kind; stage?: number; silent?: boolean } = {}) {
    const k = opts.kind ?? kind
    const st = opts.stage ?? stage
    const text = (opts.prompt ?? prompt).trim()
    if (!text) return
    setBusy(true); setResult(null)
    const ok = approved || !!opts.force
    try {
      let res: any
      if (REAL.has(k)) {
        const spec = k === 'image' ? { prompt: text, width: 768, height: 768 } : { prompt: text }
        res = generate({ kind: k, spec, maturityStage: st, approved: ok })
        setResult(res)
        if (res.status === 'failed') return
        if (k === 'image' && res.status === 'succeeded') {
          if (imgUrl) URL.revokeObjectURL(imgUrl)
          setImgUrl(URL.createObjectURL(new Blob([res.output.bytes], { type: res.output.mime || 'image/png' })))
        } else if (k === 'music') {
          stopAudio()
          const a = ensureAudio()
          if (a.ctx.state === 'suspended') await a.ctx.resume()
          a.transport.setTheme(localCompose(text || 'calm bright', Object.values(MUSIC_THEMES)[0]))
          a.transport.start(); setPlaying(true)
        } else if (k === 'video') {
          setVideoUrl(null); startPreview(buildVideoProject(text))
        }
      } else if (k === 'analytics') {
        res = stubGenerate('analytics', st, ok, 'analytics-engine', 'browser', 0, 'succeeded')
        if (res.status !== 'failed') {
          const a = analyze(text); setAnalysis(a)
          res.provenance.provider = `analytics · ${a.chart}`
          res.descriptor = { engine: a.source, kind: 'analytics' }
        }
        setResult(res)
      } else {
        // deterministic HTML / brand / scene / campaign engines
        const provider = 'deterministic-' + k
        res = stubGenerate(k, st, ok, provider, 'browser', 0, 'succeeded')
        if (res.status !== 'failed') {
          const b = makeBrand(text)
          if (k === 'website') setSiteHtml(makeWebsite(text, b))
          else if (k === 'deck') setDeckHtml(makeDeck(text, b))
          else if (k === 'brand') setBrand(b)
          else if (k === 'scene') setBrand(b)
          else if (k === 'campaign') {
            const img = generate({ kind: 'image', spec: { prompt: text, width: 512, height: 512 }, maturityStage: 0 })
            const url = img.status === 'succeeded' ? URL.createObjectURL(new Blob([img.output.bytes], { type: 'image/png' })) : null
            setCampaign({ brand: b, site: makeWebsite(text, b), deck: makeDeck(text, b), img: url })
          }
          res.provenance.seed = b.seed
        }
        setResult(res)
        if (res.status === 'failed') return
      }
      if (opts.silent) return // restore — don't add a new version
      const label = k === 'music' ? 'audio' : k
      setHistory(h => [{ kind: k, prompt: text, stage: st, label, sub: STAGES[st]?.label, cost: res.provenance?.cost ?? 0, status: res.status, time: Date.now() }, ...h].slice(0, 12))
    } finally { setBusy(false) }
  }

  function onDelete(h: HistoryItem) { setHistory(hs => hs.filter(x => x !== h)) }

  // Restore a version — deterministic engines reproduce it byte-identically.
  function onRestore(h: HistoryItem) {
    const k = (h.kind as Kind) || kind
    if (k !== kind) setKind(k)
    if (h.prompt != null) setPrompt(h.prompt)
    if (h.stage != null) setStage(h.stage)
    onGenerate({ kind: k, prompt: h.prompt, stage: h.stage, silent: true })
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

  const ask = (s: string) => { setPrompt(s); onGenerate({ prompt: s }) }

  // download helpers for the drawer Output section
  const dlUrl = (name: string, url: string) => { const a = document.createElement('a'); a.href = url; a.download = name; a.click() }
  const dlText = (name: string, text: string, mime = 'text/html') => dlUrl(name, URL.createObjectURL(new Blob([text], { type: mime })))
  const brandCss = (b: BrandKit) => `:root{\n  --bg:${b.colors.bg};\n  --mid:${b.colors.mid};\n  --accent:${b.colors.accent};\n  --font-head:${b.fonts.head};\n  --font-body:${b.fonts.body};\n}`

  const outputActions = (
    <>
      {kind === 'image' && imgUrl && <button className="ghost" onClick={() => dlUrl('media.png', imgUrl)}>⬇ PNG</button>}
      {kind === 'website' && siteHtml && <button className="ghost" onClick={() => dlText('landing.html', siteHtml)}>⬇ HTML</button>}
      {kind === 'deck' && deckHtml && <button className="ghost" onClick={() => dlText('deck.html', deckHtml)}>⬇ HTML</button>}
      {kind === 'brand' && brand && <button className="ghost" onClick={() => dlText('brand.css', brandCss(brand), 'text/css')}>⬇ CSS</button>}
      {kind === 'video' && videoUrl && <button className="ghost" onClick={() => dlUrl('media.webm', videoUrl)}>⬇ Video</button>}
    </>
  )

  const controlsExtra = (
    <>
      {kind === 'music' && playing && <button className="ghost" onClick={stopAudio}>■ Stop</button>}
      {kind === 'video' && projectRef.current && (
        exportPct == null
          ? <button className="ghost" onClick={onExportVideo}>⬇ Export file</button>
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
      promptPlaceholder={PLACEHOLDER[kind]}
      generateLabel={kind === 'analytics' ? 'Analyze' : `Make ${genVerb}`}
      onGenerate={() => onGenerate()}
      busy={busy}
      result={result}
      onApprove={() => { setApproved(true); onGenerate({ force: true }) }}
      history={history}
      onRestore={onRestore}
      onDelete={onDelete}
      outputActions={outputActions}
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
        analysis ? <Suspense fallback={<div className="empty">Rendering chart…</div>}><AnalyticsChart a={analysis} /></Suspense> : (
          <div className="ask-empty">
            <p>Ask about your data — I'll pick the right chart.</p>
            <div className="ask-chips">{SAMPLES.map(s => <button key={s} className="samp" onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
        )
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

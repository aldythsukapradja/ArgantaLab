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
import { makeBrand, makeWebsite, makeDeck, type BrandKit, type WebsiteCopy } from '../studios/engines'
import { analyze, SAMPLES, type Analysis } from '../studios/analytics'
import { askInsight, type Insight } from '../studios/analytics-intelligence'
import { askWebsiteCopy, askDeckOutline } from '../studios/content-intelligence'
import { onModelProgress, logAgentRun } from '../../lib/ai'

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
  // S1/S2 — the brand + brief used for the last Website/Deck generation, kept
  // around so "Ask AI" can regenerate with better copy without re-running Generate.
  const [websiteCtx, setWebsiteCtx] = useState<{ text: string; brand: BrandKit } | null>(null)
  const [deckCtx, setDeckCtx] = useState<{ text: string; brand: BrandKit } | null>(null)
  const [websiteAi, setWebsiteAi] = useState<{ copy: WebsiteCopy; provenance: any } | null>(null)
  const [deckAi, setDeckAi] = useState<{ scenes: string[]; provenance: any } | null>(null)
  const [websiteAiState, setWebsiteAiState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [deckAiState, setDeckAiState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [insight, setInsight] = useState<Insight | null>(null)
  const [insightState, setInsightState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [insightProgress, setInsightProgress] = useState<{ pct: number; text: string } | null>(null)
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
    // WS-5 metering — one ledger row per generation attempt, success OR failure
    // (a blocked/rejected attempt — e.g. approval_required — is observability
    // data too, same principle as intelligence.js's degrade() path). Real
    // revenue data flows through Analytics even on the deterministic path, so
    // it's classified confidential like the AI insight path (ADR-0003).
    const logMediaRun = (r: any) => {
      const prov = r.provenance || {}
      logAgentRun({
        runId: crypto.randomUUID(), domain: 'media', task: k,
        dataClass: k === 'analytics' ? 'confidential' : 'public',
        requestedCostClass: st, actualCostClass: prov.maturityStage ?? st,
        requestedProvider: prov.provider ?? null, requestedModel: null,
        actualProvider: prov.provider ?? null, actualModel: null,
        costUsd: prov.cost ?? 0, status: r.status === 'failed' ? 'failed' : 'succeeded',
        error: r.status === 'failed' ? r.error?.code ?? null : null,
      })
    }
    try {
      let res: any
      if (REAL.has(k)) {
        const spec = k === 'image' ? { prompt: text, width: 768, height: 768 } : { prompt: text }
        res = generate({ kind: k, spec, maturityStage: st, approved: ok })
        setResult(res)
        if (res.status === 'failed') { logMediaRun(res); return }
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
          setInsight(null); setInsightState('idle') // new chart → any prior AI insight no longer applies
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
          if (k === 'website') {
            setSiteHtml(makeWebsite(text, b)); setWebsiteCtx({ text, brand: b })
            setWebsiteAi(null); setWebsiteAiState('idle') // new generation → prior AI copy no longer applies
          }
          else if (k === 'deck') {
            setDeckHtml(makeDeck(text, b)); setDeckCtx({ text, brand: b })
            setDeckAi(null); setDeckAiState('idle')
          }
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
        if (res.status === 'failed') { logMediaRun(res); return }
      }
      logMediaRun(res)

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

  // WS-6 slice — opt-in sovereign-model insight on the current chart. Never
  // auto-fires (the model may need a first-run download of ~1.6GB+), so this
  // is only invoked from an explicit button click.
  async function askAiInsight() {
    if (!analysis || insightState === 'loading') return
    setInsightState('loading'); setInsightProgress(null)
    const unsub = onModelProgress((p) => setInsightProgress({ pct: Math.round((p.progress || 0) * 100), text: p.text }))
    try {
      const res = await askInsight(prompt, analysis)
      if (res) { setInsight(res); setInsightState('idle') } else { setInsightState('error') }
    } catch { setInsightState('error') }
    finally { unsub(); setInsightProgress(null) }
  }

  // S1 — opt-in AI-assisted website copy. Regenerates the same deterministic
  // template with a real headline + features instead of the raw-text extraction.
  async function askWebsiteAI() {
    if (!websiteCtx || websiteAiState === 'loading') return
    setWebsiteAiState('loading')
    try {
      const res = await askWebsiteCopy(websiteCtx.text)
      if (res) { setWebsiteAi({ copy: res.data, provenance: res.provenance }); setSiteHtml(makeWebsite(websiteCtx.text, websiteCtx.brand, res.data)); setWebsiteAiState('idle') }
      else setWebsiteAiState('error')
    } catch { setWebsiteAiState('error') }
  }

  // S2 — opt-in AI-assisted deck outline (topic → real per-scene scripts).
  async function askDeckAI() {
    if (!deckCtx || deckAiState === 'loading') return
    setDeckAiState('loading')
    try {
      const res = await askDeckOutline(deckCtx.text)
      if (res) { setDeckAi({ scenes: res.data, provenance: res.provenance }); setDeckHtml(makeDeck(deckCtx.text, deckCtx.brand, res.data)); setDeckAiState('idle') }
      else setDeckAiState('error')
    } catch { setDeckAiState('error') }
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
        siteHtml ? (
          <div className="frame-stage">
            <iframe className="preview-frame" title="website" srcDoc={siteHtml} />
            <MiniAiAssist state={websiteAiState} done={!!websiteAi} onAsk={askWebsiteAI} label="Ask AI for real copy" />
          </div>
        ) : <div className="empty">Your landing page will render here</div>
      ) : kind === 'deck' ? (
        deckHtml ? (
          <div className="frame-stage">
            <iframe className="preview-frame" title="deck" srcDoc={deckHtml} />
            <MiniAiAssist state={deckAiState} done={!!deckAi} onAsk={askDeckAI} label="Ask AI to expand outline" />
          </div>
        ) : <div className="empty">Your slide deck will play here</div>
      ) : kind === 'brand' ? (
        brand ? <BrandPreview b={brand} /> : <div className="empty">Your brand kit will appear here</div>
      ) : kind === 'scene' ? (
        <div className="frame-stage"><Suspense fallback={<div className="empty">Loading 3D…</div>}><SceneCanvas color={brand?.colors.mid} accent={brand?.colors.accent} /></Suspense></div>
      ) : kind === 'campaign' ? (
        <CampaignMatrix c={campaign} />
      ) : (
        analysis ? (
          <Suspense fallback={<div className="empty">Rendering chart…</div>}>
            <div className="analytics-wrap">
              <AnalyticsChart a={analysis} />
              <AiInsightBar state={insightState} insight={insight} progress={insightProgress} onAsk={askAiInsight} />
            </div>
          </Suspense>
        ) : (
          <div className="ask-empty">
            <p>Ask about your data — I'll pick the right chart.</p>
            <div className="ask-chips">{SAMPLES.map(s => <button key={s} className="samp" onClick={() => ask(s)}>{s}</button>)}</div>
          </div>
        )
      )}
    </StudioShell>
  )
}

// WS-6 slice — surfaces the sovereign (Tier 0, local) insight below a chart.
// Opt-in only; the deterministic chart above never waits on this. Provenance
// is shown honestly: costClass 0 = "Sovereign · local · $0", never a paid claim.
function AiInsightBar({ state, insight, progress, onAsk }: { state: 'idle' | 'loading' | 'error'; insight: Insight | null; progress: { pct: number; text: string } | null; onAsk: () => void }) {
  if (insight) {
    const p = insight.provenance
    return (
      <div className="ai-insight on">
        <span className="ai-badge">🧠 {p?.actualCostClass === 0 ? 'Sovereign · local · $0' : `${p?.actualProvider || 'AI'} · $${p?.costUsd ?? 0}`}</span>
        <p>{insight.text}</p>
      </div>
    )
  }
  if (state === 'loading') {
    return (
      <div className="ai-insight">
        <button className="ai-ask" disabled>⏳ {progress ? `Loading local model… ${progress.pct}%` : 'Thinking…'}</button>
      </div>
    )
  }
  return (
    <div className="ai-insight">
      <button className="ai-ask" onClick={onAsk}>🧠 Ask AI for an insight {state === 'error' ? '(retry — no local model available?)' : ''}</button>
    </div>
  )
}

// S1/S2 — a compact floating "Ask AI" pill over an iframe preview (Website/
// Deck). Same opt-in discipline: never auto-fires, the deterministic HTML is
// already showing underneath while this is idle/loading/error.
function MiniAiAssist({ state, done, onAsk, label }: { state: 'idle' | 'loading' | 'error'; done: boolean; onAsk: () => void; label: string }) {
  return (
    <button className={'mini-ai-assist' + (done ? ' done' : '')} onClick={onAsk} disabled={state === 'loading'}>
      {state === 'loading' ? '⏳ Thinking…' : done ? '✨ AI-enhanced' : `🧠 ${label}${state === 'error' ? ' (retry)' : ''}`}
    </button>
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

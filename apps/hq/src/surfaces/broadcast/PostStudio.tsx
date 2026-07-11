/**
 * POST STUDIO — the Content Builder's main surface. One Video-Builder-shaped
 * workspace that designs ANY social post: Instagram 4:5 / square / story·reel,
 * TikTok, X, LinkedIn, Pinterest. Canvas-true preview, carousel slides strip,
 * palette brand-kit, Supabase media, per-platform caption intelligence, an AI
 * Copilot (prompt → carousel, offline-safe), PNG export at exact platform size,
 * and a one-click hand-off into the Discover feed.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Megaphone, Download, Wand2, X, Send, Plus, Trash2, Copy as CopyIcon,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Layers,
  Type as TypeIcon, Palette, Cloud, Upload, Sparkles, Sticker, MessageSquareText,
  History, LayoutTemplate, Check, Shuffle, ScanLine, Rocket,
} from 'lucide-react'
import { listAssets, uploadAsset, importStock, downloadBlob } from '@arganta/video'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { ai, aiLive } from '../../lib/ai'
import { live } from '../../data/live'
import {
  POST_FORMATS, postFormat, POST_PALETTES, postPalette, BG_VARIANTS,
  CAPTION_RULES, captionRule, STICKERS, drawSlide, drawGuides, renderSlideBlob,
  pid, type PostDoc, type PostSlide, type PostLayer, type TextLayer, type RenderEnv,
} from './postEngine'
import { TEMPLATES, makeSlide, starterDoc, POST_SCHEMA, postMessages, coercePost, localPost, type TemplateContent } from './postTemplates'
import './post.css'

const STORE_KEY = 'hq_post_studio_v1'

function loadDoc(): PostDoc {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) {
      const d = JSON.parse(raw)
      if (d && d.v === 1 && Array.isArray(d.slides) && d.slides.length) return d as PostDoc
    }
  } catch { /* fresh start */ }
  return starterDoc()
}

/** Pull the headline/body of a slide so re-templating keeps the words. */
function slideContent(s: PostSlide): TemplateContent {
  const texts = s.layers.filter((l): l is TextLayer => l.type === 'text')
  const by = (names: string[]) => texts.find(t => names.includes(t.name))?.text
  const emoji = s.layers.find(l => l.type === 'emoji') as { char?: string } | undefined
  const badge = s.layers.find(l => l.type === 'badge') as { text?: string } | undefined
  return {
    headline: by(['Headline', 'Title', 'Quote', 'Number']),
    body: by(['Body', 'Subline', 'Items']),
    source: by(['Source', 'Author']),
    emoji: emoji?.char,
    badge: badge?.text,
  }
}

function cloneSlide(s: PostSlide): PostSlide {
  const c: PostSlide = JSON.parse(JSON.stringify(s))
  c.id = pid('sl')
  c.layers = c.layers.map(l => ({ ...l, id: pid('l') }))
  return c
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'post'

export function PostStudio({ onLegacy }: { onLegacy: () => void }) {
  const [doc, setDoc] = useState<PostDoc>(loadDoc)
  const [sel, setSel] = useState(0)
  const [selLayer, setSelLayer] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState<'' | 'export' | 'publish'>('')
  const [guides, setGuides] = useState(false)
  const [tick, setTick] = useState(0)
  // media library
  const [assets, setAssets] = useState<any[]>([])
  const [impQuery, setImpQuery] = useState('cozy family moment')
  const [mediaBusy, setMediaBusy] = useState(false)
  const [addMode, setAddMode] = useState<'bg' | 'card'>('bg')
  const fileRef = useRef<HTMLInputElement>(null)
  // caption
  const [platform, setPlatform] = useState('instagram')
  const [copied, setCopied] = useState(false)
  // copilot
  const [botOpen, setBotOpen] = useState(false)
  const [botPrompt, setBotPrompt] = useState('')
  const [botBusy, setBotBusy] = useState(false)
  const [botMsgs, setBotMsgs] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: 'Describe a post — “a 5-slide carousel about animal superpowers, playful”. I’ll design the slides + write the caption; you polish anything below.' },
  ])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgs = useRef(new Map<string, HTMLImageElement>())

  const fmt = postFormat(doc.format)
  const pal = postPalette(doc.palette)
  const slide = doc.slides[Math.min(sel, doc.slides.length - 1)]
  const layer = useMemo(() => slide?.layers.find(l => l.id === selLayer) || null, [slide, selLayer])

  // ── image cache (crossOrigin so export stays untainted) ──
  const env: RenderEnv = useMemo(() => ({
    getImg: (url: string) => {
      if (!url) return null
      const hit = imgs.current.get(url)
      if (hit) return hit
      const im = new Image()
      im.crossOrigin = 'anonymous'
      im.onload = () => setTick(t => t + 1)
      im.onerror = () => { im.dataset.failed = '1'; setTick(t => t + 1) }
      im.src = url
      imgs.current.set(url, im)
      return im
    },
  }), [])

  // ── autosave ──
  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(doc)) } catch { /* quota */ }
  }, [doc])

  // keep selection in range when slides change
  useEffect(() => { if (sel >= doc.slides.length) setSel(doc.slides.length - 1) }, [doc.slides.length, sel])

  // ── main canvas paint ──
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !slide) return
    if (cv.width !== fmt.w || cv.height !== fmt.h) { cv.width = fmt.w; cv.height = fmt.h }
    const ctx = cv.getContext('2d')!
    drawSlide(ctx, doc, Math.min(sel, doc.slides.length - 1), fmt.w, fmt.h, env)
    if (guides) drawGuides(ctx, doc.format, fmt.w, fmt.h)
  }, [doc, sel, guides, tick, fmt.w, fmt.h, env, slide])

  // ── media library ──
  function refreshAssets() { if (cloudEnabled) listAssets(supabase, { kind: 'image' }).then(setAssets) }
  useEffect(() => { refreshAssets() }, []) // eslint-disable-line

  // ── doc edits ──
  const update = (mut: (d: PostDoc) => void) => setDoc(prev => { const d: PostDoc = JSON.parse(JSON.stringify(prev)); mut(d); return d })
  const patchSlide = (mut: (s: PostSlide) => void) => update(d => { const s = d.slides[sel]; if (s) mut(s) })
  const patchLayer = (id: string, patch: Record<string, unknown>) => patchSlide(s => { const l = s.layers.find(x => x.id === id); if (l) Object.assign(l, patch) })

  function applyTemplate(tid: string) {
    update(d => { const keep = slideContent(d.slides[sel]); d.slides[sel] = makeSlide(tid, keep) })
    setSelLayer(null)
    setStatus(`Re-laid out as “${TEMPLATES.find(t => t.id === tid)?.label}” — same words, new bones.`)
  }
  function addSlide() {
    update(d => { d.slides.splice(sel + 1, 0, makeSlide('fact', {})) })
    setSel(sel + 1); setSelLayer(null)
  }
  function dupSlide() {
    update(d => { d.slides.splice(sel + 1, 0, cloneSlide(d.slides[sel])) })
    setSel(sel + 1)
  }
  function delSlide() {
    if (doc.slides.length <= 1) { setStatus('A post needs at least one slide.'); return }
    update(d => { d.slides.splice(sel, 1) })
    setSel(Math.max(0, sel - 1)); setSelLayer(null)
  }
  function moveSlide(dir: -1 | 1) {
    const j = sel + dir
    if (j < 0 || j >= doc.slides.length) return
    update(d => { const [s] = d.slides.splice(sel, 1); d.slides.splice(j, 0, s) })
    setSel(j)
  }
  function moveLayer(id: string, dir: -1 | 1) {
    patchSlide(s => { const i = s.layers.findIndex(l => l.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= s.layers.length) return; [s.layers[i], s.layers[j]] = [s.layers[j], s.layers[i]] })
  }
  function removeLayer(id: string) { patchSlide(s => { s.layers = s.layers.filter(l => l.id !== id) }); if (selLayer === id) setSelLayer(null) }

  function addText(kind: 'headline' | 'body' | 'badge') {
    patchSlide(s => {
      if (kind === 'badge') s.layers.push({ id: pid('bd'), type: 'badge', name: 'Badge', text: 'NEW', xN: 0.5, yN: 0.14, size: 30, bg: 'accent', color: 'pillInk' })
      else s.layers.push({
        id: pid('tx'), type: 'text', name: kind === 'headline' ? 'Headline' : 'Body',
        text: kind === 'headline' ? 'New headline' : 'Supporting line — keep it human.',
        xN: 0.5, yN: kind === 'headline' ? 0.4 : 0.62,
        size: kind === 'headline' ? 84 : 42, weight: kind === 'headline' ? 800 : 500,
        color: kind === 'headline' ? 'ink' : 'soft', align: 'center', font: 'sans',
        maxWidthN: 0.8, lineHeight: kind === 'headline' ? 1.18 : 1.42, highlight: 'none',
      })
    })
  }
  function addSticker(char: string) {
    patchSlide(s => { s.layers.push({ id: pid('em'), type: 'emoji', name: 'Sticker', char, xN: 0.5, yN: 0.3, size: 140 }) })
    setStatus(`Sticker ${char} added — select it in Layers to move/resize.`)
  }
  function addImageFromUrl(url: string, name: string) {
    patchSlide(s => {
      // one bg image max — replace it; cards stack freely
      if (addMode === 'bg') {
        const old = s.layers.find(l => l.type === 'image' && l.mode === 'bg')
        if (old && old.type === 'image') { old.url = url; return }
        s.layers.unshift({ id: pid('im'), type: 'image', name: name || 'Photo', url, mode: 'bg', xN: 0.5, yN: 0.5, wN: 1, hN: 1, radius: 0, dim: 0.5, opacity: 1 })
      } else {
        s.layers.push({ id: pid('im'), type: 'image', name: name || 'Photo', url, mode: 'card', xN: 0.5, yN: 0.42, wN: 0.72, hN: 0.42, radius: 36, dim: 0, opacity: 1 })
      }
    })
    setStatus(`Image placed as ${addMode === 'bg' ? 'background' : 'card'}.`)
  }

  async function onPickFile(file: File) {
    if (!file || !file.type.startsWith('image/')) { setStatus('Pick an image file.'); return }
    setMediaBusy(true)
    try {
      const localUrl = URL.createObjectURL(file)
      addImageFromUrl(localUrl, file.name)
      if (cloudEnabled) {
        const a = await uploadAsset(supabase, file, { kind: 'image' })
        refreshAssets()
        setStatus(`Image placed + stored in Supabase (${a.name}).`)
      } else setStatus('Image placed (local — connect Supabase to keep it in the library).')
    } catch (e: any) { setStatus('Upload failed: ' + (e?.message || e)) } finally { setMediaBusy(false) }
  }

  async function doImportStock(provider: 'pexels' | 'pixabay') {
    if (!cloudEnabled) { setStatus('Connect Supabase to import stock.'); return }
    setMediaBusy(true); setStatus(`Importing photos for “${impQuery}” from ${provider}…`)
    try {
      const r = await importStock(supabase, { provider, query: impQuery, count: 8, kind: 'image' })
      setStatus(`Imported ${r.imported} photo(s) from ${provider}.`); refreshAssets()
    } catch (e: any) { setStatus('Import failed: ' + (e?.message || e)) } finally { setMediaBusy(false) }
  }

  // ── copilot ──
  async function runCopilot(prompt: string) {
    if (!prompt.trim() || botBusy) return
    setBotBusy(true); setBotPrompt('')
    setBotMsgs(m => [...m, { role: 'user', text: prompt }])
    try {
      const r = await ai.chatJSON({ task: 'copy', schema: POST_SCHEMA, messages: postMessages(prompt) })
      const useLocal = r.provider === 'mock' || !r.json || !Array.isArray(r.json.slides) || r.json.slides.length === 0
      const next = useLocal ? localPost(prompt, doc) : coercePost(r.json, prompt, doc)
      setDoc(next); setSel(0); setSelLayer(null)
      const via = useLocal ? (aiLive ? 'local draft — model returned nothing usable' : 'local draft — connect a model for sharper copy') : 'AI · ' + r.provider
      setBotMsgs(m => [...m, { role: 'agent', text: `Designed **${next.slides.length} slides** + caption. Swap the palette, tweak any line, export when happy. _(${via})_` }])
    } catch (e: any) {
      setBotMsgs(m => [...m, { role: 'agent', text: 'Failed: ' + (e?.message || e) }])
    } finally { setBotBusy(false) }
  }

  // ── export + publish ──
  async function doExport() {
    setBusy('export')
    try {
      const base = slug(slideContent(doc.slides[0]).headline || 'post')
      for (let i = 0; i < doc.slides.length; i++) {
        const blob = await renderSlideBlob(doc, i, env)
        downloadBlob(blob, doc.slides.length > 1 ? `${base}-slide-${i + 1}.png` : `${base}.png`)
        if (doc.slides.length > 1) await new Promise(r => setTimeout(r, 350)) // let the browser breathe between downloads
      }
      setStatus(`Exported ${doc.slides.length} PNG${doc.slides.length > 1 ? 's' : ''} · ${fmt.w}×${fmt.h} — ready to upload anywhere.`)
    } catch (e: any) {
      setStatus(String(e?.name) === 'SecurityError'
        ? 'Export blocked: an image host refused cross-origin use. Re-add it via Upload (it stores a same-origin copy).'
        : 'Export failed: ' + (e?.message || e))
    } finally { setBusy('') }
  }

  async function publishToFeed() {
    if (!cloudEnabled) { setStatus('Connect Supabase & sign in as operator to send posts to the feed.'); return }
    setBusy('publish')
    try {
      const blob = await renderSlideBlob(doc, 0, env)
      const file = new File([blob], slug(slideContent(doc.slides[0]).headline || 'post') + '.png', { type: 'image/png' })
      const asset = await uploadAsset(supabase, file, { kind: 'image', width: fmt.w, height: fmt.h })
      const c = slideContent(doc.slides[0])
      const id = await live.saveBroadcast({
        format: 'fact', theme: 'funfacts',
        title: (c.headline || doc.caption.split('\n')[0] || 'New post').replace(/\n/g, ' ').slice(0, 120),
        body: (doc.caption + (doc.hashtags ? '\n\n' + doc.hashtags : '')) || null,
        media_kind: 'image', media_url: asset.url,
        source: null, emoji: c.emoji || '✨', accent: pal.accent,
        audience: 'circle', status: 'draft', publish_at: null,
      })
      setStatus(id
        ? 'Sent to the Discover feed as a draft — review & publish it in Legacy → Catalogue.'
        : 'Could not save — are you signed in as an operator?')
    } catch (e: any) { setStatus('Publish failed: ' + (e?.message || e)) } finally { setBusy('') }
  }

  async function copyCaption() {
    const text = doc.caption + (doc.hashtags ? '\n\n' + doc.hashtags : '')
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }

  function startOver() {
    if (!confirm('Start a fresh post? The current one is replaced (it stays in your browser until then).')) return
    setDoc(starterDoc()); setSel(0); setSelLayer(null); setStatus('Fresh canvas.')
  }

  const rule = captionRule(platform)
  const capLen = doc.caption.length + (doc.hashtags ? doc.hashtags.length + 2 : 0)
  const tagCount = (doc.hashtags.match(/#[^\s#]+/g) || []).length
  const over = capLen > rule.limit

  return (
    <div className="pbx">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.currentTarget.value = '' }} />

      {/* ── top bar ── */}
      <div className="pbx-top">
        <div className="pbx-mark"><Megaphone size={15} /></div>
        <div className="pbx-title"><b>Content Builder</b><span>Post Studio · every social format · zero-asset</span></div>
        <div className="seg" role="group" aria-label="Format">
          {POST_FORMATS.map(f => (
            <button key={f.id} className={doc.format === f.id ? 'on' : ''} title={`${f.label} · ${f.w}×${f.h} · ${f.platforms}`}
              onClick={() => update(d => { d.format = f.id })}>{f.aspect}</button>
          ))}
        </div>
        <div className="pbx-spacer" />
        {status && <span className="pbx-status" title={status}>{status}</span>}
        {doc.format === 'story' && (
          <button className={'pbx-ghost' + (guides ? ' on' : '')} title="Show platform-UI safe zones" onClick={() => setGuides(g => !g)}>
            <ScanLine size={14} /> Safe zones
          </button>
        )}
        <button className="pbx-ghost" title="The previous Content Builder tools (Catalogue · Autopilot · Prompts · Import · Library · Research)" onClick={onLegacy}>
          <History size={14} /> Legacy
        </button>
        <button className={'pbx-ghost' + (botOpen ? ' on' : '')} onClick={() => setBotOpen(o => !o)}>
          <Wand2 size={14} /> Copilot
        </button>
        <button className="pbx-export" disabled={busy !== ''} onClick={doExport}>
          <Download size={14} /> {busy === 'export' ? 'Rendering…' : doc.slides.length > 1 ? `Export ${doc.slides.length} slides` : 'Export PNG'}
        </button>
      </div>

      {/* ── stage + inspector ── */}
      <div className="pbx-main">
        <div className="pbx-stage">
          <span className="pbx-stagebadge">{fmt.label} · {fmt.w}×{fmt.h} · {fmt.aspect}</span>
          <span className="pbx-stageplat">{fmt.platforms}</span>
          <div className="pbx-stagebox"><canvas ref={canvasRef} className="pbx-canvas" /></div>

          {botOpen && (
            <div className="pbx-bot">
              <div className="pbx-bot-head">
                <Wand2 size={14} /> <b>Copilot</b>
                <span className="pbx-bot-tag">{aiLive ? 'AI connected' : 'local mode'}</span>
                <button className="pbx-ic" onClick={() => setBotOpen(false)} aria-label="Close"><X size={14} /></button>
              </div>
              <div className="pbx-bot-msgs">
                {botMsgs.map((m, i) => (
                  <div key={i} className={'pbx-bot-msg ' + m.role}>
                    <div className="bubble" dangerouslySetInnerHTML={{ __html: m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_\((.+?)\)_/g, '<span class="via">($1)</span>') }} />
                  </div>
                ))}
                {botBusy && <div className="pbx-bot-msg agent"><div className="bubble"><span className="pbx-dots"><i /><i /><i /></span></div></div>}
              </div>
              <div className="pbx-bot-quick">
                {['5-slide carousel: animal superpowers, playful', 'a this-or-that post about pancakes vs waffles', 'quote post about time with kids, calm'].map(q => (
                  <button key={q} className="pbx-chip" disabled={botBusy} onClick={() => runCopilot(q)}>{q.slice(0, 26)}…</button>
                ))}
              </div>
              <div className="pbx-bot-input">
                <input value={botPrompt} disabled={botBusy} placeholder="Describe your post…"
                  onChange={e => setBotPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && botPrompt.trim()) runCopilot(botPrompt.trim()) }} />
                <button className="pbx-bot-send" disabled={botBusy || !botPrompt.trim()} onClick={() => runCopilot(botPrompt.trim())} aria-label="Send"><Send size={14} /></button>
              </div>
            </div>
          )}
        </div>

        {/* ── inspector ── */}
        <div className="pbx-insp">
          {/* templates */}
          <div className="pbx-panel">
            <div className="pbx-ph"><LayoutTemplate size={13} /> Layout · this slide<span className="badge">keeps your words</span></div>
            <div className="pbx-chipwrap">
              {TEMPLATES.map(t => (
                <button key={t.id} className={'pbx-chip' + (slide?.template === t.id ? ' on' : '')} title={t.blurb} onClick={() => applyTemplate(t.id)}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* brand kit / look */}
          <div className="pbx-panel">
            <div className="pbx-ph"><Palette size={13} /> Look · whole post<span className="badge">brand kit</span></div>
            <div className="pbx-swatches">
              {POST_PALETTES.map(p => (
                <button key={p.id} className={'pbx-sw' + (doc.palette === p.id ? ' on' : '')} title={p.label}
                  style={{ background: `linear-gradient(135deg,${p.colors[0]} 55%,${p.accent} 55%)` }}
                  onClick={() => update(d => { d.palette = p.id })} />
              ))}
            </div>
            <div className="pbx-chipwrap">
              {BG_VARIANTS.map(v => (
                <span key={v} className={'pbx-chip' + (slide?.bg.variant === v ? ' on' : '')} onClick={() => patchSlide(s => { s.bg.variant = v })}>{v}</span>
              ))}
            </div>
            <div className="pbx-row">
              <span className={'pbx-chip' + (slide?.bg.grain ? ' on' : '')} onClick={() => patchSlide(s => { s.bg.grain = !s.bg.grain })}>grain</span>
              <span className={'pbx-chip' + (slide?.bg.vignette ? ' on' : '')} onClick={() => patchSlide(s => { s.bg.vignette = !s.bg.vignette })}>vignette</span>
              <button className="pbx-chip" title="Reshuffle the background composition" onClick={() => patchSlide(s => { s.bg.seed = Math.floor(Math.random() * 1e9) })}><Shuffle size={11} /> shuffle</button>
            </div>
          </div>

          {/* text */}
          <div className="pbx-panel">
            <div className="pbx-ph"><TypeIcon size={13} /> Text</div>
            <div className="pbx-chipwrap">
              <button className="pbx-chip" onClick={() => addText('headline')}><Plus size={11} /> headline</button>
              <button className="pbx-chip" onClick={() => addText('body')}><Plus size={11} /> body</button>
              <button className="pbx-chip" onClick={() => addText('badge')}><Plus size={11} /> badge</button>
            </div>
          </div>

          {/* stickers */}
          <div className="pbx-panel">
            <div className="pbx-ph"><Sticker size={13} /> Stickers</div>
            <div className="pbx-stickers">
              {STICKERS.map(s => <button key={s} className="pbx-sticker" onClick={() => addSticker(s)}>{s}</button>)}
            </div>
          </div>

          {/* media */}
          <div className="pbx-panel">
            <div className="pbx-ph"><Cloud size={13} /> Media · Supabase<span className="badge">{cloudEnabled ? 'video-assets' : 'offline'}</span></div>
            <div className="pbx-row">
              <button className="pbx-btn accent" onClick={() => fileRef.current?.click()} disabled={mediaBusy}><Upload size={12} /> Upload</button>
              <input className="pbx-sel" value={impQuery} onChange={e => setImpQuery(e.target.value)} placeholder="stock search…" />
            </div>
            <div className="pbx-chipwrap">
              <button className="pbx-chip" disabled={mediaBusy} onClick={() => doImportStock('pexels')}><Sparkles size={11} /> Pexels</button>
              <button className="pbx-chip" disabled={mediaBusy} onClick={() => doImportStock('pixabay')}>Pixabay</button>
              <span className="pbx-mini" style={{ marginLeft: 'auto' }}>add as</span>
              {(['bg', 'card'] as const).map(m => (
                <span key={m} className={'pbx-chip' + (addMode === m ? ' on' : '')} onClick={() => setAddMode(m)}>{m === 'bg' ? 'background' : 'card'}</span>
              ))}
            </div>
            {assets.length > 0 ? (
              <div className="pbx-mediagrid">
                {assets.map(a => (
                  <button key={a.id} className="pbx-mediaitem" title={a.name} onClick={() => addImageFromUrl(a.url, a.name)}>
                    {a.thumb ? <img src={a.thumb} alt={a.name} /> : <span className="mi-ph">img</span>}
                  </button>
                ))}
              </div>
            ) : <span className="pbx-mini">{cloudEnabled ? 'No images yet — Upload or import stock.' : 'Offline — Upload still works (kept in this browser).'}</span>}
          </div>

          {/* caption intelligence */}
          <div className="pbx-panel">
            <div className="pbx-ph"><MessageSquareText size={13} /> Caption<span className="badge">{rule.sweet}</span></div>
            <div className="pbx-chipwrap">
              {CAPTION_RULES.map(r => (
                <span key={r.id} className={'pbx-chip' + (platform === r.id ? ' on' : '')} onClick={() => setPlatform(r.id)}>{r.label}</span>
              ))}
            </div>
            <textarea className="pbx-ta" rows={4} value={doc.caption} placeholder="Write the caption — hook first."
              onChange={e => update(d => { d.caption = e.target.value })} />
            <input className="pbx-sel" value={doc.hashtags} placeholder="#hashtags #here"
              onChange={e => update(d => { d.hashtags = e.target.value })} />
            <div className="pbx-capmeta">
              <span className={over ? 'bad' : ''}>{capLen.toLocaleString()} / {rule.limit.toLocaleString()}</span>
              <span className={doc.caption.length > rule.hook ? 'warn' : 'ok'}>hook: {Math.min(doc.caption.length, rule.hook)}/{rule.hook} before the fold</span>
              <span>{tagCount} tags · {rule.tags}</span>
            </div>
            <div className="pbx-row">
              <button className="pbx-btn" onClick={copyCaption}>{copied ? <><Check size={12} /> Copied</> : <><CopyIcon size={12} /> Copy caption</>}</button>
              <button className="pbx-btn accent" disabled={busy !== '' || !cloudEnabled} title={cloudEnabled ? 'Slide 1 + caption → a Discover-feed draft' : 'Connect Supabase to enable'} onClick={publishToFeed}>
                <Rocket size={12} /> {busy === 'publish' ? 'Sending…' : 'Send to feed'}
              </button>
            </div>
          </div>

          {/* layers + selected properties */}
          <div className="pbx-panel">
            <div className="pbx-ph"><Layers size={13} /> Layers</div>
            <div className="pbx-layers">
              {slide && [...slide.layers].reverse().map(l => (
                <div key={l.id} className={'pbx-lrow' + (selLayer === l.id ? ' on' : '')} onClick={() => setSelLayer(l.id)}>
                  <span className="nm">{l.name}{l.type === 'text' ? ` · “${(l as TextLayer).text.replace(/\n/g, ' ').slice(0, 14)}”` : l.type === 'emoji' ? ` · ${(l as { char: string }).char}` : ''}</span>
                  <button className="pbx-ic" onClick={e => { e.stopPropagation(); moveLayer(l.id, 1) }} title="Up"><ChevronUp size={13} /></button>
                  <button className="pbx-ic" onClick={e => { e.stopPropagation(); moveLayer(l.id, -1) }} title="Down"><ChevronDown size={13} /></button>
                  <button className="pbx-ic" onClick={e => { e.stopPropagation(); patchLayer(l.id, { hidden: !l.hidden }) }} title="Toggle">{l.hidden ? <EyeOff size={13} /> : <Eye size={13} />}</button>
                  <button className="pbx-ic" onClick={e => { e.stopPropagation(); removeLayer(l.id) }} title="Delete"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>

          {layer && <LayerProps layer={layer} patch={p => patchLayer(layer.id, p)} />}

          {/* brand */}
          <div className="pbx-panel">
            <div className="pbx-ph">Brand</div>
            <div className="pbx-row">
              <input className="pbx-sel" value={doc.brand.name} onChange={e => update(d => { d.brand.name = e.target.value })} placeholder="Brand name" />
              <input className="pbx-sel" value={doc.brand.handle} onChange={e => update(d => { d.brand.handle = e.target.value })} placeholder="@handle" />
            </div>
            <span className="pbx-mini">The mark + wordmark on slides use this. CTA handles too.</span>
          </div>
        </div>
      </div>

      {/* ── slides strip (the carousel) ── */}
      <div className="pbx-strip">
        <div className="pbx-striphead">
          <span className="pbx-stripcount">Slide {sel + 1} / {doc.slides.length}</span>
          <button className="pbx-ic" title="Move slide left" onClick={() => moveSlide(-1)}><ChevronLeft size={14} /></button>
          <button className="pbx-ic" title="Move slide right" onClick={() => moveSlide(1)}><ChevronRight size={14} /></button>
          <button className="pbx-ic" title="Duplicate slide" onClick={dupSlide}><CopyIcon size={13} /></button>
          <button className="pbx-ic" title="Delete slide" onClick={delSlide}><Trash2 size={13} /></button>
          <span className="pbx-striphint">carousel: hook → value → CTA · click a slide to edit</span>
          <button className="pbx-chip" style={{ marginLeft: 'auto' }} onClick={startOver}>Start over</button>
        </div>
        <div className="pbx-thumbs">
          {doc.slides.map((s, i) => (
            <SlideThumb key={s.id} doc={doc} index={i} active={i === sel} env={env} tick={tick}
              onClick={() => { setSel(i); setSelLayer(null) }} />
          ))}
          <button className="pbx-addslide" onClick={addSlide} title="Add a slide after this one"><Plus size={16} /><span>slide</span></button>
        </div>
      </div>
    </div>
  )
}

// ── selected-layer property editor ────────────────────────────
function LayerProps({ layer, patch }: { layer: PostLayer; patch: (p: Record<string, unknown>) => void }) {
  const l = layer as any
  return (
    <div className="pbx-panel">
      <div className="pbx-ph">{layer.name} · properties</div>

      {layer.type === 'text' && (<>
        <textarea className="pbx-ta" value={l.text} rows={2} onChange={e => patch({ text: e.target.value })} />
        <Slider label={`Size · ${l.size}px`} min={20} max={220} value={l.size} onChange={v => patch({ size: v })} />
        <div className="pbx-field"><label>Color</label><div className="pbx-chipwrap">
          {(['ink', 'soft', 'accent'] as const).map(c => <span key={c} className={'pbx-chip' + (l.color === c ? ' on' : '')} onClick={() => patch({ color: c })}>{c}</span>)}
        </div></div>
        <div className="pbx-field"><label>Style</label><div className="pbx-chipwrap">
          {(['none', 'pill', 'underline'] as const).map(h => <span key={h} className={'pbx-chip' + (l.highlight === h ? ' on' : '')} onClick={() => patch({ highlight: h })}>{h}</span>)}
          <span className={'pbx-chip' + (l.upper ? ' on' : '')} onClick={() => patch({ upper: !l.upper })}>CAPS</span>
        </div></div>
        <div className="pbx-field"><label>Font · weight</label><div className="pbx-chipwrap">
          {(['sans', 'serif', 'mono'] as const).map(f => <span key={f} className={'pbx-chip' + (l.font === f ? ' on' : '')} onClick={() => patch({ font: f })}>{f}</span>)}
          {[500, 700, 800].map(w => <span key={w} className={'pbx-chip' + (l.weight === w ? ' on' : '')} onClick={() => patch({ weight: w })}>{w}</span>)}
        </div></div>
        <div className="pbx-field"><label>Align</label><div className="pbx-chipwrap">
          {(['left', 'center', 'right'] as const).map(a => <span key={a} className={'pbx-chip' + (l.align === a ? ' on' : '')} onClick={() => patch({ align: a, xN: a === 'left' ? 0.12 : a === 'right' ? 0.88 : 0.5 })}>{a}</span>)}
        </div></div>
        <Slider label={`Width · ${Math.round(l.maxWidthN * 100)}%`} min={0.3} max={0.95} step={0.01} value={l.maxWidthN} onChange={v => patch({ maxWidthN: v })} />
      </>)}

      {layer.type === 'emoji' && (<>
        <div className="pbx-row">
          <input className="pbx-sel" value={l.char} maxLength={4} onChange={e => patch({ char: e.target.value })} />
        </div>
        <Slider label={`Size · ${l.size}px`} min={40} max={400} value={l.size} onChange={v => patch({ size: v })} />
      </>)}

      {layer.type === 'badge' && (<>
        <input className="pbx-sel" value={l.text} onChange={e => patch({ text: e.target.value })} />
        <Slider label={`Size · ${l.size}px`} min={18} max={64} value={l.size} onChange={v => patch({ size: v })} />
      </>)}

      {layer.type === 'image' && (<>
        <div className="pbx-field"><label>Mode</label><div className="pbx-chipwrap">
          {(['bg', 'card'] as const).map(m => <span key={m} className={'pbx-chip' + (l.mode === m ? ' on' : '')} onClick={() => patch({ mode: m })}>{m === 'bg' ? 'background' : 'card'}</span>)}
        </div></div>
        {l.mode === 'bg'
          ? <Slider label={`Darken · ${Math.round(l.dim * 100)}%`} min={0} max={0.8} step={0.05} value={l.dim} onChange={v => patch({ dim: v })} />
          : (<>
            <Slider label={`Width · ${Math.round(l.wN * 100)}%`} min={0.2} max={1} step={0.01} value={l.wN} onChange={v => patch({ wN: v })} />
            <Slider label={`Height · ${Math.round(l.hN * 100)}%`} min={0.15} max={1} step={0.01} value={l.hN} onChange={v => patch({ hN: v })} />
            <Slider label={`Corners · ${l.radius}px`} min={0} max={120} value={l.radius} onChange={v => patch({ radius: v })} />
          </>)}
        <Slider label={`Opacity · ${Math.round(l.opacity * 100)}%`} min={0.2} max={1} step={0.05} value={l.opacity} onChange={v => patch({ opacity: v })} />
      </>)}

      {layer.type === 'brand' && (<>
        <div className="pbx-chipwrap">
          <span className={'pbx-chip' + (l.wordmark ? ' on' : '')} onClick={() => patch({ wordmark: !l.wordmark })}>wordmark</span>
        </div>
        <Slider label={`Size · ${l.size}px`} min={32} max={200} value={l.size} onChange={v => patch({ size: v })} />
      </>)}

      {layer.type === 'pager' && (
        <div className="pbx-field"><label>Style</label><div className="pbx-chipwrap">
          {(['dots', 'count', 'arrow'] as const).map(st => <span key={st} className={'pbx-chip' + (l.style === st ? ' on' : '')} onClick={() => patch({ style: st })}>{st}</span>)}
        </div></div>
      )}

      {layer.type === 'divider' && (<>
        <Slider label={`Width · ${Math.round(l.wN * 100)}%`} min={0.05} max={0.9} step={0.01} value={l.wN} onChange={v => patch({ wN: v })} />
        <Slider label={`Thickness · ${l.thick}px`} min={2} max={30} value={l.thick} onChange={v => patch({ thick: v })} />
      </>)}

      {layer.type !== 'divider' && (
        <Slider label={`Horizontal · ${Math.round(l.xN * 100)}%`} min={0.05} max={0.95} step={0.01} value={l.xN} onChange={v => patch({ xN: v })} />
      )}
      <Slider label={`Vertical · ${Math.round(l.yN * 100)}%`} min={0.03} max={0.97} step={0.01} value={l.yN} onChange={v => patch({ yN: v })} />
    </div>
  )
}

function Slider({ label, min, max, step = 1, value, onChange }: { label: string; min: number; max: number; step?: number; value: number; onChange: (v: number) => void }) {
  return (
    <div className="pbx-field">
      <label>{label}</label>
      <input type="range" className="pbx-range" min={min} max={max} step={step} value={value} onChange={e => onChange(+e.target.value)} />
    </div>
  )
}

// ── live slide thumbnail ──────────────────────────────────────
function SlideThumb({ doc, index, active, env, tick, onClick }: {
  doc: PostDoc; index: number; active: boolean; env: RenderEnv; tick: number; onClick: () => void
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const fmt = postFormat(doc.format)
  const h = 86
  const w = Math.round((fmt.w / fmt.h) * h)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = 2 // crisp minis
    cv.width = w * dpr; cv.height = h * dpr
    const ctx = cv.getContext('2d')!
    ctx.save()
    ctx.scale((w * dpr) / fmt.w, (h * dpr) / fmt.h)
    drawSlide(ctx, doc, index, fmt.w, fmt.h, env)
    ctx.restore()
  }, [doc, index, w, h, fmt.w, fmt.h, env, tick])
  return (
    <button className={'pbx-thumb' + (active ? ' on' : '')} style={{ width: w, height: h }} onClick={onClick} title={`Slide ${index + 1}`}>
      <canvas ref={ref} style={{ width: w, height: h }} />
      <span className="n">{index + 1}</span>
    </button>
  )
}

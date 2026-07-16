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
  Megaphone, Download, X, Send, Plus, Trash2, Copy as CopyIcon,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Eye, EyeOff, Layers,
  Type as TypeIcon, Palette, Cloud, Upload, Sparkles, Sticker, MessageSquareText,
  LayoutTemplate, Check, Shuffle, ScanLine, Rocket, Users, Heart, Inbox, Send as SendIcon, Instagram,
} from 'lucide-react'
import { listAssets, uploadAsset, importStock, downloadBlob } from '@arganta/video'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { ai, aiLive } from '../../lib/ai'
import { generateCopy, generateImage, coreEnabled, extForImageMime, getCoreQuota, prettyModel, type CoreQuota } from '../../lib/argantaCoreClient'
import { listPublishableCircles, publishMoment, type PublishCircle } from '../../lib/momentPublish'
import { listContentDrafts, markDraftConsumed, recordDraftPublish, type ContentDraft } from '../../lib/contentDrafts'
import { listBufferChannels, publishToBuffer, bufferEnabled, type BufferChannel, type BufferMode } from '../../lib/bufferClient'
import { live } from '../../data/live'
import {
  POST_FORMATS, postFormat, POST_PALETTES, postPalette, BG_VARIANTS,
  CAPTION_RULES, captionRule, STICKERS, drawSlide, drawGuides, renderSlideBlob,
  hitTestLayer, drawLayerSelection, layerBounds,
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

/** Trim a generated slide list to an explicit requested count, keeping the hook
 * (first) and CTA (last) and dropping from the middle. No-op if already ≤ want. */
function clampSlidesToCount<T>(slides: T[], want?: number): T[] {
  if (!want || want < 1 || slides.length <= want) return slides
  if (want === 1) return [slides[0]]
  return [slides[0], ...slides.slice(1, -1).slice(0, want - 2), slides[slides.length - 1]]
}

export function PostStudio() {
  const [doc, setDoc] = useState<PostDoc>(loadDoc)
  const [sel, setSel] = useState(0)
  const [selLayer, setSelLayer] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState<'' | 'export' | 'publish' | 'moment' | 'buffer' | 'approve'>('')
  // Kinetik moment publishing
  const [momentOpen, setMomentOpen] = useState(false)
  const [circles, setCircles] = useState<PublishCircle[]>([])
  const [circleId, setCircleId] = useState('')
  const [circlesLoaded, setCirclesLoaded] = useState(false)
  // success confirmation modal after a moment is published
  const [published, setPublished] = useState<{ circle: string; slides: number } | null>(null)
  // Buffer → Instagram publishing
  const [bufferOpen, setBufferOpen] = useState(false)
  const [bufChannels, setBufChannels] = useState<BufferChannel[]>([])
  const [bufChannelId, setBufChannelId] = useState('')
  const [bufChannelsLoaded, setBufChannelsLoaded] = useState(false)
  const [bufMode, setBufMode] = useState<BufferMode>('addToQueue')
  const [bufferDone, setBufferDone] = useState<{ channel: string; mode: BufferMode; images: number } | null>(null)
  const [bufferError, setBufferError] = useState<string | null>(null)
  // S7: Drafts inbox — briefs authored in Claude Code via tools/arganta-core-mcp
  const [draftsOpen, setDraftsOpen] = useState(false)
  const [drafts, setDrafts] = useState<ContentDraft[]>([])
  const [draftsBusy, setDraftsBusy] = useState(false)
  // Path C — the currently-open draft's publish intents + fan-out result
  const [activeDraft, setActiveDraft] = useState<ContentDraft | null>(null)
  const [fanoutResult, setFanoutResult] = useState<{ dest: string; label: string; ok: boolean; message: string }[] | null>(null)
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
    { role: 'agent', text: 'I’m **Arganta Core**. Describe a post — “a 5-slide carousel about animal superpowers, playful”. I’ll design the slides, generate the images, and write the caption; you polish anything below.' },
  ])
  const [genImages, setGenImages] = useState(coreEnabled)
  const [coreQuota, setCoreQuota] = useState<CoreQuota | null>(null)
  useEffect(() => { if (coreEnabled) getCoreQuota().then(setCoreQuota) }, [])

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgs = useRef(new Map<string, HTMLImageElement>())
  const dragRef = useRef<{ id: string; startXN: number; startYN: number; px0: number; py0: number; moved: boolean } | null>(null)
  const [editing, setEditing] = useState<{ id: string; x: number; y: number; w: number } | null>(null)

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
    if (selLayer && slide) drawLayerSelection(ctx, slide, selLayer, fmt.w, fmt.h)
  }, [doc, sel, guides, tick, fmt.w, fmt.h, env, slide, selLayer])

  // ── media library ──
  function refreshAssets() { if (cloudEnabled) listAssets(supabase, { kind: 'image' }).then(setAssets) }
  useEffect(() => { refreshAssets() }, []) // eslint-disable-line

  // ── S7: Drafts inbox — poll (no realtime channel exists elsewhere in HQ yet) ──
  function refreshDrafts() { if (cloudEnabled) { setDraftsBusy(true); listContentDrafts(supabase).then(setDrafts).finally(() => setDraftsBusy(false)) } }
  useEffect(() => {
    if (!cloudEnabled) return
    refreshDrafts()
    const id = setInterval(refreshDrafts, 12000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line

  /** Load a draft's copy onto the canvas via the SAME coercePost the Arganta
   * Core chat uses (worker output is already template/field-clamped, so this
   * is a straight drop-in), then patch in any per-slide generated image URLs
   * — the worker's coerceCopy preserves slide order 1:1, same list, so a
   * positional zip is safe. */
  function openDraft(d: ContentDraft) {
    const next = coercePost(d.copy as any, d.brief, doc)
    d.copy.slides.forEach((s, i) => {
      if (!s.imageUrl || !next.slides[i]) return
      const slide = next.slides[i]
      const old = slide.layers.find(l => l.type === 'image' && (l as any).mode === 'bg')
      if (old && old.type === 'image') old.url = s.imageUrl
      else slide.layers.unshift({ id: pid('im'), type: 'image', name: 'Arganta Core', url: s.imageUrl, mode: 'bg', xN: 0.5, yN: 0.5, wN: 1, hN: 1, radius: 0, dim: 0.5, opacity: 1 } as any)
    })
    setDoc(next); setSel(0); setSelLayer(null); setDraftsOpen(false)
    setStatus(`Opened draft “${d.brief.slice(0, 40)}${d.brief.length > 40 ? '…' : ''}” — ${next.slides.length} slides on canvas.`)
    markDraftConsumed(supabase, d.id)
    setDrafts(prev => prev.map(x => x.id === d.id ? { ...x, consumedAt: new Date().toISOString() } : x))
    // Path C: track this draft so "Approve & publish everywhere" can fan out to
    // its recorded intents once you're happy with the composed canvas. Preload
    // whichever picker lists the intents reference, so names resolve for badges
    // without you having to open those pickers manually first.
    setActiveDraft(d)
    if (d.publishTo.some(p => p.dest === 'moment') && !circlesLoaded) {
      listPublishableCircles(supabase).then(list => { setCircles(list); setCirclesLoaded(true) })
    }
    if (d.publishTo.some(p => p.dest === 'buffer') && !bufChannelsLoaded) {
      listBufferChannels().then(list => { setBufChannels(list); setBufChannelsLoaded(true) })
    }
  }

  // ── doc edits ──
  const update = (mut: (d: PostDoc) => void) => setDoc(prev => { const d: PostDoc = JSON.parse(JSON.stringify(prev)); mut(d); return d })
  const patchSlide = (mut: (s: PostSlide) => void) => update(d => { const s = d.slides[sel]; if (s) mut(s) })
  const patchLayer = (id: string, patch: Record<string, unknown>) => patchSlide(s => { const l = s.layers.find(x => x.id === id); if (l) Object.assign(l, patch) })

  // ── direct manipulation: click-select + drag layers on the canvas ──
  // Map a pointer event to canvas pixel coords (canvas is displayed scaled).
  function canvasPoint(e: React.PointerEvent | PointerEvent) {
    const cv = canvasRef.current!
    const r = cv.getBoundingClientRect()
    return { px: (e.clientX - r.left) * (fmt.w / r.width), py: (e.clientY - r.top) * (fmt.h / r.height) }
  }
  function onCanvasPointerDown(e: React.PointerEvent) {
    if (!slide) return
    const { px, py } = canvasPoint(e)
    const ctx = canvasRef.current!.getContext('2d')!
    const hit = hitTestLayer(slide, px, py, fmt.w, fmt.h, ctx)
    setSelLayer(hit)
    if (!hit) return
    const l = slide.layers.find(x => x.id === hit)!
    dragRef.current = { id: hit, startXN: (l as any).xN, startYN: (l as any).yN, px0: px, py0: py, moved: false }
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId) } catch { /* ok */ }
  }
  function onCanvasPointerMove(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    const { px, py } = canvasPoint(e)
    if (!d.moved && Math.hypot(px - d.px0, py - d.py0) < fmt.w * 0.006) return // ignore micro-jitter
    d.moved = true
    const nx = Math.max(0.02, Math.min(0.98, d.startXN + (px - d.px0) / fmt.w))
    const ny = Math.max(0.02, Math.min(0.98, d.startYN + (py - d.py0) / fmt.h))
    patchLayer(d.id, { xN: nx, yN: ny })
  }
  function onCanvasPointerUp() { dragRef.current = null }
  // Double-click a text layer → inline editor anchored over it.
  function onCanvasDoubleClick(e: React.MouseEvent) {
    if (!slide) return
    const cv = canvasRef.current!
    const r = cv.getBoundingClientRect()
    const px = (e.clientX - r.left) * (fmt.w / r.width), py = (e.clientY - r.top) * (fmt.h / r.height)
    const ctx = cv.getContext('2d')!
    const hit = hitTestLayer(slide, px, py, fmt.w, fmt.h, ctx)
    if (!hit) return
    const l = slide.layers.find(x => x.id === hit)
    setSelLayer(hit)
    if (!l || l.type !== 'text') return
    const b = layerBounds(l, fmt.w, fmt.h, ctx)
    const scale = r.width / fmt.w
    setEditing({ id: hit, x: r.left + b.x * scale, y: r.top + b.y * scale, w: Math.max(160, b.w * scale) })
  }

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
    const id = pid(kind === 'badge' ? 'bd' : 'tx')
    patchSlide(s => {
      if (kind === 'badge') s.layers.push({ id, type: 'badge', name: 'Badge', text: 'NEW', xN: 0.5, yN: 0.14, size: 30, bg: 'accent', color: 'pillInk' })
      else s.layers.push({
        id, type: 'text', name: kind === 'headline' ? 'Headline' : 'Body',
        text: kind === 'headline' ? 'New headline' : 'Supporting line — keep it human.',
        xN: 0.5, yN: kind === 'headline' ? 0.4 : 0.62,
        size: kind === 'headline' ? 84 : 42, weight: kind === 'headline' ? 800 : 500,
        color: kind === 'headline' ? 'ink' : 'soft', align: 'center', font: 'sans',
        maxWidthN: 0.8, lineHeight: kind === 'headline' ? 1.18 : 1.42, highlight: 'pill',
      })
    })
    setSelLayer(id)
    setStatus('Added — double-click it on the canvas to edit, or drag to move.')
  }

  // ── carousel elements: pager dots, swipe arrow, brand mark, divider ──
  function addElement(kind: 'pager' | 'swipe' | 'brand' | 'divider') {
    const id = pid(kind === 'brand' ? 'br' : kind === 'divider' ? 'dv' : 'pg')
    patchSlide(s => {
      if (kind === 'pager') s.layers.push({ id, type: 'pager', name: 'Pager', style: 'dots', xN: 0.5, yN: 0.9, size: 26 })
      else if (kind === 'swipe') s.layers.push({ id, type: 'pager', name: 'Swipe', style: 'arrow', xN: 0.5, yN: 0.9, size: 30 })
      else if (kind === 'brand') s.layers.push({ id, type: 'brand', name: 'Brand', xN: 0.5, yN: 0.09, size: 56, wordmark: true })
      else s.layers.push({ id, type: 'divider', name: 'Divider', xN: 0.5, yN: 0.5, wN: 0.16, color: 'accent', thick: 8 })
    })
    setSelLayer(id)
    setStatus(`Added ${kind} — drag it on the canvas to place.`)
  }
  function addSticker(char: string) {
    const id = pid('em')
    patchSlide(s => {
      // Stagger each new sticker down-right so they don't stack on one spot.
      const n = s.layers.filter(l => l.type === 'emoji').length
      const xN = Math.min(0.8, 0.32 + (n % 4) * 0.12)
      const yN = Math.min(0.8, 0.28 + Math.floor(n / 4) * 0.14 + (n % 4) * 0.05)
      s.layers.push({ id, type: 'emoji', name: 'Sticker', char, xN, yN, size: 140 })
    })
    setSelLayer(id)
    setStatus(`Sticker ${char} added — drag it on the canvas to move.`)
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

  // ── Arganta Core ──
  // Worker-first: the Cloudflare Content Engine generates copy AND images. If it
  // is unreachable/unconfigured, fall back to ai.chatJSON → localPost so the
  // panel never hard-fails (the exact old behavior, preserved below).
  async function runCore(prompt: string) {
    if (!prompt.trim() || botBusy) return
    setBotBusy(true); setBotPrompt('')
    setBotMsgs(m => [...m, { role: 'user', text: prompt }])
    try {
      // Honor an explicit "N slides" in the brief — tell the worker AND clamp
      // deterministically below (the model doesn't reliably obey the count).
      const wantN = parseInt((prompt.match(/\b(\d+)\s*slides?\b/i) || [])[1] || '', 10)
      const want = Number.isInteger(wantN) && wantN >= 1 && wantN <= 10 ? wantN : undefined
      const ctx = {
        format: doc.format, palette: doc.palette, platform,
        brand: doc.brand, wantImages: genImages, slideCount: want,
        existingSlides: doc.slides.map(s => { const c = slideContent(s); return { template: s.template, headline: c.headline, body: c.body } }),
      }
      // 1) Arganta Core (Cloudflare Worker)
      const core = coreEnabled ? await generateCopy(prompt, ctx) : null
      if (core && core.usable) {
        const clamped = clampSlidesToCount(core.copy.slides, want)
        const copy = { ...core.copy, slides: clamped }
        const next = coercePost(copy as any, prompt, doc)
        // seed alt text (IG-ready) from the first image brief or the hook headline
        const firstImg = clamped.find(s => s.imagePrompt)?.imagePrompt
        const firstHead = clamped.find(s => s.headline)?.headline
        if (!next.alt) next.alt = (firstImg || firstHead || '').replace(/\s+/g, ' ').trim().slice(0, 180)
        setDoc(next); setSel(0); setSelLayer(null)
        const imgPrompts = clamped.map(s => s.imagePrompt || '')
        setBotMsgs(m => [...m, { role: 'agent', text: `Designed **${next.slides.length} slides** + caption. _(Arganta Core · ${core.provenance.model.replace(/^@cf\//, '')})_${genImages ? ' Generating images…' : ''}` }])
        if (genImages) await generateSlideImages(next, imgPrompts)
        return
      }
      // 2) Fallback — existing free chain
      const r = await ai.chatJSON({ task: 'copy', schema: POST_SCHEMA, messages: postMessages(prompt) })
      const useLocal = r.provider === 'mock' || !r.json || !Array.isArray(r.json.slides) || r.json.slides.length === 0
      const next = useLocal ? localPost(prompt, doc) : coercePost(r.json, prompt, doc)
      setDoc(next); setSel(0); setSelLayer(null)
      const via = useLocal ? (aiLive ? 'local draft — model returned nothing usable' : 'local draft — connect Arganta Core for images + sharper copy') : 'AI · ' + r.provider
      setBotMsgs(m => [...m, { role: 'agent', text: `Designed **${next.slides.length} slides** + caption. Swap the palette, tweak any line, export when happy. _(${via})_` }])
    } catch (e: any) {
      setBotMsgs(m => [...m, { role: 'agent', text: 'Failed: ' + (e?.message || e) }])
    } finally { setBotBusy(false) }
  }

  // Generate a background image per slide that has a brief, upload each to the
  // media library (so it persists + stays same-origin for export), and patch it
  // in as the slide's bg. Sequential + best-effort — one failure never blocks
  // the rest, and the copy is already on the canvas regardless.
  async function generateSlideImages(builtDoc: PostDoc, prompts: string[]) {
    let done = 0
    for (let i = 0; i < builtDoc.slides.length; i++) {
      const p = prompts[i]
      if (!p) continue
      try {
        const img = await generateImage({ prompt: p, format: builtDoc.format, palette: builtDoc.palette })
        if (!img) continue
        let url = URL.createObjectURL(img.blob)
        if (cloudEnabled) {
          try {
            const file = new File([img.blob], `core-${pid('img')}.${extForImageMime(img.blob.type)}`, { type: img.blob.type })
            const a = await uploadAsset(supabase, file, { kind: 'image', width: img.width, height: img.height })
            url = a.url
          } catch { /* keep the object URL — still renders, just not persisted */ }
        }
        const sid = builtDoc.slides[i].id
        setDoc(prev => {
          const d: PostDoc = JSON.parse(JSON.stringify(prev))
          const s = d.slides.find(x => x.id === sid)
          if (!s) return prev
          const old = s.layers.find(l => l.type === 'image' && (l as any).mode === 'bg')
          if (old && old.type === 'image') old.url = url
          else s.layers.unshift({ id: pid('im'), type: 'image', name: 'Arganta Core', url, mode: 'bg', xN: 0.5, yN: 0.5, wN: 1, hN: 1, radius: 0, dim: 0.5, opacity: 1 } as any)
          return d
        })
        done++
      } catch { /* best-effort per slide */ }
    }
    if (cloudEnabled) refreshAssets()
    setBotMsgs(m => [...m, { role: 'agent', text: done ? `Generated **${done} image${done > 1 ? 's' : ''}** and placed them as slide backgrounds. Dim/replace any in the Layers panel.` : 'No images this time — the copy is ready; you can add photos below.' }])
  }

  // ── O7: generate one image for the CURRENT slide, on demand ──
  // Prompt priority: explicit override → the media search box → the slide's own
  // headline/body. Uploads to the library (persist + same-origin) and places it
  // as this slide's background.
  async function genImageForSlide(override?: string) {
    if (!coreEnabled) { setStatus('Connect Arganta Core (set VITE_ARGANTA_CORE_URL) to generate images.'); return }
    if (!slide) return
    const c = slideContent(slide)
    const prompt = (override || impQuery || [c.headline, c.body].filter(Boolean).join(' — ') || 'a warm family lifestyle scene').replace(/\n/g, ' ').trim()
    setMediaBusy(true); setStatus(`Arganta Core is generating an image for slide ${sel + 1}…`)
    try {
      const img = await generateImage({ prompt, format: doc.format, palette: doc.palette })
      if (!img) { setStatus('Arganta Core returned no image — try again or adjust the prompt.'); return }
      let url = URL.createObjectURL(img.blob)
      if (cloudEnabled) {
        try {
          const file = new File([img.blob], `core-${pid('img')}.${extForImageMime(img.blob.type)}`, { type: img.blob.type })
          const a = await uploadAsset(supabase, file, { kind: 'image', width: img.width, height: img.height })
          url = a.url; refreshAssets()
        } catch { /* keep object URL */ }
      }
      const sid = slide.id
      setDoc(prev => {
        const d: PostDoc = JSON.parse(JSON.stringify(prev))
        const s = d.slides.find(x => x.id === sid); if (!s) return prev
        const old = s.layers.find(l => l.type === 'image' && (l as any).mode === 'bg')
        if (old && old.type === 'image') old.url = url
        else s.layers.unshift({ id: pid('im'), type: 'image', name: 'Arganta Core', url, mode: 'bg', xN: 0.5, yN: 0.5, wN: 1, hN: 1, radius: 0, dim: 0.5, opacity: 1 } as any)
        return d
      })
      setStatus(`Image placed on slide ${sel + 1}${cloudEnabled ? ' + saved to library' : ''}.`)
    } catch (e: any) { setStatus('Generate failed: ' + (e?.message || e)) } finally { setMediaBusy(false) }
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
        ? 'Sent to the Discover feed as a draft.'
        : 'Could not save — are you signed in as an operator?')
    } catch (e: any) { setStatus('Publish failed: ' + (e?.message || e)) } finally { setBusy('') }
  }

  // ── O4: publish the whole carousel as a Kinetik Moment ──
  async function openMomentPicker() {
    if (!cloudEnabled) { setStatus('Connect Supabase & sign in as a circle member to publish moments.'); return }
    setMomentOpen(o => !o)
    if (!circlesLoaded) {
      const list = await listPublishableCircles(supabase)
      setCircles(list); setCirclesLoaded(true)
      if (list.length && !circleId) setCircleId(list[0].id)
    }
  }

  async function doPublishMoment() {
    if (!circleId) { setStatus('Pick a circle to publish into.'); return }
    setBusy('moment')
    try {
      const media = []
      for (let i = 0; i < doc.slides.length; i++) {
        const blob = await renderSlideBlob(doc, i, env)
        media.push({ blob, kind: 'photo' as const, ext: 'png' })
      }
      // Caption + hashtags go in the body. NOT p_tags — that's a uuid[] of
      // member IDs to tag people (which the builder has no picker for yet);
      // passing hashtag strings there made the RPC reject the whole post.
      const body = (doc.caption + (doc.hashtags ? '\n\n' + doc.hashtags : '')).trim()
      const id = await publishMoment(supabase, { circleId, media, body, kind: 'photo' })
      setMomentOpen(false)
      if (id) {
        setPublished({ circle: circles.find(c => c.id === circleId)?.name || 'the circle', slides: doc.slides.length })
        setStatus('')
      } else {
        setStatus('Publish returned no id — check you’re a member of that circle.')
      }
    } catch (e: any) {
      setStatus(String(e?.name) === 'SecurityError'
        ? 'Publish blocked: an image host refused cross-origin use. Re-add backgrounds via Upload/Generate (same-origin).'
        : 'Publish failed: ' + (e?.message || e))
    } finally { setBusy('') }
  }

  // ── BF2: publish the carousel to Buffer → Instagram ──
  async function openBufferPicker() {
    if (!cloudEnabled) { setStatus('Connect Supabase — Buffer needs the rendered slides on a public URL.'); return }
    setBufferOpen(o => !o)
    if (!bufChannelsLoaded) {
      const list = await listBufferChannels()
      setBufChannels(list); setBufChannelsLoaded(true)
      const ig = list.find(c => c.service === 'instagram') || list[0]
      if (ig && !bufChannelId) setBufChannelId(ig.id)
    }
  }

  async function doPublishBuffer() {
    if (!bufChannelId) { setStatus('Pick a Buffer channel.'); return }
    if (doc.slides.length > 10) { setStatus('Instagram carousels allow at most 10 slides — remove a few.'); return }
    setBusy('buffer')
    try {
      // Buffer needs PUBLIC image URLs — render each slide and upload to the
      // public video-assets bucket (uploadAsset returns a public URL), unlike
      // moments which live in a private bucket Buffer can't reach.
      const imageUrls: string[] = []
      for (let i = 0; i < doc.slides.length; i++) {
        // Instagram's publishing API accepts JPEG only — render JPEG for Buffer
        // (PNG posts are silently rejected, which is why nothing appeared).
        const blob = await renderSlideBlob(doc, i, env, 'image/jpeg')
        const file = new File([blob], `buffer-${pid('img')}.jpg`, { type: 'image/jpeg' })
        const a = await uploadAsset(supabase, file, { kind: 'image', width: fmt.w, height: fmt.h })
        imageUrls.push(a.url)
      }
      refreshAssets()
      const text = (doc.caption + (doc.hashtags ? '\n\n' + doc.hashtags : '')).trim()
      const r = await publishToBuffer({ channelId: bufChannelId, text, imageUrls, mode: bufMode, channelService: bufChannels.find(c => c.id === bufChannelId)?.service })
      setBufferOpen(false)
      setBufferDone({ channel: bufChannels.find(c => c.id === bufChannelId)?.name || 'Instagram', mode: r.mode, images: r.images })
      setStatus('')
    } catch (e: any) {
      setBufferOpen(false)
      // Loud modal (not a tiny status line) so a Buffer rejection is impossible
      // to miss — it carries the real Buffer/Instagram message.
      setBufferError(String(e?.name) === 'SecurityError'
        ? 'An image host refused cross-origin use. Re-add backgrounds via Upload or Generate, then try again.'
        : (e?.message || String(e)))
    } finally { setBusy('') }
  }

  // ── Path C: fan out to every intent Claude Code recorded on the open draft ──
  // Renders the COMPOSED canvas once per destination format (moments want
  // private-bucket PNG; Buffer needs public-bucket JPEG — never share one
  // render between them, see docs/arganta-core/Content-Workflow.md §0). Each
  // intent is independent: one failing never blocks the others, and only
  // successes get written back to published_to (failures stay visible so you
  // can retry that one destination without redoing the ones that worked).
  function intentKey(p: { dest: string; circleId?: string; channelId?: string }) { return `${p.dest}:${p.circleId || p.channelId}` }
  const publishedKeys = new Set((activeDraft?.publishedTo || []).map(r => intentKey(r)))

  async function approvePublishEverywhere() {
    if (!activeDraft || !activeDraft.publishTo.length) return
    setBusy('approve')
    const results: { dest: string; label: string; ok: boolean; message: string }[] = []
    const newlyPublished: NonNullable<ContentDraft['publishedTo']> = []
    for (const intent of activeDraft.publishTo) {
      if (publishedKeys.has(intentKey(intent))) continue // already done — retry only what's left
      try {
        if (intent.dest === 'moment') {
          const media = []
          for (let i = 0; i < doc.slides.length; i++) media.push({ blob: await renderSlideBlob(doc, i, env), kind: 'photo' as const, ext: 'png' })
          const body = (doc.caption + (doc.hashtags ? '\n\n' + doc.hashtags : '')).trim()
          const postId = await publishMoment(supabase, { circleId: intent.circleId, media, body, kind: 'photo' })
          const circleName = circles.find(c => c.id === intent.circleId)?.name || intent.circleId
          if (postId) {
            const record = { dest: 'moment' as const, postId, publishedAt: new Date().toISOString(), circleId: intent.circleId }
            await recordDraftPublish(supabase, activeDraft.id, record)
            newlyPublished.push(record)
            results.push({ dest: 'moment', label: `Moment → ${circleName}`, ok: true, message: 'Published to Kinetik → Remember.' })
          } else {
            results.push({ dest: 'moment', label: `Moment → ${circleName}`, ok: false, message: 'No id returned — check circle membership.' })
          }
        } else {
          if (doc.slides.length > 10) throw new Error('Instagram carousels allow at most 10 slides — remove a few, then retry.')
          const imageUrls: string[] = []
          for (let i = 0; i < doc.slides.length; i++) {
            const blob = await renderSlideBlob(doc, i, env, 'image/jpeg')
            const file = new File([blob], `buffer-${pid('img')}.jpg`, { type: 'image/jpeg' })
            const a = await uploadAsset(supabase, file, { kind: 'image', width: fmt.w, height: fmt.h })
            imageUrls.push(a.url)
          }
          const text = (doc.caption + (doc.hashtags ? '\n\n' + doc.hashtags : '')).trim()
          const channelName = bufChannels.find(c => c.id === intent.channelId)?.name || intent.channelId
          const r = await publishToBuffer({ channelId: intent.channelId, text, imageUrls, mode: intent.mode || 'addToQueue', channelService: bufChannels.find(c => c.id === intent.channelId)?.service })
          const record = { dest: 'buffer' as const, postId: r.postId, publishedAt: new Date().toISOString(), channelId: intent.channelId, mode: r.mode }
          await recordDraftPublish(supabase, activeDraft.id, record)
          newlyPublished.push(record)
          results.push({ dest: 'buffer', label: `Buffer → ${channelName}`, ok: true, message: r.mode === 'shareNow' ? 'Published now.' : r.mode === 'shareNext' ? 'Next in the Buffer queue.' : 'Queued in Buffer for review.' })
        }
      } catch (e: any) {
        const label = intent.dest === 'moment'
          ? `Moment → ${circles.find(c => c.id === intent.circleId)?.name || intent.circleId}`
          : `Buffer → ${bufChannels.find(c => c.id === intent.channelId)?.name || intent.channelId}`
        results.push({ dest: intent.dest, label, ok: false, message: e?.message || String(e) })
      }
    }
    if (newlyPublished.length) {
      setActiveDraft(prev => prev && prev.id === activeDraft.id ? { ...prev, publishedTo: [...prev.publishedTo, ...newlyPublished] } : prev)
    }
    refreshAssets()
    setFanoutResult(results)
    setBusy('')
  }

  async function copyCaption() {
    const text = doc.caption + (doc.hashtags ? '\n\n' + doc.hashtags : '')
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600)
  }

  function startOver() {
    if (!confirm('Start a fresh post? The current one is replaced (it stays in your browser until then).')) return
    setDoc(starterDoc()); setSel(0); setSelLayer(null); setStatus('Fresh canvas.'); setActiveDraft(null)
  }

  const rule = captionRule(platform)
  const capLen = doc.caption.length + (doc.hashtags ? doc.hashtags.length + 2 : 0)
  const tagCount = (doc.hashtags.match(/#[^\s#]+/g) || []).length
  const over = capLen > rule.limit

  // ── IG-ready checklist ── a post is "ready" when every box is green.
  const igChecks = useMemo(() => {
    const igFormats = ['portrait', 'square', 'story']
    return [
      { ok: igFormats.includes(doc.format), label: `IG format (${fmt.aspect})`, hint: 'Use 4:5, 1:1, or 9:16 for Instagram.' },
      { ok: doc.slides.length >= 1 && doc.slides.length <= 10, label: `${doc.slides.length} slide${doc.slides.length > 1 ? 's' : ''} (≤10)`, hint: 'Instagram carousels allow up to 10.' },
      { ok: !!doc.caption.trim() && !over, label: 'Caption within limit', hint: `Keep under ${rule.limit.toLocaleString()} chars.` },
      { ok: doc.caption.length <= rule.hook || doc.caption.trim().length > 0 && doc.caption.slice(0, rule.hook).trim().length > 0, label: 'Hook before the fold', hint: `First ${rule.hook} chars carry the hook.` },
      { ok: tagCount >= 3 && tagCount <= 30, label: `${tagCount} hashtags (3–30)`, hint: 'IG advises 3–5; hard cap is 30.' },
      { ok: !!(doc.alt && doc.alt.trim().length >= 5), label: 'Alt text', hint: 'Describe the image for screen readers.' },
    ]
  }, [doc.format, doc.slides.length, doc.caption, doc.alt, over, tagCount, rule.limit, rule.hook, fmt.aspect])
  const igReady = igChecks.every(c => c.ok)

  return (
    <div className="pbx">
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.currentTarget.value = '' }} />

      {/* ── moment publish-success modal ── */}
      {published && (
        <div className="pbx-modal-backdrop" onClick={() => setPublished(null)}>
          <div className="pbx-modal" onClick={e => e.stopPropagation()}>
            <div className="pbx-modal-icon"><Heart size={28} /></div>
            <h3>Published to {published.circle} 🎉</h3>
            <p>Your {published.slides}-slide carousel is now live in <b>KinetikCircle → Remember</b>. Family members will see it in the feed.</p>
            <button className="pbx-modal-btn" onClick={() => setPublished(null)}>Done</button>
          </div>
        </div>
      )}

      {/* ── Buffer publish-success modal ── */}
      {bufferDone && (
        <div className="pbx-modal-backdrop" onClick={() => setBufferDone(null)}>
          <div className="pbx-modal" onClick={e => e.stopPropagation()}>
            <div className="pbx-modal-icon pbx-modal-icon--ig"><Instagram size={28} /></div>
            <h3>{bufferDone.mode === 'shareNow' ? 'Published to' : 'Queued to'} {bufferDone.channel} 🎉</h3>
            <p>
              {bufferDone.images} image{bufferDone.images > 1 ? 's' : ''} sent to <b>Buffer</b>
              {bufferDone.mode === 'shareNow'
                ? ' and published now.'
                : bufferDone.mode === 'shareNext'
                  ? ' for the next queue slot.'
                  : ' — review & approve it in your Buffer queue, and it goes to Instagram.'}
            </p>
            <a className="pbx-modal-btn" href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" onClick={() => setBufferDone(null)}>Open Buffer</a>
          </div>
        </div>
      )}

      {/* ── Buffer publish-error modal ── */}
      {bufferError && (
        <div className="pbx-modal-backdrop" onClick={() => setBufferError(null)}>
          <div className="pbx-modal" onClick={e => e.stopPropagation()}>
            <div className="pbx-modal-icon pbx-modal-icon--err"><X size={28} /></div>
            <h3>Buffer didn’t accept it</h3>
            <p><b>Buffer said:</b><br /><span className="pbx-modal-err">{bufferError}</span></p>
            <button className="pbx-modal-btn" onClick={() => setBufferError(null)}>Got it</button>
          </div>
        </div>
      )}

      {/* ── Path C: fan-out result modal (one row per destination, success or not) ── */}
      {fanoutResult && (
        <div className="pbx-modal-backdrop" onClick={() => setFanoutResult(null)}>
          <div className="pbx-modal" onClick={e => e.stopPropagation()}>
            <div className={'pbx-modal-icon' + (fanoutResult.every(r => r.ok) ? '' : ' pbx-modal-icon--err')}>
              {fanoutResult.every(r => r.ok) ? <Check size={28} /> : <X size={28} />}
            </div>
            <h3>{fanoutResult.every(r => r.ok) ? 'Published everywhere 🎉' : fanoutResult.some(r => r.ok) ? 'Partly published' : 'Publish failed'}</h3>
            <div className="pbx-fanoutlist">
              {fanoutResult.map((r, i) => (
                <div key={i} className={'pbx-fanoutrow' + (r.ok ? ' ok' : '')}>
                  <span className="pbx-fanoutdot">{r.ok ? <Check size={11} /> : <X size={11} />}</span>
                  <span className="pbx-fanoutlabel">{r.label}</span>
                  <span className="pbx-fanoutmsg">{r.message}</span>
                </div>
              ))}
            </div>
            <button className="pbx-modal-btn" onClick={() => setFanoutResult(null)}>Done</button>
          </div>
        </div>
      )}

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
        <button className={'pbx-ghost' + (guides ? ' on' : '')} title="Show safe zones (5% crop frame + platform UI on story)" onClick={() => setGuides(g => !g)}>
          <ScanLine size={14} /> Safe zones
        </button>
        <button className={'pbx-ghost' + (botOpen ? ' on' : '')} onClick={() => setBotOpen(o => !o)}>
          <Sparkles size={14} /> Arganta Core
        </button>
        {cloudEnabled && (
          <div className="pbx-draftswrap">
            <button className={'pbx-ghost' + (draftsOpen ? ' on' : '')} title="Drafts authored from Claude Code (tools/arganta-core-mcp)" onClick={() => { setDraftsOpen(o => !o); if (!draftsOpen) refreshDrafts() }}>
              <Inbox size={14} /> Drafts
              {drafts.filter(d => !d.consumedAt).length > 0 && <span className="pbx-draftbadge">{drafts.filter(d => !d.consumedAt).length}</span>}
            </button>
            {draftsOpen && (
              <div className="pbx-draftspop">
                <div className="pbx-momenthead"><Inbox size={13} /> Drafts{draftsBusy ? ' · loading…' : ''}</div>
                {drafts.length === 0 ? (
                  <p className="pbx-mini">No drafts yet — author one from Claude Code with `content_draft`.</p>
                ) : (
                  <div className="pbx-draftlist">
                    {drafts.map(d => (
                      <button key={d.id} className={'pbx-draftitem' + (d.consumedAt ? ' seen' : '')} disabled={d.status !== 'ready'} onClick={() => openDraft(d)}>
                        <span className="pbx-draftbrief">{d.brief.slice(0, 54)}{d.brief.length > 54 ? '…' : ''}</span>
                        <span className="pbx-draftmeta">{d.status === 'error' ? 'error' : `${d.copy.slides.length} slides`} · {new Date(d.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        {d.publishTo.length > 0 && (
                          <span className="pbx-draftintents">
                            {d.publishTo.map((p, i) => (
                              <span key={i} className="pbx-intentbadge">→ {p.dest === 'moment' ? 'Moment' : 'Buffer'}</span>
                            ))}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {activeDraft && activeDraft.publishTo.length > 0 && (
          <button
            className="pbx-approve"
            disabled={busy !== '' || activeDraft.publishTo.every(p => publishedKeys.has(intentKey(p)))}
            title="Compose the canvas once, then publish to every destination requested from Claude Code"
            onClick={approvePublishEverywhere}
          >
            <Check size={14} />
            {busy === 'approve' ? 'Publishing…'
              : activeDraft.publishTo.every(p => publishedKeys.has(intentKey(p))) ? 'All published ✓'
              : `Approve & publish everywhere (${activeDraft.publishTo.length - activeDraft.publishTo.filter(p => publishedKeys.has(intentKey(p))).length})`}
          </button>
        )}
        <div className="pbx-momentwrap">
          <button className="pbx-moment" disabled={busy !== ''} title="Publish this carousel to a KinetikCircle → Remember feed" onClick={openMomentPicker}>
            <Heart size={14} /> {busy === 'moment' ? 'Publishing…' : 'Publish to Moment'}
          </button>
          {momentOpen && (
            <div className="pbx-momentpop">
              <div className="pbx-momenthead"><Users size={13} /> Publish to circle</div>
              {!cloudEnabled ? (
                <p className="pbx-mini">Connect Supabase & sign in as a circle member.</p>
              ) : circles.length === 0 ? (
                <p className="pbx-mini">{circlesLoaded ? 'No circles you can post into.' : 'Loading circles…'}</p>
              ) : (
                <>
                  <select className="pbx-sel" value={circleId} onChange={e => setCircleId(e.target.value)}>
                    {circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="pbx-mini">{doc.slides.length} slide{doc.slides.length > 1 ? 's' : ''} → one carousel moment · caption + hashtags included.</p>
                  <button className="pbx-btn accent" disabled={busy !== '' || !circleId} onClick={doPublishMoment}>
                    <Heart size={12} /> {busy === 'moment' ? 'Publishing…' : 'Publish now'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {bufferEnabled && (
          <div className="pbx-momentwrap">
            <button className="pbx-buffer" disabled={busy !== ''} title="Publish this carousel to Instagram via Buffer" onClick={openBufferPicker}>
              <Instagram size={14} /> {busy === 'buffer' ? 'Publishing…' : 'Send to Buffer'}
            </button>
            {bufferOpen && (
              <div className="pbx-momentpop">
                <div className="pbx-momenthead"><SendIcon size={13} /> Publish via Buffer</div>
                {!cloudEnabled ? (
                  <p className="pbx-mini">Connect Supabase — Buffer needs the slides on a public URL.</p>
                ) : bufChannels.length === 0 ? (
                  <p className="pbx-mini">{bufChannelsLoaded ? 'No connected channels — add one in Buffer.' : 'Loading channels…'}</p>
                ) : (
                  <>
                    <select className="pbx-sel" value={bufChannelId} onChange={e => setBufChannelId(e.target.value)}>
                      {bufChannels.map(c => <option key={c.id} value={c.id}>{c.name} · {c.service}</option>)}
                    </select>
                    <div className="pbx-row" style={{ gap: 4 }}>
                      {([['addToQueue', 'Queue'], ['shareNext', 'Next slot'], ['shareNow', 'Now']] as const).map(([m, label]) => (
                        <span key={m} className={'pbx-chip' + (bufMode === m ? ' on' : '')} onClick={() => setBufMode(m)}>{label}</span>
                      ))}
                    </div>
                    <p className="pbx-mini">{doc.slides.length} slide{doc.slides.length > 1 ? 's' : ''} → {bufMode === 'shareNow' ? 'publishes now' : bufMode === 'shareNext' ? 'next queue slot' : 'added to your Buffer queue to review'}.</p>
                    <button className="pbx-btn accent" disabled={busy !== '' || !bufChannelId} onClick={doPublishBuffer}>
                      <Instagram size={12} /> {busy === 'buffer' ? 'Publishing…' : bufMode === 'shareNow' ? 'Publish now' : 'Send to Buffer'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <button className="pbx-export" disabled={busy !== ''} onClick={doExport}>
          <Download size={14} /> {busy === 'export' ? 'Rendering…' : doc.slides.length > 1 ? `Export ${doc.slides.length} slides` : 'Export PNG'}
        </button>
      </div>

      {/* ── stage + inspector ── */}
      <div className="pbx-main">
        <div className={'pbx-stage' + (botOpen ? ' pbx-stage--bot' : '')}>
          <span className="pbx-stagebadge">{fmt.label} · {fmt.w}×{fmt.h} · {fmt.aspect}</span>
          <span className="pbx-stageplat">{fmt.platforms}</span>
          <div className="pbx-stagebox">
            <canvas ref={canvasRef} className="pbx-canvas pbx-canvas--draggable"
              onPointerDown={onCanvasPointerDown} onPointerMove={onCanvasPointerMove}
              onPointerUp={onCanvasPointerUp} onPointerCancel={onCanvasPointerUp}
              onDoubleClick={onCanvasDoubleClick} />
          </div>

          {editing && slide && (
            <textarea
              className="pbx-inline-edit" autoFocus
              style={{ left: editing.x, top: editing.y, width: editing.w }}
              value={(slide.layers.find(l => l.id === editing.id) as TextLayer | undefined)?.text ?? ''}
              onChange={e => patchLayer(editing.id, { text: e.target.value })}
              onBlur={() => setEditing(null)}
              onKeyDown={e => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); setEditing(null) } }} />
          )}

          {botOpen && (
            <div className="pbx-bot">
              <div className="pbx-bot-head">
                <Sparkles size={14} /> <b>Arganta Core</b>
                <span className="pbx-bot-tag" title={coreQuota ? `${coreQuota.textModel || ''} · ~${coreQuota.freePerDay.toLocaleString()} neurons/day (${coreQuota.estimated ? 'est.' : 'live'})` : undefined}>
                  {coreEnabled
                    ? `${prettyModel(coreQuota?.textModel)} · ${Math.round((coreQuota?.freePerDay ?? 10000) / 1000)}k/day`
                    : aiLive ? 'AI connected' : 'local mode'}
                </span>
                {coreEnabled && (
                  <button className={'pbx-ic pbx-imgtoggle' + (genImages ? ' on' : '')} title={genImages ? 'Generating images: on' : 'Generating images: off'} onClick={() => setGenImages(v => !v)} aria-label="Toggle image generation">
                    <Sticker size={14} />
                  </button>
                )}
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
                  <button key={q} className="pbx-chip" disabled={botBusy} onClick={() => runCore(q)}>{q.slice(0, 26)}…</button>
                ))}
              </div>
              <div className="pbx-bot-input">
                <input value={botPrompt} disabled={botBusy} placeholder="Describe your post…"
                  onChange={e => setBotPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && botPrompt.trim()) runCore(botPrompt.trim()) }} />
                <button className="pbx-bot-send" disabled={botBusy || !botPrompt.trim()} onClick={() => runCore(botPrompt.trim())} aria-label="Send"><Send size={14} /></button>
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
            <div className="pbx-ph"><TypeIcon size={13} /> Text<span className="badge">double-click on canvas to edit</span></div>
            <div className="pbx-chipwrap">
              <button className="pbx-chip" onClick={() => addText('headline')}><Plus size={11} /> headline</button>
              <button className="pbx-chip" onClick={() => addText('body')}><Plus size={11} /> body</button>
              <button className="pbx-chip" onClick={() => addText('badge')}><Plus size={11} /> badge</button>
            </div>
          </div>

          {/* carousel elements */}
          <div className="pbx-panel">
            <div className="pbx-ph"><Layers size={13} /> Elements<span className="badge">drag to place</span></div>
            <div className="pbx-chipwrap">
              <button className="pbx-chip" onClick={() => addElement('pager')}><Plus size={11} /> pager dots</button>
              <button className="pbx-chip" onClick={() => addElement('swipe')}><Plus size={11} /> swipe →</button>
              <button className="pbx-chip" onClick={() => addElement('brand')}><Plus size={11} /> brand</button>
              <button className="pbx-chip" onClick={() => addElement('divider')}><Plus size={11} /> divider</button>
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
            {coreEnabled && (
              <div className="pbx-row">
                <button className="pbx-btn accent" disabled={mediaBusy} title="Generate a background for this slide from its words (or the search box)" onClick={() => genImageForSlide()}>
                  <Sparkles size={12} /> {mediaBusy ? 'Generating…' : 'Generate image'}
                </button>
                <button className="pbx-btn" disabled={mediaBusy} title="Generate a fresh variant for this slide" onClick={() => genImageForSlide()}>
                  <Shuffle size={12} /> Variant
                </button>
              </div>
            )}
            <div className="pbx-row">
              <button className="pbx-btn accent" onClick={() => fileRef.current?.click()} disabled={mediaBusy}><Upload size={12} /> Upload</button>
              <input className="pbx-sel" value={impQuery} onChange={e => setImpQuery(e.target.value)} placeholder={coreEnabled ? 'image prompt / stock search…' : 'stock search…'} />
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

          {/* IG-ready checklist */}
          <div className="pbx-panel">
            <div className="pbx-ph"><Check size={13} /> Instagram-ready<span className={'badge' + (igReady ? ' ok' : '')}>{igReady ? 'all set' : `${igChecks.filter(c => c.ok).length}/${igChecks.length}`}</span></div>
            <div className="pbx-checks">
              {igChecks.map(c => (
                <div key={c.label} className={'pbx-check' + (c.ok ? ' on' : '')} title={c.hint}>
                  <span className="pbx-checkdot">{c.ok ? <Check size={11} /> : <X size={11} />}</span>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
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
            <input className="pbx-sel" value={doc.alt || ''} placeholder="Alt text — describe the image (accessibility)"
              onChange={e => update(d => { d.alt = e.target.value })} />
            <div className="pbx-capmeta">
              <span className={over ? 'bad' : ''}>{capLen.toLocaleString()} / {rule.limit.toLocaleString()}</span>
              <span className={doc.caption.length > rule.hook ? 'warn' : 'ok'}>hook: {Math.min(doc.caption.length, rule.hook)}/{rule.hook} before the fold</span>
              <span>{tagCount} tags · {rule.tags}</span>
            </div>
            <div className="pbx-row">
              <button className="pbx-btn" onClick={copyCaption}>{copied ? <><Check size={12} /> Copied</> : <><CopyIcon size={12} /> Copy caption</>}</button>
              <button className="pbx-btn" disabled={busy !== '' || !cloudEnabled} title={cloudEnabled ? 'Slide 1 + caption → an HQ Discover-feed draft (separate from Kinetik moments)' : 'Connect Supabase to enable'} onClick={publishToFeed}>
                <Rocket size={12} /> {busy === 'publish' ? 'Sending…' : 'Draft to Discover'}
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

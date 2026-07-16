import { useEffect, useMemo, useRef, useState } from 'react'
import {
  blankProject, formatList, PALETTES, textLayer, captionLayer, waveLayer, imageLayer,
  recomputeDuration, drawFrame, renderVoice, voiceList, bufferPeaks,
  exportVideo, downloadBlob, startClips,
  listAssets, uploadAsset, importStock, loadImage, saveRender,
  localStoryboard, storyboardToProject,
} from '@arganta/video'
import { storyboardMessages, coerceStoryboard, STORYBOARD_SCHEMA } from '@arganta/ai'
import { DEFAULT_SFX_RECIPES, createMasterChain, playRecipe } from '@arganta/audio'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { ai, aiLive } from '../../lib/ai'
import { generateCopy, generateImage, coreEnabled, extForImageMime } from '../../lib/argantaCoreClient'
import { listPublishableCircles, publishMoment, type PublishCircle } from '../../lib/momentPublish'
import { listBufferChannels, publishVideoToBuffer, bufferEnabled, type BufferChannel, type BufferMode } from '../../lib/bufferClient'
import { Play, Pause, Plus, Eye, EyeOff, Trash2, ChevronUp, ChevronDown, Mic, Music2, Film, Download, Layers, Upload, Cloud, Sparkles, X, Send, Heart, Users, Instagram } from 'lucide-react'
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
const HUE = { background: '#64748b', text: '#6366f1', caption: '#a855f7', waveform: '#06b6d4', voice: '#f59e0b', sfx: '#10b981', image: '#14b8a6', music: '#ec4899' } as const

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
  const [busy, setBusy] = useState<'' | 'voice' | 'export' | 'moment' | 'buffer'>('')
  // Kinetik moment publishing (S4 — reuses momentPublish.ts, same as Post Studio's O4)
  const [momentOpen, setMomentOpen] = useState(false)
  const [circles, setCircles] = useState<PublishCircle[]>([])
  const [circleId, setCircleId] = useState('')
  const [circlesLoaded, setCirclesLoaded] = useState(false)
  const [lastRender, setLastRender] = useState<{ blob: Blob; ext: string; publicUrl: string | null } | null>(null)
  const [published, setPublished] = useState<string | null>(null)   // success-modal circle name
  // BF3: publish the exported video to Buffer -> Instagram
  const [bufferOpen, setBufferOpen] = useState(false)
  const [bufChannels, setBufChannels] = useState<BufferChannel[]>([])
  const [bufChannelId, setBufChannelId] = useState('')
  const [bufChannelsLoaded, setBufChannelsLoaded] = useState(false)
  const [bufMode, setBufMode] = useState<BufferMode>('addToQueue')
  const [bufferDone, setBufferDone] = useState<{ channel: string; mode: BufferMode } | null>(null)
  const [bufferError, setBufferError] = useState<string | null>(null)
  const [exportPct, setExportPct] = useState(0)
  const [status, setStatus] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  // media library (Supabase Storage)
  const [assets, setAssets] = useState<any[]>([])
  const [assetKind, setAssetKind] = useState<'all' | 'image' | 'audio' | 'video'>('all')
  const [mediaBusy, setMediaBusy] = useState(false)
  const [impQuery, setImpQuery] = useState('calm family home')
  const fileRef = useRef<HTMLInputElement>(null)
  // Director chat
  const [dirOpen, setDirOpen] = useState(false)
  const [dirPrompt, setDirPrompt] = useState('')
  const [dirBusy, setDirBusy] = useState(false)
  const [dirMsgs, setDirMsgs] = useState<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: 'I’m **Arganta Core**. Describe a video — “a 30s reel about our family calendar app, upbeat, 3 scenes”. I’ll write the script, generate scene backgrounds, and build it; you edit anything below.' },
  ])
  const [genImages, setGenImages] = useState(coreEnabled)

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

  // ---- media library ----
  function refreshAssets() { if (cloudEnabled) listAssets(supabase, { kind: assetKind === 'all' ? undefined : assetKind }).then(setAssets) }
  useEffect(() => { refreshAssets() }, [assetKind]) // eslint-disable-line

  async function addImage(img: HTMLImageElement, url: string, name?: string) {
    const t = imageLayer(img, url, { name: name || 'Image', dur: 4, start: Math.round(playheadRef.current * 10) / 10 })
    // place a new image just under the text layers so captions/titles stay on top
    update((p) => { const bgIdx = p.layers.findIndex((l: any) => l.type === 'background'); p.layers.splice(bgIdx + 1, 0, t) })
    setSelId(t.id)
  }
  async function addAudioBuffer(buffer: AudioBuffer, name: string, kind: 'music' | 'sfx' = 'music') {
    update((p) => { p.audio.push({ id: kind + '_' + Date.now(), kind, buffer, start: Math.round(playheadRef.current * 10) / 10, dur: buffer.duration, gain: kind === 'music' ? 0.5 : 0.7, name }) })
  }

  async function onPickFile(file: File) {
    if (!file) return
    const kind = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'image'
    setMediaBusy(true); setStatus(`Adding ${file.name}…`)
    try {
      if (kind === 'image') {
        const localUrl = URL.createObjectURL(file)
        const img = await loadImage(localUrl)
        if (img) await addImage(img, localUrl, file.name)
        if (cloudEnabled) { const a = await uploadAsset(supabase, file, { kind, width: img?.naturalWidth, height: img?.naturalHeight }); refreshAssets(); setStatus(`Image added + stored in Supabase (${a.name}).`) }
        else setStatus('Image added (local — connect Supabase to store it).')
      } else if (kind === 'audio') {
        const actx = ensureCtx(); const buf = await actx.decodeAudioData(await file.arrayBuffer())
        await addAudioBuffer(buf, file.name, 'music')
        if (cloudEnabled) { await uploadAsset(supabase, file, { kind, duration: buf.duration }); refreshAssets() }
        setStatus(`Music added to timeline${cloudEnabled ? ' + stored' : ''}.`)
      } else if (kind === 'video') {
        if (cloudEnabled) { await uploadAsset(supabase, file, { kind }); refreshAssets(); setStatus('Video stored in library. (On-canvas video compositing is the next WebCodecs step.)') }
        else setStatus('Connect Supabase to store video assets.')
      }
    } catch (e: any) { setStatus('Media failed: ' + (e?.message || e)) } finally { setMediaBusy(false) }
  }

  async function useAsset(a: any) {
    setMediaBusy(true); setStatus(`Loading ${a.name}…`)
    try {
      if (a.kind === 'image') { const img = await loadImage(a.url); if (img) await addImage(img, a.url, a.name); setStatus(`Placed “${a.name}”.`) }
      else if (a.kind === 'audio') { const actx = ensureCtx(); const buf = await actx.decodeAudioData(await (await fetch(a.url)).arrayBuffer()); await addAudioBuffer(buf, a.name, 'music'); setStatus(`Added music “${a.name}”.`) }
      else setStatus('Video compositing on canvas is the next WebCodecs step — the clip is in your library.')
    } catch (e: any) { setStatus('Load failed: ' + (e?.message || e)) } finally { setMediaBusy(false) }
  }

  async function doImportStock(provider: 'pexels' | 'pixabay', kind: 'image' | 'video') {
    if (!cloudEnabled) { setStatus('Connect Supabase to import stock.'); return }
    setMediaBusy(true); setStatus(`Importing ${kind}s for “${impQuery}” from ${provider}…`)
    try {
      const r = await importStock(supabase, { provider, query: impQuery, count: 8, kind })
      setStatus(`Imported ${r.imported} ${kind}(s) from ${provider} into your bucket.`); refreshAssets()
    } catch (e: any) { setStatus('Import failed: ' + (e?.message || e) + ' — is the import-stock function deployed + keys set?') } finally { setMediaBusy(false) }
  }

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

  // Render voice for `script` and fold it (+ captions + wave) into a project,
  // returning a NEW project. Shared by manual Generate and the Director.
  async function voiceIntoProject(base: any, script: string, vId: string) {
    const { buffer, words, duration } = await renderVoice(script, vId)
    const peaks = bufferPeaks(buffer, 220)
    const pal = PALETTES.find((x: any) => x.id === base.palette) || PALETTES[0]
    const layers = base.layers.filter((l: any) => !l.fromVoice).map((l: any) => ({ ...l }))
    const cap = captionLayer(words, { dur: duration, accent: pal.accent, yN: 0.8 }); (cap as any).fromVoice = true
    const wav = waveLayer(peaks, { dur: duration, color: '#06b6d4', yN: 0.63 }); (wav as any).fromVoice = true
    layers.push(wav, cap)
    const audio = base.audio.filter((a: any) => a.kind !== 'voice')
    audio.push({ id: 'voice', kind: 'voice', buffer, start: 0, dur: duration, gain: 1, text: script })
    const p = { ...base, layers, audio, meta: { ...base.meta, voiceText: script, voiceId: vId } }
    recomputeDuration(p); return { p, words, duration }
  }

  async function generateVoice() {
    if (!voiceText.trim()) { setStatus('Paste some text first.'); return }
    setBusy('voice'); setStatus('Synthesizing voice…')
    try {
      const { p, words, duration } = await voiceIntoProject(projectRef.current, voiceText.trim(), voiceId)
      setProject(p)
      setStatus(`Voice ready · ${duration.toFixed(1)}s · ${words.length} words. Captions + wave added.`)
    } catch (e: any) { setStatus('Voice failed: ' + (e?.message || e)) } finally { setBusy('') }
  }

  // ---- Arganta Core: prompt → script → editable project ----
  // Video formats (short/reel/square/long) don't map 1:1 to Post Formats, but the
  // palette vocab overlaps (dusk/mint/grape/ember/ocean exist in both) — reused
  // directly. Maps the SAME copy schema Post Studio uses (slides → scenes) so
  // this reuses O1–O5 with zero new worker endpoint.
  function copyToStoryboard(copy: any, prompt: string, currentFormat: string) {
    const format = /reel/i.test(prompt) ? 'reel' : /long|minute|explainer/i.test(prompt) ? 'long' : /square|feed|1:1/i.test(prompt) ? 'square' : currentFormat || 'short'
    const palette = PALETTES.some((p: any) => p.id === copy.palette) ? copy.palette : 'dusk'
    const scenes = (copy.slides || []).map((s: any, i: number) => ({
      text: [s.headline, s.body].filter(Boolean).join('\n').trim() || ' ',
      anim: i === 0 ? 'cascade' : 'cinematic',
      durationSec: 3,
      imagePrompt: s.imagePrompt,
    })).filter((s: any) => s.text.trim())
    return {
      format, palette,
      fx: { camera: true, grain: true, vignette: true, sweep: true, letterbox: format === 'long' },
      scenes: scenes.length ? scenes : [{ text: prompt || 'Your video.', anim: 'cascade', durationSec: 3 }],
      voiceScript: (copy.caption || prompt || 'Your video.').replace(/#[^\s#]+/g, '').trim(),
      voiceId: 'narrator',
      sfx: [{ cue: 'whoosh', atSec: 0 }],
    }
  }

  async function runCore(prompt: string) {
    if (!prompt.trim() || dirBusy) return
    setDirBusy(true); setDirPrompt('')
    setDirMsgs((m) => [...m, { role: 'user', text: prompt }])
    try {
      const core = coreEnabled ? await generateCopy(prompt, { platform: 'instagram', wantImages: genImages }) : null
      let sb: any
      if (core && core.usable) {
        sb = copyToStoryboard(core.copy, prompt, project.format.id)
      } else {
        const r = await ai.chatJSON({ task: 'storyboard', schema: STORYBOARD_SCHEMA, messages: storyboardMessages(prompt) })
        const useLocal = r.provider === 'mock' || !r.json || !Array.isArray(r.json.scenes) || r.json.scenes.length === 0
        sb = coerceStoryboard(useLocal ? localStoryboard(prompt) : r.json, { prompt })
      }
      let proj = storyboardToProject(sb)
      let dur = 0
      try { const v = await voiceIntoProject(proj, sb.voiceScript, sb.voiceId); proj = v.p; dur = v.duration } catch { /* voice optional */ }
      for (const s of (proj._directives?.sfx || [])) {
        const rec = (DEFAULT_SFX_RECIPES as any)[s.cue]; if (!rec) continue
        try { const buf = await renderCue(rec); proj.audio.push({ id: 'sfx_' + s.cue + '_' + Math.random().toString(36).slice(2), kind: 'sfx', cue: s.cue, buffer: buf, start: s.atSec || 0, dur: buf.duration, gain: 0.6 }) } catch { /* skip */ }
      }
      recomputeDuration(proj)
      playheadRef.current = 0; setProject(proj); setSelId(null)
      setVoiceText(sb.voiceScript); setVoiceId(sb.voiceId)
      const via = core && core.usable ? `Arganta Core · ${core.provenance.model.replace(/^@cf\//, '')}` : (aiLive ? 'local draft — model returned nothing usable' : 'local draft — connect Arganta Core for images + sharper copy')
      const scn = sb.scenes.filter((s: any) => (s.text || '').trim()).length
      setDirMsgs((m) => [...m, { role: 'agent', text: `Built a **${sb.format}** · ${scn} scenes · ${dur ? dur.toFixed(1) + 's' : 'no voice'} · palette ${sb.palette}. Voice + captions added — edit anything below. _(${via})_${genImages && core?.usable ? ' Generating scene backgrounds…' : ''}` }])
      if (genImages && core && core.usable) {
        const prompts = (core.copy.slides || []).map((s: any) => s.imagePrompt || '')
        await generateSceneImages(sb, prompts)
      }
    } catch (e: any) { setDirMsgs((m) => [...m, { role: 'agent', text: 'Failed: ' + (e?.message || e) }]) } finally { setDirBusy(false) }
  }

  // Generate one background image per scene (best-effort) and place it as an
  // image layer spanning that scene's start/duration — under text, above bg.
  async function generateSceneImages(sb: any, prompts: string[]) {
    let t = 0; let done = 0
    for (let i = 0; i < sb.scenes.length; i++) {
      const scene = sb.scenes[i]; const start = t; t += scene.durationSec || 3
      const prompt = prompts[i]
      if (!prompt) continue
      try {
        const img = await generateImage({ prompt, format: 'portrait', palette: sb.palette })
        if (!img) continue
        let url = URL.createObjectURL(img.blob)
        if (cloudEnabled) {
          try {
            const file = new File([img.blob], `core-${Date.now().toString(36)}.${extForImageMime(img.blob.type)}`, { type: img.blob.type })
            const a = await uploadAsset(supabase, file, { kind: 'image', width: img.width, height: img.height })
            url = a.url
          } catch { /* keep object URL */ }
        }
        const el = await loadImage(url)
        if (!el) continue
        const layer = imageLayer(el, url, { name: 'Arganta Core', dur: scene.durationSec || 3, start })
        update((p: any) => { const bgIdx = p.layers.findIndex((l: any) => l.type === 'background'); p.layers.splice(bgIdx + 1, 0, layer) })
        done++
      } catch { /* one scene failing never blocks the rest */ }
    }
    if (cloudEnabled) refreshAssets()
    setDirMsgs((m) => [...m, { role: 'agent', text: done ? `Generated **${done} scene background${done > 1 ? 's' : ''}**.` : 'No scene images this time — the script is ready; add photos below.' }])
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
      let extra = '', publicUrl: string | null = null
      // video-renders is a PUBLIC bucket (migration_video_assets.sql) — the same
      // upload Buffer needs a reachable URL for, so one save covers both.
      if (cloudEnabled) { try { const { url } = await saveRender(supabase, blob, { name: 'video-forge', ext, duration }); publicUrl = url || null; extra = ' · saved to Supabase' + (url ? ' ✓' : ''); refreshAssets() } catch { extra = ' · (Supabase save failed)' } }
      setLastRender({ blob, ext, publicUrl })
      setStatus(`Exported ${name} · ${duration.toFixed(1)}s · ${(blob.size / 1024).toFixed(0)} KB${extra}`)
    } catch (e: any) { setStatus('Export failed: ' + (e?.message || e)) } finally { setBusy(''); setExportPct(0) }
  }

  // ---- S4: publish the last export as a Kinetik Moment (reuses momentPublish.ts) ----
  async function openMomentPicker() {
    if (!cloudEnabled) { setStatus('Connect Supabase & sign in as a circle member to publish moments.'); return }
    if (!lastRender) { setStatus('Export the video first — Publish sends the last render.'); return }
    setMomentOpen(o => !o)
    if (!circlesLoaded) {
      const list = await listPublishableCircles(supabase)
      setCircles(list); setCirclesLoaded(true)
      if (list.length && !circleId) setCircleId(list[0].id)
    }
  }

  async function doPublishMoment() {
    if (!circleId || !lastRender) return
    setBusy('moment')
    try {
      const id = await publishMoment(supabase, {
        circleId,
        media: [{ blob: lastRender.blob, kind: 'video', ext: lastRender.ext }],
        body: (voiceText || '').trim(),
        kind: 'video',
      })
      setMomentOpen(false)
      if (id) { setPublished(circles.find(c => c.id === circleId)?.name || 'the circle'); setStatus('') }
      else setStatus('Publish returned no id — check you’re a member of that circle.')
    } catch (e: any) { setStatus('Publish failed: ' + (e?.message || e)) } finally { setBusy('') }
  }

  // ---- BF3: publish the exported video to Buffer -> Instagram ----
  async function openBufferPicker() {
    if (!lastRender) { setStatus('Export the video first — Buffer sends the last render.'); return }
    if (!lastRender.publicUrl) { setStatus('Connect Supabase — Buffer needs the render on a public URL.'); return }
    if (lastRender.ext !== 'mp4') { setStatus('This browser exported .webm, not .mp4 — Instagram requires MP4. Try exporting from Chrome.'); return }
    setBufferOpen(o => !o)
    if (!bufChannelsLoaded) {
      const list = await listBufferChannels()
      setBufChannels(list); setBufChannelsLoaded(true)
      const ig = list.find(c => c.service === 'instagram') || list[0]
      if (ig && !bufChannelId) setBufChannelId(ig.id)
    }
  }

  async function doPublishBuffer() {
    if (!bufChannelId || !lastRender?.publicUrl) return
    setBusy('buffer')
    try {
      const r = await publishVideoToBuffer({ channelId: bufChannelId, text: (voiceText || '').trim(), videoUrl: lastRender.publicUrl, mode: bufMode, channelService: bufChannels.find(c => c.id === bufChannelId)?.service })
      setBufferOpen(false)
      setBufferDone({ channel: bufChannels.find(c => c.id === bufChannelId)?.name || 'Instagram', mode: r.mode })
    } catch (e: any) {
      setBufferOpen(false)
      setBufferError(e?.message || String(e))
    } finally { setBusy('') }
  }

  // ---- timeline model ----
  const tracks = useMemo(() => {
    const P = project
    const layerClips = (type: string) => P.layers.filter((l: any) => l.type === type).map((l: any) => ({ kind: 'layer' as const, id: l.id, start: l.start || 0, dur: l.dur || P.duration, label: l.type === 'text' ? (l.text || 'text').replace(/\n/g, ' ').slice(0, 18) : l.name, peaks: l.peaks }))
    const audioClips = (k: string) => P.audio.filter((a: any) => a.kind === k).map((a: any) => ({ kind: 'audio' as const, id: a.id, start: a.start || 0, dur: a.dur || 1, label: a.kind === 'voice' ? 'voice' : (a.cue || 'sfx') }))
    return [
      { key: 'text', label: 'Text', hue: HUE.text, clips: layerClips('text') },
      { key: 'image', label: 'Media', hue: HUE.image, clips: layerClips('image') },
      { key: 'caption', label: 'Captions', hue: HUE.caption, clips: layerClips('caption') },
      { key: 'waveform', label: 'Wave', hue: HUE.waveform, clips: layerClips('waveform') },
      { key: 'voice', label: 'Voice', hue: HUE.voice, clips: audioClips('voice') },
      { key: 'music', label: 'Music', hue: HUE.music, clips: audioClips('music') },
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
      {published && (
        <div className="vbx-modal-backdrop" onClick={() => setPublished(null)}>
          <div className="vbx-modal" onClick={e => e.stopPropagation()}>
            <div className="vbx-modal-icon"><Heart size={28} /></div>
            <h3>Published to {published} 🎉</h3>
            <p>Your video is now live in <b>KinetikCircle → Remember</b>. Family members will see it in the feed.</p>
            <button className="vbx-modal-btn" onClick={() => setPublished(null)}>Done</button>
          </div>
        </div>
      )}

      {bufferDone && (
        <div className="vbx-modal-backdrop" onClick={() => setBufferDone(null)}>
          <div className="vbx-modal" onClick={e => e.stopPropagation()}>
            <div className="vbx-modal-icon vbx-modal-icon--ig"><Instagram size={28} /></div>
            <h3>{bufferDone.mode === 'shareNow' ? 'Published to' : 'Queued to'} {bufferDone.channel} 🎉</h3>
            <p>
              Video sent to <b>Buffer</b>
              {bufferDone.mode === 'shareNow' ? ' and published now.' : bufferDone.mode === 'shareNext' ? ' for the next queue slot.' : ' — review & approve it in your Buffer queue, and it goes to Instagram.'}
            </p>
            <a className="vbx-modal-btn" href="https://publish.buffer.com" target="_blank" rel="noopener noreferrer" onClick={() => setBufferDone(null)}>Open Buffer</a>
          </div>
        </div>
      )}

      {bufferError && (
        <div className="vbx-modal-backdrop" onClick={() => setBufferError(null)}>
          <div className="vbx-modal" onClick={e => e.stopPropagation()}>
            <div className="vbx-modal-icon vbx-modal-icon--err"><X size={28} /></div>
            <h3>Buffer didn’t accept it</h3>
            <p><b>Buffer said:</b><br /><span className="vbx-modal-err">{bufferError}</span></p>
            <button className="vbx-modal-btn" onClick={() => setBufferError(null)}>Got it</button>
          </div>
        </div>
      )}
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
        <button className={'vbx-directorbtn' + (dirOpen ? ' on' : '')} onClick={() => setDirOpen((o) => !o)}>
          <Sparkles size={14} /> Arganta Core
        </button>
        <div className="vbx-momentwrap">
          <button className="vbx-moment" disabled={busy !== '' || !lastRender} title={lastRender ? 'Publish the last export to a KinetikCircle → Remember feed' : 'Export a video first'} onClick={openMomentPicker}>
            <Heart size={14} /> {busy === 'moment' ? 'Publishing…' : 'Publish to Moment'}
          </button>
          {momentOpen && (
            <div className="vbx-momentpop">
              <div className="vbx-momenthead"><Users size={13} /> Publish to circle</div>
              {!cloudEnabled ? (
                <p className="vbx-mini">Connect Supabase & sign in as a circle member.</p>
              ) : circles.length === 0 ? (
                <p className="vbx-mini">{circlesLoaded ? 'No circles you can post into.' : 'Loading circles…'}</p>
              ) : (
                <>
                  <select className="vbx-sel" value={circleId} onChange={e => setCircleId(e.target.value)}>
                    {circles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="vbx-mini">The last export → one video moment.</p>
                  <button className="vbx-btn accent" disabled={busy !== '' || !circleId} onClick={doPublishMoment}>
                    <Heart size={12} /> {busy === 'moment' ? 'Publishing…' : 'Publish now'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {bufferEnabled && (
          <div className="vbx-momentwrap">
            <button className="vbx-buffer" disabled={busy !== '' || !lastRender} title={lastRender ? 'Publish this video to Instagram via Buffer' : 'Export a video first'} onClick={openBufferPicker}>
              <Instagram size={14} /> {busy === 'buffer' ? 'Publishing…' : 'Send to Buffer'}
            </button>
            {bufferOpen && (
              <div className="vbx-momentpop">
                <div className="vbx-momenthead"><Send size={13} /> Publish via Buffer</div>
                {bufChannels.length === 0 ? (
                  <p className="vbx-mini">{bufChannelsLoaded ? 'No connected channels — add one in Buffer.' : 'Loading channels…'}</p>
                ) : (
                  <>
                    <select className="vbx-sel" value={bufChannelId} onChange={e => setBufChannelId(e.target.value)}>
                      {bufChannels.map(c => <option key={c.id} value={c.id}>{c.name} · {c.service}</option>)}
                    </select>
                    <div className="vbx-row" style={{ gap: 4 }}>
                      {([['addToQueue', 'Queue'], ['shareNext', 'Next slot'], ['shareNow', 'Now']] as const).map(([m, label]) => (
                        <span key={m} className={'vbx-chip' + (bufMode === m ? ' on' : '')} onClick={() => setBufMode(m)}>{label}</span>
                      ))}
                    </div>
                    <p className="vbx-mini">The last export → {bufMode === 'shareNow' ? 'publishes now' : bufMode === 'shareNext' ? 'next queue slot' : 'added to your Buffer queue to review'}.</p>
                    <button className="vbx-btn accent" disabled={busy !== '' || !bufChannelId} onClick={doPublishBuffer}>
                      <Instagram size={12} /> {busy === 'buffer' ? 'Publishing…' : bufMode === 'shareNow' ? 'Publish now' : 'Send to Buffer'}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <button className="vbx-export" disabled={busy !== ''} onClick={doExport}>
          <Download size={14} /> {busy === 'export' ? `Rendering ${Math.round(exportPct * 100)}%` : 'Export video'}
        </button>
      </div>

      <div className="vbx-main">
        <div className="vbx-stage">
          <span className="vbx-stagebadge">{fmtDef.label} · {fmtDef.w}×{fmtDef.h} · {fmtDef.aspect}</span>

          {dirOpen && (
            <div className="vbx-dir">
              <div className="vbx-dir-head">
                <Sparkles size={14} /> <b>Arganta Core</b>
                <span className="vbx-dir-tag">{coreEnabled ? 'Cloudflare · live' : aiLive ? 'AI connected' : 'local mode'}</span>
                {coreEnabled && (
                  <button className={'vbx-ic vbx-imgtoggle' + (genImages ? ' on' : '')} title={genImages ? 'Generating images: on' : 'Generating images: off'} onClick={() => setGenImages(v => !v)} aria-label="Toggle image generation">
                    <Sparkles size={14} />
                  </button>
                )}
                <button className="vbx-ic" onClick={() => setDirOpen(false)} aria-label="Close"><X size={14} /></button>
              </div>
              <div className="vbx-dir-msgs">
                {dirMsgs.map((m, i) => (
                  <div key={i} className={'vbx-dir-msg ' + m.role}>
                    <div className="bubble" dangerouslySetInnerHTML={{ __html: m.text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_\((.+?)\)_/g, '<span class="via">($1)</span>') }} />
                  </div>
                ))}
                {dirBusy && <div className="vbx-dir-msg agent"><div className="bubble"><span className="vbx-dots"><i /><i /><i /></span></div></div>}
              </div>
              <div className="vbx-dir-quick">
                {['30s reel about our family calendar app, upbeat', 'short: 3 tips to plan a family week', 'long explainer: how our diamond rewards work'].map((q) => (
                  <button key={q} className="vbx-chip" disabled={dirBusy} onClick={() => runCore(q)}>{q.split(':')[0].split(' about')[0].slice(0, 22)}</button>
                ))}
              </div>
              <div className="vbx-dir-input">
                <input value={dirPrompt} disabled={dirBusy} placeholder="Describe your video…"
                  onChange={(e) => setDirPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && dirPrompt.trim()) runCore(dirPrompt.trim()) }} />
                <button className="vbx-dir-send" disabled={dirBusy || !dirPrompt.trim()} onClick={() => runCore(dirPrompt.trim())} aria-label="Send"><Send size={14} /></button>
              </div>
            </div>
          )}

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
            <div className="vbx-ph"><Cloud size={13} /> Media · Supabase<span className="badge">{cloudEnabled ? 'video-assets' : 'offline'}</span></div>
            <div className="vbx-row">
              <button className="vbx-btn accent" onClick={() => fileRef.current?.click()} disabled={mediaBusy}><Upload size={12} /> Upload</button>
              <input className="vbx-sel" value={impQuery} onChange={(e) => setImpQuery(e.target.value)} placeholder="stock search…" />
            </div>
            <div className="vbx-chipwrap">
              <button className="vbx-chip vbx-cue" disabled={mediaBusy} onClick={() => doImportStock('pexels', 'image')}><Sparkles size={11} /> Pexels photos</button>
              <button className="vbx-chip vbx-cue" disabled={mediaBusy} onClick={() => doImportStock('pixabay', 'image')}>Pixabay</button>
              <button className="vbx-chip vbx-cue" disabled={mediaBusy} onClick={() => doImportStock('pexels', 'video')}>Pexels video</button>
            </div>
            <div className="vbx-chipwrap">
              {(['all', 'image', 'audio', 'video'] as const).map((k) => (
                <span key={k} className={'vbx-chip' + (assetKind === k ? ' on' : '')} onClick={() => setAssetKind(k)}>{k}</span>
              ))}
            </div>
            {assets.length > 0 ? (
              <div className="vbx-mediagrid">
                {assets.map((a) => (
                  <button key={a.id} className="vbx-mediaitem" title={a.name + (a.attribution ? ' · ' + a.attribution : '')} onClick={() => useAsset(a)}
                    style={{ ['--cc' as any]: (HUE as any)[a.kind] || HUE.image }}>
                    {a.kind === 'image' && a.thumb ? <img src={a.thumb} alt={a.name} /> : <span className="mi-ph">{a.kind === 'audio' ? '♪' : a.kind === 'video' ? '▶' : a.kind}</span>}
                  </button>
                ))}
              </div>
            ) : <span className="vbx-mini">{cloudEnabled ? 'No assets yet — Upload or import stock.' : 'Offline — connect Supabase (run migration_video_assets.sql) to browse your library. Upload still works locally.'}</span>}
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

      <input ref={fileRef} type="file" accept="image/*,audio/*,video/*" style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.currentTarget.value = '' }} />
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

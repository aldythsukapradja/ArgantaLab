import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { scaleLog, scaleLinear } from 'd3-scale'
import { rgb } from 'd3-color'
import { createMasterChain, scheduleTone, scheduleNoise } from '@arganta/audio'
import { fft, hann } from './fft'

// The "scope" stage — a hardware-style oscilloscope panel that now FOLLOWS the
// app's light/dark theme (grid, text, spectrogram colormap all read theme
// tokens live). Four real views of the actual synthesized cue:
//   Waveform    — OfflineAudioContext renders the REAL samples (incl. reverb
//                 tail) through the exact same @arganta/audio engine the game plays.
//   Spectrogram — a real STFT (Hann 1024/256), log-frequency mapped, coloured
//                 through a theme-aware LUT (fades to panel bg at low energy).
//   Spectrum    — a live AnalyserNode FFT read every frame during playback.
//   Radial      — the same live FFT as a reactive ring.
// Playback is exposed via an imperative `play()` handle so the roster row
// buttons and the scope's own button drive the SAME audio context + animation
// (one sound, the chart always animates — no more desynced double-playback).

type Layer = Record<string, any>
type Mode = 'wave' | 'spectro' | 'spectrum' | 'radial'
export interface ScopeHandle { play: (recipeOverride?: Layer[]) => void }

function recipeDuration(recipe: Layer[]) {
  let end = 0
  for (const l of recipe) end = Math.max(end, (l.delay || 0) + (l.t ?? 0.12) + (l.reverb ? 1.2 : 0))
  return Math.max(0.3, end)
}

async function renderSamples(recipe: Layer[]): Promise<Float32Array> {
  const dur = recipeDuration(recipe)
  const sr = 44100
  const offline = new OfflineAudioContext(1, Math.ceil(sr * (dur + 0.05)), sr)
  const { master, reverbBus } = createMasterChain(offline, 0.85)
  for (const l of recipe) (l.kind === 'noise' ? scheduleNoise : scheduleTone)(offline, master, reverbBus, l)
  const buf = await offline.startRendering()
  return buf.getChannelData(0)
}

type Stft = { mags: Float32Array; frames: number; bins: number }
// STFT magnitudes (0..1 normalized from dB) computed ONCE per cue. Colouring is
// separate (buildBitmap) so a theme flip only re-colours — no re-FFT.
function computeStft(samples: Float32Array): Stft {
  const N = 1024, hop = 256
  const win = hann(N)
  const bins = N / 2
  const frames = Math.max(1, Math.floor((samples.length - N) / hop) + 1)
  const mags = new Float32Array(frames * bins)
  const re = new Float64Array(N), im = new Float64Array(N)
  for (let f = 0; f < frames; f++) {
    const off = f * hop
    for (let i = 0; i < N; i++) { re[i] = (samples[off + i] || 0) * win[i]; im[i] = 0 }
    fft(re, im)
    for (let k = 0; k < bins; k++) {
      const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k])
      const db = 20 * Math.log10(mag + 1e-9)
      mags[f * bins + k] = Math.max(0, Math.min(1, (db + 90) / 90))
    }
  }
  return { mags, frames, bins }
}

// A 256-entry colour LUT from the current theme. Low energy → panel bg (so the
// spectrogram fades seamlessly into the stage on either theme); high energy →
// accent → cyan → magenta. One ramp works both themes because --bg2 flips.
function themeLut(): Uint8ClampedArray {
  const cs = getComputedStyle(document.documentElement)
  const t = (n: string, f: string) => cs.getPropertyValue(n).trim() || f
  const cmap = scaleLinear<string>()
    .domain([0, 0.35, 0.65, 1])
    .range([t('--bg2', '#0b0b14'), t('--acc', '#6366f1'), t('--mbf-mel', '#0ea5a3'), t('--mag', '#ff3d72')])
    .clamp(true)
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const c = rgb(cmap(i / 255))
    lut[i * 3] = c.r; lut[i * 3 + 1] = c.g; lut[i * 3 + 2] = c.b
  }
  return lut
}

function buildBitmap(stft: Stft): HTMLCanvasElement {
  const { mags, frames, bins } = stft
  const lut = themeLut()
  const img = document.createElement('canvas')
  img.width = Math.max(1, frames); img.height = bins
  const ig = img.getContext('2d')!
  const id = ig.createImageData(img.width, bins)
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < bins; k++) {
      const v = mags[f * bins + k]
      const li = (Math.max(0, Math.min(1, v)) * 255) | 0
      const y = bins - 1 - k, idx = (y * img.width + f) * 4
      id.data[idx] = lut[li * 3]; id.data[idx + 1] = lut[li * 3 + 1]; id.data[idx + 2] = lut[li * 3 + 2]; id.data[idx + 3] = 255
    }
  }
  ig.putImageData(id, 0, 0)
  return img
}

export const Scope = forwardRef<ScopeHandle, { recipe: Layer[] }>(function Scope({ recipe }, ref) {
  const [mode, setMode] = useState<Mode>('wave')
  const [playing, setPlaying] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const samplesRef = useRef<Float32Array | null>(null)
  const stftRef = useRef<Stft | null>(null)
  const spectroRef = useRef<HTMLCanvasElement | null>(null)
  const liveCtxRef = useRef<AudioContext | null>(null)
  const playRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode; start: number; dur: number; freq: Uint8Array } | null>(null)
  const rafRef = useRef<number>(0)
  const debounceRef = useRef<number>(0)
  const modeRef = useRef<Mode>(mode); modeRef.current = mode

  function tok(name: string, fallback: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  }

  // Re-render offline samples + STFT when the recipe changes (debounced so a
  // slider drag doesn't thrash the offline render).
  useEffect(() => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(async () => {
      const samples = await renderSamples(recipe)
      samplesRef.current = samples
      stftRef.current = computeStft(samples)
      spectroRef.current = buildBitmap(stftRef.current)
      draw(null)
    }, 140)
    return () => window.clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(recipe)])

  useEffect(() => { draw(null) }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-colour the spectrogram + redraw when the theme flips (light/dark toggle
  // stamps data-theme on <html>; prefers-color-scheme covers the OS default).
  useEffect(() => {
    const onThemeChange = () => {
      if (stftRef.current) spectroRef.current = buildBitmap(stftRef.current)
      draw(playRef.current ? undefined as any : null)
    }
    const mo = new MutationObserver(onThemeChange)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener?.('change', onThemeChange)
    return () => { mo.disconnect(); mq.removeEventListener?.('change', onThemeChange) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => () => { window.cancelAnimationFrame(rafRef.current); playRef.current = null }, [])

  function sizeCanvas(c: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1
    const r = c.getBoundingClientRect()
    c.width = Math.max(1, r.width * dpr); c.height = Math.max(1, r.height * dpr)
    return dpr
  }

  function drawWave(cx: CanvasRenderingContext2D, W: number, H: number, playPos: number | null) {
    const mid = H / 2
    cx.strokeStyle = tok('--bd2', '#2c2c37'); cx.lineWidth = 1
    for (let i = 0; i <= 8; i++) { const x = (i / 8) * W; cx.beginPath(); cx.moveTo(x, 0); cx.lineTo(x, H); cx.stroke() }
    cx.beginPath(); cx.moveTo(0, mid); cx.lineTo(W, mid); cx.stroke()
    const samples = samplesRef.current
    if (!samples) { cx.fillStyle = tok('--tx3', '#888'); cx.font = '11px ui-monospace'; cx.fillText('rendering…', W / 2 - 40, mid); return }
    const grad = cx.createLinearGradient(0, 0, W, 0)
    grad.addColorStop(0, tok('--acc', '#6366f1')); grad.addColorStop(1, tok('--mbf-mel', '#0ea5a3'))
    cx.fillStyle = grad
    const n = samples.length
    for (let x = 0; x < W; x++) {
      const a = Math.floor((x / W) * n), b = Math.floor(((x + 1) / W) * n)
      let mn = 1, mx = -1
      for (let i = a; i < b; i++) { const v = samples[i]; if (v < mn) mn = v; if (v > mx) mx = v }
      if (b <= a) { mn = samples[a] || 0; mx = mn }
      const y1 = mid - mx * mid * 0.92, y2 = mid - mn * mid * 0.92
      cx.fillRect(x, y1, 1, Math.max(1, y2 - y1))
    }
    if (playPos != null) drawPlayhead(cx, W, H, playPos)
  }

  function drawSpectro(cx: CanvasRenderingContext2D, W: number, H: number, playPos: number | null) {
    cx.fillStyle = tok('--bg2', '#07070e'); cx.fillRect(0, 0, W, H)
    const bmp = spectroRef.current
    if (bmp) {
      const nyquist = 22050, bins = bmp.height
      const fScale = scaleLog().domain([60, nyquist]).range([H, 0]).clamp(true)
      cx.imageSmoothingEnabled = false
      for (let y = 0; y < H; y++) {
        const hz = fScale.invert(y)
        const bin = Math.max(0, Math.min(bins - 1, Math.round((hz / nyquist) * bins)))
        cx.drawImage(bmp, 0, bins - 1 - bin, bmp.width, 1, 0, y, W, 1)
      }
      cx.fillStyle = tok('--tx3', '#888'); cx.font = '9px ui-monospace'
      ;[8000, 4000, 2000, 1000, 500, 250, 100].forEach(hz => cx.fillText(hz >= 1000 ? hz / 1000 + 'k' : String(hz), 4, fScale(hz) + 9))
    } else { cx.fillStyle = tok('--tx3', '#888'); cx.font = '11px ui-monospace'; cx.fillText('rendering…', W / 2 - 40, H / 2) }
    if (playPos != null) drawPlayhead(cx, W, H, playPos)
  }

  function drawSpectrum(cx: CanvasRenderingContext2D, W: number, H: number) {
    cx.strokeStyle = tok('--bd2', '#2c2c37')
    for (let i = 0; i <= 6; i++) { const y = (i / 6) * H; cx.beginPath(); cx.moveTo(0, y); cx.lineTo(W, y); cx.stroke() }
    const data = playRef.current?.freq
    const acc = tok('--acc', '#6366f1'), mel = tok('--mbf-mel', '#2dd4bf')
    const bars = 64, bw = W / bars
    for (let i = 0; i < bars; i++) {
      const v = data ? data[Math.floor((i / bars) * data.length * 0.7)] / 255 : 0
      const h = v * H * 0.95
      const grad = cx.createLinearGradient(0, H, 0, H - h)
      grad.addColorStop(0, acc); grad.addColorStop(1, mel)
      cx.fillStyle = grad
      cx.fillRect(i * bw + 1, H - h, bw - 2, h)
    }
    if (!data) { cx.fillStyle = tok('--tx3', '#888'); cx.font = '11px ui-monospace'; cx.fillText('▶ press play — bars react to the live sound', W / 2 - 150, H / 2) }
  }

  function drawRadial(cx: CanvasRenderingContext2D, W: number, H: number) {
    const cxx = W / 2, cyy = H / 2, R = Math.min(W, H) * 0.22
    const data = playRef.current?.freq
    const bars = 96
    for (let i = 0; i < bars; i++) {
      const ang = (i / bars) * Math.PI * 2 - Math.PI / 2
      const v = data ? data[Math.floor((i / bars) * data.length * 0.6)] / 255 : 0.04
      const len = R * 0.5 + v * R * 1.4
      const x1 = cxx + Math.cos(ang) * R, y1 = cyy + Math.sin(ang) * R
      const x2 = cxx + Math.cos(ang) * len, y2 = cyy + Math.sin(ang) * len
      cx.strokeStyle = `hsl(${200 + v * 120},80%,${45 + v * 30}%)`
      cx.lineWidth = 3; cx.lineCap = 'round'
      cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.stroke()
    }
    cx.fillStyle = data ? tok('--tx', '#fff') : tok('--tx3', '#888')
    cx.font = '700 13px ui-sans-serif'; cx.textAlign = 'center'
    cx.fillText(data ? '♪' : '▶', cxx, cyy + 5); cx.textAlign = 'left'
  }

  function drawPlayhead(cx: CanvasRenderingContext2D, W: number, H: number, pos: number) {
    const px = pos * W
    const acc = tok('--acc', '#6366f1')
    const glow = cx.createLinearGradient(px - 30, 0, px, 0)
    glow.addColorStop(0, acc + '00'); glow.addColorStop(1, acc + '55')
    cx.fillStyle = glow; cx.fillRect(px - 30, 0, 30, H)
    cx.strokeStyle = tok('--tx', '#fff'); cx.lineWidth = 2
    cx.beginPath(); cx.moveTo(px, 0); cx.lineTo(px, H); cx.stroke()
    cx.fillStyle = tok('--tx', '#fff'); cx.beginPath(); cx.arc(px, H / 2, 4, 0, Math.PI * 2); cx.fill()
  }

  function draw(playPos: number | null) {
    const c = canvasRef.current; if (!c) return
    const dpr = sizeCanvas(c)
    const cx = c.getContext('2d')!; cx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const W = c.width / dpr, H = c.height / dpr
    cx.clearRect(0, 0, W, H)
    if (mode === 'wave') drawWave(cx, W, H, playPos)
    else if (mode === 'spectro') drawSpectro(cx, W, H, playPos)
    else if (mode === 'spectrum') drawSpectrum(cx, W, H)
    else drawRadial(cx, W, H)
  }

  function loop() {
    const p = playRef.current; if (!p) return
    const t = p.ctx.currentTime - p.start
    const pos = Math.min(1, t / p.dur)
    p.analyser.getByteFrequencyData(p.freq as Uint8Array<ArrayBuffer>)
    const m = modeRef.current
    draw((m === 'wave' || m === 'spectro') ? pos : null)
    if (t > p.dur + 0.3) { playRef.current = null; setPlaying(false); draw(null); return }
    rafRef.current = requestAnimationFrame(loop)
  }

  function play(recipeOverride?: Layer[]) {
    const r = recipeOverride && recipeOverride.length ? recipeOverride : recipe
    if (!liveCtxRef.current) liveCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    const ctx = liveCtxRef.current
    if (ctx.state === 'suspended') ctx.resume()
    const { master, reverbBus } = createMasterChain(ctx, 0.7)
    const analyser = ctx.createAnalyser(); analyser.fftSize = 256
    master.connect(analyser) // tap post-mastering signal for the visual (master already → destination)
    for (const l of r) (l.kind === 'noise' ? scheduleNoise : scheduleTone)(ctx, master, reverbBus, l)
    playRef.current = { ctx, analyser, start: ctx.currentTime, dur: recipeDuration(r), freq: new Uint8Array(analyser.frequencyBinCount) }
    setPlaying(true)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }

  useImperativeHandle(ref, () => ({ play }), [recipe]) // eslint-disable-line react-hooks/exhaustive-deps

  const modeLabel: Record<Mode, string> = {
    wave: 'rendered offline · real samples',
    spectro: 'STFT · Hann 1024 · log-freq',
    spectrum: 'live · AnalyserNode FFT',
    radial: 'live · reactive ring',
  }

  return (
    <div className="mbf-scope">
      <div className="mbf-scope-tabs">
        {(['wave', 'spectro', 'spectrum', 'radial'] as Mode[]).map(m => (
          <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
            {{ wave: 'Waveform', spectro: 'Spectrogram', spectrum: 'Live spectrum', radial: 'Radial' }[m]}
          </button>
        ))}
        <span className="rt">{modeLabel[mode]}</span>
        <button className={'mbf-scope-play' + (playing ? ' playing' : '')} onClick={() => play()} title="Play + animate">
          <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        </button>
      </div>
      <canvas ref={canvasRef} className="mbf-scope-canvas" />
    </div>
  )
})

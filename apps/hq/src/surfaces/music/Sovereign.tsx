// R2 — Audio Studio's sovereign layer: the Generate scope (Suno-shaped), the
// Renders feed (jobs + library, the "job never a modal" made visible), and the
// singleton PlayerBar that routes any track through the SHARED audio graph so
// the 3D stage dances to real MP3s, not just the synth. Sovereign-only: the
// only engine is local ComfyUI ACE-Step; offline falls back to a synth draft.
import { useEffect, useRef, useState } from 'react'
import { Sparkles, Play, Pause, Download, Loader2, AlertCircle, X } from 'lucide-react'
import { useJobStore, type Job } from '../../lib/jobStore'
import { listAudioAssets, signedAudioUrl, type AudioAsset } from '../../lib/audioLibrary'

const DURATIONS = [15, 30, 60, 120]
const badgeFor = (engine?: string) => (engine === 'comfyui-acestep' ? 'SOV' : engine === 'browser-record' ? 'GEN' : 'LIB')

// ── Generate scope ────────────────────────────────────────────────────────────
export function GeneratePanel({ onSpawn, onOfflineCompose, defaults }: {
  onSpawn: (spec: { tags: string; lyrics?: string; seconds: number; bpm?: number; keyscale?: string }) => void
  onOfflineCompose?: (prompt: string) => void
  defaults?: { bpm?: number; keyscale?: string }
}) {
  const [mode, setMode] = useState<'simple' | 'custom'>('simple')
  const [tags, setTags] = useState('')
  const [lyrics, setLyrics] = useState('')
  const [seconds, setSeconds] = useState(30)
  const [bpm, setBpm] = useState(defaults?.bpm ?? 120)
  const [keyscale, setKey] = useState(defaults?.keyscale ?? 'C major')
  const health = useComfyUp()

  const go = () => {
    if (!tags.trim()) return
    if (!health) { onOfflineCompose?.(tags.trim()); return }
    onSpawn(mode === 'custom'
      ? { tags: tags.trim(), lyrics: lyrics.trim() || undefined, seconds, bpm, keyscale }
      : { tags: tags.trim(), seconds })
  }

  return (
    <div className="msx-panel">
      <div className="msx-ph"><Sparkles size={13} /> Generate<span className="badge">ACE-Step · sovereign</span></div>
      <div className="seg sov-gen-seg" role="group">
        <button className={mode === 'simple' ? 'on' : ''} onClick={() => setMode('simple')}>Simple</button>
        <button className={mode === 'custom' ? 'on' : ''} onClick={() => setMode('custom')}>Custom</button>
      </div>
      <textarea className="sov-gen-prompt" value={tags} onChange={e => setTags(e.target.value)}
        placeholder={mode === 'simple' ? 'describe the song — “lofi, warm, rainy, mellow piano”' : 'style tags — “epic, orchestral, driving drums”'} />
      {mode === 'custom' && <>
        <textarea className="sov-gen-lyrics" value={lyrics} onChange={e => setLyrics(e.target.value)} placeholder="lyrics (optional — leave blank for instrumental)" />
        <div className="sov-gen-row">
          <label>BPM<input type="number" min={10} max={300} value={bpm} onChange={e => setBpm(+e.target.value)} /></label>
          <label>Key<input value={keyscale} onChange={e => setKey(e.target.value)} /></label>
        </div>
      </>}
      <div className="sov-gen-durs">
        {DURATIONS.map(d => <button key={d} className={'msx-chip' + (seconds === d ? ' on' : '')} onClick={() => setSeconds(d)}>{d}s</button>)}
      </div>
      <button className="sov-gen-btn" disabled={!tags.trim()} onClick={go}>
        {health ? <><Sparkles size={13} /> Render song</> : <>Compose draft (offline)</>}
      </button>
      <span className="msx-mini">{health ? `≈ ${Math.round(seconds * 0.8 + 8)}s on your GPU · lands in the feed` : 'ComfyUI offline — a synth draft will be composed instead'}</span>
    </div>
  )
}

function useComfyUp() {
  const [up, setUp] = useState(false)
  useEffect(() => {
    let alive = true
    import('../../lib/comfyClient').then(({ comfyHealth }) => comfyHealth().then(h => { if (alive) setUp(h.up && h.music.present) }))
    return () => { alive = false }
  }, [])
  return up
}

// ── Renders feed (jobs + library) ─────────────────────────────────────────────
export function RendersFeed({ onPlay, currentId }: { onPlay: (t: PlayTrack) => void; currentId?: string }) {
  const jobs = useJobStore(s => s.jobs.filter(j => j.kind === 'music'))
  const clear = useJobStore(s => s.clear)
  const [library, setLibrary] = useState<AudioAsset[]>([])
  const [filter, setFilter] = useState<'all' | 'music' | 'sfx' | 'voice'>('all')
  useEffect(() => { listAudioAssets().then(setLibrary) }, [jobs.filter(j => j.status === 'done').length])

  const libFiltered = filter === 'all' ? library : library.filter(a => a.kind === filter)
  const empty = jobs.length === 0 && libFiltered.length === 0

  return (
    <div className="sov-feed">
      <div className="sov-feed-head">
        <span className="sov-feed-title">Renders</span>
        <div className="sov-feed-filters">
          {(['all', 'music', 'sfx', 'voice'] as const).map(f =>
            <button key={f} className={'sov-feed-chip' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>{f}</button>)}
        </div>
      </div>
      <div className="sov-feed-list">
        {empty && <div className="sov-feed-empty">Nothing yet — describe a song in <b>Generate</b> and it lands here, playing.</div>}
        {jobs.map(j => <JobRow key={j.id} job={j} onPlay={onPlay} playing={currentId === j.id} onClear={() => clear(j.id)} />)}
        {libFiltered.map(a => <LibRow key={a.id} asset={a} onPlay={onPlay} playing={currentId === a.id} />)}
      </div>
    </div>
  )
}

function JobRow({ job, onPlay, playing, onClear }: { job: Job; onPlay: (t: PlayTrack) => void; playing: boolean; onClear: () => void }) {
  const done = job.status === 'done'
  const failed = job.status === 'failed'
  return (
    <div className={'sov-card' + (playing ? ' playing' : '') + (failed ? ' failed' : '')}>
      <button className="sov-card-play" disabled={!done} onClick={() => done && job.blobUrl && onPlay({ id: job.id, url: job.blobUrl, title: job.label, badge: 'SOV' })}>
        {done ? (playing ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 1 }} />)
          : failed ? <AlertCircle size={15} />
          : <Loader2 size={15} className="sov-spin" />}
      </button>
      <div className="sov-card-body">
        <div className="sov-card-name">{job.label}</div>
        <div className="sov-card-sub">
          {job.status === 'queued' && <span>queued{job.queuePos ? ` · #${job.queuePos}` : ''}</span>}
          {job.status === 'rendering' && <span>rendering{job.pct != null ? ` · ${job.pct}%` : '…'}</span>}
          {done && <span className="sov-badge sov-sov">SOV</span>}
          {failed && <span className="sov-fail">{job.error?.slice(0, 60)}</span>}
        </div>
        {job.status === 'rendering' && <div className="sov-prog"><div style={{ width: `${job.pct ?? 8}%` }} /></div>}
      </div>
      {(done || failed) && <button className="sov-card-x" onClick={onClear} title="Remove from feed"><X size={13} /></button>}
    </div>
  )
}

function LibRow({ asset, onPlay, playing }: { asset: AudioAsset; onPlay: (t: PlayTrack) => void; playing: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const badge = badgeFor(asset.provider || undefined)
  const load = async () => {
    let u = url
    if (!u) { u = await signedAudioUrl(asset.storage_path); setUrl(u) }
    if (u) onPlay({ id: asset.id, url: u, title: asset.name, badge })
  }
  return (
    <div className={'sov-card' + (playing ? ' playing' : '')}>
      <button className="sov-card-play" onClick={load}>{playing ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 1 }} />}</button>
      <div className="sov-card-body">
        <div className="sov-card-name">{asset.name}</div>
        <div className="sov-card-sub">
          <span className={'sov-badge sov-' + badge.toLowerCase()}>{badge}</span>
          {asset.duration_sec ? <span>{Math.round(asset.duration_sec)}s</span> : null}
          <span className="sov-card-kind">{asset.kind}</span>
        </div>
      </div>
    </div>
  )
}

// ── Singleton PlayerBar ───────────────────────────────────────────────────────
export interface PlayTrack { id: string; url: string; title: string; badge: string }

export function PlayerBar({ track, ensureAudio, onBeforePlay, onEnded }: {
  track: PlayTrack | null
  ensureAudio: () => { ctx: AudioContext; master: GainNode } | null
  onBeforePlay: () => void   // stop the generative transport so two sources never fight
  onEnded: () => void
}) {
  const elRef = useRef<HTMLAudioElement>(null)
  const srcRef = useRef<MediaElementAudioSourceNode | null>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(0)

  // route the element through the shared master ONCE → the stage analyser reacts
  useEffect(() => {
    if (!track || !elRef.current) return
    onBeforePlay()
    const a = ensureAudio()
    if (a) {
      if (a.ctx.state === 'suspended') a.ctx.resume()
      if (!srcRef.current) {
        try { srcRef.current = a.ctx.createMediaElementSource(elRef.current); srcRef.current.connect(a.master) }
        catch { /* already connected */ }
      }
    }
    elRef.current.src = track.url
    elRef.current.play().then(() => setPlaying(true)).catch(() => {})
  }, [track?.id]) // eslint-disable-line

  if (!track) return null
  const toggle = () => {
    const el = elRef.current!; if (el.paused) { onBeforePlay(); el.play(); setPlaying(true) } else { el.pause(); setPlaying(false) }
  }
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
  return (
    <div className="sov-player">
      <audio ref={elRef} onTimeUpdate={e => setT((e.target as HTMLAudioElement).currentTime)}
        onLoadedMetadata={e => setDur((e.target as HTMLAudioElement).duration)}
        onEnded={() => { setPlaying(false); onEnded() }} />
      <button className="sov-player-play" onClick={toggle}>{playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 1 }} />}</button>
      <div className="sov-player-meta">
        <span className="sov-player-title">{track.title}</span>
        <span className={'sov-badge sov-' + track.badge.toLowerCase()}>{track.badge}</span>
      </div>
      <div className="sov-player-scrub" onClick={e => { const el = elRef.current!; const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); el.currentTime = ((e.clientX - r.left) / r.width) * dur }}>
        <div style={{ width: dur ? `${(t / dur) * 100}%` : 0 }} />
      </div>
      <span className="sov-player-time">{fmt(t)}/{fmt(dur)}</span>
      <a className="sov-player-dl" href={track.url} download={`${track.title}.mp3`} title="Download"><Download size={15} /></a>
    </div>
  )
}

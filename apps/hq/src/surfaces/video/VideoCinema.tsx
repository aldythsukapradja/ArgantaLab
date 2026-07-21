// V1 — Cinema tab: the Higgsfield "Cinema Studio" clone. A Camera Rack (move /
// lens / motion weight / look) compiles deterministically via cameraGrammar
// and renders through the same jobStore video pipeline as Generate — same
// single-flight GPU queue, same player/gallery primitives.
import { useState } from 'react'
import { Clapperboard, Shuffle, UserRound, X } from 'lucide-react'
import { useJobStore, type Job } from '../../lib/jobStore'
import { SovereignChip } from '../shared/SovereignChip'
import { PlayerView, EmptyStage, Gallery } from './shared'
import { compileShot, MOVES, LENSES, WEIGHTS, LOOKS, type CameraMove, type Lens, type MotionWeight, type Look } from './cameraGrammar'
import './video-cinema.css'

const PRESETS = [
  { id: 'draft', label: 'Draft', w: 384, h: 384, frames: 25, note: '~40s' },
  { id: 'social', label: 'Social', w: 480, h: 832, frames: 49, note: '~4min' },
  { id: 'wide', label: 'Wide', w: 640, h: 360, frames: 49, note: '~4min' },
] as const

export function VideoCinema({ initialPrompt, seedImage, onClearSeed, onSendToEdit }: {
  initialPrompt?: string; seedImage?: string; onClearSeed?: () => void; onSendToEdit?: (clip: { url: string; meta: any }) => void
}) {
  const spawn = useJobStore((s) => s.spawn)
  const clear = useJobStore((s) => s.clear)
  const jobs = useJobStore((s) => s.jobs.filter((j) => j.kind === 'video' && j.surface === 'video-cinema'))
  const [prompt, setPrompt] = useState(initialPrompt || '')
  const [move, setMove] = useState<CameraMove>('dolly-in')
  const [lens, setLens] = useState<Lens>('35mm')
  const [weight, setWeight] = useState<MotionWeight>('natural')
  const [look, setLook] = useState<Look>('clean')
  const [preset, setPreset] = useState<typeof PRESETS[number]>(PRESETS[0])
  const [seed, setSeed] = useState<number | ''>('')
  const [current, setCurrent] = useState<string | null>(null)

  const latest = jobs.find((j) => j.status === 'done') || jobs[0]
  const view = current ? jobs.find((j) => j.id === current) : latest

  function render(spec?: Partial<{ prompt: string; move: CameraMove; width: number; height: number; frames: number; seed: number }>) {
    const p = spec?.prompt ?? prompt.trim()
    if (!p) return
    const shot = compileShot({ move: spec?.move ?? move, lens, weight, look, prompt: p })
    const id = spawn({
      kind: 'video', label: `${MOVES.find((m) => m.id === (spec?.move ?? move))?.label} · ${p.slice(0, 36)}`, surface: 'video-cinema',
      spec: {
        prompt: shot.prompt, negative: shot.negative,
        width: spec?.width ?? preset.w, height: spec?.height ?? preset.h, frames: spec?.frames ?? preset.frames, fps: 24,
        seed: spec?.seed ?? (seed === '' ? undefined : seed),
        imageDataUrl: seedImage,
      },
    })
    setCurrent(id)
  }

  /** Re-run an EXISTING job's already-compiled spec verbatim (new seed) —
   * never re-feeds a compiled prompt back through compileShot(). */
  function rerun(job: Job, overrides?: Partial<{ width: number; height: number; frames: number }>) {
    const s = job.spec as any
    const id = spawn({
      kind: 'video', label: job.label, surface: 'video-cinema',
      spec: { prompt: s.prompt, negative: s.negative, width: overrides?.width ?? s.width, height: overrides?.height ?? s.height, frames: overrides?.frames ?? s.frames, fps: 24, seed: Math.floor(Math.random() * 1e9), imageDataUrl: s.imageDataUrl },
    })
    setCurrent(id)
  }

  return (
    <div className="vc">
      {/* left rail */}
      <div className="vc-rail">
        <div className="vc-rail-head"><Clapperboard size={14} /> Cinema<SovereignChip engine="video" compact /></div>

        {seedImage && (
          <div className="vc-source">
            <img src={seedImage} alt="Soul keyframe seed" />
            <div className="vc-source-info">
              <span><UserRound size={11} /> Soul keyframe seed</span>
              <span className="vc-source-hint">identity carries into the first frame</span>
            </div>
            {onClearSeed && <button className="vc-source-clear" onClick={onClearSeed} title="Use text-to-video instead"><X size={12} /></button>}
          </div>
        )}

        <textarea className="vc-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="describe the subject — “a lone figure standing on a cliff at sunset”" />

        <div className="vc-label">Move</div>
        <div className="vc-moves">
          {MOVES.map((m) => (
            <button key={m.id} className={'vc-move' + (move === m.id ? ' on' : '')} onClick={() => setMove(m.id)} title={m.clause}>
              <span className="vc-glyph">{m.glyph}</span><span>{m.label}</span>
            </button>
          ))}
        </div>

        <div className="vc-row3">
          <div>
            <div className="vc-label">Lens</div>
            <select value={lens} onChange={(e) => setLens(e.target.value as Lens)}>
              {LENSES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <div className="vc-label">Weight</div>
            <select value={weight} onChange={(e) => setWeight(e.target.value as MotionWeight)}>
              {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div>
            <div className="vc-label">Look</div>
            <select value={look} onChange={(e) => setLook(e.target.value as Look)}>
              {LOOKS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="vc-label">Preset</div>
        <div className="vg-presets">
          {PRESETS.map((p) => (
            <button key={p.id} className={'vg-preset' + (preset.id === p.id ? ' on' : '')} onClick={() => setPreset(p)}>
              <b>{p.label}</b><span>{p.w}×{p.h} · {p.frames}f</span><span className="vg-est">{p.note}</span>
            </button>
          ))}
        </div>
        <div className="vg-seedrow">
          <label>Seed <input type="number" value={seed} onChange={(e) => setSeed(e.target.value === '' ? '' : +e.target.value)} placeholder="random" /></label>
          <button className="vg-shuffle" onClick={() => setSeed(Math.floor(Math.random() * 1e9))} title="Randomize"><Shuffle size={13} /></button>
        </div>
        <button className="vg-go" disabled={!prompt.trim()} onClick={() => render()}><Clapperboard size={14} /> Direct shot</button>
        <span className="vg-hint">Camera moves are prompt-compiled on sovereign Wan 2.2 — validate at Draft, then scale a keeper.</span>
      </div>

      {/* center player */}
      <div className="vg-stage">
        {view ? <PlayerView job={view} onRetryDraft={() => rerun(view, { width: 384, height: 384, frames: 25 })} /> : (
          <EmptyStage
            hint="Pick a camera move and describe the subject — Cinema compiles it into a directed shot."
            starters={['a lone figure standing on a cliff at sunset', 'a chef plating a dish in a dim kitchen', 'a car parked on an empty desert highway']}
            onStart={(s) => { setPrompt(s); render({ prompt: s }) }}
          />
        )}
      </div>

      {/* generations gallery */}
      <Gallery jobs={jobs} activeId={view?.id} onOpen={setCurrent}
        onSendToEdit={onSendToEdit ? (j: Job) => onSendToEdit({ url: j.blobUrl!, meta: j.meta }) : undefined}
        onVariation={(j: Job) => rerun(j)}
        onClear={clear}
        onRetryDraft={(j: Job) => rerun(j, { width: 384, height: 384, frames: 25 })}
      />
    </div>
  )
}

// R3 — Video Studio's Generate mode (Runway-shaped): a prompt rail, the latest
// generation as a looping player, and a generations gallery. Every clip is a
// sovereign Wan 2.2 render through the R1 jobStore, so it survives mode/surface
// switches and single-flights the GPU. 8GB-honest presets; OOM → one-tap retry
// at Draft. "Send to Edit" hands a clip to the timeline.
// V0: player/card/gallery extracted to shared.tsx (byte-identical behavior).
import { useState } from 'react'
import { Sparkles, Shuffle } from 'lucide-react'
import { useJobStore, type Job } from '../../lib/jobStore'
import { SovereignChip } from '../shared/SovereignChip'
import { PlayerView, EmptyStage, Gallery } from './shared'
import './video-generate.css'

// presets named by INTENT, with estimates measured on the 3070 Ti (8GB).
const PRESETS = [
  { id: 'draft', label: 'Draft', w: 384, h: 384, frames: 25, note: '~40s' },
  { id: 'social', label: 'Social', w: 480, h: 832, frames: 49, note: '~4min' },
  { id: 'wide', label: 'Wide', w: 640, h: 360, frames: 49, note: '~4min' },
] as const

export function VideoGenerate({ onSendToEdit }: { onSendToEdit?: (clip: { url: string; meta: any }) => void }) {
  const spawn = useJobStore((s) => s.spawn)
  const clear = useJobStore((s) => s.clear)
  const jobs = useJobStore((s) => s.jobs.filter((j) => j.kind === 'video'))
  const [prompt, setPrompt] = useState('')
  const [preset, setPreset] = useState<typeof PRESETS[number]>(PRESETS[0])
  const [seed, setSeed] = useState<number | ''>('')
  const [current, setCurrent] = useState<string | null>(null)

  const latest = jobs.find((j) => j.status === 'done') || jobs[0]
  const view = current ? jobs.find((j) => j.id === current) : latest

  function render(spec?: Partial<{ prompt: string; width: number; height: number; frames: number; seed: number }>) {
    const p = spec?.prompt ?? prompt.trim()
    if (!p) return
    const id = spawn({
      kind: 'video', label: p.slice(0, 48), surface: 'video',
      spec: { prompt: p, width: spec?.width ?? preset.w, height: spec?.height ?? preset.h, frames: spec?.frames ?? preset.frames, fps: 24, seed: spec?.seed ?? (seed === '' ? undefined : seed) },
    })
    setCurrent(id)
  }

  return (
    <div className="vg">
      {/* left rail */}
      <div className="vg-rail">
        <div className="vg-rail-head"><Sparkles size={14} /> Generate<SovereignChip engine="video" compact /></div>
        <textarea className="vg-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="describe the shot — “a calm ocean wave at golden hour, slow drift, cinematic”" />
        <div className="vg-label">Preset</div>
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
        <button className="vg-go" disabled={!prompt.trim()} onClick={() => render()}><Sparkles size={14} /> Render clip</button>
        <span className="vg-hint">Sovereign · Wan 2.2 5B on your GPU. Keep it small on 8GB — Draft first, then scale a keeper.</span>
      </div>

      {/* center player */}
      <div className="vg-stage">
        {view ? <PlayerView job={view} onRetryDraft={() => render({ prompt: view.label, width: 384, height: 384, frames: 25 })} /> : (
          <EmptyStage
            hint="Describe a shot and render it. Clips land in the gallery below — you keep working while the GPU renders."
            starters={['golden light through drifting clouds', 'neon rain on an empty street, slow pan', 'a candle flame flickering in the dark']}
            onStart={(s) => { setPrompt(s); render({ prompt: s }) }}
          />
        )}
      </div>

      {/* generations gallery */}
      <Gallery jobs={jobs} activeId={view?.id} onOpen={setCurrent}
        onSendToEdit={onSendToEdit ? (j: Job) => onSendToEdit({ url: j.blobUrl!, meta: j.meta }) : undefined}
        onVariation={(j: Job) => render({ prompt: j.label, width: (j.spec as any).width, height: (j.spec as any).height, frames: (j.spec as any).frames })}
        onClear={clear}
        onRetryDraft={(j: Job) => render({ prompt: j.label, width: 384, height: 384, frames: 25 })}
      />
    </div>
  )
}

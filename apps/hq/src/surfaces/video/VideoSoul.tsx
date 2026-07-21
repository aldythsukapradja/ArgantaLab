// V2 — Soul tab: character identity manager. Keyframe forge renders SD1.5 +
// character-LoRA stills (comfySoulImage, LoRA-only mode — see comfyClient.ts);
// approved keyframes save to the media library tagged soul:<id> and become the
// i2v seed for Cinema in V3. Identity test matrix renders the 8-prompt
// consistency sheet from souls.ts for founder sign-off.
import { useState } from 'react'
import { UserRound, Sparkles, Loader2, AlertCircle, Check, Grid3x3, Clapperboard } from 'lucide-react'
import { uploadAsset } from '@arganta/video'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { useJobStore, type Job } from '../../lib/jobStore'
import { SovereignChip } from '../shared/SovereignChip'
import { SOULS, STYLE_PRESETS, POSE_PRESETS, identityTestPrompts } from './souls'
import './video-soul.css'

export function VideoSoul({ onAnimate }: { onAnimate?: (imageUrl: string) => void }) {
  const soul = SOULS[0]
  const spawn = useJobStore((s) => s.spawn)
  const clear = useJobStore((s) => s.clear)
  const jobs = useJobStore((s) => s.jobs.filter((j) => j.kind === 'soul'))
  const [prompt, setPrompt] = useState('')
  const [style, setStyle] = useState(STYLE_PRESETS[0].id)
  const [pose, setPose] = useState(POSE_PRESETS[0].id)
  const [note, setNote] = useState('')
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set())

  function compile(p?: string) {
    const styleClause = STYLE_PRESETS.find((s) => s.id === style)?.clause || ''
    const poseClause = POSE_PRESETS.find((s) => s.id === pose)?.clause || ''
    return [p ?? prompt.trim(), poseClause, styleClause].filter(Boolean).join(', ')
  }

  function render(p?: string) {
    const compiled = compile(p)
    if (!compiled) return
    spawn({ kind: 'soul', label: compiled.slice(0, 48), surface: 'video-soul', spec: { prompt: compiled } })
  }

  function renderIdentityMatrix() {
    for (const p of identityTestPrompts()) spawn({ kind: 'soul', label: p.slice(0, 48), surface: 'video-soul', spec: { prompt: `${p}` } })
  }

  async function approve(job: Job) {
    if (!job.blobUrl) return
    if (!cloudEnabled) { setNote('Sign in to save keyframes to the media library.'); setTimeout(() => setNote(''), 4000); return }
    try {
      const blob = await (await fetch(job.blobUrl)).blob()
      const file = new File([blob], `soul-${soul.id}-${Date.now().toString(36)}.png`, { type: 'image/png' })
      await uploadAsset(supabase, file, { kind: 'image', source: 'comfyui-soul-lora' })
      setApprovedIds((s) => new Set(s).add(job.id))
      setNote('Keyframe saved to the media library.')
    } catch (e: any) { setNote(`Couldn’t save: ${e?.message || e}`) }
    setTimeout(() => setNote(''), 4000)
  }

  return (
    <div className="vsoul">
      <div className="vsoul-rail">
        <div className="vsoul-rail-head"><UserRound size={14} /> Soul<SovereignChip engine="soul" compact /></div>

        <div className="vsoul-card">
          <div className="vsoul-card-name">{soul.name}</div>
          <div className="vsoul-card-meta">trigger · <code>{soul.triggerToken}</code></div>
          <div className={'vsoul-card-status ' + soul.status}>{soul.status === 'approved' ? 'Approved' : 'Draft'}</div>
        </div>

        <textarea className="vg-prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)}
          placeholder="describe the shot — “standing on a rooftop at dusk”" />

        <div className="vg-label">Pose</div>
        <select value={pose} onChange={(e) => setPose(e.target.value)}>
          {POSE_PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <div className="vg-label">Style</div>
        <select value={style} onChange={(e) => setStyle(e.target.value)}>
          {STYLE_PRESETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>

        <button className="vg-go" disabled={!prompt.trim()} onClick={() => render()}><Sparkles size={14} /> Forge keyframe</button>
        <button className="vsoul-matrix" onClick={renderIdentityMatrix}><Grid3x3 size={13} /> Render identity test matrix (8)</button>
        {note && <span className="vs-note">{note}</span>}
        <span className="vg-hint">SD1.5 + {soul.name} character LoRA (LoRA-only mode). Needs the trained LoRA present in ComfyUI's loras/ folder.</span>
      </div>

      <div className="vsoul-grid">
        {jobs.length === 0 && <div className="vg-gallery-empty">no keyframes yet</div>}
        {jobs.map((j) => (
          <div key={j.id} className="vsoul-tile">
            {j.status === 'done' && j.blobUrl ? <img src={j.blobUrl} alt={j.label} /> : j.status === 'failed' ? (
              <div className="vsoul-tile-err"><AlertCircle size={16} /><span>{j.error?.slice(0, 80)}</span></div>
            ) : <div className="vsoul-tile-loading"><Loader2 size={16} className="vg-spin" /></div>}
            <div className="vsoul-tile-cap">{j.label}</div>
            {j.status === 'done' && (
              <div className="vsoul-tile-acts">
                <button onClick={() => approve(j)} disabled={approvedIds.has(j.id)}>
                  {approvedIds.has(j.id) ? <><Check size={11} /> Approved</> : 'Approve as keyframe'}
                </button>
                {onAnimate && j.blobUrl && <button onClick={() => onAnimate(j.blobUrl!)} title="Animate in Cinema"><Clapperboard size={11} /></button>}
                <button onClick={() => clear(j.id)}>×</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

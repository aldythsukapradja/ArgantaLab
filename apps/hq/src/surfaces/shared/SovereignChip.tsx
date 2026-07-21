// SovereignChip (R1) — the shared "is my GPU ready" indicator for every studio
// top bar + Media Center. Four honest states, a popover with per-engine detail,
// and a test-render button. Polls comfyHealth on an interval with backoff when
// offline so a missing ComfyUI never spams the console.
import { useEffect, useRef, useState } from 'react'
import { comfyHealth, comfyUrl, setComfyUrl, type ComfyHealth, type EngineKind } from '../../lib/comfyClient'
import { useJobStore } from '../../lib/jobStore'
import './sovereign-chip.css'

type Engine = { kind: EngineKind; label: string }
const ENGINES: Engine[] = [
  { kind: 'image', label: 'Image' },
  { kind: 'music', label: 'Music' },
  { kind: 'video', label: 'Video' },
  { kind: 'soul', label: 'Soul' },
]

/** `engine` narrows the chip to one modality's readiness (a studio only cares
 * about its own); omit for the full rack (Media Center). */
export function SovereignChip({ engine, compact = false }: { engine?: EngineKind; compact?: boolean }) {
  const [health, setHealth] = useState<ComfyHealth | null>(null)
  const [open, setOpen] = useState(false)
  const [urlDraft, setUrlDraft] = useState(comfyUrl())
  const [testing, setTesting] = useState<EngineKind | null>(null)
  const spawn = useJobStore((s) => s.spawn)
  const activeJobs = useJobStore((s) => s.jobs.filter((j) => j.status === 'rendering' || j.status === 'queued').length)
  const failRef = useRef(0)

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    const tick = async () => {
      const h = await comfyHealth()
      if (!alive) return
      setHealth(h)
      failRef.current = h.up ? 0 : Math.min(failRef.current + 1, 4)
      const delay = h.up ? 30_000 : 30_000 * Math.pow(2, failRef.current) // backoff when down, cap ~8min
      timer = setTimeout(tick, Math.min(delay, 480_000))
    }
    tick()
    return () => { alive = false; clearTimeout(timer) }
  }, [])

  // state resolution
  const relevant: Engine[] = engine ? ENGINES.filter((e) => e.kind === engine) : ENGINES
  const modelPresent = health?.up && relevant.every((e) => health[e.kind].present)
  const state: 'offline' | 'partial' | 'ready' = !health?.up ? 'offline' : modelPresent ? 'ready' : 'partial'
  const busy = activeJobs > 0
  const label = state === 'ready' ? 'Sovereign' : state === 'partial' ? 'Partial' : 'Offline'

  function runTest(kind: EngineKind) {
    setTesting(kind)
    const spec = kind === 'image' ? { prompt: 'arganta test tile, luminous', width: 512, height: 512 }
      : kind === 'music' ? { tags: 'test, warm, short', seconds: 8 }
      : kind === 'soul' ? { prompt: 'front-facing close-up portrait, neutral expression' }
      : { prompt: 'a soft light drift, test', width: 320, height: 320, frames: 17 }
    spawn({ kind, label: `Test ${kind}`, spec, surface: 'rack' })
    setTimeout(() => setTesting(null), 1500)
  }

  return (
    <div className="sov-chip-wrap">
      <button
        className={`sov-chip sov-${state}${busy ? ' sov-busy' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title={`Sovereign engines · ${label}`}
      >
        <span className="sov-dot" />
        {!compact && <span className="sov-label">{label}</span>}
        {busy && <span className="sov-count">{activeJobs}</span>}
      </button>

      {open && (
        <>
          <div className="sov-scrim" onClick={() => setOpen(false)} />
          <div className="sov-pop" role="dialog" aria-label="Sovereign engines">
            <div className="sov-pop-head">
              <b>Sovereign engines</b>
              <span className={`sov-pop-state sov-${state}`}>{label}</span>
            </div>
            {!health?.up && (
              <div className="sov-pop-offline">
                ComfyUI is not reachable. Start it — <code>start-comfyui.bat</code> — then it appears here.
              </div>
            )}
            {relevant.map((e) => {
              const h = health?.[e.kind]
              const ok = health?.up && h?.present
              return (
                <div key={e.kind} className="sov-pop-row">
                  <span className={`sov-dot sov-${ok ? 'ready' : health?.up ? 'partial' : 'offline'}`} />
                  <span className="sov-pop-name">{e.label}</span>
                  <span className="sov-pop-model" title={h?.model}>
                    {ok ? (h?.model || 'ready') : health?.up ? 'model missing' : '—'}
                  </span>
                  <button className="sov-test" disabled={!ok || testing === e.kind} onClick={() => runTest(e.kind)}>
                    {testing === e.kind ? '…' : 'Test'}
                  </button>
                </div>
              )
            })}
            {health?.up && (
              <div className="sov-pop-stats">
                {health.vramFreeGB != null && <span>{health.vramFreeGB.toFixed(1)} GB free</span>}
                <span>queue {health.queueDepth ?? 0}</span>
              </div>
            )}
            <div className="sov-pop-url">
              <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="http://127.0.0.1:8188" />
              <button onClick={() => { setComfyUrl(urlDraft); setHealth(null); comfyHealth().then(setHealth) }}>Set</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

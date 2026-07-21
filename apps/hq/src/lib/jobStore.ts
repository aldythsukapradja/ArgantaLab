// jobStore — the app-level home for sovereign render jobs (R1). The core law of
// the studio redesign: "generation is a JOB, never a modal." A job lives here,
// not in a component, so it survives surface switches, and the feed/gallery just
// renders the jobs it cares about. Heavy engines (music/video) run single-file
// through a client-side queue so two presses never OOM the 8GB card; image may
// interleave. On completion the job holds the resulting blob (object URL) which
// the studio persists to its library.
import { create } from 'zustand'
import { comfyImage, comfyMusic, comfyVideo, comfySoulImage, type EngineKind, type RunResult } from './comfyClient'

export type JobStatus = 'queued' | 'rendering' | 'done' | 'failed'
export interface Job {
  id: string
  kind: EngineKind
  status: JobStatus
  label: string              // human summary (prompt snippet)
  spec: Record<string, unknown>
  pct?: number               // 0..100 while rendering (ws-driven)
  note?: string
  queuePos?: number
  startedAt: number
  endedAt?: number
  // result
  blobUrl?: string
  mime?: string
  meta?: Record<string, unknown>
  error?: string
  surface?: string           // which studio spawned it (for filtering/keying)
}

interface JobState {
  jobs: Job[]
  spawn: (args: { kind: EngineKind; label: string; spec: Record<string, unknown>; surface?: string }) => string
  cancel: (id: string) => void
  clear: (id: string) => void
  get: (id: string) => Job | undefined
}

const RUNNERS: Record<EngineKind, (spec: any, opts: any) => Promise<RunResult>> = {
  image: comfyImage, music: comfyMusic, video: comfyVideo, soul: comfySoulImage,
}
// image is light enough to interleave; music+video are heavy → single-flight.
const HEAVY: EngineKind[] = ['music', 'video']

const controllers = new Map<string, AbortController>()
let heavyChain: Promise<void> = Promise.resolve()

export const useJobStore = create<JobState>((set, get) => {
  const patch = (id: string, p: Partial<Job>) =>
    set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...p } : j)) }))

  async function execute(id: string) {
    const job = get().get(id)
    if (!job) return
    const ctrl = new AbortController()
    controllers.set(id, ctrl)
    patch(id, { status: 'rendering', note: 'starting' })
    try {
      const res = await RUNNERS[job.kind](job.spec, {
        signal: ctrl.signal,
        onProgress: (p: { pct?: number; note?: string; queuePos?: number }) => patch(id, p),
      })
      const blobUrl = URL.createObjectURL(res.blob)
      patch(id, { status: 'done', blobUrl, mime: res.mime, meta: res.meta, pct: 100, endedAt: Date.now(), note: undefined, queuePos: undefined })
    } catch (e: any) {
      const msg = e?.message || String(e)
      patch(id, { status: 'failed', error: msg, endedAt: Date.now(), note: undefined })
    } finally {
      controllers.delete(id)
    }
  }

  return {
    jobs: [],
    get: (id) => get().jobs.find((j) => j.id === id),
    spawn: ({ kind, label, spec, surface }) => {
      const id = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`
      const job: Job = { id, kind, status: 'queued', label, spec, startedAt: Date.now(), surface }
      set((s) => ({ jobs: [job, ...s.jobs] }))
      if (HEAVY.includes(kind)) {
        // chain heavy jobs so only one hits the GPU at a time
        heavyChain = heavyChain.then(() => execute(id)).catch(() => {})
      } else {
        void execute(id)
      }
      return id
    },
    cancel: (id) => {
      controllers.get(id)?.abort()
      const j = get().get(id)
      if (j && (j.status === 'queued' || j.status === 'rendering')) patch(id, { status: 'failed', error: 'cancelled', endedAt: Date.now() })
    },
    clear: (id) => {
      const j = get().get(id)
      if (j?.blobUrl) URL.revokeObjectURL(j.blobUrl)
      set((s) => ({ jobs: s.jobs.filter((x) => x.id !== id) }))
    },
  }
})

/** Selector helper: jobs for a surface (or all), newest first. */
export function selectJobs(surface?: string) {
  return (s: JobState) => surface ? s.jobs.filter((j) => j.surface === surface) : s.jobs
}

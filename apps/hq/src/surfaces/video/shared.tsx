// V0 — shared render primitives, extracted verbatim out of VideoGenerate so
// Cinema (V1) can reuse the same player/gallery/card without duplicating them.
// No behavior change from the original VideoGenerate.tsx.
import { Loader2, AlertCircle, Download, Scissors, Shuffle, X, Sparkles } from 'lucide-react'
import type { Job } from '../../lib/jobStore'

export const isOOM = (err?: string) => !!err && /oom|out of memory|alloc|cuda|reduce/i.test(err)

export function PlayerView({ job, onRetryDraft }: { job: Job; onRetryDraft: () => void }) {
  if (job.status === 'done' && job.blobUrl) {
    return <video className="vg-video" src={job.blobUrl} controls loop autoPlay muted />
  }
  if (job.status === 'failed') {
    return (
      <div className="vg-failed">
        <AlertCircle size={22} />
        <p>{job.error?.slice(0, 120) || 'render failed'}</p>
        {isOOM(job.error) && <button onClick={onRetryDraft}>Retry at Draft (smaller)</button>}
      </div>
    )
  }
  return (
    <div className="vg-rendering">
      <Loader2 size={22} className="vg-spin" />
      <p>{job.status === 'queued' ? `queued${job.queuePos ? ` · #${job.queuePos}` : ''}` : `rendering${job.pct != null ? ` · ${job.pct}%` : '…'}`}</p>
      <span>{job.label}</span>
    </div>
  )
}

export function EmptyStage({ hint, starters, onStart }: { hint: string; starters: string[]; onStart: (s: string) => void }) {
  return (
    <div className="vg-empty">
      <Sparkles size={26} />
      <p>{hint}</p>
      <div className="vg-starters">
        {starters.map((s) => <button key={s} onClick={() => onStart(s)}>{s}</button>)}
      </div>
    </div>
  )
}

export function VideoCard({ job, active, onOpen, onSendToEdit, onVariation, onClear, onRetryDraft }: {
  job: Job; active: boolean; onOpen: () => void; onSendToEdit?: () => void; onVariation: () => void; onClear: () => void; onRetryDraft: () => void
}) {
  const done = job.status === 'done'
  return (
    <div className={'vg-card' + (active ? ' active' : '') + (job.status === 'failed' ? ' failed' : '')} onClick={onOpen}>
      <div className="vg-card-thumb">
        {done && job.blobUrl ? <video src={job.blobUrl} muted loop onMouseEnter={(e) => (e.target as HTMLVideoElement).play()} onMouseLeave={(e) => (e.target as HTMLVideoElement).pause()} />
          : job.status === 'failed' ? <AlertCircle size={18} />
          : <Loader2 size={18} className="vg-spin" />}
        {job.status === 'rendering' && job.pct != null && <span className="vg-card-pct">{job.pct}%</span>}
      </div>
      <div className="vg-card-cap">{job.label}</div>
      {done && (
        <div className="vg-card-acts" onClick={(e) => e.stopPropagation()}>
          {onSendToEdit && <button onClick={onSendToEdit} title="Send to Edit"><Scissors size={12} /></button>}
          <button onClick={onVariation} title="Variation (new seed)"><Shuffle size={12} /></button>
          <a href={job.blobUrl} download={`${job.label}.mp4`} title="Download"><Download size={12} /></a>
        </div>
      )}
      {job.status === 'failed' && isOOM(job.error) && <button className="vg-card-retry" onClick={(e) => { e.stopPropagation(); onRetryDraft() }}>Retry Draft</button>}
      {(done || job.status === 'failed') && <button className="vg-card-x" onClick={(e) => { e.stopPropagation(); onClear() }}><X size={12} /></button>}
    </div>
  )
}

export function Gallery({ jobs, activeId, onOpen, onSendToEdit, onVariation, onClear, onRetryDraft }: {
  jobs: Job[]; activeId?: string; onOpen: (id: string) => void; onSendToEdit?: (job: Job) => void
  onVariation: (job: Job) => void; onClear: (id: string) => void; onRetryDraft: (job: Job) => void
}) {
  return (
    <div className="vg-gallery">
      {jobs.length === 0 && <div className="vg-gallery-empty">no clips yet</div>}
      {jobs.map((j) => (
        <VideoCard key={j.id} job={j} active={activeId === j.id} onOpen={() => onOpen(j.id)}
          onSendToEdit={j.blobUrl && onSendToEdit ? () => onSendToEdit(j) : undefined}
          onVariation={() => onVariation(j)} onClear={() => onClear(j.id)} onRetryDraft={() => onRetryDraft(j)} />
      ))}
    </div>
  )
}

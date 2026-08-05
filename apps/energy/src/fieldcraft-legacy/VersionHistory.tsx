import { useState } from 'react';
import {
  Check, FileText, Globe, History, RotateCcw, Sparkles, Upload, X,
} from 'lucide-react';
import type { ContentSource, Revision } from './types';
import { getRevisionDoc, listRevisions, restoreRevision, summarise } from './content-store';
import './fieldcraft.css';

/**
 * Revision timeline for a deck. History is append-only — restoring an old
 * revision records a new one rather than rewriting the past, so the timeline
 * always shows exactly what happened and in what order, including the fact
 * that a restore occurred.
 */

const SOURCE: Record<ContentSource, { label: string; icon: typeof Globe }> = {
  seed: { label: 'Course baseline', icon: Sparkles },
  web: { label: 'Edited on the web', icon: Globe },
  'pptx-import': { label: 'Imported from PowerPoint', icon: Upload },
  'docx-import': { label: 'Imported from Word', icon: FileText },
  restore: { label: 'Restored', icon: RotateCcw },
};

function timeAgo(at: number): string {
  if (!at) return 'course baseline';
  const s = Math.max(0, Math.floor((Date.now() - at) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function VersionHistory({ materialId, onClose }: { materialId: string; onClose: () => void }) {
  const [revisions, setRevisions] = useState<Revision[]>(() => listRevisions(materialId));
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const doc = selected ? getRevisionDoc(materialId, selected) : undefined;

  const restore = (revisionId: string) => {
    restoreRevision(materialId, revisionId, Date.now());
    setRevisions(listRevisions(materialId));
    setConfirming(null);
    setSelected(null);
  };

  return (
    <div className="fc-modal-backdrop" onMouseDown={(e) => e.currentTarget === e.target && onClose()}>
      <div className="fc-history-modal" role="dialog" aria-modal="true" aria-label="Version history">
        <header>
          <span><History size={17} /></span>
          <div><small>VERSION HISTORY</small><b>{revisions.length} revision{revisions.length === 1 ? '' : 's'}</b></div>
          <button onClick={onClose} aria-label="Close history"><X size={16} /></button>
        </header>
        <div className="fc-history-body">
          <ol className="fc-history-timeline">
            {revisions.map((r, i) => {
              const meta = SOURCE[r.source];
              const Icon = meta.icon;
              const isCurrent = i === 0;
              return (
                <li key={r.id} className={selected === r.id ? 'open' : ''}>
                  <button className="fc-history-row" onClick={() => setSelected((s) => (s === r.id ? null : r.id))}>
                    <span className="fc-history-icon"><Icon size={13} /></span>
                    <div className="fc-history-main">
                      <b>Revision {r.n}{isCurrent && <em>CURRENT</em>}</b>
                      <small>{meta.label} · {r.author} · {timeAgo(r.at)}</small>
                      {r.summary && <em className="fc-history-summary">{summarise(r.summary)}</em>}
                    </div>
                  </button>
                  {selected === r.id && (
                    <div className="fc-history-detail">
                      {r.summary?.details.length ? (
                        <ul>
                          {r.summary.details.map((d) => (
                            <li key={d.slideId + d.kind} className={d.kind}>
                              <em>{d.kind === 'added' ? '+' : d.kind === 'removed' ? '−' : '~'}</em>
                              <span>{d.title}{d.fields?.length ? ` · ${d.fields.join(', ')}` : ''}</span>
                            </li>
                          ))}
                        </ul>
                      ) : <p className="fc-history-empty">{doc?.slides.length ?? 0} slides. No further detail recorded for this revision.</p>}
                      {!isCurrent && (
                        confirming === r.id ? (
                          <div className="fc-history-confirm">
                            <span>Restore this as a new revision? The current deck stays in history.</span>
                            <div>
                              <button onClick={() => setConfirming(null)}>Cancel</button>
                              <button className="primary" onClick={() => restore(r.id)}><Check size={13} />Restore</button>
                            </div>
                          </div>
                        ) : (
                          <button className="fc-history-restore" onClick={() => setConfirming(r.id)}><RotateCcw size={13} />Restore this revision</button>
                        )
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}

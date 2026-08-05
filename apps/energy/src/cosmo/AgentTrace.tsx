// cosmo/AgentTrace.tsx — the reasoning strip under an agent answer.
//
// Renders TurnTrace, which is assembled in agent/trace.ts from events the
// pipeline actually produced. There is no narration layer here and there must
// never be one: if a step is on screen, something real happened to put it there.
//
// Collapsed by default — the card is the answer, this is the receipt. The
// open/closed choice is remembered, because someone who wants to audit one
// answer usually wants to audit the next one too.

import { useEffect, useState } from 'react';
import { ChevronRight, Search, Crosshair, Layers, Database, Play, Wrench, Cpu, Info } from 'lucide-react';
import type { TraceKind, TurnTrace } from '../agent/types.ts';

const ICON: Record<TraceKind, typeof Search> = {
  parse: Search,
  resolve: Crosshair,
  capability: Layers,
  data: Database,
  action: Play,
  tool: Wrench,
  model: Cpu,
  note: Info,
};

const PREF = 'ae_trace_open';

/** Elapsed time, phrased the way trace.ts phrases it — sub-millisecond work is
 *  "instant", never a padded number invented to look like effort. */
function elapsed(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '';
  if (ms < 1) return 'instant';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function AgentTrace({ trace }: { trace: TurnTrace }) {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(PREF) === '1'; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(PREF, open ? '1' : '0'); } catch { /* private mode */ }
  }, [open]);

  if (!trace?.steps?.length) return null;
  const time = elapsed(trace.ms);

  return (
    <div className={'ag-trace' + (open ? ' is-open' : '')}>
      <button className="ag-trace-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <ChevronRight size={13} strokeWidth={2.2} className="ag-trace-chev" />
        <span className="ag-trace-title">How this was answered</span>
        <span className="ag-trace-meta">
          {trace.steps.length} step{trace.steps.length === 1 ? '' : 's'}
          {time && <> · {time}</>}
          {' · '}
          <b className={'ag-trace-tier t-' + trace.tier}>{trace.tier === 'core' ? 'CORE' : 'LITE'}</b>
        </span>
      </button>

      {open && (
        <ol className="ag-trace-body">
          {trace.steps.map((s, i) => {
            const Icon = ICON[s.kind] ?? Info;
            const tone = s.ok === false ? ' is-bad' : s.ok === true ? ' is-good' : '';
            return (
              <li key={i} className={'ag-trace-step k-' + s.kind + tone}>
                <span className="ag-trace-icon"><Icon size={12} strokeWidth={2.2} /></span>
                <span className="ag-trace-label">{s.label}</span>
                <span className="ag-trace-value">
                  {s.value}
                  {s.detail && <em className="ag-trace-detail">{s.detail}</em>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

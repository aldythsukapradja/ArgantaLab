// PlanCard — permanent on every stage (concept doc Part 7.2). The core interaction
// is watching P10/50/90 bands collapse as evidence is added; in D0 nothing is wired,
// so every metric shows its honest awaiting-stage state, never a fabricated number.
import { PLAN_METRICS, STAGES } from './registry';

const stageName = (id: string) => STAGES.find((s) => s.id === id)?.name ?? id;

export function PlanCard() {
  return (
    <aside className="fds-card" aria-label="Plan card">
      <div className="fds-card-h">Plan card</div>
      {PLAN_METRICS.map((m) => (
        <div key={m.id} className="fds-metric">
          <div className="fds-metric-top">
            <span className="fds-metric-label">{m.label}</span>
            <span className="fds-metric-val">—{m.unit && <span style={{ fontSize: 9, marginLeft: 3, color: 'var(--ink3)' }}>{m.unit}</span>}</span>
          </div>
          <div className="fds-band"><div className="fds-band-fill" /></div>
          <div className="fds-metric-bottom">
            <span className="fds-metric-await">awaiting {stageName(m.awaits)}</span>
            <span className="fds-chip pending" title="No basis yet — shown once computed">···</span>
          </div>
        </div>
      ))}
    </aside>
  );
}

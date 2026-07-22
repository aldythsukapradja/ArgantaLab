// DrillingSequenceView — the Drilling Sequence lifecycle surface. Reads the Well
// Delivery portfolio and lays sanctioned+ candidates on a simple rig-by-time strip
// (a full COMPASS/Primavera-style swimlane Gantt is later build-order work). This
// is the forward-link: a sanctioned well shows up here to be scheduled.
import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { loadCandidates, isGateReached } from './wdData';
import type { WdCandidate } from './types';
import { roleColor } from './shared';
import './well-delivery.css';

export function DrillingSequenceView() {
  const [cands, setCands] = useState<WdCandidate[]>([]);
  useEffect(() => { loadCandidates().then(setCands).catch(() => setCands([])); }, []);
  const scheduled = cands.filter((c) => isGateReached(c, 'sanction'));

  if (!scheduled.length) {
    return (
      <div className="wd-empty">
        <div>
          <CalendarClock size={22} style={{ marginBottom: 8, opacity: .5 }} />
          <div>No sanctioned wells yet — take a Well Delivery candidate to the <b style={{ color: 'var(--teal)' }}>Sanction</b> gate to schedule it.</div>
        </div>
      </div>
    );
  }

  const totalDays = scheduled.reduce((s, c) => s + c.afe.p50Days, 0);
  let cursor = 0;

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 18 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>Rig-by-time sequence · {scheduled.length} sanctioned wells · {totalDays} rig-days</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16 }}>Sanctioned Well Delivery candidates, sequenced back-to-back on one rig (illustrative).</div>
      {/* simple time strip */}
      <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', background: 'var(--panel)' }}>
        {scheduled.map((c) => {
          const startPct = (cursor / totalDays) * 100;
          const widthPct = (c.afe.p50Days / totalDays) * 100;
          cursor += c.afe.p50Days;
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderBottom: '1px solid var(--line)' }}>
              <div style={{ width: 120, flex: 'none' }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>{c.name}</div>
                <div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{c.role} · {c.afe.p50Days} d</div>
              </div>
              <div style={{ flex: 1, position: 'relative', height: 22, background: 'var(--panel-2)', borderRadius: 4 }}>
                <div title={`day ${Math.round(startPct / 100 * totalDays)}–${Math.round((startPct + widthPct) / 100 * totalDays)}`}
                  style={{ position: 'absolute', left: `${startPct}%`, width: `${widthPct}%`, top: 3, bottom: 3, borderRadius: 3, background: roleColor(c.role), opacity: 0.85 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

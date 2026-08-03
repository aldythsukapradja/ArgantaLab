// Handover — the closing gate. The well-barrier element report, well operating
// limits and handover checklist, plus the as-drilled package delivered to Reservoir
// Management (forward-link → energy_wd_rm_handover_v1). Closes the loop:
// Exploration → Field Dev → Well Delivery → Reservoir Management.
import { useState } from 'react';
import { ArrowRightCircle, CheckCircle2, Circle } from 'lucide-react';
import { Inspector, InspectorSection } from '../../fielddev/chrome';
import type { WdCandidate, ChecklistItem } from './types';
import { wdTab } from './registry';
import { WdHead } from './shared';
import { emitToReservoirMgmt, saveCandidate } from './wdData';

function defaultChecklist(c: WdCandidate): ChecklistItem[] {
  return [
    { item: 'Well-barrier element (WBE) status report', done: c.barriers.every((b) => b.verified), owner: 'Well Engineering' },
    { item: 'Well operating limits (MAASP, THP, rate)', done: true, owner: 'Well Engineering' },
    { item: 'X-mas tree / SCSSV leak & function test', done: !!c.asDrilled, owner: 'Completions' },
    { item: 'As-drilled trajectory, logs & tops', done: !!c.asDrilled, owner: 'Subsurface' },
    { item: 'Completion tally & perforation record', done: !!c.asDrilled, owner: 'Completions' },
    { item: 'Handover certificate signed', done: false, owner: 'Asset' },
  ];
}

export function Handover({ c, onChange }: { c: WdCandidate; onChange: (c: WdCandidate) => void }) {
  const [inspOpen, setInspOpen] = useState(true);
  const checklist = c.handover?.checklist ?? defaultChecklist(c);
  const doneCount = checklist.filter((x) => x.done).length;
  const ready = doneCount === checklist.length;
  const sent = !!c.handover?.sentToRm;

  const toggle = (i: number) => {
    const next = checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x));
    onChange({ ...c, handover: { checklist: next, sentToRm: sent, sentAt: c.handover?.sentAt ?? null } });
  };
  const sendToRm = () => {
    const updated: WdCandidate = { ...c, gate: 'handover', handover: { checklist, sentToRm: true, sentAt: new Date().toISOString() } };
    saveCandidate(updated);
    emitToReservoirMgmt(updated);
    onChange(updated);
  };

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <WdHead tab={wdTab('handover')} well={c.name} gate={c.gate} nature={c.asDrilled ? 'reported' : 'scenario'}
          right={<span className="chip mono" style={{ color: sent ? 'var(--teal)' : 'var(--muted)', borderColor: sent ? 'var(--teal)' : 'var(--line)' }}>{sent ? '✓ delivered to RM' : `${doneCount}/${checklist.length} ready`}</span>} />
        <div className="wd-scroll" style={{ padding: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }}>
            {/* handover checklist */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Handover checklist</div>
              {checklist.map((x, i) => (
                <div key={x.item} onClick={() => toggle(i)} style={{ display: 'flex', gap: 9, alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--line)', cursor: 'pointer' }}>
                  {x.done ? <CheckCircle2 size={15} style={{ color: 'var(--teal)', flex: 'none' }} /> : <Circle size={15} style={{ color: 'var(--muted)', flex: 'none' }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11.5, color: 'var(--text)' }}>{x.item}</div>
                    <div className="mono" style={{ fontSize: 9, color: 'var(--muted)' }}>{x.owner}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* as-drilled package */}
            <div>
              <div className="eyebrow" style={{ marginBottom: 8 }}>As-drilled package → Reservoir Mgmt</div>
              {[['Well', c.name], ['Role', c.role], ['Target', c.target.formation], ['TD (TVD)', `${c.trajectory.tdTvd.toFixed(0)} m`], ['In-zone', c.asDrilled ? `${c.asDrilled.inZonePct}%` : '—'], ['Actual days', c.asDrilled ? `${c.asDrilled.daysActual}` : '—']].map(([k, v]) => (
                <div key={k} className="wd-kv"><b>{k}</b><span>{v}</span></div>
              ))}
              <button onClick={sendToRm} disabled={!ready || sent}
                style={{ marginTop: 14, width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 12px', borderRadius: 6,
                  border: `1px solid ${ready && !sent ? 'var(--teal)' : 'var(--line)'}`, background: ready && !sent ? 'var(--sel)' : 'var(--panel-2)',
                  color: ready && !sent ? 'var(--teal)' : 'var(--muted)', cursor: ready && !sent ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600 }}>
                <ArrowRightCircle size={15} /> {sent ? 'Delivered to Reservoir Management' : 'Deliver to Reservoir Management'}
              </button>
              {sent && <div className="wd-note" style={{ textAlign: 'center' }}>Loop closed — Reservoir Management now owns this well.</div>}
              {!ready && !sent && <div className="wd-note" style={{ textAlign: 'center' }}>Complete the checklist to enable handover.</div>}
            </div>
          </div>
          <div className="wd-note">Handover delivers the finished well to Reservoir Management, closing the Exploration → Field Development → Well Delivery → Reservoir loop.</div>
        </div>
      </div>

      <Inspector title="Barriers & limits" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Well-barrier elements">
          {c.barriers.map((b) => (
            <div key={b.name} style={{ marginBottom: 8 }}>
              <div className="mono" style={{ fontSize: 10, color: b.name === 'Primary' ? 'var(--teal)' : 'var(--blue)', marginBottom: 3 }}>{b.name.toUpperCase()} {b.verified ? '· verified' : '· pending'}</div>
              {b.elements.map((el) => <div key={el} style={{ fontSize: 10, color: 'var(--muted)', padding: '1px 0' }}>· {el}</div>)}
            </div>
          ))}
        </InspectorSection>
        <InspectorSection title="Well operating limits">
          <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            MAASP, max THP, drawdown and rate limits are set from the completion & barrier envelope, and handed to RM as the well's operating window.
          </div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}

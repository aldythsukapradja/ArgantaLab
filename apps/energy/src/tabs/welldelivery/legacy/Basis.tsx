// Basis — Statement of Requirements & Basis of Design. The "what & why" before
// engineering answers "how": objectives, targets, success criteria, design
// envelope, rig sizing, Level-2 cost basis, risk register. Editable objective +
// gate advance live in the inspector (persisted through the shell → wdData store).
import { useState } from 'react';
import { Inspector, InspectorSection } from '../../fielddev/chrome';
import type { WdCandidate, Severity } from './types';
import { GATES, gateIndex } from './types';
import { wdTab } from './registry';
import { WdHead, usd } from './shared';

const sevColor: Record<Severity, string> = { low: 'var(--teal)', med: 'var(--amber)', high: 'var(--rose)' };

export function Basis({ c, onChange }: { c: WdCandidate; onChange: (c: WdCandidate) => void }) {
  const [inspOpen, setInspOpen] = useState(true);
  const l2 = [
    ['Rig & spread', 0.42], ['Tangibles (casing/wellhead)', 0.14], ['Cementing & fluids', 0.09],
    ['Directional & LWD', 0.11], ['Evaluation (wireline/cores)', 0.08], ['Logistics & support', 0.1], ['Contingency', 0.06],
  ] as const;

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <WdHead tab={wdTab('basis')} well={c.name} gate={c.gate} nature="scenario" />
        <div className="wd-scroll" style={{ padding: 14 }}>
          {/* objectives */}
          <div className="eyebrow" style={{ marginBottom: 6 }}>Objective &amp; success criteria</div>
          <div style={{ fontSize: 12, color: 'var(--text)', lineHeight: 1.5, marginBottom: 8 }}>{c.objective}</div>
          <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.7 }}>
            {c.successCriteria.map((s, i) => <li key={i}>{s}</li>)}
          </ul>

          {/* targets + envelope */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Subsurface target</div>
              {[['Formation', c.target.formation], ['Anchor / block', c.target.anchorWell], ['Target MD', `${c.target.md.toFixed(0)} m`], ['Target TVDSS', `${c.target.tvdss.toFixed(0)} m`], ['Surface E/N', `${c.target.x.toFixed(0)} / ${c.target.y.toFixed(0)}`]].map(([k, v]) => (
                <div key={k} className="wd-kv"><b>{k}</b><span>{v}</span></div>
              ))}
            </div>
            <div>
              <div className="eyebrow" style={{ marginBottom: 6 }}>Design envelope</div>
              {[['Well type', `${c.kind} · ${c.role}`], ['Profile', c.trajectory.profile], ['Max inclination', `${c.trajectory.maxInclDeg}°`], ['Max DLS', `${c.trajectory.maxDlsDeg30m}°/30m`], ['TD (MD)', `${c.trajectory.tdMd} m`]].map(([k, v]) => (
                <div key={k} className="wd-kv"><b>{k}</b><span>{v}</span></div>
              ))}
            </div>
          </div>

          {/* risk register */}
          <div className="eyebrow" style={{ marginBottom: 6 }}>Risk register</div>
          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse', marginBottom: 8 }}>
            <thead><tr style={{ color: 'var(--muted)', textAlign: 'left', borderBottom: '1px solid var(--line)' }}>
              <th style={{ padding: '4px 6px' }}>Hazard</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th>
            </tr></thead>
            <tbody>
              {c.risks.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--line)', verticalAlign: 'top' }}>
                  <td style={{ padding: '5px 6px', color: 'var(--text)' }}>{r.hazard}</td>
                  <td><span className="mono" style={{ fontSize: 8, padding: '1px 6px', borderRadius: 20, color: sevColor[r.severity], border: `1px solid ${sevColor[r.severity]}` }}>{r.severity}</span></td>
                  <td><span className="mono" style={{ fontSize: 8, padding: '1px 6px', borderRadius: 20, color: sevColor[r.likelihood], border: `1px solid ${sevColor[r.likelihood]}` }}>{r.likelihood}</span></td>
                  <td style={{ padding: '5px 6px', color: 'var(--muted)', fontSize: 10.5 }}>{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="wd-note">SOR / Basis of Design is a multi-discipline deliverable (subsurface · drilling · completions · reservoir · HSE). Numbers are scenario-grade until the well is drilled.</div>
        </div>
      </div>

      <Inspector title="SOR & design controls" open={inspOpen} onToggle={() => setInspOpen(false)}>
        <InspectorSection title="Objective">
          <textarea value={c.objective} onChange={(e) => onChange({ ...c, objective: e.target.value })}
            style={{ width: '100%', minHeight: 70, padding: 7, fontSize: 11, background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--text)', resize: 'vertical' }} />
        </InspectorSection>
        <InspectorSection title="Level-2 cost basis">
          {l2.map(([k, frac]) => (
            <div key={k} style={{ marginBottom: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--muted)' }}>
                <span>{k}</span><span className="mono" style={{ color: 'var(--text)' }}>{usd(c.afe.totalUsd * frac)}</span>
              </div>
              <div style={{ height: 5, background: 'var(--panel-2)', borderRadius: 2, marginTop: 2 }}>
                <div style={{ width: `${frac * 100}%`, height: '100%', background: 'var(--amber)', borderRadius: 2 }} />
              </div>
            </div>
          ))}
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--text)', marginTop: 6, textAlign: 'right' }}>Total {usd(c.afe.totalUsd)}</div>
        </InspectorSection>
        <InspectorSection title="Rig sizing">
          <div style={{ fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.6 }}>
            Deviated {c.trajectory.tdMd} m MD well → jack-up / semi with ≥ {(c.trajectory.tdMd * 1.15 / 1000).toFixed(1)} km hookload margin, top-drive, and 15k BOP. P50 duration {c.afe.p50Days} days.
          </div>
        </InspectorSection>
        <InspectorSection title="Data acquisition">
          {c.dataAcq.map((d, i) => <div key={i} style={{ fontSize: 10.5, color: 'var(--text)', padding: '2px 0' }}>▸ {d}</div>)}
        </InspectorSection>
        <InspectorSection title="Maturation gate">
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginBottom: 6 }}>Advance the candidate to the next Capital Value Process gate.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {GATES.map((g) => (
              <button key={g.id} onClick={() => onChange({ ...c, gate: g.id })}
                style={{ fontSize: 10, fontFamily: 'var(--mono)', padding: '4px 9px', borderRadius: 4, cursor: 'pointer',
                  border: `1px solid ${g.id === c.gate ? 'var(--teal)' : 'var(--line)'}`, color: g.id === c.gate ? 'var(--teal)' : 'var(--muted)',
                  background: gateIndex(g.id) <= gateIndex(c.gate) ? 'var(--sel)' : 'var(--panel-2)' }}>{g.dg}</button>
            ))}
          </div>
        </InspectorSection>
      </Inspector>
    </div>
  );
}

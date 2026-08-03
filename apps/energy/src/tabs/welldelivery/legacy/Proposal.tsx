// Proposal — the non-scrolling drilling-proposal cockpit. Everything the FID gate
// needs on one screen: objective, target, trajectory, casing/mud, AFE, top risks
// and gate readiness. The full documents live in the Report workspace (linked).
import { FileText } from 'lucide-react';
import type { WdCandidate } from './types';
import { GATES, gateIndex } from './types';
import { wdTab } from './registry';
import { WdHead, roleColor, usd } from './shared';

function Tile({ k, v, c }: { k: string; v: string; c?: string }) {
  return <div className="wd-tile"><div className="t-k">{k}</div><div className="t-v" style={c ? { color: c } : undefined}>{v}</div></div>;
}

export function Proposal({ c }: { c: WdCandidate }) {
  const t = c.trajectory;
  const readiness = GATES.slice(0, gateIndex('sanction') + 1).map((g) => ({
    label: `${g.label} deliverable`, done: gateIndex(c.gate) >= gateIndex(g.id),
  }));
  const topRisks = [...c.risks].sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0)).slice(0, 3);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <WdHead tab={wdTab('proposal')} well={c.name} gate={c.gate} nature="scenario" />
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <div className="wd-cockpit">
          {/* Well & target */}
          <div className="wd-panel" style={{ gridColumn: 1, gridRow: 1 }}>
            <div className="wd-p-hd">Well &amp; Target</div>
            <div className="wd-p-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: roleColor(c.role) }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{c.name}</span>
                <span className="mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{c.kind === 'sidetrack' ? `sidetrack · off ${c.parentWell}` : 'new well'} · {c.role}</span>
              </div>
              <div className="wd-kv"><b>Target</b><span>{c.target.formation}</span></div>
              <div className="wd-kv"><b>Target TVDSS</b><span>{c.target.tvdss.toFixed(0)} m</span></div>
              <div className="wd-kv"><b>Fault block</b><span>{c.target.anchorWell}</span></div>
              <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 7, lineHeight: 1.45 }}>{c.objective}</div>
            </div>
          </div>

          {/* Trajectory */}
          <div className="wd-panel" style={{ gridColumn: 2, gridRow: 1 }}>
            <div className="wd-p-hd">Trajectory · {t.profile}</div>
            <div className="wd-p-body wd-tiles">
              <Tile k="KOP" v={`${t.kopMd.toFixed(0)} m`} />
              <Tile k="TD (MD / TVD)" v={`${t.tdMd.toFixed(0)} / ${t.tdTvd.toFixed(0)}`} />
              <Tile k="Max inclination" v={`${t.maxInclDeg.toFixed(0)}°`} />
              <Tile k="Max DLS" v={`${t.maxDlsDeg30m.toFixed(1)}°/30m`} />
            </div>
          </div>

          {/* AFE & schedule */}
          <div className="wd-panel" style={{ gridColumn: 3, gridRow: 1 }}>
            <div className="wd-p-hd">AFE &amp; Schedule</div>
            <div className="wd-p-body wd-tiles">
              <Tile k="Dry hole" v={usd(c.afe.dryHoleUsd)} />
              <Tile k="Completion" v={usd(c.afe.complUsd)} />
              <Tile k="Total (P50)" v={usd(c.afe.totalUsd)} c="var(--amber)" />
              <Tile k="Days (P50)" v={`${c.afe.p50Days}`} />
            </div>
          </div>

          {/* Casing & mud */}
          <div className="wd-panel" style={{ gridColumn: 1, gridRow: '2 / 4' }}>
            <div className="wd-p-hd">Casing &amp; Mud Scheme</div>
            <div className="wd-p-body">
              <table className="mono" style={{ width: '100%', fontSize: 10.5, borderCollapse: 'collapse' }}>
                <thead><tr style={{ color: 'var(--muted)', textAlign: 'right', borderBottom: '1px solid var(--line)' }}>
                  <th style={{ textAlign: 'left', padding: '3px 4px' }}>Section</th><th>Hole″</th><th>Csg″</th><th>Shoe MD</th><th>Mud sg</th>
                </tr></thead>
                <tbody>
                  {c.casing.map((r) => (
                    <tr key={r.section} style={{ textAlign: 'right', borderBottom: '1px solid var(--line)' }}>
                      <td style={{ textAlign: 'left', padding: '4px 4px', color: 'var(--text)' }}>{r.section}</td>
                      <td>{r.holeIn}</td><td>{r.csgIn}</td><td>{r.shoeMd}</td>
                      <td style={{ color: 'var(--blue)' }}>{r.mudSg.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top risks */}
          <div className="wd-panel" style={{ gridColumn: 2, gridRow: 2 }}>
            <div className="wd-p-hd">Top Risks</div>
            <div className="wd-p-body">
              {topRisks.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', padding: '3px 0', borderBottom: '1px solid var(--line)' }}>
                  <span className="mono" style={{ fontSize: 7.5, padding: '1px 5px', borderRadius: 20, flex: 'none', marginTop: 1,
                    color: r.severity === 'high' ? 'var(--rose)' : 'var(--amber)', border: `1px solid ${r.severity === 'high' ? 'var(--rose)' : 'var(--amber)'}` }}>{r.severity.toUpperCase()}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--text)' }}>{r.hazard}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Data acquisition */}
          <div className="wd-panel" style={{ gridColumn: 3, gridRow: 2 }}>
            <div className="wd-p-hd">Data Acquisition</div>
            <div className="wd-p-body">
              {c.dataAcq.slice(0, 5).map((d, i) => (
                <div key={i} style={{ fontSize: 10.5, color: 'var(--text)', padding: '2.5px 0', display: 'flex', gap: 6 }}>
                  <span style={{ color: 'var(--teal)' }}>▸</span>{d}
                </div>
              ))}
            </div>
          </div>

          {/* Gate readiness + report link */}
          <div className="wd-panel" style={{ gridColumn: '2 / 4', gridRow: 3 }}>
            <div className="wd-p-hd" style={{ display: 'flex', alignItems: 'center' }}>
              Gate Readiness · {GATES[gateIndex(c.gate)].dg} {GATES[gateIndex(c.gate)].label}
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--muted)', fontSize: 9.5, textTransform: 'none', letterSpacing: 0 }}>
                <FileText size={11} /> full SOR / program → Report workspace
              </span>
            </div>
            <div className="wd-p-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignContent: 'flex-start' }}>
              {readiness.map((r) => (
                <span key={r.label} className="mono" style={{ fontSize: 9.5, padding: '4px 9px', borderRadius: 20,
                  border: `1px solid ${r.done ? 'var(--teal)' : 'var(--line)'}`, color: r.done ? 'var(--teal)' : 'var(--muted)', background: r.done ? 'var(--sel)' : 'transparent' }}>
                  {r.done ? '✓' : '○'} {r.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

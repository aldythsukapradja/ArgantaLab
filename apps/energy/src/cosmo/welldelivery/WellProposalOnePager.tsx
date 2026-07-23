// WellProposalOnePager — the true-A4 drilling-proposal one-pager (SOR→BOD slice of
// the well spine) described in WELL-DELIVERY-PROPOSAL-SPEC.md §2. Trajectory +
// sourceTarget are real Volve data (measured/interpreted); casing/mud, completion,
// data-acquisition, risk register and AFE are editable scenario fields. Save →
// localStorage; gate === 'APPROVED' forward-links a unit to the Drilling Sequence.
import { useMemo, useState } from 'react';
import { ArrowLeft, Printer, Save, Check, ArrowUpRight } from 'lucide-react';
import type { WellProposal, ProposalGate, RiskRow, CasingMudRow } from './proposal-types';
import { GATE_ORDER, GATE_LABEL } from './proposal-types';
import { saveProposal, emitToDrillingSequence, isEmittedToSequence } from './proposal-store';
import './well-delivery.css';

interface Props { proposal: WellProposal; onBack: () => void; }

// The 7 Well Delivery evidence documents (from the report corpus) an approval checks.
const EVIDENCE = [
  'Well Basis of Design', 'Trajectory & Anti-Collision', 'Pore Pressure & Mud Window',
  'Casing & Cementing', 'Completion Basis', 'Offset NPT Review', 'AFE & Cost Basis',
];

export function WellProposalOnePager({ proposal, onBack }: Props) {
  const [p, setP] = useState<WellProposal>(proposal);
  const [saved, setSaved] = useState(true);
  const emitted = useMemo(() => isEmittedToSequence(p.id), [p.id, saved]);

  const patch = (up: Partial<WellProposal>) => { setP((cur) => ({ ...cur, ...up })); setSaved(false); };

  const save = () => {
    saveProposal(p);
    if (p.gate === 'APPROVED') emitToDrillingSequence(p);
    setSaved(true);
  };

  const setGate = (g: ProposalGate) => {
    const next = { ...p, gate: g };
    setP(next); setSaved(false);
    if (g === 'APPROVED') { saveProposal(next); emitToDrillingSequence(next); setSaved(true); }
  };

  const t = p.trajectory;
  const gateIdx = GATE_ORDER.indexOf(p.gate);

  const setRisk = (i: number, up: Partial<RiskRow>) =>
    patch({ riskRegister: p.riskRegister.map((r, j) => (j === i ? { ...r, ...up } : r)) });
  const setCasing = (i: number, up: Partial<CasingMudRow>) =>
    patch({ casingMud: p.casingMud.map((r, j) => (j === i ? { ...r, ...up } : r)) });

  return (
    <div className="wd-onepager-wrap">
      <div className="wd-op-bar">
        <button className="wbtn" onClick={onBack}><ArrowLeft size={12} /> Back</button>
        <div className="sp" />
        <span style={{ fontSize: 10.5, color: 'var(--ink3)' }}>{saved ? 'Saved' : 'Unsaved changes'}</span>
        <button className="wbtn" onClick={save}><Save size={12} /> Save</button>
        <button className="wbtn" onClick={() => window.print()}><Printer size={12} /> Print / Export</button>
      </div>

      <div className="wd-op-page">
        {/* 1 — Header */}
        <div className="wd-op-sec">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Drilling Proposal — {p.well}</div>
              <div style={{ fontSize: 10.5, color: 'var(--ink3)', marginTop: 2 }}>Volve field · Mærsk Inspirer · Rev {p.rev}</div>
            </div>
            <span className="wd-nature scenario">Proposal · scenario</span>
          </div>
          <div className="wd-gate-track">
            {GATE_ORDER.map((g, i) => (
              <div key={g} className={`wd-gate-dot${i <= gateIdx ? ' on' : ''}`} title={GATE_LABEL[g]}
                style={{ cursor: 'pointer' }} onClick={() => setGate(g)} />
            ))}
          </div>
          <div style={{ fontSize: 10, color: 'var(--teal-ink)', marginTop: 4, fontFamily: 'var(--mono)' }}>{GATE_LABEL[p.gate]}</div>
        </div>

        {/* 2 — Objective & success criteria */}
        <div className="wd-op-sec">
          <h3>Objective &amp; Rationale</h3>
          <textarea className="wd-op-textarea" value={p.objective}
            onChange={(e) => patch({ objective: e.target.value })} />
          <ul style={{ margin: '8px 0 0 16px', fontSize: 10.5 }}>
            {p.successCriteria.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>

        {/* 3 — Targets & geology */}
        <div className="wd-op-sec">
          <h3>Targets &amp; Geology</h3>
          <div className="wd-op-grid">
            <div className="wd-op-kv"><b>Target formation</b><span>{p.sourceTarget.formation ?? '—'}</span></div>
            <div className="wd-op-kv"><b>Top MD</b><span>{p.sourceTarget.topMd?.toFixed(0) ?? '—'} m</span></div>
            <div className="wd-op-kv"><b>Top TVDSS</b><span>{p.sourceTarget.topTvdss?.toFixed(0) ?? '—'} m</span></div>
            <div className="wd-op-kv"><b>Surface (X, Y)</b><span>{p.sourceTarget.x.toFixed(0)}, {p.sourceTarget.y.toFixed(0)}</span></div>
          </div>
        </div>

        {/* 4 — Trajectory summary (real) */}
        <div className="wd-op-sec">
          <h3>Trajectory Summary <span className={`wd-nature ${t.dataNature}`}>{t.dataNature}</span></h3>
          <div className="wd-op-grid">
            <div className="wd-op-kv"><b>KOP MD</b><span>{t.kopMd?.toFixed(0) ?? 'vertical'} m</span></div>
            <div className="wd-op-kv"><b>TD</b><span>{t.tdMd.toFixed(0)} m MD / {t.tdTvd.toFixed(0)} m TVD</span></div>
            <div className="wd-op-kv"><b>Max inclination</b><span>{t.maxInclDeg.toFixed(1)}°</span></div>
            <div className="wd-op-kv"><b>Max azimuth</b><span>{t.maxAziDeg.toFixed(1)}°</span></div>
            <div className="wd-op-kv"><b>Max DLS</b><span>{t.maxDlsDeg30m.toFixed(2)}°/30 m</span></div>
            <div className="wd-op-kv"><b>Closest offset</b><span>{t.closestOffset ? `${t.closestOffset.well} · ${t.closestOffset.distM} m` : '—'}</span></div>
          </div>
        </div>

        {/* 5 — Casing & mud (editable scenario) */}
        <div className="wd-op-sec">
          <h3>Casing &amp; Mud Scheme <span className="wd-nature scenario">scenario</span></h3>
          <table className="wd-op-table">
            <thead><tr><th>Section</th><th>Shoe MD (m)</th><th>Mud weight (SG)</th></tr></thead>
            <tbody>
              {p.casingMud.map((c, i) => (
                <tr key={i}>
                  <td>{c.section}</td>
                  <td><input type="number" value={c.shoeMd} onChange={(e) => setCasing(i, { shoeMd: +e.target.value })} /></td>
                  <td><input type="number" step="0.01" value={c.mudWeightSg} onChange={(e) => setCasing(i, { mudWeightSg: +e.target.value })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 6 — Completion intent (editable scenario) */}
        <div className="wd-op-sec">
          <h3>Completion Intent <span className="wd-nature scenario">scenario</span></h3>
          <div className="wd-op-grid">
            <label className="wd-op-kv"><b>Type</b><input className="wd-op-input" value={p.completion.type}
              onChange={(e) => patch({ completion: { ...p.completion, type: e.target.value } })} /></label>
            <label className="wd-op-kv"><b>Intervals</b><input className="wd-op-input" value={p.completion.intervals}
              onChange={(e) => patch({ completion: { ...p.completion, intervals: e.target.value } })} /></label>
            <label className="wd-op-kv"><b>Sand control</b><input className="wd-op-input" value={p.completion.sandControl}
              onChange={(e) => patch({ completion: { ...p.completion, sandControl: e.target.value } })} /></label>
            <label className="wd-op-kv"><b>Stimulation</b><input className="wd-op-input" value={p.completion.stimulation}
              onChange={(e) => patch({ completion: { ...p.completion, stimulation: e.target.value } })} /></label>
          </div>
        </div>

        {/* 7 — Data acquisition (scenario) */}
        <div className="wd-op-sec">
          <h3>Data-Acquisition Matrix <span className="wd-nature scenario">scenario</span></h3>
          <ul style={{ margin: '0 0 0 16px', fontSize: 10.5 }}>
            {p.dataAcquisition.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </div>

        {/* 8 — Risk register (editable) */}
        <div className="wd-op-sec">
          <h3>Risk Register <span className="wd-nature scenario">scenario</span></h3>
          {p.riskRegister.map((r, i) => (
            <div key={i} className="wd-risk-row">
              <span className={`wd-sev ${r.severity}`}>{r.severity}</span>
              <span style={{ fontWeight: 600, minWidth: 160 }}>{r.hazard}</span>
              <input className="wd-op-input" value={r.mitigation} onChange={(e) => setRisk(i, { mitigation: e.target.value })} />
            </div>
          ))}
        </div>

        {/* 9 — AFE & days (editable scenario) */}
        <div className="wd-op-sec">
          <h3>AFE &amp; Days <span className="wd-nature scenario">scenario</span></h3>
          <div className="wd-op-grid">
            <label className="wd-op-kv"><b>Dry hole (USD)</b><input className="wd-op-input" type="number" value={p.afe.dryHoleUsd}
              onChange={(e) => patch({ afe: { ...p.afe, dryHoleUsd: +e.target.value, totalUsd: +e.target.value + p.afe.completionUsd } })} /></label>
            <label className="wd-op-kv"><b>Completion (USD)</b><input className="wd-op-input" type="number" value={p.afe.completionUsd}
              onChange={(e) => patch({ afe: { ...p.afe, completionUsd: +e.target.value, totalUsd: p.afe.dryHoleUsd + +e.target.value } })} /></label>
            <div className="wd-op-kv"><b>Total</b><span>${(p.afe.totalUsd / 1e6).toFixed(1)} M</span></div>
            <label className="wd-op-kv"><b>P50 days</b><input className="wd-op-input" type="number" value={p.afe.p50Days}
              onChange={(e) => patch({ afe: { ...p.afe, p50Days: +e.target.value } })} /></label>
          </div>
        </div>

        {/* 10 — Approvals & links */}
        <div className="wd-op-sec">
          <h3>Approvals &amp; Links</h3>
          <div className="wd-links" style={{ marginBottom: 8 }}>
            {EVIDENCE.map((e) => <span key={e} className="wd-link-chip">{e}</span>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 10.5 }}>
            <span className="wd-link-chip">← Field Development · {p.sourceTarget.well}</span>
            <span className={`wd-link-chip${emitted ? ' ok' : ''}`}>
              {emitted ? <Check size={10} /> : <ArrowUpRight size={10} />} Drilling {emitted ? '· emitted' : '· on approval'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

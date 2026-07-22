// SequenceTabs — the non-Sequence lifecycle tabs: Overview (KPI cockpit + spec
// note), Rigs (utilization + compatibility), Milestones (RFSU/RFD overlay list),
// Revisions (git-like schedule diff). All read the same DrillingSchedule.
import { useMemo, useState } from 'react';
import type { DrillingSchedule } from './schedule-model';
import { RIGS, RESERVOIR_COLOR, allActivities, rigUtilization, wellCountByYear } from './schedule-model';
import type { Window } from './time-axis';
import { mi2d, fmtDate, fmtMonthYear, pd } from './time-axis';
import { listRevisions, saveRevision, snapshot, diff } from './schedule-store';

// ── Overview: KPI cockpit + design-spec note ──
export function OverviewView({ schedule }: { schedule: DrillingSchedule }) {
  const acts = useMemo(() => allActivities(schedule).filter((a) => a.kind !== 'Rig'), [schedule]);
  const counts = wellCountByYear(schedule);
  const totalDays = acts.reduce((s, a) => s + a.days, 0);
  const injectors = acts.filter((a) => a.wellType === 'WI').length;
  const fromProposals = acts.filter((a) => a.proposalId).length;

  const metrics = [
    { v: acts.length, l: 'Wells scheduled', c: '#0FB5A6' },
    { v: schedule.rigs.length, l: 'Rig lanes', c: '#2563eb' },
    { v: `${totalDays}d`, l: 'Σ P50 drilling days', c: '#f59e0b' },
    { v: injectors, l: 'Injectors', c: '#7c3aed' },
    { v: fromProposals, l: 'From approved proposals', c: '#10b981' },
    { v: counts.length ? `${counts[0].year}–${counts[counts.length - 1].year}` : '—', l: 'Schedule horizon', c: '#e11d74' },
  ];

  return (
    <div className="dseq-over">
      <div className="dmetrics">
        {metrics.map((m, i) => (
          <div key={i} className="dmetric">
            <div className="edge" style={{ background: m.c }} />
            <div className="v">{m.v}</div>
            <div className="l">{m.l}</div>
          </div>
        ))}
      </div>
      <div className="dnote" style={{ maxWidth: 760 }}>
        <b>Drilling Sequence Workspace</b> — the rig-by-time decision cockpit for the Volve
        development. Timing and sequencing are <span className="dnat scenario">scenario</span> (planning):
        well geometry, roles and reservoirs are real Volve data, but the repository carries no drilling
        calendar dates, so bar placement is a plannable proposal — approved Well Delivery proposals
        seed real P50 durations and back-link each unit to its target. Open the <b>Sequence</b> tab for
        the Gantt, slider and field map; <b>Rigs</b> for utilization; <b>Milestones</b> for RFSU exposure;
        <b>Revisions</b> for a no-silent-overwrite schedule diff.
      </div>
    </div>
  );
}

// ── Rigs: utilization bars over the current window + compatibility matrix ──
export function RigsView({ schedule, win }: { schedule: DrillingSchedule; win: Window }) {
  const vs = mi2d(win.mL), ve = mi2d(win.mR);
  const util = rigUtilization(schedule, iso(vs), iso(ve));
  return (
    <div className="dutil">
      <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
        UTILIZATION · {fmtMonthYear(vs)} → {fmtMonthYear(ve)}
      </div>
      {util.map(({ rig, pct, busyDays, spanDays, count }) => (
        <div key={rig.id} className="dutil-row">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <div><b style={{ fontSize: 13 }}>{rig.name}</b> <span style={{ color: 'var(--ink3)', fontSize: 11 }}>· {count} activities</span></div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 800, color: rig.color }}>{pct}%</div>
          </div>
          <div className="dutil-bar"><i style={{ width: `${pct}%`, background: rig.color }} /></div>
          <div style={{ fontSize: 10, color: 'var(--ink3)', marginTop: 4 }}>{busyDays} busy days of {spanDays} in window</div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--mono)', marginTop: 8 }}>RIG · RESERVOIR COMPATIBILITY</div>
      <table className="dtbl" style={{ maxWidth: 460 }}>
        <thead><tr><th>Rig</th>{(Object.keys(RESERVOIR_COLOR)).map((r) => <th key={r} style={{ color: RESERVOIR_COLOR[r as keyof typeof RESERVOIR_COLOR] }}>{r}</th>)}</tr></thead>
        <tbody>
          {RIGS.map((rig) => (
            <tr key={rig.id}><td>{rig.name}</td>{Object.keys(RESERVOIR_COLOR).map((r) => <td key={r} style={{ color: '#10b981' }}>✓</td>)}</tr>
          ))}
        </tbody>
      </table>
      <div style={{ fontSize: 10, color: 'var(--ink3)' }}>Compatibility is scenario — both rigs assumed capable across the Volve reservoir set.</div>
    </div>
  );
}

// ── Milestones: RFSU/RFD list on the sequence with downstream exposure ──
export function MilestonesView({ schedule }: { schedule: DrillingSchedule }) {
  const ms = [...schedule.milestones].sort((a, b) => pd(a.date).getTime() - pd(b.date).getTime());
  return (
    <div className="drev">
      <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--mono)', marginBottom: 10 }}>PROJECT MILESTONES · RFSU EXPOSURE</div>
      {ms.length === 0 && <div className="dseq-empty">No milestones derived yet.</div>}
      <div className="drev-diff">
        {ms.map((m, i) => {
          const rig = schedule.rigs.find((r) => r.id === m.rigId);
          return (
            <div key={i} className="drev-item">
              <span className="drev-tag mov" style={{ color: m.color, background: 'rgba(225,29,116,.1)' }}>{m.kind}</span>
              <div>
                <b>{m.label}</b> — {fmtDate(pd(m.date))}
                <div style={{ color: 'var(--ink3)', fontSize: 10, marginTop: 2 }}>
                  {rig?.name ?? 'Field'} · ready-for-start-up gate. Slippage cascades to first-oil and downstream reservoir-management surveillance start.
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Revisions: git-like schedule diff vs prior saved revision ──
export function RevisionsView({ schedule }: { schedule: DrillingSchedule }) {
  const [revs, setRevs] = useState(() => listRevisions());
  const prev = revs[revs.length - 1];
  const current = useMemo(() => snapshot(schedule), [schedule]);
  const diffRows = prev ? diff(prev.rows, current) : [];

  const save = () => {
    const id = 'rev-' + (revs.length + 1);
    const label = `Rev ${revs.length + 1}`;
    saveRevision(schedule, label, id, new Date().toISOString());
    setRevs(listRevisions());
  };

  return (
    <div className="drev">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--ink3)', fontFamily: 'var(--mono)' }}>
          SCHEDULE REVISION CONTROL · {revs.length} saved
        </div>
        <div style={{ flex: 1 }} />
        <button className="dbtn" onClick={save}>Save current as Rev {revs.length + 1}</button>
      </div>

      {!prev && (
        <div className="dseq-empty">
          No prior revision to diff against. Save the current schedule as a baseline, then any
          later change (a new approved proposal, a resequenced well) shows here as a traceable
          add / remove / move — never a silent overwrite.
        </div>
      )}

      {prev && (
        <>
          <div style={{ fontSize: 11, color: 'var(--ink2)', marginBottom: 8 }}>
            Diff: <b>{prev.label}</b> ({new Date(prev.savedAt).toLocaleDateString()}) → <b>working</b>
            {diffRows.length === 0 && ' — identical, no changes'}
          </div>
          <div className="drev-diff">
            {diffRows.map((d, i) => (
              <div key={i} className="drev-item">
                <span className={`drev-tag ${d.kind}`}>{d.kind === 'add' ? 'ADDED' : d.kind === 'rem' ? 'REMOVED' : 'MOVED'}</span>
                <div><b>{d.well}</b> <span style={{ color: 'var(--ink3)' }}>— {d.detail}</span></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

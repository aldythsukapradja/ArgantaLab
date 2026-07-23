// SequenceCockpit — the "operations cockpit" chrome for the Sequence tab: a KPI
// ribbon (living metrics + rig-utilization gauge + next-RFSU countdown) and a live
// insight rail (drilling-now + read-only Cosmonaut summary + upcoming milestones).
// Reads the same DrillingSchedule; all COSMO tokens.
import { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import type { DrillingSchedule } from './schedule-model';
import { RESERVOIR_COLOR, allActivities, rigUtilization } from './schedule-model';
import type { Window } from './time-axis';
import { mi2d, pd, db, today, fmtDate } from './time-axis';

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── KPI ribbon ──────────────────────────────────────────────────────────────
export function KpiRibbon({ schedule, win }: { schedule: DrillingSchedule; win: Window }) {
  const acts = useMemo(() => allActivities(schedule).filter((a) => a.kind !== 'Rig'), [schedule]);
  const totalDays = acts.reduce((s, a) => s + a.days, 0);
  const fromProposals = acts.filter((a) => a.proposalId).length;

  const now = today();
  const nextMs = useMemo(
    () => [...schedule.milestones]
      .filter((m) => pd(m.date).getTime() >= now.getTime())
      .sort((a, b) => pd(a.date).getTime() - pd(b.date).getTime())[0],
    [schedule],
  );
  const rfsuDays = nextMs ? Math.round(db(now, pd(nextMs.date))) : null;

  const util = rigUtilization(schedule, iso(mi2d(win.mL)), iso(mi2d(win.mR)))[0];
  const R = 27, C = 2 * Math.PI * R;
  const off = C * (1 - (util?.pct ?? 0) / 100);

  return (
    <div className="dribbon">
      <div className="dmetric"><div className="edge" style={{ background: '#0FB5A6' }} />
        <div className="v">{acts.length}</div><div className="l">Wells scheduled</div></div>
      <div className="dmetric"><div className="edge" style={{ background: '#f59e0b' }} />
        <div className="v">{totalDays}<span className="u">d</span></div><div className="l">Σ P50 drilling days</div></div>
      <div className="dmetric"><div className="edge" style={{ background: '#2563eb' }} />
        <div className="v">{fromProposals}<span className="u"> / {acts.length}</span></div><div className="l">From approved proposals</div></div>
      <div className="dmetric"><div className="edge" style={{ background: '#e11d74' }} />
        <div className="v">{rfsuDays != null ? rfsuDays : '—'}<span className="u">d</span></div>
        <div className="l">{nextMs ? `Next RFSU · ${nextMs.label.replace(' RFSU', '')}` : 'No milestone'}</div></div>
      <div className="dmetric gauge">
        <div className="gwrap">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
            <circle cx="30" cy="30" r={R} fill="none" stroke={util?.rig.color ?? '#0FB5A6'} strokeWidth="6"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={off} transform="rotate(-90 30 30)" />
          </svg>
          <span className="pct">{util?.pct ?? 0}%</span>
        </div>
        <div className="gmeta">
          <div className="rig">{util?.rig.name ?? '—'}</div>
          <div className="l">Rig utilization · window</div>
          <div className="l mono">{util?.busyDays ?? 0} / {util?.spanDays ?? 0} busy days</div>
        </div>
      </div>
    </div>
  );
}

// ── Live insight rail ─────────────────────────────────────────────────────────
export function LiveRail({ schedule, activeFilter }: { schedule: DrillingSchedule; activeFilter: string | null }) {
  const sel = activeFilter?.startsWith('well:') ? activeFilter.slice(5) : null;

  if (sel) {
    const well = schedule.wells.find((w) => w.name === sel);
    const selActs = allActivities(schedule).filter((a) => a.well === sel);
    return (
      <div className="dinsp">
        <div className="dinsp-hd"><CalendarClock size={13} color="#e11d74" /> Well inspector</div>
        <div className="dinsp-b">
          {well && <>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{well.name}</div>
            <div className="dkv"><b>Reservoir</b><span style={{ color: well.reservoir ? RESERVOIR_COLOR[well.reservoir] : undefined }}>{well.reservoir ?? '—'}</span></div>
            <div className="dkv"><b>Role</b><span>{well.role}</span></div>
            <div className="dkv"><b>TD</b><span>{well.tdMd.toFixed(0)} m MD / {well.tdTvd.toFixed(0)} m TVD</span></div>
            <div className="dkv"><b>Surface</b><span>{well.x.toFixed(0)}, {well.y.toFixed(0)}</span></div>
            {well.firstProd && <div className="dkv"><b>First oil</b><span>{well.firstProd}</span></div>}
            <div className="dinsp-h">Scheduled</div>
            {selActs.map((a) => (
              <div key={a.id} className="dkv"><b>{a.kind}</b><span>{a.start} · {a.days}d <span className={`dnat ${a.dataNature}`}>{a.dataNature}</span></span></div>
            ))}
          </>}
        </div>
      </div>
    );
  }

  return <OperationsRail schedule={schedule} />;
}

function OperationsRail({ schedule }: { schedule: DrillingSchedule }) {
  const now = today();
  const acts = allActivities(schedule).filter((a) => a.kind !== 'Rig');

  // drilling now = activity whose window contains today; else next upcoming
  const drillingNow = acts.find((a) => pd(a.start).getTime() <= now.getTime() && pd(a.end).getTime() >= now.getTime())
    ?? acts.filter((a) => pd(a.start).getTime() > now.getTime()).sort((a, b) => pd(a.start).getTime() - pd(b.start).getTime())[0];
  const prog = drillingNow
    ? Math.max(0, Math.min(100, Math.round((db(pd(drillingNow.start), now) / drillingNow.days) * 100)))
    : 0;
  const dayN = drillingNow ? Math.max(0, Math.min(drillingNow.days, Math.round(db(pd(drillingNow.start), now)))) : 0;
  const remaining = drillingNow ? Math.max(0, drillingNow.days - dayN) : 0;
  const started = drillingNow ? pd(drillingNow.start).getTime() <= now.getTime() : false;

  const miles = [...schedule.milestones].sort((a, b) => pd(a.date).getTime() - pd(b.date).getTime()).slice(0, 3);
  const nonFid = acts.filter((a) => a.nonFid).length;
  const approved = acts.filter((a) => a.basis === 'APPROVED').length;

  return (
    <div className="dinsp">
      <div className="dinsp-hd"><CalendarClock size={13} color="#e11d74" /> Operations</div>
      <div className="dinsp-b">
        {drillingNow && (
          <div className="dnow">
            <span className="live"><span className="d" /> {started ? 'Drilling now' : 'Up next'}</span>
            <div className="wn">{drillingNow.well}</div>
            <div className="wm">{drillingNow.kind === 'App' ? 'Appraisal' : drillingNow.wellType === 'WI' ? 'Injector' : 'Producer'}
              {drillingNow.reservoir ? ` · ${drillingNow.reservoir}` : ''} · {drillingNow.rigId === 'RIG1' ? 'Rig 1' : 'Rig 2'}</div>
            {started && <div className="dprog"><i style={{ width: `${prog}%` }} /></div>}
            <div className="dkv"><b>{started ? 'Progress' : 'Starts'}</b><span className="mono">{started ? `${prog}% · day ${dayN}/${drillingNow.days}` : fmtDate(pd(drillingNow.start))}</span></div>
            {started && <div className="dkv"><b>P50 remaining</b><span className="mono">{remaining} days</span></div>}
            <div className="dkv" style={{ border: 0 }}><b>Basis</b><span style={{ color: 'var(--teal-ink)' }}>{drillingNow.basis}</span></div>
          </div>
        )}

        <div className="dai">
          <div className="hd"><span className="orb" /><span className="ey2">Cosmonaut · read-only</span></div>
          <div className="msg">
            Schedule holds <b>{acts.length} wells</b> across {schedule.rigs.length} rigs · <b>{approved}</b> approved from proposals.
            {nonFid > 0 && <> <span className="risk">{nonFid} non-FID {nonFid === 1 ? 'well needs' : 'wells need'} sanction</span> before their slot.</>}
            {miles[0] && <> Nearest gate <b>{miles[0].label}</b> in {Math.max(0, Math.round(db(now, pd(miles[0].date))))}d.</>}
          </div>
        </div>

        <div className="dinsp-h">Upcoming milestones</div>
        {miles.length === 0 && <div style={{ fontSize: 10.5, color: 'var(--ink3)' }}>None derived.</div>}
        {miles.map((m, i) => {
          const rig = schedule.rigs.find((r) => r.id === m.rigId);
          const dleft = Math.max(0, Math.round(db(now, pd(m.date))));
          return (
            <div key={i} className="dmile">
              <span className="tk" />
              <div><div className="mm">{m.label}</div>
                <div className="md">{fmtDate(pd(m.date))} · {rig?.name ?? 'Field'} · +{dleft}d</div></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

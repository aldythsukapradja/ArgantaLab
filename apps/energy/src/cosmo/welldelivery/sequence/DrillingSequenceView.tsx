// DrillingSequenceView — the Drilling Sequence lifecycle surface. Rebuild of the
// standalone NOC Drilling Schedule in the COSMO design system, on Volve data.
// 5 tabs (COSMO_Final contract): Overview · Sequence · Rigs · Milestones ·
// Revisions. The Sequence tab is the tool: time slider + rig-swimlane Gantt
// (resizable) + cross-filtering dashboard + field map drawer + legend.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Map as MapIcon, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { Window } from './time-axis';
import { clampWindow, d2mi, mi2d, today } from './time-axis';
import { buildSchedule, allActivities, RESERVOIR_COLOR } from './schedule-model';
import type { DrillingSchedule } from './schedule-model';
import { wellsInWindow } from './schedule-model';
import { filterLabel } from './filters';
import { TimeSlider } from './TimeSlider';
import { DrillingGantt } from './DrillingGantt';
import { DrillingDashboard } from './DrillingDashboard';
import { DrillingFieldMap } from './DrillingFieldMap';
import { OverviewView, RigsView, MilestonesView, RevisionsView } from './SequenceTabs';
import './drilling-sequence.css';

type Tab = 'overview' | 'sequence' | 'rigs' | 'milestones' | 'revisions';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'sequence', label: 'Sequence' },
  { id: 'rigs', label: 'Rigs' },
  { id: 'milestones', label: 'Milestones' },
  { id: 'revisions', label: 'Revisions' },
];

const LEGEND: { key: string; label: string; color: string }[] = [
  { key: 'act:Dev', label: 'Development', color: '#0FB5A6' },
  { key: 'welltype:WI', label: 'Injector', color: '#2563eb' },
  { key: 'act:App', label: 'Appraisal', color: '#f59e0b' },
  { key: 'act:WO', label: 'Workover', color: '#7c3aed' },
  { key: 'res:Hugin', label: 'Hugin', color: RESERVOIR_COLOR.Hugin },
  { key: 'res:Skagerrak', label: 'Skagerrak', color: RESERVOIR_COLOR.Skagerrak },
  { key: 'res:Ty', label: 'Ty', color: RESERVOIR_COLOR.Ty },
];

export function DrillingSequenceView() {
  const [tab, setTab] = useState<Tab>('sequence');
  const [schedule, setSchedule] = useState<DrillingSchedule | null>(null);
  const [win, setWin] = useState<Window>(() => {
    const start = d2mi(today());
    return clampWindow(start, start + 24);
  });
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [pmVisible, setPmVisible] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [inspOpen, setInspOpen] = useState(true);
  const [ganttH, setGanttH] = useState(320);

  useEffect(() => { buildSchedule().then(setSchedule); }, []);

  const acts = useMemo(() => (schedule ? allActivities(schedule) : []), [schedule]);
  const windowWells = useMemo(
    () => (schedule ? wellsInWindow(schedule, iso(mi2d(win.mL)), iso(mi2d(win.mR))) : new Set<string>()),
    [schedule, win],
  );

  const toggleFilter = (f: string) => setActiveFilter((cur) => (cur === f ? null : f));
  const pickWell = (well: string) => toggleFilter(`well:${well}`);

  // Splitter drag
  const splitRef = useRef<HTMLDivElement>(null);
  const onDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY, startH = ganttH;
    const wrap = splitRef.current!;
    const move = (ev: MouseEvent) => {
      const max = wrap.clientHeight - 90;
      setGanttH(Math.max(180, Math.min(max, startH + ev.clientY - startY)));
    };
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  // Keyboard: ←/→ pan 3mo, t today, 1/2 presets, Esc clear, p PM.
  useEffect(() => {
    if (tab !== 'sequence') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') setWin((w) => clampWindow(w.mL - 3, w.mR - 3));
      else if (e.key === 'ArrowRight') setWin((w) => clampWindow(w.mL + 3, w.mR + 3));
      else if (e.key === 't') { const s = d2mi(today()); setWin((w) => clampWindow(s, s + (w.mR - w.mL))); }
      else if (e.key === '1') { const s = d2mi(today()); setWin(clampWindow(s, s + 24)); }
      else if (e.key === '2') { const s = d2mi(today()); setWin(clampWindow(s, s + 60)); }
      else if (e.key === 'Escape') setActiveFilter(null);
      else if (e.key === 'p') setPmVisible((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab]);

  if (!schedule) {
    return <div className="dseq"><div className="dseq-empty"><CalendarClock size={22} style={{ marginBottom: 8, opacity: .5 }} /><div>Building the Volve drilling schedule…</div></div></div>;
  }

  return (
    <div className="dseq">
      <div className="dseq-tabs">
        {TABS.map((t) => (
          <div key={t.id} className={`dseq-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
            {t.id === 'sequence' && <CalendarClock size={12} />}
            {t.label}
            {t.id === 'sequence' && <span className="st">BETA</span>}
          </div>
        ))}
      </div>

      <div className="dseq-body">
        {tab === 'overview' && <OverviewView schedule={schedule} />}
        {tab === 'rigs' && <RigsView schedule={schedule} win={win} />}
        {tab === 'milestones' && <MilestonesView schedule={schedule} />}
        {tab === 'revisions' && <RevisionsView schedule={schedule} />}

        {tab === 'sequence' && (
          <>
            <div className="dseq-tools">
              <div className="dseg">
                <b className={win.mR - win.mL >= 23 && win.mR - win.mL <= 25 ? 'on' : ''} onClick={() => { const s = d2mi(today()); setWin(clampWindow(s, s + 24)); }}>24 Months</b>
                <b className={win.mR - win.mL >= 59 && win.mR - win.mL <= 61 ? 'on' : ''} onClick={() => { const s = d2mi(today()); setWin(clampWindow(s, s + 60)); }}>5 Years</b>
              </div>
              <div className="sp" />
              <button className={`dbtn pm${pmVisible ? ' on' : ''}`} onClick={() => setPmVisible((v) => !v)}>PM ▾</button>
              <button className={`dbtn${mapOpen ? ' on' : ''}`} onClick={() => setMapOpen((v) => !v)}><MapIcon size={12} /> MAP</button>
              <button className="dbtn" onClick={() => setInspOpen((v) => !v)} title="Toggle inspector">
                {inspOpen ? <PanelRightClose size={12} /> : <PanelRightOpen size={12} />}
              </button>
            </div>

            <div className={`dseq-ws${inspOpen ? '' : ' no-insp'}`}>
              <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                <TimeSlider win={win} onChange={setWin} activities={acts} />

                <div className="dseq-split" ref={splitRef}>
                  {activeFilter && (
                    <div className="dfbadge" onClick={() => setActiveFilter(null)}>{filterLabel(activeFilter)}</div>
                  )}
                  <div className="dgantt-pane" style={{ height: ganttH, flex: 'none' }}>
                    <DrillingGantt schedule={schedule} win={win} height={ganttH}
                      activeFilter={activeFilter} pmVisible={pmVisible} onPickWell={pickWell} />
                  </div>
                  <div className="ddrag" onMouseDown={onDragStart}><i /><i /><i /><i /><i /></div>
                  <div className="ddash-pane">
                    <DrillingDashboard schedule={schedule} activeFilter={activeFilter} onFilter={toggleFilter} />
                  </div>
                </div>

                <div className="dlegend">
                  {LEGEND.map((l) => (
                    <div key={l.key} className={`dleg${activeFilter === l.key ? ' on' : ''}`} onClick={() => toggleFilter(l.key)}>
                      <i style={{ background: l.color }} />{l.label}
                    </div>
                  ))}
                  <span className="date">Volve · planning horizon from {new Date(schedule.meta.anchor).toLocaleDateString()}</span>
                </div>

                <DrillingFieldMap schedule={schedule} open={mapOpen} onClose={() => setMapOpen(false)}
                  activeFilter={activeFilter} onPickWell={pickWell} windowWells={windowWells} />
              </div>

              {inspOpen && <Inspector schedule={schedule} activeFilter={activeFilter} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Inspector({ schedule, activeFilter }: { schedule: DrillingSchedule; activeFilter: string | null }) {
  const sel = activeFilter?.startsWith('well:') ? activeFilter.slice(5) : null;
  const selActs = sel ? allActivities(schedule).filter((a) => a.well === sel) : [];
  const well = sel ? schedule.wells.find((w) => w.name === sel) : null;

  return (
    <div className="dinsp">
      <div className="dinsp-hd"><CalendarClock size={13} color="#e11d74" /> Implementation map</div>
      <div className="dinsp-b">
        {well ? (
          <>
            <div className="dinsp-h">Selected well</div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{well.name}</div>
            <div className="dkv"><b>Reservoir</b><span style={{ color: well.reservoir ? RESERVOIR_COLOR[well.reservoir] : undefined }}>{well.reservoir ?? '—'}</span></div>
            <div className="dkv"><b>Role</b><span>{well.role}</span></div>
            <div className="dkv"><b>TD</b><span>{well.tdMd.toFixed(0)} m MD / {well.tdTvd.toFixed(0)} m TVD</span></div>
            <div className="dkv"><b>Surface</b><span>{well.x.toFixed(0)}, {well.y.toFixed(0)}</span></div>
            {well.firstProd && <div className="dkv"><b>First oil</b><span>{well.firstProd}</span></div>}
            <div className="dinsp-h">Scheduled activities</div>
            {selActs.map((a) => (
              <div key={a.id} className="dkv"><b>{a.kind}</b><span>{a.start} · {a.days}d <span className={`dnat ${a.dataNature}`}>{a.dataNature}</span></span></div>
            ))}
          </>
        ) : (
          <>
            <div className="dinsp-h">Grounding & governance</div>
            <div className="dkv"><b>Well universe</b><span>{schedule.wells.length} real Volve wells</span></div>
            <div className="dkv"><b>Geometry</b><span className="dnat measured">measured</span></div>
            <div className="dkv"><b>First-oil dates</b><span className="dnat reported">reported</span></div>
            <div className="dkv"><b>Timing</b><span className="dnat scenario">scenario</span></div>
            <div className="dkv"><b>From proposals</b><span>{schedule.meta.proposals} approved</span></div>
            <div className="dnote">
              Click any bar or map well to inspect it and cross-filter the schedule. Drilling
              <b> timing is scenario</b> — the Volve dataset carries no spud/TD dates, so bar placement
              is a plannable proposal, not a measured record. Every unit is tagged with its true data
              nature; approved Well Delivery proposals inject real P50 durations.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

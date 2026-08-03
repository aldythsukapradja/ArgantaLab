import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, CircleCheck, CircleDashed, Database, GitCompareArrows, Library, ShipWheel } from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import type { DrillingSchedule } from './legacy/schedule-model';
import { allActivities, wellCountByYear } from './legacy/schedule-model';
import { listRevisions } from './legacy/schedule-store';

const PAGE_SIZE = 6;
const roleLabel = (role: string) => role === 'none' ? 'wellbore' : role;

function EvidenceCard({ title, kind, value, linked, note }: { title: string; kind: string; value: string; linked: boolean; note: string }) {
  return <article className={'drs-evidence-card' + (linked ? ' linked' : '')}>{linked ? <CircleCheck size={14} /> : <CircleDashed size={14} />}<div><span>{kind}</span><b>{title}</b><small>{note}</small></div><strong>{value}</strong></article>;
}

export function DrillingKnowledgeBank({ selection, schedule }: { selection: SearchEntry; schedule: DrillingSchedule | null }) {
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [selection.id]);
  const activities = useMemo(() => schedule ? allActivities(schedule).filter((activity) => activity.kind !== 'Rig') : [], [schedule]);
  const years = useMemo(() => schedule ? wellCountByYear(schedule) : [], [schedule]);
  const pages = Math.max(1, Math.ceil((schedule?.wells.length ?? 0) / PAGE_SIZE));
  const wells = schedule?.wells.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) ?? [];
  const scenario = activities.filter((activity) => activity.dataNature === 'scenario').length;
  const approved = activities.filter((activity) => activity.basis === 'APPROVED').length;
  const nonFid = activities.filter((activity) => activity.nonFid).length;
  const revisions = typeof localStorage === 'undefined' ? [] : listRevisions();

  if (!schedule) return <section className="drs-kb-dashboard"><section className="drs-unlinked"><Database size={26} /><b>{selection.name} is in the master catalogue</b><span>No field-specific drilling programme is linked. Add the well universe, rig basis, readiness gates and schedule evidence to activate this Knowledge Bank.</span></section></section>;

  return <section className="drs-kb-dashboard" aria-label={`${selection.name} drilling Knowledge Bank`}>
    <section className="drs-kb-wells"><div className="drs-section-title"><Database size={14} /><span>Programme well set</span><em>{schedule.wells.length} Volve wellbores</em></div><div className="drs-programme-hero"><span>Campaign basis</span><b>Volve drilling programme</b><small>Measured well geometry · scenario sequence</small></div><div className="drs-well-list">{wells.map((well) => <div key={well.name}><span><b>{well.name}</b><small>{roleLabel(well.role)} · {well.reservoir}</small></span><em>{Math.round(well.tdMd).toLocaleString()} m MD</em></div>)}</div><div className="drs-pager"><button disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}><ChevronLeft size={12} /></button><span>{page + 1} / {pages}</span><button disabled={page + 1 >= pages} onClick={() => setPage((value) => Math.min(pages - 1, value + 1))}><ChevronRight size={12} /></button></div></section>

    <section className="drs-kb-rigs"><div className="drs-section-title"><ShipWheel size={14} /><span>Rig & campaign basis</span><em>{schedule.rigs.length} planning lanes</em></div><div className="drs-rig-grid">{schedule.rigs.map((rig) => <article key={rig.id}><i style={{ background: rig.color }} /><span>{rig.id}</span><b>{rig.name}</b><small>{rig.acts.filter((activity) => activity.kind !== 'Rig').length} activities · {rig.id === 'RIG1' ? 'field-linked unit' : 'scenario capacity slot'}</small></article>)}</div><div className="drs-campaign-track">{schedule.campaigns.map((campaign) => <div key={campaign.rigId}><i style={{ background: campaign.color }} /><span>{campaign.start}</span><b>{campaign.label}</b><em>{campaign.end}</em></div>)}</div><p className="drs-doctrine">Mærsk Inspirer is the Volve field rig basis. Rig B, durations, move gaps and future slot timing are explicitly scenario—not measured drilling history.</p></section>

    <section className="drs-kb-sequence"><div className="drs-section-title"><CalendarRange size={14} /><span>Sequence & readiness</span><em>anchor · {schedule.meta.anchor}</em></div><div className="drs-metric-grid"><div><span>Scheduled activities</span><b>{activities.length}</b><small>{scenario} scenario-timed</small></div><div><span>Approved proposal basis</span><b>{approved}</b><small>{schedule.meta.proposals} approved proposals loaded</small></div><div><span>RFSU milestones</span><b>{schedule.milestones.length}</b><small>{schedule.milestones.map((milestone) => milestone.label).join(' · ')}</small></div><div><span>Non-FID exposure</span><b>{nonFid}</b><small>scenario wells requiring sanction</small></div></div><div className="drs-year-strip">{years.slice(0, 5).map((year) => <div key={year.year}><span>{year.year}</span><b>{year.total}</b><small>{year.OP} OP · {year.WI} WI · {year.App} App</small></div>)}</div></section>

    <section className="drs-kb-evidence"><div className="drs-section-title"><Library size={14} /><span>Drilling knowledge & evidence</span><em>measured → interpreted → scenario</em></div><div className="drs-evidence-grid"><EvidenceCard title="Well master & geometry" kind="Measured / reported" linked value={`${schedule.wells.length} wells`} note="Coordinates, TD, role and well identity from the Volve bundle" /><EvidenceCard title="Reservoir assignment" kind="Interpreted" linked value={`${new Set(schedule.wells.map((well) => well.reservoir)).size} units`} note="Deepest picks mapped to Hugin, Skagerrak and Ty" /><EvidenceCard title="Rig-by-time sequence" kind="Scenario" linked={scenario > 0} value={`${scenario} bars`} note="Planning dates and deterministic P50 durations" /><EvidenceCard title="Schedule revisions" kind="Local decision record" linked={revisions.length > 0} value={`${revisions.length} saved`} note="Named snapshots and well-level schedule diffs" /></div><div className="drs-learning"><GitCompareArrows size={13} /><span>Legacy keeps the operational sequence, rig views, milestones and revision comparisons intact.</span></div></section>
  </section>;
}

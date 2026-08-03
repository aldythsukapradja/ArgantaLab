import { useMemo } from 'react';
import { AlertTriangle, BookMarked, CircleCheck, CircleDashed, Database, DraftingCompass, Gauge, Library, Route } from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import type { WellRow } from '../../wb/types';
import type { WdCandidate } from './legacy/types';
import { GATES } from './legacy/types';

const metres = (value: number | undefined) => value == null ? 'Not linked' : `${Math.round(value).toLocaleString()} m`;
const inches = (value: number) => Number.isInteger(value) ? `${value}″` : `${value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}″`;

function EvidenceCard({ title, kind, value, linked, note }: { title: string; kind: string; value: string; linked: boolean; note: string }) {
  return <article className={'wds-evidence-card' + (linked ? ' linked' : '')}>
    {linked ? <CircleCheck size={14} /> : <CircleDashed size={14} />}
    <div><span>{kind}</span><b>{title}</b><small>{note}</small></div><strong>{value}</strong>
  </article>;
}

export function WellKnowledgeBank({ selection, wells, well, onSelectWell, candidates }: {
  selection: SearchEntry;
  wells: WellRow[];
  well: WellRow | null;
  onSelectWell: (name: string) => void;
  candidates: WdCandidate[];
}) {
  const deepDive = selection.name.toUpperCase() === 'VOLVE' || selection.source === 'Volve';
  const design = useMemo(() => {
    if (!deepDive || !candidates.length) return null;
    return candidates.find((candidate) => candidate.target.anchorWell === well?.name)
      ?? candidates.find((candidate) => candidate.offsets.includes(well?.name ?? ''))
      ?? candidates[0];
  }, [candidates, deepDive, well]);
  const gate = GATES.find((item) => item.id === design?.gate);
  const architecture = design?.casing ?? [];
  const maxShoe = Math.max(design?.trajectory.tdMd ?? 1, ...architecture.map((row) => row.shoeMd));

  return <section className="wds-kb-dashboard" aria-label={`${selection.name} well design Knowledge Bank`}>
    <section className="wds-kb-wells">
      <div className="wds-section-title"><Database size={14} /><span>Field & well query</span><em>{deepDive ? `${wells.length} Volve wellbores` : 'catalogue result'}</em></div>
      <div className="wds-query-context"><span>{selection.type}</span><b>{selection.name}</b><small>{selection.source} · {selection.parent || 'parent not reported'}</small></div>
      {deepDive ? <div className="wds-well-list">
        {wells.map((item) => <button className={item.name === well?.name ? 'active' : ''} key={item.name} onClick={() => onSelectWell(item.name)}>
          <span><b>{item.name}</b><small>{item.role !== 'none' ? item.role : item.is_exploration ? 'exploration' : 'wellbore'}</small></span>
          <em>{Math.round(item.td_md).toLocaleString()} m MD</em>
        </button>)}
      </div> : <div className="wds-not-linked"><BookMarked size={20} /><b>No client design bundle linked</b><span>The global master-data hit is valid. Load the field’s well files, schematics and lessons to activate a typical architecture.</span></div>}
    </section>

    <section className="wds-kb-architecture">
      <div className="wds-section-title"><DraftingCompass size={14} /><span>Typical field architecture</span><em>{design ? `basis · ${design.name}` : 'awaiting evidence'}</em></div>
      {design ? <div className="wds-architecture-body">
        <div className="wds-well-schematic" aria-label="Typical casing architecture">
          <div className="wds-depth-scale"><span>0</span><span>{metres(maxShoe / 2)}</span><span>{metres(maxShoe)}</span></div>
          <div className="wds-bore-line" />
          {architecture.map((row, index) => <div className="wds-casing-row" key={row.section} style={{ top: `${Math.max(5, row.shoeMd / maxShoe * 82)}%`, width: `${82 - index * 13}%` }}>
            <i /><span>{row.section}</span><b>{inches(row.holeIn)} hole · {inches(row.csgIn)} casing</b><em>shoe {metres(row.shoeMd)}</em>
          </div>)}
          <div className="wds-target-marker" style={{ top: `${Math.min(91, design.target.md / maxShoe * 82)}%` }}><span>{design.target.formation}</span><b>{metres(design.target.md)} MD</b></div>
        </div>
        <div className="wds-design-facts">
          <div><span>Planned TD</span><b>{metres(design.trajectory.tdMd)}</b><small>{metres(design.trajectory.tdTvd)} TVD</small></div>
          <div><span>Profile</span><b>{design.trajectory.profile}</b><small>{design.trajectory.maxInclDeg}° max inclination</small></div>
          <div><span>Kick-off</span><b>{metres(design.trajectory.kopMd)}</b><small>{design.trajectory.maxDlsDeg30m}°/30 m max DLS</small></div>
          <div><span>Target</span><b>{design.target.formation}</b><small>{metres(Math.abs(design.target.tvdss))} TVDSS</small></div>
        </div>
      </div> : <div className="wds-panel-empty"><Route size={24} /><b>Architecture not yet linked</b><span>Field-specific evidence is required before a typical well can be stated.</span></div>}
    </section>

    <section className="wds-kb-maturation">
      <div className="wds-section-title"><Gauge size={14} /><span>Well maturation basis</span><em>{gate ? `${gate.dg} · ${gate.label}` : 'not assessed'}</em></div>
      {design ? <>
        <div className="wds-gate-track">{GATES.map((item) => <div className={GATES.indexOf(item) <= GATES.findIndex((candidate) => candidate.id === design.gate) ? 'reached' : ''} key={item.id}><i /><span>{item.dg}</span><b>{item.label}</b></div>)}</div>
        <div className="wds-objective"><span>Design intent</span><p>{design.objective}</p></div>
        <div className="wds-maturation-grid">
          <div><span>Offsets</span><b>{design.offsets.length}</b><small>{design.offsets.slice(0, 3).join(' · ')}</small></div>
          <div><span>Hole sections</span><b>{design.casing.length}</b><small>{design.casing.map((row) => inches(row.holeIn)).join(' · ')}</small></div>
          <div><span>Design risks</span><b>{design.risks.length}</b><small>{design.risks.filter((risk) => risk.severity === 'high').length} high-severity</small></div>
          <div><span>Barrier envelopes</span><b>{design.barriers.length}</b><small>{design.barriers.filter((barrier) => barrier.verified).length} verified</small></div>
        </div>
        <div className="wds-risk-callout"><AlertTriangle size={13} /><span>{design.risks[0]?.hazard ?? 'No top hazard recorded'}</span></div>
      </> : <div className="wds-panel-empty"><Gauge size={24} /><b>Maturation record unavailable</b><span>Connect the field’s well proposal and assurance artifacts.</span></div>}
    </section>

    <section className="wds-kb-evidence">
      <div className="wds-section-title"><Library size={14} /><span>Design knowledge & evidence</span><em>measured → interpreted → scenario</em></div>
      <div className="wds-evidence-grid">
        <EvidenceCard title="Well master & TD" kind="Measured field evidence" linked={Boolean(well)} value={well ? `${well.has.logs ? 'logs' : 'header'} · ${well.has.traj ? 'survey' : 'no survey'}` : 'not linked'} note={well ? `${well.name} · ${metres(well.td_md)} MD · ${metres(well.td_tvd)} TVD` : 'Select a linked field well'} />
        <EvidenceCard title="Typical architecture" kind="Field design pattern" linked={Boolean(design)} value={design ? `${architecture.length} sections` : 'awaiting'} note={design ? `${design.name} scenario, calibrated to Volve anchors` : 'No field-specific design basis'} />
        <EvidenceCard title="Offset lessons" kind="Maturation input" linked={Boolean(design?.offsets.length)} value={design ? `${design.offsets.length} offsets` : 'awaiting'} note={design?.offsets.join(' · ') || 'Link offset reports and end-of-well lessons'} />
        <EvidenceCard title="Assurance envelope" kind="Well integrity" linked={Boolean(design?.mudWindow.length)} value={design ? `${design.mudWindow.length} depth points` : 'awaiting'} note="Pore pressure · collapse · fracture · mud programme" />
      </div>
    </section>
  </section>;
}

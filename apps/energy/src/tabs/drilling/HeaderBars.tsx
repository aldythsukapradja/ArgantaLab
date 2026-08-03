import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CalendarClock, History, PanelsTopLeft, Search } from 'lucide-react';
import { loadSearchIndex, rankSearch, searchTypeLabel, type SearchEntry } from '../../cosmo/cockpit-search';
import type { DrillingSchedule } from './legacy/schedule-model';
import { allActivities } from './legacy/schedule-model';

export type DrillingMode = 'knowledge' | 'workspace';

const country = (value: string) => ({ NO: 'Norway', GB: 'United Kingdom' }[value] ?? value);

export function DrillingScopeBar({ selection, onSelect, onOpenLegacy }: { selection: SearchEntry; onSelect: (entry: SearchEntry) => void; onOpenLegacy: () => void }) {
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { loadSearchIndex().then(setIndex); }, []);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const searchable = useMemo(() => index?.filter((entry) => entry.type === 'field' || entry.type === 'wellbore') ?? [], [index]);
  const results = useMemo(() => query.trim() ? rankSearch(searchable, query, 10) : [], [query, searchable]);
  const pick = (entry: SearchEntry) => { onSelect(entry); setQuery(''); setOpen(false); };
  return <div className="drs-bar">
    <span className="drs-bar-label">Scope</span>
    <button className="drs-scope-btn" onClick={() => setOpen(true)}><CalendarClock size={13} /><span className="drs-crumb"><span>{selection.type === 'field' ? country(selection.parent) : 'Well'}</span><span className="sep">/</span><b>{selection.name}</b></span></button>
    <div className="drs-search" ref={ref}><Search size={13} /><input value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder={`Query ${searchable.length ? searchable.length.toLocaleString() : '…'} fields & wells`} />
      {open && results.length > 0 && <div className="drs-search-results">{results.map((entry) => <button key={entry.id} className="drs-search-result" onClick={() => pick(entry)}><span><b>{entry.name}</b><small>{searchTypeLabel(entry.type)} · {country(entry.parent) || entry.source}</small></span><em>{entry.source}</em></button>)}</div>}
      {open && query.trim() && index && results.length === 0 && <div className="drs-search-results"><div className="drs-search-empty">No field or well matches “{query}”</div></div>}
    </div>
    <span className="drs-spacer" /><button className="drs-legacy-btn" onClick={onOpenLegacy}><History size={13} /> Legacy (v1)</button>
  </div>;
}

export function ModeDossierBar({ selection, schedule, mode, onChange }: { selection: SearchEntry; schedule: DrillingSchedule | null; mode: DrillingMode; onChange: (mode: DrillingMode) => void }) {
  const activities = schedule ? allActivities(schedule).filter((activity) => activity.kind !== 'Rig') : [];
  const facts = [
    ['Field / asset', selection.type === 'field' ? selection.name : selection.source],
    ['Well universe', schedule ? schedule.wells.length.toLocaleString() : 'Not linked'],
    ['Rig lanes', schedule ? schedule.rigs.length.toLocaleString() : 'Not linked'],
    ['Activities', schedule ? activities.length.toLocaleString() : 'Not linked'],
    ['Timing nature', schedule ? 'Scenario' : 'Not assessed'],
  ];
  return <div className="drs-context-bar"><div className="drs-mode-switch" aria-label="Drilling view">
    <button className={mode === 'knowledge' ? 'active' : ''} onClick={() => onChange('knowledge')} aria-pressed={mode === 'knowledge'}><BookOpen size={13} /> Knowledge Bank</button>
    <button className={mode === 'workspace' ? 'active' : ''} onClick={() => onChange('workspace')} aria-pressed={mode === 'workspace'}><PanelsTopLeft size={13} /> Workspace</button>
  </div><section className="drs-dossier"><div className="drs-dossier-title"><span>Drilling programme dossier</span><b>{selection.name}</b></div>{facts.map(([label, value]) => <div className="drs-dossier-fact" key={label}><span>{label}</span><b>{value}</b></div>)}</section></div>;
}

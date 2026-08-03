import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Database, History, PanelsTopLeft, Search } from 'lucide-react';
import { loadSearchIndex, rankSearch, searchTypeLabel, type SearchEntry } from '../../cosmo/cockpit-search';
import type { WellRow } from '../../wb/types';

export type WellDeliveryMode = 'knowledge' | 'workspace';

const country = (value: string) => ({ NO: 'Norway', GB: 'United Kingdom' }[value] ?? value);

export function WellScopeBar({ selection, onSelect, onOpenLegacy }: {
  selection: SearchEntry;
  onSelect: (entry: SearchEntry) => void;
  onOpenLegacy: () => void;
}) {
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
  const select = (entry: SearchEntry) => { onSelect(entry); setQuery(''); setOpen(false); };

  return (
    <div className="wds-bar">
      <span className="wds-bar-label">Scope</span>
      <button className="wds-scope-btn" onClick={() => setOpen(true)} title="Change field or well">
        <Database size={13} />
        <span className="wds-crumb"><span>{selection.type === 'field' ? country(selection.parent) : 'Well'}</span><span className="sep">/</span><b>{selection.name}</b></span>
      </button>
      <div className="wds-search" ref={ref}>
        <Search size={13} />
        <input value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={`Query ${searchable.length ? searchable.length.toLocaleString() : '…'} fields & wells`} />
        {open && results.length > 0 && <div className="wds-search-results">
          {results.map((entry) => <button key={entry.id} className="wds-search-result" onClick={() => select(entry)}>
            <span><b>{entry.name}</b><small>{searchTypeLabel(entry.type)} · {country(entry.parent) || entry.source}</small></span><em>{entry.source}</em>
          </button>)}
        </div>}
        {open && query.trim() && index && results.length === 0 && <div className="wds-search-results"><div className="wds-search-empty">No field or well matches “{query}”</div></div>}
      </div>
      <span className="wds-spacer" />
      <button className="wds-legacy-btn" onClick={onOpenLegacy}><History size={13} /> Legacy (v1)</button>
    </div>
  );
}

export function ModeDossierBar({ selection, well, mode, onChange }: {
  selection: SearchEntry;
  well: WellRow | null;
  mode: WellDeliveryMode;
  onChange: (mode: WellDeliveryMode) => void;
}) {
  const facts = [
    ['Field / asset', selection.type === 'field' ? selection.name : (selection.source === 'Volve' ? 'VOLVE' : 'Not linked')],
    ['Reference well', well?.name ?? (selection.type === 'wellbore' ? selection.name : 'Select a well')],
    ['Role', well?.role && well.role !== 'none' ? well.role : 'Not reported'],
    ['TD MD', well ? `${well.td_md.toLocaleString()} m` : 'Not linked'],
    ['TD TVD', well ? `${well.td_tvd.toLocaleString()} m` : 'Not linked'],
  ];
  return <div className="wds-context-bar">
    <div className="wds-mode-switch" aria-label="Well Delivery view">
      <button className={mode === 'knowledge' ? 'active' : ''} onClick={() => onChange('knowledge')}><BookOpen size={13} /> Knowledge Bank</button>
      <button className={mode === 'workspace' ? 'active' : ''} onClick={() => onChange('workspace')}><PanelsTopLeft size={13} /> Workspace</button>
    </div>
    <div className="wds-dossier">
      <div className="wds-dossier-title"><span>Well design dossier</span><b>{selection.name}</b></div>
      {facts.map(([label, value]) => <div className="wds-dossier-fact" key={label}><span>{label}</span><b>{value}</b></div>)}
    </div>
  </div>;
}

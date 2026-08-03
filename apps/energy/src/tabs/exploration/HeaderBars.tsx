import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CircleDot, History, PanelsTopLeft, Search } from 'lucide-react';
import {
  loadSearchIndex, rankSearch, searchTypeLabel, type SearchEntry,
} from '../../cosmo/cockpit-search';

const SCOPE_TYPES = new Set(['country', 'province', 'assessment-unit']);

export function ExplorationScopeBar({ scope, onSelectScope, onOpenLegacy }: {
  scope: SearchEntry;
  onSelectScope: (scope: SearchEntry) => void;
  onOpenLegacy: () => void;
}) {
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSearchIndex().then(setIndex); }, []);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const scopedIndex = useMemo(() => index?.filter((entry) => SCOPE_TYPES.has(entry.type)) ?? [], [index]);
  const results = useMemo(() => query.trim() ? rankSearch(scopedIndex, query, 10) : [], [scopedIndex, query]);
  const pick = (entry: SearchEntry) => { onSelectScope(entry); setQuery(''); setOpen(false); };

  return (
    <div className="exs-bar">
      <span className="exs-bar-label">Scope</span>
      <button className="exs-scope-btn" onClick={() => setOpen(true)} title="Change exploration study scope">
        <CircleDot size={13} />
        <span className="exs-crumb"><span>{scope.parent}</span><span className="sep">/</span><b>{scope.name}</b></span>
      </button>
      <div className="exs-search" ref={boxRef}>
        <Search size={13} />
        <input value={query} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder={`Search ${scopedIndex.length ? scopedIndex.length.toLocaleString() : '…'} provinces, AUs and countries`} />
        {open && results.length > 0 && (
          <div className="exs-search-results">
            {results.map((result) => (
              <button key={result.id} className="exs-search-result" onClick={() => pick(result)}>
                <span>{result.name}</span>
                <small>{searchTypeLabel(result.type)} · {result.parent} · {result.source}</small>
              </button>
            ))}
          </div>
        )}
        {open && query.trim() && results.length === 0 && index && (
          <div className="exs-search-results"><div className="exs-search-empty">No scope matches “{query}”</div></div>
        )}
      </div>
      <span className="exs-spacer" />
      <button className="exs-legacy-btn" onClick={onOpenLegacy}><History size={13} /> Legacy (v1)</button>
    </div>
  );
}

export type ExplorationMode = 'knowledge' | 'workspace';

export function ModeDossierBar({ scope, mode, onChange }: {
  scope: SearchEntry;
  mode: ExplorationMode;
  onChange: (mode: ExplorationMode) => void;
}) {
  return (
    <div className="exs-context-bar">
      <div className="exs-mode-switch" aria-label="Exploration view">
        <button className={mode === 'knowledge' ? 'active' : ''} onClick={() => onChange('knowledge')} aria-pressed={mode === 'knowledge'}>
          <BookOpen size={13} /> Knowledge Bank
        </button>
        <button className={mode === 'workspace' ? 'active' : ''} onClick={() => onChange('workspace')} aria-pressed={mode === 'workspace'}>
          <PanelsTopLeft size={13} /> Workspace
        </button>
      </div>
      <ProvinceDossier scope={scope} />
    </div>
  );
}

function ProvinceDossier({ scope }: { scope: SearchEntry }) {
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  useEffect(() => { loadSearchIndex().then(setIndex); }, []);
  const directChildren = index?.filter((entry) => entry.parent === scope.name) ?? [];
  const childLabel = scope.type === 'province' ? 'Assessment units' : scope.type === 'country' ? 'Linked assets' : 'Child records';
  const coordinates = scope.fly ? `${scope.fly.lat.toFixed(2)}°, ${scope.fly.lon.toFixed(2)}°` : 'Not mapped';

  return (
    <section className="exs-dossier" aria-label={`${scope.name} exploration dossier`}>
      <div className="exs-dossier-title"><span>Exploration dossier</span><b>{scope.name}</b></div>
      <div className="exs-dossier-fact"><span>Scope</span><b>{searchTypeLabel(scope.type)}</b></div>
      <div className="exs-dossier-fact"><span>Parent</span><b>{scope.parent}</b></div>
      <div className="exs-dossier-fact"><span>{childLabel}</span><b>{index ? directChildren.length.toLocaleString() : 'Loading…'}</b></div>
      <div className="exs-dossier-fact"><span>Reference point</span><b>{coordinates}</b></div>
      <div className="exs-dossier-fact source"><span>System of record</span><b>{scope.source}</b></div>
    </section>
  );
}

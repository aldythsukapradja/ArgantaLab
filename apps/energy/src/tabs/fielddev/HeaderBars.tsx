// HeaderBars — two persistent rows.
//   Row 1 · navigation  — the selected field + the Legacy escape hatch.
//   Row 2 · context     — Knowledge Bank / Workspace mode + a sourced field dossier.
// Scope is real: backed by src/cosmo/cockpit-search.ts's loadSearchIndex/rankSearch,
// the same OSDU-grounded index (12,559 entries · 7,787 fields) the Cockpit's own
// search already uses. Nothing here is a hard-coded place list.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Search, History, BookOpen, PanelsTopLeft } from 'lucide-react';
import { loadSearchIndex, rankSearch, type SearchEntry } from '../../cosmo/cockpit-search';
import { FieldDossier } from './FieldDossier';

/** A handful of regulator source codes come through as ISO-ish shorthand rather
 *  than a display name (GOGET and ANP entries already carry full names/basins). */
const COUNTRY_LABEL: Record<string, string> = { NO: 'Norway', GB: 'United Kingdom' };
const parentLabel = (parent: string) => COUNTRY_LABEL[parent] ?? parent;

export function ScopeBar({ field, onSelectField, onOpenLegacy }: {
  field: SearchEntry | null;
  onSelectField: (f: SearchEntry) => void;
  onOpenLegacy: () => void;
}) {
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadSearchIndex().then(setIndex); }, []);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const results = useMemo(() => {
    if (!index || !query.trim()) return [];
    return rankSearch(index.filter((e) => e.type === 'field'), query, 8);
  }, [index, query]);

  const pick = (f: SearchEntry) => { onSelectField(f); setQuery(''); setOpen(false); };

  return (
    <div className="fds-bar">
      <span className="fds-bar-label">Scope</span>
      {field ? (
        <button className="fds-scope-btn" onClick={() => setOpen(true)} title="Change field — search the world catalogue">
          <Globe2 size={13} />
          <span className="fds-crumb">
            <span>{parentLabel(field.parent)}</span><span className="sep">/</span>
            <b>{field.name}</b>
          </span>
        </button>
      ) : (
        <span className="fds-scope-btn" style={{ opacity: 0.6 }}><Globe2 size={13} /> Loading catalogue…</span>
      )}
      <div className="fds-search" ref={boxRef}>
        <Search size={13} />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={`Search ${index ? index.filter((e) => e.type === 'field').length.toLocaleString() : '…'} fields worldwide`}
        />
        {open && results.length > 0 && (
          <div className="fds-search-results">
            {results.map((r) => (
              <div key={r.id} className="fds-search-result" onClick={() => pick(r)}>
                <span className="fds-search-result-name">{r.name}</span>
                <span className="fds-search-result-meta">{parentLabel(r.parent)} · {r.source}</span>
              </div>
            ))}
          </div>
        )}
        {open && query.trim() && results.length === 0 && index && (
          <div className="fds-search-results"><div className="fds-search-empty">No field matches “{query}”</div></div>
        )}
      </div>
      <span className="fds-scope-spacer" />
      <button className="fds-legacy-btn" onClick={onOpenLegacy} title="The original workbench — every engine there is truth-locked and reused by the new suite">
        <History size={13} /> Legacy (v1)
      </button>
    </div>
  );
}

export type FieldDevMode = 'knowledge' | 'workspace';

export function ModeDossierBar({ field, mode, onChange }: {
  field: SearchEntry;
  mode: FieldDevMode;
  onChange: (mode: FieldDevMode) => void;
}) {
  return (
    <div className="fds-context-bar">
      <div className="fds-mode-switch" aria-label="Field Development view">
        <button className={mode === 'knowledge' ? 'active' : ''} onClick={() => onChange('knowledge')} aria-pressed={mode === 'knowledge'}>
          <BookOpen size={13} /> Knowledge Bank
        </button>
        <button className={mode === 'workspace' ? 'active' : ''} onClick={() => onChange('workspace')} aria-pressed={mode === 'workspace'}>
          <PanelsTopLeft size={13} /> Workspace
        </button>
      </div>
      <FieldDossier field={field} />
    </div>
  );
}

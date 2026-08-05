import { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Globe2, History, PanelsTopLeft, Search } from 'lucide-react';
import { loadFieldDetail, type FieldDetail } from '../../cosmo/cockpit-field-detail';
import { loadSearchIndex, rankSearch, type SearchEntry } from '../../cosmo/cockpit-search';

export type ReservoirMode = 'knowledge' | 'workspace';

const countryName = (value: string) => ({ NO: 'Norway', GB: 'United Kingdom' }[value] ?? value);
const shown = (value: unknown) => value == null || value === '' ? 'Not reported' : String(value);

export function ReservoirScopeBar({ field, onSelectField, onOpenLegacy, children }: {
  field: SearchEntry | null;
  onSelectField: (field: SearchEntry) => void;
  onOpenLegacy: () => void;
  /** Mode switch + dossier, folded into this row so the header costs one line. */
  children?: React.ReactNode;
}) {
  const [index, setIndex] = useState<SearchEntry[]>([]);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => { void loadSearchIndex().then(setIndex); }, []);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (host.current && !host.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  const fields = useMemo(() => index.filter((entry) => entry.type === 'field'), [index]);
  const results = useMemo(() => query.trim() ? rankSearch(fields, query, 8) : [], [fields, query]);

  return (
    <div className="rms-bar">
      <button className="rms-scope" onClick={() => setOpen(true)} disabled={!field}>
        <Globe2 size={13} />
        {field ? <span>{countryName(field.parent)} <i>/</i> <b>{field.name}</b></span> : <span>Loading catalogue…</span>}
      </button>
      <div className="rms-search" ref={host}>
        <Search size={13} />
        <input value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          placeholder={`Search ${fields.length ? fields.length.toLocaleString() : '…'} fields`} />
        {open && query.trim() && (
          <div className="rms-results">
            {results.length ? results.map((result) => (
              <button key={result.id} onClick={() => { onSelectField(result); setQuery(''); setOpen(false); }}>
                <b>{result.name}</b><span>{countryName(result.parent)} · {result.source}</span>
              </button>
            )) : <div className="rms-result-empty">No matching field</div>}
          </div>
        )}
      </div>
      {/* The dossier is flex:1, so it — not a spacer — is what pushes Legacy right. */}
      {children ?? <span className="rms-spacer" />}
      <button className="rms-legacy" onClick={onOpenLegacy}><History size={13} /> Legacy (v1)</button>
    </div>
  );
}

export function ReservoirContextBar({ field, mode, onChange }: {
  field: SearchEntry;
  mode: ReservoirMode;
  onChange: (mode: ReservoirMode) => void;
}) {
  const [detail, setDetail] = useState<FieldDetail | null | undefined>();
  useEffect(() => {
    let alive = true;
    setDetail(undefined);
    void loadFieldDetail(field.id).then((value) => { if (alive) setDetail(value); });
    return () => { alive = false; };
  }, [field.id]);
  const volve = field.name.toUpperCase() === 'VOLVE';
  const fact = (value: unknown, fallback?: unknown) => detail === undefined
    ? 'Loading…'
    : shown(value == null || value === '' ? fallback : value);

  return (
    <>
      <div className="rms-mode" aria-label="Reservoir Management view">
        <button className={mode === 'knowledge' ? 'active' : ''} onClick={() => onChange('knowledge')}><BookOpen size={13} /> Knowledge</button>
        <button className={mode === 'workspace' ? 'active' : ''} onClick={() => onChange('workspace')}><PanelsTopLeft size={13} /> Workspace</button>
      </div>
      {/* Three facts only. The field name is already in the scope crumb beside the
          search box, and production start / setting live in the Surveillance Dossier. */}
      <div className="rms-dossier">
        <div title={`Production start ${fact(detail?.productionStartYear, volve ? 2008 : null)}`}><span>Status</span><b>{fact(detail?.status, volve ? 'Shut down' : null)}</b></div>
        <div title={fact([detail?.onshoreOffshore, detail?.productionType].filter(Boolean).join(' · '), volve ? 'Offshore · oil & gas' : null)}><span>Operator</span><b>{fact(detail?.operator, volve ? 'Equinor Energy AS' : null)}</b></div>
        <div className="wide"><span>RM coverage</span><b>{volve ? 'Deep-dive surveillance bundle' : 'GOGET field spine · client extension slot'}</b></div>
      </div>
    </>
  );
}

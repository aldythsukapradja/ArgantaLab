import {
  useEffect, useMemo, useState, type CSSProperties,
} from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import {
  Activity, BarChart3, Compass, Crosshair, Database, Drill, Globe2, Layers3,
  Map, Plus, Search, ShieldCheck, Sparkles,
  Waves, Wrench, X,
} from 'lucide-react';
import { CockpitMap, type CockpitSelection } from './CockpitMap';
import { CockpitMeshMap } from './CockpitMeshMap';
import { CockpitDossier } from './CockpitDossier';
import { CockpitReserveTowers } from './CockpitReserveTowers';
import { loadSearchIndex, rankSearch, searchTypeLabel, type SearchEntry } from './cockpit-search';
import './cockpit.css';

type Mode = '3d' | '2d';
type ThemeId = 'satellite' | 'openmap' | 'mesh';
type Place = {
  id: string;
  name: string;
  kind: string;
  parent: string;
  lon?: number;
  lat?: number;
  zoom: number;
  sample?: boolean;
};

type AgentDef = {
  id: string;
  name: string;
  short: string;
  icon: typeof Compass;
  color: string;
  state: string;
  proof: string;
  generic: string;
};

type CockpitInsights = {
  totals: {
    osduRecords: number;
    spatialFields: number;
    matchedFields: number;
    assessedProvinces: number;
    matchRate: number;
  };
  topProvinces: Array<{
    prvCode: string;
    prvName: string;
    fieldCount: number;
    boeMean: number | null;
  }>;
  provinceFields: Record<string, number>;
};

const VOLVE: Place = {
  id: 'volve',
  name: 'Volve',
  kind: 'Proof field',
  parent: 'Viking Graben · North Sea · Norway',
  lon: 1.9,
  lat: 58.44,
  zoom: 12,
  sample: true,
};

const PLACES: Place[] = [
  { id: 'earth', name: 'Global Energy Intelligence', kind: 'Global portfolio', parent: 'Basins · assets · wells · decisions', lon: 12, lat: 18, zoom: 1.05 },
  { id: 'norway', name: 'Norway', kind: 'Country', parent: 'Europe', lon: 10.2, lat: 64.4, zoom: 4.8 },
  { id: 'north-sea', name: 'North Sea Graben', kind: 'Basin', parent: 'Europe · offshore', lon: 2.5, lat: 58, zoom: 8 },
  { id: 'viking-graben', name: 'Viking Graben', kind: 'Assessment unit', parent: 'North Sea Graben', lon: 2.2, lat: 59, zoom: 10 },
  VOLVE,
];

const THEMES: Array<{ id: ThemeId; name: string; icon: typeof Globe2 }> = [
  { id: 'satellite', name: 'Satellite', icon: Globe2 },
  { id: 'openmap', name: 'Open Map', icon: Map },
  { id: 'mesh', name: 'Mesh', icon: Layers3 },
];

const AGENTS: AgentDef[] = [
  {
    id: 'exploration', name: 'Exploration', short: 'EXP', icon: Compass, color: '#2dd4bf', state: 'BETA',
    proof: 'On Volve, analogue evidence and remaining trap risk are already connected to source.',
    generic: 'Screen basins, plays and prospects with risk, analogue and evidence context already connected.',
  },
  {
    id: 'field-development', name: 'Field Development', short: 'FD', icon: Layers3, color: '#38bdf8', state: 'LIVE',
    proof: 'On Volve, fault-block connectivity supports the preferred concept with traceable confidence.',
    generic: 'Move from static model and volumes to concepts, wells and economics without breaking lineage.',
  },
  {
    id: 'well-delivery', name: 'Well Delivery', short: 'WD', icon: Wrench, color: '#fbbf24', state: 'BETA',
    proof: 'On Volve, the proposed well clears the depth envelope while the casing window stays stable.',
    generic: 'Turn approved well intent into trajectory, drilling, completion and readiness decisions.',
  },
  {
    id: 'reservoir-management', name: 'Reservoir Management', short: 'RM', icon: Waves, color: '#a78bfa', state: 'LIVE',
    proof: 'On Volve, the agent detects the water-cut deviation and frames the next intervention.',
    generic: 'Unify surveillance, forecasting and opportunities around the asset’s live performance.',
  },
  {
    id: 'drilling-sequence', name: 'Drilling', short: 'DRL', icon: Drill, color: '#fb7185', state: 'BETA',
    proof: 'On Volve, the recommended sequence protects rig continuity and first-oil logic.',
    generic: 'Sequence mature well stock against rig capacity, constraints, milestones and value.',
  },
];

const RESULT_ICON: Record<SearchEntry['type'], React.ReactElement> = {
  field: <Crosshair size={15} />,
  province: <Globe2 size={15} />,
  'assessment-unit': <Layers3 size={15} />,
  wellbore: <Wrench size={15} />,
  company: <Database size={15} />,
  country: <Map size={15} />,
};

export function Cockpit({ dark, onNavigate }: { dark: boolean; onNavigate: (id: string) => void }) {
  const [mode, setMode] = useState<Mode>('3d');
  const [theme, setTheme] = useState<ThemeId>('satellite');
  const [place, setPlace] = useState<Place>(PLACES[0]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selection, setSelection] = useState<CockpitSelection | null>(null);
  const [insights, setInsights] = useState<CockpitInsights | null>(null);
  // Stream D: the real OSDU-grounded search index (fields · provinces · AUs · wellbores ·
  // companies · countries), fetched lazily on first search-box interaction — never a
  // hard-coded place list. PLACES remains the curated zero-query "quick jumps" home view.
  const [searchIndex, setSearchIndex] = useState<SearchEntry[] | null>(null);
  // §10 3D reserve towers — deck.gl overlay attached to the live MapLibre instance once ready
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [showTowers, setShowTowers] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL || '/'}osdu/cockpit-insights.json`)
      .then((response) => response.json())
      .then(setInsights)
      .catch(() => setInsights(null));
  }, []);

  useEffect(() => {
    if (searchOpen && !searchIndex) loadSearchIndex().then(setSearchIndex);
  }, [searchOpen, searchIndex]);

  const catalogueResults = useMemo(() => {
    if (!query.trim() || !searchIndex) return null;
    return rankSearch(searchIndex, query);
  }, [query, searchIndex]);
  const results = catalogueResults ?? (query.trim()
    ? PLACES.filter((item) => `${item.name} ${item.kind} ${item.parent}`.toLowerCase().includes(query.trim().toLowerCase()))
    : PLACES);

  // fly-to target for the map — changes only when a place is selected (stable identity)
  const focus = useMemo(
    () => (place.lon != null && place.lat != null ? { lon: place.lon, lat: place.lat, zoom: place.zoom } : null),
    [place],
  );

  const selectPlace = (next: Place) => {
    setPlace(next);
    setQuery('');
    setSearchOpen(false);
  };

  const recognizeField = () => {
    const name = query.trim() || 'Your field';
    selectPlace({ id: `private-${name}`, name, kind: 'Private field', parent: 'Ready to connect to the Arganta data spine', zoom: 1.3 });
  };

  const isPlace = (r: Place | SearchEntry): r is Place => !('tokens' in r);

  // Stream D/E bridge: selecting a real catalogue result flies the map to its geometry and,
  // for fields, opens the real dossier immediately (fetching detail by OSDU id) rather than
  // waiting for the user to click the rendered feature. Non-field types fly-to only; the user
  // clicks the polygon after arriving to open its full popup (province/AU/wellbore/company
  // records don't carry enough in the lightweight search index to build a full dossier here).
  const selectCatalogueResult = (entry: SearchEntry) => {
    setQuery(''); setSearchOpen(false);
    if (entry.fly) {
      const zoom = entry.type === 'field' ? 9.5 : entry.type === 'wellbore' ? 12 : entry.type === 'assessment-unit' ? 6.5 : 4.5;
      setPlace({ id: entry.id, name: entry.name, kind: searchTypeLabel(entry.type), parent: entry.parent, lon: entry.fly.lon, lat: entry.fly.lat, zoom });
    }
    if (entry.type === 'field') {
      const [country, basin] = entry.parent.split(' · ');
      setSelection({
        id: entry.id, name: entry.name, type: 'Field', source: entry.source, detail: [],
        raw: { id: entry.id, name: entry.name, country: country ?? '', basin: basin ?? '', aliases: entry.aliases },
      });
    } else {
      setSelection(null);
    }
  };

  const isSample = place.sample === true;
  const currentTheme = THEMES.find((item) => item.id === theme)!;
  const selectSpatial = (next: CockpitSelection | null) => {
    if (!next || !insights || next.type !== 'Petroleum province') {
      setSelection(next);
      return;
    }
    const fieldCount = insights.provinceFields[next.id] ?? 0;
    const rank = insights.topProvinces.findIndex((province) => province.prvCode === next.id);
    setSelection({
      ...next,
      detail: [
        ['OSDU fields', fieldCount.toLocaleString()],
        ...(rank >= 0 ? [['Field-density rank', `#${rank + 1} globally`] as [string, string]] : []),
        ...next.detail,
      ],
    });
  };
  const leadInsight = insights?.topProvinces[0];
  return (
    <section className="aeck" aria-label="ArgantaEnergy cockpit">
      <div className="aeck-bar">
        <div className="aeck-title">
          <span className="aeck-product-icon"><Globe2 size={17} /></span>
          <span className="aeck-product-copy">
            <strong>Global Energy Intelligence</strong>
            <small>Live OSDU spatial evidence · governed by source</small>
          </span>
        </div>

        <div className={'aeck-search' + (searchOpen ? ' open' : '')}>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchOpen(false);
              if (event.key === 'Enter' && results[0]) {
                const first = results[0];
                if (isPlace(first)) selectPlace(first); else selectCatalogueResult(first);
              }
            }}
            placeholder="Search field, basin, well, province or company"
            aria-label="Search field, basin, well, province or company"
            aria-expanded={searchOpen}
          />
          {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
          {searchOpen && (
            <div className="aeck-results">
              <div className="aeck-result-kicker">{catalogueResults ? `${catalogueResults.length} OSDU CATALOGUE MATCHES` : 'SEARCH THE ENERGY WORLD'}</div>
              {query.trim() && searchIndex === null && <div className="aeck-result-loading">Loading the OSDU catalogue index…</div>}
              {results.map((result) => (
                isPlace(result) ? (
                  <button key={result.id} onClick={() => selectPlace(result)}>
                    <span className="aeck-result-icon">{result.kind === 'Country' ? <Map size={15} /> : result.sample ? <Crosshair size={15} /> : <Globe2 size={15} />}</span>
                    <span><b>{result.name}</b><small>{result.kind} · {result.parent}</small></span>
                    {result.sample && <em>PROOF</em>}
                  </button>
                ) : (
                  <button key={result.id} onClick={() => selectCatalogueResult(result)}>
                    <span className="aeck-result-icon">{RESULT_ICON[result.type]}</span>
                    <span><b>{result.name}</b><small>{searchTypeLabel(result.type)} · {result.parent || result.source}</small></span>
                    {result.aliases.length > 0 && <em>+{result.aliases.length}</em>}
                  </button>
                )
              ))}
              {query.trim() && !results.some((result) => result.name.toLowerCase() === query.trim().toLowerCase()) && (
                <button className="aeck-recognize" onClick={recognizeField}>
                  <span className="aeck-result-icon"><Plus size={15} /></span>
                  <span><b>Recognize “{query.trim()}”</b><small>Create a private field context and connect its data spine</small></span>
                </button>
              )}
              <div className="aeck-result-foot"><ShieldCheck size={12} /> Public world context · private field data stays sovereign</div>
            </div>
          )}
        </div>

        <div className="aeck-view-switch" aria-label="Map dimension">
          <button className={mode === '2d' ? 'on' : ''} onClick={() => setMode('2d')} aria-pressed={mode === '2d'}><Map size={14} />2D</button>
          <button className={mode === '3d' ? 'on' : ''} onClick={() => setMode('3d')} aria-pressed={mode === '3d'}><Globe2 size={14} />3D</button>
          <button
            className={showTowers ? 'on' : ''}
            onClick={() => setShowTowers((v) => !v)}
            aria-pressed={showTowers}
            disabled={theme === 'mesh'}
            title={theme === 'mesh' ? 'Reserve towers need Satellite or Open Map view' : 'Toggle 3D reserve towers'}
          ><BarChart3 size={14} />Towers</button>
        </div>
      </div>

      <div className="aeck-stage" onClick={() => { if (searchOpen) setSearchOpen(false); }}>
        {theme === 'mesh'
          ? <CockpitMeshMap dark={dark} onSelect={selectSpatial} />
          : <CockpitMap dark={dark} mode={mode} theme={theme} focus={focus} onSelect={selectSpatial} onMapReady={setMapInstance} />}
        {theme !== 'mesh' && (
          <CockpitReserveTowers map={mapInstance} visible={showTowers} selectedId={selection?.type === 'Field' ? selection.id : null} />
        )}

        {selection ? (
          selection.type === 'Field' ? (
            <CockpitDossier selection={selection} onClose={() => setSelection(null)} onNavigate={onNavigate} />
          ) : (
            <aside className="aeck-context aeck-inspector" aria-label="Selected spatial object">
              <button className="aeck-inspector-close" onClick={() => setSelection(null)} aria-label="Close spatial information"><X size={14} /></button>
              <span className="private">{selection.type.toUpperCase()}</span>
              <h1>{selection.name}</h1>
              <p>{selection.source}</p>
              <div className="aeck-inspector-rows">
                {selection.detail.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}
              </div>
              <button className="aeck-dive" onClick={() => onNavigate('field-development')}><Layers3 size={14} />OPEN EVIDENCE WORKSPACE <span>↗</span></button>
            </aside>
          )
        ) : (
          <div className="aeck-context">
            <span className={isSample ? 'sample' : 'private'}>{isSample ? 'PUBLIC-DATA PROOF · VOLVE' : 'ONE SPATIAL OPERATING PICTURE'}</span>
            <h1>{isSample ? 'Proof, not the boundary.' : 'See every asset. Ask every lifecycle.'}</h1>
            <p>{isSample
              ? 'Volve proves ArgantaEnergy working end to end—from source evidence to lifecycle decisions. Your portfolio belongs here next.'
              : 'Navigate from global opportunity to field-level evidence. Select any polygon or asset to inspect its OSDU context.'}</p>
            {insights && leadInsight && (
              <div className="aeck-context-insight">
                <Sparkles size={13} />
                <span>
                  <b>{insights.totals.matchedFields.toLocaleString()} fields connected</b>
                  {leadInsight.prvName} has the strongest catalog overlap with {leadInsight.fieldCount.toLocaleString()} fields.
                </span>
              </div>
            )}
            <div className="aeck-context-meta">
              <span><Database size={12} />OSDU spatial spine</span>
              <span><Activity size={12} />Evidence linked</span>
            </div>
          </div>
        )}

        <div className="aeck-theme-rail">
          {THEMES.map((item) => (
            <button key={item.id} className={theme === item.id ? 'on' : ''} onClick={() => {
              setTheme(item.id);
              if (item.id === 'openmap') setMode('2d');
            }} title={item.name} aria-label={`${item.name} map theme`} aria-pressed={theme === item.id}>
              <item.icon size={16} /><span>{item.name}</span>
            </button>
          ))}
        </div>

        <div className="aeck-map-caption">
          <currentTheme.icon size={13} />{currentTheme.name} · {mode === '3d' ? 'globe' : theme === 'mesh' ? 'D3 mesh' : 'interactive map'}
          <span>Drag to move · scroll to zoom</span>
        </div>
      </div>

      <div className="aeck-agents">
        <div className="aeck-agent-intro">
          <span><Sparkles size={13} />FIVE LIFECYCLE AGENTS</span>
          <strong>One field of view. Five expert workforces.</strong>
          <small>{isSample ? 'Volve is the public proof; every agent is built for your portfolio.' : 'Move from spatial context to an accountable decision workspace.'}</small>
        </div>
        <div className="aeck-agent-scroll">
          {AGENTS.map((agent) => (
            <button key={agent.id} className="aeck-agent" style={{ '--agent': agent.color } as CSSProperties} onClick={() => onNavigate(agent.id)}>
              <span className="aeck-agent-head">
                <span className="aeck-agent-icon"><agent.icon size={16} /></span>
                <span><b>{agent.name}</b><small>{agent.short} AGENT</small></span>
                <em>{agent.state}</em>
              </span>
              <span className="aeck-agent-copy">{isSample ? agent.proof : agent.generic}</span>
              <span className="aeck-agent-action">OPEN WORKSPACE <span>↗</span></span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

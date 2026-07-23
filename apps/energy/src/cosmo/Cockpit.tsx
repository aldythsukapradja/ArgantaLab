import {
  useCallback, useEffect, useMemo, useRef, useState, type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  Activity, Boxes, Compass, Crosshair, Database, Drill, Globe2, Layers3,
  LocateFixed, Map, Minus, Plus, Radar, Search, ShieldCheck, Sparkles,
  Waves, Wrench, X,
} from 'lucide-react';
import { loadWorldManifest, loadWorldProvinces } from '../world/load';
import type { WorldManifest } from '../world/types';
import './cockpit.css';

type Mode = '3d' | '2d';
type ThemeId = 'satellite' | 'resource' | 'mesh' | 'subsurface';
type Position = [number, number];
type Ring = Position[];

type MapProvince = {
  code: string;
  name: string;
  boe: number;
  rings: Ring[];
  centroid: Position;
};

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
  { id: 'resource', name: 'Petroleum', icon: Radar },
  { id: 'mesh', name: 'Mesh', icon: Layers3 },
  { id: 'subsurface', name: 'Subsurface', icon: Boxes },
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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const radians = (degrees: number) => degrees * Math.PI / 180;

function ringsFromGeometry(type: string, coordinates: unknown): Ring[] {
  if (type === 'Polygon') return coordinates as Ring[];
  if (type === 'MultiPolygon') return (coordinates as Ring[][]).flat();
  return [];
}

function centroid(rings: Ring[]): Position {
  const ring = rings[0] ?? [];
  if (!ring.length) return [0, 0];
  let lon = 0;
  let lat = 0;
  const step = Math.max(1, Math.floor(ring.length / 120));
  let count = 0;
  for (let i = 0; i < ring.length; i += step) {
    lon += ring[i][0];
    lat += ring[i][1];
    count += 1;
  }
  return [lon / count, lat / count];
}

function projectGlobe(
  lon: number,
  lat: number,
  centerLon: number,
  centerLat: number,
  cx: number,
  cy: number,
  radius: number,
) {
  const lambda = radians(lon - centerLon);
  const phi = radians(lat);
  const phi0 = radians(centerLat);
  const cosPhi = Math.cos(phi);
  const x = cosPhi * Math.sin(lambda);
  const y = Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * cosPhi * Math.cos(lambda);
  const z = Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * cosPhi * Math.cos(lambda);
  return { x: cx + radius * x, y: cy - radius * y, visible: z > 0.015, z };
}

function colorFor(theme: ThemeId, strength: number, alpha = 1) {
  const t = clamp(strength, 0, 1);
  if (theme === 'resource') return `rgba(${Math.round(245 - 90 * t)},${Math.round(158 + 58 * t)},${Math.round(11 + 115 * t)},${alpha})`;
  if (theme === 'mesh') return `rgba(56,189,248,${alpha})`;
  if (theme === 'subsurface') return `rgba(${Math.round(167 + 55 * t)},${Math.round(139 - 60 * t)},${Math.round(250 - 40 * t)},${alpha})`;
  return `rgba(${Math.round(43 + 20 * t)},${Math.round(112 + 62 * t)},${Math.round(106 + 50 * t)},${alpha})`;
}

function drawMap(
  canvas: HTMLCanvasElement,
  provinces: MapProvince[],
  mode: Mode,
  theme: ThemeId,
  center: { lon: number; lat: number; zoom: number },
  place: Place,
  dark: boolean,
) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width;
  const h = rect.height;
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, dark ? (theme === 'subsurface' ? '#090819' : '#06131f') : (theme === 'subsurface' ? '#f0edff' : '#edf7f6'));
  bg.addColorStop(.52, dark ? '#071a28' : '#dcebea');
  bg.addColorStop(1, dark ? (theme === 'resource' ? '#171109' : '#06111b') : (theme === 'resource' ? '#fff5df' : '#f5faf9'));
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const seed = 41;
  ctx.fillStyle = dark ? 'rgba(168,220,233,.18)' : 'rgba(37,99,105,.10)';
  for (let i = 0; i < 110; i += 1) {
    const x = ((i * 73 + seed) % 997) / 997 * w;
    const y = ((i * 157 + seed) % 991) / 991 * h;
    ctx.fillRect(x, y, i % 7 === 0 ? 1.3 : .7, i % 7 === 0 ? 1.3 : .7);
  }

  const maxBoe = 65000;
  if (mode === '2d') {
    const scale = (w / 360) * center.zoom;
    const project = (lon: number, lat: number) => ({
      x: w / 2 + (lon - center.lon) * scale,
      y: h / 2 - (lat - center.lat) * scale,
    });

    ctx.lineWidth = 1;
    for (let lon = -180; lon <= 180; lon += center.zoom > 6 ? 5 : 20) {
      const a = project(lon, -86);
      const b = project(lon, 86);
      ctx.strokeStyle = dark ? 'rgba(126,187,205,.09)' : 'rgba(37,92,99,.10)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    for (let lat = -80; lat <= 80; lat += center.zoom > 6 ? 5 : 20) {
      const a = project(-180, lat);
      const b = project(180, lat);
      ctx.strokeStyle = dark ? 'rgba(126,187,205,.09)' : 'rgba(37,92,99,.10)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    provinces.forEach((province) => {
      const strength = Math.log1p(province.boe) / Math.log1p(maxBoe);
      province.rings.forEach((ring) => {
        if (ring.length < 3) return;
        const step = Math.max(1, Math.floor(ring.length / 100));
        ctx.beginPath();
        let lastX: number | null = null;
        for (let i = 0; i < ring.length; i += step) {
          const point = project(ring[i][0], ring[i][1]);
          if (lastX === null || Math.abs(point.x - lastX) > w * .65) ctx.moveTo(point.x, point.y);
          else ctx.lineTo(point.x, point.y);
          lastX = point.x;
        }
        ctx.closePath();
        ctx.fillStyle = colorFor(theme, strength, theme === 'mesh' ? .035 : .13 + strength * .17);
        ctx.strokeStyle = colorFor(theme, strength, .22 + strength * .4);
        ctx.lineWidth = theme === 'mesh' ? .75 : 1;
        ctx.fill();
        ctx.stroke();
      });
    });

    if (center.zoom >= 5) {
      provinces
        .filter((province) => province.boe > 2500)
        .slice()
        .sort((a, b) => b.boe - a.boe)
        .slice(0, center.zoom > 9 ? 28 : 15)
        .forEach((province) => {
          const p = project(province.centroid[0], province.centroid[1]);
          if (p.x < -120 || p.x > w + 120 || p.y < -20 || p.y > h + 20) return;
          ctx.font = '600 9px Inter, sans-serif';
          ctx.fillStyle = dark ? 'rgba(222,241,244,.72)' : 'rgba(24,68,75,.72)';
          ctx.textAlign = 'center';
          ctx.fillText(province.name.toUpperCase(), p.x, p.y);
        });
    }

    if (theme === 'subsurface' && center.zoom > 7) {
      for (let i = 0; i < 11; i += 1) {
        ctx.strokeStyle = `rgba(167,139,250,${.08 + i * .018})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(w * .53, h * .51, 74 + i * 18, 31 + i * 8, -.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    if (place.lon !== undefined && place.lat !== undefined) {
      const p = project(place.lon, place.lat);
      drawMarker(ctx, p.x, p.y, place.name, place.sample, dark);
    }
  } else {
    const radius = Math.min(w * .36, h * .72) * clamp(.82 + center.zoom * .04, .88, 1.16);
    const cx = w * (w < 700 ? .5 : .52);
    const cy = h * .48;
    const ocean = ctx.createRadialGradient(cx - radius * .35, cy - radius * .38, radius * .05, cx, cy, radius);
    ocean.addColorStop(0, dark ? '#1e6d7b' : '#d9f2ef');
    ocean.addColorStop(.48, dark ? '#0b3449' : '#9bcfce');
    ocean.addColorStop(.86, dark ? '#061b2b' : '#5e9fa4');
    ocean.addColorStop(1, dark ? '#02070d' : '#326f79');
    ctx.shadowColor = theme === 'subsurface' ? 'rgba(167,139,250,.45)' : (dark ? 'rgba(40,211,190,.42)' : 'rgba(22,126,124,.28)');
    ctx.shadowBlur = 42;
    ctx.fillStyle = ocean;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    provinces.forEach((province) => {
      const strength = Math.log1p(province.boe) / Math.log1p(maxBoe);
      province.rings.forEach((ring) => {
        if (ring.length < 3) return;
        const step = Math.max(1, Math.floor(ring.length / 75));
        ctx.beginPath();
        let drawing = false;
        let visiblePoints = 0;
        for (let i = 0; i < ring.length; i += step) {
          const p = projectGlobe(ring[i][0], ring[i][1], center.lon, center.lat, cx, cy, radius);
          if (!p.visible) { drawing = false; continue; }
          if (!drawing) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
          drawing = true;
          visiblePoints += 1;
        }
        if (visiblePoints < 3) return;
        ctx.closePath();
        ctx.fillStyle = colorFor(theme, strength, theme === 'mesh' ? .03 : .18 + strength * .2);
        ctx.strokeStyle = colorFor(theme, strength, .34 + strength * .44);
        ctx.lineWidth = theme === 'mesh' ? .7 : .9;
        ctx.fill();
        ctx.stroke();
      });
    });

    ctx.strokeStyle = dark ? 'rgba(159,226,231,.16)' : 'rgba(20,82,90,.16)';
    ctx.lineWidth = .7;
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let started = false;
      for (let lon = -180; lon <= 180; lon += 3) {
        const p = projectGlobe(lon, lat, center.lon, center.lat, cx, cy, radius);
        if (!p.visible) { started = false; continue; }
        if (!started) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        started = true;
      }
      ctx.stroke();
    }

    if (place.lon !== undefined && place.lat !== undefined) {
      const p = projectGlobe(place.lon, place.lat, center.lon, center.lat, cx, cy, radius);
      if (p.visible) drawMarker(ctx, p.x, p.y, place.name, place.sample, dark);
    }
    const rim = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    rim.addColorStop(0, 'rgba(77,220,211,.08)');
    rim.addColorStop(.52, dark ? 'rgba(255,255,255,.22)' : 'rgba(255,255,255,.7)');
    rim.addColorStop(1, 'rgba(15,181,166,.4)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  sample = false,
  dark = true,
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(45,212,191,.45)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i += 1) {
    ctx.beginPath(); ctx.arc(x, y, 7 + i * 8, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.shadowColor = '#2dd4bf';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#5eead4';
  ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = '700 10px Inter, sans-serif';
  const text = label.toUpperCase() + (sample ? ' · PROOF' : '');
  const width = ctx.measureText(text).width + 16;
  ctx.fillStyle = dark ? 'rgba(4,17,27,.9)' : 'rgba(255,255,255,.92)';
  ctx.strokeStyle = 'rgba(94,234,212,.45)';
  ctx.beginPath();
  ctx.roundRect(x + 12, y - 15, width, 24, 7);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = dark ? '#dffcf8' : '#153e46';
  ctx.textAlign = 'left';
  ctx.fillText(text, x + 20, y + 1);
  ctx.restore();
}

export function Cockpit({ dark, onNavigate }: { dark: boolean; onNavigate: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [mode, setMode] = useState<Mode>('3d');
  const [theme, setTheme] = useState<ThemeId>('satellite');
  const [place, setPlace] = useState<Place>(PLACES[0]);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [provinces, setProvinces] = useState<MapProvince[]>([]);
  const [manifest, setManifest] = useState<WorldManifest | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [camera, setCamera] = useState({ lon: PLACES[0].lon!, lat: PLACES[0].lat!, zoom: PLACES[0].zoom });

  useEffect(() => {
    let active = true;
    Promise.all([loadWorldProvinces(), loadWorldManifest()])
      .then(([collection, nextManifest]) => {
        if (!active) return;
        setProvinces(collection.features.map((feature) => {
          const rings = feature.geometry ? ringsFromGeometry(feature.geometry.type, feature.geometry.coordinates) : [];
          return {
            code: feature.properties.prvCode,
            name: feature.properties.prvName,
            boe: feature.properties.boeMean ?? 0,
            rings,
            centroid: centroid(rings),
          };
        }));
        setManifest(nextManifest);
      })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, []);

  const redraw = useCallback(() => {
    if (canvasRef.current) drawMap(canvasRef.current, provinces, mode, theme, camera, place, dark);
  }, [camera, dark, mode, place, provinces, theme]);

  useEffect(() => {
    redraw();
    const observer = new ResizeObserver(redraw);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [redraw]);

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return PLACES;
    return PLACES.filter((item) => `${item.name} ${item.kind} ${item.parent}`.toLowerCase().includes(needle));
  }, [query]);

  const selectPlace = (next: Place) => {
    setPlace(next);
    setCamera({ lon: next.lon ?? 10, lat: next.lat ?? 25, zoom: next.zoom });
    setQuery('');
    setSearchOpen(false);
  };

  const recognizeField = () => {
    const name = query.trim() || 'Your field';
    selectPlace({ id: `private-${name}`, name, kind: 'Private field', parent: 'Ready to connect to the Arganta data spine', zoom: 1.3 });
  };

  const zoomBy = (factor: number) => setCamera((current) => ({ ...current, zoom: clamp(current.zoom * factor, 1, 22) }));
  const resetView = () => setCamera({ lon: place.lon ?? 10, lat: place.lat ?? 25, zoom: place.zoom });

  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    const width = Math.max(320, event.currentTarget.getBoundingClientRect().width);
    setCamera((current) => {
      const sensitivity = mode === '3d' ? 150 / width : 360 / width / current.zoom;
      return {
        ...current,
        lon: current.lon - dx * sensitivity,
        lat: clamp(current.lat + dy * sensitivity, -82, 82),
      };
    });
  };
  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const isSample = place.sample === true;
  const currentTheme = THEMES.find((item) => item.id === theme)!;
  const vitals = [
    [String(manifest?.counts.provinces ?? 179), 'Petroleum provinces'],
    [String(manifest?.counts.aus ?? 340), 'Assessment units'],
    ['5', 'Lifecycle agents'],
  ];

  return (
    <section className="aeck" aria-label="ArgantaEnergy cockpit">
      <div className="aeck-bar">
        <div className="aeck-title">
          <span className="aeck-live"><span />SPATIAL INTELLIGENCE</span>
          <strong>{place.name}</strong>
          <small>{place.parent}</small>
        </div>

        <div className={'aeck-search' + (searchOpen ? ' open' : '')}>
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchOpen(false);
              if (event.key === 'Enter' && results[0]) selectPlace(results[0]);
            }}
            placeholder="Search country, basin, field or well"
            aria-label="Search country, basin, field or well"
            aria-expanded={searchOpen}
          />
          {query && <button onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>}
          {searchOpen && (
            <div className="aeck-results">
              <div className="aeck-result-kicker">SEARCH THE ENERGY WORLD</div>
              {results.map((result) => (
                <button key={result.id} onClick={() => selectPlace(result)}>
                  <span className="aeck-result-icon">{result.kind === 'Country' ? <Map size={15} /> : result.sample ? <Crosshair size={15} /> : <Globe2 size={15} />}</span>
                  <span><b>{result.name}</b><small>{result.kind} · {result.parent}</small></span>
                  {result.sample && <em>PROOF</em>}
                </button>
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
        </div>
      </div>

      <div className="aeck-stage" ref={stageRef} onClick={() => { if (searchOpen) setSearchOpen(false); }}>
        <canvas
          ref={canvasRef}
          className="aeck-canvas"
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={pointerUp}
          onWheel={(event) => { event.preventDefault(); zoomBy(event.deltaY > 0 ? .88 : 1.14); }}
          role="img"
          aria-label={`${mode === '3d' ? '3D globe' : '2D vector map'} centered on ${place.name}`}
        />

        <div className="aeck-context">
          <span className={isSample ? 'sample' : 'private'}>{isSample ? 'PUBLIC-DATA PROOF · VOLVE' : 'ONE SPATIAL OPERATING PICTURE'}</span>
          <h1>{isSample ? 'Proof, not the boundary.' : 'See every asset. Ask every lifecycle.'}</h1>
          <p>{isSample
            ? 'Volve proves ArgantaEnergy working end to end—from source evidence to lifecycle decisions. Your portfolio belongs here next.'
            : 'Navigate from global opportunity to field-level evidence in one governed intelligence layer.'}</p>
          <div className="aeck-context-meta">
            <span><Database size={12} />{provinces.length || '—'} provinces</span>
            <span><Activity size={12} />{loadError ? 'Context unavailable' : 'Evidence linked'}</span>
          </div>
        </div>

        <div className="aeck-theme-rail">
          {THEMES.map((item) => (
            <button key={item.id} className={theme === item.id ? 'on' : ''} onClick={() => setTheme(item.id)} title={item.name} aria-label={`${item.name} map theme`} aria-pressed={theme === item.id}>
              <item.icon size={16} /><span>{item.name}</span>
            </button>
          ))}
        </div>

        <div className="aeck-zoom">
          <button onClick={() => zoomBy(1.2)} aria-label="Zoom in"><Plus size={16} /></button>
          <button onClick={() => zoomBy(.82)} aria-label="Zoom out"><Minus size={16} /></button>
          <button onClick={resetView} aria-label="Reset view"><LocateFixed size={16} /></button>
        </div>

        <div className="aeck-vitals">
          {vitals.map(([value, label]) => <div key={label}><b>{value}</b><span>{label}</span></div>)}
        </div>

        <div className="aeck-map-caption">
          <currentTheme.icon size={13} />{currentTheme.name} · {mode === '3d' ? 'globe' : 'vector map'}
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

// FieldScene — the field basemap, rendered from the SHARED scene (scene.ts).
//
// This is the Data Explorer's canvas, and it is deliberately the same picture the
// Knowledge Bank's dossier map shows: same Cockpit renderer, same satellite imagery,
// same StructureLayer draping the same ingested horizon digest. The mirror is not a
// sync — both read `useScene`, so a horizon draped here is draped there and back.
//
// What it does NOT carry is the dossier's pick-impact analysis (which horizon each
// well penetrates, and at what depth). That is interpretation the dossier does to
// answer "has this been appraised", not part of the basemap.
import { useCallback, useEffect, useMemo, useState, Suspense, lazy } from 'react';
import { Layers3 } from 'lucide-react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { CockpitMap } from '../../cosmo/CockpitMap';
import { listAssets } from '../../dataqc/db';
import { readSurfaceGrid } from '../../dataqc/readDigest';
import { resolveKbContext } from '../../dataqc/masterkb';
import { surfaceContextFor } from '../../dataqc/surface-context';
import type { DigestedSurface, IngestedAsset } from '../../dataqc/types';
import { StructureLayer, surfaceRange, RAMP_CSS } from './StructureLayer';
import { orderHorizons, orderNote } from './horizon-order';
import { matchPicks, buildImpacts } from './horizon-picks';
import { ImpactMarkers, type ImpactMarker } from './ImpactMarkers';
import { loadWellGeometry, buildPaths3D, type WellGeometry, type Path3D } from './well-geometry';
import { loadIndex } from '../../wb/load';
import { summariseWell } from './well-stats';
import { wellKey } from './well-paths';
import { ed50UtmToWgs84 } from '../../engine/proj';
import type { Structure3DSurface } from './Structure3D';
import { useScene } from './scene';
import { MapTools } from './MapTools';
import { SectionView, type SectionWell } from './SectionView';
import { useInterp, latestSection } from './interp-store';
import { wgs84ToEd50Utm } from '../../engine/proj';

/** three.js + fiber + drei is ~600 kB — never pulled for the 2D basemap. */
const Structure3D = lazy(async () => ({ default: (await import('./Structure3D')).Structure3D }));

interface Horizon { id: string; name: string; short: string; asset: IngestedAsset }

/** "Hugin Fm Top" → "Hugin Top" — the selector is a row of buttons, not a legend. */
function shortHorizon(name: string): string {
  return name.replace(/\.(dat|txt|asc|grd|irap|zmap)$/i, '')
    .replace(/\b(fm|formation|gp|group)\b/gi, '')
    .replace(/\s{2,}/g, ' ').trim();
}

export function FieldScene({ field }: { field: SearchEntry }) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [horizons, setHorizons] = useState<Horizon[]>([]);
  const [surface, setSurface] = useState<DigestedSurface | null>(null);
  const [orderNoteText, setOrderNoteText] = useState('');

  const [wellGeo, setWellGeo] = useState<WellGeometry | null>(null);
  const [grids3d, setGrids3d] = useState<Map<string, DigestedSurface>>(new Map());

  const horizonId = useScene((s) => s.horizonId);
  const setHorizonId = useScene((s) => s.setHorizon);
  const view = useScene((s) => s.view);
  const setView = useScene((s) => s.setView);
  // the section traced with the section tool — this canvas both makes it and renders it
  const section = useInterp((st) => latestSection(st.features));
  /** Stable: SectionView memoises its whole sampling pass on this identity, so an
   *  inline arrow would re-sample every horizon on every render. */
  const toProjected = useCallback(
    (lon: number, lat: number) => wgs84ToEd50Utm(lon, lat, wellGeo?.zone ?? 31),
    [wellGeo?.zone],
  );
  const multiIds = useScene((s) => s.multiIds);
  const setMultiIds = useScene((s) => s.setMulti);
  const toggleMulti = useScene((s) => s.toggleMulti);
  const zScale = useScene((s) => s.zScale);
  const setZScale = useScene((s) => s.setZScale);
  const setSceneField = useScene((s) => s.setField);
  const dataVersion = useScene((s) => s.dataVersion);

  useEffect(() => { setSceneField(field.id); }, [field.id, setSceneField]);

  /** The published fluid contact, for the section's oil/water split. Field-level
   *  and interpreted — the section labels it, and paints fluid ONLY inside the
   *  interval it actually cuts (see SectionView). */
  const [contact, setContact] = useState<{ depth: number; kind: string } | null>(null);
  useEffect(() => {
    let alive = true;
    setContact(null);
    loadIndex()
      .then((idx) => {
        if (!alive) return;
        const c = (idx?.contacts ?? []).find((x) => /owc|gwc|goc|contact/i.test(String(x.kind)));
        setContact(c && Number.isFinite(c.tvdss) ? { depth: Math.abs(c.tvdss), kind: c.kind || 'OWC' } : null);
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [field.id]);

  // Same source and same ordering rule as the dossier: the surfaces Data QC has
  // actually ingested for this field, oldest → youngest, with the sea floor left
  // out — it is bathymetry, not structure.
  useEffect(() => {
    let alive = true;
    setHorizons([]); setSurface(null); setOrderNoteText('');
    (async () => {
      const [assets, kb] = await Promise.all([
        listAssets(field.id).catch(() => []),
        resolveKbContext(field.id).catch(() => null),
      ]);
      if (!alive) return;
      const surfs = assets.filter((a) => a.kind === 'surface'
        && !/seabed|sea\s*floor|bathym/i.test(String(a.meta.name ?? a.fileName)));
      const ordered = orderHorizons(surfs.map((a) => {
        const name = String(a.meta.name ?? a.fileName);
        const ctx = surfaceContextFor(name, kb);
        const zmin = Number(a.meta.zmin), zmax = Number(a.meta.zmax);
        return {
          id: a.id, name, short: shortHorizon(name), asset: a, unit: ctx?.unitName ?? null,
          ageMa: ctx ? (ctx.isBase ? ctx.ageBaseMa : ctx.ageTopMa) ?? null : null,
          meanDepth: Number.isFinite(zmin) && Number.isFinite(zmax)
            ? (Math.abs(zmin) + Math.abs(zmax)) / 2 : null,
        };
      }));
      const list = ordered.map((o) => o.item);
      setHorizons(list);
      setOrderNoteText(orderNote(ordered));
      // Never override a selection the user already made in the Knowledge Bank.
      const held = useScene.getState().horizonId;
      if (!held || !list.some((h) => h.id === held)) setHorizonId(list[0]?.id ?? null);
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [field.id, dataVersion, setHorizonId]);

  useEffect(() => {
    let alive = true;
    if (!horizonId) { setSurface(null); return; }
    const hz = horizons.find((h) => h.id === horizonId);
    if (!hz) return;
    readSurfaceGrid(hz.asset).then((g) => { if (alive) setSurface(g); })
      .catch(() => { if (alive) setSurface(null); });
    return () => { alive = false; };
  }, [horizonId, horizons]);

  // Projected origin off the asset's own ingest meta, and the UTM zone parsed from
  // the declared CRS rather than assumed — a field outside zone 31 would otherwise
  // drape a whole zone away, silently.
  const surfaceGeo = useMemo(() => {
    const m = horizons.find((h) => h.id === horizonId)?.asset.meta;
    if (!m) return null;
    const x0 = Number(m.xmin), y0 = Number(m.ymin), cell = Number(m.dx);
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(cell) || cell <= 0) return null;
    const zone = Number(String(m.crs ?? '').match(/UTM\s*(\d{1,2})/i)?.[1]);
    return { x0, y0, cell, zone: Number.isFinite(zone) ? zone : 31 };
  }, [horizons, horizonId]);

  // Gated on `map` for the same reason the dossier gates it: CockpitMap's fly-to
  // no-ops while the renderer is still null, so the identity must change after boot.
  const mapFocus = useMemo(
    () => (map && field.fly ? { lon: field.fly.lon, lat: field.fly.lat, zoom: 7.4 } : undefined),
    [map, field.fly],
  );
  const zRange = useMemo(() => surfaceRange(surface), [surface]);

  // ── wells ──────────────────────────────────────────────────────────────────
  // Same digests the dossier reads, through the shared loader — one pipeline.
  useEffect(() => {
    let alive = true;
    setWellGeo(null); setGrids3d(new Map());
    loadWellGeometry(field.id).then((g) => { if (alive) setWellGeo(g); }).catch(() => undefined);
    return () => { alive = false; };
  }, [field.id, dataVersion]);

  const selectedHorizon = useMemo(
    () => horizons.find((h) => h.id === horizonId) ?? null, [horizons, horizonId],
  );

  /** 2D impact points — where each bore cuts the DRAPED horizon, in lon/lat. */
  const impacts = useMemo<ImpactMarker[]>(() => {
    if (!wellGeo || !selectedHorizon) return [];
    const { picks } = matchPicks(selectedHorizon.name, wellGeo.picks);
    if (!picks.length) return [];
    return buildImpacts(picks, wellGeo.wells, wellGeo.surveys).map((p) => {
      const g = ed50UtmToWgs84(p.easting, p.northing, wellGeo.zone);
      const monthly = wellGeo.series.get(wellKey(p.well));
      return {
        well: p.well, role: p.role, lon: g.lon, lat: g.lat,
        md: p.md, tvdss: p.tvdss, extrapolated: p.extrapolated,
        stats: monthly ? summariseWell(monthly, wellGeo.refMonth ?? undefined) : null,
      };
    });
  }, [wellGeo, selectedHorizon]);

  // ── 3D ─────────────────────────────────────────────────────────────────────
  // Entering 3D with nothing chosen starts from whatever the map was showing.
  useEffect(() => {
    if (view === '3d' && !multiIds.length && horizonId) setMultiIds([horizonId]);
  }, [view, multiIds.length, horizonId, setMultiIds]);

  useEffect(() => {
    let alive = true;
    const missing = multiIds.filter((id) => !grids3d.has(id));
    if (!missing.length) return;
    (async () => {
      const decoded = await Promise.all(missing.map(async (id) => {
        const hz = horizons.find((h) => h.id === id);
        return hz ? [id, await readSurfaceGrid(hz.asset).catch(() => null)] as const : null;
      }));
      if (!alive) return;
      setGrids3d((prev) => {
        const next = new Map(prev);
        for (const d of decoded) if (d && d[1]) next.set(d[0], d[1]);
        return next;
      });
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [multiIds, horizons, grids3d]);

  const surfaces3d = useMemo<Structure3DSurface[]>(() => multiIds
    .map((id) => {
      const hz = horizons.find((h) => h.id === id);
      const grid = grids3d.get(id);
      const m = hz?.asset.meta;
      const x0 = Number(m?.xmin), y0 = Number(m?.ymin), cell = Number(m?.dx);
      if (!hz || !grid || !Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(cell)) return null;
      return { id, name: hz.name, short: hz.short, grid, geo: { x0, y0, cell } };
    })
    .filter((s): s is Structure3DSurface => !!s)
    .sort((a, b) => (Number(b.grid.values[0]) || 0) - (Number(a.grid.values[0]) || 0)),
  [multiIds, horizons, grids3d]);

  /** When no horizon is stacked for 3D, the section still needs something to
   *  cut, so it falls back to whichever horizon the map is currently draping. */
  const xsecFallback = useMemo<Structure3DSurface[]>(() => {
    const hz = horizons.find((h) => h.id === horizonId);
    const m = hz?.asset.meta;
    const x0 = Number(m?.xmin), y0 = Number(m?.ymin), cell = Number(m?.dx);
    if (!hz || !surface || !Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(cell)) return [];
    return [{ id: hz.id, name: hz.name, short: hz.short, grid: surface, geo: { x0, y0, cell } }];
  }, [horizons, horizonId, surface]);

  /** The surfaces actually ON SCREEN, and the ONE list everything derived from
   *  them must use — meshes, section profiles and well picks alike. When these
   *  disagreed the section could show horizons with no wells on them, because the
   *  picks were cut against a different (empty) set. */
  const shownSurfaces = useMemo(
    () => (surfaces3d.length ? surfaces3d : xsecFallback),
    [surfaces3d, xsecFallback],
  );

  const impacts3d = useMemo(() => {
    if (!wellGeo) return [];
    const out: SectionWell[] = [];
    const seen = new Set<string>();
    for (const s of shownSurfaces) {
      const { picks } = matchPicks(s.name, wellGeo.picks);
      for (const p of buildImpacts(picks, wellGeo.wells, wellGeo.surveys)) {
        const key = `${s.id}|${p.well}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const monthly = wellGeo.series.get(wellKey(p.well));
        out.push({
          well: p.well, role: p.role, lon: 0, lat: 0,
          md: p.md, tvdss: p.tvdss, extrapolated: p.extrapolated,
          stats: monthly ? summariseWell(monthly, wellGeo.refMonth ?? undefined) : null,
          easting: p.easting, northing: p.northing, horizonId: s.id,
        });
      }
    }
    return out;
  }, [wellGeo, shownSurfaces]);


  /** The whole bore, surface slot → TD. Independent of which horizon is selected:
   *  a trajectory exists whether or not it happens to cut the shown surface. */
  const paths3d = useMemo<Path3D[]>(() => (wellGeo ? buildPaths3D(wellGeo) : []), [wellGeo]);

  return (
    <div className="fds-scene">
      <div className="fds-scene-bar">
        <span className="fds-scene-label"><Layers3 size={12} /> Horizon</span>
        {horizons.length > 0 ? (
          <span className="fds-scene-hz" title={orderNoteText}>
            {/* single-select in 2D (a map shows one surface), multi in 3D — one
                surface in 3D is a map with extra steps */}
            {horizons.map((h) => (
              <button key={h.id}
                /* 2D drapes exactly one surface; 3D and the cross-section both
                   STACK them — a section of one horizon is a line, not a section. */
                className={(view === '2d' ? h.id === horizonId : multiIds.includes(h.id)) ? 'on' : ''}
                onClick={() => (view === '2d'
                  ? setHorizonId(h.id === horizonId ? null : h.id)
                  : toggleMulti(h.id))}
                title={h.name}>
                {h.short}
              </button>
            ))}
          </span>
        ) : (
          <span className="fds-scene-none">No interpreted horizon ingested for {field.name}</span>
        )}
        <span className="fds-ad-view">
          <button className={view === '2d' ? 'on' : ''} onClick={() => setView('2d')}>2D</button>
          <button className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>3D</button>
          <button className={view === 'xsec' ? 'on' : ''} onClick={() => setView('xsec')}
            title="Render the section traced with the section tool">X-Section</button>
        </span>
        {zRange && (
          <span className="fds-scene-ramp" title="depth ramp — shallow to deep">
            <b>{Math.round(Math.abs(zRange.zmin))}</b>
            <i style={{ background: RAMP_CSS }} />
            <b>{Math.round(Math.abs(zRange.zmax))} m</b>
          </span>
        )}
      </div>
      <div className="fds-scene-map">
        {view === 'xsec' ? (
          /* The section re-cuts what is already loaded — same grids the map
             drapes, same impact points. It adds no data. */
          <SectionView
            section={section}
            toProjected={toProjected}
            surfaces={shownSurfaces}
            wells={impacts3d}
            contactDepth={contact?.depth ?? null}
            contactLabel={contact?.kind}
          />
        ) : view === '3d' ? (
          <Suspense fallback={<div className="fds-3d-empty">loading 3D…</div>}>
            {surfaces3d.length ? (
              <>
                <Structure3D surfaces={surfaces3d} wells={impacts3d} paths={paths3d} zScale={zScale} />
                <label className="fds-3d-zx" title="vertical exaggeration — a 7 km field with 600 m of relief is flat at ×1">
                  ×{zScale}
                  <input type="range" min={1} max={20} step={1} value={zScale}
                    onChange={(e) => setZScale(Number(e.target.value))} />
                </label>
              </>
            ) : <div className="fds-3d-empty">Pick one or more horizons above to build the section.</div>}
          </Suspense>
        ) : (
          <>
            <CockpitMap dark mode="2d" theme="satellite" overlay="minimal"
              focus={mapFocus} highlight={field.fly ?? null}
              onSelect={() => {}} onMapReady={setMap} />
            <StructureLayer map={map} surface={surface} geo={surfaceGeo} visible={!!horizonId}
              beforeId="focus-field-glow" contactDepth={null} />
            {/* where each bore actually cuts the draped horizon — the same markers
                the dossier map carries, from the same picks */}
            <ImpactMarkers map={map} points={impacts} volumeUnit={wellGeo?.unit ?? ''} visible={!!horizonId} />
            {/* Authoring lives in the Workspace, not the Knowledge Bank: the
                dossier is a read of the record, this is where the record is
                worked on. What is drawn lands in the Input tree on the left. */}
            <MapTools map={map} fieldId={field.id} enabled />
          </>
        )}
      </div>
    </div>
  );
}

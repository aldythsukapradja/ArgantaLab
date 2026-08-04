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
import { useEffect, useMemo, useState } from 'react';
import { Layers3, MapPinned } from 'lucide-react';
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
import { useScene } from './scene';

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

  const horizonId = useScene((s) => s.horizonId);
  const setHorizonId = useScene((s) => s.setHorizon);
  const view = useScene((s) => s.view);
  const setSceneField = useScene((s) => s.setField);

  useEffect(() => { setSceneField(field.id); }, [field.id, setSceneField]);

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
  }, [field.id, setHorizonId]);

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

  return (
    <div className="fds-scene">
      <div className="fds-scene-bar">
        <span className="fds-scene-label"><Layers3 size={12} /> Horizon</span>
        {horizons.length > 0 ? (
          <span className="fds-scene-hz" title={orderNoteText}>
            {horizons.map((h) => (
              <button key={h.id} className={h.id === horizonId ? 'on' : ''}
                onClick={() => setHorizonId(h.id === horizonId ? null : h.id)} title={h.name}>
                {h.short}
              </button>
            ))}
          </span>
        ) : (
          <span className="fds-scene-none">No interpreted horizon ingested for {field.name}</span>
        )}
        {zRange && (
          <span className="fds-scene-ramp" title="depth ramp — shallow to deep">
            <b>{Math.round(Math.abs(zRange.zmin))}</b>
            <i style={{ background: RAMP_CSS }} />
            <b>{Math.round(Math.abs(zRange.zmax))} m</b>
          </span>
        )}
      </div>
      <div className="fds-scene-map">
        {view === '3d' ? (
          // The dossier owns the 3D section today; wiring the Explorer's 3D to the
          // same renderer is the next step, and saying so beats a blank pane.
          <div className="fds-scene-empty">
            <MapPinned size={18} />
            <b>3D section is not wired to the Explorer yet</b>
            <span>Use the Knowledge Bank's 3D view — it reads this same horizon selection.</span>
          </div>
        ) : (
          <>
            <CockpitMap dark mode="2d" theme="satellite" overlay="minimal"
              focus={mapFocus} highlight={field.fly ?? null}
              onSelect={() => {}} onMapReady={setMap} />
            <StructureLayer map={map} surface={surface} geo={surfaceGeo} visible={!!horizonId}
              beforeId="focus-field-glow" contactDepth={null} />
          </>
        )}
      </div>
    </div>
  );
}

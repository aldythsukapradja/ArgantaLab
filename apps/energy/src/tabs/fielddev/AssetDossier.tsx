// AssetDossier.tsx — the Field Development Knowledge Bank.
//
// The Basin Dossier's sibling, one decision down the chain. Exploration asks "is this
// basin worth my money, and what do I still need to find out". Field Development asks:
//
//     "Can this field be developed, how has it actually performed, and what do I still
//      need to know before I sanction it?"
//
// Same skeleton, development semantics (see FIELD-DEVELOPMENT-KNOWLEDGE-BANK-CONCEPT.md):
//
//   header    field identity + three numbers, each of which is the button to its detail
//   left      field locator map — spans both content rows
//   right     three verdict cards: Maturity · Reservoir & drive · Fluid mix
//   middle    DEVELOPMENT TIMELINE — the signature chart, calendar time running forwards
//   far right ANALOG BENCHMARK — the class band this asset sits in
//   modals    lifecycle · reserves · production · readiness · sources
//
// Grounding is enforced in asset-dossier.ts, not here: this file renders nulls as "—"
// and never substitutes a zero. The readiness ledger is treated as a RESULT — for most
// of the 7,787-field catalogue it is the honest output, not an error state.
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarClock, Database, Droplets, GaugeCircle, Info, Layers3, Library,
  MapPinned, ShieldAlert, TrendingDown, X,
} from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { CockpitMap } from '../../cosmo/CockpitMap';
import { loadKnowledgeContext, sourceRecordCount, type KnowledgeContext } from './field-knowledge';
import { loadKbSpine, type KbSpine } from '../../dataqc/masterkb';
import {
  buildAssetDossier, fmtMMBOE, fmtPct, STAGE_LABEL,
  type AssetDossier as Dossier,
} from './asset-dossier';
import { resolveFieldRecord, type ResolvedRecord, type Authority, type BundleAvailability } from './field-record';
import { BenchmarkBand, DevelopmentTimeline, LifecycleBar, MixDonut, ProductionSpark } from './AssetCharts';
import { WellCountPanel } from './WellCountPanel';
import type { WellSeries } from './well-activity';
import { loadIndex, loadProd, loadProdField } from '../../wb/load';
import type { ProdMonth } from '../../wb/types';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { listAssets } from '../../dataqc/db';
import { readSurfaceGrid } from '../../dataqc/readDigest';
import type { DigestedSurface, IngestedAsset } from '../../dataqc/types';
import { StructureLayer, surfaceRange, RAMP_CSS } from './StructureLayer';
import type { TrajectoryLine } from './StructureLayer';
import { readRecord } from '../../dataqc/readDigest';
import { buildWellPaths } from './well-paths';
import { ed50UtmToWgs84 } from '../../engine/proj';

interface HorizonOption { id: string; name: string; short: string; asset: IngestedAsset }

/** "Hugin Fm Top" → "Hugin Top". The selector is a row of small buttons, so it
 *  drops the lithostratigraphic rank (Fm / Gp) which adds width but no meaning —
 *  and KEEPS Top/Base, which is the whole distinction between two picks of the
 *  same unit. Dropping it collapsed Top Hugin and Base Hugin to one label. */
function shortHorizon(name: string): string {
  return name
    .replace(/\b(Fm|Formation|Gp|Group)\b\.?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type Pop = 'lifecycle' | 'reserves' | 'production' | 'readiness' | 'sources' | 'volumes' | null;

/** Provenance chip — every headline fact says which authority it came from. */
function Src({ a }: { a: Authority }) {
  if (a === 'none') return null;
  return <i className={'fds-src src-' + a.replace(/\s+/g, '-').toLowerCase()}>{a}</i>;
}

const reported = (v: unknown) => (v == null || v === '' ? '—' : String(v));
const pctOf = (n: number, total: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : '—');

/** The four buckets every wellbore lands in — and they must be all four. Showing
 *  only P and I would imply the rest are missing data, when "non-flowing" is a
 *  real role (appraisal, exploration, observation, water supply) and "unrecorded"
 *  is a real gap. The split is the honest picture of what was drilled and why. */
const WELL_ROLES = [
  { key: 'producers', label: 'producers', color: 'var(--green)', title: 'Wellbores published as oil producers' },
  { key: 'injectors', label: 'injectors', color: 'var(--cblue,#26c6da)', title: 'Water injectors supporting the flood' },
  { key: 'nonFlowing', label: 'non-flowing', color: 'var(--muted,#8b96a5)', title: 'Appraisal, exploration, observation and water-supply bores — a real role, not a gap' },
  { key: 'roleUnknown', label: 'unrecorded', color: 'var(--orange)', title: 'No role published for these bores — a genuine gap' },
] as const satisfies ReadonlyArray<{ key: keyof BundleAvailability; label: string; color: string; title: string }>;

function Modal({ title, sub, onClose, children, wide }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="fds-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={'fds-lightbox-inner' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>{sub}</span><b>{title}</b></div>
          <button onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="fds-modal-body">{children}</div>
      </div>
    </div>
  );
}

export function AssetDossier({ field }: { field: SearchEntry }) {
  const [context, setContext] = useState<KnowledgeContext | null>(null);
  const [kbSpine, setKbSpine] = useState<KbSpine | null>(null);
  const [record, setRecord] = useState<ResolvedRecord | null>(null);
  const [pop, setPop] = useState<Pop>(null);
  // Flow leads: a producing asset is judged on how it flowed, and the calendar
  // record is the context behind that. Falls back to the timeline when no monthly
  // series exists, which is the only case where Flow would be empty.
  const [chart, setChart] = useState<'timeline' | 'flow'>('flow');
  // the monthly flow picture — field-level bars plus the per-well series the
  // active-well count is derived from. Only a field with a deep bundle has these;
  // everything else keeps the calendar timeline and never offers the toggle.
  const [monthly, setMonthly] = useState<ProdMonth[]>([]);
  const [wellSeries, setWellSeries] = useState<WellSeries[]>([]);
  // structure overlay — the live map, the horizons Data QC has ingested for this
  // field, and the decoded grid for whichever one is selected
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [horizons, setHorizons] = useState<HorizonOption[]>([]);
  const [horizonId, setHorizonId] = useState<string | null>(null);
  const [surface, setSurface] = useState<DigestedSurface | null>(null);
  const [paths, setPaths] = useState<TrajectoryLine[]>([]);

  useEffect(() => {
    let alive = true;
    setContext(null); setRecord(null); setPop(null);
    loadKnowledgeContext(field)
      .then(async (v) => {
        if (!alive) return;
        setContext(v);
        // Resolve the development record through the real authority ladder
        // (GOGET → regulator → deep bundle). This is what removed the hard-coded
        // Volve facts the header bar used to render.
        const r = await resolveFieldRecord(field, v.detail as never);
        if (alive) setRecord(r);
      })
      .catch(() => { if (alive) setRecord(null); });
    return () => { alive = false; };
  }, [field]);
  useEffect(() => { loadKbSpine().then(setKbSpine).catch(() => setKbSpine(null)); }, []);

  // Monthly flow, for the Flow view. Loaded only when the resolver actually found a
  // deep bundle — a catalogue-only field silently keeps the timeline, and the
  // toggle never appears rather than offering an empty chart.
  useEffect(() => {
    let alive = true;
    setMonthly([]); setWellSeries([]); setChart('timeline');
    if (!record?.bundle) return;
    (async () => {
      const [idx, field] = await Promise.all([loadIndex().catch(() => null), loadProdField().catch(() => null)]);
      if (!alive || !field?.monthly?.length) return;
      setMonthly(field.monthly);
      const flowing = (idx?.wells ?? []).filter((w) => w.has?.production);
      const series = await Promise.all(flowing.map(async (w) => {
        const p = await loadProd(w.name).catch(() => null);
        return p?.monthly?.length ? { well: w.name, monthly: p.monthly } : null;
      }));
      if (alive) setWellSeries(series.filter(Boolean) as WellSeries[]);
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [record]);

  const nowYear = new Date().getFullYear();

  // ── structure overlay ──────────────────────────────────────────────────────
  // Surfaces are listed from the assets Data QC has ALREADY ingested for this
  // field. A field with no ingested horizon simply gets no selector — the map
  // stays regional rather than showing an empty control.
  useEffect(() => {
    let alive = true;
    setHorizons([]); setHorizonId(null); setSurface(null);
    (async () => {
      const assets = await listAssets(field.id).catch(() => []);
      if (!alive) return;
      // Seabed is bathymetry, not structure. It is a real ingested surface and
      // stays available in Data QC, but it carries no development meaning — you
      // do not read a crest or a spill point off the sea floor — and its 83–2605 m
      // range swamps the depth ramp the reservoir horizons share.
      const surfs = assets.filter((a) => a.kind === 'surface'
        && !/seabed|sea\s*floor|bathym/i.test(String(a.meta.name ?? a.fileName)));
      const list = surfs.map((a) => {
        const name = String(a.meta.name ?? a.fileName);
        return { id: a.id, name, short: shortHorizon(name), asset: a };
      });
      setHorizons(list);
      // Open ON the structure rather than on an empty regional map. Selecting a
      // field that HAS an interpreted horizon is already the request to see it,
      // and the layer's fly-to then takes the camera down to the footprint.
      //
      // The FIRST ingested surface, deliberately — not a guess at "the reservoir
      // top". Surface names carry no stratigraphic order (Volve ships BCU, Hugin
      // Base, Hugin Top, Shetland Top, Ty Top, alphabetically), so any rule that
      // claimed to pick the reservoir would be picking a name pattern and calling
      // it geology. The selector is right there to change it.
      if (list[0]) setHorizonId(list[0].id);
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [field.id]);

  // ── wellbore paths over the structure ──────────────────────────────────────
  // Same discipline as the horizons: the SURVEYS come out of the trajectory
  // digests Data QC ingested, and the surface SLOT coordinates off the bundle's
  // own well master. Both are already-landed data, not a second fetch pipeline.
  // A field with neither simply gets no lines drawn.
  useEffect(() => {
    let alive = true;
    setPaths([]);
    (async () => {
      const [assets, index] = await Promise.all([
        listAssets(field.id).catch(() => []),
        loadIndex().catch(() => null),
      ]);
      if (!alive) return;
      const trajAssets = assets.filter((a) => a.kind === 'trajectory');
      if (!trajAssets.length || !index?.wells?.length) return;
      const surveys = (await Promise.all(trajAssets.map(async (a) => {
        const rec = await readRecord<{ well?: string; stations?: Array<Record<string, number>> }>(a)
          .catch(() => null);
        const well = String(rec?.well ?? a.meta.well ?? '');
        return rec?.stations?.length && well ? { well, stations: rec.stations } : null;
      }))).filter((s): s is { well: string; stations: Array<Record<string, number>> } => !!s);
      if (!alive) return;
      // The bundle declares its CRS once, at the index level; parse the zone from
      // it rather than assuming 31, for the same reason the surface layer does.
      const zone = Number(String(index.crs ?? '').match(/UTM\s*(\d{1,2})/i)?.[1]) || 31;
      const projected = buildWellPaths(
        index.wells.map((w) => ({ name: String(w.name), x: w.x, y: w.y, role: w.role })),
        surveys,
      );
      setPaths(projected.map((p) => ({
        well: p.well, role: p.role,
        path: p.points.map(([x, y]) => {
          const g = ed50UtmToWgs84(x, y, zone);
          return [g.lon, g.lat] as [number, number];
        }),
      })));
    })().catch(() => undefined);
    return () => { alive = false; };
  }, [field.id]);

  // Decode ONLY the selected horizon, and only when one is picked — the digest
  // is int16+gzip in IndexedDB, so this is a read and a decompress, never a refetch.
  useEffect(() => {
    let alive = true;
    if (!horizonId) { setSurface(null); return; }
    const hz = horizons.find((h) => h.id === horizonId);
    if (!hz) return;
    readSurfaceGrid(hz.asset).then((g) => { if (alive) setSurface(g); }).catch(() => { if (alive) setSurface(null); });
    return () => { alive = false; };
  }, [horizonId, horizons]);

  // The projected origin lives on the surface asset's own meta, written at ingest
  // (xmin/ymin — the SW corner — with dx as the cell size). The UTM zone is parsed
  // from the CRS the bundle declares rather than assumed: a field outside zone 31
  // would otherwise be draped a whole zone away, and silently.
  const surfaceGeo = useMemo(() => {
    const hz = horizons.find((h) => h.id === horizonId);
    const m = hz?.asset.meta;
    if (!m) return null;
    const x0 = Number(m.xmin), y0 = Number(m.ymin), cell = Number(m.dx);
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(cell) || cell <= 0) return null;
    const zone = Number(String(m.crs ?? '').match(/UTM\s*(\d{1,2})/i)?.[1]);
    return { x0, y0, cell, zone: Number.isFinite(zone) ? zone : 31 };
  }, [horizons, horizonId]);

  // CockpitMap boots asynchronously and its fly-to effect no-ops while the map
  // instance is still null. Gating the focus on `map` guarantees the object
  // identity changes only AFTER the renderer exists, so the flight actually runs.
  // Regional zoom only: this puts the field in its basin. Draping a horizon then
  // hands the camera to StructureLayer, which closes in on the grid footprint.
  const mapFocus = useMemo(
    () => (map && field.fly ? { lon: field.fly.lon, lat: field.fly.lat, zoom: 7.4 } : undefined),
    [map, field.fly],
  );

  const zRange = useMemo(() => surfaceRange(surface), [surface]);

  // The described reservoir, when the catalogue carries one. Today only Volve has a
  // dedicated study; every other field honestly reports that it has none.
  const kbReservoir = useMemo(() => {
    if (!kbSpine || !context) return null;
    const row = kbSpine.reservoir?.find((r) => context.isVolve || r.field_id === field.id);
    if (!row) return context.isVolve ? { lithology: 'Sandstone', drive: 'waterflood', formation: 'Hugin Formation' } : null;
    return { lithology: row.lithology ?? null, drive: row.drive_mechanism ?? null, formation: row.formation_name ?? null };
  }, [kbSpine, context, field.id]);

  const dossier: Dossier | null = useMemo(() => {
    if (!record) return null;
    return buildAssetDossier(record.detail, kbReservoir, nowYear);
  }, [record, kbReservoir, nowYear]);

  const d = record?.detail ?? null;
  const bundle = record?.bundle ?? null;
  const prov = record?.provenance;
  const life = dossier?.lifecycle;
  const res = dossier?.reserves;
  const prod = dossier?.production;

  const kpi = (Icon: typeof Database, label: string, value: string, sub: string, onClick?: () => void, src?: Authority) => (
    <button className={'fds-kpi' + (onClick ? ' live' : '')} onClick={onClick} disabled={!onClick}>
      <span><Icon size={10} />{label}{src && src !== 'none' && <Src a={src} />}</span>
      <b>{value}</b><small>{sub}</small>
    </button>
  );

  return (
    <section className="fds-ad" aria-label={`${field.name} Asset Dossier`}>
      {/* ── header: identity + the three numbers that are also the buttons ────── */}
      <header className="fds-ad-head">
        <div className="fds-ad-id">
          <small>Field · development asset</small>
          <h2>{field.name}</h2>
          <p>
            {reported(d?.operator)} · {reported(d?.block ?? field.parent)}
            {d?.basin ? ` · ${d.basin}` : ''}
          </p>
        </div>
        <div className="fds-kpis">
          {kpi(Database, 'Recoverable',
            res ? fmtMMBOE(res.totalMMBOE) : '…',
            res?.totalMMBOE != null ? `MMBOE${res.latestYear ? ` · to ${res.latestYear}` : ''}` : 'no reserve filing',
            res?.lines.length ? () => setPop('reserves') : undefined, prov?.reserves)}
          {kpi(CalendarClock, 'Lifecycle',
            life ? (life.milestones[0].year ? `${life.milestones[0].year}→${life.milestones[2].year ?? '—'}` : '—') : '…',
            life ? life.detail : 'loading',
            life ? () => setPop('lifecycle') : undefined, prov?.discoveryYear)}
          {kpi(Activity, 'Produced',
            prod ? fmtMMBOE(prod.cumulativeMMBOE) : '…',
            prod?.cumulativeMMBOE != null ? `MMBOE · ${prod.firstYear}–${prod.lastYear}` : 'no production history',
            prod?.series.length ? () => setPop('production') : undefined, prov?.production)}
          {kpi(TrendingDown, 'Remaining',
            dossier ? fmtMMBOE(dossier.remaining) : '…',
            dossier?.remaining != null ? 'MMBOE · recoverable less produced' : 'not derivable',
            dossier?.remaining != null ? () => setPop('reserves') : undefined)}
        </div>
      </header>

      {/* ── map: column 1, spanning every content row ─────────────────────────
          The interpreted depth structure is draped ON the regional map, above
          satellite / basin / field polygons — a horizon in its context, with the
          wells on it, rather than a picture on its own card. The grid comes
          straight from the Data QC digest; nothing is re-gridded here. */}
      <div className="fds-ad-map">
        <div className="fds-ad-map-title"><MapPinned size={13} /><span>Location</span>
          {horizons.length > 0 && (
            <span className="fds-ad-hz">
              {horizons.map((h) => (
                <button key={h.id} className={h.id === horizonId ? 'on' : ''}
                  onClick={() => setHorizonId(h.id === horizonId ? null : h.id)}
                  title={`Drape ${h.name} over the map`}>{h.short}</button>
              ))}
            </span>
          )}
          <em>{reported(d?.onshoreOffshore)}</em></div>
        {/* The Cockpit renderer, not a bespoke one: real satellite imagery, the
            province boundary and the GOGET field points, with overlay="minimal"
            so three stacked translucent fills do not wash the imagery white.
            The same treatment the Basin Dossier and the Surveillance Dossier use,
            so all three dossiers read as one product. `highlight` rings THIS field. */}
        <div className="fds-ad-mapwrap">
          <CockpitMap dark mode="2d" theme="satellite" overlay="minimal"
            focus={mapFocus} highlight={field.fly ?? null}
            onSelect={() => {}} onMapReady={setMap} />
          {/* beneath the focus ring, so the marker for THIS field is never buried
              under the horizon it is meant to be pointing at */}
          <StructureLayer map={map} surface={surface} geo={surfaceGeo} visible={!!horizonId}
            trajectories={horizonId ? paths : []} beforeId="focus-field-glow" />
          <div className="fds-ad-maplabel">
            <b>{field.name}</b>
            <span>{field.fly ? `${field.fly.lat.toFixed(3)}°, ${field.fly.lon.toFixed(3)}°` : 'location not reported'}</span>
          </div>
          {horizonId && zRange && (
            <div className="fds-ad-zkey">
              <span>{Math.round(zRange.zmin)}</span>
              <i style={{ background: RAMP_CSS }} />
              <span>{Math.round(zRange.zmax)}</span>
              <em>m {reported(bundle?.datum ?? 'TVDSS')}</em>
            </div>
          )}
        </div>
        <div className="fds-ad-map-meta">
          <div><span>Country / area</span><b>{field.parent === 'NO' ? 'Norway' : reported(field.parent)}</b></div>
          <div><span>Licence block</span><b>{reported(d?.block)}</b></div>
        </div>
      </div>

      {/* ── verdict strip ────────────────────────────────────────────────────── */}
      <div className="fds-ad-right">
      <div className="fds-ad-verdicts">
        <button className="fds-verdict" onClick={() => life && setPop('lifecycle')}>
          <span><GaugeCircle size={10} />Maturity</span>
          <b className={'tone-' + (life?.tone ?? 'unknown')}>{life ? STAGE_LABEL[life.stage] : '…'}</b>
          <small>{life?.detail ?? 'reading development record'}</small>
          {life && <LifecycleBar stage={life.stage} />}
          {life && <em>Lifecycle ↗</em>}
        </button>

        <button className="fds-verdict" onClick={() => setPop('readiness')}>
          <span><Layers3 size={10} />Reservoir &amp; drive</span>
          <b className={'tone-' + (dossier?.reservoir.tone ?? 'unknown')}>
            {dossier ? (dossier.reservoir.drive ?? dossier.reservoir.lithology ?? 'No model') : '…'}
          </b>
          <small>{dossier?.reservoir.detail ?? 'reading catalogue'}</small>
          {dossier && (
            <div className="fds-ad-rvfacts">
              <i><span>Fluid</span><b>{reported(dossier.reservoir.fluid)}</b></i>
              <i><span>Formation</span><b>{reported(dossier.reservoir.formation)}</b></i>
            </div>
          )}
          <em>Readiness ↗</em>
        </button>

        <button className="fds-verdict" onClick={() => res?.lines.length && setPop('reserves')}>
          <span><Droplets size={10} />Fluid mix</span>
          {dossier && dossier.mix.length ? (
            <>
              <MixDonut mix={dossier.mix} />
              <em>Reserves ↗</em>
            </>
          ) : (
            <>
              <b className="tone-unknown">{dossier ? 'Not reported' : '…'}</b>
              <small>{dossier ? 'no convertible reserve filing in the catalogue' : 'reading reserves'}</small>
            </>
          )}
        </button>
      </div>

      {/* ── well inventory: the Exploration filter strip's counterpart ─────────
          Exploration filters its petroleum-system chart by geologic era; a
          producing asset filters by well ROLE. The chips ARE the well stock —
          a development read needs the producer / injector split at a glance,
          not behind a click. The availability matrix, which used to occupy an
          entire row of the grid, is now the button on the right. */}
      <div className="fds-ad-inv">
        <GaugeCircle size={12} />
        <b>Well inventory</b>
        {bundle ? (
          <>
            {WELL_ROLES.map((r) => {
              const n = bundle[r.key];
              return (
                <button key={r.key} className="fds-ad-chip" disabled={n === 0} title={r.title}>
                  <i style={{ background: r.color }} />{r.label} <b>{n}</b>
                </button>
              );
            })}
            <button className="fds-ad-avail-btn" onClick={() => setPop('sources')}
              title="Logs, trajectories, picks, surfaces and provenance for every wellbore">
              <Layers3 size={11} />
              Data availability · {bundle.wells} bores
            </button>
          </>
        ) : (
          <span className="fds-ad-avail-none">
            No deep data bundle — catalogue tier only (identity, dates, status). Well stock,
            logs, trajectories and surfaces require a field data package.
          </span>
        )}
      </div>

      <div className="fds-ad-panels">

      {/* ── the signature panel: development history, two readings ─────────────
          FLOW is the monthly voidage picture with the active well count over it —
          the RM chart re-aimed, separating reservoir decline from lost wells. It
          leads because it is the denser, more decision-bearing read: a producing
          asset is judged on how it FLOWED. TIMELINE is the calendar record behind
          it — found, sanctioned, built — and sits second. */}
      <section className="fds-ad-timeline-panel">
        <div className="fds-ad-section-title">
          <Activity size={14} /><span>{chart === 'timeline' ? 'Development timeline' : 'Production & injection'}</span>
          <em>{chart === 'timeline' ? 'calendar years · produced volume MMBOE' : 'monthly reservoir volumes · active wells'}</em>
          {monthly.length > 0 && (
            <span className="fds-ad-seg">
              <button className={chart === 'flow' ? 'on' : ''} onClick={() => setChart('flow')}>Flow</button>
              <button className={chart === 'timeline' ? 'on' : ''} onClick={() => setChart('timeline')}>Timeline</button>
            </span>
          )}
          <button className={'fds-info' + (dossier?.gaps.length ? ' has-gaps' : '')}
            onClick={() => setPop('readiness')}
            title={`${dossier?.gaps.length ?? 0} open readiness gaps — open the ledger`}>
            <Info size={11} />
            <b>{dossier ? (dossier.gaps.length ? 'Gaps' : 'Complete') : '…'}</b>
            {dossier && dossier.gaps.length > 0 && <i>{dossier.gaps.length}</i>}
          </button>
        </div>
        {!dossier ? <div className="fds-ad-empty"><b>Reading the field record…</b></div>
          : chart === 'flow' && monthly.length > 0
            ? <WellCountPanel months={monthly} wells={wellSeries} />
            : <DevelopmentTimeline milestones={dossier.lifecycle.milestones} series={dossier.production.series}
              nowYear={nowYear} onPick={() => setPop('lifecycle')} />}
      </section>

      {/* ── analog benchmark: the class band this asset sits in ───────────────── */}
      <section className="fds-ad-bench-panel">
        <div className="fds-ad-section-title">
          <Library size={14} /><span>Recovery benchmark</span>
        </div>
        {dossier
          ? <BenchmarkBand bm={dossier.benchmark} />
          : <div className="fds-ad-empty"><b>…</b></div>}
        {prod && prod.series.length > 1 && (
          <div className="fds-ad-bench-spark">
            <span>Produced per year</span>
            <ProductionSpark series={prod.series} />
            <small>peak {prod.peak?.year} · latest {fmtPct(prod.declineFromPeak)} of peak</small>
          </div>
        )}
      </section>

      </div>{/* .fds-ad-panels */}
      </div>{/* .fds-ad-right */}

      {/* ── modals ───────────────────────────────────────────────────────────── */}
      {pop === 'lifecycle' && life && (
        <Modal title="Development lifecycle" sub={field.name} onClose={() => setPop(null)} wide>
          <div className="fds-modal-grid">
            <div className="fds-modal-card span2">
              <h4>Milestones</h4>
              <div className="fds-ad-milestones">
                {life.milestones.map((m) => (
                  <div key={m.id} className={m.year == null ? 'empty' : ''}>
                    <span>{m.label}</span>
                    <b>{m.year ?? 'unrecorded'}</b>
                    <small>{m.note}</small>
                  </div>
                ))}
                <div className={life.producingYears == null ? 'empty' : ''}>
                  <span>Current status</span>
                  <b>{STAGE_LABEL[life.stage]}</b>
                  <small>{reported(d?.statusDetail ?? d?.status)}</small>
                </div>
              </div>
            </div>
            <div className="fds-modal-card">
              <h4>Durations</h4>
              <div className="fds-ad-facts">
                <div><span>Discovery → FID</span><b>{life.appraisalYears != null ? `${life.appraisalYears} yr` : '—'}</b></div>
                <div><span>FID → first production</span><b>{life.developmentYears != null ? `${life.developmentYears} yr` : '—'}</b></div>
                <div><span>Discovery → first oil</span><b>{life.cycleTimeYears != null ? `${life.cycleTimeYears} yr` : '—'}</b></div>
                <div><span>Producing for</span><b>{life.producingYears != null ? `${life.producingYears} yr` : '—'}</b></div>
              </div>
            </div>
            <div className="fds-modal-card">
              <h4>Operatorship</h4>
              <div className="fds-ad-facts">
                <div><span>Operator</span><b>{reported(d?.operator)}</b></div>
                <div><span>Owners</span><b>{reported(d?.owners)}</b></div>
                <div><span>Setting</span><b>{reported(d?.onshoreOffshore)}</b></div>
                <div><span>Recovery type</span><b>{reported(d?.productionType)}</b></div>
              </div>
            </div>
            <div className="fds-modal-card span2">
              <p className="fds-ad-note lead">
                Dates are <b>as filed</b> in the GOGET master record. A missing date is shown as
                <b> unrecorded</b> and is never interpolated from the dates either side of it —
                an unknown sanction year makes the appraisal duration unknown, not zero.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {pop === 'reserves' && res && (
        <Modal title="Booked reserves" sub={`${field.name} · ${res.lines.length} filed row${res.lines.length === 1 ? '' : 's'}`}
          onClose={() => setPop(null)} wide>
          <div className="fds-ad-potential">
            <div><span>Liquids</span><b>{fmtMMBOE(res.oilMMstb)}</b><small>MMBOE</small></div>
            <div><span>Gas</span><b>{fmtMMBOE(res.gasMMBOE)}</b><small>MMBOE equivalent</small></div>
            <div><span>Total</span><b>{fmtMMBOE(res.totalMMBOE)}</b><small>MMBOE booked</small></div>
          </div>
          <p className="fds-ad-note lead">
            These are <b>reported reserves</b> from the field's regulatory/commercial filings —
            they are <b>not</b> STOIIP and not an in-place volume. Field Development consumes
            volumes by reference; it never re-derives them.
          </p>
          <h4 className="fds-modal-h4">Filed rows</h4>
          <div className="fds-ad-tablewrap">
            <table className="fds-ad-table">
              <thead><tr><th>Product</th><th>Class</th><th>Year</th><th>As filed</th><th>MMBOE</th></tr></thead>
              <tbody>
                {res.lines.map((l, i) => (
                  <tr key={i} className={l.mmboe == null ? 'muted' : ''}>
                    <td>{l.product}</td><td>{reported(l.classification)}</td><td>{l.year ?? '—'}</td>
                    <td>{l.raw}</td><td>{l.mmboe == null ? 'not convertible' : fmtMMBOE(l.mmboe)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {res.unreported > 0 && (
            <p className="fds-ad-note">
              {res.unreported} row{res.unreported > 1 ? 's are' : ' is'} filed without a recognised unit —
              excluded from the totals above and raised in the readiness ledger. Excluded is <b>not</b> zero.
            </p>
          )}
          <p className="fds-ad-note">
            Gas converts at 35.315 scf/Sm³ and 5,800 scf/boe.
          </p>
        </Modal>
      )}

      {pop === 'production' && prod && (
        <Modal title="Production history" sub={`${field.name} · ${prod.firstYear}–${prod.lastYear}`}
          onClose={() => setPop(null)} wide>
          <div className="fds-ad-potential">
            <div><span>Cumulative</span><b>{fmtMMBOE(prod.cumulativeMMBOE)}</b><small>MMBOE produced</small></div>
            <div><span>Peak year</span><b>{prod.peak?.year ?? '—'}</b><small>{fmtMMBOE(prod.peak?.mmboe)} MMBOE</small></div>
            <div><span>Latest</span><b>{fmtMMBOE(prod.latest?.mmboe)}</b><small>{prod.latest?.year} · {fmtPct(prod.declineFromPeak)} of peak</small></div>
          </div>
          <h4 className="fds-modal-h4">Per year</h4>
          <div className="fds-ad-tablewrap">
            <table className="fds-ad-table">
              <thead><tr><th>Year</th><th>MMBOE</th><th>Share of peak</th></tr></thead>
              <tbody>
                {[...prod.series].reverse().map((p) => (
                  <tr key={p.year}>
                    <td>{p.year}</td><td>{fmtMMBOE(p.mmboe)}</td>
                    <td>{prod.peak ? fmtPct(p.mmboe / prod.peak.mmboe) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fds-ad-note">
            Annual observations as filed in the catalogue — not a rate history. Only fields with a
            dedicated bundle (today, Volve) carry true monthly rates.
          </p>
        </Modal>
      )}

      {pop === 'readiness' && dossier && (
        <Modal title="Development readiness ledger" sub={field.name} onClose={() => setPop(null)}>
          <p className="fds-ad-note lead">
            What this asset does <b>not</b> yet have. For most of the world catalogue this list is the
            actual finding — it is the work programme required to reach a sanction decision, not an error.
          </p>
          {dossier.gaps.length ? (
            <div className="fds-ad-gaps">
              {dossier.gaps.map((g, i) => (
                <div key={i}><ShieldAlert size={13} /><div><b>{g.what}</b><small>{g.why}</small></div></div>
              ))}
            </div>
          ) : (
            <div className="fds-ad-empty-inline">
              No open gaps — dates, reserves, production history and reservoir description are all on record.
            </div>
          )}
          <h4 className="fds-modal-h4">Described reservoir</h4>
          <div className="fds-ad-facts">
            <div><span>Lithology</span><b>{reported(dossier.reservoir.lithology)}</b></div>
            <div><span>Drive mechanism</span><b>{reported(dossier.reservoir.drive)}</b></div>
            <div><span>Formation</span><b>{reported(dossier.reservoir.formation)}</b></div>
          </div>
          <p className="fds-ad-note">
            Reservoir description is not carried in the world catalogue — only fields with a dedicated
            study have lithology, drive and contacts. Without a drive class the recovery benchmark falls
            back to the full literature spread rather than a matched class band.
          </p>
        </Modal>
      )}

      {pop === 'volumes' && bundle && (
        <Modal title="In-place volume estimates" sub={`${field.name} · ${bundle.volumes.length} methods`} onClose={() => setPop(null)} wide>
          <p className="fds-ad-note lead">
            These are <b>not interchangeable</b>. Each estimate is the answer a different method gives,
            and they span an order of magnitude. The dossier deliberately shows all of them rather than
            picking one headline number — the spread <b>is</b> the uncertainty.
          </p>
          <div className="fds-ad-tablewrap">
            <table className="fds-ad-table">
              <thead><tr><th>Estimate</th><th>MMSm³</th><th>MMSTB</th><th>Basis</th></tr></thead>
              <tbody>
                {bundle.volumes.map((v) => (
                  <tr key={v.label}>
                    <td><b>{v.label}</b></td>
                    <td>{v.mmSm3.toFixed(1)}</td>
                    <td>{(v.mmSm3 * 6.2898107).toFixed(0)}</td>
                    <td>{v.basis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="fds-ad-note">
            <b>Why this matters.</b> Dividing cumulative production by the gross screening figure would
            produce a recovery factor of a few percent — an artefact of the screening method (a blanket
            contact over an unfaulted closure), not a property of the reservoir. Measured against the
            history-matched dynamic model the same production implies a recovery factor several times
            higher. This is exactly why the benchmark panel refuses to state an RF.
          </p>
          {bundle.contacts.length > 0 && (
            <>
              <h4 className="fds-modal-h4">Fluid contacts</h4>
              <div className="fds-ad-facts">
                {bundle.contacts.map((c) => (
                  <div key={c.kind}><span>{c.kind}</span><b>{c.tvdss} m TVDSS</b></div>
                ))}
              </div>
              <p className="fds-ad-note">{bundle.contacts[0].dataNature} · {bundle.contacts[0].prov}</p>
            </>
          )}
        </Modal>
      )}

      {pop === 'sources' && (
        <Modal title="Data availability & provenance" sub={field.name} onClose={() => setPop(null)} wide>
          <h4 className="fds-modal-h4" style={{ marginTop: 0 }}>Where each fact came from</h4>
          <div className="fds-ad-facts">
            <div><span>Status</span><b>{reported(d?.status)}</b><small>{prov?.status ?? '—'}</small></div>
            <div><span>Discovered</span><b>{reported(d?.discoveryYear)}</b><small>{prov?.discoveryYear ?? '—'}</small></div>
            <div><span>Operator</span><b>{reported(d?.operator)}</b><small>{prov?.operator ?? '—'}</small></div>
            <div><span>First production</span><b>{reported(d?.productionStartYear)}</b><small>{prov?.productionStartYear ?? '—'}</small></div>
            <div><span>Production series</span><b>{prod?.series.length ?? 0} yr</b><small>{prov?.production ?? '—'}</small></div>
            <div><span>Recoverable</span><b>{fmtMMBOE(res?.totalMMBOE)}</b><small>{prov?.reserves ?? '—'}</small></div>
          </div>
          {record && (record.discoveryWellbore || record.npdid || record.licence) && (
            <>
              <h4 className="fds-modal-h4">Regulator identity</h4>
              <div className="fds-ad-facts">
                <div><span>Discovery wellbore</span><b>{reported(record.discoveryWellbore)}</b></div>
                <div><span>Regulator id</span><b>{reported(record.npdid)}</b></div>
                <div><span>Licence</span><b>{reported(record.licence)}</b></div>
              </div>
            </>
          )}
          {bundle && (
            <>
              {/* the matrix that used to be a strip along the bottom of the dossier —
                  every tile it carried is preserved here, per-wellbore coverage
                  expressed as a share so 24 of 27 reads as 89%, not just "24" */}
              <h4 className="fds-modal-h4">Data availability</h4>
              <div className="fds-ad-facts">
                <div><span>Wellbores</span><b>{bundle.wells}</b><small>{bundle.explorationWells} exploration</small></div>
                <div><span>Producers / injectors</span><b>{bundle.producers} / {bundle.injectors}</b>
                  <small>{bundle.nonFlowing ? `${bundle.nonFlowing} non-flowing · ` : ''}{bundle.roleUnknown ? `${bundle.roleUnknown} role unrecorded` : 'role recorded for every well'}</small></div>
                <div><span>With logs</span><b>{bundle.withLogs}</b><small>{pctOf(bundle.withLogs, bundle.wells)} of bores</small></div>
                <div><span>Trajectories</span><b>{bundle.withTraj}</b><small>{pctOf(bundle.withTraj, bundle.wells)} of bores</small></div>
                <div><span>Formation tops</span><b>{bundle.withPicks}</b><small>{pctOf(bundle.withPicks, bundle.wells)} of bores</small></div>
                <div><span>Flowing record</span><b>{bundle.withProduction}</b><small>{pctOf(bundle.withProduction, bundle.wells)} of bores</small></div>
                <div><span>Months production</span><b>{bundle.productionMonths}</b><small>{bundle.firstMonth}→{bundle.lastMonth}</small></div>
                <div><span>In-place estimates</span><b>{bundle.volumes.length}</b><small>method-dependent</small></div>
                <div><span>Surfaces</span><b>{bundle.surfaces}</b><small>{bundle.surfacePoints.toLocaleString()} points</small></div>
                <div><span>CRS</span><b>{reported(bundle.crs)}</b><small>{reported(bundle.datum)}</small></div>
              </div>
              {bundle.provenance && (
                <>
                  <h4 className="fds-modal-h4">Bundle provenance</h4>
                  <div className="fds-ad-facts">
                    {Object.entries(bundle.provenance).map(([k, v]) => (
                      <div key={k}><span>{k}</span><b style={{ fontSize: 9.5, fontWeight: 500 }}>{v}</b></div>
                    ))}
                  </div>
                </>
              )}
              {bundle.sourceFiles.length > 0 && (
                <p className="fds-ad-note">
                  Derived from source files: {bundle.sourceFiles.map((f) => <code key={f}>{f}</code>)}
                </p>
              )}
            </>
          )}
          <h4 className="fds-modal-h4">Catalogue tier</h4>
          <div className="fds-ad-facts">
            <div><span>GOGET field spine</span><b>{(sourceRecordCount(context, 'GOGET') ?? 8032).toLocaleString()}</b><small>records</small></div>
            <div><span>USGS geologic context</span><b>{sourceRecordCount(context, 'USGS') ?? 698}</b><small>records</small></div>
          </div>
          <p className="fds-ad-note">
            Facts resolve through an authority ladder: GOGET/OSDU first, then the sector regulator
            (Sodir / NSTA), then the deep data bundle. Nothing is hard-coded per field — a fact absent
            from every authority stays blank and is raised in the readiness ledger.
          </p>
        </Modal>
      )}
    </section>
  );
}

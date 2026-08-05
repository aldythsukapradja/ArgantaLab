// KnowledgeBank.tsx — the Basin Dossier.
//
// Reframed from a record browser into a screening tool. One screen answers "is this
// basin worth my money, and what do I still need to find out"; everything deeper is a
// popover, so the surface stays executive-readable.
//
//   header    scope + four numbers, each of which is itself the button to its detail
//   left      basemap (CockpitMap, focused on scope) — click a field → its dossier
//   middle    petroleum system events chart
//   right     three verdict cards: Maturity · Geology · Charge
//   footer    discovery timeline — scrubbing it replays the basin being found
//
// "Major fields" is used deliberately throughout: the catalogue (GOGET) tracks major
// accumulations only, so a bare "fields" count would overstate what we actually hold.
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, BookImage, CalendarClock, ChevronLeft, ChevronRight, Database, Droplets, Info, Layers, Mountain,
  ShieldAlert, TrendingUp, X,
} from 'lucide-react';
import { loadSearchIndex, searchTypeLabel, type SearchEntry } from '../../cosmo/cockpit-search';
import { CockpitMap } from '../../cosmo/CockpitMap';
import { VOLVE_BASIN } from '../../cosmo/knowledge-model';
import { STRAT_COLUMN } from './legacy/explData';
import { loadKbSpine, type KbSpine } from '../../dataqc/masterkb';
import {
  buildBasinInsight, buildFieldSizeSummary, buildPetroleumSystemChart,
  loadFieldDetail, loadFieldSizes, loadVolumes,
  type AssessmentUnitRow, type BasinInsight, type FieldDetail,
} from './basin-insight';
import {
  BoeBarChart, BoePieChart, CreamingSpark, EventsChartView, HcDonut,
  MixBar, TectonoStratChart, type CrossFilter, type TectonoElement,
} from './BasinCharts';
import {
  FIGURE_CLASSES, FIGURE_STATS, attributionFor, figureByNumber, figuresFor,
  type BasinFigure, type FigureClass,
} from './basin-figures';
import { cycleFigureFor, doustLinkFor } from './doust-basin-links';
import { buildTimescale, describeRange, type GeoUnit } from './geo-time';
import { TimeRangeRail } from './TimeRangeRail';
import { buildPlates, type Plate } from './basin-plates';
import { BasinPlateGallery } from './BasinPlateGallery';
import { FigureStrip } from './FigureStrip';
import { BasinChartLibrary } from './BasinChartLibrary';
import { CreamingCurve } from './CreamingCurve';
// Aliased: `BasinFigure` is already the Doust-booklet figure type in ./basin-figures.
import {
  figuresForEntity, linkOnlyForEntity, figureSrc, figureAttribution,
  figureTypeLabel, type RegistryFigure as PublishedFigure,
} from './basin-figure-library';

const base = import.meta.env.BASE_URL || '/';
const HC_PALETTE = ['#10b981', '#f43f5e', '#f59e0b', '#38bdf8', '#a78bfa'];
const ST_PALETTE = ['#22d3ee', '#94a3b8', '#f59e0b', '#a78bfa', '#f43f5e'];

/** The USGS province outlines the cockpit map already ships — reused here to draw the
 *  basin's real shape on its title card. Fetched once and shared across scope changes. */
type ProvinceRings = Record<string, number[][]>;
let ringsPromise: Promise<ProvinceRings | null> | null = null;
const loadProvinceRings = () => {
  ringsPromise ??= fetch(`${base}world/provinces.geojson`)
    .then((r) => (r.ok ? r.json() : null))
    .then((g: { features?: Array<{ properties?: { prvCode?: string | number }; geometry?: { type: string; coordinates: unknown } }> } | null) => {
      if (!g?.features) return null;
      const out: ProvinceRings = {};
      for (const f of g.features) {
        const code = String(f.properties?.prvCode ?? '');
        if (!code || !f.geometry) continue;
        // Keep the largest ring only — a province split across several polygons still
        // reads correctly as one outline, and the plate is a locator, not a basemap.
        const polys = f.geometry.type === 'MultiPolygon'
          ? (f.geometry.coordinates as number[][][][]).map((p) => p[0])
          : [(f.geometry.coordinates as number[][][])[0]];
        const biggest = polys.filter(Boolean).sort((a, b) => b.length - a.length)[0];
        if (biggest?.length) out[code] = biggest;
      }
      return out;
    })
    .catch(() => null);
  return ringsPromise;
};

type ScopeField = { id: string; name: string; country: string; source: string; fly: { lon: number; lat: number } };
type ScopeFieldIndex = { methodology: string; provinces: Record<string, ScopeField[]>; assessmentUnits: Record<string, ScopeField[]> };
let scopeFieldsPromise: Promise<ScopeFieldIndex | null> | null = null;
const loadScopeFields = () => {
  if (!scopeFieldsPromise) scopeFieldsPromise = fetch(`${base}osdu/cockpit-scope-fields.json`)
    .then((r) => (r.ok ? (r.json() as Promise<ScopeFieldIndex>) : null)).catch(() => null);
  return scopeFieldsPromise;
};

type Popover = 'history' | 'strat' | 'doust' | 'gaps' | 'potential' | 'inventory' | 'figures' | null;

/** One formation's full interpretation, assembled for the click-through popup. */
interface FormationDetail {
  unitName: string; role?: string; from?: number; to?: number;
  effectiveness?: string; confidence?: string; notes?: string; citationId?: string;
  group?: string; environment?: string; roleNote?: string; cycleTitle?: string;
  reservoir?: { lithology?: string; age?: string; drive?: string; owc?: number; field?: string };
}

function Modal({ title, sub, onClose, children, wide }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="exs-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={'exs-lightbox-inner' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>
        <header>
          <div><span>{sub}</span><b>{title}</b></div>
          <button onClick={onClose} aria-label="Close"><X size={16} /></button>
        </header>
        <div className="exs-modal-body">{children}</div>
      </div>
    </div>
  );
}

function FigureThumb({ figure, onOpen }: { figure: BasinFigure; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  return (
    <button className="exs-fig-card" onClick={onOpen} title={figure.caption}>
      <div className="exs-fig-thumb">
        {broken
          ? <div className="exs-fig-missing"><BookImage size={16} /><span>Not extracted locally</span></div>
          : <img src={`${base}${figure.file}`} alt={`Figure ${figure.fig}`} loading="lazy" onError={() => setBroken(true)} />}
      </div>
      <div className="exs-fig-meta">
        <span>Fig {figure.fig} · p{figure.page}</span>
        <b>{figure.caption}</b>
        <small>{attributionFor(figure)}</small>
      </div>
    </button>
  );
}

export function ExplorationKnowledgeBank({ scope, onScope }: {
  scope: SearchEntry;
  /** Re-scope the whole dossier — the map calls this so clicking a province or
   *  assessment unit cross-filters every panel, not just the map. */
  onScope?: (next: SearchEntry) => void;
}) {
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [scopeFieldIndex, setScopeFieldIndex] = useState<ScopeFieldIndex | null | undefined>(undefined);
  const [detail, setDetail] = useState<Record<string, FieldDetail> | null | undefined>(undefined);
  const [pop, setPop] = useState<Popover>(null);
  const [scrubYear, setScrubYear] = useState<number | null>(null);
  const [selectedField, setSelectedField] = useState<{ id: string; name: string } | null>(null);
  const [figClass, setFigClass] = useState<FigureClass>('extensional');
  const [openFigure, setOpenFigure] = useState<BasinFigure | null>(null);
  const [volumes, setVolumes] = useState<Awaited<ReturnType<typeof loadVolumes>>>(null);
  const [kbSpine, setKbSpine] = useState<KbSpine | null>(null);
  const [fieldSizes, setFieldSizes] = useState<Awaited<ReturnType<typeof loadFieldSizes>>>(null);
  const [rings, setRings] = useState<ProvinceRings | null>(null);
  const [openPlate, setOpenPlate] = useState<Plate | null>(null);
  const [formation, setFormation] = useState<string | null>(null);
  const [crossFilter, setCrossFilter] = useState<CrossFilter>(null);
  // Shared geologic-time window for BOTH geology charts (null = full column).
  const [timeRange, setTimeRange] = useState<[number, number] | null>(null);
  const [timeFocus, setTimeFocus] = useState<GeoUnit | null>(null);
  const [timeAnchor, setTimeAnchor] = useState<GeoUnit | null>(null);

  useEffect(() => { loadSearchIndex().then(setIndex); }, []);
  useEffect(() => { loadFieldDetail().then(setDetail); }, []);
  useEffect(() => { loadVolumes().then(setVolumes); }, []);
  useEffect(() => { loadKbSpine().then(setKbSpine); }, []);
  useEffect(() => { loadFieldSizes().then(setFieldSizes); }, []);
  useEffect(() => { loadProvinceRings().then(setRings); }, []);
  useEffect(() => {
    let alive = true; setScopeFieldIndex(undefined);
    loadScopeFields().then((v) => { if (alive) setScopeFieldIndex(v); });
    return () => { alive = false; };
  }, [scope.id]);
  useEffect(() => {
    setScrubYear(null); setSelectedField(null); setCrossFilter(null); setFormation(null);
    setTimeRange(null); setTimeFocus(null); setTimeAnchor(null);
  }, [scope.id]);

  const scopeCode = scope.id.split(':').pop() ?? '';

  /** The province code this scope sits in — AUs resolve up to their province so the
   *  basin-level records (classification, completion) still apply. */
  const provinceCode = useMemo(() => {
    if (scope.type === 'province') return scopeCode;
    if (scope.type === 'assessment-unit') return volumes?.aus.find((a) => a.auCode === scopeCode)?.prvCode ?? null;
    return null;
  }, [scope.type, scopeCode, volumes]);

  /** The KB's own Basin row — carries the REVIEWED whole-basin geodynamic call. This
   *  replaces the app-side hardcoded table: the workbook is the source of truth. */
  const kbBasin = useMemo(
    () => (provinceCode ? kbSpine?.basin.find((b) => b.province_id?.endsWith(`:${provinceCode}`)) ?? null : null),
    [kbSpine, provinceCode],
  );
  /** Reviewed whole-basin geodynamic call exists? (KB is the source of truth.) */
  const classified = kbBasin?.classification_status === 'source-classified';

  /** Authored readiness scoring for this basin (Basin Completion tab). */
  const completion = useMemo(
    () => (kbBasin ? kbSpine?.basinCompletion.find((c) => c.basin_id === kbBasin.basin_id) ?? null : null),
    [kbSpine, kbBasin],
  );

  /** Ordered, timed cycles for THIS basin, straight from the KB. Empty for a basin
   *  nobody has modelled yet — which the cycle track then says outright. */
  const kbCycles = useMemo(() => (kbSpine?.basinCycle ?? []).filter(
    (c) => kbBasin && c.basin_id === kbBasin.basin_id
      && Number.isFinite(c.age_top_ma) && Number.isFinite(c.age_base_ma),
  ).sort((a, b) => (b.age_top_ma ?? 0) - (a.age_top_ma ?? 0)), [kbSpine, kbBasin]);

  /** Card-shaped view of those cycles (title/stage/geodynamics for the strip + figures). */
  const cycles = useMemo(() => kbCycles.map((c) => ({
    id: c.cycle_id, title: c.title ?? c.cycle_id, stage: c.stage,
    geodynamics: c.geodynamics ?? 'none', fill: c.fill, lithology: c.lithology,
    ageMa: [Math.max(c.age_top_ma!, c.age_base_ma!), Math.min(c.age_top_ma!, c.age_base_ma!)] as [number, number],
  })), [kbCycles]);

  const fieldsInScope: ScopeField[] = useMemo(() => {
    if (scope.type === 'province') return scopeFieldIndex?.provinces[scopeCode] ?? [];
    if (scope.type === 'assessment-unit') return scopeFieldIndex?.assessmentUnits[scopeCode] ?? [];
    return index?.filter((e) => e.type === 'field' && e.parent.split(' · ')[0] === scope.name)
      .map((e) => ({ id: e.id, name: e.name, country: e.parent, source: e.source, fly: e.fly! }))
      .filter((e) => e.fly) ?? [];
  }, [scope.type, scope.name, scopeCode, scopeFieldIndex, index]);

  const insight: BasinInsight | null = useMemo(
    () => (detail === undefined ? null : buildBasinInsight(fieldsInScope, detail, fieldSizes)),
    [fieldsInScope, detail],
  );

  // Only the Viking Graben (USGS province 4025) has a real cycle + strat model today.
  // Every other basin honestly reports that it has none rather than borrowing this one.
  const modelledBasin = useMemo(() => {
    const p = VOLVE_BASIN.usgsProvince;
    const hit = p && (scopeCode === p.code || scope.name === p.name || scope.parent === p.name
      || scope.name === VOLVE_BASIN.name || scope.parent?.includes(p.name));
    return hit ? VOLVE_BASIN : null;
  }, [scopeCode, scope.name, scope.parent]);

  // Doust's own worked examples, matched to real USGS provinces by name (see
  // doust-basin-links.ts). This is illustrative classification + a real citation, not
  // a full cycle model — it answers "what TYPE of basin is this and what does one look
  // like", distinct from (and complementary to) modelledBasin above.
  const doustLink = useMemo(() => {
    if (modelledBasin) return null; // Viking Graben already has a full real model
    if (scope.type === 'province') return doustLinkFor(scopeCode);
    if (scope.type === 'assessment-unit') {
      const prvCode = volumes?.aus.find((a) => a.auCode === scopeCode)?.prvCode;
      return prvCode ? doustLinkFor(prvCode) : null;
    }
    return null;
  }, [modelledBasin, scope.type, scopeCode, volumes]);
  const doustFig = doustLink && doustLink.primaryFig > 0 ? figureByNumber(doustLink.primaryFig) : null;

  /** The cross-section that best pictures THIS basin, for the header. Viking Graben has
   *  its own (fig. 8); the nine Doust-matched provinces use their named figure. */
  const basinFigure = useMemo(() => {
    if (modelledBasin) return figureByNumber(8);
    return doustFig;
  }, [modelledBasin, doustFig]);

  /** PUBLISHED figures for this basin — cross-sections, stratigraphic charts and
   *  depositional maps harvested from the literature. These lead the picture card;
   *  a drawn locator is only the fallback when nothing published was found. */
  // Read straight off the KB spine: the Figure Registry and its junction are the
  // governed source, so no separate manifest fetch and no chance of an ungoverned
  // image reaching the card. figuresForEntity() drops anything not redistributable.
  const pubFigures = useMemo(
    () => figuresForEntity(kbSpine, kbBasin?.basin_id),
    [kbSpine, kbBasin],
  );
  /** The geology subset — what someone opening a stratigraphy or formation popup is
   *  actually after. Maps and discovery curves belong on the title card, not here. */
  const stratFigures = useMemo(
    () => pubFigures.filter((f) => ['strat-chart', 'cross-section', 'depositional', 'burial']
      .includes(f.figure_type)),
    [pubFigures],
  );
  /** Everything the library shows. Maps included — a basin whose only redistributable
   *  plates are locators should still show them rather than an empty frame. */
  const libFigures = pubFigures;
  /** Published figures we may NOT reproduce. Catalogued and linked, never hidden:
   *  for the North Sea Graben these are the stratigraphic summary and the burial
   *  curves, i.e. the two a reader most wants. */
  const lockedFigures = useMemo(
    () => linkOnlyForEntity(kbSpine, kbBasin?.basin_id),
    [kbSpine, kbBasin],
  );

  const fieldSizeSummary = useMemo(
    () => buildFieldSizeSummary(fieldsInScope, fieldSizes ?? null),
    [fieldsInScope, fieldSizes],
  );

  const psModel = useMemo(() => {
    if (!kbSpine) return null;
    const grade = (g?: string) => Number(g?.replace(/\D/g, '') || 0);
    let tpsIds = new Set<string>();
    let exactScopeId: string | null = null;
    if (scope.type === 'assessment-unit') {
      const au = kbSpine.assessmentUnit.find((a) => a.code === scopeCode || a.au_id.endsWith(`:${scopeCode}`));
      if (au?.tps_id) tpsIds.add(au.tps_id);
      exactScopeId = au?.au_id ?? null;
    } else if (scope.type === 'province') {
      const province = kbSpine.province.find((p) => p.code === scopeCode || p.province_id.endsWith(`:${scopeCode}`));
      tpsIds = new Set(kbSpine.petroleumSystem.filter((t) => t.province_id === province?.province_id).map((t) => t.tps_id));
    }
    const candidates = kbSpine.psModel.filter((m) => tpsIds.has(m.tps_id));

    // CURATION beats breadth. A TPS can carry both an auto-normalised catalogue model
    // (elements lifted from authority narrative — broad, but noisy: duplicate bars and
    // the odd lithology word parsed as a formation) and a reviewed AU model with real
    // named stratigraphy. Grade alone can't separate them — both sit at G1 — so rank by
    // the share of elements that carry an ASSESSED effectiveness, which is the direct
    // signature of a human-reviewed model. (North Sea Graben had both; without this the
    // array order won and the reservoir row read "Coal" over and over.)
    const curation = (m: { model_id: string }) => {
      const els = kbSpine.psElement.filter((e) => e.model_id === m.model_id);
      if (!els.length) return -1;
      const assessed = els.filter((e) => e.effectiveness && e.effectiveness !== 'not-assessed').length;
      return assessed / els.length;
    };
    const scored = candidates.map((m) => ({ m, cure: curation(m) }));
    scored.sort((a, b) =>
      Number(b.m.scope_id === exactScopeId) - Number(a.m.scope_id === exactScopeId)
      || b.cure - a.cure
      || grade(b.m.completeness_grade) - grade(a.m.completeness_grade));
    return scored[0]?.m ?? null;
  }, [kbSpine, scope.type, scopeCode]);

  /** Cycles enriched with the petroleum-system elements that fall inside them, so the
   *  library can answer "which cycle actually sourced this basin" rather than listing
   *  cycles and elements as unrelated tables. */
  const libCycles = useMemo(() => {
    const els = psModel && kbSpine
      ? kbSpine.psElement.filter((e) => e.model_id === psModel.model_id)
      : [];
    return cycles.map((c) => {
      const [older, younger] = c.ageMa;
      const inside = els.filter((e) => {
        if (e.start_ma == null || e.end_ma == null) return false;
        const a = Math.max(e.start_ma, e.end_ma), b = Math.min(e.start_ma, e.end_ma);
        return a <= older + 1e-6 && b >= younger - 1e-6;      // element sits within the cycle
      });
      const raw = kbCycles.find((k) => k.cycle_id === c.id);
      return {
        id: c.id, title: c.title, stage: raw?.stage, geodynamics: c.geodynamics,
        fill: c.fill, lithology: c.lithology, dominantRole: raw?.dominant_role,
        ageMa: c.ageMa, units: raw?.units,
        citationStatus: raw?.citation_status, confidence: raw?.confidence,
        elements: inside.map((e) => ({
          unit: e.unit_name ?? '', role: e.element_role,
          from: e.start_ma, to: e.end_ma,
          derived: e.provenance === 'derived-rule',
        })),
      };
    });
  }, [cycles, kbCycles, kbSpine, psModel]);

  // ── the title card's pictures ────────────────────────────────────────────────
  // Every plate is DRAWN from data we hold, which is what makes a picture possible for
  // all 179 basins rather than the ~10 with a published figure. See basin-plates.tsx
  // for why sourcing or synthesizing images was rejected.
  const plates: Plate[] = useMemo(() => {
    if (!kbSpine) return [];
    const ring = provinceCode ? rings?.[provinceCode] ?? null : null;
    const fieldPoints = fieldsInScope
      .filter((f) => f.fly)
      .map((f) => ({ lon: f.fly.lon, lat: f.fly.lat, hc: detail?.[f.id]?.fuelType ?? undefined }));
    const plateFields = fieldsInScope.map((f) => ({
      name: f.name,
      discovery_year: detail?.[f.id]?.discoveryYear ?? undefined,
      hc_type: detail?.[f.id]?.fuelType ?? undefined,
      status: detail?.[f.id]?.status ?? undefined,
    }));
    const province = kbSpine.province.find((p) => p.code === provinceCode);
    // Published plates lead — a cross-section a geologist can cite beats anything we
    // draw. The locator map is the tail, and for a basin with no published figure at
    // all it is the whole card rather than a blank frame.
    const published = pubFigures.map((f: PublishedFigure) => ({
      id: f.figure_id,
      kind: 'figure' as const,
      title: `${figureTypeLabel(f.figure_type)} — ${f.caption ?? f.title ?? ''}`,
      provenance: figureAttribution(f),
      node: <img src={figureSrc(f)} alt={f.caption ?? ''} loading="lazy" className="exs-plate-img" />,
    }));
    const drawn = buildPlates({
      name: scope.name,
      ring,
      fieldPoints,
      fields: plateFields,
      cycles: kbCycles,
      elements: psModel ? kbSpine.psElement.filter((e) => e.model_id === psModel.model_id) : [],
      events: psModel ? kbSpine.psEvent.filter((e) => e.model_id === psModel.model_id) : [],
      oilMean: province?.oilMean_mmbbl,
      gasMean: province?.gasMean_bcf,
      figure: basinFigure,
      figureSrc: basinFigure ? `${base}${basinFigure.file}` : undefined,
      figureCredit: basinFigure ? attributionFor(basinFigure) : undefined,
    });
    return [...published, ...drawn];
  }, [kbSpine, provinceCode, rings, fieldsInScope, detail, kbCycles, psModel, basinFigure, scope.name, pubFigures]);

  const openPlateIndex = openPlate ? plates.findIndex((plate) => plate.id === openPlate.id) : -1;
  const stepOpenPlate = (direction: number) => {
    if (plates.length < 2) return;
    const current = openPlateIndex >= 0 ? openPlateIndex : 0;
    setOpenPlate(plates[(current + direction + plates.length) % plates.length]);
  };

  useEffect(() => {
    if (!openPlate || plates.length < 2) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') { event.preventDefault(); stepOpenPlate(-1); }
      if (event.key === 'ArrowRight') { event.preventDefault(); stepOpenPlate(1); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openPlate, openPlateIndex, plates]);

  const events = useMemo(() => {
    if (!kbSpine || !psModel) return null;
    const elements = kbSpine.psElement.filter((e) => e.model_id === psModel.model_id);
    const processEvents = kbSpine.psEvent.filter((e) => e.model_id === psModel.model_id);
    const contributions = new Map(kbSpine.psCycle.filter((x) => x.tps_id === psModel.tps_id).map((x) => [x.cycle_id, x.contribution]));
    const cycles = kbSpine.basinCycle.filter((c) => contributions.has(c.cycle_id)).map((c) => ({ ...c, contribution: contributions.get(c.cycle_id) }));
    return buildPetroleumSystemChart(elements, processEvents, cycles, kbSpine.geologicTimescale, {
      title: psModel.title, grade: psModel.completeness_grade, timescale: psModel.timescale_version,
      scope: `${psModel.scope_type.replace(/-/g, ' ')} · ${psModel.status ?? 'draft'} · v${psModel.version ?? '1'}`,
    });
  }, [kbSpine, psModel]);

  // ── tectonostratigraphy: ICS periods ‖ basin cycles ‖ timed PS elements ──────
  const tecto = useMemo(() => {
    const periods = (kbSpine?.geologicTimescale ?? [])
      .filter((p) => p.rank === 'period' && Number.isFinite(p.start_ma))
      .map((p) => ({ id: p.unit_id, name: p.name, from: p.start_ma, to: p.end_ma, parent: p.parent_name }))
      .sort((a, b) => b.from - a.from);
    // Cycles come from the KB keyed on THIS scope's basin — so any basin Codex has
    // modelled shows a cycle track, not just Viking Graben. Their `cycle_id` is also
    // the exact key psElement's `basin_cycle_id` points at, which is what lets the two
    // charts cross-filter; the in-code seed uses short ids that would never match.
    const cycleRows = kbCycles.map((c) => ({
      id: c.cycle_id, label: c.title ?? c.cycle_id,
      from: Math.max(c.age_top_ma!, c.age_base_ma!), to: Math.min(c.age_top_ma!, c.age_base_ma!),
      geodynamics: c.geodynamics,
    }));
    const elements: TectonoElement[] = psModel && kbSpine
      ? kbSpine.psElement.filter((e) => e.model_id === psModel.model_id).map((e) => ({
        unitName: e.unit_name, role: e.element_role,
        from: Math.max(e.start_ma, e.end_ma), to: Math.min(e.start_ma, e.end_ma),
        effectiveness: e.effectiveness, confidence: e.confidence, cycleId: e.basin_cycle_id,
      }))
      : [];
    return { periods, cycles: cycleRows, elements };
  }, [kbSpine, psModel, kbCycles]);

  /** Everything the catalogue holds about one formation, gathered on click. */
  const formationDetail: FormationDetail | null = useMemo(() => {
    if (!formation) return null;
    const el = kbSpine?.psElement.find((e) => e.model_id === psModel?.model_id && e.unit_name === formation);
    const kbStrat = kbSpine?.stratigraphy.find((s) => s.unit_name === formation);
    const localStrat = STRAT_COLUMN.find((u) => u.name === formation);
    const cycleId = el?.basin_cycle_id ?? kbStrat?.cycle_id;
    const cycleTitle = kbSpine?.basinCycle.find((c) => c.cycle_id === cycleId)?.title
      ?? modelledBasin?.cycles.find((c) => cycleId?.endsWith(c.id))?.title;
    const res = kbSpine?.reservoir.find((r) => r.formation_name === formation);
    return {
      unitName: formation,
      role: el?.element_role ?? kbStrat?.ps_role ?? localStrat?.role,
      from: el ? Math.max(el.start_ma, el.end_ma) : (kbStrat?.age_top_ma ?? localStrat?.ageMa[0]),
      to: el ? Math.min(el.start_ma, el.end_ma) : (kbStrat?.age_base_ma ?? localStrat?.ageMa[1]),
      effectiveness: el?.effectiveness, confidence: el?.confidence,
      notes: el?.notes, citationId: el?.source_citation_id ?? kbStrat?.source_citation_id,
      group: kbStrat?.group ?? localStrat?.group,
      environment: kbStrat?.environment ?? localStrat?.env,
      roleNote: kbStrat?.role_note ?? localStrat?.roleNote,
      cycleTitle,
      reservoir: res ? { lithology: res.lithology, age: res.age, drive: res.drive_mechanism, field: res.field_id } : undefined,
    };
  }, [formation, kbSpine, psModel, modelledBasin]);

  const focus = useMemo(
    () => (scope.fly ? { lon: scope.fly.lon, lat: scope.fly.lat, zoom: scope.type === 'field' ? 8 : 5 } : null),
    [scope.fly, scope.type],
  );

  // Undiscovered volumes for this scope, straight from the ingested USGS polygons.
  // A province that was never assessed resolves to null and renders as "—", never 0.
  const assessed = useMemo(() => {
    if (!volumes) return null;
    if (scope.type === 'province') return volumes.provinces[scopeCode] ?? null;
    if (scope.type === 'assessment-unit') {
      const au = volumes.aus.find((a) => a.auCode === scopeCode);
      return au ? { name: au.auName, oilMean: au.oilMean, gasMean: au.gasMean, boeMean: au.boeMean } : null;
    }
    return null;
  }, [volumes, scope.type, scopeCode]);

  const scopeAus: AssessmentUnitRow[] = useMemo(() => {
    if (!volumes) return [];
    if (scope.type === 'province') return volumes.aus.filter((a) => a.prvCode === scopeCode).sort((a, b) => (b.boeMean ?? 0) - (a.boeMean ?? 0));
    if (scope.type === 'assessment-unit') return volumes.aus.filter((a) => a.auCode === scopeCode);
    return [];
  }, [volumes, scope.type, scopeCode]);

  const ytfNum = assessed?.boeMean ?? null;

  /** Raw USGS authority text for this scope's petroleum system — candidate formations
   *  and process statements. Reported age TERMS only, never numeric, so these are shown
   *  as evidence-to-normalise and are deliberately NOT drawn on the timed charts. */
  const authorityEvidence = useMemo(() => {
    const empty = { candidates: [] as KbSpine['psElementCandidate'], processes: [] as KbSpine['psProcessEvidence'] };
    if (!kbSpine || !psModel) return empty;
    const code = kbSpine.petroleumSystem.find((t) => t.tps_id === psModel.tps_id)?.code;
    if (!code) return empty;
    const key = String(code);
    return {
      candidates: kbSpine.psElementCandidate.filter((c) => String(c.tps_code) === key).slice(0, 24),
      processes: kbSpine.psProcessEvidence.filter((p) => String(p.tps_code) === key).slice(0, 24),
    };
  }, [kbSpine, psModel]);

  /** This model's chart-completion row — the authored per-model work queue. */
  const chartDone = useMemo(
    () => (psModel ? kbSpine?.psChartCompletion.find((c) => c.model_id === psModel.model_id) ?? null : null),
    [kbSpine, psModel],
  );

  const gapList = useMemo(() => {
    const g: Array<{ what: string; why: string }> = [];
    // Authored gaps lead: the per-model chart row to close, then the per-basin action.
    if (chartDone?.next_gap) {
      g.push({
        what: chartDone.next_gap,
        why: `next chart row to close · ${chartDone.remaining_chart_rows ?? '?'} of 11 rows still open · review stage: ${chartDone.review_stage ?? 'unassigned'}`,
      });
    }
    if (completion?.primary_gap) g.push({ what: completion.primary_gap, why: completion.next_action ?? 'authored primary gap for this basin' });
    if (!psModel || psModel.completeness_grade === 'G0') g.push({ what: 'Petroleum-system framework', why: 'catalogue identity only — elements and processes are not yet modelled' });
    if (!cycles.length) g.push({ what: 'Basin cycle model', why: 'no ordered cycle stack — the tectonostratigraphy column has no cycle track' });
    if (!events) g.push({ what: 'Stratigraphic column', why: 'no units, so no source/reservoir/seal in time' });
    events?.rows.filter((r) => !r.modelled).forEach((r) => g.push({ what: r.label, why: `needs ${r.requires}` }));
    if (!insight?.dated) g.push({ what: 'Discovery dates', why: 'no dated discoveries — maturity cannot be read' });
    return g;
  }, [completion, cycles, psModel, events, insight]);

  const gallery = figuresFor(figClass);

  /** Each real cycle paired with the Doust figure that depicts that stage. */
  /** Era / period / epoch tiers the zoom rail offers. */
  const timeUnits = useMemo(() => buildTimescale(kbSpine?.geologicTimescale), [kbSpine]);
  const fullSpan: [number, number] = useMemo(() => {
    const oldest = Math.max(0, ...tecto.periods.map((p) => p.from), ...tecto.elements.map((e) => e.from));
    return [oldest || 541, 0];
  }, [tecto]);
  const rangeLabel = useMemo(
    () => describeRange(timeUnits, timeRange, fullSpan),
    [timeUnits, timeRange, fullSpan],
  );

  const cycleFigures = useMemo(() => cycles.map((c) => {
    const rule = cycleFigureFor({ stage: c.stage, title: c.title, geodynamics: c.geodynamics });
    return { cycle: c, rule, fig: rule ? figureByNumber(rule.fig) : null };
  }), [cycles]);

  const kpi = (Icon: typeof Database, label: string, value: string, sub: string, onClick?: () => void) => (
    <button className={'exs-kpi' + (onClick ? ' live' : '')} onClick={onClick} disabled={!onClick}>
      <span><Icon size={10} />{label}</span><b>{value}</b><small>{sub}</small>
    </button>
  );

  return (
    <section className="exs-bd" aria-label={`${scope.name} Basin Dossier`}>
      {/* ── header: scope + the four numbers that are also the buttons ───────── */}
      <header className="exs-bd-head">
        {/* The basin's own cross-section, so the dashboard opens with a picture of the
            thing it is about — this is the frame you'd put on a title slide. */}
        {plates.length > 0 && (
          <BasinPlateGallery plates={plates} basinKey={scope.id || scope.name}
            onExpand={(p) => setOpenPlate(p)} />
        )}
        <div className="exs-bd-id">
          <small>{searchTypeLabel(scope.type)}</small>
          <h2>{scope.name}</h2>
          <p>{scope.parent}</p>
        </div>
        <div className="exs-kpis">
          {kpi(Database, 'Major fields', insight ? insight.total.toLocaleString() : '…',
            insight ? `${insight.producing.toLocaleString()} operating` : 'loading',
            fieldsInScope.length ? () => setPop('inventory') : undefined)}
          {kpi(CalendarClock, 'Found', insight?.firstYear ? `${insight.firstYear}–${insight.lastYear}` : '—',
            insight ? `${insight.dated} dated` : 'loading',
            insight?.dated ? () => setPop('history') : undefined)}
          {kpi(TrendingUp, 'Left to find', ytfNum != null ? `${(ytfNum / 1000).toFixed(2)} BBOE` : '—',
            'USGS undiscovered mean', () => setPop('potential'))}
        </div>
      </header>

      {/* One flat grid: the map occupies column 1 across BOTH content rows, so the
          verdict strip lines up with the petroleum-system column's left edge and the
          map gets the full height back. */}
      <div className="exs-bd-map">
        <CockpitMap
          dark
          mode="2d"
          theme="satellite"
          focus={focus}
          onSelect={(sel) => {
            if (!sel) return;
            const t = sel.type.toLowerCase();
            // A field opens its dossier; a province / assessment unit RE-SCOPES the
            // whole dashboard, so one map click cross-filters every panel.
            if (t.includes('field')) { setSelectedField({ id: sel.id, name: sel.name }); return; }
            if (!onScope || !index) return;
            const wanted = t.includes('assessment') ? 'assessment-unit' : t.includes('province') ? 'province' : null;
            if (!wanted) return;
            const next = index.find((e) => e.type === wanted
              && (e.id.endsWith(`:${sel.id}`) || e.name === sel.name));
            if (next && next.id !== scope.id) onScope(next);
          }}
        />
        <div className="exs-map-legend">
          <span><i style={{ background: '#5eead4' }} />field</span>
          <span><i style={{ background: '#0fb5a6' }} />province</span>
        </div>
      </div>

      {/* ── verdict strip: aligned with the petroleum-system column ──────────── */}
      <div className="exs-bd-verdicts">
        <button className="exs-verdict" onClick={() => insight?.dated && setPop('history')}>
          <span><TrendingUp size={10} />Maturity</span>
          <b className={'tone-' + (insight?.maturity.tone ?? 'unknown')}>{insight ? insight.maturity.label : '…'}</b>
          <small>{insight?.maturity.detail ?? 'reading discovery record'}</small>
          {/* the curve that JUSTIFIES the verdict sits directly under it */}
          {insight && insight.creaming.length > 1 && <CreamingSpark creaming={insight.creaming} />}
          {insight?.dated ? <em>Discovery history ↗</em> : null}
        </button>

        <button className="exs-verdict geology" onClick={() => (cycles.length ? setPop('strat') : classified && setPop('doust'))}>
          <span><Mountain size={10} />Geology</span>
          {cycles.length ? (
            <>
              {/* colour strip, not thumbnails — reads cleaner at card size; the per-cycle
                  figures live in the Strat column popup where they have room */}
              <div className="exs-cycle-strip">
                {cycleFigures.map(({ cycle, fig }) => (
                  <i key={cycle.id} className={'g-' + cycle.geodynamics}
                    title={`${cycle.title}${fig ? ` — Doust fig. ${fig.fig}` : ''}`} />
                ))}
              </div>
              <b className="small">{cycles.length} cycles · {cycles[0].geodynamics} → {cycles[cycles.length - 1].geodynamics}</b>
              <em>Strat column ↗</em>
            </>
          ) : classified ? (
            <>
              {doustFig && <div className="exs-geology-pic"><img src={`${base}${doustFig.file}`} alt="" loading="lazy" /></div>}
              {/* geodynamic call comes from the KB's Basin row, not an app-side table */}
              <b className="small">{kbBasin?.setting ?? 'classified'}{doustLink ? ` · Doust fig. ${doustLink.primaryFig || '—'}` : ''}</b>
              <em>Classification ↗</em>
            </>
          ) : (
            <>
              <b className="tone-unknown">No model</b>
              <small>{kbBasin?.classification_basis ?? 'no reviewed classification — screening only'}</small>
            </>
          )}
        </button>

        {/* Third slot: what has actually been found, in map symbology — green oil,
            red gas, diagonal for both — over the discovery curve. */}
        <button className="exs-verdict hc" onClick={() => insight?.dated && setPop('history')}>
          <span><Droplets size={10} />Hydrocarbon mix</span>
          {insight && insight.hcMix.length ? (
            <>
              <HcDonut mix={insight.hcMix} total={insight.hcMix.reduce((s, d) => s + d.n, 0)} />
              <em>Discovery history ↗</em>
            </>
          ) : (
            <>
              <b className="tone-unknown">{insight ? 'Not recorded' : '…'}</b>
              <small>{insight ? 'no hydrocarbon type in the catalogue' : 'reading field records'}</small>
            </>
          )}
        </button>
      </div>

      {/* ONE range control, above the two charts it scopes — never per-chart */}
      <TimeRangeRail
        units={timeUnits} range={timeRange} onRange={setTimeRange}
        focus={timeFocus} onFocus={setTimeFocus}
        anchor={timeAnchor} onAnchor={setTimeAnchor}
        label={rangeLabel}
      />

      <section className="exs-bd-events">
        <div className="exs-kb-section-title">
          <Activity size={14} /><span>Petroleum system</span>
          {crossFilter && (
            <button className="exs-filter-chip" onClick={() => setCrossFilter(null)}
              title="Clear the cross-filter">{crossFilter.label} <X size={9} /></button>
          )}
          {/* grade + gap count folded into one affordance — replaces the old Grade KPI
              and the standalone Charge card, which said the same thing three times */}
          <button className={'exs-info' + (gapList.length ? ' has-gaps' : '')} onClick={() => setPop('gaps')}
            title={completion
              ? `${completion.completion_stage} · ${Math.round((completion.completion_pct ?? 0) * 100)}% data-readiness · next: ${completion.next_action ?? '—'}`
              : `Completeness ${psModel?.completeness_grade ?? 'G0'} · ${gapList.length} open gaps — open the gap ledger`}>
            <Info size={11} />
            <b>{psModel?.completeness_grade ?? 'G0'}</b>
            {completion?.completion_pct != null && <u>{Math.round(completion.completion_pct * 100)}%</u>}
            {gapList.length > 0 && <i>{gapList.length}</i>}
          </button>
        </div>
        <EventsChartView chart={events} onOpenGaps={() => setPop('gaps')} onPickFormation={setFormation}
          crossFilter={crossFilter} onCrossFilter={setCrossFilter}
          range={timeRange} onRange={setTimeRange} />
      </section>

      <section className="exs-bd-tecto">
        <div className="exs-kb-section-title">
          <Layers size={14} /><span>Tectonostratigraphy</span>
          <em>{kbSpine?.geologicTimescale?.[0]?.timescale_version ?? 'ICS'}</em>
        </div>
        <TectonoStratChart periods={tecto.periods} cycles={tecto.cycles} elements={tecto.elements}
          onPickFormation={setFormation} crossFilter={crossFilter} onCrossFilter={setCrossFilter}
          range={timeRange} onRange={setTimeRange} />
      </section>

      {/* Discovery timeline lives in the Maturity card's modal now (Discovery history ↗)
          — a persistent footer chart duplicated it, so it's gone from the main screen. */}

      {/* ── popovers ─────────────────────────────────────────────────────────── */}
      {pop === 'history' && insight && (
        <Modal title="Discovery history" sub={scope.name} onClose={() => setPop(null)} wide>
          <div className="exs-modal-grid">
            <div className="exs-modal-card span2">
              <h4>Creaming curve</h4>
              <CreamingCurve creaming={insight.creaming} scrubYear={scrubYear} onScrub={setScrubYear}
                height={230} sized={insight.creaming.reduce((a, c) => a + (c.boe > 0 ? c.count : 0), 0)}
                total={insight.dated} />
              <p className="exs-kb-note">Cumulative <b>major</b> field discoveries. A flattening curve is the classic signal that a basin's easy volume is found — it counts fields, not barrels, because the catalogue carries no field volumes.</p>
            </div>
            <div className="exs-modal-card">
              <h4>Hydrocarbon type</h4>
              <MixBar data={insight.hcMix} palette={HC_PALETTE} />
            </div>
            <div className="exs-modal-card">
              <h4>Status</h4>
              <MixBar data={insight.statusMix} palette={ST_PALETTE} />
            </div>
            <div className="exs-modal-card span2">
              <h4>Most active operators</h4>
              <div className="exs-league">
                {insight.operators.map((o) => (
                  <div key={o.key}>
                    <span>{o.key}</span>
                    <i style={{ width: `${(o.n / insight.operators[0].n) * 100}%` }} />
                    <b>{o.n}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Was gated on `modelledBasin`, which only ever resolves for Viking Graben. Once
          cycles were authored for all 179 basins the Geology card started opening this
          for every basin, and 178 of them got a dead click — state set, nothing
          rendered. The cycles themselves are the correct condition. */}
      {pop === 'strat' && cycles.length > 0 && (
        <Modal title="Basin chart library" sub={`${scope.name} · ${libFigures.length} figures · ${cycles.length} cycles`}
          onClose={() => setPop(null)} wide>
          <BasinChartLibrary
            basinName={scope.name}
            figures={libFigures}
            linkOnly={lockedFigures}
            cycles={libCycles}
            onOpenFigure={(f) => setOpenPlate({
              id: f.figure_id, kind: 'figure',
              title: `${figureTypeLabel(f.figure_type)} — ${f.caption ?? ''}`,
              provenance: figureAttribution(f),
              node: <img src={figureSrc(f)} alt={f.caption ?? ''} className="exs-plate-img" />,
            })}
            analogueCount={gallery.length}
            /* Analogue type sections from OTHER basins — a different question from
               "what does this basin look like", so it earns its own page rather than
               sitting below. As a sibling it added height under a fixed-height panel,
               which squeezed the chart frame and clipped the figure inside it. */
            analogues={(
              <>
                <h4 className="exs-modal-h4">Analogue type sections <em>comparable basins in the literature</em></h4>
                <div className="exs-class-rail horizontal">
                  {FIGURE_CLASSES.map((c) => (
                    <button key={c.id} className={'exs-class-btn' + (c.id === figClass ? ' on' : '')} onClick={() => setFigClass(c.id)}>
                      <b>{c.title}</b><span>{figuresFor(c.id).length}</span>
                    </button>
                  ))}
                </div>
                <div className="exs-fig-grid">
                  {gallery.map((f) => <FigureThumb key={f.fig} figure={f} onOpen={() => setOpenFigure(f)} />)}
                </div>
                <p className="exs-kb-note">
                  {FIGURE_STATS.own} of {FIGURE_STATS.total} figures are Doust's own; {FIGURE_STATS.external} carry
                  the rights of {FIGURE_STATS.rightsholders} other authors and publishers. Cleared for internal
                  scientific/educational use <b>with attribution</b> — not for public redistribution.
                </p>
              </>
            )}
          />
        </Modal>
      )}


      {pop === 'doust' && classified && (
        <Modal title="Doust classification" sub={scope.name} onClose={() => setPop(null)} wide>
          <div className="exs-modal-grid">
            <div className="exs-modal-card span2">
              <p className="exs-kb-note lead">
                No ordered cycle stack exists for this basin yet, but its whole-basin geodynamic type has been
                reviewed and recorded — so the type can be stated with real grounding before a full
                stratigraphic model is built.
              </p>
              <div className="exs-doust-class">
                <div><span>Geodynamic type</span><b>{kbBasin?.setting ?? 'Mixed / multi-cycle'}</b></div>
                <div><span>Status</span><b>{kbBasin?.classification_status ?? '—'}</b></div>
                {kbBasin?.classification_citation_id && (
                  <div><span>Citation</span><b>{kbBasin.classification_citation_id}</b></div>
                )}
              </div>
              <p className="exs-kb-note">{kbBasin?.classification_basis}</p>
            </div>
            {doustFig && (
              <div className="exs-modal-card">
                <h4>Picture of the basin</h4>
                <button className="exs-doust-pic" onClick={() => setOpenFigure(doustFig)}>
                  <img src={`${base}${doustFig.file}`} alt={doustFig.caption} />
                </button>
                <small>{doustFig.caption}</small>
                <p className="exs-kb-note">{attributionFor(doustFig)}</p>
              </div>
            )}
            {doustLink && (
              <div className="exs-modal-card">
                <h4>{FIGURE_CLASSES.find((c) => c.id === doustLink.figureClass)?.title} — the wider family</h4>
                <div className="exs-fig-grid compact">
                  {figuresFor(doustLink.figureClass).slice(0, 6).map((f) => <FigureThumb key={f.fig} figure={f} onOpen={() => setOpenFigure(f)} />)}
                </div>
              </div>
            )}
            <div className="exs-modal-card span2">
              <p className="exs-kb-note">
                This is illustrative classification and citation, not a modelled cycle stack — no ages, lithology
                or petroleum-system elements are implied. Cleared for internal scientific/educational use with
                attribution; not for public redistribution.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {pop === 'gaps' && (
        <Modal title="Knowledge gap ledger" sub={scope.name} onClose={() => setPop(null)} wide>
          {completion && (
            <div className="exs-readiness">
              <div className="exs-readiness-bar">
                <i style={{ width: `${Math.round((completion.completion_pct ?? 0) * 100)}%` }} />
                <b>{Math.round((completion.completion_pct ?? 0) * 100)}%</b>
              </div>
              <div className="exs-readiness-meta">
                <span>Stage <b>{completion.completion_stage}</b></span>
                <span>Models <b>{completion.model_count ?? 0}</b></span>
                <span>Timed <b>{completion.timed_element_model_count ?? 0}</b></span>
                <span>Cycles <b>{completion.cycle_count ?? 0}</b></span>
                <span>Source <b>{completion.source_connected === 'Y' ? 'connected' : 'not routed'}</b></span>
              </div>
              {completion.next_action && (
                <p className="exs-kb-note lead"><b>Next action.</b> {completion.next_action}</p>
              )}
              <p className="exs-kb-note">
                Data-readiness only — a weighted roll-up of the authored milestones. It measures how completely
                this basin has been <b>documented</b>, never how prospective it is.
              </p>
            </div>
          )}

          {gapList.length ? (
            <div className="exs-gaps">
              {gapList.map((g, i) => (
                <div key={i}><ShieldAlert size={13} /><div><b>{g.what}</b><small>{g.why}</small></div></div>
              ))}
            </div>
          ) : <div className="exs-empty-inline">No open gaps — every element and process is modelled.</div>}

          {(authorityEvidence.candidates.length > 0 || authorityEvidence.processes.length > 0) && (
            <>
              <h4 className="exs-modal-h4">Authority evidence awaiting normalisation</h4>
              <p className="exs-kb-note">
                Lifted verbatim from the USGS narrative for this petroleum system. These carry <b>reported age
                terms</b>, not numerical ages, so they are deliberately <b>not</b> drawn on the charts — promoting
                them into timed elements is a reviewer's call, not an automatic one.
              </p>
              <div className="exs-evidence">
                {authorityEvidence.candidates.map((c) => (
                  <div key={c.candidate_id}>
                    <span className={'exs-ev-tag role-' + (c.element_role ?? 'none')}>{c.element_role}</span>
                    <div>
                      <b>{c.unit_candidates || '(formation not named in the text)'}</b>
                      {c.reported_age_terms && <i>{c.reported_age_terms}</i>}
                      <small>{c.authority_evidence}</small>
                    </div>
                    {c.source_reference && <a href={c.source_reference} target="_blank" rel="noreferrer noopener">source ↗</a>}
                  </div>
                ))}
                {authorityEvidence.processes.map((p) => (
                  <div key={p.process_evidence_id}>
                    <span className="exs-ev-tag role-process">{p.event_type}</span>
                    <div>
                      <b>{p.event_type}</b>
                      {p.reported_age_terms && <i>{p.reported_age_terms}</i>}
                      <small>{p.authority_evidence}</small>
                    </div>
                    {p.source_reference && <a href={p.source_reference} target="_blank" rel="noreferrer noopener">source ↗</a>}
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {pop === 'potential' && (
        <Modal title="Remaining potential" sub={scope.name} onClose={() => setPop(null)} wide>
          <div className="exs-potential">
            <div><span>Oil</span><b>{fmt(assessed?.oilMean)}</b><small>MMbbl mean</small></div>
            <div><span>Gas</span><b>{fmt(assessed?.gasMean)}</b><small>BCF mean</small></div>
            <div><span>Total</span><b>{fmt(ytfNum)}</b><small>MMBOE mean</small></div>
          </div>
          <p className="exs-kb-note lead">
            USGS <b>undiscovered, technically recoverable</b> mean volumes — what may still be found.
            These are <b>not</b> STOIIP or in-place volume, and not reserves in discovered fields.
            A blank means the province was never assessed — which is not the same as zero.
          </p>
          {scopeAus.length > 0 && (
            <>
              <h4 className="exs-modal-h4">Assessment units ({scopeAus.length})</h4>
              <div className="exs-league">
                {scopeAus.slice(0, 12).map((a) => (
                  <div key={a.auCode}>
                    <span title={a.tps ? `TPS: ${a.tps}` : undefined}>{a.auName || a.auCode}</span>
                    <i style={{ width: `${((a.boeMean ?? 0) / Math.max(1, scopeAus[0].boeMean ?? 1)) * 100}%` }} />
                    <b>{fmt(a.boeMean)}</b>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {pop === 'inventory' && (
        <Modal title={`Field database — ${scope.name}`} sub={`${fieldsInScope.length.toLocaleString()} major fields · ${fieldSizeSummary.withSize.toLocaleString()} sized`} onClose={() => setPop(null)} wide>
          <div className="exs-modal-grid">
            <div className="exs-modal-card span2">
              <h4><Database size={12} /> Biggest fields <small>— ranked by reported reserves, MMBOE</small></h4>
              <BoeBarChart ranked={fieldSizeSummary.ranked} limit={10} />
            </div>
            <div className="exs-modal-card">
              <h4>Which field is biggest <small>— share of sized reserves</small></h4>
              <BoePieChart ranked={fieldSizeSummary.ranked} totalBoe={fieldSizeSummary.totalBoe} />
            </div>
            <div className="exs-modal-card">
              <h4>Scope totals</h4>
              <div className="exs-potential compact">
                <div><span>Oil</span><b>{fmt(fieldSizeSummary.totalOil)}</b><small>MMbbl</small></div>
                <div><span>Gas-as-boe</span><b>{fmt(fieldSizeSummary.totalGas)}</b><small>MMBOE</small></div>
                <div><span>Total sized</span><b>{fmt(fieldSizeSummary.totalBoe)}</b><small>MMBOE</small></div>
              </div>
              <p className="exs-kb-note">Reported reserves (GOGET), not STOIIP. {fieldsInScope.length - fieldSizeSummary.withSize} of {fieldsInScope.length} major fields have no reserve filing — excluded, not zero.</p>
            </div>
            <div className="exs-modal-card span2">
              <h4>All major fields</h4>
              <div className="exs-inv-wrap">
                <table className="exs-fields-table">
                  <thead><tr><th>Field</th><th>Country / area</th><th>Discovered</th><th>Type</th><th>Status</th><th>Operator</th><th>MMBOE</th></tr></thead>
                  <tbody>
                    {fieldsInScope.slice(0, 300).map((f) => {
                      const d = detail?.[f.id];
                      const size = fieldSizes?.get(f.id);
                      return (
                        <tr key={f.id} onClick={() => setSelectedField({ id: f.id, name: f.name })}>
                          <td>{f.name}</td><td>{f.country}</td>
                          <td>{d?.discoveryYear ?? '—'}</td><td>{d?.fuelType ?? '—'}</td>
                          <td>{d?.status ?? '—'}</td><td>{d?.operator ?? '—'}</td>
                          <td>{size ? size.total.toFixed(1) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {fieldsInScope.length > 300 && <p className="exs-kb-note">Showing the first 300 of {fieldsInScope.length.toLocaleString()}.</p>}
            </div>
          </div>
        </Modal>
      )}

      {formationDetail && (
        <Modal title={formationDetail.unitName} sub={`Formation · ${formationDetail.role ?? 'role not assigned'}`} onClose={() => setFormation(null)}>
          <div className="exs-fd-facts">
            <div><span>Role</span><b>{formationDetail.role ?? '—'}</b></div>
            <div><span>Effectiveness</span><b>{formationDetail.effectiveness ?? '—'}</b></div>
            <div><span>Confidence</span><b>{formationDetail.confidence ?? '—'}</b></div>
            <div><span>Age</span><b>{formationDetail.from != null ? `${formationDetail.from}–${formationDetail.to} Ma` : '—'}</b></div>
            <div><span>Group</span><b>{formationDetail.group ?? '—'}</b></div>
            <div><span>Basin cycle</span><b>{formationDetail.cycleTitle ?? '—'}</b></div>
          </div>
          {formationDetail.environment && (
            <p className="exs-kb-note lead"><b>Depositional environment.</b> {formationDetail.environment}</p>
          )}
          {formationDetail.roleNote && (
            <p className="exs-kb-note lead"><b>Why it matters.</b> {formationDetail.roleNote}</p>
          )}
          {formationDetail.reservoir ? (
            <>
              <h4 className="exs-modal-h4">Reservoir detail</h4>
              <div className="exs-fd-facts">
                <div><span>Lithology</span><b>{formationDetail.reservoir.lithology ?? '—'}</b></div>
                <div><span>Age</span><b>{formationDetail.reservoir.age ?? '—'}</b></div>
                <div><span>Drive</span><b>{formationDetail.reservoir.drive ?? '—'}</b></div>
              </div>
            </>
          ) : (
            <p className="exs-kb-note">
              No described reservoir for this formation in the catalogue — only fields with a dedicated
              study carry lithology, drive and contacts.
            </p>
          )}
          {(formationDetail.notes || formationDetail.citationId) && (
            <p className="exs-kb-note">
              {formationDetail.notes}{formationDetail.notes && formationDetail.citationId ? ' · ' : ''}
              {formationDetail.citationId && <code>{formationDetail.citationId}</code>}
            </p>
          )}
          {/* Figure-scoped-to-formation is still 0 in the registry — every figure
              harvested so far came from a basin-level assessment. So these are the
              BASIN's charts, which is where this formation's interval is drawn. The
              note says so rather than implying the figure is of this unit. */}
          <FigureStrip
            figures={stratFigures}
            title="Published figures covering this interval"
            note={`Basin-level charts for ${scope.name} — this formation appears within them. No figure is yet scoped to the formation itself.`}
            limit={4}
            onOpen={(f) => { setFormation(null); setOpenPlate({
              id: f.figure_id, kind: 'figure',
              title: `${figureTypeLabel(f.figure_type)} — ${f.caption ?? ''}`,
              provenance: figureAttribution(f),
              node: <img src={figureSrc(f)} alt={f.caption ?? ''} className="exs-plate-img" />,
            }); }}
          />
        </Modal>
      )}

      {selectedField && (
        <Modal title={selectedField.name} sub="Major field" onClose={() => setSelectedField(null)}>
          <FieldDossier id={selectedField.id} detail={detail?.[selectedField.id]} insight={insight} scope={scope.name} />
        </Modal>
      )}

      {openFigure && (
        <Modal title={openFigure.caption} sub={`Figure ${openFigure.fig} · page ${openFigure.page}`} onClose={() => setOpenFigure(null)} wide>
          <div className="exs-lightbox-stage inline">
            <img src={`${base}${openFigure.file}`} alt={openFigure.caption} />
          </div>
          <p className="exs-kb-note"><b>{attributionFor(openFigure)}</b> — cleared for internal scientific/educational use with attribution; not for public redistribution.</p>
        </Modal>
      )}

      {openPlate && (
        <Modal title={openPlate.title} sub={scope.name} onClose={() => setOpenPlate(null)} wide>
          <div className="exs-plate-carousel">
            {plates.length > 1 && (
              <button className="exs-plate-step prev" onClick={() => stepOpenPlate(-1)} aria-label="Previous basin figure">
                <ChevronLeft size={24} />
              </button>
            )}
            <div className="exs-plate-big" aria-live="polite">{openPlate.node}</div>
            {plates.length > 1 && (
              <button className="exs-plate-step next" onClick={() => stepOpenPlate(1)} aria-label="Next basin figure">
                <ChevronRight size={24} />
              </button>
            )}
          </div>
          {plates.length > 1 && <div className="exs-plate-count">{openPlateIndex + 1} / {plates.length}</div>}
          {/* Attribution is not decoration here. A published plate must name where it
              came from, and a restricted one must say out loud that it is not cleared
              for redistribution — that condition is what makes showing it legitimate. */}
          <p className={'exs-kb-note' + (/Internal use only/.test(openPlate.provenance) ? ' exs-note-warn' : '')}>
            {openPlate.kind === 'figure' ? 'Source: ' : 'Drawn from: '}{openPlate.provenance}
          </p>
        </Modal>
      )}
    </section>
  );
}

const fmt = (v: unknown) => (typeof v === 'number' ? Math.round(v).toLocaleString() : '—');

function FieldDossier({ id, detail, insight, scope }: {
  id: string; detail?: FieldDetail; insight: BasinInsight | null; scope: string;
}) {
  if (!detail) {
    return <div className="exs-empty-inline">No catalogue detail for this field beyond its name and position.</div>;
  }
  const rank = detail.discoveryYear && insight
    ? insight.creaming.filter((p) => p.year <= detail.discoveryYear!).pop()?.cumulative
    : null;
  return (
    <div className="exs-fd">
      <div className="exs-fd-facts">
        <div><span>Discovered</span><b>{detail.discoveryYear ?? 'not recorded'}</b></div>
        <div><span>Hydrocarbon</span><b>{detail.fuelType ?? '—'}</b></div>
        <div><span>Status</span><b>{detail.status ?? '—'}</b></div>
        <div><span>Operator</span><b>{detail.operator ?? '—'}</b></div>
        <div><span>Setting</span><b>{detail.onshoreOffshore ?? '—'}</b></div>
        <div><span>On production</span><b>{detail.productionStartYear ?? '—'}</b></div>
      </div>
      {rank != null && (
        <p className="exs-kb-note lead">
          The <b>{ordinal(rank)}</b> major field found in {scope}
          {detail.discoveryYear ? `, in ${detail.discoveryYear}` : ''}.
        </p>
      )}
      <p className="exs-kb-note">
        Reservoir and lithology are not carried in the world catalogue — only fields with a
        dedicated study (today, Volve) have a described reservoir. <code>{id}</code>
      </p>
    </div>
  );
}

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

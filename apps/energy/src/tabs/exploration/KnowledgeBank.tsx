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
import { Activity, BookImage, ShieldAlert, X } from 'lucide-react';
import { loadSearchIndex, searchTypeLabel, type SearchEntry } from '../../cosmo/cockpit-search';
import { CockpitMap } from '../../cosmo/CockpitMap';
import { VOLVE_BASIN, type BasinCycleSeed } from '../../cosmo/knowledge-model';
import { STRAT_COLUMN } from './legacy/explData';
import {
  buildBasinInsight, buildEventsChart, loadFieldDetail, loadVolumes,
  type AssessmentUnitRow, type BasinInsight, type FieldDetail,
} from './basin-insight';
import { CreamingCurveView, EventsChartView, MixBar } from './BasinCharts';
import {
  FIGURE_CLASSES, FIGURE_STATS, attributionFor, figuresFor,
  type BasinFigure, type FigureClass,
} from './basin-figures';

const base = import.meta.env.BASE_URL || '/';
const HC_PALETTE = ['#10b981', '#f43f5e', '#f59e0b', '#38bdf8', '#a78bfa'];
const ST_PALETTE = ['#22d3ee', '#94a3b8', '#f59e0b', '#a78bfa', '#f43f5e'];

type ScopeField = { id: string; name: string; country: string; source: string; fly: { lon: number; lat: number } };
type ScopeFieldIndex = { methodology: string; provinces: Record<string, ScopeField[]>; assessmentUnits: Record<string, ScopeField[]> };
let scopeFieldsPromise: Promise<ScopeFieldIndex | null> | null = null;
const loadScopeFields = () => {
  if (!scopeFieldsPromise) scopeFieldsPromise = fetch(`${base}osdu/cockpit-scope-fields.json`)
    .then((r) => (r.ok ? (r.json() as Promise<ScopeFieldIndex>) : null)).catch(() => null);
  return scopeFieldsPromise;
};

type Popover = 'history' | 'strat' | 'gaps' | 'potential' | 'inventory' | 'figures' | null;

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

export function ExplorationKnowledgeBank({ scope }: { scope: SearchEntry }) {
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [scopeFieldIndex, setScopeFieldIndex] = useState<ScopeFieldIndex | null | undefined>(undefined);
  const [detail, setDetail] = useState<Record<string, FieldDetail> | null | undefined>(undefined);
  const [pop, setPop] = useState<Popover>(null);
  const [scrubYear, setScrubYear] = useState<number | null>(null);
  const [selectedField, setSelectedField] = useState<{ id: string; name: string } | null>(null);
  const [figClass, setFigClass] = useState<FigureClass>('extensional');
  const [openFigure, setOpenFigure] = useState<BasinFigure | null>(null);
  const [volumes, setVolumes] = useState<Awaited<ReturnType<typeof loadVolumes>>>(null);

  useEffect(() => { loadSearchIndex().then(setIndex); }, []);
  useEffect(() => { loadFieldDetail().then(setDetail); }, []);
  useEffect(() => { loadVolumes().then(setVolumes); }, []);
  useEffect(() => {
    let alive = true; setScopeFieldIndex(undefined);
    loadScopeFields().then((v) => { if (alive) setScopeFieldIndex(v); });
    return () => { alive = false; };
  }, [scope.id]);
  useEffect(() => { setScrubYear(null); setSelectedField(null); }, [scope.id]);

  const scopeCode = scope.id.split(':').pop() ?? '';

  const fieldsInScope: ScopeField[] = useMemo(() => {
    if (scope.type === 'province') return scopeFieldIndex?.provinces[scopeCode] ?? [];
    if (scope.type === 'assessment-unit') return scopeFieldIndex?.assessmentUnits[scopeCode] ?? [];
    return index?.filter((e) => e.type === 'field' && e.parent.split(' · ')[0] === scope.name)
      .map((e) => ({ id: e.id, name: e.name, country: e.parent, source: e.source, fly: e.fly! }))
      .filter((e) => e.fly) ?? [];
  }, [scope.type, scope.name, scopeCode, scopeFieldIndex, index]);

  const insight: BasinInsight | null = useMemo(
    () => (detail === undefined ? null : buildBasinInsight(fieldsInScope, detail)),
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

  const events = useMemo(
    () => (modelledBasin ? buildEventsChart(STRAT_COLUMN) : null),
    [modelledBasin],
  );

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

  const gapList = useMemo(() => {
    const g: Array<{ what: string; why: string }> = [];
    if (!modelledBasin) g.push({ what: 'Basin cycle model', why: 'no geodynamic classification or cycle stack — screening only' });
    if (!events) g.push({ what: 'Stratigraphic column', why: 'no units, so no source/reservoir/seal in time' });
    events?.rows.filter((r) => !r.modelled).forEach((r) => g.push({ what: r.label, why: `needs ${r.requires}` }));
    if (!insight?.dated) g.push({ what: 'Discovery dates', why: 'no dated discoveries — maturity cannot be read' });
    return g;
  }, [modelledBasin, events, insight]);

  const cycles = modelledBasin?.cycles ?? [];
  const gallery = figuresFor(figClass);

  const kpi = (label: string, value: string, sub: string, onClick?: () => void) => (
    <button className={'exs-kpi' + (onClick ? ' live' : '')} onClick={onClick} disabled={!onClick}>
      <span>{label}</span><b>{value}</b><small>{sub}</small>
    </button>
  );

  return (
    <section className="exs-bd" aria-label={`${scope.name} Basin Dossier`}>
      {/* ── header: scope + the four numbers that are also the buttons ───────── */}
      <header className="exs-bd-head">
        <div className="exs-bd-id">
          <small>{searchTypeLabel(scope.type)}</small>
          <h2>{scope.name}</h2>
          <p>{scope.parent}</p>
        </div>
        <div className="exs-kpis">
          {kpi('Major fields', insight ? insight.total.toLocaleString() : '…',
            insight ? `${insight.producing.toLocaleString()} operating` : 'loading',
            fieldsInScope.length ? () => setPop('inventory') : undefined)}
          {kpi('Found', insight?.firstYear ? `${insight.firstYear}–${insight.lastYear}` : '—',
            insight ? `${insight.dated} dated` : 'loading',
            insight?.dated ? () => setPop('history') : undefined)}
          {kpi('Left to find', ytfNum != null ? `${(ytfNum / 1000).toFixed(2)} BBOE` : '—',
            'USGS undiscovered mean', () => setPop('potential'))}
          {kpi('Grade', modelledBasin ? 'Modelled' : 'Screening', `${gapList.length} open gaps`,
            () => setPop('gaps'))}
        </div>
      </header>

      {/* ── body: map · events chart · verdict rail ──────────────────────────── */}
      <div className="exs-bd-body">
        <div className="exs-bd-map">
          <CockpitMap
            dark
            mode="2d"
            theme="openmap"
            focus={focus}
            onSelect={(sel) => { if (sel && sel.type.toLowerCase().includes('field')) setSelectedField({ id: sel.id, name: sel.name }); }}
          />
          <div className="exs-map-legend">
            <span><i style={{ background: HC_PALETTE[0] }} />oil</span>
            <span><i style={{ background: HC_PALETTE[1] }} />gas</span>
            <span><i style={{ background: HC_PALETTE[2] }} />both</span>
          </div>
        </div>

        <section className="exs-bd-events">
          <div className="exs-kb-section-title">
            <Activity size={14} /><span>Petroleum system</span>
            <em>{events ? `${events.modelledRows} of ${events.rows.length} rows modelled` : 'not modelled'}</em>
          </div>
          <EventsChartView chart={events} onOpenGaps={() => setPop('gaps')} />
        </section>

        <aside className="exs-bd-rail">
          <button className="exs-verdict" onClick={() => insight?.dated && setPop('history')}>
            <span>Maturity</span>
            <b className={'tone-' + (insight?.maturity.tone ?? 'unknown')}>{insight ? insight.maturity.label : '…'}</b>
            <small>{insight?.maturity.detail ?? 'reading discovery record'}</small>
            {insight?.dated ? <em>Discovery history ↗</em> : null}
          </button>

          <button className="exs-verdict" onClick={() => modelledBasin && setPop('strat')}>
            <span>Geology</span>
            {cycles.length ? (
              <>
                <div className="exs-cycle-strip">
                  {cycles.map((c: BasinCycleSeed) => <i key={c.id} className={'g-' + c.geodynamics} title={c.title} />)}
                </div>
                <b className="small">{cycles.length} cycles</b>
                <small>{cycles[0].geodynamics} → {cycles[cycles.length - 1].geodynamics}</small>
                <em>Strat column ↗</em>
              </>
            ) : (
              <>
                <b className="tone-unknown">No model</b>
                <small>no cycle stack for this basin — screening only</small>
              </>
            )}
          </button>

          <button className="exs-verdict" onClick={() => setPop('gaps')}>
            <span>Charge</span>
            <b className={gapList.length ? 'tone-gap' : 'tone-mature'}>{gapList.length} gaps</b>
            <small>{gapList.length ? gapList.slice(0, 2).map((g) => g.what.toLowerCase()).join(', ') : 'fully modelled'}</small>
            <em>Gap ledger ↗</em>
          </button>
        </aside>
      </div>

      {/* ── footer: the discovery timeline ───────────────────────────────────── */}
      <footer className="exs-bd-foot">
        <div className="exs-foot-title">
          <Activity size={13} /><span>Discovery timeline</span>
          <em>drag to replay this basin being found</em>
        </div>
        {insight ? <CreamingCurveView creaming={insight.creaming} scrubYear={scrubYear} onScrub={setScrubYear} />
          : <div className="exs-empty-inline">Reading discovery record…</div>}
      </footer>

      {/* ── popovers ─────────────────────────────────────────────────────────── */}
      {pop === 'history' && insight && (
        <Modal title="Discovery history" sub={scope.name} onClose={() => setPop(null)} wide>
          <div className="exs-modal-grid">
            <div className="exs-modal-card span2">
              <h4>Creaming curve</h4>
              <CreamingCurveView creaming={insight.creaming} scrubYear={scrubYear} onScrub={setScrubYear} height={150} />
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

      {pop === 'strat' && modelledBasin && (
        <Modal title="Stratigraphy & cycles" sub={modelledBasin.name} onClose={() => setPop(null)} wide>
          <div className="exs-modal-grid">
            <div className="exs-modal-card">
              <h4>Basin cycles</h4>
              {cycles.map((c) => (
                <div className="exs-cycle-row static" key={c.id}>
                  <i className={'exs-cycle-dot g-' + c.geodynamics} />
                  <div><b>{c.title}</b><small>{c.ageMa[0]}–{c.ageMa[1]} Ma · {c.fill} · {c.lithology}</small></div>
                </div>
              ))}
            </div>
            <div className="exs-modal-card">
              <h4>Stratigraphic column</h4>
              <div className="exs-strat">
                {STRAT_COLUMN.map((u) => (
                  <div className={'exs-strat-row role-' + (u.role ?? 'none')} key={u.name}>
                    <span>{u.name}</span>
                    <i>{u.ageMa[0]}–{u.ageMa[1]} Ma</i>
                    <em>{u.role ?? '—'}</em>
                  </div>
                ))}
              </div>
            </div>
            <div className="exs-modal-card span2">
              <h4>Published type sections <small>— comparable basins in the literature</small></h4>
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
            </div>
          </div>
        </Modal>
      )}

      {pop === 'gaps' && (
        <Modal title="Knowledge gap ledger" sub={scope.name} onClose={() => setPop(null)}>
          <p className="exs-kb-note lead">
            What this basin does <b>not</b> yet have. For a frontier or screening-grade basin this list is the
            actual finding — it is the work programme, not an error.
          </p>
          {gapList.length ? (
            <div className="exs-gaps">
              {gapList.map((g, i) => (
                <div key={i}><ShieldAlert size={13} /><div><b>{g.what}</b><small>{g.why}</small></div></div>
              ))}
            </div>
          ) : <div className="exs-empty-inline">No open gaps — every element and process is modelled.</div>}
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
        <Modal title={`Major fields in ${scope.name}`} sub={`${fieldsInScope.length.toLocaleString()} records`} onClose={() => setPop(null)} wide>
          <div className="exs-inv-wrap">
            <table className="exs-fields-table">
              <thead><tr><th>Field</th><th>Country / area</th><th>Discovered</th><th>Type</th><th>Status</th><th>Operator</th></tr></thead>
              <tbody>
                {fieldsInScope.slice(0, 300).map((f) => {
                  const d = detail?.[f.id];
                  return (
                    <tr key={f.id} onClick={() => setSelectedField({ id: f.id, name: f.name })}>
                      <td>{f.name}</td><td>{f.country}</td>
                      <td>{d?.discoveryYear ?? '—'}</td><td>{d?.fuelType ?? '—'}</td>
                      <td>{d?.status ?? '—'}</td><td>{d?.operator ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {fieldsInScope.length > 300 && <p className="exs-kb-note">Showing the first 300 of {fieldsInScope.length.toLocaleString()}.</p>}
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

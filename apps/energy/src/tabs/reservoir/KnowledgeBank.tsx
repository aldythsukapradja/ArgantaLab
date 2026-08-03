import { useEffect, useMemo, useState } from 'react';
import { Activity, BookMarked, Database, Droplets, Gauge, MapPinned, Network, Ruler, Waves } from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import type { ObservationRow } from '../../cosmo/cockpit-field-detail';
import { KnowledgeMap } from '../fielddev/KnowledgeMap';
import { loadKnowledgeContext, type KnowledgeContext } from '../fielddev/field-knowledge';
import { lastLiveIdx, loadRMData, SM3GAS_TO_SCF, type RMData } from './data';

const compact = (value: number, decimals = 1) => value.toLocaleString('en-US', { maximumFractionDigits: decimals });
const latest = (rows: ObservationRow[]) => [...rows].sort((a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity))[0];

function productionValue(row?: ObservationRow): string {
  if (!row) return 'Not reported';
  const convertedUnit = row.unitConverted?.toLowerCase() ?? '';
  const converted = row.valueConverted;
  if (converted != null && convertedUnit.includes('million bbl')) return `${compact(converted)} MMSTB/y`;
  if (converted != null && convertedUnit.includes('million m³')) return `${compact(converted * 1e6 * SM3GAS_TO_SCF / 1e9)} BSCF/y`;
  return row.value == null ? 'Not reported' : `${compact(row.value)} ${row.unit ?? ''}`.trim();
}

type Metric = { label: string; value: string; basis: string; tone?: 'good' | 'warn' };

function VolveMetrics({ data }: { data: RMData }) {
  const index = lastLiveIdx(data.field);
  const ooipMMstb = 22 * 6.2898;
  const recovery = data.field.cumOilMM / ooipMMstb * 100;
  const producerCount = data.wells.filter((well) => well.cumOilMM > 0).length;
  const injectorCount = data.wells.filter((well) => well.cumWinjMM > 0).length;
  const metrics: Metric[] = [
    { label: 'Management scheme', value: data.injectors.length && data.field.cumWinjMM > 0 ? 'Waterflood' : 'Depletion', basis: 'Injection history · derived', tone: 'good' },
    { label: 'Cumulative oil', value: `${compact(data.field.cumOilMM)} MMSTB`, basis: `${data.field.ym[0]}–${data.field.ym[index]}` },
    { label: 'Last live oil rate', value: `${compact(data.field.oilRate[index], 0)} bopd`, basis: data.field.ym[index] },
    { label: 'Water cut', value: `${compact(data.field.wct[index])}%`, basis: `Last live month · ${data.field.ym[index]}` },
    { label: 'Cumulative water injection', value: `${compact(data.field.cumWinjMM)} MMbbl`, basis: 'Volve monthly series' },
    { label: 'Cumulative VRR', value: compact(data.field.vrr.final, 2), basis: 'Injected water / produced voidage' },
    { label: 'Recovery vs dynamic OOIP', value: `${compact(recovery)}%`, basis: 'Derived against 22 MMSm³ model OOIP' },
    { label: 'Active-role wells', value: `${producerCount} P · ${injectorCount} I`, basis: `${data.patterns.patterns.length} derived waterflood patterns · dual roles retained` },
  ];
  return <div className="rms-metric-grid">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>;
}

function CatalogueMetrics({ context }: { context: KnowledgeContext }) {
  const oil = latest(context.detail?.production.filter((row) => row.product.toLowerCase() === 'oil') ?? []);
  const gas = latest(context.detail?.production.filter((row) => row.product.toLowerCase().includes('gas')) ?? []);
  const metrics: Metric[] = [
    { label: 'Management scheme', value: 'Not reported', basis: 'Client RM extension required', tone: 'warn' },
    { label: 'Latest oil production', value: productionValue(oil), basis: oil?.year ? `GOGET · ${oil.year}` : 'GOGET field spine' },
    { label: 'Latest gas production', value: productionValue(gas), basis: gas?.year ? `GOGET · ${gas.year}` : 'GOGET field spine' },
    { label: 'Water cut / VRR', value: 'Not reported', basis: 'Time-series surveillance required', tone: 'warn' },
    { label: 'Producer / injector roles', value: 'Not linked', basis: 'OSDU well relationship slot', tone: 'warn' },
    { label: 'Pattern allocation', value: 'Not linked', basis: 'Client pattern model slot', tone: 'warn' },
  ];
  return <div className="rms-metric-grid">{metrics.map((metric) => <MetricCard key={metric.label} metric={metric} />)}</div>;
}

function MetricCard({ metric }: { metric: Metric }) {
  return <div className={`rms-metric ${metric.tone ?? ''}`}><span>{metric.label}</span><b>{metric.value}</b><small>{metric.basis}</small></div>;
}

const knowledge = [
  { title: '4D Reservoir Management', code: 'STD-RMO-001', body: 'Field-level integration of production, pressure, saturation and model response.', icon: Activity },
  { title: 'Reservoir Management Plan', code: 'STD-RES-002', body: 'Objectives, depletion strategy, uncertainty, surveillance and decision triggers.', icon: BookMarked },
  { title: 'Surveillance Standard', code: 'STD-RES-003', body: 'Minimum pressure, allocation, well-test and production-monitoring expectations.', icon: Gauge },
  { title: 'Wells & Pattern Review', code: 'STD-RES-005', body: 'Pattern balance, connectivity, conformance and producer–injector interventions.', icon: Network },
];

export function ReservoirKnowledgeBank({ field }: { field: SearchEntry }) {
  const [context, setContext] = useState<KnowledgeContext | null>(null);
  const [rm, setRm] = useState<RMData | null>(null);
  const isVolve = field.name.toUpperCase() === 'VOLVE';
  useEffect(() => {
    let alive = true;
    setContext(null); setRm(null);
    void loadKnowledgeContext(field).then((value) => { if (alive) setContext(value); });
    if (isVolve) void loadRMData().then((value) => { if (alive) setRm(value); });
    return () => { alive = false; };
  }, [field, isVolve]);

  const management = useMemo(() => [
    { label: 'Reservoir', value: isVolve ? 'Hugin Formation' : context?.hierarchy[4]?.value ?? 'Not linked', basis: isVolve ? 'Equinor Volve' : 'Field relationship' },
    { label: 'Well spacing', value: isVolve ? 'Not reservoir-resolved' : 'Not reported', basis: isVolve ? 'Platform wellheads are not drainage spacing' : 'Client well geometry required', icon: Ruler },
    { label: 'Drainage radius', value: isVolve ? '1,500 m scenario' : 'Not reported', basis: isVolve ? 'Legacy screening input · not measured' : 'Client interpretation required', icon: Waves },
    { label: 'Support mechanism', value: isVolve && rm ? 'Water injection' : 'Not reported', basis: isVolve ? 'Production/injection series' : 'Client RM extension', icon: Droplets },
  ], [context, isVolve, rm]);

  return (
    <div className="rms-kb">
      <section className="rms-panel rms-location">
        <PanelTitle icon={MapPinned} title="Field location" meta={field.source} />
        <KnowledgeMap field={field} context={context} />
        <div className="rms-location-facts"><div><span>Basin / province</span><b>{context?.hierarchy[0]?.value ?? 'Resolving…'}</b></div><div><span>Petroleum system</span><b>{context?.hierarchy[1]?.value ?? 'Resolving…'}</b></div></div>
      </section>
      <section className="rms-panel rms-frame">
        <PanelTitle icon={Network} title="Reservoir management frame" meta="field level" />
        <div className="rms-frame-grid">{management.map((item) => <div key={item.label}><span>{item.label}</span><b>{item.value}</b><small>{item.basis}</small></div>)}</div>
        <div className="rms-truth"><Database size={13} /><span><b>{isVolve ? 'Showcase extension' : 'GOGET spine'}</b>{isVolve ? ' · Volve adds monthly well-level surveillance beyond the global catalogue.' : ' · Field identity and annual observations are aligned; operational RM data remains a client extension.'}</span></div>
      </section>
      <section className="rms-panel rms-performance">
        <PanelTitle icon={Activity} title="Production & support" meta={isVolve ? 'monthly deep dive' : 'latest annual'} />
        {isVolve ? (rm ? <VolveMetrics data={rm} /> : <div className="rms-loading">Loading Volve surveillance…</div>) : context ? <CatalogueMetrics context={context} /> : <div className="rms-loading">Resolving field observations…</div>}
      </section>
      <section className="rms-panel rms-knowledge">
        <PanelTitle icon={BookMarked} title="Knowledge & governance" meta="legacy + standards" />
        <div className="rms-knowledge-grid">{knowledge.map((item) => <article key={item.code}><item.icon size={14} /><div><span>{item.code}</span><b>{item.title}</b><small>{item.body}</small></div><strong>AVAILABLE</strong></article>)}</div>
      </section>
    </div>
  );
}

function PanelTitle({ icon: Icon, title, meta }: { icon: typeof MapPinned; title: string; meta: string }) {
  return <div className="rms-panel-title"><Icon size={13} /><span>{title}</span><em>{meta}</em></div>;
}

// Intelligence → Insights — the operating inbox. It turns governed world-spine
// coverage and the Volve showcase's real reservoir surveillance into explicit,
// scoped signals. Nothing here pretends to be live: Volve operational signals are
// labelled historical and decision/investigation records remain session drafts
// until a persistence layer is connected.
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, BookOpenCheck, CheckCircle2, CircleDot,
  ClipboardCheck, Database, FileSearch, Gauge, Globe2, Layers3, MapPinned,
  RadioTower, ShieldCheck, Sparkles, Target, TrendingUp,
} from 'lucide-react';
import { lastLiveIdx, loadRMData, type RMData } from '../tabs/reservoir/data';
import { IntelligenceHeader, IntelligenceSurface, IntelligenceTabs } from './IntelligenceChrome';
import './intel-insights.css';

type CockpitInsights = {
  generatedAt?: string;
  totals: { osduRecords: number; spatialFields: number; matchedFields: number; assessedProvinces: number; matchRate: number };
  topProvinces: Array<{ prvCode: string; prvName: string; fieldCount: number; boeMean: number | null }>;
  provinceFields: Record<string, number>;
};
type InsightTab = 'briefing' | 'signals' | 'investigations' | 'decisions' | 'portfolio';
type InsightScope = 'global' | 'volve';
type Signal = {
  id: string; scope: InsightScope; severity: 'high' | 'watch' | 'info' | 'balanced';
  lifecycle: string; title: string; statement: string; evidence: string; asOf: string;
  value: string; nature: 'DERIVED' | 'REPORTED';
};

const TABS: Array<{ id: InsightTab; label: string; icon: typeof Sparkles }> = [
  { id: 'briefing', label: 'Briefing', icon: Sparkles },
  { id: 'signals', label: 'Signals', icon: RadioTower },
  { id: 'investigations', label: 'Investigations', icon: FileSearch },
  { id: 'decisions', label: 'Decisions', icon: ClipboardCheck },
  { id: 'portfolio', label: 'Portfolio', icon: Globe2 },
];
const SOURCES = [
  { name: 'GOGET', full: 'Global field identity and annual observations', licence: 'CC BY 4.0' },
  { name: 'USGS', full: 'World petroleum provinces and assessment units', licence: 'Public domain' },
  { name: 'Sodir / NSTA', full: 'Norway and UK North Sea regulators', licence: 'NLOD-2.0 / NSTA-OUL' },
  { name: 'ANP', full: 'Brazil national petroleum agency', licence: 'Open data' },
  { name: 'Volve', full: 'Monthly field and well surveillance showcase', licence: 'Equinor Open Data' },
];
const fmt = (value: number, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits });

function PanelTitle({ icon: Icon, title, meta }: { icon: typeof Sparkles; title: string; meta?: string }) {
  return <div className="ins-panel-title"><Icon size={13} /><span>{title}</span>{meta && <em>{meta}</em>}</div>;
}

function EmptyState({ icon: Icon, title, copy }: { icon: typeof Sparkles; title: string; copy: string }) {
  return <div className="ins-empty"><span><Icon size={20} /></span><b>{title}</b><small>{copy}</small></div>;
}

function SignalCard({ signal, compact, onInvestigate, investigated }: {
  signal: Signal; compact?: boolean; onInvestigate: (signal: Signal) => void; investigated: boolean;
}) {
  return (
    <article className={`ins-signal-card ${signal.severity}${compact ? ' compact' : ''}`}>
      <div className="ins-signal-top"><span className="ins-severity"><CircleDot size={10} />{signal.severity}</span><em>{signal.lifecycle}</em><i>{signal.nature}</i></div>
      <div className="ins-signal-value">{signal.value}</div>
      <b>{signal.title}</b>
      <p>{signal.statement}</p>
      <div className="ins-signal-evidence"><Database size={11} /><span>{signal.evidence}</span><time>{signal.asOf}</time></div>
      {!compact && <button disabled={investigated} onClick={() => onInvestigate(signal)}>{investigated ? <><CheckCircle2 size={12} /> Investigation opened</> : <><FileSearch size={12} /> Start investigation</>}</button>}
    </article>
  );
}

export function IntelInsights() {
  const [tab, setTab] = useState<InsightTab>('briefing');
  const [scope, setScope] = useState<InsightScope>('global');
  const [insights, setInsights] = useState<CockpitInsights | null>(null);
  const [rm, setRm] = useState<RMData | null>(null);
  const [investigations, setInvestigations] = useState<Signal[]>([]);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL || '/'}osdu/cockpit-insights.json`).then((response) => response.ok ? response.json() : null).then(setInsights).catch(() => setInsights(null));
    void loadRMData().then(setRm).catch(() => setRm(null));
  }, []);

  const signals = useMemo<Signal[]>(() => {
    const out: Signal[] = [];
    if (insights) {
      const gap = insights.totals.spatialFields - insights.totals.matchedFields;
      const lead = insights.topProvinces[0];
      out.push({ id: 'global-coverage', scope: 'global', severity: 'watch', lifecycle: 'Data foundation', title: 'Authority alignment remains incomplete', value: `${fmt(gap)} fields`, statement: `${fmt(gap)} mapped fields remain GOGET-only and are not yet cross-referenced to a regulator or USGS province record.`, evidence: 'OSDU spatial spine · GOGET / regulator identity resolution', asOf: 'Current build', nature: 'DERIVED' });
      if (lead) out.push({ id: 'global-density', scope: 'global', severity: 'info', lifecycle: 'Exploration', title: 'Alberta leads connected field density', value: fmt(lead.fieldCount), statement: `${lead.prvName} has the largest connected field population in the present world-spine intersection.`, evidence: `USGS province ${lead.prvCode} · spatial centroid intersection`, asOf: 'Current build', nature: 'DERIVED' });
      out.push({ id: 'global-provinces', scope: 'global', severity: 'balanced', lifecycle: 'Portfolio', title: 'World petroleum spine is operational', value: `${fmt(insights.totals.assessedProvinces)} provinces`, statement: `${fmt(insights.totals.osduRecords)} governed OSDU records support portfolio navigation across the assessed province set.`, evidence: 'GOGET · USGS · Sodir/NSTA · ANP · Volve', asOf: 'Current build', nature: 'REPORTED' });
    }
    if (rm) {
      const live = lastLiveIdx(rm.field);
      out.push({ id: 'volve-watercut', scope: 'volve', severity: rm.field.wct[live] >= 80 ? 'high' : 'watch', lifecycle: 'Reservoir Management', title: 'Late-life water cut requires conformance review', value: `${fmt(rm.field.wct[live], 1)}%`, statement: 'The last producing month is highly water-cut. Treat this as historical Volve evidence, not a current-field alarm.', evidence: 'Volve monthly field production · calculated water cut', asOf: rm.field.ym[live], nature: 'DERIVED' });
      out.push({ id: 'volve-vrr', scope: 'volve', severity: Math.abs(rm.field.vrr.final - 1) <= .1 ? 'balanced' : 'watch', lifecycle: 'Reservoir Management', title: 'Cumulative voidage replacement is balanced', value: fmt(rm.field.vrr.final, 2), statement: 'Cumulative injected water closely replaces produced voidage across the available historical series.', evidence: 'Volve production and injection volumes · surveillance engine', asOf: rm.field.ym[live], nature: 'DERIVED' });
      out.push({ id: 'volve-recovery', scope: 'volve', severity: 'info', lifecycle: 'Field Development', title: 'Dynamic-model recovery reference available', value: `${fmt(rm.field.cumOilMM / (22 * 6.2898) * 100, 1)}%`, statement: 'Cumulative oil can be compared with the published 22 MMSm³ dynamic-model OOIP reference.', evidence: 'Volve cumulative production · 22 MMSm³ model OOIP', asOf: rm.field.ym[live], nature: 'DERIVED' });
    }
    return out;
  }, [insights, rm]);
  const scopedSignals = signals.filter((signal) => signal.scope === scope);
  const addInvestigation = (signal: Signal) => setInvestigations((current) => current.some((item) => item.id === signal.id) ? current : [...current, signal]);
  const generated = insights?.generatedAt ? new Date(insights.generatedAt).toLocaleString() : 'Current build';

  return (
    <IntelligenceSurface className="insights-surface" accent="var(--teal)">
      <IntelligenceHeader icon={Sparkles} title="Insights" subtitle="Evidence to attention to accountable decision"
        context={<div className="ins-scope"><em>Scope</em><button className={scope === 'global' ? 'active' : ''} onClick={() => setScope('global')}><Globe2 size={12} /> Global portfolio</button><button className={scope === 'volve' ? 'active' : ''} onClick={() => setScope('volve')}><MapPinned size={12} /> Volve showcase</button></div>}
        status={<div className="ins-fresh"><ShieldCheck size={12} /><span>Source-governed</span><small>As of {generated}</small></div>} />
      <IntelligenceTabs items={TABS.map((item) => ({ ...item, count: item.id === 'investigations' ? investigations.length : undefined }))} active={tab} onChange={setTab} ariaLabel="Insights views" />

      <div className="ins-content">
        {tab === 'briefing' && <Briefing scope={scope} insights={insights} rm={rm} signals={scopedSignals} investigations={investigations} onInvestigate={addInvestigation} onOpenSignals={() => setTab('signals')} />}
        {tab === 'signals' && <SignalsView scope={scope} signals={scopedSignals} investigations={investigations} onInvestigate={addInvestigation} />}
        {tab === 'investigations' && <InvestigationsView investigations={investigations} />}
        {tab === 'decisions' && <DecisionsView />}
        {tab === 'portfolio' && <PortfolioView insights={insights} />}
      </div>
    </IntelligenceSurface>
  );
}

function Briefing({ scope, insights, rm, signals, investigations, onInvestigate, onOpenSignals }: {
  scope: InsightScope; insights: CockpitInsights | null; rm: RMData | null; signals: Signal[]; investigations: Signal[];
  onInvestigate: (signal: Signal) => void; onOpenSignals: () => void;
}) {
  const live = rm ? lastLiveIdx(rm.field) : 0;
  const headline = scope === 'global'
    ? insights ? `${fmt(insights.totals.matchedFields)} fields are connected to authority or province context; ${fmt(insights.totals.spatialFields - insights.totals.matchedFields)} still require alignment.` : 'Resolving the world petroleum spine…'
    : rm ? `Volve closed its producing history at ${fmt(rm.field.oilRate[live])} bopd and ${fmt(rm.field.wct[live], 1)}% water cut, with cumulative VRR of ${fmt(rm.field.vrr.final, 2)}.` : 'Loading the Volve surveillance reference…';
  return (
    <div className="ins-brief">
      <section className="ins-brief-hero"><div><span>What needs attention</span><h2>{headline}</h2><p>{scope === 'global' ? 'Portfolio intelligence currently reflects catalogue coverage and spatial alignment—not live operations.' : 'Historical showcase · values must not be interpreted as a live Volve operating alarm.'}</p></div><div className="ins-brief-score"><b>{signals.filter((item) => item.severity === 'high' || item.severity === 'watch').length}</b><span>attention signals</span><small>{signals.length} total in scope</small></div></section>
      <section className="ins-panel ins-priority"><PanelTitle icon={RadioTower} title="Priority signals" meta={`${signals.length} in scope`} /><div className="ins-priority-list">{signals.slice(0, 3).map((signal) => <SignalCard key={signal.id} signal={signal} compact onInvestigate={onInvestigate} investigated={investigations.some((item) => item.id === signal.id)} />)}{!signals.length && <EmptyState icon={RadioTower} title="Resolving signals" copy="Waiting for governed source data." />}</div><button className="ins-link" onClick={onOpenSignals}>Open signal register <ArrowUpRight size={12} /></button></section>
      <section className="ins-panel ins-queue"><PanelTitle icon={ClipboardCheck} title="Decision queue" meta="governed records" /><EmptyState icon={ClipboardCheck} title="No decisions recorded" copy="A signal must be investigated and reviewed before it becomes an accountable decision." /></section>
      <section className="ins-panel ins-health"><PanelTitle icon={Activity} title="Scope health" meta={scope === 'global' ? 'world spine' : 'historical field'} /><div className="ins-health-grid">
        {scope === 'global' && insights ? <><Health label="Catalogue match" value={`${fmt(insights.totals.matchRate, 1)}%`} note={`${fmt(insights.totals.matchedFields)} / ${fmt(insights.totals.spatialFields)} fields`} /><Health label="Assessed provinces" value={fmt(insights.totals.assessedProvinces)} note="USGS world petroleum" /><Health label="Governed records" value={fmt(insights.totals.osduRecords)} note="OSDU-aligned catalogue" /></> : rm ? <><Health label="Cumulative oil" value={`${fmt(rm.field.cumOilMM, 1)} MMSTB`} note="Volve monthly series" /><Health label="Water injected" value={`${fmt(rm.field.cumWinjMM, 1)} MMbbl`} note="Historical cumulative" /><Health label="Well roles" value={`${rm.wells.filter((well) => well.cumOilMM > 0).length} P · ${rm.wells.filter((well) => well.cumWinjMM > 0).length} I`} note={`${rm.patterns.patterns.length} derived patterns`} /></> : <EmptyState icon={Gauge} title="Loading scope health" copy="Resolving governed metrics." />}
      </div></section>
      <section className="ins-panel ins-evidence"><PanelTitle icon={BookOpenCheck} title="Evidence posture" meta="truth labels" /><div className="ins-evidence-flow"><span><Database size={14} /><b>Observe</b><small>Governed source</small></span><i>→</i><span><RadioTower size={14} /><b>Signal</b><small>Derived threshold</small></span><i>→</i><span><FileSearch size={14} /><b>Investigate</b><small>Human-owned</small></span><i>→</i><span><ClipboardCheck size={14} /><b>Decide</b><small>Auditable action</small></span></div></section>
    </div>
  );
}

function Health({ label, value, note }: { label: string; value: string; note: string }) { return <div className="ins-health-card"><span>{label}</span><b>{value}</b><small>{note}</small></div>; }

function SignalsView({ scope, signals, investigations, onInvestigate }: { scope: InsightScope; signals: Signal[]; investigations: Signal[]; onInvestigate: (signal: Signal) => void }) {
  return <div className="ins-register"><div className="ins-register-head"><div><b>Signal register</b><span>{scope === 'global' ? 'Global portfolio' : 'Volve historical showcase'} · deterministic, source-backed observations</span></div><div className="ins-legend"><i className="high" />High<i className="watch" />Watch<i className="balanced" />Balanced<i className="info" />Information</div></div><div className="ins-register-grid">{signals.map((signal) => <SignalCard key={signal.id} signal={signal} onInvestigate={onInvestigate} investigated={investigations.some((item) => item.id === signal.id)} />)}</div></div>;
}

function InvestigationsView({ investigations }: { investigations: Signal[] }) {
  if (!investigations.length) return <EmptyState icon={FileSearch} title="No investigations in this session" copy="Open a governed signal and choose Start investigation. Persisted cases, owners and collaboration are not connected yet." />;
  return <div className="ins-investigations"><div className="ins-session-note"><AlertTriangle size={12} /><span>Session drafts only · not persisted or assigned</span></div>{investigations.map((item) => <article key={item.id}><div className="ins-case-head"><span>INV-{item.id.toUpperCase()}</span><em>Draft</em></div><b>{item.title}</b><p>{item.statement}</p><div className="ins-case-grid"><span><small>Observation</small><b>{item.value}</b></span><span><small>Evidence</small><b>{item.evidence}</b></span><span><small>Hypothesis</small><b>Awaiting technical review</b></span><span><small>Owner</small><b>Unassigned</b></span></div></article>)}</div>;
}

function DecisionsView() {
  return <div className="ins-decisions"><EmptyState icon={ClipboardCheck} title="No governed decisions recorded" copy="This surface will capture proposed actions, approvals, expected value and measured outcomes. Investigations remain separate until reviewed by an accountable human." /><div className="ins-decision-schema"><PanelTitle icon={Target} title="Decision record contract" meta="ready for persistence" /><div>{['Decision and rationale','Scope and accountable owner','Evidence and uncertainty','Expected value / risk','Approval trail','Action and measured outcome'].map((item, index) => <span key={item}><i>{index + 1}</i><b>{item}</b></span>)}</div></div></div>;
}

function PortfolioView({ insights }: { insights: CockpitInsights | null }) {
  if (!insights) return <EmptyState icon={Globe2} title="Loading portfolio intelligence" copy="Resolving the world-spine intersection." />;
  const max = insights.topProvinces[0]?.fieldCount ?? 1;
  return <div className="ins-portfolio"><div className="ins-portfolio-kpis"><Health label="Fields connected" value={fmt(insights.totals.matchedFields)} note={`${fmt(insights.totals.matchRate, 1)}% catalogue match`} /><Health label="Spatial fields" value={fmt(insights.totals.spatialFields)} note="Real map geometry" /><Health label="Assessed provinces" value={fmt(insights.totals.assessedProvinces)} note="USGS coverage" /><Health label="OSDU records" value={fmt(insights.totals.osduRecords)} note="Source-governed" /></div><section className="ins-panel ins-leaders"><PanelTitle icon={TrendingUp} title="Leading provinces by connected fields" meta="spatial intersection" /><div className="ins-leaderboard">{insights.topProvinces.slice(0, 10).map((province, index) => <div key={province.prvCode}><span>{index + 1}</span><b>{province.prvName}</b><i><i style={{ width: `${province.fieldCount / max * 100}%` }} /></i><strong>{fmt(province.fieldCount)}</strong><em>{province.boeMean == null ? 'Endowment not reported' : `${fmt(province.boeMean, 1)} mean reference`}</em></div>)}</div></section><section className="ins-panel ins-source-panel"><PanelTitle icon={Layers3} title="Governed sources" meta={`${SOURCES.length} connected`} /><div className="ins-source-grid">{SOURCES.map((source) => <div key={source.name}><ShieldCheck size={13} /><span><b>{source.name}</b><small>{source.full}</small></span><em>{source.licence}</em></div>)}</div></section></div>;
}

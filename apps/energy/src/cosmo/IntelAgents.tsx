// Intelligence → Agents — the ArgantaEnergy workforce control plane. The five
// lifecycle definitions are real and shared with Cockpit. Runtime runs, telemetry,
// evaluations and deployment versions are not connected yet, so those surfaces
// expose their contracts and honest awaiting states instead of invented activity.
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowUpRight, Beaker, BookOpenCheck, Bot, Boxes, Braces,
  CheckCircle2, ChevronRight, CircleOff, Clock3, Database, Eye, FileKey2, Gauge,
  GitBranch, KeyRound, Library, LockKeyhole, Play, RadioTower, ScrollText, Settings2,
  ShieldCheck, Sparkles, TerminalSquare, TestTube2, Users, Wrench,
} from 'lucide-react';
import { AGENTS, type AgentDef } from './agents';
import { IntelligenceHeader, IntelligenceSurface, IntelligenceTabs } from './IntelligenceChrome';
import { EMPTY_CONTEXT, knowledgeBindings, loadAgentContext, toolBindings, verticalSummary, type AgentContext } from './agent-context';
import './intel-agents.css';

type AgentTab = 'workforce' | 'runs' | 'evaluations' | 'monitor' | 'governance';
type DetailTab = 'overview' | 'build' | 'knowledge' | 'tools' | 'test' | 'evaluate' | 'monitor' | 'versions';
type DirectoryAgent = AgentDef & { owner: string; role: string; runtime: string; kind: 'orchestrator' | 'lifecycle' };

const ORCHESTRATOR: DirectoryAgent = {
  id: 'arganta', name: 'Arganta', short: 'ARG', icon: Sparkles, color: '#0FB5A6', state: 'LIVE', kind: 'orchestrator',
  owner: 'Arganta Intelligence', role: 'Orchestration and user interface', runtime: 'Interface live · run ledger awaiting',
  generic: 'Route user intent to governed data, knowledge, lifecycle workspaces and accountable human decisions.',
  proof: 'The Ask Arganta surface is available; lifecycle execution telemetry is not yet registered.',
};
const OWNER: Record<string, string> = {
  exploration: 'Subsurface New Ventures', 'field-development': 'Development Planning', 'well-delivery': 'Wells',
  'reservoir-management': 'Asset Reservoir Management', 'drilling-sequence': 'Drilling & Logistics',
};
const DIRECTORY: DirectoryAgent[] = [ORCHESTRATOR, ...AGENTS.map((agent) => ({ ...agent, kind: 'lifecycle' as const, owner: OWNER[agent.id] ?? 'Unassigned', role: `${agent.name} lifecycle coordinator`, runtime: 'Workspace connected · agent runtime awaiting' }))];
const TABS: Array<{ id: AgentTab; label: string; icon: typeof Bot }> = [
  { id: 'workforce', label: 'Workforce', icon: Users }, { id: 'runs', label: 'Runs', icon: GitBranch },
  { id: 'evaluations', label: 'Evaluations', icon: Beaker }, { id: 'monitor', label: 'Monitor', icon: Activity },
  { id: 'governance', label: 'Governance', icon: ShieldCheck },
];
const DETAIL_TABS: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Overview' }, { id: 'build', label: 'Build' }, { id: 'knowledge', label: 'Knowledge' },
  { id: 'tools', label: 'Tools & skills' }, { id: 'test', label: 'Test' }, { id: 'evaluate', label: 'Evaluate' },
  { id: 'monitor', label: 'Monitor' }, { id: 'versions', label: 'Versions & access' },
];
const EVAL_SUITES = [
  { name: 'Grounding & citation', cases: 'Awaiting test set', status: 'DRAFT', copy: 'Claims resolve to approved OSDU, knowledge or lifecycle evidence.' },
  { name: 'Petroleum units', cases: 'Awaiting test set', status: 'DRAFT', copy: 'Liquid, gas, pressure and depth units remain dimensionally valid.' },
  { name: 'Permission boundaries', cases: 'Awaiting test set', status: 'DRAFT', copy: 'Read, propose and write actions respect the configured human gate.' },
  { name: 'Lifecycle routing', cases: 'Awaiting test set', status: 'DRAFT', copy: 'Requests are routed to the correct lifecycle workspace or specialist.' },
];

function EmptyState({ icon: Icon, title, copy }: { icon: typeof Bot; title: string; copy: string }) {
  return <div className="iag-empty"><span><Icon size={20} /></span><b>{title}</b><small>{copy}</small></div>;
}
function SectionTitle({ icon: Icon, title, meta }: { icon: typeof Bot; title: string; meta?: string }) {
  return <div className="iag-section-title"><Icon size={13} /><span>{title}</span>{meta && <em>{meta}</em>}</div>;
}

export function IntelAgents({ onNavigate }: { onNavigate: (id: string) => void }) {
  const [tab, setTab] = useState<AgentTab>('workforce');
  const [selected, setSelected] = useState<DirectoryAgent | null>(null);
  // what the workspace can actually evidence — measured, not asserted
  const [ctx, setCtx] = useState<AgentContext | null>(null);
  useEffect(() => {
    let dead = false;
    loadAgentContext()
      .then((c) => { if (!dead) setCtx(c); })
      .catch(() => { if (!dead) setCtx(EMPTY_CONTEXT); });
    return () => { dead = true; };
  }, []);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const live = DIRECTORY.filter((agent) => agent.state === 'LIVE').length;

  return (
    <IntelligenceSurface className="agents-surface" accent="var(--purple)">
      <IntelligenceHeader icon={Bot} title="Agents" subtitle="Governed digital workforce control plane"
        context={<div className="iag-summary"><span><b>{DIRECTORY.length}</b><small>registered</small></span><span><b>{live}</b><small>interface live</small></span><span><b>0</b><small>runtime ledgers</small></span></div>}
        status={<div className="iag-posture"><ShieldCheck size={12} /><span>Human authority retained</span><small>Write actions are not connected</small></div>} />
      <IntelligenceTabs items={TABS} active={tab} onChange={(next) => { setTab(next); setSelected(null); }} ariaLabel="Agent control views" />
      <div className="iag-content">
        {tab === 'workforce' && !selected && <Workforce agents={DIRECTORY} onSelect={(agent) => { setSelected(agent); setDetailTab('overview'); }} onNavigate={onNavigate} />}
        {tab === 'workforce' && selected && <AgentDetail agent={selected} tab={detailTab} ctx={ctx} onChangeTab={setDetailTab} onBack={() => setSelected(null)} onNavigate={onNavigate} />}
        {tab === 'runs' && <Runs />}
        {tab === 'evaluations' && <Evaluations />}
        {tab === 'monitor' && <Monitor />}
        {tab === 'governance' && <Governance agents={DIRECTORY} />}
      </div>
    </IntelligenceSurface>
  );
}

function Workforce({ agents, onSelect, onNavigate }: { agents: DirectoryAgent[]; onSelect: (agent: DirectoryAgent) => void; onNavigate: (id: string) => void }) {
  return <div className="iag-workforce"><section className="iag-workforce-hero"><div><span>Digital workforce</span><h2>One orchestrator. Five accountable lifecycle specialists.</h2><p>Definitions and workspaces are registered. Execution, evaluation and production telemetry remain visibly unconnected.</p></div><div className="iag-legend"><span><i className="live" />Interface live</span><span><i className="beta" />Lifecycle beta</span><span><i className="await" />Runtime awaiting</span></div></section><div className="iag-directory">{agents.map((agent) => <article key={agent.id} className={`iag-card ${agent.kind}`} style={{ '--agent': agent.color } as React.CSSProperties}>
    <div className="iag-card-head"><span className="iag-avatar"><agent.icon size={18} /></span><div><b>{agent.name}</b><small>{agent.short} · {agent.kind}</small></div><em className={agent.state.toLowerCase()}>{agent.state}</em></div>
    <p>{agent.generic}</p><div className="iag-meta"><span><small>Owner</small><b>{agent.owner}</b></span><span><small>Runtime</small><b>{agent.runtime}</b></span></div>
    <div className="iag-card-actions"><button onClick={() => onSelect(agent)}>Inspect agent <ChevronRight size={12} /></button>{agent.kind === 'lifecycle' && <button onClick={() => onNavigate(agent.id)}>Open workspace <ArrowUpRight size={12} /></button>}</div>
  </article>)}</div></div>;
}

function AgentDetail({ agent, tab, ctx, onChangeTab, onBack, onNavigate }: { agent: DirectoryAgent; tab: DetailTab; ctx: AgentContext | null; onChangeTab: (tab: DetailTab) => void; onBack: () => void; onNavigate: (id: string) => void }) {
  return <div className="iag-detail"><aside className="iag-detail-rail"><button className="iag-back" onClick={onBack}><ArrowLeft size={12} /> Workforce</button><div className="iag-profile" style={{ '--agent': agent.color } as React.CSSProperties}><span><agent.icon size={22} /></span><b>{agent.name}</b><small>{agent.role}</small><em>{agent.state}</em></div><nav>{DETAIL_TABS.map((item) => <button key={item.id} className={tab === item.id ? 'active' : ''} onClick={() => onChangeTab(item.id)}>{item.label}<ChevronRight size={11} /></button>)}</nav>{agent.kind === 'lifecycle' && <button className="iag-open-workspace" onClick={() => onNavigate(agent.id)}>Open lifecycle workspace <ArrowUpRight size={12} /></button>}</aside><main className="iag-detail-main"><DetailContent agent={agent} tab={tab} ctx={ctx} /></main></div>;
}

function DetailContent({ agent, tab, ctx }: { agent: DirectoryAgent; tab: DetailTab; ctx: AgentContext | null }) {
  if (tab === 'overview') return <div className="iag-overview"><section className="iag-detail-hero" style={{ '--agent': agent.color } as React.CSSProperties}><div><span>{agent.short} AGENT · {agent.kind}</span><h2>{agent.name}</h2><p>{agent.generic}</p></div><em>{agent.state}</em></section><div className="iag-overview-grid"><section><SectionTitle icon={TargetIcon} title="Accountability" /><Kv label="Owner" value={agent.owner} /><Kv label="Role" value={agent.role} /><Kv label="Runtime" value={agent.runtime} /><Kv label="Human gate" value="Required for material write actions" /></section><section><SectionTitle icon={Eye} title="Showcase proof" /><p>{agent.proof}</p><small>Purpose copy and workspace evidence only · not an agent-run result.</small></section><section><SectionTitle icon={Boxes} title="Connected surfaces" meta={verticalSummary(agent.id, ctx) ?? undefined} /><div className="iag-chip-list">{toolBindings(agent.id, ctx).map((b) => <span key={b.label} className={b.bound ? 'bound' : undefined}>{b.label}{b.evidence && <i>{b.evidence}</i>}</span>)}</div></section><section><SectionTitle icon={BookOpenCheck} title="Knowledge posture" /><div className="iag-chip-list">{knowledgeBindings(agent.id, ctx).map((b) => <span key={b.label} className={b.bound ? 'bound' : undefined}>{b.label}{b.evidence && <i>{b.evidence}</i>}</span>)}</div></section></div></div>;
  if (tab === 'build') return <ConfigView title="Build definition" icon={Settings2} note="Only the shared purpose statement is currently registered. Remaining fields expose the required contract." rows={[['Identity',`${agent.name} · ${agent.short}`,'REGISTERED'],['Purpose',agent.generic,'REGISTERED'],['Instructions','Not governed in the agent registry','AWAITING'],['Model / runtime','Not registered','AWAITING'],['Triggers',agent.kind === 'lifecycle' ? 'Manual workspace launch only' : 'Ask Arganta interface','PARTIAL'],['Orchestration policy','Not registered','AWAITING']]} />;
  if (tab === 'knowledge') return <ConfigView title="Knowledge connections" icon={Library} note="Retrieval sources are listed with the evidence currently behind them. A source with no measured artefact is shown as awaiting, not available." rows={knowledgeBindings(agent.id, ctx).map((b) => [b.label, b.evidence ?? 'No measured evidence yet', b.bound ? 'AVAILABLE' : 'AWAITING'])} />;
  if (tab === 'tools') return <ConfigView title="Tools & skills" icon={Wrench} note="Agent-callable tool contracts are still unregistered; what is measured here is the evidence each surface can already draw on." rows={toolBindings(agent.id, ctx).map((b) => [b.label, b.evidence ?? 'No measured evidence yet', b.bound ? 'EVIDENCE READY' : 'NOT TOOL-BOUND'])} />;
  if (tab === 'test') return <div className="iag-test"><SectionTitle icon={Play} title="Interactive preview" meta="runtime required" /><div className="iag-test-box"><div><Bot size={18} /><span><b>{agent.name}</b><small>Preview plan, retrieval, tool calls and response here.</small></span></div><textarea disabled value="Agent preview is unavailable until a governed runtime is registered." readOnly /><button disabled><Play size={12} /> Run preview</button></div><EmptyState icon={TerminalSquare} title="No preview runtime connected" copy="The lifecycle workspace remains usable, but it must not be presented as an autonomous agent execution." /></div>;
  if (tab === 'evaluate') return <div className="iag-agent-eval"><SectionTitle icon={TestTube2} title="Evaluation gates" meta="draft suites" /><div>{EVAL_SUITES.map((suite) => <EvalCard key={suite.name} {...suite} />)}</div></div>;
  if (tab === 'monitor') return <EmptyState icon={Gauge} title="No telemetry for this agent" copy="Register a runtime and execution ledger before showing success rate, latency, cost, groundedness or tool reliability." />;
  return <ConfigView title="Versions & access" icon={FileKey2} note="Workspace status is not the same as a deployed agent version." rows={[['Current definition','Shared registry purpose metadata','UNVERSIONED'],['Draft version','Not created','AWAITING'],['Production deployment','Not registered','AWAITING'],['Owner',agent.owner,'REGISTERED'],['Read scopes','Not registered','AWAITING'],['Write scopes','None connected','LOCKED']]} />;
}

const TargetIcon = Gauge;
function Kv({ label, value }: { label: string; value: string }) { return <div className="iag-kv"><span>{label}</span><b>{value}</b></div>; }
function ConfigView({ title, icon: Icon, note, rows }: { title: string; icon: typeof Bot; note: string; rows: string[][] }) { return <div className="iag-config"><SectionTitle icon={Icon} title={title} meta="definition contract" /><p>{note}</p><div>{rows.map(([name, value, status]) => <article key={name}><span><b>{name}</b><small>{value}</small></span><em className={status.toLowerCase().replace(/\s+/g, '-')}>{status}</em></article>)}</div></div>; }

function Runs() { return <div className="iag-runs"><section className="iag-metric-row"><Metric icon={GitBranch} label="Recorded runs" value="0" note="No execution ledger" /><Metric icon={CheckCircle2} label="Success rate" value="—" note="Requires runs" /><Metric icon={Clock3} label="Latency" value="—" note="Requires traces" /><Metric icon={Database} label="Tool calls" value="—" note="Requires instrumentation" /></section><section className="iag-run-table"><SectionTitle icon={ScrollText} title="Execution ledger" meta="input · plan · tools · approvals · output" /><EmptyState icon={GitBranch} title="No agent runs recorded" copy="Opening a lifecycle workspace is navigation, not an agent run. A run appears here only after a governed runtime emits a trace." /></section></div>; }
function Metric({ icon: Icon, label, value, note }: { icon: typeof Bot; label: string; value: string; note: string }) { return <div className="iag-metric"><Icon size={13} /><span>{label}</span><b>{value}</b><small>{note}</small></div>; }
function EvalCard({ name, cases, status, copy }: { name: string; cases: string; status: string; copy: string }) { return <article className="iag-eval-card"><Beaker size={14} /><div><b>{name}</b><p>{copy}</p><small>{cases}</small></div><em>{status}</em></article>; }
function Evaluations() { return <div className="iag-evaluations"><div className="iag-eval-head"><div><b>Petroleum-domain quality gates</b><span>Draft evaluation contracts · no scores until test cases and a runtime exist</span></div><button disabled><Beaker size={12} /> Run evaluation</button></div><div className="iag-eval-grid">{EVAL_SUITES.map((suite) => <EvalCard key={suite.name} {...suite} />)}</div><section className="iag-eval-flow"><SectionTitle icon={Braces} title="Release gate" meta="proposed" /><div><span><b>1</b><small>Register version</small></span><i>→</i><span><b>2</b><small>Run test set</small></span><i>→</i><span><b>3</b><small>Human review</small></span><i>→</i><span><b>4</b><small>Promote deployment</small></span></div></section></div>; }
function Monitor() { return <div className="iag-monitor"><section className="iag-metric-row"><Metric icon={Activity} label="Run success" value="—" note="Awaiting telemetry" /><Metric icon={Clock3} label="P95 latency" value="—" note="Awaiting telemetry" /><Metric icon={Gauge} label="Groundedness" value="—" note="Awaiting evaluator" /><Metric icon={LockKeyhole} label="Guardrail events" value="—" note="Awaiting audit stream" /></section><section className="iag-monitor-main"><div><SectionTitle icon={RadioTower} title="Operational telemetry" meta="not connected" /><EmptyState icon={RadioTower} title="Monitoring starts with traces" copy="Instrument runs, retrieval, tool calls, approvals, failures and token/cost records before rendering operational charts." /></div><aside><SectionTitle icon={Activity} title="Required channels" /><ul>{['Run and step traces','Retrieval and citation events','Tool calls and failures','Human approvals','Evaluation outcomes','Security / guardrail events'].map((item) => <li key={item}><CircleOff size={11} />{item}<em>AWAITING</em></li>)}</ul></aside></section></div>; }
function Governance({ agents }: { agents: DirectoryAgent[] }) { const controls = useMemo(() => [['Inventory',`${agents.length} definitions registered`,'PARTIAL'],['Accountable owners',`${agents.filter((agent) => agent.owner !== 'Unassigned').length} / ${agents.length} assigned`,'REGISTERED'],['Runtime identities','No runtimes registered','AWAITING'],['Read permissions','Not registered','AWAITING'],['Write permissions','No write actions connected','LOCKED'],['Evaluation release gates','Draft contract only','DRAFT'],['Audit retention','Not configured','AWAITING']], [agents]); return <div className="iag-governance"><section><SectionTitle icon={ShieldCheck} title="Control posture" meta="honest inventory" /><div className="iag-control-list">{controls.map(([name,value,status]) => <article key={name}><span><b>{name}</b><small>{value}</small></span><em className={status.toLowerCase()}>{status}</em></article>)}</div></section><aside><SectionTitle icon={KeyRound} title="Authority model" /><div className="iag-authority"><span><Eye size={14} /><b>Read</b><small>Explicit governed scopes</small></span><span><Sparkles size={14} /><b>Propose</b><small>Agent recommendation</small></span><span><Users size={14} /><b>Approve</b><small>Accountable human</small></span><span><LockKeyhole size={14} /><b>Write</b><small>Bound tool after approval</small></span></div><div className="iag-rule"><ShieldCheck size={13} /><span><b>Current posture</b> No agent-bound write tools exist, so human authority cannot be bypassed.</span></div></aside></div>; }

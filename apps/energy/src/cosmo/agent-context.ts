// cosmo/agent-context.ts — what an agent can actually see.
//
// The Agents directory used to describe its own capability with hardcoded strings,
// so it read the same whether the workspace held 58 ingested assets or nothing at
// all. This measures the real thing: assets by kind, where they were ingested,
// the governed OSDU record count, and the extraction review state.
//
// The honesty rule: a surface only reports as BOUND when a measurable artefact
// backs it. Everything else keeps saying NOT TOOL-BOUND — an agent claiming a
// capability it cannot evidence is worse than one admitting the gap.
import type { AssetKind, IngestedAsset, Vertical } from '../dataqc/types.ts';
import { listAllAssets } from '../dataqc/db.ts';
import { assetsToManifest, countRecords } from '../dataqc/osdu.ts';
import { readRecord } from '../dataqc/readDigest.ts';
import { applyReviews, loadReviews, tally } from '../knowledge/review.ts';
import type { ExtractionCandidate } from '../knowledge/types.ts';

export interface AgentContext {
  fields: string[];
  assets: number;
  byKind: Partial<Record<AssetKind, number>>;
  /** where each asset was ingested — agent id and Vertical share this key space */
  byVertical: Partial<Record<Vertical, number>>;
  osduRecords: number;
  extraction: { docs: number; candidates: number; accepted: number; pending: number };
}

export const EMPTY_CONTEXT: AgentContext = {
  fields: [], assets: 0, byKind: {}, byVertical: {}, osduRecords: 0,
  extraction: { docs: 0, candidates: 0, accepted: 0, pending: 0 },
};

/** Pure roll-up — the IO lives in loadAgentContext, this is what the tests drive. */
export function summarize(
  assets: IngestedAsset[],
  candidates: ExtractionCandidate[],
  reviews = loadReviews(),
): AgentContext {
  const byKind: Partial<Record<AssetKind, number>> = {};
  const byVertical: Partial<Record<Vertical, number>> = {};
  const fields = new Set<string>();
  for (const a of assets) {
    byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
    byVertical[a.vertical] = (byVertical[a.vertical] ?? 0) + 1;
    fields.add(a.fieldId);
  }
  const t = tally(applyReviews(candidates, reviews));
  return {
    fields: [...fields],
    assets: assets.length,
    byKind,
    byVertical,
    osduRecords: assets.length ? countRecords(assetsToManifest(assets)) : 0,
    extraction: {
      docs: byKind.document ?? 0,
      candidates: t.total, accepted: t.accepted, pending: t.pending,
    },
  };
}

interface DocPayload { candidates?: ExtractionCandidate[] }

export async function loadAgentContext(): Promise<AgentContext> {
  const assets = await listAllAssets();
  const candidates: ExtractionCandidate[] = [];
  for (const d of assets.filter((a) => a.kind === 'document')) {
    const p = await readRecord<DocPayload>(d);   // cached by readDigest
    if (p?.candidates) candidates.push(...p.candidates);
  }
  return summarize(assets, candidates);
}

// ── surface → evidence bindings ──────────────────────────────────────────────
// Each connected surface names the artefact class that would actually back it.
// `count` resolves against the measured context; null/0 ⇒ the surface stays
// unbound and says so.
type Resolve = (c: AgentContext) => number;
const k = (...kinds: AssetKind[]): Resolve => (c) => kinds.reduce((n, x) => n + (c.byKind[x] ?? 0), 0);

interface SurfaceDef { label: string; unit: string; resolve: Resolve }

const TOOLS: Record<string, SurfaceDef[]> = {
  arganta: [
    { label: 'OSDU catalogue search', unit: 'records', resolve: (c) => c.osduRecords },
    { label: 'Knowledge retrieval', unit: 'candidates', resolve: (c) => c.extraction.candidates },
    { label: 'Lifecycle navigation', unit: 'lifecycles with data', resolve: (c) => Object.keys(c.byVertical).length },
    { label: 'Artifact presentation', unit: 'assets', resolve: (c) => c.assets },
  ],
  exploration: [
    { label: 'World petroleum map', unit: 'fields', resolve: (c) => c.fields.length },
    { label: 'Basin / play context', unit: 'surfaces', resolve: k('surface') },
    { label: 'Prospect risk', unit: '', resolve: () => 0 },
    { label: 'Prospect volumetrics', unit: '', resolve: () => 0 },
  ],
  'field-development': [
    { label: 'Static model', unit: 'surfaces', resolve: k('surface') },
    { label: 'Volumetrics', unit: 'logs + picks', resolve: k('log', 'picks') },
    { label: 'Concept screening', unit: '', resolve: () => 0 },
    { label: 'Forecast & economics', unit: 'production series', resolve: k('production') },
  ],
  'well-delivery': [
    { label: 'Trajectory design', unit: 'surveys', resolve: k('trajectory') },
    { label: 'Clearance', unit: 'surveys', resolve: k('trajectory') },
    { label: 'Well basis', unit: 'logs', resolve: k('log') },
    { label: 'Handover readiness', unit: '', resolve: () => 0 },
  ],
  'reservoir-management': [
    { label: 'Production surveillance', unit: 'production series', resolve: k('production') },
    { label: 'Injection & VRR', unit: 'injection series', resolve: k('injection') },
    { label: 'Pressure / tests', unit: 'reports', resolve: k('document') },
    { label: 'Patterns & forecast', unit: 'pattern sets', resolve: k('patterns') },
  ],
  'drilling-sequence': [
    { label: 'Well stock', unit: 'surveys', resolve: k('trajectory') },
    { label: 'Rig schedule', unit: '', resolve: () => 0 },
    { label: 'Constraint review', unit: '', resolve: () => 0 },
    { label: 'Sequence scenarios', unit: '', resolve: () => 0 },
  ],
};

const KNOWLEDGE: Record<string, SurfaceDef[]> = {
  arganta: [
    { label: 'World field catalogue', unit: 'fields ingested', resolve: (c) => c.fields.length },
    { label: 'Arganta knowledge graph', unit: 'accepted extractions', resolve: (c) => c.extraction.accepted },
    { label: 'Reviewed document evidence', unit: 'reports', resolve: k('document') },
    { label: 'Governed OSDU records', unit: 'records', resolve: (c) => c.osduRecords },
  ],
};
const KNOWLEDGE_DEFAULT: SurfaceDef[] = [
  { label: 'OSDU field context', unit: 'records', resolve: (c) => c.osduRecords },
  { label: 'Reviewed document evidence', unit: 'accepted', resolve: (c) => c.extraction.accepted },
  { label: 'Workspace assets', unit: 'assets', resolve: (c) => c.assets },
  { label: 'Client field extension slot', unit: '', resolve: () => 0 },
];

export interface Binding {
  label: string;
  /** measured backing, or null when nothing evidences this surface yet */
  evidence: string | null;
  bound: boolean;
}

const bind = (defs: SurfaceDef[], ctx: AgentContext | null): Binding[] =>
  defs.map((d) => {
    const n = ctx ? d.resolve(ctx) : 0;
    return {
      label: d.label,
      evidence: n > 0 ? `${n.toLocaleString('en-US')}${d.unit ? ` ${d.unit}` : ''}` : null,
      bound: n > 0,
    };
  });

export const toolBindings = (agentId: string, ctx: AgentContext | null): Binding[] =>
  bind(TOOLS[agentId] ?? [], ctx);

export const knowledgeBindings = (agentId: string, ctx: AgentContext | null): Binding[] =>
  bind(KNOWLEDGE[agentId] ?? KNOWLEDGE_DEFAULT, ctx);

/** One-line readout for the agent header: what this lifecycle actually holds. */
export function verticalSummary(agentId: string, ctx: AgentContext | null): string | null {
  if (!ctx || !ctx.assets) return null;
  const own = ctx.byVertical[agentId as Vertical];
  return own
    ? `${own} asset${own === 1 ? '' : 's'} ingested in this lifecycle · ${ctx.assets} field-wide`
    : `${ctx.assets} asset${ctx.assets === 1 ? '' : 's'} in the workspace · none ingested through this lifecycle yet`;
}

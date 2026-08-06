// agent/capabilities.ts — the capability registry (L2). THE PRODUCT SURFACE.
//
// One capability = one thing the agent can do = one grammar rule = (later) one
// LLM tool. Adding a capability adds language, routing and a tool automatically,
// which is what keeps the deterministic tier and the worker tier from drifting.
//
// THE HONESTY RULE
// `probe` reads node.has and NOTHING else. node.has is written by the build from
// real file contents. A capability whose probe returns false is never planned;
// it is reported as a reasoned absence via `absence`. This is the difference
// between "Volve is the only field with well logs — Badak has field records and
// a USGS assessment, no logs" and routing the user to an empty viewer.
//
// ROUTING IS VERIFIED, NOT GUESSED
// The Exploration and Field Development *suite* tabs render widget BLUEPRINTS,
// not built viewers. The surfaces that actually hold content today are:
//   exploration            mode 'knowledge'  → Basin Dossier
//   field-development      mode 'knowledge'  → Asset Dossier
//   field-development      sub  'client-data-qc' → Data QC (log/trajectory viewers)
//   field-development      legacyTab 'logs' … → the 13 built Legacy views
//   reservoir-management   mode 'knowledge'  → Surveillance Dossier
//   cockpit                                  → the map
// Every route below lands on one of those. `mode` is read by every vertical
// through cosmo/use-view-mode.ts.

import type { AgentCommand, AnswerCard, CardChip, CardFact, GazIndexed, GazKind, Scope } from './types.ts';
import type { GazIndex } from './gazetteer.ts';
import { childrenOfKind, toRef } from './gazetteer.ts';
import { levelForKind } from './brain.ts';

export interface CapCtx {
  index: GazIndex;
  scope: Scope;
}

export interface Capability {
  id: string;
  label: string;
  /** Entity kinds this applies to. */
  kinds: GazKind[];
  /** Deterministic grammar triggers — the registry IS the lexicon (L4). */
  phrases: string[];
  /** Reads node.has only. Never a guess. */
  probe: (node: GazIndexed) => boolean;
  /** Shown when `probe` is false. Must say what IS available instead. */
  absence?: (node: GazIndexed, ctx: CapCtx) => string;
  plan: (node: GazIndexed, ctx: CapCtx) => AgentCommand[];
  card: (node: GazIndexed, ctx: CapCtx) => AnswerCard;
  /** Rank among capabilities matching a bare entity query. Higher wins. */
  weight?: number;
  /** What the answer looks like. The planner uses it to honour a "list …" verb
   *  without having to run a card first and inspect the result. */
  shape: 'brief' | 'list' | 'action' | 'menu';
}

// ── formatting ───────────────────────────────────────────────────────────────

const num = (n: number | null | undefined, dp = 0): string => (n === null || n === undefined || !Number.isFinite(n)
  ? '—' : n.toLocaleString('en-GB', { maximumFractionDigits: dp }));
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
const asNumber = (v: unknown): number => (typeof v === 'number' ? v : 0);
const asBool = (v: unknown): boolean => v === true;

/** Provenance strip. No card renders a number without one. */
const prov = (node: GazIndexed, ...extra: string[]) => [...new Set([...(node.sources ?? []), ...extra])];

/** A chip re-enters the pipeline as if typed, so chip-clicks and typing share
 *  exactly one code path. */
const chip = (label: string, query: string, hint?: string, count?: number): CardChip => ({ label, query, hint, count });

const nodeChips = (nodes: GazIndexed[], limit = 8): CardChip[] =>
  nodes.slice(0, limit).map((n) => chip(n.name, n.name, n.displayName !== n.name ? n.displayName : undefined));

/** The other things this node can actually answer, as chips.
 *
 *  A card with no chips is a cul-de-sac: the answer is correct and the user has
 *  nowhere to go from it but the text box. Five capabilities shipped that way,
 *  each individually reasonable — which is why this is computed from the
 *  registry rather than hand-listed per card. It stays right as capabilities
 *  are added, and it can never offer something that is not there, because the
 *  offer is gated on the same `probe` the real answer is gated on.
 *
 *  `exclude` is the capability doing the asking — offering to show you what you
 *  are already looking at is worse than offering nothing. */
function alsoAvailable(node: GazIndexed, exclude: string, limit = 4): CardChip[] {
  const out: CardChip[] = [];
  for (const capability of CAPABILITIES) {
    if (capability.id === exclude) continue;
    if (!capability.kinds.includes(node.kind)) continue;
    let ok = false;
    try { ok = capability.probe(node); } catch { ok = false; }
    if (!ok) continue;
    const phrase = capability.phrases[0];
    if (!phrase) continue;
    out.push(chip(capability.label, `${phrase} ${node.name}`, `for ${node.name}`));
    if (out.length >= limit) break;
  }
  return out;
}

/** The KB entity id the figure links are keyed on.
 *
 *  A node carries several native ids -- a USGS province and an ATLAS basin are
 *  one place here, so both are kept (see the gazetteer's sameAs handling). The
 *  figure registry links on the BASIN id specifically, so pick that one rather
 *  than whichever happens to be first. Returns undefined when the node has no
 *  basin identity, and the caller omits the artifact instead of mounting it
 *  empty. */
const kbBasinId = (node: GazIndexed): string | undefined =>
  (node.nativeIds ?? []).find((id) => id.startsWith('atlas:basin:'));

/** Set scope at the level this node fills, letting the brain fill ancestors. */
function scopeTo(node: GazIndexed): AgentCommand[] {
  const level = levelForKind(node.kind);
  // reroot: an utterance names a subject, it does not add a constraint to the
  // previous one. Without it, "kutei basin" then "volve" leaves the app holding
  // both and reporting that Volve is not in Kutei — technically true, useless.
  return level ? [{ op: 'scope', patch: { [level]: toRef(node) }, autofill: true, reroot: true }] : [];
}

function flyTo(node: GazIndexed): AgentCommand[] {
  return node.fly ? [{ op: 'map', map: { ...node.fly, highlight: node.id, label: node.name } }] : [];
}

const view = (nav: string, rest: Record<string, unknown> = {}): AgentCommand => ({ op: 'view', view: { nav, ...rest } as never });

// ── shared card pieces ───────────────────────────────────────────────────────

function resourceFacts(node: GazIndexed): CardFact[] {
  const m = node.metrics ?? {};
  const out: CardFact[] = [];
  if (m.oilMean_mmbbl != null) out.push({ label: 'Undiscovered oil (mean)', value: `${num(m.oilMean_mmbbl)} MMbbl`, source: 'USGS DDS-69' });
  if (m.gasMean_bcf != null) out.push({ label: 'Undiscovered gas (mean)', value: `${num(m.gasMean_bcf)} Bcf`, source: 'USGS DDS-69' });
  if (m.boeMean_mmboe != null) out.push({ label: 'Undiscovered total (mean)', value: `${num(m.boeMean_mmboe)} MMBOE`, source: 'USGS DDS-69' });
  return out;
}

/** The countries that hold a basin, with their membership share. A province is a
 *  container that crosses borders — never rendered as if one country owned it. */
function countryShareFacts(node: GazIndexed, ctx: CapCtx): CardFact[] {
  const edges = (node.parents ?? []).filter((p) => p.kind === 'country');
  if (!edges.length) return [];
  const total = edges.reduce((s, e) => s + (e.weight ?? 0), 0) || 1;
  const parts = edges
    .slice()
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .map((e) => {
      const name = ctx.index.byId.get(e.id)?.name ?? e.id;
      return `${name} ${Math.round(((e.weight ?? 0) / total) * 100)}%`;
    });
  return [{
    label: edges.length === 1 ? 'Country' : `Shared by ${edges.length} countries`,
    value: parts.join(' · '),
    note: 'Share of known fields, not a boundary — a basin legitimately crosses borders.',
  }];
}

// ── the registry ─────────────────────────────────────────────────────────────

export const CAPABILITIES: Capability[] = [
  // ── map ────────────────────────────────────────────────────────────────────
  {
    id: 'map.fly',
    label: 'Show on the map',
    shape: 'action',
    kinds: ['region', 'country', 'basin', 'petroleum-system', 'assessment-unit', 'field', 'wellbore'],
    phrases: ['show on map', 'on the map', 'map', 'fly to', 'go to', 'take me to', 'zoom to', 'locate', 'where is'],
    weight: 40,
    probe: (n) => !!n.fly,
    absence: (n) => `I have no coordinates for ${n.name}, so I cannot place it on the map.`,
    plan: (n) => [view('cockpit'), ...flyTo(n), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: n.displayName,
      subhead: 'Located on the cockpit map',
      facts: [
        { label: 'Position', value: `${n.fly!.lat.toFixed(3)}°, ${n.fly!.lon.toFixed(3)}°`, source: n.sources[0] },
        ...(n.bbox ? [{ label: 'Extent', value: `${(n.bbox[2] - n.bbox[0]).toFixed(1)}° × ${(n.bbox[3] - n.bbox[1]).toFixed(1)}°`, source: n.sources[0], note: 'Screening-scale geometry (~1:5,000,000).' }] : []),
      ],
      chips: alsoAvailable(n, 'map.fly'),
      provenance: prov(n),
    }),
  },

  // ── region ─────────────────────────────────────────────────────────────────
  {
    id: 'region.overview',
    label: 'Region overview',
    shape: 'brief',
    kinds: ['region'],
    phrases: ['overview', 'insight', 'brief', 'tell me about', 'summary', 'about'],
    weight: 90,
    probe: (n) => asNumber(n.has.basins) > 0,
    absence: (n) => `${n.name} has no assessed provinces on record.`,
    plan: (n) => scopeTo(n),
    card: (n, ctx) => {
      const countries = childrenOfKind(ctx.index, n.id, 'country');
      return {
        kind: 'brief',
        headline: n.displayName,
        subhead: 'USGS assessment region',
        facts: [
          { label: 'Basins', value: plural(asNumber(n.has.basins), 'basin'), source: 'USGS DDS-69' },
          { label: 'Countries with known fields', value: num(countries.length), source: 'derived' },
        ],
        chips: nodeChips(countries, 10).length ? nodeChips(countries, 10) : alsoAvailable(n, ''),
        provenance: prov(n),
        body: `${n.name} holds ${plural(asNumber(n.has.basins), 'assessed province')}. Pick a country to narrow.`,
      };
    },
  },

  // ── country ────────────────────────────────────────────────────────────────
  {
    id: 'country.overview',
    label: 'Country overview',
    shape: 'brief',
    kinds: ['country'],
    phrases: ['overview', 'insight', 'brief', 'tell me about', 'summary', 'about', 'what do you have on'],
    weight: 100,
    probe: (n) => asNumber(n.has.basins) > 0 || asNumber(n.has.fields) > 0,
    absence: (n) => `I have ${n.name} as a country, but no basin or field records for it in the USGS/GOGET baseline.`,
    plan: (n) => [view('cockpit'), ...flyTo(n), ...scopeTo(n)],
    card: (n, ctx) => {
      const basins = childrenOfKind(ctx.index, n.id, 'basin');
      const region = (n.parents ?? []).find((p) => p.kind === 'region');
      return {
        kind: 'brief',
        headline: n.name,
        subhead: `${plural(basins.length, 'basin')} · ${plural(asNumber(n.has.fields), 'field')}`,
        facts: [
          { label: 'Basins with known fields', value: num(basins.length), source: 'derived', note: 'Country ⇄ basin is derived from member-field country tags; the source data publishes no such link.' },
          { label: 'Fields on record', value: num(asNumber(n.has.fields)), source: 'GOGET' },
          ...(region ? [{ label: 'USGS region', value: ctx.index.byId.get(region.id)?.name ?? '—', source: 'USGS' }] : []),
        ],
        chips: nodeChips(basins, 12),
        provenance: prov(n, 'derived crosswalk'),
        // The Indonesia caveat, stated every time rather than once in a footnote.
        body: `${basins.length} ${basins.length === 1 ? 'basin holds' : 'basins hold'} known fields in ${n.name} — that is the USGS/GOGET baseline, not the national basin count, which is usually higher. Which basin?`,
      };
    },
  },
  {
    id: 'country.basins',
    label: 'Basins in this country',
    kinds: ['country'],
    shape: 'list',
    phrases: ['basins', 'list basins', 'which basins', 'show basins', 'what basins', 'provinces'],
    weight: 80,
    probe: (n) => asNumber(n.has.basins) > 0,
    absence: (n) => `No basin holds a known field in ${n.name} in the USGS/GOGET baseline.`,
    plan: (n) => [view('cockpit'), ...flyTo(n), ...scopeTo(n)],
    card: (n, ctx) => {
      const basins = childrenOfKind(ctx.index, n.id, 'basin');
      return {
        kind: 'list',
        headline: `Basins in ${n.name}`,
        subhead: plural(basins.length, 'basin with known fields', 'basins with known fields'),
        facts: basins.map((b) => ({
          label: b.name,
          value: `${plural(asNumber(b.has.fields), 'field')}${asNumber(b.has.petroleumSystems) ? ` · ${plural(asNumber(b.has.petroleumSystems), 'petroleum system')}` : ''}`,
          source: 'derived crosswalk',
        })),
        chips: nodeChips(basins, 12),
        provenance: prov(n, 'USGS', 'derived crosswalk'),
        body: `Derived from member-field country tags — the source data publishes no country ⇄ basin link. This is the USGS baseline, not the national basin count.`,
      };
    },
  },
  {
    id: 'country.fields',
    label: 'Fields in this country',
    shape: 'list',
    kinds: ['country'],
    phrases: ['fields', 'list fields', 'which fields', 'show fields', 'what fields'],
    weight: 60,
    probe: (n) => asNumber(n.has.fields) > 0,
    absence: (n) => `No field records for ${n.name} in the GOGET baseline.`,
    plan: (n) => [view('cockpit'), ...flyTo(n), ...scopeTo(n)],
    card: (n, ctx) => {
      const fields = childrenOfKind(ctx.index, n.id, 'field');
      return {
        kind: 'list',
        headline: `Fields in ${n.name}`,
        subhead: plural(fields.length, 'field on record'),
        facts: fields.slice(0, 10).map((f) => ({
          label: f.name,
          value: [asBool(f.has.production) ? 'production' : null, asBool(f.has.reserves) ? 'reserves' : null].filter(Boolean).join(' · ') || 'record only',
          source: f.sources[0],
        })),
        chips: nodeChips(fields, 10),
        provenance: prov(n, 'GOGET'),
        body: fields.length > 10 ? `Showing the 10 best-documented of ${num(fields.length)}.` : undefined,
      };
    },
  },

  // ── basin ──────────────────────────────────────────────────────────────────
  {
    id: 'basin.dossier',
    label: 'Basin dossier',
    shape: 'brief',
    kinds: ['basin'],
    phrases: ['overview', 'insight', 'brief', 'tell me about', 'summary', 'about', 'dossier', 'screening', 'what do you have on'],
    weight: 100,
    probe: () => true,
    plan: (n) => [view('exploration', { mode: 'knowledge' }), ...scopeTo(n), ...flyTo(n)],
    card: (n, ctx) => {
      const fields = childrenOfKind(ctx.index, n.id, 'field');
      const completion = asNumber(n.has.completionPct);
      return {
        kind: 'brief',
        headline: n.displayName,
        subhead: 'Basin dossier — screening scale',
        facts: [
          ...countryShareFacts(n, ctx),
          { label: 'Known fields', value: num(asNumber(n.has.fields)), source: 'GOGET ∩ USGS polygon' },
          { label: 'Petroleum systems', value: num(asNumber(n.has.petroleumSystems)), source: 'USGS' },
          { label: 'Assessment units', value: num(asNumber(n.has.assessmentUnits)), source: 'USGS' },
          ...(asNumber(n.has.cycles) ? [{ label: 'Basin cycles', value: num(asNumber(n.has.cycles)), source: 'Arganta KB' }] : []),
          ...resourceFacts(n),
          { label: 'KB completion', value: `${Math.round(completion * 100)}%`, source: 'Arganta KB', note: completion < 1 ? 'Framework still being evidenced.' : undefined },
        ],
        chips: [
          ...nodeChips(fields, 6),
          ...(asNumber(n.has.openFigures) ? [chip('Figures', `figures for ${n.name}`, undefined, asNumber(n.has.openFigures))] : []),
          ...(asNumber(n.has.petroleumSystems) ? [chip('Petroleum systems', `petroleum systems in ${n.name}`, undefined, asNumber(n.has.petroleumSystems))] : []),
        ],
        provenance: prov(n),
        body: fields.length
          ? `${plural(fields.length, 'field')} on record here. Which field?`
          : 'No field records fall inside this province polygon — it is an assessed container with nothing drilled in the public baseline.',
      };
    },
  },
  {
    id: 'basin.fields',
    label: 'Fields in this basin',
    shape: 'list',
    kinds: ['basin', 'assessment-unit'],
    phrases: ['fields', 'list fields', 'which fields', 'show fields', 'what fields', 'discoveries'],
    weight: 70,
    probe: (n) => asNumber(n.has.fields) > 0,
    absence: (n) => `No field centroid falls inside ${n.name}. The province is assessed, but nothing in the public baseline sits in it.`,
    plan: (n) => [view('exploration', { mode: 'knowledge' }), ...scopeTo(n), ...flyTo(n)],
    card: (n, ctx) => {
      const fields = childrenOfKind(ctx.index, n.id, 'field');
      return {
        kind: 'list',
        headline: `Fields in ${n.name}`,
        subhead: plural(fields.length, 'field'),
        facts: fields.slice(0, 12).map((f) => ({
          label: f.name,
          value: [asBool(f.has.production) ? 'production' : null, asBool(f.has.bundle) ? 'well bundle' : null].filter(Boolean).join(' · ') || 'record only',
          source: f.sources[0],
        })),
        chips: nodeChips(fields, 12),
        provenance: prov(n, 'GOGET'),
      };
    },
  },
  {
    id: 'basin.figures',
    label: 'Basin figures',
    shape: 'action',
    kinds: ['basin'],
    phrases: ['figures', 'maps', 'cross sections', 'diagrams', 'illustrations', 'plates'],
    weight: 55,
    probe: (n) => asNumber(n.has.openFigures) > 0,
    absence: (n) => `No public-domain figures are catalogued for ${n.name}.`,
    plan: (n) => [view('exploration', { mode: 'knowledge', modal: 'figures' }), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: `Figures — ${n.name}`,
      subhead: plural(asNumber(n.has.openFigures), 'public-domain figure'),
      facts: [
        { label: 'Open figures', value: num(asNumber(n.has.openFigures)), source: 'USGS (public domain)' },
        ...(asNumber(n.has.figures) > asNumber(n.has.openFigures)
          ? [{ label: 'Rights-restricted', value: num(asNumber(n.has.figures) - asNumber(n.has.openFigures)), note: 'Held back — third-party rightsholder.' }]
          : []),
      ],
      chips: alsoAvailable(n, 'basin.figures'),
      provenance: prov(n),
      // The figures themselves, in the answer. Telling a reader a basin has 5
      // public-domain figures and then not showing them is the half-answer this
      // artifact exists to close. `nativeId` is the KB entity the figure links
      // are keyed on; without it there is nothing to look up, so the artifact is
      // simply omitted rather than mounted empty.
      ...(kbBasinId(n) ? {
        artifact: { component: 'basin-figures', props: { entityId: kbBasinId(n), name: n.name } },
      } : {}),
    }),
  },
  {
    id: 'basin.petroleumSystems',
    label: 'Petroleum systems',
    shape: 'list',
    kinds: ['basin'],
    phrases: ['petroleum systems', 'petroleum system', 'tps', 'total petroleum system', 'source rock', 'charge'],
    weight: 60,
    probe: (n) => asNumber(n.has.petroleumSystems) > 0,
    absence: (n) => `${n.name} has no total petroleum system defined in DDS-69 — only 128 of the world's provinces were ever populated with TPS detail.`,
    plan: (n) => [view('exploration', { mode: 'knowledge' }), ...scopeTo(n)],
    card: (n, ctx) => {
      const systems = childrenOfKind(ctx.index, n.id, 'petroleum-system');
      return {
        kind: 'list',
        headline: `Petroleum systems — ${n.name}`,
        subhead: plural(systems.length, 'total petroleum system'),
        facts: systems.map((s) => ({
          label: s.name,
          value: `${plural(asNumber(s.has.assessmentUnits), 'assessment unit')}${asBool(s.has.sourceRock) ? ' · source rock named' : ''}`,
          source: 'USGS',
        })),
        chips: nodeChips(systems, 8).length ? nodeChips(systems, 8) : alsoAvailable(n, ''),
        provenance: prov(n),
      };
    },
  },
  {
    id: 'basin.assessmentUnits',
    label: 'Assessment units',
    shape: 'list',
    kinds: ['basin', 'petroleum-system'],
    phrases: ['assessment units', 'assessment unit', 'aus', 'au'],
    weight: 50,
    probe: (n) => asNumber(n.has.assessmentUnits) > 0,
    absence: (n) => `No assessment units are defined for ${n.name}.`,
    plan: (n) => [view('exploration', { mode: 'knowledge' }), ...scopeTo(n)],
    card: (n, ctx) => {
      const direct = childrenOfKind(ctx.index, n.id, 'assessment-unit');
      return {
        kind: 'list',
        headline: `Assessment units — ${n.name}`,
        subhead: plural(direct.length, 'assessment unit'),
        facts: direct.map((a) => ({
          label: a.name,
          value: asBool(a.has.assessed) ? 'assessed' : 'not assessed',
          source: 'USGS',
          note: asBool(a.has.assessed) ? undefined : 'Not assessed is not the same as zero.',
        })),
        chips: nodeChips(direct, 10).length ? nodeChips(direct, 10) : alsoAvailable(n, ''),
        provenance: prov(n),
      };
    },
  },
  {
    id: 'basin.cycles',
    label: 'Basin cycles',
    shape: 'list',
    kinds: ['basin'],
    phrases: ['cycles', 'basin cycles', 'tectonic history', 'evolution', 'stratigraphy', 'burial history'],
    weight: 55,
    probe: (n) => asNumber(n.has.cycles) > 0,
    absence: (n) => `${n.name} has no basin-cycle framework in the Knowledge Bank yet.`,
    plan: (n) => [view('exploration', { mode: 'knowledge', modal: 'cycles' }), ...scopeTo(n)],
    card: (n, ctx) => {
      const cycles = childrenOfKind(ctx.index, n.id, 'basin-cycle');
      return {
        kind: 'list',
        headline: `Basin cycles — ${n.name}`,
        subhead: plural(cycles.length, 'cycle'),
        facts: cycles.map((c) => ({
          label: c.name,
          value: c.metrics?.ageTopMa != null ? `${num(c.metrics.ageTopMa, 1)}–${num(c.metrics.ageBaseMa, 1)} Ma` : 'untimed',
          source: 'Arganta KB',
          note: asBool(c.has.cited) ? undefined : 'Interpreted, not yet cited.',
        })),
        chips: alsoAvailable(n, 'basin.cycles'),
        provenance: prov(n, 'Arganta KB'),
      };
    },
  },
  {
    id: 'basin.analogs',
    label: 'Analogue basins',
    shape: 'action',
    kinds: ['basin'],
    phrases: ['analogs', 'analogues', 'analog basins', 'similar basins', 'comparable', 'peers', 'benchmark'],
    weight: 45,
    probe: (n) => asNumber(n.has.cycles) > 0,
    absence: (n) => `Analogue matching runs on cycle signature, and ${n.name} has no cycle framework yet.`,
    plan: (n) => [view('exploration', { mode: 'workspace', sub: 'basin-analogs' }), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: `Analogues — ${n.name}`,
      subhead: 'Cycle-signature matching',
      facts: [{ label: 'Cycles available to match on', value: num(asNumber(n.has.cycles)), source: 'Arganta KB' }],
      chips: alsoAvailable(n, 'basin.analogs'),
      provenance: prov(n),
      body: 'Opened the Basin Analog Library. Matching is by geodynamic context and cycle signature, not hidden similarity.',
    }),
  },

  // ── petroleum system / assessment unit ─────────────────────────────────────
  {
    id: 'ps.overview',
    label: 'Petroleum system',
    shape: 'brief',
    kinds: ['petroleum-system'],
    phrases: ['overview', 'insight', 'brief', 'tell me about', 'summary', 'about'],
    weight: 100,
    probe: () => true,
    plan: (n) => [view('exploration', { mode: 'knowledge' }), ...scopeTo(n)],
    card: (n, ctx) => ({
      kind: 'brief',
      headline: n.displayName,
      subhead: 'Total petroleum system',
      facts: [
        { label: 'Assessment units', value: num(asNumber(n.has.assessmentUnits)), source: 'USGS' },
        { label: 'Modelled', value: asNumber(n.has.psModels) ? `${num(asNumber(n.has.psModels))} model(s)` : 'not modelled', source: 'Arganta KB' },
        { label: 'Source rock named', value: asBool(n.has.sourceRock) ? 'yes' : 'no', source: 'USGS' },
      ],
      chips: nodeChips(childrenOfKind(ctx.index, n.id, 'assessment-unit'), 8),
      provenance: prov(n),
    }),
  },
  {
    id: 'au.overview',
    label: 'Assessment unit',
    shape: 'brief',
    kinds: ['assessment-unit'],
    phrases: ['overview', 'insight', 'brief', 'tell me about', 'summary', 'about'],
    weight: 100,
    probe: () => true,
    plan: (n) => [view('exploration', { mode: 'knowledge' }), ...scopeTo(n), ...flyTo(n)],
    card: (n, ctx) => {
      const twin = (n.sameAs ?? []).map((id) => ctx.index.byId.get(id)).find(Boolean);
      return {
        kind: 'brief',
        headline: n.displayName,
        subhead: 'USGS assessment unit',
        facts: [
          { label: 'Status', value: asBool(n.has.assessed) ? 'assessed' : 'not assessed', source: 'USGS', note: asBool(n.has.assessed) ? undefined : 'Not assessed ≠ zero resource.' },
          { label: 'Fields inside', value: num(asNumber(n.has.fields)), source: 'GOGET ∩ USGS polygon' },
          ...resourceFacts(n),
        ],
        // An AU without a basin twin still needs a way onward — a correct answer
        // you cannot navigate from is a dead end however correct it is.
        chips: twin
          ? [chip(`${twin.name} (basin)`, twin.name, 'The same geography one tier up'), ...alsoAvailable(n, 'au.overview', 3)]
          : alsoAvailable(n, 'au.overview'),
        provenance: prov(n),
        body: twin ? `${n.name} also exists as a basin in the Knowledge Bank — I answered at the assessment-unit tier.` : undefined,
      };
    },
  },

  // ── field ──────────────────────────────────────────────────────────────────
  {
    id: 'field.dossier',
    label: 'Field dossier',
    shape: 'brief',
    kinds: ['field'],
    phrases: ['overview', 'insight', 'brief', 'tell me about', 'summary', 'about', 'dossier', 'what do you have on'],
    weight: 100,
    probe: () => true,
    plan: (n) => [view('field-development', { mode: 'knowledge' }), ...scopeTo(n), ...flyTo(n)],
    card: (n, ctx) => {
      const basin = (n.parents ?? []).find((p) => p.kind === 'basin');
      const country = (n.parents ?? []).find((p) => p.kind === 'country');
      const available = CAPABILITIES.filter((c) => c.kinds.includes('field') && c.id !== 'field.dossier' && c.probe(n));
      return {
        kind: 'brief',
        headline: n.name,
        subhead: 'Field dossier',
        facts: [
          ...(country ? [{ label: 'Country', value: ctx.index.byId.get(country.id)?.name ?? '—', source: n.sources[0] }] : []),
          ...(basin ? [{ label: 'Basin', value: ctx.index.byId.get(basin.id)?.name ?? '—', source: 'USGS polygon', note: 'Assigned by centroid, screening scale.' }] : []),
          { label: 'Production data', value: asBool(n.has.production) ? 'yes' : 'no', source: asBool(n.has.bundle) ? 'Volve bundle' : 'GOGET' },
          { label: 'Reserves data', value: asBool(n.has.reserves) ? 'yes' : 'no', source: 'GOGET' },
          ...(asBool(n.has.bundle)
            ? [{ label: 'Well bundle', value: `${plural(asNumber(n.has.wells), 'well')} · logs, trajectory, pressure, drilling`, source: 'Volve' }]
            : []),
        ],
        chips: available.map((c) => chip(c.label, `${c.phrases[0]} for ${n.name}`)),
        provenance: prov(n),
        body: asBool(n.has.bundle)
          ? 'This is the one field with a full well bundle — logs, trajectories, pressures and drilling are all real here.'
          : 'Field-level records only: no well logs, trajectories or pressures exist for this field in the public baseline.',
      };
    },
  },
  {
    id: 'field.production',
    label: 'Production',
    shape: 'action',
    kinds: ['field'],
    phrases: ['production', 'produced', 'output', 'rates', 'production history', 'production data'],
    weight: 80,
    probe: (n) => asBool(n.has.production),
    absence: (n, ctx) => {
      const bundled = ctx.index.byKind.get('field')?.find((f) => asBool(f.has.bundle));
      return `No production record for ${n.name}.${bundled ? ` ${bundled.name} is the only field with a full production history — want that instead?` : ''}`;
    },
    plan: (n) => (asBool(n.has.bundle)
      ? [view('reservoir-management', { mode: 'knowledge' }), ...scopeTo(n)]
      : [view('field-development', { mode: 'knowledge' }), ...scopeTo(n)]),
    card: (n) => ({
      kind: 'brief',
      headline: `Production — ${n.name}`,
      subhead: asBool(n.has.bundle) ? 'Full history from the Volve bundle' : 'Annual figures from the GOGET record',
      facts: [
        { label: 'Production data', value: 'available', source: asBool(n.has.bundle) ? 'Volve · Sodir' : 'GOGET' },
        ...(asBool(n.has.bundle) ? [{ label: 'Wells with production', value: 'see surveillance dossier', source: 'Volve' }] : []),
      ],
      chips: alsoAvailable(n, 'field.production'),
      provenance: prov(n),
      body: asBool(n.has.bundle) ? undefined
        : 'GOGET carries annual field totals only — not well-level rates.',
    }),
  },
  {
    id: 'field.reserves',
    label: 'Reserves',
    shape: 'action',
    kinds: ['field'],
    phrases: ['reserves', 'stoiip', 'volumes', 'in place', 'recoverable', 'resource'],
    weight: 75,
    probe: (n) => asBool(n.has.reserves),
    absence: (n) => `No reserves entry for ${n.name} in the GOGET record.`,
    plan: (n) => [view('field-development', { mode: 'knowledge' }), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: `Reserves — ${n.name}`,
      subhead: 'Reported volumes',
      facts: [{ label: 'Reserves record', value: 'available', source: 'GOGET' }],
      chips: alsoAvailable(n, 'field.reserves'),
      provenance: prov(n),
      body: 'Reported volumes vary by vintage and classification; the dossier shows the basis for each figure.',
    }),
  },
  {
    id: 'field.qc',
    label: 'Data QC',
    shape: 'action',
    kinds: ['field'],
    phrases: ['qc', 'data qc', 'quality', 'data quality', 'audit', 'coverage', 'completeness'],
    weight: 50,
    probe: (n) => asBool(n.has.bundle),
    absence: (n) => `Data QC runs over an ingested well bundle. ${n.name} has none — only a field-level record.`,
    plan: (n) => [view('field-development', { sub: 'client-data-qc', mode: 'workspace' }), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: `Data QC — ${n.name}`,
      subhead: `${plural(asNumber(n.has.wells), 'well')} · ${plural(asNumber(n.has.surfaces), 'surface')}`,
      facts: [
        { label: 'Wells', value: num(asNumber(n.has.wells)), source: 'Volve' },
        { label: 'Surfaces', value: num(asNumber(n.has.surfaces)), source: 'Volve' },
        { label: 'Logs', value: asBool(n.has.logs) ? 'present' : 'absent', source: 'Volve' },
        { label: 'Trajectories', value: asBool(n.has.trajectory) ? 'present' : 'absent', source: 'Volve' },
        { label: 'Pressure', value: asBool(n.has.pressure) ? 'present' : 'absent', source: 'Volve' },
        { label: 'Drilling', value: asBool(n.has.drilling) ? 'present' : 'absent', source: 'Volve' },
      ],
      chips: alsoAvailable(n, 'field.qc'),
      provenance: prov(n),
    }),
  },
  {
    id: 'field.wells',
    label: 'Wells',
    shape: 'list',
    kinds: ['field'],
    phrases: ['wells', 'wellbores', 'list wells', 'which wells', 'how many wells'],
    weight: 65,
    probe: (n) => asNumber(n.has.wells) > 0,
    absence: (n) => `No wells are attached to ${n.name}. Well records exist only for the field carrying the ingested bundle.`,
    plan: (n) => [view('field-development', { mode: 'knowledge' }), ...scopeTo(n)],
    card: (n, ctx) => {
      const wells = childrenOfKind(ctx.index, n.id, 'well');
      return {
        kind: 'list',
        headline: `Wells — ${n.name}`,
        subhead: plural(wells.length, 'well'),
        facts: wells.slice(0, 12).map((w) => ({
          label: w.name,
          value: ['logs', 'trajectory', 'picks', 'pressure', 'drilling'].filter((k) => asBool(w.has[k])).join(' · ') || 'no data',
          source: 'Volve',
        })),
        chips: nodeChips(wells, 10),
        provenance: prov(n, 'Volve'),
      };
    },
  },
  {
    id: 'field.surveillance',
    label: 'Surveillance',
    shape: 'action',
    kinds: ['field'],
    phrases: ['surveillance', 'monitoring', 'reservoir management', 'performance', 'watercut', 'decline'],
    weight: 55,
    probe: (n) => asBool(n.has.bundle),
    absence: (n) => `Surveillance needs well-level production and pressure. ${n.name} has neither.`,
    plan: (n) => [view('reservoir-management', { mode: 'knowledge' }), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: `Surveillance — ${n.name}`,
      subhead: 'Surveillance dossier',
      facts: [
        { label: 'Wells', value: num(asNumber(n.has.wells)), source: 'Volve' },
        { label: 'Pressure data', value: asBool(n.has.pressure) ? 'present' : 'absent', source: 'Volve' },
      ],
      chips: alsoAvailable(n, 'field.surveillance'),
      provenance: prov(n),
    }),
  },

  // ── wells ──────────────────────────────────────────────────────────────────
  {
    id: 'well.logs',
    label: 'Well logs',
    shape: 'action',
    kinds: ['well', 'wellbore', 'field'],
    phrases: ['logs', 'log', 'well logs', 'wireline', 'lwd', 'gamma', 'petrophysics', 'curves'],
    weight: 90,
    probe: (n) => asBool(n.has.logs),
    absence: (n, ctx) => {
      const withLogs = (ctx.index.byKind.get('well') ?? []).filter((w) => asBool(w.has.logs));
      const bundled = (ctx.index.byKind.get('field') ?? []).find((f) => f.has.bundle);
      return `No well logs for ${n.name}.${withLogs.length ? ` Only the ${withLogs.length} wells of the ${bundled ? bundled.name : 'ingested'} bundle carry log data — everything else in the catalogue is a registry entry.` : ' No well in the catalogue has log data.'}`;
    },
    plan: (n) => [view('field-development', { legacyTab: 'logs' }), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: `Logs — ${n.name}`,
      subhead: 'Wireline / LWD curves',
      facts: [
        { label: 'Logs', value: 'available', source: 'Volve' },
        ...(n.metrics?.tdMd != null ? [{ label: 'TD (MD)', value: `${num(n.metrics.tdMd)} m`, source: 'Sodir' }] : []),
      ],
      chips: alsoAvailable(n, 'well.logs'),
      provenance: prov(n),
    }),
  },
  {
    id: 'well.trajectory',
    label: 'Trajectory',
    shape: 'action',
    kinds: ['well', 'wellbore', 'field'],
    phrases: ['trajectory', 'deviation', 'survey', 'well path', 'path'],
    weight: 70,
    probe: (n) => asBool(n.has.trajectory),
    absence: (n) => `No directional survey for ${n.name}.`,
    plan: (n) => [view('field-development', { sub: 'client-data-qc', mode: 'workspace' }), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: `Trajectory — ${n.name}`,
      subhead: 'Directional survey',
      facts: [
        { label: 'Survey', value: 'available', source: 'Volve' },
        ...(n.metrics?.tdTvd != null ? [{ label: 'TD (TVD)', value: `${num(n.metrics.tdTvd)} m`, source: 'Sodir' }] : []),
      ],
      chips: alsoAvailable(n, 'well.trajectory'),
      provenance: prov(n),
      // The survey itself, drawn in the answer. Gated on has.traj -- the same
      // measured flag the probe uses -- so a well with no published survey gets
      // the card and no empty plot.
      ...(asBool(n.has.traj) ? {
        artifact: { component: 'well-trajectory', props: { well: n.name, name: `Well path — ${n.name}` } },
      } : {})
    }),
  },
  {
    id: 'well.pressure',
    label: 'Pressure',
    shape: 'action',
    kinds: ['well', 'wellbore', 'field'],
    phrases: ['pressure', 'rft', 'mdt', 'formation pressure', 'pressure data'],
    weight: 65,
    probe: (n) => asBool(n.has.pressure),
    absence: (n) => `No formation-pressure record for ${n.name}.`,
    plan: (n) => [view('reservoir-management', { mode: 'knowledge' }), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: `Pressure — ${n.name}`,
      subhead: 'Formation pressure',
      facts: [{ label: 'Pressure data', value: 'available', source: 'Volve' }],
      chips: alsoAvailable(n, 'well.pressure'),
      provenance: prov(n),
    }),
  },
  {
    id: 'well.drilling',
    label: 'Drilling',
    shape: 'action',
    kinds: ['well', 'wellbore', 'field'],
    phrases: ['drilling', 'drilling data', 'mud weight', 'ecd', 'rop', 'wob', 'witsml'],
    weight: 60,
    probe: (n) => asBool(n.has.drilling),
    absence: (n) => `No real-time drilling record for ${n.name}.`,
    plan: (n) => [view('drilling-sequence', { mode: 'workspace' }), ...scopeTo(n)],
    card: (n) => ({
      kind: 'brief',
      headline: `Drilling — ${n.name}`,
      subhead: 'MW · ECD · ROP · WOB',
      facts: [{ label: 'Drilling data', value: 'available', source: 'Volve WITSML' }],
      chips: alsoAvailable(n, 'well.drilling'),
      provenance: prov(n),
    }),
  },
  {
    id: 'well.overview',
    label: 'Well overview',
    shape: 'brief',
    kinds: ['well', 'wellbore'],
    phrases: ['overview', 'insight', 'brief', 'tell me about', 'summary', 'about'],
    weight: 100,
    probe: () => true,
    plan: (n) => [...(n.fly ? [view('cockpit')] : [view('field-development', { mode: 'knowledge' })]), ...flyTo(n), ...scopeTo(n)],
    card: (n) => {
      const present = ['logs', 'trajectory', 'picks', 'pressure', 'drilling', 'production'].filter((k) => asBool(n.has[k]));
      return {
        kind: 'brief',
        headline: n.displayName,
        subhead: present.length ? `Data: ${present.join(' · ')}` : 'Name and location only',
        facts: [
          ...(n.metrics?.tdMd != null ? [{ label: 'TD (MD)', value: `${num(n.metrics.tdMd)} m`, source: 'Sodir' }] : []),
          { label: 'Data bundle', value: asBool(n.has.bundle) ? 'ingested' : 'none', source: n.sources[0] },
        ],
        chips: present.map((k) => chip(k, `${k} for ${n.name}`)),
        provenance: prov(n),
        body: present.length ? undefined
          : 'This wellbore is a registry entry — a name and a surface location. No curves, surveys or pressures were ever ingested for it.',
      };
    },
  },

  // ── formation / company ────────────────────────────────────────────────────
  {
    id: 'formation.overview',
    label: 'Formation',
    shape: 'brief',
    kinds: ['formation'],
    phrases: ['overview', 'insight', 'brief', 'tell me about', 'summary', 'about', 'formation'],
    weight: 100,
    probe: () => true,
    plan: () => [view('exploration', { mode: 'knowledge' })],
    card: (n, ctx) => {
      const basins = (n.parents ?? []).map((p) => ctx.index.byId.get(p.id)).filter(Boolean) as GazIndexed[];
      return {
        kind: 'brief',
        headline: n.name,
        subhead: 'Stratigraphic unit',
        facts: [
          { label: 'Occurs in', value: plural(basins.length, 'basin'), source: 'Arganta KB' },
          { label: 'Occurrences', value: num(asNumber(n.has.occurrences)), source: 'Arganta KB' },
          ...(n.aliases.length ? [{ label: 'Also written', value: n.aliases.slice(0, 4).join(' · ') }] : []),
        ],
        chips: nodeChips(basins, 8).length ? nodeChips(basins, 8) : alsoAvailable(n, ''),
        provenance: prov(n),
      };
    },
  },
  {
    id: 'company.overview',
    label: 'Company',
    shape: 'brief',
    kinds: ['company'],
    phrases: ['overview', 'insight', 'brief', 'tell me about', 'summary', 'about', 'operator'],
    weight: 100,
    probe: () => true,
    plan: () => [],
    card: (n) => ({
      kind: 'brief',
      headline: n.name,
      subhead: 'Organisation',
      facts: [{ label: 'Source', value: n.sources.join(' · ') }],
      chips: alsoAvailable(n, 'company.overview'),
      provenance: prov(n),
      body: 'I hold this company as a registry entry. Operated-asset roll-ups are not built yet, so I cannot list its fields.',
    }),
  },

  // ── the universal fallback ─────────────────────────────────────────────────
  {
    id: 'data.availability',
    label: 'What I have',
    shape: 'menu',
    kinds: ['region', 'country', 'basin', 'petroleum-system', 'assessment-unit', 'basin-cycle', 'field', 'well', 'wellbore', 'company', 'formation'],
    phrases: ['what do you have', 'what can you show', 'what is available', 'data', 'availability', 'coverage', 'help'],
    weight: 10,
    probe: () => true,
    plan: () => [],
    card: (n, ctx) => {
      const usable = capabilitiesFor(n, ctx).filter((c) => c.id !== 'data.availability');
      const missing = CAPABILITIES.filter((c) => c.kinds.includes(n.kind) && !c.probe(n));
      return {
        kind: 'menu',
        headline: `${n.displayName}`,
        subhead: `${plural(usable.length, 'thing')} I can show you`,
        facts: missing.slice(0, 5).map((c) => ({
          label: c.label,
          value: 'not available',
          note: c.absence?.(n, ctx) ?? 'No data.',
        })),
        chips: usable.map((c) => chip(c.label, `${c.phrases[0]} for ${n.name}`)),
        provenance: prov(n),
      };
    },
  },
];

// ── registry helpers ─────────────────────────────────────────────────────────

export const CAPABILITY_BY_ID = new Map(CAPABILITIES.map((c) => [c.id, c]));

/** Capabilities that apply to this node AND whose data is actually present. */
export function capabilitiesFor(node: GazIndexed, _ctx: CapCtx): Capability[] {
  return CAPABILITIES
    .filter((c) => c.kinds.includes(node.kind) && c.probe(node))
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0));
}

/** The one to run for a bare entity query ("kutei basin"). */
export function defaultCapability(node: GazIndexed, ctx: CapCtx): Capability | null {
  return capabilitiesFor(node, ctx)[0] ?? null;
}

/** Capability ids to stamp on an indexed node at load. */
export function capabilityIdsFor(node: GazIndexed, ctx: CapCtx): string[] {
  return capabilitiesFor(node, ctx).map((c) => c.id);
}

/** Build the reasoned-absence card for a capability whose probe failed. */
export function absenceCard(capability: Capability, node: GazIndexed, ctx: CapCtx): AnswerCard {
  const alternatives = capabilitiesFor(node, ctx).filter((c) => c.id !== 'data.availability');
  return {
    kind: 'absence',
    headline: `${capability.label} — not available for ${node.name}`,
    facts: [],
    chips: alternatives.slice(0, 6).map((c) => chip(c.label, `${c.phrases[0]} for ${node.name}`)),
    provenance: prov(node),
    body: capability.absence?.(node, ctx) ?? `${node.name} has no ${capability.label.toLowerCase()} data.`,
  };
}

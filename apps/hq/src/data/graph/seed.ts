// The seed graph — the ~61 product surfaces + levers + value spine + guardrail
// signals + HQ/office nodes, as an ownership lens over the real product.
// Provenance follows COMMAND_AUDIT_TRAIL.md: live where a real table/RPC backs
// it, partial where a proxy exists, placeholder where we fly blind (the CTO
// backlog), simulated for the Treasury model. No metric VALUES are seeded — the
// UI shows the source badge and "—" until P3 wires the RPCs. Nothing fake.

import type { GraphNode, GraphEdge, Lever, OfficeId, Source, NodeKind, Role } from './types'

// ---- node helper -----------------------------------------------------------
interface NP {
  id: string; label: string; kind: NodeKind; parent: string | null
  owner?: OfficeId; levers?: Lever[]; status: Source; note?: string
  role?: Role; metricLabel?: string; dir?: 'up' | 'down'; unit?: '%' | '$' | 'count' | 'ratio'
  emits?: string[]
}
function nd(p: NP): GraphNode {
  return {
    id: p.id, label: p.label, kind: p.kind, parent: p.parent,
    owner: p.owner, levers: p.levers, role: p.role, status: p.status,
    note: p.note, emits: p.emits,
    metric: p.metricLabel
      ? { key: p.id, label: p.metricLabel, direction: p.dir ?? 'up', unit: p.unit, source: p.status }
      : undefined,
  }
}
const guard = (id: string, label: string, parent: string, owner: OfficeId, status: Source): GraphNode =>
  nd({ id, label, kind: 'signal', parent, owner, role: 'guardrail', status, metricLabel: label, dir: 'down' })

// ---------- HEAD: North Star + levers + value spine -------------------------
export const NORTHSTAR: GraphNode = nd({
  id: 'ns.w2f', label: 'Weekly Two-Hook Families', kind: 'northstar', parent: null,
  owner: 'bridge', status: 'partial', metricLabel: 'W2F', dir: 'up', unit: 'count',
  note: 'A child learned AND a parent ran their week through it, same week.',
})

const LEVERS: GraphNode[] = [
  nd({ id: 'lever.efficiency', label: 'Efficiency · activation', kind: 'lever', parent: 'ns.w2f', owner: 'technology', levers: ['efficiency'], status: 'partial', metricLabel: 'Activation', unit: '%', note: 'First value fast — signup → active.' }),
  nd({ id: 'lever.depth', label: 'Depth · engagement', kind: 'lever', parent: 'ns.w2f', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Depth', unit: 'ratio', note: 'The kid keeps learning.' }),
  nd({ id: 'lever.frequency', label: 'Frequency · retention', kind: 'lever', parent: 'ns.w2f', owner: 'operations', levers: ['frequency'], status: 'live', metricLabel: 'Stickiness', unit: '%', note: 'The parent keeps coordinating.' }),
  nd({ id: 'lever.breadth', label: 'Breadth · acquisition', kind: 'lever', parent: 'ns.w2f', owner: 'operations', levers: ['breadth'], status: 'partial', metricLabel: 'k-factor', unit: 'ratio', note: 'Circle invites — the free growth rail.' }),
]

const STAGES: GraphNode[] = [
  nd({ id: 'stage.learn', label: '① Learn engagement', kind: 'valueStage', parent: 'ns.w2f', owner: 'operations', status: 'live', metricLabel: 'Learn active', unit: 'count' }),
  nd({ id: 'stage.parentlock', label: '② Parent lock-in', kind: 'valueStage', parent: 'ns.w2f', owner: 'operations', status: 'live', metricLabel: 'Parent lock', unit: 'count' }),
  nd({ id: 'stage.pay', label: '③ Payment', kind: 'valueStage', parent: 'ns.w2f', owner: 'treasury', status: 'simulated', metricLabel: 'Paying families', unit: 'count' }),
  nd({ id: 'stage.kinetiklock', label: '④ Kinetik lock-in', kind: 'valueStage', parent: 'ns.w2f', owner: 'operations', status: 'partial', metricLabel: 'Kinetik lock', unit: 'count' }),
  nd({ id: 'stage.expansion', label: '⑤ Expansion', kind: 'valueStage', parent: 'ns.w2f', owner: 'operations', status: 'partial', metricLabel: 'Expansion', unit: 'count', note: 'Mini-apps · Moments → social.' }),
]

// ---------- ArgantaLab (app.arganta) ----------------------------------------
const ARGANTA: GraphNode[] = [
  nd({ id: 'app.arganta', label: 'ArgantaLab', kind: 'app', parent: 'ns.w2f', owner: 'operations', status: 'partial', note: "The kid's pull — game + learn + build + ship." }),
  // PLAY
  nd({ id: 'arganta.home', label: 'Play Home', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['efficiency'], status: 'placeholder', metricLabel: 'Home views', emits: ['feature_view'] }),
  nd({ id: 'arganta.kinworld', label: 'KinWorld', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['depth'], status: 'partial', metricLabel: 'KinWorld actives' }),
  nd({ id: 'arganta.quests', label: 'Quests (LifeQuest)', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['frequency'], status: 'live', metricLabel: 'Quest completes' }),
  nd({ id: 'arganta.fame', label: 'Fame · leaderboards', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['frequency'], status: 'live', metricLabel: 'Rank views' }),
  guard('sig.impossible_score', 'Impossible score', 'app.arganta', 'technology', 'partial'),
  // LEARN
  nd({ id: 'learn.hub', label: 'Learn Hub', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['efficiency'], status: 'partial', metricLabel: 'Hub → world' }),
  nd({ id: 'learn.num', label: 'NumberDash', kind: 'subtab', parent: 'learn.hub', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Ring %' }),
  nd({ id: 'learn.wrd', label: 'WordQuest', kind: 'subtab', parent: 'learn.hub', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Ring %' }),
  nd({ id: 'learn.won', label: 'WonderLab', kind: 'subtab', parent: 'learn.hub', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Ring %' }),
  nd({ id: 'learn.log', label: 'LogicLand', kind: 'subtab', parent: 'learn.hub', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Ring %' }),
  nd({ id: 'learn.wld', label: 'WorldTrail', kind: 'subtab', parent: 'learn.hub', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Ring %' }),
  nd({ id: 'learn.lif', label: 'LifeQuest', kind: 'subtab', parent: 'learn.hub', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Ring %' }),
  nd({ id: 'learn.journey', label: 'Journey map', kind: 'component', parent: 'learn.hub', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Nodes done' }),
  nd({ id: 'learn.drill', label: 'Drill', kind: 'component', parent: 'learn.hub', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Drill accuracy' }),
  nd({ id: 'learn.item', label: 'Item player', kind: 'component', parent: 'learn.hub', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Item attempts' }),
  guard('sig.item_overexposed', 'Item over-exposed', 'learn.hub', 'technology', 'partial'),
  guard('sig.difficulty_mismatch', 'Difficulty mismatch', 'learn.hub', 'technology', 'partial'),
  guard('sig.dead_end_quit', 'Dead-end quit', 'learn.hub', 'technology', 'placeholder'),
  guard('sig.streak_broken', 'Streak broken', 'learn.hub', 'technology', 'partial'),
  // BUILD
  nd({ id: 'build.wizard', label: 'Build Wizard', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['depth'], status: 'partial', metricLabel: 'Builds started', emits: ['build_started', 'build_completed'] }),
  nd({ id: 'build.lab', label: 'Build Lab', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['depth'], status: 'partial', metricLabel: 'Builds published', emits: ['build_published'] }),
  nd({ id: 'build.pitch', label: 'Build Pitch', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['depth'], status: 'partial', metricLabel: 'Builds shared', emits: ['build_shared'] }),
  guard('sig.build_abandoned', 'Build abandoned', 'build.wizard', 'technology', 'placeholder'),
  // SHIP
  nd({ id: 'ship.discover', label: 'Discover', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['breadth'], status: 'placeholder', metricLabel: 'Installs attributed', emits: ['install_attributed'] }),
  nd({ id: 'ship.library', label: 'Library', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['breadth'], status: 'partial', metricLabel: 'Library plays' }),
  nd({ id: 'ship.gamestore', label: 'Game Store', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['breadth'], status: 'partial', metricLabel: 'Store plays' }),
  guard('sig.broken_share_link', 'Broken share link', 'ship.discover', 'technology', 'placeholder'),
  // YOU
  nd({ id: 'you.profile', label: 'Profile', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['frequency'], status: 'partial', metricLabel: 'Profile views' }),
  nd({ id: 'you.pulse', label: 'FamilyPulse', kind: 'tab', parent: 'app.arganta', owner: 'operations', levers: ['frequency'], status: 'partial', metricLabel: 'Pulse opens' }),
  nd({ id: 'you.avatar', label: 'Avatar', kind: 'subtab', parent: 'you.profile', owner: 'treasury', levers: ['frequency'], status: 'live', metricLabel: '💎 spent' }),
  nd({ id: 'you.shop', label: 'Shop', kind: 'subtab', parent: 'you.profile', owner: 'treasury', levers: ['frequency'], status: 'live', metricLabel: '💎 spent', emits: ['diamond_earned'] }),
  nd({ id: 'you.mount', label: 'Mounts', kind: 'subtab', parent: 'you.profile', owner: 'treasury', levers: ['frequency'], status: 'live', metricLabel: 'Mounts bought' }),
  guard('sig.paywall_bounce', 'Paywall bounce', 'you.shop', 'treasury', 'placeholder'),
]

// ---------- KinetikCircle (app.kinetik) -------------------------------------
const KINETIK: GraphNode[] = [
  nd({ id: 'app.kinetik', label: 'KinetikCircle', kind: 'app', parent: 'ns.w2f', owner: 'operations', status: 'live', note: "The parent's stick — calendar + moments + circles." }),
  nd({ id: 'kin.today', label: 'Today', kind: 'tab', parent: 'app.kinetik', owner: 'operations', levers: ['frequency'], status: 'live', metricLabel: 'Today opens', emits: ['plan_created'] }),
  nd({ id: 'kin.calendar', label: 'Calendar', kind: 'tab', parent: 'app.kinetik', owner: 'operations', levers: ['frequency'], status: 'live', metricLabel: 'Events added', emits: ['event_added', 'event_completed'] }),
  guard('sig.calendar_open_no_add', 'Calendar open, no add', 'kin.calendar', 'technology', 'placeholder'),
  nd({ id: 'kin.moments', label: 'Moments', kind: 'tab', parent: 'app.kinetik', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Moments added', emits: ['moment_added'] }),
  guard('sig.ugc_flagged', 'UGC flagged', 'kin.moments', 'legal', 'placeholder'),
  nd({ id: 'kin.apps', label: 'Mini-apps hub', kind: 'tab', parent: 'app.kinetik', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'App opens' }),
  nd({ id: 'kin.travel', label: 'Travel', kind: 'subtab', parent: 'kin.apps', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Trips' }),
  nd({ id: 'kin.padel', label: 'Padel', kind: 'subtab', parent: 'kin.apps', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Sessions' }),
  nd({ id: 'kin.kitchen', label: 'Kitchen', kind: 'subtab', parent: 'kin.apps', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Meal plans' }),
  nd({ id: 'kin.vault', label: 'Vault', kind: 'subtab', parent: 'kin.apps', owner: 'operations', levers: ['depth'], status: 'live', metricLabel: 'Vault docs' }),
  nd({ id: 'kin.circles', label: 'Circles', kind: 'tab', parent: 'app.kinetik', owner: 'operations', levers: ['breadth'], status: 'live', metricLabel: 'Circles' }),
  nd({ id: 'kin.connections', label: 'Connections', kind: 'subtab', parent: 'kin.circles', owner: 'operations', levers: ['breadth'], status: 'live', metricLabel: 'Invites', emits: ['invite_sent', 'invite_accepted'] }),
  nd({ id: 'kin.friends', label: 'Friends', kind: 'subtab', parent: 'kin.circles', owner: 'operations', levers: ['breadth'], status: 'live', metricLabel: 'Friendships' }),
  guard('sig.invite_never_accepted', 'Invite never accepted', 'kin.connections', 'operations', 'partial'),
]

// ---------- Circle HQ + infra + ledger --------------------------------------
const HQ: GraphNode[] = [
  nd({ id: 'app.hq', label: 'Circle HQ', kind: 'app', parent: 'ns.w2f', owner: 'bridge', status: 'live', note: 'The operator OS above the portfolio.' }),
  nd({ id: 'hq.portfolio', label: 'Portfolio', kind: 'tab', parent: 'app.hq', owner: 'bridge', status: 'live', metricLabel: 'Portfolio rollup' }),
  nd({ id: 'hq.growth', label: 'Growth', kind: 'tab', parent: 'app.hq', owner: 'operations', status: 'live', metricLabel: 'North-star WAL' }),
  nd({ id: 'hq.data', label: 'Data', kind: 'tab', parent: 'app.hq', owner: 'technology', status: 'live', metricLabel: 'Tables mapped' }),
  nd({ id: 'hq.agents', label: 'Agent Builder', kind: 'tab', parent: 'app.hq', owner: 'roster', status: 'partial', metricLabel: 'Agents' }),
  nd({ id: 'hq.builders', label: 'Builders', kind: 'tab', parent: 'app.hq', owner: 'technology', status: 'partial', metricLabel: 'Artifacts built' }),
  // Technology-owned infra
  nd({ id: 'arch.supabase', label: 'Supabase', kind: 'architecture', parent: 'app.hq', owner: 'technology', status: 'live', metricLabel: 'RPC health' }),
  nd({ id: 'arch.vercel', label: 'Vercel', kind: 'architecture', parent: 'app.hq', owner: 'technology', status: 'partial', metricLabel: 'Edge health' }),
  nd({ id: 'arch.spine', label: 'Identity spine', kind: 'architecture', parent: 'app.hq', owner: 'technology', status: 'live', metricLabel: 'Spine integrity' }),
  nd({ id: 'arch.sdk', label: 'Circle SDK', kind: 'architecture', parent: 'app.hq', owner: 'technology', status: 'partial', metricLabel: 'SDK events' }),
  nd({ id: 'scale.model', label: 'Scale model', kind: 'scaleModel', parent: 'app.hq', owner: 'technology', status: 'simulated', metricLabel: 'Cost / active', unit: '$', dir: 'down' }),
  // Treasury-owned
  nd({ id: 'ledger.actual', label: 'Diamond ledger', kind: 'ledger', parent: 'app.hq', owner: 'treasury', status: 'live', metricLabel: 'Float' }),
  nd({ id: 'treasury.growthlab', label: 'Growth Lab', kind: 'ledger', parent: 'app.hq', owner: 'treasury', status: 'simulated', metricLabel: 'NPV', unit: '$' }),
  // Legal-owned
  nd({ id: 'legal.consent', label: 'Consent scaffold', kind: 'risk', parent: 'app.hq', owner: 'legal', status: 'partial', metricLabel: 'Consent coverage', unit: '%' }),
  nd({ id: 'legal.ip', label: 'IP register', kind: 'ip', parent: 'app.hq', owner: 'legal', status: 'placeholder', metricLabel: 'IP assets' }),
  nd({ id: 'legal.risk', label: 'Risk register', kind: 'risk', parent: 'app.hq', owner: 'legal', status: 'placeholder', metricLabel: 'Open holds', dir: 'down' }),
]

// ---------- Landing (app.landing) -------------------------------------------
const LANDING: GraphNode[] = [
  nd({ id: 'app.landing', label: 'Landing', kind: 'app', parent: 'ns.w2f', owner: 'operations', status: 'placeholder', note: 'Top-of-funnel — the front door.' }),
  nd({ id: 'land.home', label: 'Home', kind: 'tab', parent: 'app.landing', owner: 'operations', levers: ['breadth'], status: 'placeholder', metricLabel: 'Waitlist joined', emits: ['waitlist_joined'] }),
  nd({ id: 'land.products', label: 'Products', kind: 'tab', parent: 'app.landing', owner: 'operations', levers: ['breadth'], status: 'placeholder', metricLabel: 'Product views' }),
  nd({ id: 'land.pitch', label: 'Pitch / decks', kind: 'tab', parent: 'app.landing', owner: 'operations', levers: ['breadth'], status: 'placeholder', metricLabel: 'Deck views' }),
  guard('sig.deck_no_waitlist', 'Deck, no waitlist', 'land.pitch', 'operations', 'placeholder'),
]

export const NODES: GraphNode[] = [
  NORTHSTAR, ...LEVERS, ...STAGES, ...ARGANTA, ...KINETIK, ...HQ, ...LANDING,
]

// ---------- EDGES -----------------------------------------------------------
let _e = 0
const eid = () => 'e' + (++_e)
const feeds = (from: string, weight: number): GraphEdge => ({ id: eid(), kind: 'FEEDS', from, to: 'ns.w2f', weight })
const ladder = (from: string, weight: number): GraphEdge => ({ id: eid(), kind: 'LADDERS_TO', from, to: 'ns.w2f', weight })
const converts = (from: string, to: string): GraphEdge => ({ id: eid(), kind: 'CONVERTS_TO', from, to })
const consult = (from: string, to: string, about: string, note: string, status: GraphEdge['status'] = 'open', consultType: GraphEdge['consultType'] = 'flag'): GraphEdge =>
  ({ id: eid(), kind: 'CONSULTS', from, to, about, note, status, consultType })

export const EDGES: GraphEdge[] = [
  // levers feed the North Star (contribution weights)
  feeds('lever.efficiency', 0.2), feeds('lever.depth', 0.3), feeds('lever.frequency', 0.35), feeds('lever.breadth', 0.15),
  // value spine
  converts('stage.learn', 'stage.parentlock'), converts('stage.parentlock', 'stage.pay'),
  converts('stage.pay', 'stage.kinetiklock'), converts('stage.kinetiklock', 'stage.expansion'),
  ladder('stage.learn', 0.3), ladder('stage.parentlock', 0.3), ladder('stage.pay', 0.2),
  ladder('stage.kinetiklock', 0.1), ladder('stage.expansion', 0.1),
  // the nervous system — cross-office consults (incl. the shared profitability constraint)
  consult('treasury', 'technology', 'scale.model', 'Infra $0.08/active is the swing in the deficit — cut media/storage cost.', 'open', 'flag'),
  consult('treasury', 'operations', 'lever.efficiency', 'CAC/payer $75 at 2% conv — fix conversion before ad spend.', 'open', 'flag'),
  consult('technology', 'operations', 'sig.difficulty_mismatch', 'Difficulty mismatch flagged — content needs a pass.', 'open', 'handoff'),
  consult('legal', 'treasury', 'stage.pay', 'UGC review could freeze revenue — clear before monetize push.', 'answered', 'flag'),
  consult('technology', 'bridge', 'lever.efficiency', 'Instrumentation coverage below target — the graph is half-blind.', 'open', 'input'),
]

export const GRAPH = { nodes: NODES, edges: EDGES }

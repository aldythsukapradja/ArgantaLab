// Battle test — exercises every Bridge packet builder against the real engine
// and asserts invariants. No MCP client needed. Run: npm run smoke
import {
  orgBrief, askCeo, officeReport, graphQuery, nodeGet, verdictQueue,
  rootCauseChain, financialModel, scaleModel, OFFICE_IDS, NORTH_STAR,
} from './bridge'

let fails = 0
function ok(cond: unknown, msg: string) {
  if (cond) { console.log('  ✓ ' + msg) } else { console.log('  ✗ ' + msg); fails++ }
}
function head(t: string) { console.log('\n' + t) }

head('org_brief')
const brief = orgBrief()
ok(brief.northStar.id === NORTH_STAR, 'north star is ' + NORTH_STAR)
ok(brief.offices.length === 6, 'six offices reported (got ' + brief.offices.length + ')')
ok(brief.offices.every(o => o.chief && o.slice), 'every office has chief + slice')
ok(brief.coverage.total > 0 && brief.coverage.pct >= 0, 'coverage computed (' + brief.coverage.pct + '% of ' + brief.coverage.total + ')')
ok(brief.resolveQueue.length > 0, 'resolve queue has open consults (' + brief.resolveQueue.length + ')')
ok(!!brief.honesty && !!brief.legend, 'honesty rule + provenance legend attached')

head('ceo_ask — routing')
const money = askCeo('are we cashflow positive and when do we break even?')
ok(money.routedTo.includes('treasury'), 'money question routed to treasury (' + money.routedTo.join(',') + ')')
const cov = askCeo('what are we blind on and what does infra cost at scale?')
ok(cov.routedTo.includes('technology'), 'coverage/infra routed to technology (' + cov.routedTo.join(',') + ')')
const vague = askCeo('how are we doing overall?')
ok(vague.routedTo.length === 6, 'vague/org question fans out to all six')
const focused = askCeo('anything', 'legal')
ok(focused.routedTo.length === 1 && focused.routedTo[0] === 'legal', 'explicit focus overrides routing')
ok(money.offices.length >= 1 && !!money.guidance, 'ask returns office packets + CEO guidance')

head('office_report — each office')
for (const id of OFFICE_IDS) {
  const r = officeReport(id) as Record<string, unknown>
  ok(!!r.chief && Array.isArray(r.ownedNodes), id + ': chief + owned nodes')
}
const tre = officeReport('treasury') as Record<string, unknown>
ok(!!tre.financialModel, 'treasury packet carries the financial model')
const tec = officeReport('technology') as Record<string, unknown>
ok(!!tec.scaleModel && !!tec.coverage, 'technology packet carries scale model + coverage')

head('graph_query')
const sims = graphQuery({ source: 'simulated' })
ok(sims.nodes.every(n => n.provenance === 'simulated'), 'source filter returns only simulated (' + sims.count + ')')
const tech = graphQuery({ office: 'technology' })
ok(tech.nodes.every(n => n.owner === 'technology'), 'office filter returns only technology-owned (' + tech.count + ')')

head('node_get')
const ns = nodeGet(NORTH_STAR)
ok(!!ns.node && ns.node.id === NORTH_STAR, 'fetches north star node')
const miss = nodeGet('does.not.exist')
ok(!!miss.error, 'missing node returns an error, not a throw')

head('verdict_queue')
const vq = verdictQueue()
ok(vq.count >= 0 && vq.verdicts.every(v => !!v.laddersTo), 'every verdict LADDERS_TO something (' + vq.count + ' open)')

head('root_cause')
const rc = rootCauseChain()
ok(rc.chain.length >= 2, 'RCA chain has depth (' + rc.chain.length + ' steps)')

head('financial_model')
const fm = financialModel({ case: 'mid', months: 24 })
ok(fm.provenance === 'simulated', 'financial model is badged simulated')
ok(typeof fm.result.npv === 'number' && fm.sampleRows.length === 3, 'npv computed + 3 sample rows')
const fmHigh = financialModel({ case: 'high', overrides: { churn: 0.02 } })
ok(fmHigh.assumptions.churn === 0.02, 'overrides merge onto case defaults')

head('scale_model')
const sc = scaleModel(10000)
ok(sc.provenance === 'simulated', 'scale model badged simulated')
ok(Math.abs(sc.perActive - 0.086) < 0.02, 'per-active reconciles near Treasury $0.08 load (got $' + sc.perActive + ')')
ok(sc.byLayer.length === 5, 'five stack layers priced')
const scBig = scaleModel(1_000_000)
ok(scBig.monthlyTotal > sc.monthlyTotal, 'cost grows with scale (1M > 10k)')

console.log('\n' + (fails === 0 ? '✅ ALL BRIDGE CHECKS PASSED' : `❌ ${fails} CHECK(S) FAILED`))
process.exit(fails === 0 ? 0 : 1)

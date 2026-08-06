// sim-store truth-lock — the dynamic chain's gating and its staleness cascade.
//
// The assertions that matter:
//   1. the chain is ACYCLIC and every prerequisite exists — a typo in `needs` would
//      otherwise silently make a step permanently unrunnable, or permanently open;
//   2. FORECAST depends on MATCH, transitively on a run and on observed data. A
//      forecast from an unmatched model is the most expensive wrong number this app
//      can produce, so the gate is asserted, not assumed;
//   3. re-running a step invalidates EVERYTHING downstream. Stale results look exactly
//      like current ones on screen; the cascade is the only thing that stops a number
//      outliving the assumption it was computed under.
// Run: node scripts/test-sim-store.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'sim-store.ts');
if (!existsSync(mod)) { console.log('SKIP'); process.exit(0); }

const {
  SIM_PROCESSES, SIM_PROCESS_BY_ID, SIM_RIBBON_TABS, downstreamOf, blockedBy,
} = await import('../src/tabs/fielddev/sim-store.ts');

// ── the chain is well formed ────────────────────────────────────────────────
{
  const ids = new Set(SIM_PROCESSES.map((p) => p.id));
  eq('every process is unique', ids.size, SIM_PROCESSES.length);

  let dangling = [];
  for (const p of SIM_PROCESSES) for (const n of p.needs) if (!ids.has(n)) dangling.push(`${p.id}->${n}`);
  eq('no process depends on a step that does not exist', dangling, []);

  // a prerequisite declared AFTER its dependent would make the ribbon run backwards
  const order = SIM_PROCESSES.map((p) => p.id);
  let outOfOrder = [];
  for (const p of SIM_PROCESSES) for (const n of p.needs) {
    if (order.indexOf(n) > order.indexOf(p.id)) outOfOrder.push(`${p.id} needs ${n}`);
  }
  eq('prerequisites are declared before the steps that need them', outOfOrder, []);

  // a cycle makes every step in it permanently blocked, and nothing on screen says why
  let cyclic = [];
  for (const p of SIM_PROCESSES) if (downstreamOf(p.id).includes(p.id)) cyclic.push(p.id);
  eq('the chain has no cycles', cyclic, []);

  check('every process states what it produces',
    SIM_PROCESSES.every((p) => p.produces && p.produces.length > 2), '');
  check('every process states its purpose',
    SIM_PROCESSES.every((p) => p.purpose && p.purpose.length > 20), '');
}

// ── the gate that matters ───────────────────────────────────────────────────
{
  const chain = (id) => {
    const out = new Set();
    const walk = (x) => { for (const n of SIM_PROCESS_BY_ID.get(x).needs) { out.add(n); walk(n); } };
    walk(id);
    return [...out].sort();
  };

  // A FORECAST FROM AN UNMATCHED MODEL IS NOT A FORECAST.
  const fc = chain('forecast');
  check('forecast requires a history match', fc.includes('match'), fc.join(','));
  check('…and therefore a run', fc.includes('run'), fc.join(','));
  check('…and therefore observed data to have been matched against', fc.includes('observed'), fc.join(','));
  check('…and an initialised state', fc.includes('init'), fc.join(','));
  check('…and a schedule', fc.includes('schedule'), fc.join(','));

  // the whole chain is reachable from the case; an orphan step could never run
  const reachable = new Set(['case', ...downstreamOf('case')]);
  eq('every step is reachable from the case',
    SIM_PROCESSES.filter((p) => !reachable.has(p.id)).map((p) => p.id), []);
}

// ── gating messages ─────────────────────────────────────────────────────────
{
  const none = new Set();
  eq('with nothing run, only the case is runnable',
    SIM_PROCESSES.filter((p) => !blockedBy(p.id, none)).map((p) => p.id), ['case']);

  // the IMMEDIATE unmet prerequisite, not the deepest one. The ribbon already shows
  // the whole chain in order, so naming the next link is what tells a reader where
  // they are in it; naming the root would be the same message on every blocked button.
  check('a blocked step names the step directly above it',
    blockedBy('forecast', none) === 'History match', blockedBy('forecast', none) ?? 'null');
  check('…and a step whose own prerequisite is the case says so',
    blockedBy('init', none) === 'Simulation case', blockedBy('init', none) ?? 'null');

  const upTo = new Set(['case', 'init', 'schedule', 'run', 'observed']);
  eq('with a run and observed data, the match unblocks', blockedBy('match', upTo), null);
  check('…but the forecast still waits on the match',
    blockedBy('forecast', upTo) === 'History match', blockedBy('forecast', upTo) ?? 'null');
}

// ── the staleness cascade ───────────────────────────────────────────────────
{
  // re-initialising does not leave the forecast valid — it leaves it STALE
  const d = downstreamOf('init');
  check('re-initialising invalidates the run', d.includes('run'), d.join(','));
  check('…the match', d.includes('match'), d.join(','));
  check('…and the forecast', d.includes('forecast'), d.join(','));
  check('but not the observed data, which is a measurement and does not depend on the model',
    !d.includes('observed'), d.join(','));
  check('nor the case it was initialised from', !d.includes('case'), d.join(','));

  // the last step has nothing after it
  eq('nothing depends on the forecast', downstreamOf('forecast'), []);

  // changing the case invalidates the entire chain — it IS the chain's root assumption
  const all = SIM_PROCESSES.filter((p) => p.id !== 'case').map((p) => p.id).sort();
  eq('changing the case invalidates every other step', downstreamOf('case').sort(), all);
}

// ── the ribbon covers the chain exactly ─────────────────────────────────────
{
  const inRibbon = SIM_RIBBON_TABS.flatMap((t) => t.ids);
  eq('every process appears in the ribbon exactly once',
    inRibbon.slice().sort(), SIM_PROCESSES.map((p) => p.id).sort());
  eq('…and none appears twice', inRibbon.length, new Set(inRibbon).size);
  // the split is case-and-run vs match-and-forecast: the forecast belongs with the match
  const predict = SIM_RIBBON_TABS.find((t) => t.id === 'predict');
  check('the forecast sits with the match, not with the run',
    predict.ids.includes('forecast') && predict.ids.includes('match'), predict.ids.join(','));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

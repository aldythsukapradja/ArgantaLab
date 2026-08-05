// response coverage — every capability, driven through the whole pipeline.
//
// The gap this closes: a capability can be registered, phrased, weighted and
// wired and still produce an answer nobody ever looked at — an empty card, a
// card with no chips to go anywhere from, a card quoting figures with no source
// attached. Nothing catches that, because each part works.
//
// So this walks the registry itself, finds a real entity of each capability's
// declared kinds, runs its phrase through the actual dialogue, and checks the
// answer end to end: card → trace → summary. A capability with no exercisable
// entity in the catalogue is reported as such rather than skipped quietly.
//
// Run: node scripts/test-coverage.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };

const corePath = path.join(root, 'public', 'agent', 'gazetteer.json');
if (!fs.existsSync(corePath)) { console.log('SKIP — run `node scripts/build-gazetteer.mjs` first'); process.exit(0); }
const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
const tail = JSON.parse(fs.readFileSync(path.join(root, 'public', 'agent', 'gazetteer-tail.json'), 'utf8'));

const { buildIndex } = await import('../src/agent/gazetteer.ts');
const { emptyScope, applyPatch } = await import('../src/agent/scope.ts');
const { makeScopeBrain } = await import('../src/agent/brain.ts');
const { newTurn, respond } = await import('../src/agent/dialogue.ts');
const { buildTrace } = await import('../src/agent/trace.ts');
const { summarise } = await import('../src/agent/summary.ts');
const { CAPABILITIES } = await import('../src/agent/capabilities.ts');
const { energyToolSpecs } = await import('../src/agent/tools.ts');

const index = buildIndex(core, tail);
const brain = makeScopeBrain(index);

function ask(text) {
  let scope = emptyScope();
  const r = respond(index, newTurn(), text, scope);
  for (const c of r.commands) {
    if (c.op === 'scope') scope = applyPatch(scope, c.patch, { brain, autofill: c.autofill, reroot: c.reroot });
  }
  const trace = buildTrace({
    facts: r.facts, card: r.card, capabilityId: r.plan?.capabilityId ?? null,
    commands: r.commands, node: r.turn.focus, tier: 'lite', elapsedMs: 0.4,
  });
  return { ...r, trace, summary: summarise(r.card, r.facts, trace) };
}

/** A real entity of `kind` whose probe passes — the capability's happy path.
 *  Falls back to any entity of that kind so an unexercisable capability is
 *  visible as a failure rather than skipped. */
function subjectFor(capability) {
  for (const kind of capability.kinds) {
    const pool = index.byKind.get(kind) ?? [];
    const hit = pool.find((n) => { try { return capability.probe(n); } catch { return false; } });
    if (hit) return { node: hit, probed: true };
  }
  for (const kind of capability.kinds) {
    const pool = index.byKind.get(kind) ?? [];
    if (pool.length) return { node: pool[0], probed: false };
  }
  return null;
}

// ── 1 · every capability is reachable from its own phrasing ─────────────────
{
  const unreachable = [], unexercisable = [];
  for (const capability of CAPABILITIES) {
    const subject = subjectFor(capability);
    if (!subject) { unexercisable.push(capability.id); continue; }
    // Both natural orderings — "figures Kutei Basin" and "Kutei Basin figures"
    // are the same request, and a capability is reachable if either works.
    const phrase = capability.phrases[0];
    const forms = phrase
      ? [`${phrase} ${subject.node.name}`, `${subject.node.name} ${phrase}`]
      : [subject.node.name];
    if (forms.every((q) => ask(q).card.kind === 'error')) {
      unreachable.push(`${capability.id} ("${forms[0]}")`);
    }
  }
  check('every capability has an entity in the catalogue that exercises it',
    unexercisable.length === 0, unexercisable.join(', ') || `${CAPABILITIES.length} capabilities`);
  check('no capability phrasing errors out',
    unreachable.length === 0, unreachable.slice(0, 3).join(' | ') || 'all reachable');
}

// ── 2 · every answer is a complete answer ───────────────────────────────────
{
  const noHeadline = [], noWayOn = [], unsourced = [];
  for (const capability of CAPABILITIES) {
    const subject = subjectFor(capability);
    if (!subject) continue;
    const query = capability.phrases[0] ? `${capability.phrases[0]} ${subject.node.name}` : subject.node.name;
    const { card } = ask(query);
    if (!card.headline?.trim()) noHeadline.push(capability.id);
    // A dead end is a bug: an answer the user cannot move on from.
    if (!card.chips?.length && !['error'].includes(card.kind)) noWayOn.push(capability.id);
    // The rule the whole app rests on: no figure renders without a source.
    for (const f of card.facts ?? []) {
      if (/\d/.test(f.value) && !f.source && !f.note) unsourced.push(`${capability.id}:${f.label}`);
    }
  }
  check('every card has a headline', noHeadline.length === 0, noHeadline.join(', ') || 'all present');
  check('every card offers somewhere to go next', noWayOn.length === 0, noWayOn.slice(0, 5).join(', ') || 'all navigable');
  check('no figure renders without a source or a note',
    unsourced.length === 0, unsourced.slice(0, 5).join(', ') || 'all attributed');
}

// ── 2b · every chip goes somewhere real ────────────────────────────────────
{
  // A chip re-enters the pipeline as if typed. One that does not resolve is a
  // button that apologises when pressed — worse than no button.
  const dead = [];
  for (const capability of CAPABILITIES) {
    const subject = subjectFor(capability);
    if (!subject) continue;
    const query = capability.phrases[0] ? `${capability.phrases[0]} ${subject.node.name}` : subject.node.name;
    for (const c of ask(query).card.chips ?? []) {
      const back = ask(c.query).card;
      if (back.kind === 'error') dead.push(`${capability.id} → "${c.query}"`);
    }
  }
  check('every chip resolves when clicked', dead.length === 0, dead.slice(0, 4).join(' | ') || 'all live');
}

// ── 3 · the trace and the summary keep up with the card ─────────────────────
{
  let traced = 0, summarised = 0, total = 0;
  const untraced = [];
  for (const capability of CAPABILITIES) {
    const subject = subjectFor(capability);
    if (!subject) continue;
    total++;
    const query = capability.phrases[0] ? `${capability.phrases[0]} ${subject.node.name}` : subject.node.name;
    const { trace, summary } = ask(query);
    if (trace.steps.length >= 2) traced++; else untraced.push(capability.id);
    if (summary.text) summarised++;
  }
  check('every answer carries a trace of at least two real steps',
    untraced.length === 0, untraced.slice(0, 5).join(', ') || `${traced}/${total}`);
  // Not every card can be summarised honestly, and a forced sentence would be
  // worse than none — so this is a reported ratio, not a threshold to game.
  check('most answers carry a summary', summarised / total > 0.6, `${summarised}/${total} summarised`);
}

// ── 4 · the tool surface matches the capability surface ─────────────────────
{
  const specs = energyToolSpecs();
  const names = new Set(specs.map((s) => s.name));
  check('every tool spec has a name and a description',
    specs.every((s) => s.name && s.description), `${specs.length} tools`);
  check('tool names are unique', names.size === specs.length, `${names.size} of ${specs.length}`);
  // The model can only ask for what a user could type. More tools than
  // capabilities would mean a tool with no deterministic equivalent.
  check('no tool exists without a capability behind it',
    specs.length <= CAPABILITIES.length + 1,
    `${specs.length} tools vs ${CAPABILITIES.length} capabilities`);
}

// ── 5 · the matrix, printed — the point is to SEE the coverage ─────────────
{
  const byShape = {};
  const byKind = {};
  for (const capability of CAPABILITIES) {
    byShape[capability.shape] = (byShape[capability.shape] ?? 0) + 1;
    for (const k of capability.kinds) byKind[k] = (byKind[k] ?? 0) + 1;
  }
  console.log('\n  shapes  ', Object.entries(byShape).map(([k, v]) => `${k}:${v}`).join('  '));
  console.log('  kinds   ', Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));

  const kindsWithNoCapability = [...index.byKind.keys()].filter((k) => !byKind[k]);
  check('no entity kind is unreachable by any capability',
    kindsWithNoCapability.length === 0,
    kindsWithNoCapability.join(', ') || `${Object.keys(byKind).length} kinds covered`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

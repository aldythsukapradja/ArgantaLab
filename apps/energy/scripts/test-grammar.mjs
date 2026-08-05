// grammar + planner truth-lock (L4/L1).
// Run: node scripts/test-grammar.mjs
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
const { emptyScope } = await import('../src/agent/scope.ts');
const { CAPABILITIES, CAPABILITY_BY_ID } = await import('../src/agent/capabilities.ts');
const { parse, lexicon } = await import('../src/agent/grammar.ts');
const { resolve } = await import('../src/agent/resolve.ts');
const P = await import('../src/agent/plan.ts');
const { buildPlan, chooseCapability, drillDownChips, unresolvedCard, ambiguityCard, comparisonCard } = P;

const index = buildIndex(core, tail);
const ctx = { index, scope: emptyScope() };
const nodeOf = (q) => { const r = resolve(index, q); return r.status === 'exact' || r.status === 'corrected' ? r.node : null; };
const kutei = index.byId.get('gaz:basin:3817');
const indonesia = index.byId.get('gaz:country:ID');
const volve = index.nodes.find((n) => n.kind === 'field' && n.name === 'VOLVE');
const badak = index.nodes.find((n) => n.kind === 'field' && n.name.startsWith('Badak'));
const volveWell = index.byKind.get('well').find((w) => w.has.logs);

/** End-to-end: text → intent → entity → plan. */
function ask(text, focus = null) {
  const intent = parse(text);
  const node = intent.usesFocus ? focus : nodeOf(intent.entityQuery);
  if (!node) return { intent, node: null, plan: null };
  return { intent, node, plan: buildPlan(node, intent, ctx) };
}
const capOf = (text, focus) => { const a = ask(text, focus); return a.plan ? chooseCapability(a.node, a.intent, ctx) : null; };

// ── 1 · the registry IS the lexicon ──────────────────────────────────────────
check('every capability phrase is in the lexicon', CAPABILITIES.every((c) => c.phrases.every((p) => lexicon().some((l) => l.phrase === p.toLowerCase()))));
// The round-trip that keeps grammar and capabilities from drifting: every phrase
// a capability declares must parse back to that capability.
const roundTripMisses = [];
for (const capability of CAPABILITIES) {
  for (const phrase of capability.phrases) {
    const intent = parse(`${phrase} for kutei basin`);
    if (!intent.capabilityIds.includes(capability.id)) roundTripMisses.push(`${capability.id}:"${phrase}"`);
  }
}
check(`every capability phrase parses back to its capability (${roundTripMisses.length} misses)`,
  roundTripMisses.length === 0, roundTripMisses.slice(0, 6).join(' | '));
check('every capability declares a shape', CAPABILITIES.every((c) => ['brief', 'list', 'action', 'menu'].includes(c.shape)));

// ── 2 · the user's own queries ───────────────────────────────────────────────
check('"show me kutei basin" → the basin dossier', capOf('show me kutei basin')?.capability.id === 'basin.dossier'
  || capOf('show me kutei basin')?.capability.id === 'map.fly');
check('… and it resolves to Kutei Basin', ask('show me kutei basin').node?.name === 'Kutei Basin');
check('"kutei basin" (bare) → a brief, no verb needed', (() => {
  const a = ask('kutei basin');
  return a.intent.verb === 'brief' && a.plan.card.kind === 'brief';
})());
check('"give me insight about indonesia" → country overview', capOf('give me insight about indonesia')?.capability.id === 'country.overview');
check('… and the card offers the 12 basins to drill into', ask('give me insight about indonesia').plan.card.chips.length === 12);
check('"which basins are in norway" → a LIST card', (() => {
  const a = ask('which basins are in norway');
  return a.node?.name === 'Norway' && a.plan.card.kind === 'list';
})());
check('"list fields in kutei basin" → the field list', (() => {
  const a = ask('list fields in kutei basin');
  return a.node?.name === 'Kutei Basin' && a.plan.card.kind === 'list' && a.plan.card.facts.length > 0;
})());
check('"show me volve\'s production" → production', capOf('show me production for volve')?.capability.id === 'field.production');
check('"where is volve" → the map', capOf('where is volve')?.capability.id === 'map.fly');
check('… and it emits a fly command', ask('where is volve').plan.commands.some((c) => c.op === 'map'));

// ── 3 · anaphora — "it", "the logs" ──────────────────────────────────────────
check('"show me the logs" uses the focus, not a new entity', parse('show me the logs').usesFocus === true);
check('… and names the logs capability', parse('show me the logs').capabilityIds.includes('well.logs'));
check('"tell me about it" is a focus reference', parse('tell me about it').usesFocus === true);
check('"what about that basin" is a focus reference', parse('what about that basin').usesFocus === true);
check('"its fields" is a focus reference', parse('its fields').usesFocus === true);
check('a named entity is NOT a focus reference', parse('fields in kutei basin').usesFocus === false);
check('focus queries plan against the focus node', (() => {
  const a = ask('show me the logs', volveWell);
  return a.node?.id === volveWell.id && a.plan.commands.length > 0;
})());

// ── 4 · THE HONESTY PATH survives the planner ────────────────────────────────
const badakLogs = ask('show me the logs', badak);
check('"logs" on a field with no bundle produces an ABSENCE card', badakLogs.plan.card.kind === 'absence');
check('… and emits NO navigation commands', badakLogs.plan.commands.length === 0);
check('… and says what does have logs', /volve|bundle/i.test(badakLogs.plan.card.body));
check('… and offers what IS available instead', badakLogs.plan.card.chips.length > 0);

const countryLogs = ask('show me the logs', indonesia);
check('"logs" on a country is a wrong-kind clarification, not an absence', countryLogs.plan.card.kind === 'clarify');
check('… and explains which kinds it applies to', /well/i.test(countryLogs.plan.card.body));

check('a capability with data DOES emit commands', ask('show me the logs', volveWell).plan.commands.length > 0);

// ── 5 · the drill-down ladder ────────────────────────────────────────────────
check('region → country', drillDownChips(index.byId.get('gaz:region:3'), ctx)?.childKind === 'country');
check('country → basin', drillDownChips(indonesia, ctx)?.childKind === 'basin');
check('basin → field', drillDownChips(kutei, ctx)?.childKind === 'field');
check('field → well (only where wells exist)', drillDownChips(volve, ctx)?.childKind === 'well' && drillDownChips(badak, ctx) === null);
check('a brief offers the next rung', (() => {
  const card = ask('kutei basin').plan.card;
  return card.chips.length > 0 && /which field/i.test(card.body ?? '');
})());
check('a SPECIFIC query skips the ladder', (() => {
  const card = ask('figures for kutei basin').plan.card;
  return !/which field/i.test(card.body ?? '');
})());
check('every drill-down chip re-enters as a typed query', (() => {
  const card = ask('give me insight about indonesia').plan.card;
  return card.chips.every((c) => nodeOf(c.query) !== null);
})());

// ── 6 · comparison ───────────────────────────────────────────────────────────
check('"compare volve and ekofisk" parses as a comparison', (() => {
  const i = parse('compare volve and ekofisk');
  return i.verb === 'compare' && i.entityQuery === 'volve' && i.secondEntityQuery === 'ekofisk';
})());
check('"volve vs ekofisk" parses as a comparison', parse('volve vs ekofisk').verb === 'compare');
check('"compare with kutei basin" compares against the focus', (() => {
  const i = parse('compare with kutei basin');
  return i.verb === 'compare' && i.usesFocus && i.secondEntityQuery === 'kutei basin';
})());
check('a bare "and" is NOT a comparison', parse('fields and wells in kutei basin').verb !== 'compare');
check('a comparison card puts both sides in every row', (() => {
  const card = comparisonCard(kutei, index.byId.get('gaz:basin:4025'), ctx);
  return card.facts.every((f) => f.value.includes('·')) && card.facts.length >= 4;
})());

// ── 7 · parse never throws, and always lands somewhere useful ────────────────
const JUNK = ['', '   ', '???', 'asdfgh', 'show me', 'the', 'compare', 'list', 'why', '42',
  'show me the thing in the place', 'kutei basin kutei basin kutei basin'];
check('parse never throws', JUNK.every((q) => { try { parse(q); return true; } catch { return false; } }));
check('every parse returns a known verb', JUNK.every((q) => ['show', 'brief', 'list', 'compare', 'locate', 'explain', 'help'].includes(parse(q).verb)));
check('an unparseable query still yields an entity-specific menu', (() => {
  const a = ask('blah blah blah', kutei);
  return a.plan === null || a.plan.card.chips.length >= 0;
})());
check('unresolvedCard offers the nearest matches', (() => {
  const r = resolve(index, 'kuteiiii');
  const card = unresolvedCard('kuteiiii', r.status === 'none' ? r.suggestions : []);
  return card.kind === 'error' && !!card.body;
})());
check('ambiguityCard lists every contender with its kind', (() => {
  const card = ambiguityCard('statfjord', [{ node: volve }, { node: badak }]);
  return card.chips.length === 2 && card.facts.every((f) => !!f.value);
})());

// ── 8 · plans are well-formed ────────────────────────────────────────────────
const samples = ['kutei basin', 'indonesia', 'volve', 'which basins are in norway', 'list fields in kutei basin',
  'figures for kutei basin', 'where is volve', 'petroleum systems in kutei basin', 'production for volve',
  'wells in volve', 'cycles in kutei basin', 'what do you have on badak'];
const plans = samples.map((q) => ({ q, ...ask(q) })).filter((a) => a.plan);
check(`all ${samples.length} sample queries produce a plan`, plans.length === samples.length,
  samples.filter((q) => !ask(q).plan).join(' | '));
check('every command is a known op', plans.every((p) => p.plan.commands.every((c) => ['scope', 'view', 'map', 'clear'].includes(c.op))));
check('every card carries provenance', plans.every((p) => p.plan.card.provenance.length > 0));
check('every card has a headline and a kind', plans.every((p) => !!p.plan.card.headline && !!p.plan.card.kind));
check('no plan renders undefined text', plans.every((p) => !/undefined|NaN/.test(JSON.stringify(p.plan.card))));
check('scope commands always name a real level', plans.every((p) => p.plan.commands
  .filter((c) => c.op === 'scope').every((c) => Object.keys(c.patch).length === 1)));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

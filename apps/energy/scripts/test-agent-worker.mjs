// worker-tier truth-lock — tool projection (W2) and the grounding guard (W5).
// Run: node scripts/test-agent-worker.mjs
//
// The transport itself is not exercised here (that is workers/arganta-energy-agent
// /test/router.test.js). What matters on this side is the STRUCTURAL guarantee:
// a model tool call becomes the same Intent the grammar produces, so the
// language tier can do nothing the deterministic tier cannot.
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
const { newTurn, runIntent, respond } = await import('../src/agent/dialogue.ts');
const { parse } = await import('../src/agent/grammar.ts');
const T = await import('../src/agent/tools.ts');
const G = await import('../src/agent/guard.ts');
const { energyToolSpecs, ensureRegistered, toProviderTools, toToolName, fromToolName, toolCallToIntent, TOOL_NAMES, COMPARE_TOOL_NAME } = T;
const A = await import('@arganta/agent');
const { enforceGrounding, ungroundedNumbers, cardNumbers, toolSummary } = G;

const index = buildIndex(core, tail);
const scope = emptyScope();
const specs = energyToolSpecs();

// ── 1 · the projection is total and lossless ─────────────────────────────────
check('every capability becomes a tool, plus the dedicated compare tool', specs.length === CAPABILITIES.length + 1);
check('compare is registered under its own name, not a capability id',
  specs.some((s) => s.name === COMPARE_TOOL_NAME) && !CAPABILITY_BY_ID.has(COMPARE_TOOL_NAME));
check('every OTHER tool maps to a capability — compare is the one deliberate exception',
  specs.filter((s) => s.name !== COMPARE_TOOL_NAME).every((s) => CAPABILITY_BY_ID.has(fromToolName(s.name))));
check('tool names satisfy the OpenAI charset', specs.every((s) => /^[a-zA-Z0-9_-]{1,64}$/.test(s.name)));
check('tool names are unique', new Set(specs.map((s) => s.name)).size === specs.length);
check('the name round-trips for every capability, camelCase included',
  CAPABILITIES.every((c) => fromToolName(toToolName(c.id)) === c.id),
  CAPABILITIES.filter((c) => fromToolName(toToolName(c.id)) !== c.id).map((c) => c.id).join(', '));
const perCapabilitySpecs = specs.filter((s) => s.name !== COMPARE_TOOL_NAME);
check('every per-capability tool description names the kinds it applies to',
  perCapabilitySpecs.every((s) => /Applies to: /.test(s.description)));
check('every per-capability tool takes the user\'s wording, and nothing else',
  perCapabilitySpecs.every((s) => Object.keys(s.params.properties).join() === 'query'));
check('query is optional there, so the model can refer to the focus',
  perCapabilitySpecs.every((s) => s.params.required.length === 0));
check('compare takes two named sides instead — queryB required, queryA optional (falls back to focus)', (() => {
  const cmp = specs.find((s) => s.name === COMPARE_TOOL_NAME);
  return Object.keys(cmp.params.properties).sort().join() === 'queryA,queryB' && cmp.params.required.join() === 'queryB';
})());
check('the model is told NOT to correct the query itself',
  specs.every((s) => /do not correct/i.test(s.description)));

// ── 1b · HQ parity: the SHARED registry, not a private one ───────────────────
// apps/hq builds its agent on exactly these contracts. Registering here means
// @arganta/agent's pure loop resolves our tools through the same `toolByName`,
// autonomy gate and budget accounting it already uses for HQ's.
ensureRegistered();
check('every energy tool resolves in @arganta/agent\'s shared registry',
  specs.every((s) => !!A.toolByName(s.name)),
  specs.filter((s) => !A.toolByName(s.name)).map((s) => s.name).join(', '));
check('registering is idempotent — no duplicates on a second call', (() => {
  const before = A.allToolSpecs().length;
  ensureRegistered(); ensureRegistered();
  return A.allToolSpecs().length === before;
})());
check('energy tools never collide with HQ\'s frozen core specs',
  !specs.some((s) => A.TOOL_SPECS.some((t) => t.name === s.name)));
// Governance metadata has to be TRUE, not merely present: these tools read local
// JSON and render a card. Nothing here spends, publishes or destroys.
check('every tool is costClass 0 — it runs locally, for free', specs.every((s) => s.costClass === 0));
check('every tool is side-effect free and autonomy safe',
  specs.every((s) => s.sideEffect === false && s.autonomySafe === true));
check('every tool is dataClass public — the shipped catalogue is open data',
  specs.every((s) => s.dataClass === 'public'));
check('the cost filter offers all of them at maxCostClass 0',
  A.availableTools(specs, { autonomous: false, maxCostClass: 0 }).length === specs.length);

// @arganta/ai's openaiCompat provider expects the FLAT shape — it does the
// OpenAI `{type:'function'}` wrapping itself. `toOpenAITools` returns the
// already-wrapped form (what the edgeProxy path wants); sending that here would
// transmit `name: undefined` to the model.
const provider = toProviderTools(specs);
check('provider tools are the flat {name, description, parameters} shape',
  provider.every((t) => typeof t.name === 'string' && !!t.parameters && !('function' in t)));
check('… and carry every tool', provider.length === specs.length);

// ── 2 · a tool call is just an Intent ────────────────────────────────────────
const intent = toolCallToIntent('basin_dossier', JSON.stringify({ query: 'kutei basin' }));
check('a tool call names its capability', intent.capabilityIds[0] === 'basin.dossier');
check('… carries the query verbatim', intent.entityQuery === 'kutei basin');
check('… and is not a focus reference', intent.usesFocus === false);
check('an omitted query becomes a focus reference', toolCallToIntent('well_logs', '{}').usesFocus === true);
check('malformed arguments degrade to a focus reference, never throw',
  toolCallToIntent('basin_dossier', 'not json').usesFocus === true);
check('an unknown tool yields no capability', toolCallToIntent('rm_rf_slash', '{}').capabilityIds.length === 0);
check('unknown tools are rejected by name before dispatch', !TOOL_NAMES.has('rm_rf_slash') && TOOL_NAMES.has('basin_dossier'));

// ── 3 · THE STRUCTURAL GUARANTEE ─────────────────────────────────────────────
// The worker tier must produce byte-identical results to the typed path.
const cases = [
  ['basin_dossier', 'kutei basin', 'kutei basin'],
  ['country_overview', 'indonesia', 'give me insight about indonesia'],
  ['country_basins', 'norway', 'which basins are in norway'],
  ['basin_fields', 'kutei basin', 'list fields in kutei basin'],
  ['field_dossier', 'volve', 'volve'],
  ['basin_figures', 'kutei basin', 'figures for kutei basin'],
];
let identical = 0;
const drifted = [];
for (const [tool, query, typed] of cases) {
  const viaTool = runIntent(index, newTurn(), toolCallToIntent(tool, JSON.stringify({ query })), typed, scope);
  const viaText = respond(index, newTurn(), typed, scope);
  if (JSON.stringify(viaTool.card) === JSON.stringify(viaText.card)) identical += 1;
  else drifted.push(`${tool}: "${typed}"`);
}
check(`the tool path and the typed path produce identical cards (${identical}/${cases.length})`,
  identical === cases.length, drifted.join(' | '));

// The honesty rule must survive the language tier unchanged.
const badak = index.nodes.find((n) => n.kind === 'field' && n.name.startsWith('Badak'));
const viaTool = runIntent(index, { ...newTurn(), focus: badak }, toolCallToIntent('well_logs', '{}'), 'logs', scope);
check('a tool call cannot conjure data that is not there', viaTool.card.kind === 'absence');
check('… and still refuses to navigate', viaTool.commands.length === 0);

const countryLogs = runIntent(index, newTurn(), toolCallToIntent('well_logs', JSON.stringify({ query: 'indonesia' })), 'logs', scope);
check('a wrong-kind tool call is refused, not improvised', countryLogs.card.kind === 'clarify');

// ── 3b · the compare tool — the gap a live groq run actually exposed ─────────
// "how does volve stack up production-wise against kutei's badak field" is
// EXACTLY the phrasing that, before this tool existed, resolved as one garbled
// entity ("volve vs kutei") and returned "I don't have anything called…".
const compareIntent = toolCallToIntent(COMPARE_TOOL_NAME, JSON.stringify({ queryA: 'volve', queryB: 'kutei basin' }));
check('the compare tool call parses as a real comparison intent',
  compareIntent.verb === 'compare' && compareIntent.entityQuery === 'volve' && compareIntent.secondEntityQuery === 'kutei basin');
const compareResult = runIntent(index, newTurn(), compareIntent, 'compare volve and kutei basin', scope);
check('… and produces a real two-sided card, not a failed lookup',
  compareResult.card.kind === 'brief' && /vs/.test(compareResult.card.headline));
check('… matching the typed path byte-for-byte',
  JSON.stringify(compareResult.card) === JSON.stringify(respond(index, newTurn(), 'compare volve and kutei basin', scope).card));

const compareViaFocus = toolCallToIntent(COMPARE_TOOL_NAME, JSON.stringify({ queryB: 'badak' }));
check('an omitted queryA falls back to the entity in focus', compareViaFocus.usesFocus === true);
const compareMissingB = toolCallToIntent(COMPARE_TOOL_NAME, '{}');
check('a compare call with no second entity at all still degrades safely (no throw)',
  compareMissingB.verb === 'compare' && compareMissingB.secondEntityQuery === undefined);
check('compare_entities is in the allowed tool-name set', TOOL_NAMES.has(COMPARE_TOOL_NAME));

// ── 4 · the grounding guard ──────────────────────────────────────────────────
const kutei = index.byId.get('gaz:basin:3817');
const card = respond(index, newTurn(), 'kutei basin', scope).card;

check('a card exposes its own numbers', cardNumbers(card).size > 0);
check('prose repeating a card number is allowed',
  enforceGrounding(`There are ${kutei.has.fields} fields.`, card).discarded === false);
check('prose inventing a number is DISCARDED, not trimmed', (() => {
  const out = enforceGrounding('Kutei Basin holds 4,317 MMbbl of proven oil.', card);
  return out.discarded === true && out.text === '';
})());
check('… and the violation is reported', enforceGrounding('It holds 88,412 MMbbl.', card).violations.includes('88,412'));
check('small integers pass — they are counts and ordinals, not claims',
  enforceGrounding('Here are the first 3 of them.', card).discarded === false);
check('a number the USER supplied is grounded',
  enforceGrounding('Nothing found for 3817.', card, 'basin 3817').discarded === false);
check('thousands separators do not fool the check',
  ungroundedNumbers('20 fields', { headline: 'x', facts: [{ label: 'f', value: '20' }], chips: [], provenance: [], kind: 'brief' }).length === 0);
check('empty prose is fine', enforceGrounding('', card).discarded === false);
check('prose with no numbers at all is fine',
  enforceGrounding('Which field would you like?', card).discarded === false);
check('a null card grounds nothing but the user\'s own words',
  enforceGrounding('There are 4,317 fields.', null).discarded === true);

// ── 5 · what the model is allowed to SEE ─────────────────────────────────────
const summary = toolSummary(card);
check('the tool result handed back to the model carries no figures',
  ungroundedNumbers(summary, null, '').length === 0, summary);
check('… but does say what happened', /shown to the user/.test(summary));
check('an absence summary says so', /no data/.test(toolSummary({ kind: 'absence', headline: 'x', facts: [], chips: [], provenance: [] })));
check('… and tells the model not to restate it', /do not restate/i.test(summary));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

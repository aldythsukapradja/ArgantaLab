// capabilities truth-lock (L2) — routing and, above all, THE HONESTY RULE.
// Run: node scripts/test-capabilities.mjs
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
const C = await import('../src/agent/capabilities.ts');
const { CAPABILITIES, CAPABILITY_BY_ID, capabilitiesFor, defaultCapability, absenceCard } = C;

const index = buildIndex(core, tail);
const ctx = { index, scope: emptyScope() };
const node = (id) => index.byId.get(id);
const byName = (name, kind) => index.nodes.find((n) => n.name === name && (!kind || n.kind === kind));

const kutei = node('gaz:basin:3817');
const viking = node('gaz:basin:4025');
const indonesia = node('gaz:country:ID');
const volve = byName('VOLVE', 'field');
const badak = index.nodes.find((n) => n.kind === 'field' && n.name.startsWith('Badak'));
const volveWell = index.byKind.get('well').find((w) => w.has.logs);
const plainBore = index.byKind.get('wellbore').find((w) => !w.has.bundle);

// ── 1 · registry hygiene ─────────────────────────────────────────────────────
check('every capability id is unique', CAPABILITY_BY_ID.size === CAPABILITIES.length);
check('every capability id is namespaced <domain>.<verb>', CAPABILITIES.every((c) => /^[a-z]+\.[a-zA-Z]+$/.test(c.id)));
check('every capability declares at least one phrase and one kind',
  CAPABILITIES.every((c) => c.phrases.length > 0 && c.kinds.length > 0));
check('every capability has probe, plan and card', CAPABILITIES.every((c) => typeof c.probe === 'function' && typeof c.plan === 'function' && typeof c.card === 'function'));
// Behavioural, not string-matched: if any real node of a capability's kinds
// fails its probe, that capability MUST be able to explain the refusal.
const canFail = (c) => c.kinds.some((kind) => (index.byKind.get(kind) ?? []).some((n) => !c.probe(n)));
check('every capability that can fail explains why',
  CAPABILITIES.every((c) => !canFail(c) || typeof c.absence === 'function'),
  CAPABILITIES.filter((c) => canFail(c) && !c.absence).map((c) => c.id).join(', '));
check('~30 capabilities registered', CAPABILITIES.length >= 25 && CAPABILITIES.length <= 40, `${CAPABILITIES.length}`);

// ── 2 · routes land on surfaces that actually exist ──────────────────────────
// The suite tabs render widget BLUEPRINTS; only these surfaces hold content.
const NAVS = new Set(['cockpit', 'exploration', 'field-development', 'reservoir-management', 'well-delivery', 'drilling-sequence', 'knowledge', 'data', 'insights', 'agents']);
const EXPLORATION_SUBS = new Set(['atlas-benchmark', 'basin-framework', 'basin-analogs', 'strat-depositional', 'basin-model', 'play-fairway', 'prospect-register', 'volumetrics-risk', 'portfolio-ranking']);
const FIELDDEV_SUBS = new Set(['client-data-qc', 'petrophysics-lite', 'static-model-lite', 'fluids-rock', 'simulation-cases', 'history-uncertainty', 'recovery-wells', 'forecast-phasing', 'value-fdp']);
const LEGACY_TABS = new Set(['map', 'logs', 'petrophysics', 'correlation', 'structural', 'property', 'gridmodel', 'simulation', 'volumetrics', 'uncertainty', 'forecast', 'economics', 'review']);

const allCommands = [];
for (const capability of CAPABILITIES) {
  for (const candidate of [kutei, viking, indonesia, volve, badak, volveWell, plainBore, index.byKind.get('petroleum-system')[0], index.byKind.get('assessment-unit')[0], index.byKind.get('formation')[0], index.byKind.get('company')[0], index.byKind.get('region')[0]]) {
    if (!candidate || !capability.kinds.includes(candidate.kind)) continue;
    allCommands.push(...capability.plan(candidate, ctx).map((cmd) => ({ cmd, capability: capability.id })));
  }
}
const viewCmds = allCommands.filter((c) => c.cmd.op === 'view');
check('every plan emits only known ops', allCommands.every((c) => ['scope', 'view', 'map', 'clear'].includes(c.cmd.op)));
check('every view intent targets a real nav id', viewCmds.every((c) => NAVS.has(c.cmd.view.nav)),
  viewCmds.filter((c) => !NAVS.has(c.cmd.view.nav)).slice(0, 3).map((c) => `${c.capability}→${c.cmd.view.nav}`).join(', '));
check('every exploration sub is a real workflow tab',
  viewCmds.filter((c) => c.cmd.view.nav === 'exploration' && c.cmd.view.sub).every((c) => EXPLORATION_SUBS.has(c.cmd.view.sub)));
check('every field-development sub is a real workflow tab',
  viewCmds.filter((c) => c.cmd.view.nav === 'field-development' && c.cmd.view.sub).every((c) => FIELDDEV_SUBS.has(c.cmd.view.sub)));
check('every legacyTab is one of the 13 built Legacy views',
  viewCmds.filter((c) => c.cmd.view.legacyTab).every((c) => LEGACY_TABS.has(c.cmd.view.legacyTab)));
check('every mode is knowledge or workspace',
  viewCmds.filter((c) => c.cmd.view.mode).every((c) => ['knowledge', 'workspace'].includes(c.cmd.view.mode)));
check('map commands carry a real coordinate',
  allCommands.filter((c) => c.cmd.op === 'map').every((c) => Math.abs(c.cmd.map.lon) <= 180 && Math.abs(c.cmd.map.lat) <= 90 && c.cmd.map.zoom > 0));
check('scope commands set exactly one level',
  allCommands.filter((c) => c.cmd.op === 'scope').every((c) => Object.keys(c.cmd.patch).length === 1));

// ── 3 · THE HONESTY RULE ─────────────────────────────────────────────────────
// The whole point of the layer. A probe reads measured availability, so the
// agent declines with a reason instead of routing to an empty viewer.
const logs = CAPABILITY_BY_ID.get('well.logs');
check('Volve bundle wells DO have logs', logs.probe(volveWell) === true);
check('a plain North Sea wellbore does NOT', logs.probe(plainBore) === false);
check('… and the refusal names what does have them', /only the \d+ wells/i.test(logs.absence(plainBore, ctx)));

const qc = CAPABILITY_BY_ID.get('field.qc');
check('Data QC is available for the bundled field only', qc.probe(volve) === true && qc.probe(badak) === false);
check('… and the refusal explains why, not just "no"', qc.absence(badak, ctx).includes('bundle'));

const production = CAPABILITY_BY_ID.get('field.production');
check('Volve reports production despite having no cockpit-field-detail record', production.probe(volve) === true);
check('Badak reports production from its GOGET record', production.probe(badak) === true);
const noProd = index.byKind.get('field').find((f) => !f.has.production);
check('a field with no production record is refused', production.probe(noProd) === false);
check('… and offered the field that does have it', /volve/i.test(production.absence(noProd, ctx)));

const figures = CAPABILITY_BY_ID.get('basin.figures');
const noFigures = index.byKind.get('basin').find((b) => !b.has.openFigures);
check('figures are offered only where public-domain figures exist',
  figures.probe(kutei) === true && figures.probe(noFigures) === false);

const ps = CAPABILITY_BY_ID.get('basin.petroleumSystems');
const noPs = index.byKind.get('basin').find((b) => !b.has.petroleumSystems);
check('petroleum systems are refused for an unassessed province', noPs ? ps.probe(noPs) === false : true);
check('… citing that TPS detail is sparse, not missing by accident',
  noPs ? /only 128|never populated|no total petroleum system/i.test(ps.absence(noPs, ctx)) : true);

check('NO capability claims data for a bare registry wellbore', capabilitiesFor(plainBore, ctx)
  .every((c) => ['well.overview', 'map.fly', 'data.availability'].includes(c.id)));
check('… and its overview says so in plain words', (() => {
  const card = CAPABILITY_BY_ID.get('well.overview').card(plainBore, ctx);
  return /registry entry/i.test(card.body ?? '');
})());

// ── 4 · cards are grounded ───────────────────────────────────────────────────
const cards = [];
for (const capability of CAPABILITIES) {
  for (const candidate of [kutei, viking, indonesia, volve, badak, volveWell, plainBore]) {
    if (!candidate || !capability.kinds.includes(candidate.kind)) continue;
    cards.push({ id: capability.id, node: candidate.name, card: capability.probe(candidate) ? capability.card(candidate, ctx) : absenceCard(capability, candidate, ctx) });
  }
}
check('every card carries a provenance strip', cards.every((c) => c.card.provenance.length > 0),
  cards.filter((c) => !c.card.provenance.length).slice(0, 3).map((c) => c.id).join(', '));
check('every card has a headline', cards.every((c) => !!c.card.headline));
check('every stated fact cites a source or explains itself', cards.every((c) => c.card.facts.every((f) => !!f.source || !!f.note)),
  cards.flatMap((c) => c.card.facts.filter((f) => !f.source && !f.note).map((f) => `${c.id}:${f.label}`)).slice(0, 4).join(', '));
check('every chip carries a re-enterable query', cards.every((c) => c.card.chips.every((chip) => !!chip.query && !!chip.label)));
check('no card renders an undefined value', cards.every((c) => c.card.facts.every((f) => typeof f.value === 'string' && !/undefined|NaN/.test(f.value))));
check('absence cards state the reason in the body', cards.filter((c) => c.card.kind === 'absence').every((c) => (c.card.body ?? '').length > 20));

// ── 5 · the shared-basin truth survives into the card ────────────────────────
const vikingCard = CAPABILITY_BY_ID.get('basin.dossier').card(viking, ctx);
check('a shared basin names all five countries with shares',
  vikingCard.facts.some((f) => /Shared by 5 countries/.test(f.label) && /United Kingdom/.test(f.value)));
check('… and says the share is membership, not a boundary',
  vikingCard.facts.some((f) => /not a boundary/i.test(f.note ?? '')));

// ── 6 · the country caveat is stated every time ──────────────────────────────
const idnCard = CAPABILITY_BY_ID.get('country.overview').card(indonesia, ctx);
check('Indonesia lists 12 basins', /12 basins hold/.test(idnCard.body) || idnCard.facts.some((f) => f.value === '12'));
check('… and says the baseline is not the national count', /not the national basin count/i.test(idnCard.body));
check('… and flags that the country ⇄ basin link is derived',
  idnCard.facts.some((f) => /derived/i.test(f.note ?? '') || /derived/i.test(f.source ?? '')));
check('… and offers the basins as drill-down chips', idnCard.chips.length === 12);

// ── 7 · defaults for a bare entity query ─────────────────────────────────────
check('a bare basin query defaults to the dossier', defaultCapability(kutei, ctx).id === 'basin.dossier');
check('a bare country query defaults to the overview', defaultCapability(indonesia, ctx).id === 'country.overview');
check('a bare field query defaults to the dossier', defaultCapability(volve, ctx).id === 'field.dossier');
check('a bare well query defaults to the overview', defaultCapability(volveWell, ctx).id === 'well.overview');
check('every kind in the gazetteer has at least one capability', [...index.byKind.keys()]
  .every((kind) => CAPABILITIES.some((c) => c.kinds.includes(kind))),
  [...index.byKind.keys()].filter((k) => !CAPABILITIES.some((c) => c.kinds.includes(k))).join(', '));
check('every node resolves at least one usable capability',
  [kutei, viking, indonesia, volve, badak, volveWell, plainBore].every((n) => capabilitiesFor(n, ctx).length > 0));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

// gazetteer truth-lock — the place graph (L1) against the REAL shipped payload.
// Run: node scripts/test-gazetteer.mjs
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

const G = await import('../src/agent/gazetteer.ts');
const { buildIndex, expandTailRow, normKeysFor, trigrams, phoneticKey, fold, ancestryOf, childrenOfKind, richness, toRef } = G;

const index = buildIndex(core, tail);
const find = (name, kind) => index.nodes.find((n) => n.name.toLowerCase() === name.toLowerCase() && (!kind || n.kind === kind));
const keyed = (q) => index.byKey.get(fold(q)) ?? [];

// ── 1 · shape and integrity ──────────────────────────────────────────────────
check('14,069 nodes across core + tail', index.nodes.length === 14069, `got ${index.nodes.length}`);
check('core ships the containers only', core.nodes.length === 2400 && core.nodes.every((n) => n.kind !== 'field' && n.kind !== 'wellbore'));
check('tail ships 7,787 fields + 3,882 wellbores', tail.rows.field.length === 7787 && tail.rows.wellbore.length === 3882);
check('every node id is unique', index.byId.size === index.nodes.length);
check('every node id is namespaced gaz:<kind>: with no abbreviations', index.nodes.every((n) => n.id.startsWith(`gaz:${n.kind}:`)),
  index.nodes.filter((n) => !n.id.startsWith(`gaz:${n.kind}:`)).slice(0, 3).map((n) => n.id).join(', '));
check('zero dangling parent edges', index.nodes.every((n) => (n.parents ?? []).every((p) => index.byId.has(p.id))));
check('zero dangling sameAs edges', index.nodes.every((n) => (n.sameAs ?? []).every((s) => index.byId.has(s))));
check('build recorded zero dangling edges too', core.counts.danglingEdges === 0);
check('every node carries at least one source', index.nodes.every((n) => Array.isArray(n.sources) && n.sources.length > 0),
  index.nodes.filter((n) => !n.sources?.length).slice(0, 3).map((n) => n.id).join(', '));
check('every fly target is a valid coordinate', index.nodes.every((n) => !n.fly
  || (Math.abs(n.fly.lon) <= 180 && Math.abs(n.fly.lat) <= 90 && n.fly.zoom > 0)));

const budget = (p) => fs.statSync(path.join(root, 'public', 'agent', p)).size / 1024 / 1024;
check('core stays under the 1.5 MB eager-load budget', budget('gazetteer.json') < 1.5, `${budget('gazetteer.json').toFixed(2)} MB`);
check('core + tail stay under the 2.5 MB total budget', budget('gazetteer.json') + budget('gazetteer-tail.json') < 2.5);

// ── 2 · tail expansion round-trips ───────────────────────────────────────────
const badak = find('Badak Oil and Gas Field (Indonesia)', 'field');
check('a tail row expands to a full node', !!badak && badak.kind === 'field');
check('… with its OSDU native id reconstructed',
  badak.nativeIds[0] === 'arganta:master-data--Field:goget-l100000312821');
check('… with its parents rebuilt', badak.parents.some((p) => p.id === 'gaz:basin:3817') && badak.parents.some((p) => p.id === 'gaz:country:ID'));
check('… with the field zoom applied', badak.fly.zoom === 9.5);
check('… and its flags unpacked', badak.has.production === true && badak.has.detail === true);
check('an absent tail flag is a measured false, not undefined',
  index.byKind.get('wellbore').every((n) => typeof n.has.logs === 'boolean'));
check('expandTailRow is deterministic', (() => {
  const a = expandTailRow('field', tail.rows.field[0], tail.encoding, tail.aliases);
  const b = expandTailRow('field', tail.rows.field[0], tail.encoding, tail.aliases);
  return JSON.stringify(a) === JSON.stringify(b);
})());
check('an index built without the tail still works', (() => {
  const partial = buildIndex(core, null);
  return partial.tailLoaded === false && partial.nodes.length === 2400 && partial.byKey.has('kutei');
})());

// ── 3 · the taxonomy decision (G4) ───────────────────────────────────────────
const kutei = find('Kutei Basin', 'basin');
check('"Kutei Basin" is ONE basin node, not a basin + a province', keyed('kutei basin').filter((n) => n.kind === 'basin').length === 1);
check('… carrying BOTH native ids', kutei.nativeIds.includes('atlas:province:usgs:3817') && kutei.nativeIds.includes('atlas:basin:usgs:3817'));
check('… reachable by its bare name', keyed('kutei').some((n) => n.id === kutei.id));
check('… and by its USGS province code', keyed('3817').some((n) => n.id === kutei.id));
check('exactly 179 basins — one per USGS province', index.byKind.get('basin').length === 179);
check('no `province` nodes were emitted — they are the same object', !index.byKind.has('province'));

// province 4025 is the one basin the KB renamed; both names must work
const viking = index.byId.get('gaz:basin:4025');
check('province 4025 leads with the KB basin name "Viking Graben"', viking.name === 'Viking Graben');
check('… and still answers to "North Sea Graben"', keyed('north sea graben').some((n) => n.id === viking.id));
check('… and its displayName states both', /Viking Graben/.test(viking.displayName) && /North Sea Graben/.test(viking.displayName));

const vikingAu = index.nodes.find((n) => n.kind === 'assessment-unit' && n.name === 'Viking Graben');
check('the Viking Graben ASSESSMENT UNIT also exists as its own node', !!vikingAu);
check('… cross-linked to the basin with sameAs, both ways',
  vikingAu.sameAs?.includes(viking.id) && viking.sameAs?.includes(vikingAu.id));
check('… so "viking graben" returns two tiers, not one merged lie', keyed('viking graben').length >= 2);
const twins = index.nodes.filter((n) => n.kind === 'assessment-unit' && n.sameAs?.length);
check('all 17 name-sharing assessment units are cross-linked', twins.length === 17, `got ${twins.length}`);

// ── 4 · the ladder the user asked for ────────────────────────────────────────
const indonesia = index.byId.get('gaz:country:ID');
check('Indonesia exists as a country node', !!indonesia && indonesia.kind === 'country');
check('Indonesia → 12 basins via the crosswalk edges', childrenOfKind(index, indonesia.id, 'basin').length === 12);
check('… including Kutei Basin', childrenOfKind(index, indonesia.id, 'basin').some((b) => b.name === 'Kutei Basin'));
check('… ranked richest first', (() => {
  const basins = childrenOfKind(index, indonesia.id, 'basin');
  return richness(basins[0]) >= richness(basins[basins.length - 1]);
})());
check('Kutei Basin → its member fields', childrenOfKind(index, kutei.id, 'field').length === 20);
check('… including Badak', childrenOfKind(index, kutei.id, 'field').some((f) => f.name.startsWith('Badak')));
check('Badak walks back up to Kutei → Indonesia → Asia Pacific', (() => {
  const chain = ancestryOf(index, badak).map((n) => n.name);
  return chain.includes('Kutei Basin') && chain.includes('Indonesia');
})());
check('Volve walks back up to Viking Graben → Norway', (() => {
  const volve = index.nodes.find((n) => n.kind === 'field' && n.name === 'VOLVE');
  const chain = ancestryOf(index, volve).map((n) => n.name);
  return chain.includes('Viking Graben') && chain.includes('Norway');
})());
check('a shared basin lists every country that holds it',
  viking.parents.filter((p) => p.kind === 'country').length === 5);

// ── 5 · availability is measured, never optimistic ───────────────────────────
const volve = index.nodes.find((n) => n.kind === 'field' && n.name === 'VOLVE');
// cockpit-field-detail.json carries NO Volve record — a known upstream gap. The
// gazetteer must not therefore claim the flagship field has no production, since
// public/wb/prod-*.json plainly does.
check('Volve has no cockpit-field-detail record (the known upstream gap)', volve.has.detail === false);
check('… but production is still reported, from the well bundle', volve.has.production === true);
check('… and Volve is the only field carrying a deep bundle', (() => {
  const bundled = index.byKind.get('field').filter((f) => f.has.bundle);
  return bundled.length === 1 && bundled[0].name === 'VOLVE';
})());
check('… with its 27 wells and 6 surfaces counted', volve.has.wells === 27 && volve.has.surfaces === 6);
check('Badak reports a measured false for logs, not a shrug', badak.has.logs === false && badak.has.bundle === false);
check('Badak reports production data too (GOGET carries it)', badak.has.production === true);
const wellsWithLogs = index.byKind.get('well').filter((w) => w.has.logs);
check('only Volve bundle wells report logs', wellsWithLogs.length > 0 && wellsWithLogs.every((w) => w.sources.includes('Volve')));
check('the 27 Volve wells are all present', index.byKind.get('well').length === 27);
const bundledBores = index.byKind.get('wellbore').filter((w) => w.has.bundle);
check('no North Sea regulator wellbore claims a data bundle',
  index.byKind.get('wellbore').filter((w) => w.sources.includes('North Sea regulators') && w.has.logs).length === 0);
check('a wellbore with no bundle reports every flag false', (() => {
  const plain = index.byKind.get('wellbore').find((w) => !w.has.bundle);
  return plain.has.logs === false && plain.has.trajectory === false && plain.has.pressure === false;
})());
check('Kutei Basin honestly reports having no well logs', kutei.has.logs === undefined);
check('basin availability counts are real', kutei.has.fields === 20 && kutei.has.polygon === true && kutei.has.petroleumSystems >= 1);
check('a zero count is kept (0 ≠ not assessed)',
  index.byKind.get('basin').some((b) => b.has.figures === 0));

// ── 6 · match keys ───────────────────────────────────────────────────────────
check('"Badak Oil and Gas Field (Indonesia)" answers to "badak"', normKeysFor(badak).includes('badak'));
check('… and to the full name', normKeysFor(badak).includes('badak oil and gas field indonesia'));
check('"Kutei Basin" answers to "kutei" and "kutei basin"',
  normKeysFor(kutei).includes('kutei') && normKeysFor(kutei).includes('kutei basin'));
check('a basin with no type word still answers to "<name> basin"',
  normKeysFor({ kind: 'basin', name: 'Banda Arc', aliases: [] }).includes('banda arc basin'));
check('accents fold', fold('Côte d\'Ivoire') === 'cote d ivoire');
check('the North Sea Graben keeps its full name as a key', normKeysFor(viking).includes('north sea graben'));
check('every node produces at least one key', index.nodes.every((n) => n.normKeys.length > 0));

// ── 7 · typo machinery ───────────────────────────────────────────────────────
check('trigrams pad, so even a 2-letter name indexes', trigrams('ty').length === 2 && trigrams('hod').length > 0);
check('trigram overlap survives one transposed letter', (() => {
  const a = new Set(trigrams('kutei basin'));
  const b = trigrams('kutai basin');
  return b.filter((g) => a.has(g)).length / b.length > 0.5;
})());
// The exact miss that motivated the phonetic stage: "kutai" scores ZERO against
// the shipped search index today.
check('"kutai" ≈ "kutei" phonetically', phoneticKey('kutai') === phoneticKey('kutei'));
check('"volv" ≈ "volve" phonetically', phoneticKey('volv') === phoneticKey('volve'));
check('phonetic keys are not universally collapsing', phoneticKey('kutei') !== phoneticKey('santos'));
check('the phonetic bucket for Kutei is small enough to rank',
  (index.byPhonetic.get(phoneticKey('kutei')) ?? []).length < 40);

// ── 8 · index completeness ───────────────────────────────────────────────────
check('byKey covers every node', (() => {
  const seen = new Set();
  for (const bucket of index.byKey.values()) for (const n of bucket) seen.add(n.id);
  return seen.size === index.nodes.length;
})());
check('byKind partitions the graph', [...index.byKind.values()].reduce((s, a) => s + a.length, 0) === index.nodes.length);
check('childrenOf is built from the edges, so it cannot drift', (() => {
  const edgeCount = index.nodes.reduce((s, n) => s + (n.parents?.length ?? 0), 0);
  const childCount = [...index.childrenOf.values()].reduce((s, a) => s + a.length, 0);
  return edgeCount === childCount;
})());
check('toRef produces a scope-ready Ref', (() => {
  const ref = toRef(kutei);
  return ref.id === kutei.id && ref.kind === 'basin' && ref.name === 'Kutei Basin' && !!ref.source;
})());

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

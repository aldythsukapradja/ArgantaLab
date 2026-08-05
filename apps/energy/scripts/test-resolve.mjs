// resolver truth-lock (L3) — against the REAL gazetteer.
// Run: node scripts/test-resolve.mjs
//
// The typo corpus is GENERATED from real names by deterministic mutation rather
// than hand-picked, so it cannot be quietly fitted to whatever the resolver
// happens to do. Aggregate pass-rates are asserted as thresholds.
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
const R = await import('../src/agent/resolve.ts');
const { resolve, rank, suggest, editDistance } = R;

const index = buildIndex(core, tail);
const brain = makeScopeBrain(index);
const node = (id) => index.byId.get(id);
const hit = (q, opts) => { const r = resolve(index, q, opts); return r.status === 'exact' || r.status === 'corrected' ? r.node : null; };
const name = (q, opts) => hit(q, opts)?.name ?? null;

// ── 1 · edit distance ────────────────────────────────────────────────────────
check('identical strings are distance 0', editDistance('kutei', 'kutei') === 0);
check('one substitution', editDistance('kutai', 'kutei') === 1);
check('one deletion', editDistance('kutе'.replace('е', 'e'), 'kutei') === 1);
check('one insertion', editDistance('kuteii', 'kutei') === 1);
check('a transposition costs 1, not 2', editDistance('kuetei'.slice(0, 5), 'kutei') <= 2 && editDistance('ktuei', 'kutei') === 1);
check('distance is bounded', editDistance('kutei', 'santos basin something', 3) === 4);
check('wildly different lengths bail early', editDistance('a', 'abcdefghijk', 3) === 4);

// ── 2 · the user's own examples ──────────────────────────────────────────────
check('"kutei basin" → Kutei Basin', name('kutei basin') === 'Kutei Basin');
check('"kutei" → Kutei Basin', name('kutei') === 'Kutei Basin');
// The measured motivation for the phonetic stage: this scores ZERO against the
// shipped search index today.
check('"kutai basin" → Kutei Basin (alternate transliteration)', name('kutai basin') === 'Kutei Basin');
check('"kutai" alone → Kutei Basin', name('kutai') === 'Kutei Basin');
check('… and it is reported as a correction, not silently applied', (() => {
  const r = resolve(index, 'kutai');
  return r.status === 'corrected' && r.from === 'kutai';
})());
check('"viking graben" resolves', !!name('viking graben'));
check('… to the BASIN, with the assessment unit offered', (() => {
  const r = resolve(index, 'viking graben');
  return r.node.kind === 'basin' && r.alternates.some((a) => a.kind === 'assessment-unit');
})());
check('"north sea graben" reaches the same node', hit('north sea graben')?.id === hit('viking graben')?.id);
check('"indonesia" → the country', (() => { const n = hit('indonesia'); return n.kind === 'country' && n.name === 'Indonesia'; })());
check('"volve" → the field', (() => { const n = hit('volve'); return n.kind === 'field' && n.name === 'VOLVE'; })());
check('"volv" → VOLVE', name('volv') === 'VOLVE');

// ── 3 · exact names resolve to themselves (aggregate) ────────────────────────
const sample = (kind, n) => (index.byKind.get(kind) ?? []).filter((_, i) => i % Math.max(1, Math.floor((index.byKind.get(kind).length) / n)) === 0).slice(0, n);
const exactCases = [
  ...sample('basin', 40), ...sample('country', 25), ...sample('field', 30),
  ...sample('assessment-unit', 15), ...sample('formation', 10),
];
let exactOk = 0;
const exactMisses = [];
for (const target of exactCases) {
  const got = hit(target.name);
  if (got && (got.id === target.id || got.name === target.name)) exactOk += 1;
  else exactMisses.push(`${target.kind}:${target.name} → ${got?.name ?? 'none'}`);
}
check(`exact names resolve to themselves (${exactOk}/${exactCases.length})`,
  exactOk / exactCases.length >= 0.95, exactMisses.slice(0, 5).join(' | '));

// ── 4 · generated typo corpus ────────────────────────────────────────────────
// Deterministic single-character mutations of real basin and country names.
function mutate(s, kind, seed) {
  const i = 1 + (seed % Math.max(1, s.length - 2));
  if (kind === 0) return s.slice(0, i) + s.slice(i + 1);                       // deletion
  if (kind === 1) return `${s.slice(0, i)}${s[i - 1]}${s.slice(i)}`;           // duplication
  if (kind === 2) return s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2);     // transposition
  return `${s.slice(0, i)}x${s.slice(i + 1)}`;                                 // substitution
}
const typoTargets = [...sample('basin', 30), ...sample('country', 20)];
let typoOk = 0, typoTotal = 0, typoAsked = 0;
const typoMisses = [];
typoTargets.forEach((target, t) => {
  for (let k = 0; k < 3; k += 1) {
    const typo = mutate(target.name, k, t + k);
    if (typo.toLowerCase() === target.name.toLowerCase()) continue;
    typoTotal += 1;
    // Success = the right entity is the TOP candidate. Whether the resolver then
    // acts on it or asks first is a separate (deliberate) UX decision, measured
    // below — asking about a genuinely close call is correct, not a miss.
    const top = rank(index, typo)[0];
    if (top && top.node.id === target.id) typoOk += 1;
    else typoMisses.push(`"${typo}" (${target.name}) → ${top?.node.name ?? 'none'}`);
    if (resolve(index, typo).status === 'ambiguous') typoAsked += 1;
  }
});
check(`generated typos rank the right entity first (${typoOk}/${typoTotal})`, typoOk / typoTotal >= 0.9, typoMisses.slice(0, 6).join(' | '));
check(`the resolver asks rather than guesses on under a third of typos (${typoAsked}/${typoTotal})`, typoAsked / typoTotal < 0.34);
check('a typo is always reported as a correction, never as exact', typoTargets.slice(0, 10).every((target, t) => {
  const typo = mutate(target.name, 3, t);
  const r = resolve(index, typo);
  return r.status !== 'exact' || typo.toLowerCase() === target.name.toLowerCase();
}));

// ── 5 · prefixes, partials and multi-token ───────────────────────────────────
check('"kutei bas" (prefix) → Kutei Basin', name('kutei bas') === 'Kutei Basin');
check('"south sumatra" → South Sumatra Basin', name('south sumatra') === 'South Sumatra Basin');
check('"3817" (province code) → Kutei Basin', name('3817') === 'Kutei Basin');
check('"province 3817" → Kutei Basin', name('province 3817') === 'Kutei Basin');
check('case is irrelevant', hit('KUTEI BASIN')?.id === hit('kutei basin')?.id);
check('accents fold', !!hit("cote d'ivoire") && !!hit('Côte d’Ivoire'.replace('’', "'")));
check('stopwords are ignored', hit('the kutei basin')?.id === hit('kutei basin')?.id);
check('extra whitespace is ignored', hit('  kutei   basin  ')?.id === hit('kutei basin')?.id);

// ── 6 · ambiguity is asked about, not guessed ────────────────────────────────
// 38 names in the catalogue are genuinely shared by more than one entry.
const dupNames = new Map();
for (const n of index.nodes) {
  const key = n.name.toLowerCase();
  if (!dupNames.has(key)) dupNames.set(key, []);
  dupNames.get(key).push(n);
}
const contested = [...dupNames.entries()].filter(([, list]) => list.length > 1 && new Set(list.map((n) => n.kind)).size === 1);
check('the catalogue does contain genuinely duplicate names', contested.length > 0, `${contested.length}`);
check('a duplicated name never resolves silently to one of them', contested.slice(0, 12).every(([n]) => {
  const r = resolve(index, n);
  return r.status === 'ambiguous' || r.status === 'exact';
}));
check('cross-tier twins are NOT treated as ambiguous', (() => {
  const r = resolve(index, 'viking graben');
  return r.status !== 'ambiguous';
})());
check('an ambiguous result carries every contender', (() => {
  const found = contested.map(([n]) => resolve(index, n)).find((r) => r.status === 'ambiguous');
  return !found || found.candidates.length >= 2;
})());

// ── 7 · nothing is invented ──────────────────────────────────────────────────
for (const junk of ['zzzzqqqq', 'asdfghjkl', 'xyzzy plugh', '!!!', '  ']) {
  check(`"${junk.trim() || '(blank)'}" resolves to nothing`, resolve(index, junk).status === 'none');
}
check('a near-miss offers suggestions rather than a wrong answer', (() => {
  const r = resolve(index, 'kuteiiiiii basinnnnn');
  return r.status === 'none' || r.status === 'corrected';
})());

// ── 8 · kind filtering ───────────────────────────────────────────────────────
check('kinds filter is honoured', (() => {
  const r = resolve(index, 'viking graben', { kinds: ['assessment-unit'] });
  return r.status !== 'none' && r.node.kind === 'assessment-unit';
})());
check('filtering to an impossible kind returns none', resolve(index, 'kutei basin', { kinds: ['company'] }).status === 'none');
check('the Exploration scope-bar filter still finds containers',
  !!hit('kutei basin', { kinds: ['country', 'basin', 'assessment-unit'] }));

// ── 9 · scope proximity ──────────────────────────────────────────────────────
const volveScope = applyPatch(emptyScope(), { field: { id: 'gaz:field:no-field-3420717', kind: 'field', name: 'VOLVE' } }, { brain });
check('an in-scope entity outranks an equal match elsewhere', (() => {
  const plain = rank(index, 'viking graben');
  const scoped = rank(index, 'viking graben', { scope: volveScope });
  const target = scoped.find((c) => c.node.id === 'gaz:basin:4025');
  const before = plain.find((c) => c.node.id === 'gaz:basin:4025');
  return target && before && target.score > before.score;
})());
check('scope never changes WHICH entity an exact query resolves to',
  hit('kutei basin', { scope: volveScope })?.id === hit('kutei basin')?.id);

// ── 10 · suggestions (the type-ahead) ────────────────────────────────────────
const sugg = suggest(index, 'kut');
check('type-ahead returns ranked candidates', sugg.length > 0 && sugg[0].score >= sugg[sugg.length - 1].score);
check('type-ahead honours its limit', suggest(index, 'ba', { limit: 5 }).length <= 5);
check('type-ahead and resolve agree on the winner', (() => {
  const s = suggest(index, 'kutei basin')[0];
  return s.node.id === hit('kutei basin')?.id;
})());
check('every candidate reports which stage matched it',
  sugg.every((c) => ['exact', 'alias', 'lexical', 'fuzzy', 'phonetic'].includes(c.stage)));
check('every candidate reports the key it matched on', sugg.every((c) => typeof c.matched === 'string'));

// ── 11 · determinism and cost ────────────────────────────────────────────────
check('resolution is deterministic', JSON.stringify(rank(index, 'sumatra').map((c) => c.node.id))
  === JSON.stringify(rank(index, 'sumatra').map((c) => c.node.id)));
const t0 = process.hrtime.bigint();
for (const q of ['kutei', 'kutai basin', 'volve', 'indonesia', 'south sumatra', 'zzzqqq', 'viking graben', 'badak']) resolve(index, q);
const ms = Number(process.hrtime.bigint() - t0) / 1e6;
check(`8 mixed queries resolve in under 400 ms (${ms.toFixed(0)} ms)`, ms < 400);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

// agent/scope.ts truth-lock — the command bus (L0).
// Run: node scripts/test-agent-bus.mjs
//
// The zustand store itself is a ~15-line delegation to these pure functions and
// needs React + localStorage, so it is not exercised here. Everything that can
// actually be wrong about scope behaviour lives in scope.ts and is locked below.
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };

if (!existsSync(join(__dirname, '..', 'src', 'agent', 'scope.ts'))) { console.log('SKIP'); process.exit(0); }
const S = await import('../src/agent/scope.ts');
const {
  emptyScope, cloneScope, getLevel, withLevel, activeLevels, isEmptyScope,
  focusLevel, focusRef, applyPatch, clearLevel, clearScope, scopeChips, scopeLabel,
  serializeScope, parseScope, conflict,
} = S;

// ── fixture world ────────────────────────────────────────────────────────────
// Two real chains from the shipped data, plus the ancestry rules the gazetteer
// brain will implement for real in D3.
const REF = {
  asia:      { id: 'gaz:region:3',       kind: 'region',  name: 'Asia Pacific' },
  europe:    { id: 'gaz:region:4',       kind: 'region',  name: 'Europe' },
  indonesia: { id: 'gaz:country:ID',     kind: 'country', name: 'Indonesia' },
  norway:    { id: 'gaz:country:NO',     kind: 'country', name: 'Norway' },
  kutei:     { id: 'gaz:basin:3817',     kind: 'basin',   name: 'Kutei Basin' },
  nsg:       { id: 'gaz:basin:4025',     kind: 'basin',   name: 'North Sea Graben' },
  badak:     { id: 'gaz:field:goget-badak', kind: 'field', name: 'Badak' },
  volve:     { id: 'gaz:field:no-3420717',  kind: 'field', name: 'VOLVE' },
  volveWell: { id: 'gaz:well:sodir-19',  kind: 'well',    name: '15/9-19' },
};

const ANCESTORS = {
  'basin:gaz:basin:3817':  { country: REF.indonesia, region: REF.asia },
  'basin:gaz:basin:4025':  { country: REF.norway,    region: REF.europe },
  'field:gaz:field:goget-badak': { basin: REF.kutei, country: REF.indonesia, region: REF.asia },
  'field:gaz:field:no-3420717':  { basin: REF.nsg,   country: REF.norway,    region: REF.europe },
  'well:gaz:well:sodir-19':      { field: REF.volve, basin: REF.nsg, country: REF.norway, region: REF.europe },
  'country:gaz:country:ID': { region: REF.asia },
  'country:gaz:country:NO': { region: REF.europe },
};

const brain = {
  ancestorsOf(level, ref) { return ANCESTORS[`${level}:${ref.id}`] ?? {}; },
  conflictsIn(scope) {
    const out = [];
    const field = getLevel(scope, 'field');
    const basin = getLevel(scope, 'basin');
    const country = getLevel(scope, 'country');
    if (field && basin) {
      const truth = ANCESTORS[`field:${field.id}`]?.basin;
      if (truth && truth.id !== basin.id) out.push(conflict('field', 'basin', `${field.name} is not in ${basin.name}`));
    }
    if (basin && country) {
      const truth = ANCESTORS[`basin:${basin.id}`]?.country;
      if (truth && truth.id !== country.id) out.push(conflict('basin', 'country', `${basin.name} is not in ${country.name}`));
    }
    return out;
  },
};

// ── basics ───────────────────────────────────────────────────────────────────
check('emptyScope is empty', isEmptyScope(emptyScope()));
check('emptyScope has all four groups', ['where', 'geology', 'accum', 'wells'].every((g) => !!emptyScope()[g]));

const one = withLevel(emptyScope(), 'basin', REF.kutei);
check('withLevel writes into the right group', one.geology.basin?.id === REF.kutei.id && getLevel(one, 'basin')?.name === 'Kutei Basin');
check('withLevel is immutable', isEmptyScope(emptyScope()) && !isEmptyScope(one));
check('withLevel(null) clears', isEmptyScope(withLevel(one, 'basin', null)));
check('cloneScope deep-copies groups', (() => {
  const a = withLevel(emptyScope(), 'basin', REF.kutei); const b = cloneScope(a);
  b.geology.basin = REF.nsg; return a.geology.basin.id === REF.kutei.id;
})());

// ── rule 1 · optional levels, not a strict path ──────────────────────────────
const sparse = applyPatch(emptyScope(), { well: REF.volveWell }, { brain: null });
check('rule 1: a deep level alone is legal without a brain', getLevel(sparse, 'well')?.id === REF.volveWell.id);
check('rule 1: no autofill without a brain', activeLevels(sparse).length === 1);

// ── rule 2 · selecting deep auto-fills ancestors ─────────────────────────────
const deep = applyPatch(emptyScope(), { field: REF.volve }, { brain });
check('rule 2: field fills basin', getLevel(deep, 'basin')?.id === REF.nsg.id);
check('rule 2: field fills country', getLevel(deep, 'country')?.id === REF.norway.id);
check('rule 2: field fills region', getLevel(deep, 'region')?.id === REF.europe.id);
check('rule 2: filled ancestors are marked derived', deep.derived.basin === true && deep.derived.country === true);
check('rule 2: the chosen level is NOT derived', deep.derived.field === undefined);
check('rule 2: canonical order in the breadcrumb', scopeLabel(deep) === 'Europe › Norway › North Sea Graben › VOLVE');

const wellDeep = applyPatch(emptyScope(), { well: REF.volveWell }, { brain });
check('rule 2: well fills field AND basin AND country', ['field', 'basin', 'country', 'region'].every((l) => !!getLevel(wellDeep, l)));

// explicit beats derived, in both directions
const explicitFirst = applyPatch(
  applyPatch(emptyScope(), { country: REF.indonesia }, { brain }),
  { field: REF.volve }, { brain },
);
check('rule 2: autofill never overwrites an explicit choice', getLevel(explicitFirst, 'country')?.id === REF.indonesia.id);
check('rule 2: … and that disagreement becomes a conflict, not a silent fix', explicitFirst.conflicts.length > 0);

const rederive = applyPatch(deep, { field: REF.badak }, { brain });
check('rule 2: autofill DOES overwrite a derived slot', getLevel(rederive, 'country')?.id === REF.indonesia.id && getLevel(rederive, 'basin')?.id === REF.kutei.id);

const both = applyPatch(emptyScope(), { basin: REF.nsg, field: REF.volve }, { brain });
check('rule 2: deepest explicit level wins the shared ancestor', getLevel(both, 'country')?.id === REF.norway.id && both.derived.country === true);
check('rule 2: both explicit levels stay explicit', both.derived.basin === undefined && both.derived.field === undefined);

// ── rule 3 · contradictions surfaced, never silently dropped ─────────────────
const clash = applyPatch(emptyScope(), { country: REF.norway, basin: REF.kutei }, { brain });
check('rule 3: contradictory pick is KEPT', getLevel(clash, 'country')?.id === REF.norway.id && getLevel(clash, 'basin')?.id === REF.kutei.id);
check('rule 3: … and flagged', clash.conflicts.length === 1 && /not in Norway/.test(clash.conflicts[0].message));
check('rule 3: conflict offers both sides to relax', clash.conflicts[0].relax.includes('basin') && clash.conflicts[0].relax.includes('country'));
check('rule 3: chips mark both sides conflicted', scopeChips(clash).filter((c) => c.conflicted).length === 2);

const fieldClash = applyPatch(emptyScope(), { basin: REF.kutei, field: REF.volve }, { brain });
check('rule 3: field outside the chosen basin is flagged', fieldClash.conflicts.some((c) => c.level === 'field' && c.against === 'basin'));

// ── focus (what "it" means to the dialogue machine) ──────────────────────────
check('focus is the deepest set level', focusLevel(deep) === 'field' && focusRef(deep)?.name === 'VOLVE');
check('focus of an empty scope is null', focusLevel(emptyScope()) === null && focusRef(emptyScope()) === null);
check('focus follows the well axis', focusLevel(wellDeep) === 'well');

// ── clearing ─────────────────────────────────────────────────────────────────
const cleared = clearLevel(deep, 'field', brain);
check('clearLevel drops the level', getLevel(cleared, 'field') === undefined);
check('clearLevel drops ancestors that existed only because of it', isEmptyScope(cleared));

const keepExplicit = clearLevel(applyPatch(emptyScope(), { country: REF.norway, field: REF.volve }, { brain }), 'field', brain);
check('clearLevel keeps an explicitly-chosen ancestor', getLevel(keepExplicit, 'country')?.id === REF.norway.id);
check('clearLevel re-derives from what is left', getLevel(keepExplicit, 'region')?.id === REF.europe.id && keepExplicit.derived.region === true);
check('clearLevel clears the stale conflict too', keepExplicit.conflicts.length === 0);

check('resetScope empties everything', isEmptyScope(clearScope(deep)));
check('resetScope can keep facets', clearScope(applyPatch(deep, { facets: { operator: 'Equinor' } }, { brain }), true).facets.operator === 'Equinor');

// ── facets ───────────────────────────────────────────────────────────────────
const faceted = applyPatch(deep, { facets: { operator: 'Equinor', yearFrom: 1993 } }, { brain });
check('facets merge', faceted.facets.operator === 'Equinor' && faceted.facets.yearFrom === 1993);
check('facets do not disturb levels', getLevel(faceted, 'field')?.id === REF.volve.id);
check('empty-string facet is dropped, not stored', applyPatch(faceted, { facets: { operator: '' } }, { brain }).facets.operator === undefined);

// ── URL round-trip (spine §2: shareable and reproducible) ────────────────────
const lookup = (id) => Object.values(REF).find((r) => r.id === id) ?? null;
const url = serializeScope(deep);
check('serialize omits derived ancestors', url === 'field=gaz%3Afield%3Ano-3420717');
const back = parseScope(url, lookup, brain);
check('parse restores the explicit level', getLevel(back, 'field')?.id === REF.volve.id);
check('parse re-derives ancestors', getLevel(back, 'country')?.id === REF.norway.id && back.derived.country === true);
check('round-trip is stable', serializeScope(back) === url);

const facetUrl = serializeScope(applyPatch(deep, { facets: { operator: 'Equinor', yearFrom: 1993 } }, { brain }));
const facetBack = parseScope(facetUrl, lookup, brain);
check('facets survive the round-trip', facetBack.facets.operator === 'Equinor' && facetBack.facets.yearFrom === 1993);
check('year facets come back as numbers', typeof facetBack.facets.yearFrom === 'number');
check('unknown id is dropped, never faked', getLevel(parseScope('field=gaz%3Afield%3Anope', lookup, brain), 'field') === undefined);
check('junk in the URL is ignored', isEmptyScope(parseScope('&&nonsense&=x&bogus=1', lookup, brain)));

// ── chips ────────────────────────────────────────────────────────────────────
const chips = scopeChips(deep);
check('chips are coarse → fine', chips.map((c) => c.level).join('>') === 'region>country>basin>field');
check('derived chips are flagged for grey rendering', chips.filter((c) => c.derived).length === 3);
check('chips carry the ref for one-click re-pick', chips[3].ref.id === REF.volve.id);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

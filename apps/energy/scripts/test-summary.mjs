// summary truth-lock — the closing line may never carry a number the card lacks.
//
// summary.ts writes prose, and prose is where fabricated figures live. The whole
// design rests on one claim: the summary is held to the SAME grounding guard as
// the language model's output, with no exemption for being "our own" code. These
// assertions are what makes that claim checkable rather than aspirational.
//
// Run: node scripts/test-summary.mjs
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
const { ungroundedNumbers } = await import('../src/agent/guard.ts');

const index = buildIndex(core, tail);
const brain = makeScopeBrain(index);

function ask(text) {
  let scope = emptyScope();
  const result = respond(index, newTurn(), text, scope);
  for (const c of result.commands) {
    if (c.op === 'scope') scope = applyPatch(scope, c.patch, { brain, autofill: c.autofill, reroot: c.reroot });
  }
  const trace = buildTrace({
    facts: result.facts, card: result.card, capabilityId: result.plan?.capabilityId ?? null,
    commands: result.commands, node: result.turn.focus, tier: 'lite', elapsedMs: 0.4,
  });
  return { ...result, trace, summary: summarise(result.card, result.facts, trace) };
}

// ── 1 · the grounding guarantee, swept across the catalogue ─────────────────
{
  const queries = [
    'volve', 'kutei basin', 'viking graben', 'indonesia', 'norway', 'brazil',
    'which basins are in norway', 'fields in the kutei basin', 'give me insight about indonesia',
    'kutei bassin', 'vikng graben', 'zzqxwv plutonium', 'compare volve and badak',
    'production history for volve', 'wells in volve', 'north sea', 'campos basin',
  ];
  let checked = 0, leaks = 0;
  for (const q of queries) {
    const { card, summary } = ask(q);
    if (!summary.text) continue;
    checked++;
    const bad = ungroundedNumbers(summary.text, card);
    if (bad.length) { leaks++; console.log(`     LEAK "${q}" → ${bad.join(', ')}`); }
  }
  check('no summary anywhere carries an ungrounded number', leaks === 0, `${checked} summaries checked`);
  check('the sweep actually produced summaries to check', checked >= 8, `${checked} of ${queries.length}`);
}

// ── 2 · a fabricated figure IS caught (the guard is live, not decorative) ───
{
  const card = { kind: 'brief', headline: 'Volve', subhead: 'field', facts: [{ label: 'Operator', value: 'Equinor', source: 'Sodir' }], chips: [], provenance: ['Sodir'] };
  check('an invented figure would be rejected by the same guard',
    ungroundedNumbers('Volve recovered 63.2 MMbbl.', card).includes('63.2'));
  check('a figure copied off the card passes',
    ungroundedNumbers('Volve is operated by Equinor.', card).length === 0);
}

// ── 3 · derived counts are spelled, so they cannot trip the guard ───────────
{
  let sawDigitOnlyFromCard = true;
  for (const q of ['volve', 'norway', 'indonesia', 'kutei basin']) {
    const { card, summary } = ask(q);
    if (!summary.text) continue;
    // Trailing punctuation is not part of a number — "…fields 3, fields…"
    // yields "3", not "3,". guard.ts is the authority; this mirrors it.
    const nums = (summary.text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/[.,]+$/, ''));
    const onCard = new Set([...JSON.stringify(card).matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => m[0].replace(/[.,]+$/, '')));
    if (!nums.every((n) => onCard.has(n))) sawDigitOnlyFromCard = false;
  }
  check('every digit in a summary is a digit from the card', sawDigitOnlyFromCard);
}

// ── 4 · it says something worth reading ─────────────────────────────────────
{
  const volve = ask('volve');
  check('a real entity gets a real summary', volve.summary.text.length > 30, volve.summary.text.slice(0, 110));
  check('the summary names the subject', volve.summary.text.includes(volve.card.headline), volve.card.headline);
  check('the summary is prose, not a fact dump',
    /[.!?]$/.test(volve.summary.text.trim()) && volve.summary.text.split(' ').length > 6);
}

// ── 5 · caveats are stated, not buried ─────────────────────────────────────
{
  // A typo produces a CONFIRMATION card, not a silent swap — so the summary's
  // job is to show the proposed correction and say plainly that nothing moved.
  const typo = ask('kutei bassin');
  check('a proposed correction names both spellings',
    /kutei bassin/i.test(typo.summary.text) && /Kutei Basin/.test(typo.summary.text), typo.summary.text.slice(0, 110));
  check('a proposed correction says nothing has moved yet',
    /nothing has moved/i.test(typo.summary.text));

  const junk = ask('zzqxwv plutonium');
  check('an unresolvable query never gets a confident summary',
    !junk.summary.text || !/The numbers that matter/.test(junk.summary.text), junk.summary.text.slice(0, 90) || '(none)');
}

// ── 5b · the copy bugs that shipped once and must not again ───────────────
{
  // "Undiscovered oil (mean)" once ranked as high as a booked "Discovered"
  // volume, because the keyword matched as a substring. A screening-scale mean
  // is not the number you lead a basin review with.
  const kutei = ask('kutei basin');
  check('a screening-scale mean does not lead the summary',
    !/^.*Key figures — undiscovered/i.test(kutei.summary.text), kutei.summary.text.slice(0, 80));

  // Categorical facts were once announced under "the numbers that matter",
  // producing "reserves data no, country Norway".
  const volve = ask('volve');
  const keyPart = volve.summary.text.match(/Key figures — ([^.]*)\./)?.[1] ?? '';
  check('only facts with digits appear as figures',
    keyPart === '' || keyPart.split(/,| and /).every((p) => /\d/.test(p)), keyPart);

  // Acronyms were flattened to "Usgs region".
  const norway = ask('norway');
  check('acronyms survive mid-sentence', !/Usgs|Ogst|Anp/.test(norway.summary.text), norway.summary.text.slice(0, 80));

  // A note ending in "." once produced "borders..".
  for (const q of ['volve', 'kutei basin', 'norway', 'indonesia']) {
    const t = ask(q).summary.text;
    if (/\.\./.test(t)) { check(`no doubled full stop — "${q}"`, false, t.slice(-40)); break; }
  }
  check('no doubled full stops anywhere', !['volve', 'kutei basin', 'norway', 'indonesia'].some((q) => /\.\./.test(ask(q).summary.text)));
}

// ── 6 · single-source provenance is called out ─────────────────────────────
{
  const card = {
    kind: 'brief', headline: 'Test Field', subhead: 'field',
    facts: [
      { label: 'Operator', value: 'Someone', source: 'Sodir' },
      { label: 'Wells', value: '27', source: 'Sodir' },
    ],
    chips: [], provenance: ['Sodir'],
  };
  const s = summarise(card, { verb: 'show', usesFocus: false, query: 'test field' });
  check('a lone source behind several facts is flagged', /one source/i.test(s.text), s.text.slice(0, 130));

  // One fact from one source is not an analysis, and telling someone to
  // corroborate a single count is noise dressed as rigour.
  const solo = summarise({ ...card, facts: [card.facts[0]] }, { verb: 'show', usesFocus: false, query: 'test field' });
  check('a single quoted fact draws no corroboration lecture', !/one source/i.test(solo.text), solo.text.slice(0, 110));

  // The claim must be true of the FACTS QUOTED, not of the card's badge strip —
  // Volve's strip listed one badge while its facts cited four separate sources.
  const many = summarise({
    ...card, provenance: ['Sodir'],
    facts: [
      { label: 'Operator', value: 'Someone', source: 'Sodir' },
      { label: 'Wells', value: '27', source: 'Volve bundle' },
    ],
  }, { verb: 'show', usesFocus: false, query: 'test field' });
  check('a one-badge card whose facts cite several is not called single-source',
    !/one source/i.test(many.text), many.text.slice(0, 130));
}

// ── 7 · a derived figure is never passed off as measured ───────────────────
{
  const card = {
    kind: 'brief', headline: 'Test Field', subhead: 'field',
    facts: [{ label: 'Recovery factor', value: '54%', note: 'inferred from the creaming curve. Screening scale only.' }],
    chips: [], provenance: ['USGS', 'Sodir'],
  };
  const s = summarise(card, { verb: 'show', usesFocus: false, query: 'test field' });
  check('a derived figure is labelled derived', /derived rather than measured/i.test(s.text), s.text.slice(0, 150));
  check('only the head of a long note is quoted',
    /creaming curve/.test(s.text) && !/Screening scale only/.test(s.text), s.text.slice(-60));
}

// ── 8 · an empty summary is empty, never a filler sentence ─────────────────
{
  const bare = summarise({ kind: 'brief', headline: '', facts: [], chips: [], provenance: [] },
    { verb: 'show', usesFocus: false, query: '' });
  check('nothing to say produces nothing, not filler', bare.text === '' && bare.skipped === 'nothing-to-say', bare.text || '(empty)');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

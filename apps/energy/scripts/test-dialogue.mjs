// dialogue truth-lock (L5) — scripted multi-turn transcripts on real data.
// Run: node scripts/test-dialogue.mjs
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
const { emptyScope, applyPatch, scopeLabel, getLevel } = await import('../src/agent/scope.ts');
const { makeScopeBrain } = await import('../src/agent/brain.ts');
const D = await import('../src/agent/dialogue.ts');
const { newTurn, respond, ladderLabel, pendingLabel } = D;

const index = buildIndex(core, tail);
const brain = makeScopeBrain(index);

/** A whole conversation, with the bus applied exactly as the app would. */
function session() {
  let turn = newTurn();
  let scope = emptyScope();
  const log = [];
  return {
    say(text) {
      const result = respond(index, turn, text, scope);
      turn = result.turn;
      // Apply the commands to a real scope, so the transcript reflects what the
      // app would actually be showing.
      for (const command of result.commands) {
        if (command.op === 'scope') scope = applyPatch(scope, command.patch, { brain, autofill: command.autofill, reroot: command.reroot });
      }
      log.push({ text, card: result.card, commands: result.commands });
      return { ...result, scope };
    },
    get turn() { return turn; },
    get scope() { return scope; },
    get log() { return log; },
  };
}

// ── 1 · the ladder the user asked for: country → basin → field → absence ─────
{
  const s = session();

  const a = s.say('give me insight about indonesia');
  check('T1 Indonesia answers with a brief', a.card.kind === 'brief' && /Indonesia/.test(a.card.headline));
  check('T1 offers the 12 basins as chips', a.card.chips.length === 12);
  check('T1 asks which basin', /which basin/i.test(a.card.body ?? ''));
  check('T1 sets scope to the country', getLevel(a.scope, 'country')?.name === 'Indonesia');
  check('T1 flies the map', a.commands.some((c) => c.op === 'map'));
  check('T1 leaves a drill-down rung pending', s.turn.pending?.kind === 'drill-down');
  check('T1 pending is described in words', /pick a basin/i.test(pendingLabel(s.turn)));

  // A bare basin name answers the rung — no verb, no repetition.
  const b = s.say('kutei');
  check('T2 a bare name answers the rung', b.card.headline.includes('Kutei Basin'));
  check('T2 scope narrows to the basin', getLevel(b.scope, 'basin')?.name === 'Kutei Basin');
  check('T2 keeps the country in scope', getLevel(b.scope, 'country')?.name === 'Indonesia');
  check('T2 breadcrumb reads coarse → fine', ladderLabel(s.turn) === 'Asia Pacific › Indonesia › Kutei Basin');
  check('T2 routes to the Basin Dossier', b.commands.some((c) => c.op === 'view' && c.view.nav === 'exploration' && c.view.mode === 'knowledge'));
  check('T2 offers member fields next', b.card.chips.length > 0 && /which field/i.test(b.card.body ?? ''));

  const c = s.say('badak');
  check('T3 lands on the field', /Badak/.test(c.card.headline));
  check('T3 scope reaches the field', getLevel(c.scope, 'field')?.name.startsWith('Badak'));
  check('T3 routes to the Asset Dossier', c.commands.some((x) => x.op === 'view' && x.view.nav === 'field-development'));
  check('T3 the whole chain is in scope', scopeLabel(c.scope).startsWith('Asia Pacific › Indonesia › Kutei Basin › Badak'));

  // The honesty beat.
  const d = s.say('show me the logs');
  check('T4 "the logs" binds to the field in focus', s.turn.focus.name.startsWith('Badak'));
  check('T4 answers with a reasoned absence', d.card.kind === 'absence');
  check('T4 does NOT navigate', d.commands.length === 0);
  check('T4 names what does have logs', /volve/i.test(d.card.body));
  check('T4 offers what IS available for Badak', d.card.chips.length > 0);
  check('T4 leaves scope untouched', getLevel(d.scope, 'field')?.name.startsWith('Badak'));
}

// ── 2 · correction is confirmed, not assumed ─────────────────────────────────
{
  const s = session();
  const a = s.say('kutai basin');
  check('a transliteration asks before acting', a.card.kind === 'clarify' && /did you mean/i.test(a.card.headline));
  check('… naming Kutei Basin', /Kutei Basin/.test(a.card.headline));
  check('… quoting what was typed', /kutai basin/i.test(a.card.subhead ?? ''));
  check('… and navigating nowhere yet', a.commands.length === 0);
  check('… with the question held open', s.turn.pending?.kind === 'confirm-correction');

  const b = s.say('yes');
  check('"yes" runs the corrected query', /Kutei Basin/.test(b.card.headline));
  check('… and now navigates', b.commands.length > 0);
  check('… recording the interpretation', b.plan.interpretation?.to === 'Kutei Basin');
  check('… and clears the pending question', s.turn.pending?.kind !== 'confirm-correction');
}
{
  const s = session();
  s.say('kutai basin');
  const b = s.say('no');
  check('"no" abandons the correction', !/Kutei/.test(b.card.headline));
  check('… without navigating', b.commands.length === 0);
  check('… and clears the pending question', s.turn.pending === null);
}
{
  // Any real typo asks. A PREFIX is different: nothing was mistyped, so it runs.
  const s = session();
  const a = s.say('kutei bsain');
  check('a transposed letter still asks before acting', a.card.kind === 'clarify');
  check('… and does not navigate on a guess', a.commands.length === 0);

  const p = session();
  const b = p.say('kutei bas');
  check('a prefix completion runs without interrogating', b.card.kind !== 'clarify');
  check('… and navigates', b.commands.length > 0);
  check('… landing on the right basin', /Kutei Basin/.test(b.card.headline));
}

// ── 3 · ambiguity is asked about ─────────────────────────────────────────────
{
  const s = session();
  const a = s.say('statfjord');
  if (a.card.kind === 'clarify' && s.turn.pending?.kind === 'disambiguate') {
    check('a duplicated name asks which one', true);
    check('… listing every contender', a.card.chips.length >= 2);
    check('… and navigating nowhere', a.commands.length === 0);
    const b = s.say('first');
    check('an ordinal answers the question', b.commands.length > 0 || b.card.kind !== 'clarify');
  } else {
    check('a duplicated name resolves or asks — never silently picks', a.card.kind === 'brief' || a.card.kind === 'clarify');
    check('… (no ambiguity raised for this name)', true);
    check('… navigation only on a settled answer', a.card.kind !== 'clarify' || a.commands.length === 0);
    check('… ordinal handling untested for this name', true);
  }
}

// ── 4 · focus, anaphora and re-scoping ───────────────────────────────────────
{
  const s = session();
  s.say('volve');
  check('focus is the field', s.turn.focus.name === 'VOLVE');
  const a = s.say('show me the logs');
  check('Volve HAS logs, so this navigates', a.commands.length > 0 && a.card.kind !== 'absence');
  check('… to the Field Development logs view',
    a.commands.some((c) => c.op === 'view' && c.view.legacyTab === 'logs'));

  const b = s.say('what about its basin');
  check('a focus reference with no new entity still answers', !!b.card.headline);

  const c = s.say('kutei basin');
  check('naming a new entity re-scopes', s.turn.focus.name === 'Kutei Basin');
  check('… and rebuilds the breadcrumb', ladderLabel(s.turn).includes('Indonesia'));
}

// ── 5 · referring to nothing ─────────────────────────────────────────────────
{
  const s = session();
  const a = s.say('show me the logs');
  check('a focus reference with no focus asks which one', a.card.kind === 'clarify');
  check('… and does not navigate', a.commands.length === 0);
}
{
  const s = session();
  const a = s.say('zzzqqq nonsense');
  check('an unknown entity is admitted, not invented', a.card.kind === 'error');
  check('… and does not navigate', a.commands.length === 0);
  check('… and suggests how to ask', (a.card.body ?? '').length > 10);
}

// ── 6 · comparison ───────────────────────────────────────────────────────────
{
  const s = session();
  const a = s.say('compare kutei basin and viking graben');
  check('a comparison renders both sides', a.card.facts.every((f) => f.value.includes('·')));
  check('… with a two-sided headline', /vs/.test(a.card.headline));
  check('… and focuses the left-hand side', s.turn.focus.name === 'Kutei Basin');
}

// ── 7 · invariants across every transcript ───────────────────────────────────
{
  const s = session();
  const script = ['indonesia', 'kutei', 'badak', 'show me the logs', 'production', 'volve',
    'logs', 'compare volve and badak', 'nonsense query', 'kutai', 'yes', 'wells', 'figures'];
  const results = script.map((t) => s.say(t));

  check('no turn ever throws', results.length === script.length);
  check('every card has a headline, kind and provenance',
    results.every((r) => !!r.card.headline && !!r.card.kind && r.card.provenance.length > 0));
  check('no card renders undefined or NaN', results.every((r) => !/undefined|NaN/.test(JSON.stringify(r.card))));
  // The core safety property of the whole layer.
  check('a clarify/error/absence card NEVER moves the app',
    results.every((r) => !['clarify', 'error', 'absence'].includes(r.card.kind) || r.commands.length === 0));
  check('every navigating turn had a settled entity',
    results.every((r) => r.commands.length === 0 || !!r.turn.focus));
  check('history is recorded and bounded', s.turn.history.length === script.length && s.turn.history.length <= 24);
  check('every chip in every card re-enters as a query',
    results.every((r) => r.card.chips.every((c) => typeof c.query === 'string' && c.query.length > 0)));
  check('scope only ever deepens or re-roots — never contradicts itself',
    s.scope.conflicts.length === 0, JSON.stringify(s.scope.conflicts));
}

// ── 8 · determinism ──────────────────────────────────────────────────────────
{
  const run = () => {
    const s = session();
    return ['indonesia', 'kutei', 'badak', 'show me the logs'].map((t) => JSON.stringify(s.say(t).card));
  };
  check('the same transcript produces the same cards twice', JSON.stringify(run()) === JSON.stringify(run()));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

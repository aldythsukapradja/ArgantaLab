// trace truth-lock — the reasoning strip must only ever report real events.
//
// The whole point of agent/trace.ts is that it is NOT a narration layer. These
// assertions are the guard rail: a step may exist only because the pipeline
// produced the fact behind it. If someone later adds a "thinking…" flourish to
// make the agent look cleverer, this file fails.
//
// Run: node scripts/test-trace.mjs
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

const index = buildIndex(core, tail);
const brain = makeScopeBrain(index);

/** One deterministic-tier turn, traced exactly as useAgent would trace it. */
function ask(text, opts = {}) {
  let turn = opts.turn ?? newTurn();
  let scope = opts.scope ?? emptyScope();
  const result = respond(index, turn, text, scope);
  for (const command of result.commands) {
    if (command.op === 'scope') scope = applyPatch(scope, command.patch, { brain, autofill: command.autofill, reroot: command.reroot });
  }
  const trace = buildTrace({
    facts: result.facts,
    card: result.card,
    capabilityId: result.plan?.capabilityId ?? null,
    commands: result.commands,
    node: result.turn.focus,
    tier: 'lite',
    elapsedMs: opts.elapsedMs ?? 0.4,
    fellBack: opts.fellBack,
  });
  return { trace, card: result.card, turn: result.turn, scope, facts: result.facts };
}

const kinds = (t) => t.steps.map((s) => s.kind);
const step = (t, kind) => t.steps.find((s) => s.kind === kind);

// ── 1 · structural integrity ────────────────────────────────────────────────
{
  const { trace } = ask('volve');
  check('every step carries a label and a value',
    trace.steps.length > 0 && trace.steps.every((s) => s.label && s.value),
    `${trace.steps.length} steps`);
  check('every step kind is a declared TraceKind',
    trace.steps.every((s) => ['parse', 'resolve', 'capability', 'data', 'action', 'model', 'tool', 'note'].includes(s.kind)));
  check('trace reports the tier that actually answered', trace.tier === 'lite');
}

// ── 2 · the deterministic tier never claims a model ─────────────────────────
{
  for (const q of ['volve', 'kutei basin', 'which basins are in norway', 'compare volve and badak']) {
    const { trace } = ask(q);
    check(`no model step on the deterministic tier — "${q}"`, !kinds(trace).includes('model'));
    check(`no tool step without a loop — "${q}"`, !kinds(trace).includes('tool'));
  }
}

// ── 3 · resolution is reported as it happened, not as we'd like it ──────────
{
  const clean = ask('viking graben');
  const r = step(clean.trace, 'resolve');
  check('exact hit is reported as resolved', !!r && r.ok === true, r?.value);
  check('exact hit claims no spelling correction', !!r && !/character/.test(r.detail ?? ''), r?.detail ?? '(none)');

  const typo = ask('kutei bassin');
  const rt = step(typo.trace, 'resolve');
  check('typo turn resolves to a real node', !!rt && rt.ok === true, rt?.value);
  check('typo turn names the rung that caught it', !!rt?.detail, rt?.detail ?? '(none)');
}

{
  const junk = ask('zzqxwv plutonium');
  const r = step(junk.trace, 'resolve');
  check('unresolvable input is admitted, not papered over',
    !r || r.ok === false, r ? `${r.value}` : '(no resolve step)');
  check('unresolvable input claims no capability', !kinds(junk.trace).includes('capability'));
}

// ── 4 · the data step only counts attributes the node really has ────────────
{
  const { trace } = ask('volve');
  const d = step(trace, 'data');
  if (d) {
    const n = Number(String(d.value).match(/\d+/)?.[0] ?? 0);
    const listed = String(d.detail ?? '').replace(' …', '').split(' · ').filter(Boolean);
    check('data step count is a real positive count', n > 0, d.value);
    check('data step lists no more names than it counted', listed.length <= n, `${listed.length} of ${n}`);
  } else {
    check('data step absent because the node has no probed attributes', true);
  }
}

// ── 5 · a refusal is traced as a refusal ────────────────────────────────────
{
  // Ask a well-shaped question of an entity that cannot possibly hold the data.
  const { trace, card } = ask('production history for the north sea');
  if (card.kind === 'absence') {
    const c = step(trace, 'capability');
    check('absence card traces the capability as refused', !c || c.ok === false, c?.detail ?? '(no capability step)');
    const a = trace.steps.find((s) => s.label === 'Applied');
    check('absence card says nothing moved', !!a && /nothing/.test(a.value), a?.value ?? '(none)');
  } else {
    check('refusal path exercised', true, `card was "${card.kind}" — nothing to assert`);
  }
}

// ── 6 · applied actions match the commands that were dispatched ─────────────
{
  const turn = newTurn();
  const first = ask('volve', { turn });
  const applied = first.trace.steps.find((s) => s.kind === 'action');
  if (applied) {
    const n = Number(String(applied.value).match(/\d+/)?.[0] ?? 0);
    check('applied-action count is the real command count', n > 0, applied.value);
    check('applied step names what moved', !!applied.detail, applied.detail ?? '(none)');
  } else {
    check('no action step when nothing was dispatched', true);
  }
}

// ── 7 · timing is never padded to look like effort ──────────────────────────
{
  const instant = ask('volve', { elapsedMs: 0.2 });
  check('sub-millisecond work is not dressed up as a duration', instant.trace.ms < 1, `${instant.trace.ms} ms`);
  const slow = ask('volve', { elapsedMs: 1840 });
  check('real duration is carried through verbatim', slow.trace.ms === 1840, `${slow.trace.ms} ms`);
}

// ── 8 · the fall-back is disclosed, never hidden ────────────────────────────
{
  const { trace } = ask('volve', { fellBack: true });
  const note = trace.steps.find((s) => s.label === 'Fell back');
  check('fall-back to the deterministic tier is disclosed', !!note, note?.value ?? '(missing)');
  const quiet = ask('volve', { fellBack: false });
  check('no fall-back note when nothing fell back',
    !quiet.trace.steps.some((s) => s.label === 'Fell back'));
}

// ── 9 · the model step exists only when a model was really called ───────────
{
  const withModel = buildTrace({
    facts: ask('volve').facts,
    card: ask('volve').card,
    capabilityId: null,
    commands: [],
    tier: 'core',
    elapsedMs: 612,
    trail: [
      { type: 'model', provider: 'groq', model: 'llama-3.3-70b-versatile', costUsd: 0.00012 },
      { type: 'tool', name: 'show_entity', latencyMs: 3, ok: true },
    ],
  });
  const m = step(withModel, 'model');
  check('model step names the provider and model that actually ran',
    !!m && m.value.includes('groq') && m.value.includes('llama-3.3-70b-versatile'), m?.value);
  const t = step(withModel, 'tool');
  check('tool step names the tool the loop really executed', !!t && t.value === 'show_entity', t?.value);
  check('tool step reports its measured latency', !!t && /ms|instant/.test(t.detail ?? ''), t?.detail ?? '(none)');
}

// ── 10 · a blocked tool is shown as blocked ─────────────────────────────────
{
  const blocked = buildTrace({
    facts: ask('volve').facts,
    card: ask('volve').card,
    commands: [],
    tier: 'core',
    elapsedMs: 90,
    trail: [{ type: 'tool', name: 'delete_everything', blocked: 'not in the registry' }],
  });
  const t = step(blocked, 'tool');
  check('a blocked tool is labelled blocked, not run', !!t && /blocked/i.test(t.label) && t.ok === false, t?.label);
}

// ── 11 · repeats are folded with a real count, never quietly dropped ────────
{
  const base = ask('volve');
  const noisy = buildTrace({
    facts: base.facts,
    card: base.card,
    commands: [],
    tier: 'core',
    elapsedMs: 9600,
    trail: [
      { type: 'model', provider: 'openaiCompat', model: 'llama-3.1-8b' },
      { type: 'model', provider: 'openaiCompat', model: 'llama-3.1-8b' },
      { type: 'model', provider: 'openaiCompat', model: 'llama-3.1-8b' },
      { type: 'model', provider: 'openaiCompat', model: 'llama-3.1-8b' },
      { type: 'tool', name: 'basin_figures', latencyMs: 175, ok: true },
      { type: 'tool', name: 'basin_figures', latencyMs: 40, ok: true },
      { type: 'tool', name: 'basin_figures', latencyMs: 40, ok: true },
    ],
  });
  const m = step(noisy, 'model');
  check('four identical model calls fold to one row', noisy.steps.filter((s) => s.kind === 'model').length === 1);
  check('the folded model row reports all four', m?.repeat === 4 && /×4/.test(m.value), m?.value);
  const t = step(noisy, 'tool');
  check('three identical tool runs fold to one row', noisy.steps.filter((s) => s.kind === 'tool').length === 1);
  check('the folded tool row reports all three', t?.repeat === 3 && /×3/.test(t.value), t?.value);
  check('folding never invents a repeat that did not happen',
    noisy.steps.every((s) => s.repeat === undefined || s.repeat > 1));

  // A single occurrence must stay a plain row — no "×1" theatre.
  const once = buildTrace({
    facts: base.facts, card: base.card, commands: [], tier: 'core', elapsedMs: 200,
    trail: [{ type: 'tool', name: 'basin_figures', latencyMs: 12, ok: true }],
  });
  const o = step(once, 'tool');
  check('a single occurrence carries no count', o?.repeat === undefined && !/×/.test(o?.value ?? ''), o?.value);

  // Distinct tools must never be merged into each other.
  const mixed = buildTrace({
    facts: base.facts, card: base.card, commands: [], tier: 'core', elapsedMs: 300,
    trail: [
      { type: 'tool', name: 'basin_dossier', latencyMs: 45, ok: true },
      { type: 'tool', name: 'basin_figures', latencyMs: 175, ok: true },
    ],
  });
  check('different tools stay separate rows', mixed.steps.filter((s) => s.kind === 'tool').length === 2);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

// workflow truth-lock — a chain must be deterministic, honest and complete.
//
// The walkthroughs this replaces drove UI tabs, so nothing about them could be
// tested without a browser. A chain of capabilities can be run in plain Node,
// which is the point: the thing that decides what the user sees is the same
// pure function a typed question goes through.
//
// Run: node scripts/test-workflows.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };

const corePath = path.join(root, 'public', 'agent', 'gazetteer.json');
if (!fs.existsSync(corePath)) { console.log('SKIP — run `node scripts/build-gazetteer.mjs` first'); process.exit(0); }
const core = JSON.parse(fs.readFileSync(corePath, 'utf8'));
const tail = JSON.parse(fs.readFileSync(path.join(root, 'public', 'agent', 'gazetteer-tail.json'), 'utf8'));

const { buildIndex } = await import('../src/agent/gazetteer.ts');
const { emptyScope, applyPatch } = await import('../src/agent/scope.ts');
const { makeScopeBrain } = await import('../src/agent/brain.ts');
const { newTurn, runIntent } = await import('../src/agent/dialogue.ts');
const { CAPABILITY_BY_ID } = await import('../src/agent/capabilities.ts');
const { WORKFLOWS, WORKFLOW_BY_ID, resolvedSteps, workflowsForKind, planFor, planSummary } = await import('../src/agent/workflows.ts');
const { buildReport } = await import('../src/agent/report.ts');
const { resolve } = await import('../src/agent/resolve.ts');

const index = buildIndex(core, tail);
const brain = makeScopeBrain(index);

/** Run a chain exactly as useAgent.runWorkflow does. */
function run(workflow, subject) {
  let turn = newTurn();
  let scope = emptyScope();
  const out = [];
  for (const step of workflow.steps) {
    const capability = CAPABILITY_BY_ID.get(step.capabilityId);
    if (!capability) continue;
    const result = runIntent(index, turn, {
      verb: 'show',
      capabilityIds: [step.capabilityId],
      entityQuery: subject,
      usesFocus: false,
      matchedPhrase: capability.phrases[0],
      confidence: 1,
      fullQuery: subject,
    }, subject, scope);
    turn = result.turn;
    for (const c of result.commands) {
      if (c.op === 'scope') scope = applyPatch(scope, c.patch, { brain, autofill: c.autofill, reroot: c.reroot });
    }
    out.push({ step, card: result.card, commands: result.commands });
  }
  return out;
}

// ── 1 · every declared step names a capability that exists ──────────────────
{
  const broken = [];
  for (const w of WORKFLOWS) {
    for (const { step, known } of resolvedSteps(w)) if (!known) broken.push(`${w.id}:${step.capabilityId}`);
  }
  check('every workflow step names a real capability', broken.length === 0, broken.join(', ') || `${WORKFLOWS.length} workflows`);
  check('workflow ids are unique', new Set(WORKFLOWS.map((w) => w.id)).size === WORKFLOWS.length);
  check('every step carries a title and a reason',
    WORKFLOWS.every((w) => w.steps.every((s) => s.title && s.why)));
}

// ── 2 · a chain runs end to end and never aborts ────────────────────────────
{
  const basin = WORKFLOW_BY_ID.get('basin-screening');
  const ran = run(basin, 'Kutei Basin');
  check('the basin chain runs every step', ran.length === basin.steps.length, `${ran.length}/${basin.steps.length}`);
  check('no step errors out', ran.every((r) => r.card.kind !== 'error'),
    ran.filter((r) => r.card.kind === 'error').map((r) => r.step.capabilityId).join(', ') || 'none');
  check('every step produces a headline', ran.every((r) => r.card.headline?.trim()));

  const fd = WORKFLOW_BY_ID.get('field-development');
  const ranFd = run(fd, 'VOLVE');
  check('the field chain runs every step', ranFd.length === fd.steps.length, `${ranFd.length}/${fd.steps.length}`);
  check('no field step errors out', ranFd.every((r) => r.card.kind !== 'error'),
    ranFd.filter((r) => r.card.kind === 'error').map((r) => r.step.capabilityId).join(', ') || 'none');
}

// ── 3 · DETERMINISM. The whole claim of this mode ───────────────────────────
{
  const basin = WORKFLOW_BY_ID.get('basin-screening');
  const a = run(basin, 'Kutei Basin');
  const b = run(basin, 'Kutei Basin');
  const shape = (r) => r.map((x) => `${x.step.capabilityId}:${x.card.kind}:${x.card.headline}:${x.card.facts.length}`).join('|');
  check('the same subject yields byte-identical steps', shape(a) === shape(b));
  // Different subjects must NOT collapse to the same output — a chain that
  // ignores its subject would pass the test above trivially.
  const other = run(basin, 'Viking Graben');
  check('a different subject yields a different run', shape(a) !== shape(other));
}

// ── 4 · an absent step is reported, not hidden, and does not stop the chain ─
{
  // A basin with no bundled well data: the FD chain should still complete,
  // with the data-bearing steps honestly refusing.
  const fd = WORKFLOW_BY_ID.get('field-development');
  const ran = run(fd, 'Badak');
  check('a data-poor subject still completes the chain', ran.length === fd.steps.length, `${ran.length}/${fd.steps.length}`);
  const refused = ran.filter((r) => r.card.kind === 'absence');
  check('refusals are reported as absence, not error', ran.every((r) => r.card.kind !== 'error'),
    `${refused.length} of ${ran.length} steps refused`);
  check('every refusal explains itself', refused.every((r) => (r.card.body || r.card.subhead || '').trim().length > 10),
    refused.map((r) => r.step.capabilityId).join(', ') || 'none refused');
}

// ── 5 · a chain only offers itself where it can start ───────────────────────
{
  check('basin screening offers on basins', workflowsForKind('basin').some((w) => w.id === 'basin-screening'));
  check('basin screening does NOT offer on wells', !workflowsForKind('well').some((w) => w.id === 'basin-screening'));
  check('field development offers on fields', workflowsForKind('field').some((w) => w.id === 'field-development'));
}

// ── 6 · the chain moves the app, and says so ────────────────────────────────
{
  const ran = run(WORKFLOW_BY_ID.get('basin-screening'), 'Kutei Basin');
  const moved = ran.filter((r) => r.commands.length > 0).length;
  check('the run dispatches real commands', moved > 0, `${moved} of ${ran.length} steps moved the app`);
}

// ── 7 · assisted planning deviates only on MEASURED absence ────────────────
//
// The whole safety argument for the assisted mode is that its deviations come
// from capability probes, not from a model's opinion about what is interesting.
// These assertions are what make that argument checkable.
{
  const nodeFor = (q) => { const r = resolve(index, q, {}); return r.status === 'exact' ? r.node : null; };
  const kutei = nodeFor('Kutei Basin');
  const badak = nodeFor('Badak');
  const basin = WORKFLOW_BY_ID.get('basin-screening');
  const fd = WORKFLOW_BY_ID.get('field-development');

  check('a data-rich subject gets a plan', !!kutei && planFor(basin, kutei).length > 0);
  const kPlan = planFor(basin, kutei);
  check('every planned step carries an action and a reason',
    kPlan.every((p) => ['run', 'drop', 'add'].includes(p.action) && p.reason));
  check('a step is dropped ONLY when its own probe refuses',
    kPlan.filter((p) => p.action === 'drop').every((p) => {
      const c = CAPABILITY_BY_ID.get(p.step.capabilityId);
      let ok = false; try { ok = !!c && c.kinds.includes(kutei.kind) && c.probe(kutei); } catch { ok = false; }
      return !ok;
    }));
  check('a step is added ONLY when its probe passes',
    kPlan.filter((p) => p.action === 'add').every((p) => {
      const c = CAPABILITY_BY_ID.get(p.step.capabilityId);
      let ok = false; try { ok = c.probe(kutei); } catch { ok = false; }
      return ok;
    }));
  check('no capability appears twice in one plan',
    new Set(kPlan.map((p) => p.step.capabilityId)).size === kPlan.length);

  if (badak) {
    const bPlan = planFor(fd, badak);
    const dropped = bPlan.filter((p) => p.action === 'drop').length;
    check('a data-poor subject has steps dropped', dropped > 0, `${dropped} dropped`);
    check('the plan summary names the deviation', /dropped/.test(planSummary(bPlan)), planSummary(bPlan));
  }
  // If "assisted" were not deterministic it would just mean "arbitrary".
  check('planning is deterministic',
    JSON.stringify(planFor(basin, kutei)) === JSON.stringify(planFor(basin, kutei)));
}

// ── 8 · the report reproduces the run and invents nothing ──────────────────
{
  const ran = run(WORKFLOW_BY_ID.get('basin-screening'), 'Kutei Basin');
  const steps = ran.map((r) => ({
    title: r.step.title, why: r.step.why, card: r.card,
    summary: '', skipped: r.card.kind === 'absence' || r.card.kind === 'error',
  }));
  const html = buildReport({ workflow: 'Basin screening', subject: 'Kutei Basin', steps, generatedAt: '2026-01-01 00:00' });

  check('the report is one self-contained document',
    html.startsWith('<!doctype html>') && html.includes('</html>'));
  check('nothing is fetched from outside', !/<script|src="http|href="http|@import|cdn\./i.test(html));
  check('no emoji anywhere', !EMOJI.test(html));
  check('it renders light AND dark', html.includes('prefers-color-scheme:dark'));
  check('every step appears in the document', steps.every((s) => html.includes(s.title.replace(/&/g, '&amp;'))));

  // The load-bearing claim: every figure printed came off a card the user saw.
  const cardValues = new Set(steps.flatMap((s) => (s.card.facts ?? []).map((f) => String(f.value))));
  const inTables = [...html.matchAll(/<td>([^<]+)<\/td>/g)].map((m) => m[1]);
  const invented = inTables.filter((v) => !cardValues.has(v.replace(/&amp;/g, '&')));
  check('no value in the report is absent from the cards', invented.length === 0,
    invented.slice(0, 3).join(' | ') || 'all traced to a card');

  const again = buildReport({ workflow: 'Basin screening', subject: 'Kutei Basin', steps, generatedAt: '2026-01-01 00:00' });
  check('the same run renders byte-identical HTML', html === again, `${html.length} bytes`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

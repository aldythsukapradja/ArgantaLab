// handover-audit.ts truth-lock — is the static model fit to hand over?
//
// The assertions are about the audit REFUSING to pass things. An audit that reports
// ready when an artifact is missing is worse than no audit, because it converts an
// open question into a false assurance.
// Run: node scripts/test-handover-audit.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'handover-audit.ts');
if (!existsSync(mod)) { console.log('SKIP — handover-audit.ts absent'); process.exit(0); }
const { auditHandover, summarise } = await import('../src/tabs/fielddev/handover-audit.ts');

/** A model with nothing wrong — the only input that may summarise as ready. */
const perfect = () => ({
  grid: {
    nx: 100, ny: 100, nz: 20, cells: 200000, activeCells: 200000,
    degenerateCells: 0, inactiveCells: 0,
    zones: [{ name: 'res', nz: 20, crossedCols: 0 }],
    unfaulted: false,
  },
  properties: {
    simulated: true, simNodes: 100, modelNx: 100,
    poroFinite: 1, permFinite: 1, ntgFinite: 1,
    hasPermZ: true, phiKFitted: true,
    meanPoro: 0.2, meanPerm: 500, permCapped: 0,
  },
  wells: {
    producers: 3, producersUpscaled: 3, injectors: 2, injectorsUpscaled: 2,
    withSurvey: 5, total: 5, withHistory: 5, completionCells: 120,
  },
  fluids: {
    contacts: [{ kind: 'OWC', tvdss: 3000, nature: 'interpreted' }],
    bo: 1.25, rs: 150, pb: 250, pi: 330, hasRelPerm: true,
  },
  regions: { eqlnum: 1, fipnum: 2, satnum: 2 },
  volumes: { stoiipSm3: 18.7e6, officialSm3: 18.7e6, reconcileDiff: 0.01 },
});

const find = (items, id) => items.find((i) => i.id === id);

// ── a complete model passes, except for what is inherently informational ─────
{
  const items = auditHandover(perfect());
  const s = summarise(items);
  eq('a complete model is handover-ready', s.handoverReady, true);
  eq('nothing is blocked', s.blocked, 0);
  eq('nothing is absent', s.absent, 0);
  check('and the verdict says READY', /^READY/.test(s.verdict), s.verdict);
}

// ── completions: not computed and computed-empty are different findings ──────
{
  const notRun = perfect(); delete notRun.wells.completionCells;
  eq('an uncomputed completion list is ABSENT — nobody has asked the question yet',
    find(auditHandover(notRun), 'well.completions').status, 'absent');

  const empty = perfect(); empty.wells.completionCells = 0;
  eq('a computed list that found NO cells is BLOCKED, not absent — the question was asked and the answer is wrong',
    find(auditHandover(empty), 'well.completions').status, 'blocked');
}

// ── each gap must BLOCK, not warn ────────────────────────────────────────────
{
  const noProps = perfect(); noProps.properties.simulated = false;
  eq('an unpopulated model is BLOCKED, not warned',
    find(auditHandover(noProps), 'prop.populated').status, 'blocked');

  const noPermZ = perfect(); noPermZ.properties.hasPermZ = false;
  eq('no vertical permeability is BLOCKED — vertical flow is unmodellable',
    find(auditHandover(noPermZ), 'prop.permz').status, 'blocked');

  const noContact = perfect(); noContact.fluids.contacts = [];
  eq('no contact is BLOCKED — equilibration has no datum',
    find(auditHandover(noContact), 'fluid.contacts').status, 'blocked');

  const noHistory = perfect(); noHistory.wells.withHistory = 0;
  eq('no production history is BLOCKED — there is nothing to match',
    find(auditHandover(noHistory), 'well.history').status, 'blocked');

  const missedWell = perfect(); missedWell.wells.producersUpscaled = 2;
  eq('a producer that did not upscale is BLOCKED',
    find(auditHandover(missedWell), 'well.flowing').status, 'blocked');

  const missedInj = perfect(); missedInj.wells.injectorsUpscaled = 1;
  eq('an INJECTOR that did not upscale is equally blocking',
    find(auditHandover(missedInj), 'well.flowing').status, 'blocked');

  const degen = perfect(); degen.grid.degenerateCells = 5;
  eq('a zero-volume cell is BLOCKED', find(auditHandover(degen), 'grid.degenerate').status, 'blocked');

  const gaps = perfect(); gaps.properties.poroFinite = 0.4;
  eq('a property defined in under half the cells is BLOCKED',
    find(auditHandover(gaps), 'prop.coverage').status, 'blocked');
}

// ── permeability: FINITE is not PHYSICAL ─────────────────────────────────────
//
// phiToK is log-linear and unbounded; an extrapolated porosity yields a value a
// simulator accepts and a reservoir cannot contain. On Volve 37% of cells hit the
// ceiling, which is a blocked model, not a rounding note.
{
  const none = perfect();
  eq('nothing capped is ready', find(auditHandover(none), 'prop.permrange').status, 'ready');

  const few = perfect(); few.properties.permCapped = 1000;      // 0.5%
  eq('a few capped cells warn', find(auditHandover(few), 'prop.permrange').status, 'warn');

  const many = perfect(); many.properties.permCapped = 74000;   // 37%
  eq('37% capped is BLOCKED — the transform is outside its valid range',
    find(auditHandover(many), 'prop.permrange').status, 'blocked');

  // Scoping the property model to the reservoir must not flatter the ratio by leaving
  // the layers it declined to simulate in the divisor.
  const scoped = perfect();
  scoped.properties.permCapped = 3000;
  scoped.properties.simulatedCells = 20000;   // 15% of what was simulated
  eq('the ratio is against SIMULATED cells, not the whole grid',
    find(auditHandover(scoped), 'prop.permrange').status, 'blocked');
  check('…and the finding quotes that ratio',
    /15\.0%/.test(find(auditHandover(scoped), 'prop.permrange').finding),
    find(auditHandover(scoped), 'prop.permrange').finding);
}

// ── things that warn rather than block ───────────────────────────────────────
{
  const unfaulted = perfect(); unfaulted.grid.unfaulted = true;
  eq('an unfaulted grid warns — usable, but the HM must be told',
    find(auditHandover(unfaulted), 'grid.faults').status, 'warn');

  const crossed = perfect(); crossed.grid.zones = [{ name: 'res', nz: 20, crossedCols: 30 }];
  eq('horizon crossings warn', find(auditHandover(crossed), 'grid.crossings').status, 'warn');

  const analog = perfect(); analog.properties.phiKFitted = false;
  eq('an analogue φ–k transform warns', find(auditHandover(analog), 'prop.phik').status, 'warn');

  const coarse = perfect(); coarse.properties.simNodes = 16;
  const item = find(auditHandover(coarse), 'prop.simres');
  check('an upsampled simulation is flagged', !!item && item.status === 'warn', '');
  check('…and names both resolutions', /16/.test(item.finding) && /100/.test(item.finding), item.finding);

  const off = perfect(); off.volumes.stoiipSm3 = 40e6;
  eq('a volume far from the published figure warns',
    find(auditHandover(off), 'vol.reconcile').status, 'warn');
}

// ── ACTNUM: a per-column mask cannot express per-cell activity ───────────────
{
  const union = perfect(); union.grid.inactiveCells = 115740;
  eq('a column-union activity mask is ABSENT, not ready',
    find(auditHandover(union), 'grid.actnum').status, 'absent');
  eq('a model whose zones all cover every column needs no per-cell array',
    find(auditHandover(perfect()), 'grid.actnum').status, 'ready');
}

// ── the summary refuses to say ready while anything is missing ──────────────
{
  const noRegions = perfect();
  noRegions.regions = { eqlnum: 0, fipnum: 0, satnum: 0 };
  const s = summarise(auditHandover(noRegions));
  eq('missing region arrays block handover', s.handoverReady, false);
  check('and the verdict says CONDITIONAL rather than READY',
    /CONDITIONAL/.test(s.verdict), s.verdict);

  const blockedModel = perfect(); blockedModel.properties.hasPermZ = false;
  const s2 = summarise(auditHandover(blockedModel));
  check('a blocking gap says NOT READY', /NOT READY/.test(s2.verdict), s2.verdict);
  eq('…and handoverReady is false', s2.handoverReady, false);
}

// ── every item names what it blocks ─────────────────────────────────────────
{
  const items = auditHandover(perfect());
  const bad = items.filter((i) => i.status !== 'ready' && !i.consequence);
  eq('no non-ready item is left without a stated consequence', bad.map((i) => i.id), []);
  check('every item declares which downstream job needs it',
    items.every((i) => ['initialisation', 'history match', 'both'].includes(i.needs)), '');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

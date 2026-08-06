// grid-versions.ts truth-lock — the pure half: naming and diffing realisations.
//
// The IndexedDB store is not exercised here (node has no indexedDB and mocking it would
// test the mock). What IS tested is the part that carries meaning: a default name that
// distinguishes two realisations, and a diff that tells a modeller whether two versions
// differ by SEED — the same model, a different draw — or by RECIPE, which is a
// different model entirely. Confusing those two is how an uncertainty range gets read
// as a modelling error.
// Run: node scripts/test-grid-versions.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'grid-versions.ts');
if (!existsSync(mod)) { console.log('SKIP — grid-versions.ts absent'); process.exit(0); }
const { defaultVersionName, diffVersions, indexedDbVersionStore } =
  await import('../src/tabs/fielddev/grid-versions.ts');

const recipe = (over = {}) => ({
  horizons: ['hugin_top', 'hugin_base'],
  nzPerZone: 10, layerScheme: 'proportional',
  seed: 1000, simNodes: 16, permAverage: 'geometric', owc: 3065,
  ...over,
});
const stats = (over = {}) => ({
  nx: 166, ny: 131, nz: 20, cells: 434920, activeColumns: 11414,
  zones: ['Hugin Fm Top → Hugin Fm Base'],
  ntg: 0.826, phi: 0.218, sw: 0.242, stoiipMMSm3: 18.75, sandFraction: 0.81,
  ...over,
});
const ver = (id, r = {}, s = {}) => ({
  id, name: id, createdAt: 1, fieldId: 'volve', recipe: recipe(r), stats: stats(s),
});

// ── the default name must distinguish realisations ──────────────────────────
{
  const n = defaultVersionName(recipe(), 0);
  check('the name carries the SEED — a realisation is its seed', /seed 1000/.test(n), n);
  check('…and the simulation resolution', /16²/.test(n), n);
  check('…and the layering', /10\/zone/.test(n), n);
  check('it is numbered from the count of existing versions', /^R1/.test(n), n);
  eq('a second version numbers itself R2',
    defaultVersionName(recipe(), 1).slice(0, 2), 'R2');
  check('two different seeds never produce the same default name',
    defaultVersionName(recipe(), 0) !== defaultVersionName(recipe({ seed: 7 }), 0), '');
}

// ── the diff: seed vs recipe ────────────────────────────────────────────────
{
  eq('identical versions differ in nothing', diffVersions(ver('a'), ver('b')), []);

  const d = diffVersions(ver('a'), ver('b', { seed: 2000 }));
  eq('a seed change is reported', d.length, 1);
  check('…and named as a seed', /seed 1000 → 2000/.test(d[0]), d[0]);

  const r = diffVersions(ver('a'), ver('b', { nzPerZone: 20, simNodes: 32 }));
  eq('every recipe change is listed', r.length, 2);
  check('…layering', r.some((x) => /layers 10 → 20/.test(x)), r.join(' | '));
  check('…and resolution', r.some((x) => /simulation 16² → 32²/.test(x)), r.join(' | '));

  const iv = diffVersions(ver('a'), ver('b', { horizons: ['bcu', 'hugin_top', 'hugin_base'] }));
  check('a different INTERVAL is a different model, and says so',
    iv.some((x) => /interval 2 → 3 horizons/.test(x)), iv.join(' | '));

  const c = diffVersions(ver('a'), ver('b', { owc: 3100 }));
  check('a moved contact is reported', c.some((x) => /contact 3065 → 3100/.test(x)), c.join(' | '));
}

// ── the case that must NOT be silent ────────────────────────────────────────
//
// Same recipe, different volume. Either the seed was not recorded or something
// non-deterministic crept in; both are worth saying out loud, because otherwise the
// version list shows two identical recipes with different answers and no explanation.
{
  const d = diffVersions(ver('a'), ver('b', {}, { stoiipMMSm3: 21.4 }));
  eq('the discrepancy is surfaced', d.length, 1);
  check('…and points at the seed', /seed was recorded/.test(d[0]), d[0]);

  eq('but an identical recipe AND result stays silent',
    diffVersions(ver('a'), ver('b')), []);
}

// ── the store is an interface, so it can be swapped for Supabase ────────────
{
  const iface = ['list', 'save', 'remove', 'get'];
  eq('the IndexedDB store implements the whole seam',
    iface.filter((m) => typeof indexedDbVersionStore[m] === 'function'), iface);
  check('…and nothing else, so a replacement has a small contract',
    Object.keys(indexedDbVersionStore).length === iface.length,
    Object.keys(indexedDbVersionStore).join(','));
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

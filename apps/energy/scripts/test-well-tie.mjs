// well-tie.ts truth-lock.
//
// Two things carry this module:
//   1. THE SIGN. Pick files store TVDSS as elevation (negative below sea level) and
//      grids store depth. Forgetting it turns a 5 m tie into a 5,600 m mistie, which
//      reads as the tool being broken rather than the model.
//   2. A top that ties is not a zone that fits. The Volve failure was a gridded zone
//      65 m thick where the well penetrated 210 m of the same formation — the top
//      matched and the reservoir still landed in the wrong rock.
// Run: node scripts/test-well-tie.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'well-tie.ts');
if (!existsSync(mod)) { console.log('SKIP — well-tie.ts absent'); process.exit(0); }
const { normaliseTvdss, picksForSurface, tieSurface, tieThickness } =
  await import('../src/tabs/fielddev/well-tie.ts');

// ══ THE SIGN TRAP ═══════════════════════════════════════════════════════════
{
  eq('an elevation-convention pick becomes a positive depth', normaliseTvdss(-2805.46), 2805.46);
  eq('a depth-convention pick is left alone', normaliseTvdss(2805.46), 2805.46);

  // Volve's real numbers: the pick is -2805.46, the grid says 2810. That is a 4.5 m
  // tie. Read naively it is 5,615 m and every well looks catastrophically wrong.
  const picks = [{ well: 'F-14', surface: 'Hugin Fm. VOLVE Top', md: 3000.6, tvdss: -2805.46 }];
  const byWell = picksForSurface(picks, /hugin.*top/i);
  const r = tieSurface('Hugin Top', [{ name: 'F-14', x: 0, y: 0 }], byWell, () => 2810);
  near('so a real Volve pick ties to about 4.5 m, not 5,600', r.ties[0].misfitM, 4.54, 0.01);
  check('…which is inside tolerance', r.outOfTolerance === 0, '');
}

// ══ picking the right pick ══════════════════════════════════════════════════
{
  // F-14 really carries eight Hugin picks — it is a deviated bore that re-enters the
  // formation. A depth SURFACE represents the structural top, so the shallowest wins.
  const picks = [
    { well: 'F-14', surface: 'Hugin Fm. VOLVE Top', md: 3000.6, tvdss: -2805.46 },
    { well: 'F-14', surface: 'Hugin Fm. VOLVE Top', md: 3375, tvdss: -2906.64 },
    { well: 'F-14', surface: 'Hugin Fm. VOLVE Top', md: 3480, tvdss: -2944.79 },
    { well: 'F-14', surface: 'Hugin Fm. VOLVE Base', md: 3680.2, tvdss: -3058.95 },
  ];
  const tops = picksForSurface(picks, /hugin.*top/i);
  eq('a re-entering bore contributes ONE top, the shallowest', tops.get('F-14'), 2805.46);
  const deep = picksForSurface(picks, /hugin.*top/i, 'deepest');
  eq('…and the deepest is available when a base is wanted', deep.get('F-14'), 2944.79);

  const bases = picksForSurface(picks, /hugin.*base/i, 'deepest');
  eq('the base regex does not catch the top', bases.get('F-14'), 3058.95);
  eq('…and there is exactly one entry', bases.size, 1);

  eq('a pick with no tvdss is skipped rather than read as zero',
    picksForSurface([{ well: 'X', surface: 'Hugin Top', md: 100, tvdss: null }], /hugin/i).size, 0);
}

// ══ the misfit statistics ═══════════════════════════════════════════════════
{
  const wells = [
    { name: 'A', x: 0, y: 0 }, { name: 'B', x: 1, y: 0 },
    { name: 'C', x: 2, y: 0 }, { name: 'D', x: 3, y: 0 },
  ];
  const byWell = new Map([['A', 2800], ['B', 2800], ['C', 2800], ['D', 2800]]);
  // +30 and −30 cancel in the mean but not in the absolute
  const grid = (x) => [2830, 2770, 2805, 2795][x];
  const r = tieSurface('S', wells, byWell, grid, 15);

  near('the signed mean can hide a bad grid', r.meanMisfitM, 0, 0.001);
  near('…which is why the ABSOLUTE mean is the one that matters', r.meanAbsMisfitM, 17.5, 0.001);
  // sqrt((30² + 30² + 5² + 5²)/4) = sqrt(462.5)
  near('…and the RMS punishes the outliers harder', r.rmsMisfitM, 21.506, 0.01);
  eq('two wells are outside a 15 m tolerance', r.outOfTolerance, 2);
  eq('the worst tie is reported by name', r.worst.well, 'A');
  eq('…with its signed misfit, so the direction is known', r.worst.misfitM, 30);
  check('a positive misfit means the GRID is deeper than the well', r.worst.gridTvdss > r.worst.pickTvdss, '');
  eq('the tolerance is carried on the result', r.toleranceM, 15);
}

// ══ untestable is not the same as failing ═══════════════════════════════════
{
  const wells = [{ name: 'A', x: 0, y: 0 }, { name: 'B', x: 1, y: 0 }, { name: 'C', x: 2, y: 0 }];
  const byWell = new Map([['A', 2800], ['B', 2800]]);          // C has no pick
  const grid = (x) => (x === 1 ? null : 2805);                  // B is off the grid
  const r = tieSurface('S', wells, byWell, grid, 15);

  eq('a well outside the gridded extent is listed, not scored', r.offGrid, ['B']);
  eq('a well with no pick is listed separately', r.noPick, ['C']);
  eq('only the testable well contributes to the statistics', r.ties.length, 1);
  near('…and the misfit is that one well\'s', r.meanAbsMisfitM, 5, 0.001);

  const none = tieSurface('S', wells, new Map(), () => 2805);
  eq('with nothing to tie, the misfit is zero rather than NaN', none.meanAbsMisfitM, 0);
  eq('…and the worst tie is null, not a fabricated point', none.worst, null);
}

// ══ A TOP THAT TIES IS NOT A ZONE THAT FITS ═════════════════════════════════
//
// The Volve failure in one assertion: the top matches within tolerance and the zone
// still holds a third of the rock the well drilled.
{
  const wells = [{ name: 'F-14', x: 0, y: 0 }];
  const tops = new Map([['F-14', 2805.46]]);
  const bases = new Map([['F-14', 3058.95]]);                   // 253 m penetrated

  const top = tieSurface('Hugin Top', wells, tops, () => 2810, 15);
  eq('the TOP ties inside tolerance', top.outOfTolerance, 0);

  const th = tieThickness(wells, tops, bases, () => 2810, () => 2875);
  eq('one thickness comparison is produced', th.length, 1);
  near('the well penetrated 253 m of formation', th[0].pickedGrossM, 253.49, 0.01);
  eq('the grid gives it 65 m', th[0].griddedGrossM, 65);
  near('…a quarter of the rock, despite the top matching', th[0].ratio, 0.256, 0.005);
  check('THIS is the check that catches an untied zone when the top looks fine',
    top.outOfTolerance === 0 && th[0].ratio < 0.5, '');

  // and it must be sign-safe too
  const negTops = new Map([['F-14', 2805.46]]);
  const thNeg = tieThickness(wells, negTops, bases, () => -2810, () => -2875);
  eq('an elevation-convention grid gives the same thickness', thNeg[0].griddedGrossM, 65);

  // a zone that genuinely fits
  const ok = tieThickness(wells, tops, bases, () => 2808, () => 3055);
  near('a zone that matches the penetration reads near 1.0', ok[0].ratio, 0.974, 0.01);
}

// ══ a well missing either pick contributes no thickness ═════════════════════
{
  const wells = [{ name: 'A', x: 0, y: 0 }];
  eq('no base pick, no thickness comparison',
    tieThickness(wells, new Map([['A', 2800]]), new Map(), () => 2800, () => 2900).length, 0);
  eq('a zero-thickness penetration is not a ratio',
    tieThickness(wells, new Map([['A', 2800]]), new Map([['A', 2800]]), () => 2800, () => 2900).length, 0);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

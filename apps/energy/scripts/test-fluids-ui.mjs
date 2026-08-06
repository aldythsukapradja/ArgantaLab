// Fluids & Rock presentation truth-lock — the pieces of the tab's chrome that carry
// meaning rather than decoration: the unit splitter behind every card row, and the
// chart kit's tick/readout formatting.
//
// These are small functions, but a wrong split puts a number in the unit column and a
// wrong tick format turns 0.0000366 into "0", so both are worth pinning.
// Run: node scripts/test-fluids-ui.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

// fluids-format.ts is the PURE half — a .ts file, so node can strip its types.
// The .tsx chart kit re-exports it but cannot itself be imported here (no JSX parser).
const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'fluids-format.ts');
if (!existsSync(mod)) { console.log('SKIP — fluids-format.ts absent'); process.exit(0); }
const K = await import('../src/tabs/fielddev/fluids-format.ts');
const { splitUnit } = K;

// ── the unit splitter ────────────────────────────────────────────────────────
const s = (t) => splitUnit(t);
eq('a plain value and unit split', s('337 bara'), { value: '337', unit: 'bara' });
eq('a decimal value splits', s('1.47 rm³/Sm³'), { value: '1.47', unit: 'rm³/Sm³' });
eq('scientific notation splits', s('2.0e-5 /bar'), { value: '2.0e-5', unit: '/bar' });
eq('a negative value splits', s('-0.088 bar/m'), { value: '-0.088', unit: 'bar/m' });
eq('a unit with superscripts and a slash survives whole', s('1101.3 kg/m³'), { value: '1101.3', unit: 'kg/m³' });
eq('a multi-word unit survives whole', s('3060 m TVDSS'), { value: '3060', unit: 'm TVDSS' });
eq('a degree unit splits', s('28.9 °API'), { value: '28.9', unit: '°API' });

// THE RULE: a unit may not contain a digit, so composites are left alone rather than
// being torn at the first space and putting half a value in the unit column.
eq('a ratio is NOT split', s('0.15 / 0.25'), { value: '0.15 / 0.25', unit: null });
eq('a two-quantity composite is NOT split', s('3060 m · 337 bara'), { value: '3060 m · 337 bara', unit: null });
eq('a sentence is NOT split', s('undersaturated by 81 bar'), { value: 'undersaturated by 81 bar', unit: null });
eq('a bare number keeps no unit', s('0.898'), { value: '0.898', unit: null });
eq('a bare word keeps no unit', s('none'), { value: 'none', unit: null });
eq('an em-dash placeholder is untouched', s('—'), { value: '—', unit: null });
eq('a percentage with no space stays whole', s('54.4%'), { value: '54.4%', unit: null });
eq('surrounding whitespace is trimmed', s('  337 bara  '), { value: '337', unit: 'bara' });

// ── tick and readout formatting ──────────────────────────────────────────────
const { tickText, readText } = K;
eq('zero is zero, not 0.000', tickText(0), '0');
eq('a mid-range tick keeps two decimals', tickText(1.47), '1.47');
eq('a hundreds tick drops decimals', tickText(337), '337');
check('a four-decade-small tick does not collapse to 0', tickText(3.66e-5) !== '0', `got ${tickText(3.66e-5)}`);
check('a large tick is abbreviated rather than printed in full', tickText(1_200_000).length < 9, `got ${tickText(1_200_000)}`);
check('a readout carries more precision than a tick',
  readText(1.4913).length > tickText(1.4913).length || readText(1.4913) !== tickText(1.4913),
  `tick ${tickText(1.4913)} vs read ${readText(1.4913)}`);
eq('a non-finite readout is an em dash, never NaN', readText(NaN), '—');
eq('an infinite readout is an em dash', readText(Infinity), '—');
check('a tiny readout keeps its magnitude', /e-/.test(readText(3.66e-5)), `got ${readText(3.66e-5)}`);

// ── scales place values inside the plot, including the margins ───────────────
{
  const { xScale, yScale, yScaleDown, M } = K;
  const x = xScale([0, 100], 500);
  check('the x scale starts at the left margin, not at 0', Math.abs(x(0) - M.left) < 1e-9, `x(0) = ${x(0)}`);
  check('the x scale ends inside the right margin', Math.abs(x(100) - (500 - M.right)) < 1e-9, `x(100) = ${x(100)}`);
  const y = yScale([0, 10], 300);
  check('the y scale puts the domain MINIMUM at the bottom', y(0) > y(10), `y(0) ${y(0)} below y(10) ${y(10)}`);
  const yd = yScaleDown([2000, 3000], 300);
  check('the downward y scale puts the domain MINIMUM at the top — depth reads down',
    yd(2000) < yd(3000), `y(2000) ${yd(2000)} above y(3000) ${yd(3000)}`);
  check('a zero-width chart still produces a usable range rather than an inverted one',
    xScale([0, 1], 10)(1) > xScale([0, 1], 10)(0), '');
}

// ── the nearest-sample probe ─────────────────────────────────────────────────
{
  const rows = [{ p: 10, v: 1 }, { p: 20, v: 2 }, { p: 30, v: 3 }];
  const probe = K.nearestProbe(rows, (r) => r.p, [{ key: 'v', yOf: (r) => r.v }]);
  eq('the probe returns the nearest sample below', probe(11), [{ key: 'v', value: 1 }]);
  eq('the probe returns the nearest sample above', probe(29), [{ key: 'v', value: 3 }]);
  eq('the probe clamps past the end rather than returning nothing', probe(1e6), [{ key: 'v', value: 3 }]);
  eq('an empty table probes to nothing', K.nearestProbe([], (r) => r.p, [{ key: 'v', yOf: () => 1 }])(5), []);
  eq('an unsorted table is sorted before probing',
    K.nearestProbe([...rows].reverse(), (r) => r.p, [{ key: 'v', yOf: (r) => r.v }])(11), [{ key: 'v', value: 1 }]);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

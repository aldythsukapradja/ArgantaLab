// 0a COLORRAMP sanity — palettes, reverse, domain/auto-scale, normalize, texture bake.
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
if (!existsSync(join(__dirname, '..', 'src', 'engine', 'colorramp.ts'))) { console.log('SKIP'); process.exit(0); }
const M = await import('../src/engine/colorramp.ts');

check('palette registry non-empty', M.PALETTES.length >= 8, `${M.PALETTES.length} palettes`);
const rgb = M.PALETTE_BY_ID('viridis').fn(0.5);
check('ramp returns rgb in [0,255]', rgb.every((c) => c >= 0 && c <= 255), rgb.join(','));

// endpoints
const g0 = M.PALETTE_BY_ID('grayscale').fn(0), g1 = M.PALETTE_BY_ID('grayscale').fn(1);
check('grayscale dark→white endpoints', g0[0] < 40 && g1[0] > 220, `${g0[0]}→${g1[0]}`);

// normalize + reverse
const dom = { min: 0, max: 100 };
check('normT maps mid → 0.5', Math.abs(M.normT(50, dom) - 0.5) < 1e-9);
check('normT reverse flips', Math.abs(M.normT(50, dom, true) - 0.5) < 1e-9 && M.normT(0, dom, true) === 1, 'ends swap');
check('normT clamps', M.normT(-10, dom) === 0 && M.normT(200, dom) === 1);

// auto domain ignores NaN
const ad = M.autoDomain([NaN, 3, 7, NaN, 5]);
check('autoDomain ignores NaN', ad.min === 3 && ad.max === 7, `${ad.min}..${ad.max}`);
const es = M.effectiveDomain({ palette: 'x', reverse: false, auto: true, min: 0, max: 1 }, [2, 9]);
check('effectiveDomain auto uses data', es.min === 2 && es.max === 9);
const em = M.effectiveDomain({ palette: 'x', reverse: false, auto: false, min: 10, max: 20 }, [2, 9]);
check('effectiveDomain manual uses state', em.min === 10 && em.max === 20);

// texture bake
const tex = M.paletteTextureData('turbo', false, 256);
check('palette texture is 256×RGBA', tex.length === 256 * 4 && tex[3] === 255);
const texR = M.paletteTextureData('turbo', true, 256);
check('reverse bake mirrors', tex[0] === texR[(255) * 4] && tex[255 * 4] === texR[0], 'ends mirror');

// css gradient string
check('cssGradient well-formed', /linear-gradient/.test(M.cssGradient('rainbow')));

// colorOf integrates state
const c = M.colorOf(50, { palette: 'oilwater', reverse: false, auto: false, min: 0, max: 100 }, { min: 0, max: 100 });
check('colorOf oilwater mid blends', c.every((v) => v >= 0 && v <= 255), c.join(','));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

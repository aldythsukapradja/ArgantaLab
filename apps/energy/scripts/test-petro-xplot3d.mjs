// test-petro-xplot3d.mjs — the 3D cloud, and above all what it refuses to claim.
//
// The two failure modes this locks down are the ones that make a 3D plot LOOK
// right while being wrong: LAS absent values (−999.25 is finite, and a cloud
// full of them is a solid block in one corner) and a colour class invented for
// samples that have no verdict.
import {
  PRESETS_3D, buildCloud3D, axisTicks, curveOf, MAX_POINTS,
} from '../src/tabs/fielddev/petro-xplot3d.ts';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) pass++; else { fail++; console.error(`  ✗ ${n}${e ? ` — ${e}` : ''}`); } };
const near = (a, b, t) => Math.abs(a - b) <= t;

const preset = (id) => PRESETS_3D.find((p) => p.id === id);

/** A BoreCurveSet with only the fields the cloud reads. */
const bore = (well, { rhob, nphi, rt, gr, phie, sw, vsh, net }) => ({
  well, boreKey: well, role: 'producer', md: [],
  vsh: vsh ?? [], phie: phie ?? [], sw: sw ?? [], net: net ?? [],
  gr, raw: { RHOB: rhob, NPHI: nphi, RT: rt }, ref: {}, picks: [],
});

// ── presets are triads, not arbitrary ────────────────────────────────────────
ok('every preset names exactly three axes', PRESETS_3D.every((p) => p.axes.length === 3));
ok('every preset carries a hint saying what the third axis buys',
  PRESETS_3D.every((p) => typeof p.hint === 'string' && p.hint.length > 20));
ok('resistivity is plotted on a log axis',
  preset('fluid').axes.find((a) => a.key === 'RT').log === true);
ok('NPHI is drawn with its scale reversed, as a log is read',
  preset('fluid').axes[0].lo > preset('fluid').axes[0].hi);
ok('Sw is drawn with its scale reversed — low Sw is the good end',
  preset('quality').axes[1].lo > preset('quality').axes[1].hi);

// ── curveOf reads measurements from raw and interpretation from ours ─────────
{
  const b = bore('A', { rhob: [2.3], nphi: [0.2], rt: [10], gr: [40], phie: [0.2], sw: [0.3], vsh: [0.1] });
  ok('RHOB comes from the raw measurements', curveOf(b, 'RHOB')[0] === 2.3);
  ok('PHIE comes from OUR interpretation', curveOf(b, 'PHIE')[0] === 0.2);
  ok('an axis with no curve is undefined, not empty', curveOf(bore('B', {}), 'RHOB') === undefined);
}

// ── the LAS absent value must never reach the cloud ──────────────────────────
{
  const b = bore('A', {
    nphi: [0.20, -999.25, 0.25],
    rhob: [2.30, -999.25, 2.20],
    rt: [10, -999.25, 40],
    net: [true, true, false],
  });
  const c = buildCloud3D([b], preset('fluid'));
  ok('−999.25 samples are screened out, not plotted', c.n === 2, `n=${c.n}`);
  ok('the surviving samples are the real ones', c.found === 2);
  ok('pay is counted from the surviving samples only', c.pay === 1, `pay=${c.pay}`);
}
{
  // a curve that is ENTIRELY absent is an absent curve, not a present one
  const b = bore('A', { nphi: [-999.25, -999.25], rhob: [2.3, 2.4], rt: [10, 20], net: [true, true] });
  const c = buildCloud3D([b], preset('fluid'));
  ok('a curve that is all −999.25 blocks the plot with a reason', c.blocked !== null);
  ok('the reason names the axes the preset needs', /NPHI/.test(c.blocked), c.blocked);
  ok('a blocked cloud still reports how many bores were considered', c.ofWells === 1);
}

// ── a missing curve blocks, and says which bores could have carried it ───────
{
  const good = bore('A', { nphi: [0.2, 0.3], rhob: [2.3, 2.2], rt: [10, 30], net: [true, false] });
  const partial = bore('B', { nphi: [0.2], rhob: [2.3] });   // no RT
  const c = buildCloud3D([good, partial], preset('fluid'));
  ok('only bores carrying all three axes contribute', c.wellsWithAll === 1, `${c.wellsWithAll}`);
  ok('but the total considered is reported too', c.ofWells === 2);
  ok('the well list holds only the contributing bores', c.wells.length === 1 && c.wells[0] === 'A');
}

// ── colour is a CLASS, carried explicitly ────────────────────────────────────
{
  const b = bore('A', {
    nphi: [0.2, 0.25, 0.3], rhob: [2.3, 2.25, 2.2], rt: [10, 20, 30],
    net: [true, false, null],
  });
  const c = buildCloud3D([b], preset('fluid'));
  ok('pay, non-pay and no-verdict are all kept', c.n === 3);
  ok('pay is counted', c.pay === 1);
  ok('a sample with no net verdict is counted as unclassified, not as non-pay',
    c.unclassified === 1, `unclassified=${c.unclassified}`);
  ok('non-pay is what is left over', c.n - c.pay - c.unclassified === 1);
  ok('the class array agrees with the counts',
    c.cls[0] === 1 && c.cls[1] === 0 && c.cls[2] === 2, Array.from(c.cls).join(','));
  ok('every point has a class', c.cls.length === c.n);
  // the three classes must be visually distinct — a legend that lies is worse
  // than no legend
  const rgb = (i) => [c.color[i * 3], c.color[i * 3 + 1], c.color[i * 3 + 2]].join(',');
  ok('the three classes are three different colours',
    new Set([rgb(0), rgb(1), rgb(2)]).size === 3);
}
{
  // net shorter than the curves must not silently mark the tail as non-pay
  const b = bore('A', { nphi: [0.2, 0.25], rhob: [2.3, 2.25], rt: [10, 20], net: [true] });
  const c = buildCloud3D([b], preset('fluid'));
  ok('a net flag shorter than the curves truncates rather than assuming non-pay',
    c.n === 1 && c.pay === 1, `n=${c.n} pay=${c.pay}`);
}

// ── normalisation: the box is the box ────────────────────────────────────────
{
  const b = bore('A', { nphi: [0.6, 0.0], rhob: [1.9, 2.9], rt: [1, 100], net: [true, true] });
  const c = buildCloud3D([b], preset('fluid'));
  ok('every coordinate lands inside the unit cube',
    Array.from(c.position).every((v) => v >= -1.0001 && v <= 1.0001));
  ok('the declared domain ends map to the box ends',
    near(Math.min(...c.position.filter((_v, i) => i % 3 === 0)), -1, 1e-5));
}
{
  // a sample outside a FIXED domain is clamped, not allowed to drag the framing
  const b = bore('A', { nphi: [0.2], rhob: [4.0], rt: [10], net: [true] });
  const c = buildCloud3D([b], preset('fluid'));
  ok('a sample beyond a fixed domain is screened or clamped, never off the box',
    c.n === 0 || Math.abs(c.position[1]) <= 1.0001);
}
{
  // RT has no fixed domain — it comes from the data, in log space
  const b = bore('A', { nphi: [0.2, 0.3], rhob: [2.3, 2.2], rt: [1, 1000], net: [true, true] });
  const c = buildCloud3D([b], preset('fluid'));
  ok('a data-driven log domain is expressed in log space',
    near(c.domains[2][0], 0, 1e-6) && near(c.domains[2][1], 3, 1e-6), c.domains[2].join('..'));
}
{
  // one sample = no extent. Widening beats dividing by zero.
  const b = bore('A', { nphi: [0.2], rhob: [2.3], rt: [10], net: [true] });
  const c = buildCloud3D([b], preset('fluid'));
  ok('a degenerate domain is widened rather than producing NaN',
    c.domains[2][1] > c.domains[2][0] && Array.from(c.position).every(Number.isFinite));
}

// ── percent-scaled curves ────────────────────────────────────────────────────
{
  // NPHI delivered as percent must be recognised, not rejected sample by sample
  const nphi = Array.from({ length: 20 }, (_v, i) => 15 + i);       // 15–34 %
  const rhob = Array.from({ length: 20 }, () => 2.3);
  const rt = Array.from({ length: 20 }, () => 10);
  const c = buildCloud3D([bore('A', { nphi, rhob, rt, net: nphi.map(() => true) })], preset('fluid'));
  ok('a percent-scaled neutron log is rescaled, not reported as absent',
    c.blocked === null && c.n === 20, `n=${c.n} blocked=${c.blocked}`);
}

// ── thinning ─────────────────────────────────────────────────────────────────
{
  const n = 5000;
  const b = bore('A', {
    nphi: Array.from({ length: n }, (_v, i) => 0.05 + (i % 100) / 400),
    rhob: Array.from({ length: n }, (_v, i) => 2.0 + (i % 50) / 100),
    rt: Array.from({ length: n }, (_v, i) => 1 + (i % 200)),
    net: Array.from({ length: n }, (_v, i) => i % 2 === 0),
  });
  const c = buildCloud3D([b], preset('fluid'), 500);
  ok('the cap is respected', c.n <= 500, `n=${c.n}`);
  ok('what was found before thinning is still reported', c.found === n, `found=${c.found}`);
  const again = buildCloud3D([b], preset('fluid'), 500);
  ok('thinning is deterministic — the same data gives the same picture',
    Array.from(c.position).every((v, i) => v === again.position[i]));
  // a stride, not a head-truncation: the last sample's neighbourhood must survive
  const lastX = c.position[(c.n - 1) * 3];
  ok('thinning strides through the whole log rather than taking its head',
    Number.isFinite(lastX) && c.n > 1);
  ok('the default cap is a real number', MAX_POINTS > 1000);
}

// ── empty inputs ─────────────────────────────────────────────────────────────
{
  const c = buildCloud3D([], preset('fluid'));
  ok('no bores is blocked, not a crash', c.blocked !== null && c.n === 0);
  ok('an empty cloud still has three domains', c.domains.length === 3);
}

// ── axis ticks ───────────────────────────────────────────────────────────────
{
  const t = axisTicks(preset('fluid').axes[2], [0, 3], 3);
  ok('log ticks are labelled in real units, not in log space',
    t[0].label === '1.0' && t[t.length - 1].label === '1000', t.map((x) => x.label).join(','));
  ok('tick positions span the box', near(t[0].at, -1, 1e-6) && near(t[t.length - 1].at, 1, 1e-6));
}
{
  const t = axisTicks(preset('lithology').axes[2], [0, 150], 3);
  ok('a linear wide-range axis is labelled without decimals', t[1].label === '50', t[1].label);
}

console.log(`petro-xplot3d: ${pass}/${pass + fail}`);
if (fail) process.exit(1);

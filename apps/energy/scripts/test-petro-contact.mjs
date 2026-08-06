// test-petro-contact.mjs — putting a TVDSS contact on an MD track.
//
// The failure this locks out is the plausible one: drawing a −3120 m TVDSS
// contact at 3120 m MD. On a bore deviated 400 m that is 400 m of pay in the
// wrong place, and nothing about the picture looks wrong.
import {
  fitMdTvd, contactMd, tvdssFromMd, tvdssSign, primaryContact,
} from '../src/tabs/fielddev/petro-contact.ts';

let pass = 0, fail = 0;
const ok = (n, c, e = '') => { if (c) pass++; else { fail++; console.error(`  ✗ ${n}${e ? ` — ${e}` : ''}`); } };
const near = (a, b, t) => Math.abs(a - b) <= t;

// ── the fit ──────────────────────────────────────────────────────────────────
{
  // a bore where 1 m of TVD costs 1.25 m of hole — a 37° average deviation
  const picks = [
    { surface: 'A', md: 2500, tvdss: -2000 },
    { surface: 'B', md: 3125, tvdss: -2500 },
  ];
  const f = fitMdTvd(picks);
  ok('two dual picks give a fit', f !== null);
  ok('the slope is the bore\'s own md-per-tvd', near(f.b, -1.25, 1e-6), String(f?.b));
  ok('the fit reproduces its own picks', near(f.a + f.b * -2000, 2500, 1e-6));
  ok('it reports how many picks it rests on', f.n === 2);
  ok('and the TVDSS span it covers', f.from === -2500 && f.to === -2000);
}
{
  const f = fitMdTvd([{ surface: 'A', md: 2500, tvdss: -2000 }]);
  ok('one dual pick is not a fit — a single point has no slope', f === null);
}
{
  const f = fitMdTvd([
    { surface: 'A', md: 2500, tvdss: -2000 },
    { surface: 'B', md: 2600, tvdss: null },
    { surface: 'C', md: 2700 },
  ]);
  ok('picks without a TVDSS are ignored, and one dual pick is still no fit', f === null);
}
{
  const f = fitMdTvd([
    { surface: 'A', md: 2500, tvdss: -2000 },
    { surface: 'B', md: 2600, tvdss: -2000 },
  ]);
  ok('two picks at the same TVDSS give no fit rather than an infinite slope', f === null);
}
{
  // a third pick that disagrees is absorbed, not obeyed
  const f = fitMdTvd([
    { surface: 'A', md: 2500, tvdss: -2000 },
    { surface: 'B', md: 3125, tvdss: -2500 },
    { surface: 'C', md: 3750, tvdss: -3000 },
  ]);
  ok('three collinear picks give the same slope', near(f.b, -1.25, 1e-9), String(f?.b));
  ok('and rest on all three', f.n === 3);
}
{
  const f = fitMdTvd([
    { surface: 'A', md: 2500, tvdss: -2000 },
    { surface: 'B', md: 3125, tvdss: -2500 },
    { surface: 'C', md: 4000, tvdss: -3000 },   // off the line
  ]);
  ok('an outlier moves the fit but does not own it', f.b < -1.25 && f.b > -1.6, String(f?.b));
}

// ── the placement ────────────────────────────────────────────────────────────
{
  const f = fitMdTvd([
    { surface: 'A', md: 2500, tvdss: -2000 },
    { surface: 'B', md: 3125, tvdss: -2500 },
  ]);
  const inside = contactMd(f, -2400);
  ok('a contact inside the pick span is placed', near(inside.md, 3000, 1e-6), String(inside?.md));
  ok('and is NOT flagged as extrapolated', inside.extrapolated === false);
  // the whole point: MD ≠ TVDSS on a deviated bore
  ok('the placed MD is not the TVDSS depth', Math.abs(inside.md - 2400) > 500);

  const below = contactMd(f, -3000);
  ok('a contact below the deepest pick is still placed', near(below.md, 3750, 1e-6), String(below?.md));
  ok('but it IS flagged as extrapolated', below.extrapolated === true);
  ok('the placement carries the fit\'s sample count', below.n === 2);
}
{
  ok('no fit means no placement — never a vertical-well assumption',
    contactMd(null, -3000) === null);
}
{
  const f = fitMdTvd([
    { surface: 'A', md: 2500, tvdss: -2000 },
    { surface: 'B', md: 3125, tvdss: -2500 },
  ]);
  ok('a non-finite contact is refused', contactMd(f, NaN) === null);
  // one metre past the deepest pick is not meaningfully an extrapolation
  ok('a contact a metre past the span is not called extrapolated',
    contactMd(f, -2501).extrapolated === false);
}
{
  // positive-down TVDSS must work identically — the fit inherits the convention
  const f = fitMdTvd([
    { surface: 'A', md: 2500, tvdss: 2000 },
    { surface: 'B', md: 3125, tvdss: 2500 },
  ]);
  ok('the fit does not assume a TVDSS sign convention',
    near(contactMd(f, 2400).md, 3000, 1e-6));
}

// ── the TVDSS view ───────────────────────────────────────────────────────────
{
  // 1 m of TVD costs 1.25 m of hole
  const f = fitMdTvd([
    { surface: 'A', md: 2500, tvdss: -2000 },
    { surface: 'B', md: 3125, tvdss: -2500 },
  ]);
  ok('a measured depth converts back to TVDSS', near(tvdssFromMd(f, 3000), -2400, 1e-6),
    String(tvdssFromMd(f, 3000)));
  ok('the round trip is the identity',
    near(tvdssFromMd(f, contactMd(f, -2400).md), -2400, 1e-6));
  // THE WHOLE POINT: on a deviated bore MD and TVDSS are different depths, and a
  // panel that draws one under an axis labelled the other is wrong by the
  // deviation — several hundred metres here — while looking entirely plausible
  ok('MD and TVDSS differ by the deviation', Math.abs(tvdssFromMd(f, 3000) + 3000) > 500);
  ok('no fit means no TVDSS — a bore that cannot be converted must be DROPPED',
    tvdssFromMd(null, 3000) === null);
  ok('a non-finite depth is refused', tvdssFromMd(f, NaN) === null);
}
{
  // a perfectly horizontal section has no TVD change; inverting it would divide
  // by ~zero and place samples at infinity
  const f = { a: 0, b: 0, n: 2, from: -2000, to: -2000 };
  ok('a zero-slope fit cannot be inverted', tvdssFromMd(f, 3000) === null);
}

// ── which way is down ────────────────────────────────────────────────────────
{
  ok('negative-down TVDSS is detected', tvdssSign([-2000, -2500, -3000]) === -1);
  ok('positive-down TVDSS is detected', tvdssSign([2000, 2500, 3000]) === 1);
  ok('the median decides, so one mis-signed outlier cannot flip the panel',
    tvdssSign([-2000, -2500, -3000, 2800]) === -1);
  ok('nulls are ignored', tvdssSign([null, -2000, undefined, -2500]) === -1);
  ok('an empty set falls back to the common convention', tvdssSign([]) === -1);
  // multiplying by the sign must give a number that INCREASES downward
  const s = tvdssSign([-2000, -3000]);
  ok('sign times depth increases downward', s * -3000 > s * -2000);
}

// ── choosing the contact ─────────────────────────────────────────────────────
{
  const cs = [
    { kind: 'OWC', tvdss: -3120 },
    { kind: 'reference datum', tvdss: -100 },
  ];
  const c = primaryContact(cs);
  ok('a fluid contact is chosen', c.kind === 'OWC');
  ok('a reference datum is NOT drawn as a fluid contact', c.kind !== 'reference datum');
}
{
  ok('no fluid contact means none is drawn', primaryContact([{ kind: 'datum', tvdss: -100 }]) === null);
  ok('an empty list is handled', primaryContact([]) === null);
  ok('a contact with no depth is not usable', primaryContact([{ kind: 'OWC', tvdss: null }]) === null);
}
{
  const c = primaryContact([
    { kind: 'GOC', tvdss: -2900 },
    { kind: 'OWC', tvdss: -3120 },
  ]);
  ok('with several, the deepest is chosen — that is what net pay cuts against',
    c.kind === 'OWC');
}

console.log(`petro-contact: ${pass}/${pass + fail}`);
if (fail) process.exit(1);

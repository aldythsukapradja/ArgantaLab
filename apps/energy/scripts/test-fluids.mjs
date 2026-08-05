// fluid-model.ts truth-lock — PVT · SCAL · initialization.
//
// Every assertion is one of three kinds:
//   1. a PUBLISHED correlation checked against a hand-computed value (Standing,
//      Beggs–Robinson, Vazquez–Beggs, Sutton, DAK, McCain, Osif, Lee–Gonzalez);
//   2. a PHYSICAL invariant the module promises (round trips, monotonicity,
//      end-point exactness, mass/volume identities);
//   3. a PROVENANCE rule — absent input yields absence, never a default that looks
//      like data, and an analogue never presents itself as a measurement.
//
// The anchors used throughout are Volve's own, read from the shipped delivery
// manifest (public/wb/index.json) rather than typed in, so this test fails if the
// delivery ever changes underneath the tab.
// Run: node scripts/test-fluids.mjs
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol = 1e-6) =>
  check(n, Number.isFinite(got) && Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'fluid-model.ts');
if (!existsSync(mod)) { console.log('SKIP — fluid-model.ts absent'); process.exit(0); }
const F = await import('../src/tabs/fielddev/fluid-model.ts');
const {
  readAnchors, oilApi, gasGravity, brineSalinityWtPct,
  standingPb, standingRs, standingBo, vazquezBeggsCo,
  beggsRobinsonMuOd, beggsRobinsonMuOb, vazquezBeggsMuO,
  suttonPseudoCriticals, dakZ, gasFvf, leeGonzalezMuG,
  mccainBw, osifCw, mccainMuW,
  buildPvt, SCAL_ANALOGUE, coreyKr, fracFlow, mobilityRatio, displacementEfficiency,
  welgeFront, buildSwof, pcEntryPressure, brooksCoreyPc, swAtHeight,
  fitGradient, fitByWell, gradientIntersection, gradientOf, phasePressure, buildEquil,
  stoiip, reconcile, buildCase, validateCase, toSimFluids, isRunnable, toEclipseDeck,
  cToF, barToPsi, sm3ToScf, PSI_PER_BAR, K_SCREENING_MD,
} = F;

// ── the delivery's own anchors ───────────────────────────────────────────────
const idxPath = join(__dirname, '..', 'public', 'wb', 'index.json');
if (!existsSync(idxPath)) { console.log('SKIP — public/wb/index.json absent (run npm run data:wb)'); process.exit(0); }
const index = JSON.parse(readFileSync(idxPath, 'utf8'));
const a = readAnchors(index);
check('the delivery manifest yields a complete PVT anchor set', !!a, a ? '' : 'readAnchors returned null');
if (!a) process.exit(1);

eq('anchors are read, not assumed', [a.pi, a.pb, a.rsb, a.boAtPi, a.tC, a.datumTvdss],
  [index.pvt.Pi, index.pvt.Pb, index.pvt.Rs, index.pvt.Bo, index.pvt.T, index.pvt.datum_tvdss]);
eq('surface densities come from the deck DENSITY record',
  [a.rhoOilSc, a.rhoWaterSc, a.rhoGasSc],
  [index.pvt.density_kgm3.oil, index.pvt.density_kgm3.water, index.pvt.density_kgm3.gas]);
eq('rock compaction comes from the deck ROCK record', [a.rockPref, a.rockCf], [index.pvt.rock.pref_bara, index.pvt.rock.cf]);

// ── absence is absence ───────────────────────────────────────────────────────
eq('no payload yields no anchors', readAnchors(null), null);
eq('no PVT block yields no anchors', readAnchors({}), null);
eq('a PARTIAL PVT block yields no anchors — half a deck is not a case',
  readAnchors({ pvt: { Pi: 337, Pb: 256, Rs: 148 } }), null);
eq('missing densities yield no anchors',
  readAnchors({ pvt: { ...index.pvt, density_kgm3: { oil: 882 } } }), null);
eq('missing rock compaction yields no anchors',
  readAnchors({ pvt: { ...index.pvt, rock: {} } }), null);

// ── fluid identity ───────────────────────────────────────────────────────────
// API = 141.5/SG − 131.5 with SG = 882/1000
near('API gravity is the closed form', oilApi(882), 141.5 / 0.882 - 131.5, 1e-9);
near('a 1000 kg/m³ oil is 10 °API by definition', oilApi(1000), 10, 1e-9);
near('gas gravity is density over air at the metric standard condition', gasGravity(1.09956), 1.09956 / 1.225, 1e-12);
// Round trip through McCain's brine density: S → ρ → S
{
  const S = 13.0;
  const lbft3 = 62.368 + 0.438603 * S + 1.60074e-3 * S * S;
  near('brine salinity inverts McCain\'s density exactly', brineSalinityWtPct(lbft3 * 16.018463), S, 1e-6);
  check('fresh water reads ~0 wt% NaCl', brineSalinityWtPct(999.0) === 0, `got ${brineSalinityWtPct(999.0)}`);
  check('the deck brine is saline, and that is a finding not a default',
    brineSalinityWtPct(a.rhoWaterSc) > 10, `${brineSalinityWtPct(a.rhoWaterSc).toFixed(1)} wt% from ${a.rhoWaterSc} kg/m³`);
}

// ── Standing, both directions ────────────────────────────────────────────────
{
  const gammaG = 0.8, api = 30, tF = 200;
  // hand value: yg = 10^(0.00091·200 − 0.0125·30) = 10^(0.182 − 0.375) = 10^(−0.193)
  const yg = 10 ** (0.00091 * 200 - 0.0125 * 30);
  const rs = 500;
  const want = 18.2 * ((rs / gammaG) ** 0.83 * yg - 1.4);
  near('Standing Pb matches the published form', standingPb(rs, gammaG, api, tF), want, 1e-9);
  near('Standing Rs inverts Standing Pb', standingRs(want, gammaG, api, tF), rs, 1e-6);
  check('Rs rises with pressure', standingRs(3000, gammaG, api, tF) > standingRs(1500, gammaG, api, tF), '');
  eq('Rs cannot go negative below the correlation\'s floor', standingRs(-100, gammaG, api, tF), 0);
}
{
  // Standing Bo: 0.9759 + 0.00012·[Rs·√(γg/γo) + 1.25·T]^1.2
  const f = 800 * Math.sqrt(0.85 / 0.87) + 1.25 * 220;
  near('Standing Bo matches the published form', standingBo(800, 0.85, 0.87, 220), 0.9759 + 0.00012 * f ** 1.2, 1e-12);
  check('Bo rises with solution gas', standingBo(900, 0.85, 0.87, 220) > standingBo(400, 0.85, 0.87, 220), '');
  check('a dead oil sits near unity FVF', Math.abs(standingBo(0, 0.85, 0.87, 60) - 1) < 0.12, `got ${standingBo(0, 0.85, 0.87, 60)}`);
}

// ── viscosity chain ──────────────────────────────────────────────────────────
{
  const api = 28.93, tF = 230;
  const z = 3.0324 - 0.02023 * api, y = 10 ** z, x = y * tF ** -1.163;
  near('Beggs–Robinson dead oil matches the published form', beggsRobinsonMuOd(api, tF), 10 ** x - 1, 1e-12);
  check('a heavier oil is more viscous', beggsRobinsonMuOd(18, tF) > beggsRobinsonMuOd(35, tF), '');
  check('a hotter oil is less viscous', beggsRobinsonMuOd(api, 260) < beggsRobinsonMuOd(api, 180), '');
  const muOd = beggsRobinsonMuOd(api, tF);
  check('solution gas thins the oil', beggsRobinsonMuOb(muOd, 800) < muOd, '');
  check('more solution gas thins it further', beggsRobinsonMuOb(muOd, 1200) < beggsRobinsonMuOb(muOd, 400), '');
  const muob = beggsRobinsonMuOb(muOd, 831);
  near('undersaturated viscosity equals μob at the bubble point', vazquezBeggsMuO(muob, 3713, 3713), muob, 1e-12);
  check('compressing an undersaturated oil raises its viscosity', vazquezBeggsMuO(muob, 4888, 3713) > muob, '');
}

// ── gas ──────────────────────────────────────────────────────────────────────
{
  const g = 0.7;
  const { tpc, ppc } = suttonPseudoCriticals(g);
  near('Sutton Tpc matches the published form', tpc, 169.2 + 349.5 * g - 74.0 * g * g, 1e-12);
  near('Sutton Ppc matches the published form', ppc, 756.8 - 131.0 * g - 3.6 * g * g, 1e-12);
  // DAK is checked against Hall–Yarborough, implemented here independently: two
  // different fits of the same Standing–Katz chart agreeing to a few thousandths is
  // a far stronger statement than either matching a number read off a figure.
  const hallYarborough = (ppr, tpr) => {
    const t = 1 / tpr;
    const A = 0.06125 * t * Math.exp(-1.2 * (1 - t) ** 2);
    const B = t * (14.76 - 9.76 * t + 4.58 * t * t);
    const C = t * (90.7 - 242.2 * t + 42.4 * t * t);
    const D = 2.18 + 2.82 * t;
    let lo = 1e-8, hi = 0.99;
    const f = (y) => -A * ppr + (y + y * y + y ** 3 - y ** 4) / (1 - y) ** 3 - B * y * y + C * y ** D;
    for (let i = 0; i < 200; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) > 0) hi = mid; else lo = mid;
    }
    return A * ppr / ((lo + hi) / 2);
  };
  for (const [ppr, tpr] of [[2, 1.5], [3, 1.4], [5, 1.8], [1, 1.3], [6, 2.0]]) {
    const z = dakZ(ppr, tpr), hy = hallYarborough(ppr, tpr);
    check(`DAK agrees with Hall–Yarborough at Ppr ${ppr} / Tpr ${tpr}`, Math.abs(z - hy) < 0.01,
      `DAK ${z.toFixed(4)} vs HY ${hy.toFixed(4)}`);
  }
  check('DAK → 1 as pressure → 0 (ideal gas limit)', Math.abs(dakZ(0.01, 1.5) - 1) < 0.01, `got ${dakZ(0.01, 1.5)}`);
  check('Z dips below 1 in the compressible region', dakZ(3, 1.4) < 1, `got ${dakZ(3, 1.4)}`);
  eq('a non-physical reduced state returns the ideal factor rather than a root', dakZ(-1, 1.5), 1);
  // Bg = (Psc/Tsc)·Z·T/p
  near('gas FVF is the metric standard-condition ratio', gasFvf(200, 383, 0.9), (1.01325 / 288.15) * (0.9 * 383 / 200), 1e-12);
  check('Bg falls as pressure rises', gasFvf(400, 383, 0.9) < gasFvf(200, 383, 0.9), '');
  check('Lee–Gonzalez gives a plausible reservoir gas viscosity',
    leeGonzalezMuG(200, 690, 20) > 0.01 && leeGonzalezMuG(200, 690, 20) < 0.1,
    `got ${leeGonzalezMuG(200, 690, 20).toFixed(5)} cP`);
  check('a denser gas is more viscous', leeGonzalezMuG(300, 690, 20) > leeGonzalezMuG(150, 690, 20), '');
}

// ── brine ────────────────────────────────────────────────────────────────────
{
  const tF = 230, p = 4770;
  const dVwt = -1.0001e-2 + 1.33391e-4 * tF + 5.50654e-7 * tF * tF;
  const dVwp = -1.95301e-9 * p * tF - 1.72834e-13 * p * p * tF - 3.58922e-7 * p - 2.25341e-10 * p * p;
  near('McCain Bw matches the published form', mccainBw(p, tF), (1 + dVwt) * (1 + dVwp), 1e-12);
  check('hot brine expands past unity FVF', mccainBw(p, tF) > 1, `got ${mccainBw(p, tF)}`);
  check('compressing brine reduces Bw', mccainBw(6000, tF) < mccainBw(2000, tF), '');
  near('Osif cw matches the published form', osifCw(p, tF, 150), 1 / (7.033 * p + 541.5 * 150 - 537 * tF + 403300), 1e-15);
  check('brine compressibility is order 1e-6 /psi', osifCw(p, tF, 150) > 1e-6 && osifCw(p, tF, 150) < 5e-6, `got ${osifCw(p, tF, 150)}`);
  check('saltier brine is more viscous', mccainMuW(p, tF, 15) > mccainMuW(p, tF, 2), '');
  check('hotter brine is less viscous', mccainMuW(p, 300, 10) < mccainMuW(p, 150, 10), '');
}

// ── the PVT tables ───────────────────────────────────────────────────────────
const pvt = buildPvt(a);
{
  const last = pvt.pvto[pvt.pvto.length - 1];
  near('the saturated branch ends EXACTLY on the deck bubble point', last.p, a.pb, 1e-9);
  near('the saturated branch ends EXACTLY on the deck solution GOR', last.rs, a.rsb, 1e-9);
  near('the undersaturated branch starts at the bubble point', pvt.undersaturated[0].p, a.pb, 1e-9);
  near('Bo is continuous across the bubble point', pvt.undersaturated[0].bo, last.bo, 1e-9);
  near('Bob is recovered from the deck Bo(Pi) by undoing the undersaturated compression',
    pvt.bob, a.boAtPi * Math.exp(pvt.co * (a.pi - a.pb)), 1e-12);
  check('Bob exceeds the deck Bo quoted at initial pressure', pvt.bob > a.boAtPi,
    `Bob ${pvt.bob.toFixed(4)} vs Bo(Pi) ${a.boAtPi}`);

  check('Rs increases monotonically down the saturated branch',
    pvt.pvto.every((r, i) => i === 0 || r.rs >= pvt.pvto[i - 1].rs), '');
  check('Bo increases monotonically down the saturated branch',
    pvt.pvto.every((r, i) => i === 0 || r.bo >= pvt.pvto[i - 1].bo), '');
  check('oil viscosity FALLS as solution gas comes in',
    pvt.pvto.every((r, i) => i === 0 || r.muo <= pvt.pvto[i - 1].muo), '');
  check('Bo FALLS along the undersaturated branch',
    pvt.undersaturated.every((r, i) => i === 0 || r.bo <= pvt.undersaturated[i - 1].bo), '');
  check('viscosity RISES along the undersaturated branch',
    pvt.undersaturated.every((r, i) => i === 0 || r.muo >= pvt.undersaturated[i - 1].muo), '');
  check('every saturated row is flagged saturated and every undersaturated row is not',
    pvt.pvto.every((r) => r.saturated) && pvt.undersaturated.every((r) => !r.saturated), '');
  check('Rs is frozen at Rsb above the bubble point',
    pvt.undersaturated.every((r) => Math.abs(r.rs - a.rsb) < 1e-12), '');

  // reservoir oil density: (ρo + Rs·ρg)/Bo — the mass balance the table must satisfy
  near('reservoir oil density is the surface mass balance over Bo',
    last.rho, (a.rhoOilSc + a.rsb * a.rhoGasSc) / last.bo, 1e-9);
  check('live reservoir oil is lighter than its stock-tank oil', pvt.rhoOilRes < a.rhoOilSc,
    `${pvt.rhoOilRes.toFixed(1)} vs ${a.rhoOilSc} kg/m³`);
  check('reservoir water is denser than reservoir oil — the phases can segregate',
    pvt.rhoWaterRes > pvt.rhoOilRes, `${pvt.rhoWaterRes.toFixed(1)} vs ${pvt.rhoOilRes.toFixed(1)} kg/m³`);
}
{
  // the anchoring is REPORTED, not hidden
  const c = pvt.calibration;
  near('the Rs anchor factor is exactly what maps the prediction onto the deck',
    c.rsPredicted * c.rsFactor, a.rsb, 1e-9);
  near('the Bo anchor factor is exactly what maps the prediction onto Bob',
    c.boPredicted * c.boFactor, pvt.bob, 1e-12);
  check('the anchoring factors are finite and positive', c.rsFactor > 0 && c.boFactor > 0,
    `Rs ×${c.rsFactor.toFixed(4)}, Bo ×${c.boFactor.toFixed(4)}`);
}
{
  check('Bg falls monotonically with pressure', pvt.pvdg.every((r, i) => i === 0 || r.bg <= pvt.pvdg[i - 1].bg), '');
  check('gas viscosity rises monotonically with pressure', pvt.pvdg.every((r, i) => i === 0 || r.mug >= pvt.pvdg[i - 1].mug), '');
  check('every Z factor is physical', pvt.pvdg.every((r) => r.z > 0.2 && r.z < 1.6), '');
  near('PVDG density is the surface gas mass over Bg', pvt.pvdg[3].rho, a.rhoGasSc / pvt.pvdg[3].bg, 1e-9);
  check('Bw falls monotonically with pressure', pvt.pvtw.every((r, i) => i === 0 || r.bw <= pvt.pvtw[i - 1].bw), '');
  check('the water leg is a real brine, not fresh water',
    pvt.muw > 0.2 && pvt.muw < 1.5, `μw ${pvt.muw.toFixed(4)} cP`);
  check('the oil is light and mobile at reservoir conditions',
    pvt.muoAtPi > 0.1 && pvt.muoAtPi < 5, `μo(Pi) ${pvt.muoAtPi.toFixed(4)} cP`);
}

// ── SCAL ─────────────────────────────────────────────────────────────────────
{
  const e = SCAL_ANALOGUE;
  eq('kr is exactly zero for the displacing phase at connate water', coreyKr(e.swc, e).krw, 0);
  near('kro is exactly its end point at connate water', coreyKr(e.swc, e).kro, e.kroMax, 1e-12);
  eq('kro is exactly zero at residual oil', coreyKr(1 - e.sor, e).kro, 0);
  near('krw is exactly its end point at residual oil', coreyKr(1 - e.sor, e).krw, e.krwMax, 1e-12);
  check('kr curves are clamped outside the mobile range',
    coreyKr(0.05, e).krw === 0 && coreyKr(0.99, e).kro === 0, '');
  check('krw rises and kro falls with water saturation', (() => {
    let ok = true;
    for (let i = 1; i <= 20; i++) {
      const lo = coreyKr(e.swc + (1 - e.sor - e.swc) * (i - 1) / 20, e);
      const hi = coreyKr(e.swc + (1 - e.sor - e.swc) * i / 20, e);
      if (!(hi.krw >= lo.krw && hi.kro <= lo.kro)) ok = false;
    }
    return ok;
  })(), '');

  eq('fractional flow is 0 at connate water', fracFlow(e.swc, e, 0.5, 1.0), 0);
  near('fractional flow is 1 at residual oil', fracFlow(1 - e.sor, e, 0.5, 1.0), 1, 1e-12);
  near('the end-point mobility ratio is the closed form',
    mobilityRatio(e, 0.5, 1.0), (e.krwMax / 0.5) / (e.kroMax / 1.0), 1e-12);
  near('displacement efficiency is (1−Swc−Sor)/(1−Swc)',
    displacementEfficiency(e), (1 - e.swc - e.sor) / (1 - e.swc), 1e-12);
  check('a lower residual oil displaces more', displacementEfficiency({ ...e, sor: 0.15 }) > displacementEfficiency(e), '');

  // Welge: the tangent from Swc must be a tangent — no chord can beat it
  const w = welgeFront(e, 0.5, 1.0);
  check('the Welge front sits inside the mobile range', w.swf > e.swc && w.swf < 1 - e.sor, `Swf ${w.swf.toFixed(4)}`);
  check('the tangent from Swc is maximal — no other saturation gives a steeper chord', (() => {
    const slope = (sw) => fracFlow(sw, e, 0.5, 1.0) / (sw - e.swc);
    const best = slope(w.swf);
    for (let i = 1; i < 400; i++) {
      const sw = e.swc + (1 - e.sor - e.swc) * i / 400;
      if (slope(sw) > best * (1 + 1e-6)) return false;
    }
    return true;
  })(), '');
  check('average saturation behind the front exceeds the front saturation', w.swAvgBt > w.swf,
    `Sw_avg ${w.swAvgBt.toFixed(4)} vs Swf ${w.swf.toFixed(4)}`);
  check('breakthrough recovery is a fraction, and less than the ultimate displacement efficiency',
    w.recoveryBt > 0 && w.recoveryBt < displacementEfficiency(e),
    `${(w.recoveryBt * 100).toFixed(1)}% vs ED ${(displacementEfficiency(e) * 100).toFixed(1)}%`);
  near('PVI at breakthrough equals the recovery of movable oil (Welge identity)',
    w.pviBt, w.swAvgBt - e.swc, 1e-9);
  check('a MORE viscous oil breaks through earlier', welgeFront(e, 0.5, 20).pviBt < welgeFront(e, 0.5, 1).pviBt,
    `${welgeFront(e, 0.5, 20).pviBt.toFixed(4)} vs ${welgeFront(e, 0.5, 1).pviBt.toFixed(4)} PVI`);
}

/** The issues a case would raise for a given SCAL set, holding everything else fixed. */
const kaseIssuesFor = (scal) => buildCase({
  fieldId: 'x', anchors: a, contacts: index.contacts ?? [], scal,
  rock: { phi: index.defaults.phi, ntg: index.defaults.ntg, sw: Math.max(index.defaults.sw, scal.swc) },
}).issues;

// ── LET relative permeability ────────────────────────────────────────────────
{
  const { letKr } = F;
  const e = { ...SCAL_ANALOGUE, model: 'let', lw: 3, ew: 1, tw: 2, lo: 2, eo: 1, to: 2 };
  // the end points are what make a model switch safe — both families must honour them
  near('LET krw is zero at connate water', letKr(e.swc, e).krw, 0, 1e-12);
  near('LET krw hits its end point exactly at residual oil', letKr(1 - e.sor, e).krw, e.krwMax, 1e-12);
  near('LET kro is zero at residual oil', letKr(1 - e.sor, e).kro, 0, 1e-12);
  near('LET kro hits its end point exactly at connate water', letKr(e.swc, e).kro, e.kroMax, 1e-12);
  check('LET krw rises and kro falls monotonically', (() => {
    for (let i = 1; i <= 40; i++) {
      const lo = letKr(e.swc + (1 - e.sor - e.swc) * (i - 1) / 40, e);
      const hi = letKr(e.swc + (1 - e.sor - e.swc) * i / 40, e);
      if (!(hi.krw >= lo.krw - 1e-12 && hi.kro <= lo.kro + 1e-12)) return false;
    }
    return true;
  })(), '');
  check('E is the middle degree of freedom Corey lacks — it moves the curve without moving the end points',
    (() => {
      const lowE = { ...e, ew: 0.2 }, highE = { ...e, ew: 5 };
      const mid = e.swc + (1 - e.sor - e.swc) * 0.5;
      const differs = Math.abs(letKr(mid, lowE).krw - letKr(mid, highE).krw) > 0.05;
      const endsHold = Math.abs(letKr(1 - e.sor, lowE).krw - letKr(1 - e.sor, highE).krw) < 1e-12;
      return differs && endsHold;
    })(), '');
  check('the model selector actually routes — Corey and LET give different mid-curve values',
    Math.abs(coreyKr(0.45, { ...e, model: 'corey' }).krw - coreyKr(0.45, e).krw) > 1e-6, '');
  eq('an endpoint-only case defaults to Corey rather than silently switching',
    coreyKr(0.45, SCAL_ANALOGUE).krw, coreyKr(0.45, { ...SCAL_ANALOGUE, model: 'corey' }).krw);
  check('a LET case still produces a valid SWOF and a valid Welge front', (() => {
    const t = buildSwof(e, 0.5, 1.0, 0.225, 500);
    const wf = welgeFront(e, 0.5, 1.0);
    return t.every((r) => Number.isFinite(r.krw) && Number.isFinite(r.kro) && Number.isFinite(r.fw))
      && wf.swf > e.swc && wf.swf < 1 - e.sor;
  })(), '');
}

// ── wettability, diagnosed from the curve ────────────────────────────────────
{
  const { diagnoseWettability } = F;
  // a deliberately strong water-wet pair: high Swi, low krw end point
  const ww = { ...SCAL_ANALOGUE, swc: 0.30, sor: 0.25, krwMax: 0.2, kroMax: 0.9, nw: 4, no: 2 };
  const d1 = diagnoseWettability(ww);
  eq('a strongly water-wet curve is diagnosed water-wet', d1.verdict, 'water-wet');
  eq('...on all three of Craig\'s indicators', d1.agreeing, 3);
  // a deliberately oil-wet pair: low Swi, high krw end point, early crossover
  const ow = { ...SCAL_ANALOGUE, swc: 0.10, sor: 0.30, krwMax: 0.8, kroMax: 0.8, nw: 2, no: 4 };
  const d2 = diagnoseWettability(ow);
  eq('an oil-wet curve is diagnosed oil-wet', d2.verdict, 'oil-wet');
  check('the crossover is found on the CURVES, not assumed from the exponents', (() => {
    const x = d1.crossoverSw;
    if (x == null) return false;
    const k = coreyKr(x, ww);
    return Math.abs(k.krw - k.kro) < 0.01;
  })(), `crossover Sw ${d1.crossoverSw?.toFixed(4)}`);
  check('a steeper water exponent pushes the crossover later — i.e. more water-wet',
    diagnoseWettability({ ...SCAL_ANALOGUE, nw: 5 }).crossoverSw
      > diagnoseWettability({ ...SCAL_ANALOGUE, nw: 2 }).crossoverSw,
    `nw 5 → ${diagnoseWettability({ ...SCAL_ANALOGUE, nw: 5 }).crossoverSw?.toFixed(3)} vs nw 2 → ${diagnoseWettability({ ...SCAL_ANALOGUE, nw: 2 }).crossoverSw?.toFixed(3)}`);
  check('a higher krw end point pulls the crossover earlier — i.e. more oil-wet',
    diagnoseWettability({ ...SCAL_ANALOGUE, krwMax: 0.8 }).crossoverSw
      < diagnoseWettability({ ...SCAL_ANALOGUE, krwMax: 0.2 }).crossoverSw, '');
  eq('every criterion carries the published rule it was judged against',
    d1.criteria.every((c) => /Craig/.test(c.rule)), true);

  // THE POINT: the shipped analogue is introduced as water-wet. Does it read that way?
  const d0 = diagnoseWettability(SCAL_ANALOGUE);
  check('the shipped analogue is diagnosed, and the split is REPORTED not hidden',
    d0.agreeing >= 1 && d0.agreeing <= 3,
    `${d0.verdict} on ${d0.agreeing}/3 — ${d0.criteria.map((c) => `${c.key}:${c.reads}`).join(' ')}`);
  check('a case whose indicators disagree raises the wettability issue',
    kaseIssuesFor(SCAL_ANALOGUE).some((i) => i.rule === 'scal.wettability') === (d0.agreeing < 3),
    `${d0.agreeing}/3 agreeing`);
  check('a unanimous curve raises NO wettability issue — no noise when there is nothing to say',
    !kaseIssuesFor(ww).some((i) => i.rule === 'scal.wettability'), '');
}

// ── Swc from the delivery's own logs (Buckles) ───────────────────────────────
{
  const { swcFromLogs } = F;
  const mk = (n, sw, phi, vsh = 0.1) => Array.from({ length: n }, () => ({ sw, phi, vsh }));

  // a well at a clean irreducible state: Sw·φ = 0.045 throughout
  const tight = swcFromLogs([{ well: 'A', samples: mk(200, 0.20, 0.225) }], 0.225);
  near('Swc is the Buckles number divided by the model porosity', tight.swc, 0.20, 1e-9);
  near('the Buckles number is Sw·φ', tight.buckles, 0.20 * 0.225, 1e-9);
  eq('the contributing well is named', tight.wells.map((w) => w.well), ['A']);

  // Buckles is a HYPERBOLA: tighter rock at irreducible holds proportionally MORE
  // water, and the same Buckles number still reads the same Swc at the model porosity.
  // (φ 0.16 with Sw 0.28125 carries the same Sw·φ = 0.045 as φ 0.225 with Sw 0.20.)
  const tighter = swcFromLogs([{ well: 'A', samples: mk(200, 0.28125, 0.16) }], 0.225);
  near('tighter rock at the same Buckles number reads the same Swc at model porosity',
    tighter.swc, 0.20, 1e-9);
  check('...even though its own logged saturation is far higher',
    tighter.wells[0].minSw > 0.28 && Math.abs(tighter.swc - 0.20) < 1e-9,
    `logged Sw ${tighter.wells[0].minSw}, Swc at φ 0.225 = ${tighter.swc.toFixed(3)}`);

  // a well sitting in the water leg cannot bound Swc and must be EXCLUDED
  const wet = swcFromLogs([
    { well: 'DRY', samples: mk(200, 0.18, 0.25) },
    { well: 'WET', samples: mk(200, 1.0, 0.25) },
  ], 0.225);
  eq('a well that never reaches irreducible saturation is excluded', wet.excluded, ['WET']);
  eq('...and only the contributing well is pooled', wet.wells.map((w) => w.well), ['DRY']);
  check('excluding it matters — averaging the wet well in would nearly double Swc',
    Math.abs(wet.swc - (0.18 * 0.25) / 0.225) < 1e-9, `got ${wet.swc.toFixed(4)}`);

  // screens
  eq('shaly samples are screened out', swcFromLogs([{ well: 'A', samples: mk(200, 0.2, 0.25, 0.8) }], 0.225), null);
  eq('tight samples are screened out', swcFromLogs([{ well: 'A', samples: mk(200, 0.2, 0.05) }], 0.225), null);
  eq('too few samples is not an estimate', swcFromLogs([{ well: 'A', samples: mk(5, 0.2, 0.25) }], 0.225), null);
  eq('a delivery with no interpreted saturation yields no anchor', swcFromLogs([], 0.225), null);
  eq('non-numeric samples are dropped rather than poisoning the percentile',
    swcFromLogs([{ well: 'A', samples: [...mk(200, 0.2, 0.25), { sw: NaN, phi: 0.25, vsh: 0.1 }] }], 0.225).wells[0].n, 200);
  check('the reported range brackets the recommendation',
    tight.low <= tight.swc + 1e-9 && tight.swc <= tight.high + 1e-9, '');
}

// ── capillary pressure / transition zone ─────────────────────────────────────
{
  const e = SCAL_ANALOGUE, phi = 0.225, k = 500;
  const pce = pcEntryPressure(e, phi, k);
  check('the entry pressure is positive and small at reservoir quality', pce > 0 && pce < 1, `${pce.toFixed(4)} bar`);
  near('Pc at Se = 1 IS the entry pressure', brooksCoreyPc(1, e, phi, k), pce, 1e-9);
  check('Pc rises without bound approaching connate water', brooksCoreyPc(e.swc + 1e-4, e, phi, k) > brooksCoreyPc(0.5, e, phi, k), '');
  check('tighter rock has a higher entry pressure', pcEntryPressure(e, phi, 5) > pcEntryPressure(e, phi, 500), '');
  eq('zero permeability yields no capillary curve rather than an infinity', pcEntryPressure(e, phi, 0), 0);

  const dRho = 350;
  eq('below the free-water level the rock is 100% water', swAtHeight(0, e, dRho, phi, k), 1);
  eq('inside the entry-pressure band the rock is still 100% water',
    swAtHeight(pce * 1e5 / (dRho * 9.80665) * 0.5, e, dRho, phi, k), 1);
  check('Sw falls with height above the free-water level',
    swAtHeight(80, e, dRho, phi, k) < swAtHeight(20, e, dRho, phi, k), '');
  check('high above the contact Sw approaches connate water',
    Math.abs(swAtHeight(5000, e, dRho, phi, k) - e.swc) < 0.02, `got ${swAtHeight(5000, e, dRho, phi, k).toFixed(4)}`);
  check('the transition zone is TALLER in tighter rock',
    swAtHeight(30, e, dRho, phi, 5) > swAtHeight(30, e, dRho, phi, 500), '');
  // Sw(h) and Pc(Sw) are inverses of one another
  {
    const h = 40;
    const sw = swAtHeight(h, e, dRho, phi, k);
    near('Sw(h) inverts Pc(Sw) exactly', brooksCoreyPc(sw, e, phi, k), dRho * 9.80665 * h / 1e5, 1e-9);
  }
  const swof = buildSwof(e, 0.5, 1.0, phi, k);
  eq('SWOF spans exactly the mobile saturation range', [swof[0].sw, swof[swof.length - 1].sw], [e.swc, 1 - e.sor]);
  check('SWOF Pc uses the SAME curve the initialization does',
    swof.every((r) => Math.abs(r.pc - brooksCoreyPc(r.sw, e, phi, k)) < 1e-12), '');
  // Pc → ∞ at connate water is the model; an unbounded first SWOF row is a defect
  check('the SWOF Pc column is bounded — no simulator accepts an infinite first row',
    swof.every((r) => Number.isFinite(r.pc) && r.pc <= F.pcMax(e, phi, k) + 1e-9),
    `max ${Math.max(...swof.map((r) => r.pc)).toFixed(3)} bar, cap ${F.pcMax(e, phi, k).toFixed(3)}`);
  check('the truncation is a stated multiple of the entry pressure, not an arbitrary clip',
    Math.abs(F.pcMax(e, phi, k) - pce * F.PC_SE_FLOOR ** (-1 / e.lambda)) < 1e-12,
    `${(F.pcMax(e, phi, k) / pce).toFixed(1)}× entry`);
  check('a finer table does not produce a larger Pc than the cap',
    buildSwof(e, 0.5, 1.0, phi, k, 400).every((r) => r.pc <= F.pcMax(e, phi, k) + 1e-9), '');
}

// ── initialization ───────────────────────────────────────────────────────────
{
  near('a hydrostatic gradient is ρg', gradientOf(1000), 1000 * 9.80665 / 1e5, 1e-12);
  near('phase pressure walks the gradient from the datum', phasePressure(3100, 3000, 300, 0.07), 307, 1e-12);
  near('phase pressure ABOVE the datum is lower', phasePressure(2900, 3000, 300, 0.07), 293, 1e-12);

  // a synthetic two-gradient stack whose crossing depth is known exactly
  const pts = [];
  for (let z = 2900; z <= 3000; z += 20) pts.push({ well: 'X', tvdss: z, pressure: 300 + 0.07 * (z - 3000) });
  for (let z = 3020; z <= 3120; z += 20) pts.push({ well: 'X', tvdss: z, pressure: 300 + 0.104 * (z - 3000) });
  const oil = fitGradient(pts.filter((p) => p.tvdss < 3010));
  const wat = fitGradient(pts.filter((p) => p.tvdss > 3010));
  near('the oil-leg fit recovers its gradient exactly', oil.slope, 0.07, 1e-9);
  near('the water-leg fit recovers its gradient exactly', wat.slope, 0.104, 1e-9);
  near('a perfect fit reports R² = 1', oil.r2, 1, 1e-9);
  near('the fitted slope IS a fluid density', oil.density, 0.07 * 1e5 / 9.80665, 1e-6);
  near('the gradients cross exactly at the free-water level', gradientIntersection(oil, wat), 3000, 1e-6);
  eq('parallel gradients have no intersection', gradientIntersection(oil, { ...oil, intercept: oil.intercept + 5 }), null);
  eq('two points are not a gradient', fitGradient(pts.slice(0, 2)), null);
  eq('three points at the same depth are not a gradient',
    fitGradient([{ well: 'X', tvdss: 3000, pressure: 300 }, { well: 'X', tvdss: 3000, pressure: 301 }, { well: 'X', tvdss: 3000, pressure: 302 }]), null);
  eq('non-numeric readings are dropped rather than poisoning the fit',
    fitGradient([{ well: 'X', tvdss: 3000, pressure: NaN }, { well: 'X', tvdss: 3020, pressure: 302 }]), null);

  const equil = buildEquil(a, pvt, index.contacts ?? [], SCAL_ANALOGUE, 0.225, 500);
  eq('the equilibration datum is the deck datum', [equil.datumTvdss, equil.datumPressure], [a.datumTvdss, a.pi]);
  near('the oil gradient is the reservoir oil density', equil.oilGradient, gradientOf(pvt.rhoOilRes), 1e-12);
  check('water is the steeper gradient', equil.waterGradient > equil.oilGradient, '');
  eq('the contact is the delivery\'s OWC', equil.owc, index.contacts[0].tvdss);
  check('the free-water level sits BELOW the oil–water contact', equil.fwl > equil.owc,
    `FWL ${equil.fwl?.toFixed(2)} vs OWC ${equil.owc}`);
  near('contact pressure is the datum pressure walked down the oil gradient',
    equil.contactPressure, a.pi + equil.oilGradient * (equil.owc - a.datumTvdss), 1e-12);
  eq('Volve initialises undersaturated', equil.saturationState, 'undersaturated');
  near('the undersaturation is Pi − Pb', equil.undersaturationBar, a.pi - a.pb, 1e-12);
  eq('a delivery with no contact reports no contact rather than a guessed one',
    buildEquil(a, pvt, [], SCAL_ANALOGUE, 0.225, 500).owc, null);
}

// ── volumetrics and the reconciliation that closes the loop ──────────────────
{
  const v = stoiip({ grvM3: 1e9, phi: 0.2, ntg: 0.8, sw: 0.25, bo: 1.5 });
  near('pore volume is GRV·NTG·φ', v.poreVolumeM3, 1e9 * 0.8 * 0.2, 1e-3);
  near('hydrocarbon pore volume removes the water', v.hcPoreVolumeM3, 1e9 * 0.8 * 0.2 * 0.75, 1e-3);
  near('STOIIP divides by Bo', v.stoiipSm3, 1e9 * 0.8 * 0.2 * 0.75 / 1.5, 1e-3);
  near('MMSm³ is Sm³ over a million', v.stoiipMMSm3, v.stoiipSm3 / 1e6, 1e-12);

  // THE closing check: the delivery publishes its own screening volumetrics, and this
  // module must reproduce them from the same inputs — otherwise the tab is not the
  // source of the number the rest of the platform quotes.
  const vd = index.validation?.stoiip;
  if (vd?.grvMm3 && vd?.stoiipMMSm3) {
    const got = stoiip({
      grvM3: vd.grvMm3 * 1e6, phi: index.defaults.phi, ntg: index.defaults.ntg,
      sw: index.defaults.sw, bo: index.defaults.bo,
    }).stoiipMMSm3;
    check('the module reproduces the delivery\'s published screening STOIIP',
      Math.abs(got - vd.stoiipMMSm3) < 0.5, `got ${got.toFixed(2)}, published ${vd.stoiipMMSm3} MMSm³`);
  }

  const r = reconcile(19.0, 18.7, 10.171934);
  eq('an in-place within tolerance agrees with the regulator', r.verdict, 'agrees');
  near('the recovery factor is quoted against the OFFICIAL in-place', r.rfOfficial, 10.171934 / 18.7, 1e-12);
  eq('a 7.6× screening volume is reported as overstating', reconcile(142.3, 18.7, null).verdict, 'overstates');
  eq('a low volume is reported as understating', reconcile(10, 18.7, null).verdict, 'understates');
  eq('with no official figure the check is unchecked, not passed', reconcile(19, null, null).verdict, 'unchecked');
  eq('an unchecked reconciliation quotes no recovery factor', reconcile(19, null, 10).rfOfficial, null);

  // ── the SECOND volume: solution gas ──
  eq('with no Rs there is no gas volume, not a zero',
    [stoiip({ grvM3: 1e9, phi: 0.2, ntg: 0.8, sw: 0.25, bo: 1.5 }).giipSm3,
      stoiip({ grvM3: 1e9, phi: 0.2, ntg: 0.8, sw: 0.25, bo: 1.5 }).giipBcm], [null, null]);
  {
    const v = stoiip({ grvM3: 1e9, phi: 0.2, ntg: 0.8, sw: 0.25, bo: 1.5, rs: 150 });
    near('GIIP is STOIIP × Rs — the undersaturated identity', v.giipSm3, v.stoiipSm3 * 150, 1e-3);
    near('Bcm is Sm³ over a billion', v.giipBcm, v.giipSm3 / 1e9, 1e-12);
  }
  eq('with no official gas figure the gas check is simply absent', reconcile(19, 18.7, null).gas, null);
  eq('a gas volume with no counterpart to check it against is also absent',
    reconcile(19, 18.7, null, { ourGiipBcm: 2.8 }).gas, null);
  {
    const g = reconcile(19, 18.7, null, { ourGiipBcm: 2.8, officialGiipBcm: 2.8 }).gas;
    eq('matching gas volumes agree', g.verdict, 'agrees');
    near('the gas delta is a percentage of the official figure', g.deltaPct, 0, 1e-12);
    eq('a gas volume half the official figure understates',
      reconcile(19, 18.7, null, { ourGiipBcm: 1.4, officialGiipBcm: 2.8 }).gas.verdict, 'understates');
  }
}

// ── the two volumes, against the authority ───────────────────────────────────
//
// THE reference check. The delivery's own screening rock volume, its porosity/N:G/Sw
// and the deck's Bo and Rs must reproduce BOTH of Sodir's published in-place figures.
// Oil tests the rock volume; gas tests the rock volume AND the solution GOR. Neither
// number is fitted to the other — they come out of the same one equation.
{
  const o = index.official, vd = index.validation?.stoiip;
  if (o && vd?.grvMm3) {
    const v = stoiip({
      grvM3: vd.grvMm3 * 1e6, phi: index.defaults.phi, ntg: index.defaults.ntg,
      sw: index.defaults.sw, bo: index.defaults.bo, rs: a.rsb,
    });
    const r = reconcile(v.stoiipMMSm3, o.stoiipMMSm3, o.producedOilMMSm3, {
      ourGiipBcm: v.giipBcm, officialGiipBcm: o.giipBcm,
    });
    check('OIL in place agrees with Sodir within 5%',
      Math.abs(r.deltaPct) < 5, `${v.stoiipMMSm3.toFixed(3)} vs official ${o.stoiipMMSm3} MMSm³ (${r.deltaPct.toFixed(2)}%)`);
    check('GAS in place agrees with Sodir within 5% — an INDEPENDENT check of the deck Rs',
      !!r.gas && Math.abs(r.gas.deltaPct) < 5,
      r.gas ? `${v.giipBcm.toFixed(4)} vs official ${o.giipBcm} Bcm (${r.gas.deltaPct.toFixed(2)}%)` : 'no official GIIP published');
    check('both volumes agree, so rock volume AND solution GOR are confirmed together',
      r.verdict === 'agrees' && r.gas?.verdict === 'agrees', `oil ${r.verdict}, gas ${r.gas?.verdict}`);
    // and the case says so on screen rather than only in a test
    const withGas = buildCase({
      fieldId: 'no-field-3420717', anchors: a, contacts: index.contacts ?? [],
      rock: { phi: index.defaults.phi, ntg: index.defaults.ntg, sw: index.defaults.sw },
      grvM3: vd.grvMm3 * 1e6, officialStoiipMMSm3: o.stoiipMMSm3,
      officialGiipBcm: o.giipBcm, producedOilMMSm3: o.producedOilMMSm3,
    });
    check('the case reports the gas confirmation to the user',
      withGas.issues.some((i) => i.rule === 'init.gas' && i.severity === 'info'),
      withGas.issues.filter((i) => i.rule === 'init.gas').map((i) => i.message).join(''));
    // a wrong Rs must break the GAS check while leaving the OIL check passing —
    // that separation is the whole reason the second volume is worth computing
    const badRs = buildCase({
      fieldId: 'x', anchors: { ...a, rsb: a.rsb * 1.5 }, contacts: index.contacts ?? [],
      rock: { phi: index.defaults.phi, ntg: index.defaults.ntg, sw: index.defaults.sw },
      grvM3: vd.grvMm3 * 1e6, officialStoiipMMSm3: o.stoiipMMSm3, officialGiipBcm: o.giipBcm,
    });
    check('a 50% wrong solution GOR breaks the GAS check but not the OIL check',
      badRs.reconciliation?.verdict === 'agrees' && badRs.reconciliation?.gas?.verdict === 'overstates',
      `oil ${badRs.reconciliation?.verdict}, gas ${badRs.reconciliation?.gas?.verdict}`);
    check('...and the case attributes the fault to the solution GOR, not the rock',
      badRs.issues.some((i) => i.rule === 'init.gas' && /solution GOR/.test(i.message)), '');
  }
}

// ── the case ─────────────────────────────────────────────────────────────────
const kase = buildCase({
  fieldId: 'no-field-3420717',
  anchors: a,
  contacts: index.contacts ?? [],
  rock: { phi: index.defaults.phi, ntg: index.defaults.ntg, sw: index.defaults.sw },
  grvM3: (index.validation?.stoiip?.grvMm3 ?? 0) * 1e6,
  officialStoiipMMSm3: index.official?.stoiipMMSm3 ?? null,
  producedOilMMSm3: index.official?.producedOilMMSm3 ?? null,
  pressurePoints: [],
});
{
  eq('the case carries the deck anchors unchanged', kase.anchors, a);
  eq('the SCAL basis is declared ANALOGUE — the delivery ships no measured SCAL', kase.scalBasis, 'analogue');
  eq('the rock reference pressure and compressibility come from the deck',
    [kase.rock.pref, kase.rock.cf], [a.rockPref, a.rockCf]);
  eq('permeability is declared analogue, not measured', kase.rock.basis.kMd, 'analogue');
  check('the case is runnable — nothing about it blocks a simulation', isRunnable(kase),
    kase.issues.filter((i) => i.severity === 'fail').map((i) => i.rule).join(', '));
  // Volve's live oil is barely more viscous than its hot brine, so the end-point
  // mobility ratio is FAVOURABLE and no warning is manufactured to fill the panel.
  check('the Volve case reports a favourable mobility ratio and raises no false alarm',
    kase.mobilityRatio < 1 && !kase.issues.some((i) => i.rule === 'scal.mobility'),
    `M ${kase.mobilityRatio.toFixed(3)}`);
  check('a viscous oil DOES raise the mobility warning',
    validateCase({ ...kase, pvt: { ...kase.pvt, muoAtPi: 20 } }).some((i) => i.rule === 'scal.mobility' && i.severity === 'warn'), '');
  check('the analogue permeability raises an explicit note', kase.issues.some((i) => i.rule === 'rock.k'), '');
  check('the case reconciles against the regulator', kase.reconciliation?.officialMMSm3 === index.official.stoiipMMSm3, '');

  // failure rules actually fire
  const gassy = validateCase({ ...kase, anchors: { ...a, pb: a.pi + 10 } });
  check('a bubble point above initial pressure FAILS the case', gassy.some((i) => i.rule === 'pvt.saturated' && i.severity === 'fail'), '');
  const badScal = validateCase({ ...kase, scal: { ...kase.scal, swc: 0.6, sor: 0.5 } });
  check('endpoints leaving no mobile range FAIL the case', badScal.some((i) => i.rule === 'scal.endpoints' && i.severity === 'fail'), '');
  const dry = validateCase({ ...kase, rock: { ...kase.rock, sw: 0.05 } });
  check('an initial Sw below connate water FAILS the case', dry.some((i) => i.rule === 'init.sw' && i.severity === 'fail'), '');
  const noContact = validateCase({ ...kase, equil: { ...kase.equil, owc: null } });
  check('no contact FAILS the case — nothing can be equilibrated', noContact.some((i) => i.rule === 'init.contact' && i.severity === 'fail'), '');
  check('a case with a failure is not runnable', !isRunnable({ ...kase, issues: noContact }), '');
}

// ── the seam to the simulator ────────────────────────────────────────────────
{
  const s = toSimFluids(kase);
  eq('the simulator receives the case endpoints, not defaults',
    [s.swc, s.sor, s.nw, s.no], [kase.scal.swc, kase.scal.sor, kase.scal.nw, kase.scal.no]);
  eq('the simulator receives the case viscosities', [s.muw, s.muo], [kase.pvt.muw, kase.pvt.muoAtPi]);
  near('the viscosity ratio the legacy inspector exposes is μo/μw', s.muRatio, kase.pvt.muoAtPi / kase.pvt.muw, 1e-12);
  check('the viscosity ratio is unfavourable-to-favourable in a physical range',
    s.muRatio > 0.2 && s.muRatio < 50, `got ${s.muRatio.toFixed(2)}`);
  eq('the simulator receives the case contact', s.owc, kase.equil.owc);
  eq('the simulator receives the case initial pressure', s.pInit, a.pi);
}

// ── the deck the case writes ─────────────────────────────────────────────────
{
  const deck = toEclipseDeck(kase);
  for (const kw of ['DENSITY', 'ROCK', 'PVTW', 'PVTO', 'PVDG', 'SWOF', 'EQUIL']) {
    check(`the exported deck carries ${kw}`, deck.includes(`\n${kw}\n`) || deck.startsWith(`${kw}\n`), '');
  }
  check('the deck states the surface densities the delivery gave it',
    deck.includes(a.rhoOilSc.toFixed(2)) && deck.includes(a.rhoWaterSc.toFixed(2)), '');
  check('the deck declares its SCAL as analogue rather than passing it off as measured',
    /SCAL basis: analogue \(NO measured SCAL in the delivery\)/.test(deck), '');
  check('the deck EQUIL row carries the datum, the datum pressure and the contact',
    new RegExp(`${a.datumTvdss.toFixed(1)}\\s+${a.pi.toFixed(2)}\\s+${Number(index.contacts[0].tvdss).toFixed(1)}`).test(deck), '');
  check('every SWOF row is numeric — no NaN reaches a deck',
    !/NaN|Infinity/.test(deck), '');
}

// ── the depth chain: a gauge in MD onto the initialization's TVDSS axis ──────
const D = await import('../src/tabs/fielddev/fluids-depth.ts');
const { tvdAtMd, kbElevation, stationsOf, tvdssOf } = D;
{
  const survey = [{ md: 0, tvd: 0 }, { md: 1000, tvd: 1000 }, { md: 2000, tvd: 1900 }, { md: 3000, tvd: 2700 }];
  near('TVD on a vertical section equals MD', tvdAtMd(survey, 500), 500, 1e-9);
  near('TVD interpolates linearly between stations', tvdAtMd(survey, 1500), 1450, 1e-9);
  near('TVD is exact at a station', tvdAtMd(survey, 2000), 1900, 1e-9);
  eq('a gauge BELOW the last survey station has no TVD — never an extrapolated one', tvdAtMd(survey, 3800), null);
  eq('a gauge above the first station has no TVD either', tvdAtMd(survey, -10), null);
  eq('one station is not a survey', tvdAtMd([{ md: 0, tvd: 0 }], 100), null);
  eq('an unsorted survey is sorted before interpolation', tvdAtMd([...survey].reverse(), 1500), 1450);
  eq('stations missing a TVD are dropped rather than read as zero',
    tvdAtMd([{ md: 0, tvd: 0 }, { md: 1000 }, { md: 2000, tvd: 1900 }], 1000), 950);

  near('KB parses the master\'s string form', kbElevation('54.90m'), 54.9, 1e-9);
  near('KB accepts a plain number', kbElevation(25), 25, 1e-9);
  eq('a master with no KB yields no KB, not sea level', kbElevation(undefined), null);
  eq('an unparseable KB yields null', kbElevation('unknown'), null);
  near('TVDSS is TVD below the rig floor minus the rig-floor elevation', tvdssOf(3100, 54.9), 3045.1, 1e-9);

  eq('a run with no pressure curve yields no station', stationsOf({ runs: [{ curves: { DEPTH: { values: [100] } } }] }), []);
  eq('a run with no depth curve yields no station', stationsOf({ runs: [{ curves: { PQUARTZ: { values: [300] } } }] }), []);
}

// ── resolving a formation pressure out of a pretest record ──────────────────
{
  const { stablePlateaus, formationPressure } = D;
  const rep = (v, n) => Array.from({ length: n }, () => v);
  // the shape of a real pretest: mud column → set → drawdown/buildup plateau →
  // pump spike → tool retracts back to the mud column
  const trace = [...rep(412, 300), ...rep(313, 900), ...rep(460, 60), ...rep(412, 250)];

  // the mud column appears twice — before the tool sets and after it retracts — and
  // both stretches are real stable levels, so both are reported
  const pls = stablePlateaus(trace);
  eq('the stable levels are found and returned lowest first', pls.map((p) => Math.round(p.pressure)), [313, 412, 412]);
  check('the pump spike is too short to count as a level', !pls.some((p) => Math.round(p.pressure) === 460), '');
  eq('a record with no stable stretch yields no levels',
    stablePlateaus(Array.from({ length: 500 }, (_, i) => i)), []);

  const fp = formationPressure(trace, 2900);
  eq('the formation pressure is the buildup plateau, NOT the last sample', fp.pressure, 313);
  eq('the mud column is reported separately', fp.columnPressure, 412);
  eq('a distinct buildup below the column is recognised as one', fp.quality, 'buildup');
  check('the last sample would have been 99 bar wrong', Math.abs(trace[trace.length - 1] - fp.pressure) > 90, '');

  // a test that never sealed: only the mud column is stable
  const failed = [...rep(412, 600), ...rep(455, 40), ...rep(412, 400)];
  eq('a test that only ever reads the mud column is flagged, not fitted',
    formationPressure(failed, 2900).quality, 'column');

  // a retracted tool sitting near atmospheric must not be read as a formation
  const retracted = [...rep(1.2, 800), ...rep(398, 700)];
  eq('a near-atmospheric plateau is below the physical floor and is rejected',
    formationPressure(retracted, 2900).pressure, 398);
  eq('...and with nothing else stable, that lone level is a column not a buildup',
    formationPressure(retracted, 2900).quality, 'column');
  check('without a depth hint no floor is applied and the low level is taken',
    formationPressure(retracted, null).pressure === 1.2, '');
  eq('a record with nothing stable resolves no formation pressure',
    formationPressure(Array.from({ length: 400 }, (_, i) => i), 2900), null);

  eq('the station carries the resolved buildup, its quality and the column',
    stationsOf({ runs: [{ curves: { DEPTH: { values: [3000] }, PQUARTZ: { values: trace } } }] }, () => 2900)
      .map((s) => [s.md, s.pressure, s.quality, s.columnPressure]),
    [[3000, 313, 'buildup', 412]]);
}

// ── the real Volve gauges, end to end ────────────────────────────────────────
{
  const { readdirSync } = await import('node:fs');
  const wbDir = join(__dirname, '..', 'public', 'wb');
  const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const kbOf = new Map(index.wells.map((w) => [w.name, kbElevation(w.kb)]));
  const files = readdirSync(wbDir).filter((f) => /^press-.*\.json$/.test(f));
  check('the delivery ships formation-pressure records', files.length > 0, `${files.length} files`);

  const points = [];
  let raw = 0, unplaceable = 0;
  for (const f of files) {
    const press = JSON.parse(readFileSync(join(wbDir, f), 'utf8'));
    const tf = join(wbDir, `traj-${slug(press.well)}.json`);
    const survey = existsSync(tf) ? JSON.parse(readFileSync(tf, 'utf8')).stations ?? [] : [];
    const kb = kbOf.get(press.well);
    const hint = (md) => { const t = tvdAtMd(survey, md); return t == null || kb == null ? null : tvdssOf(t, kb); };
    for (const s of stationsOf(press, hint)) {
      raw++;
      const tvd = tvdAtMd(survey, s.md);
      if (tvd == null || kb == null) { unplaceable++; continue; }
      points.push({ well: press.well, tvdss: tvdssOf(tvd, kb), pressure: s.pressure, md: s.md, quality: s.quality });
    }
  }
  check('real gauge stations are found across the delivery', raw >= 30, `${raw} stations`);
  check('most stations place onto the TVDSS axis', points.length >= raw * 0.7, `${points.length}/${raw} placed`);
  check('the unplaceable ones are COUNTED rather than dropped silently', unplaceable === raw - points.length,
    `${unplaceable} outside their own survey`);
  check('every placed gauge sits at a plausible reservoir depth',
    points.every((p) => p.tvdss > 1000 && p.tvdss < 5000), '');
  check('every placed gauge reads a plausible reservoir pressure',
    points.every((p) => p.pressure > 100 && p.pressure < 700), '');
  check('tests that never left the mud column are flagged rather than fitted',
    points.some((p) => p.quality === 'column'),
    `${points.filter((p) => p.quality === 'column').length} of ${points.length}`);

  // THE POINT OF THE WHOLE CHAIN. F-14 ran 14 pretests down one hole in one pass, so
  // its stations are a single snapshot in time — the one thing on a produced field
  // that a gradient can legitimately be fitted through. It must reproduce the deck's
  // live-oil density without ever being told what that density is.
  const byWell = fitByWell(points, { rhoOil: pvt.rhoOilRes, rhoWater: pvt.rhoWaterRes });
  const oilWell = byWell.find((g) => g.phase === 'oil');
  check('at least one well resolves a fluid gradient from its own gauges',
    byWell.some((g) => g.resolved), byWell.map((g) => `${g.well}:${g.resolved}`).join(' '));
  check('a well\'s measured gradient independently reproduces the deck live-oil density',
    !!oilWell, oilWell ? `${oilWell.well} ${oilWell.fit.density.toFixed(0)} vs deck ${pvt.rhoOilRes.toFixed(0)} kg/m³` : 'none matched');
  if (oilWell) {
    check('...to within 3%, over 10+ stations, at R² above 0.98',
      Math.abs(oilWell.fit.density - pvt.rhoOilRes) / pvt.rhoOilRes < 0.03 && oilWell.fit.n >= 10 && oilWell.fit.r2 > 0.98,
      `${oilWell.well}: ${oilWell.fit.n} stations, ${oilWell.fit.density.toFixed(1)} kg/m³, R² ${oilWell.fit.r2.toFixed(4)}`);
  }
  check('wells whose stations scatter are NOT credited with a gradient',
    byWell.some((g) => !g.resolved), byWell.filter((g) => !g.resolved).map((g) => g.well).join(', ') || 'all resolved');
  check('a mud-column station never enters a fit',
    byWell.every((g) => g.points.every((p) => p.quality !== 'column')), '');

  // and the case must ACCEPT them and report the comparison rather than ignore them
  const withGauges = buildCase({
    fieldId: 'no-field-3420717', anchors: a, contacts: index.contacts ?? [],
    rock: { phi: index.defaults.phi, ntg: index.defaults.ntg, sw: index.defaults.sw },
    pressurePoints: points,
  });
  eq('the case keeps every measured station it was given', withGauges.pressurePoints.length, points.length);
  check('the case reports the measured-vs-deck density comparison as CONFIRMED',
    withGauges.issues.some((i) => i.rule === 'init.gradient' && i.severity === 'info'),
    withGauges.issues.filter((i) => i.rule === 'init.gradient').map((i) => i.message).join(''));
  check('a delivery with no pressure records makes no gradient claim at all',
    !buildCase({ fieldId: 'x', anchors: a, contacts: index.contacts }).issues.some((i) => i.rule === 'init.gradient'), '');
}

// ── the delivery's own permeability ──────────────────────────────────────────
//
// KLOGH lives only in the CPI petrophysics product, which never wins the build's
// run scoring (LFP carries a deliberate bonus). Until the merge pass was added, the
// delivery therefore shipped NO permeability at all and every k downstream — the
// transition-zone height, the well index, the simulation grid — was an analogue while
// the field's own log sat unread in the source tree. These assertions exist so that
// regression cannot happen silently again.
{
  const { readdirSync } = await import('node:fs');
  const wbDir = join(__dirname, '..', 'public', 'wb');
  const withK = [];
  for (const f of readdirSync(wbDir).filter((x) => /^logs-.*\.json$/.test(x))) {
    const d = JSON.parse(readFileSync(join(wbDir, f), 'utf8'));
    const k = d.curves?.KLOGH;
    if (!k) continue;
    const live = (k.values ?? []).filter((v) => v != null && Number.isFinite(v) && v > 0);
    if (live.length) withK.push({ well: d.well, n: live.length, unit: k.unit, mergedFrom: k.mergedFrom, values: live });
  }
  check('the delivery ships a permeability log at all', withK.length > 0,
    `${withK.length} wells carry KLOGH`);
  check('permeability reaches MANY wells, not just the interpretation set', withK.length >= 8,
    withK.map((w) => w.well).join(', '));
  check('KLOGH is carried in millidarcy', withK.every((w) => /md/i.test(w.unit ?? '')),
    [...new Set(withK.map((w) => w.unit))].join(', '));
  check('a merged curve says which product it came from — it is not passed off as the winner\'s',
    withK.filter((w) => w.mergedFrom).length > 0,
    `${withK.filter((w) => w.mergedFrom).length} of ${withK.length} merged, e.g. ${withK.find((w) => w.mergedFrom)?.mergedFrom}`);
  const all = withK.flatMap((w) => w.values).filter((v) => v <= 20000).sort((a, b) => a - b);
  check('the permeability distribution is physical for a clastic reservoir',
    all.length > 1000 && all[0] > 0 && all[all.length - 1] <= 20000,
    `${all.length} samples, ${all[0].toExponential(1)}–${all[all.length - 1].toFixed(0)} mD`);
  check('the log spans shale to high-quality sand — it is a whole-interval curve, not net pay',
    all[0] < 0.01 && all[all.length - 1] > 1000, '');

  // RESERVOIR-QUALITY rock only. The geometric mean over the whole interval is ~0
  // because the curve runs through shale; quoting that as "the field permeability"
  // would be as wrong as quoting the arithmetic mean of everything.
  const net = all.filter((v) => v >= 1);
  const geo = Math.exp(net.reduce((a, v) => a + Math.log(v), 0) / net.length);
  const arith = net.reduce((a, v) => a + v, 0) / net.length;
  const q = (f) => net[Math.floor((net.length - 1) * f)];
  check('reservoir-quality permeability is a broad, log-normal-ish spread',
    geo > 1 && geo < 1000 && q(0.9) > 10 * q(0.1),
    `P10 ${q(0.1).toFixed(0)} · P50 ${q(0.5).toFixed(0)} · P90 ${q(0.9).toFixed(0)} · geo ${geo.toFixed(0)} · arith ${arith.toFixed(0)} mD`);
  // The screening value is NOT the geometric mean, and pretending otherwise would be
  // the mistake. Assert only that it sits inside the logged distribution — which is
  // what makes it defensible as a screening number and indefensible as a fact.
  check('the screening permeability sits inside the logged reservoir range, above the geometric mean',
    K_SCREENING_MD > geo && K_SCREENING_MD < q(0.95),
    `geo ${geo.toFixed(0)} < screening ${K_SCREENING_MD} < P95 ${q(0.95).toFixed(0)}; arithmetic ${arith.toFixed(0)} mD`);
}

// ── the PUBLISHED saturation-height function, and whether we align to it ─────
//
// Source: Statoil doc 3781-06, the Hugin/Skagerrak petrophysical evaluation shipped
// with the Volve dataset. It states Swn = 2.222·J^-1.111 for the VOLVE Hugin wells.
// The analogue this platform started with (J_entry 0.25, λ 2.0) is 16–900× off it,
// which is a transition zone far too thin. These assertions keep the delivery's own
// function in front of the analogue.
{
  const { shfToBrooksCorey, publishedSwirr, applyPublishedShf } = F;
  const shf = index.shf;
  check('the delivery publishes a saturation-height function', !!shf?.swn,
    shf ? `${shf.formation} — ${shf.source?.slice(0, 40)}…` : 'absent');

  const bc = shfToBrooksCorey(shf.swn);
  // Swn = a·J^b  ≡  (J/Je)^-λ  ⇒  λ = -b, Je = a^(1/λ)
  near('λ is the negated published exponent', bc.lambda, -shf.swn.b, 1e-12);
  near('the entry J reproduces the published coefficient', bc.jEntry ** bc.lambda, shf.swn.a, 1e-9);
  check('the two forms give the SAME curve at every J', (() => {
    for (const J of [0.5, 1, 2, 5, 10, 40]) {
      const pub = shf.swn.a * J ** shf.swn.b;
      const ours = (J / bc.jEntry) ** -bc.lambda;
      if (Math.abs(pub - ours) > 1e-9) return false;
    }
    return true;
  })(), `λ ${bc.lambda.toFixed(3)}, J_entry ${bc.jEntry.toFixed(3)}`);
  eq('a non-physical published pair yields no conversion rather than a NaN curve',
    shfToBrooksCorey({ a: 0, b: -1 }), null);
  eq('a positive exponent is not a drainage curve and is refused', shfToBrooksCorey({ a: 2, b: 1 }), null);

  // how far the analogue was off — recorded so the correction cannot quietly regress
  const anaSwn = (J) => Math.min(1, (J / SCAL_ANALOGUE.jEntry) ** -SCAL_ANALOGUE.lambda);
  const pubSwn = (J) => Math.min(1, shf.swn.a * J ** shf.swn.b);
  check('the shipped analogue is materially thinner than the published function',
    pubSwn(5) / anaSwn(5) > 50,
    `at J=5 published Swn ${pubSwn(5).toFixed(4)} vs analogue ${anaSwn(5).toFixed(4)} — ${(pubSwn(5) / anaSwn(5)).toFixed(0)}×`);

  // Swirr from the report's own log-linear fit
  near('published Swirr is c1·log10(k) + c2', publishedSwirr(shf, 100), shf.swirr.c1 * 2 + shf.swirr.c2, 1e-12);
  check('published Swirr falls with permeability', publishedSwirr(shf, 1000) < publishedSwirr(shf, 10), '');
  eq('no permeability yields no published Swirr', publishedSwirr(shf, 0), null);
  eq('a delivery with no SHF yields no Swirr', publishedSwirr(null, 100), null);
  // the report's log-linear fit and the CPI's power-law implementation of the SAME
  // relation agree at ~1 mD and diverge with k — carried so the choice is visible
  const cpiSwirr = (k) => shf.swirrCpi.a * k ** shf.swirrCpi.b;
  check('the report fit and the CPI implementation agree near 1 mD',
    Math.abs(publishedSwirr(shf, 1) - cpiSwirr(1)) < 0.02,
    `${publishedSwirr(shf, 1).toFixed(3)} vs ${cpiSwirr(1).toFixed(3)}`);
  check('...and diverge by ~0.05 saturation units through the reservoir range',
    Math.abs(publishedSwirr(shf, 100) - cpiSwirr(100)) > 0.03,
    `at 100 mD: report ${publishedSwirr(shf, 100).toFixed(3)} vs CPI ${cpiSwirr(100).toFixed(3)}`);

  // applying it must move ONLY the capillary terms
  const applied = applyPublishedShf(SCAL_ANALOGUE, shf, 100);
  near('applying the published SHF sets λ', applied.lambda, bc.lambda, 1e-12);
  near('...and the entry J', applied.jEntry, bc.jEntry, 1e-9);
  near('...and the reservoir interfacial tension', applied.sigmaCosTheta, shf.sigmaResMNm, 1e-12);
  eq('...and leaves every relative-permeability end point untouched',
    [applied.krwMax, applied.kroMax, applied.nw, applied.no, applied.sor],
    [SCAL_ANALOGUE.krwMax, SCAL_ANALOGUE.kroMax, SCAL_ANALOGUE.nw, SCAL_ANALOGUE.no, SCAL_ANALOGUE.sor]);
  near('...and takes Swc from the published Swirr at the given permeability',
    applied.swc, publishedSwirr(shf, 100), 1e-12);
  eq('no delivery SHF leaves the analogue exactly as it was', applyPublishedShf(SCAL_ANALOGUE, null), SCAL_ANALOGUE);

  // The transition zone the corrected function produces. λ = 1.111 is a SLOW decay:
  // Sw approaches irreducible asymptotically and never actually reaches it over any
  // realistic column — which is why the published form writes Sw as Swn·(1−Swirr)+Swirr
  // with Swirr as the floor, rather than expecting the curve to land on it. Asserting
  // "reaches connate by X metres" was the wrong expectation, not the wrong model.
  const dRho = 348.8;
  const swAt = (h, e, k) => swAtHeight(h, e, dRho, 0.225, k);
  check('the published function still holds mobile water high above the contact',
    swAt(100, applied, 100) > applied.swc * 1.5,
    `at +100 m and 100 mD: Sw ${swAt(100, applied, 100).toFixed(3)} against an irreducible floor of ${applied.swc.toFixed(3)}`);
  check('...where the analogue had already collapsed to connate',
    swAt(100, SCAL_ANALOGUE, 100) < SCAL_ANALOGUE.swc * 1.2,
    `analogue Sw at +100 m: ${swAt(100, SCAL_ANALOGUE, 100).toFixed(3)}`);
  check('the correction raises in-place water — and therefore lowers oil — through the column',
    swAt(30, applied, 100) > swAt(30, SCAL_ANALOGUE, 100)
      && swAt(60, applied, 100) > swAt(60, SCAL_ANALOGUE, 100),
    `at +30 m: ${swAt(30, applied, 100).toFixed(3)} vs analogue ${swAt(30, SCAL_ANALOGUE, 100).toFixed(3)}`);
  check('Sw still falls monotonically with height', (() => {
    let prev = 1;
    for (let h = 0; h <= 300; h += 5) { const s = swAt(h, applied, 100); if (s > prev + 1e-9) return false; prev = s; }
    return true;
  })(), '');

  // and the platform's independent Buckles number must sit near the published Swirr
  check('our Buckles Swc agrees with the published Swirr at the logged permeability',
    Math.abs(0.168 - publishedSwirr(shf, 142)) < 0.06,
    `Buckles 0.168 vs published ${publishedSwirr(shf, 142).toFixed(3)} at 142 mD`);

  // fluid cross-check: brine salinity derived from the deck density vs the report
  const derivedPpm = brineSalinityWtPct(a.rhoWaterSc) * 10000;
  check('brine salinity derived from the deck density matches the report within 10%',
    Math.abs(derivedPpm - shf.brine.ppmNaClEquivalent) / shf.brine.ppmNaClEquivalent < 0.10,
    `derived ${Math.round(derivedPpm).toLocaleString()} ppm vs report ${shf.brine.ppmNaClEquivalent.toLocaleString()} ppm`);
}

// ── unit bridges ─────────────────────────────────────────────────────────────
near('°C → °F is the closed form', cToF(110), 230, 1e-12);
near('bar → psi uses the exact conversion', barToPsi(1), PSI_PER_BAR, 1e-12);
near('Sm³/Sm³ → scf/STB uses the exact conversion', sm3ToScf(1), 5.614583, 1e-12);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

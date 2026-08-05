// Surveillance Dossier truth-lock — the derivation layer behind the Reservoir
// Management Knowledge Bank. Asserts the grounding rules (shut-in ≠ zero rate, a
// missing gauge stays missing, a mechanism call needs evidence, every gap is a
// finding) plus the stage/support/efficiency classifications, against hand-built
// synthetic histories AND the real Volve series when the wb build is present.
// Run: node scripts/test-surveillance-dossier.mjs   (exits nonzero on any failure)
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

const SRC = join(__dirname, '..', 'src', 'tabs', 'reservoir', 'surveillance-dossier.ts');
if (!existsSync(SRC)) { console.log('SKIP  surveillance-dossier.ts not built'); process.exit(0); }
const D = await import('../src/tabs/reservoir/surveillance-dossier.ts');

/** Build a full SurveillanceInput from partial overrides. */
function mk(over = {}) {
  const n = over.ym?.length ?? 24;
  const base = {
    ym: Array.from({ length: n }, (_, i) => `20${String(8 + Math.floor(i / 12)).padStart(2, '0')}-${String((i % 12) + 1).padStart(2, '0')}`),
    oilRate: Array(n).fill(1000), waterRate: Array(n).fill(100), gasRate: Array(n).fill(0), injRate: Array(n).fill(0),
    wct: Array(n).fill(9), vrrCum: Array(n).fill(0), vrrFinal: 0,
    bhp: Array(n).fill(null), cumOilMM: 10, cumWinjMM: 0,
    ooipMMstb: null, remainingMMstb: null,
    mechanism: 'undetermined', mechanismSlope: 0, wells: [],
  };
  return { ...base, ...over };
}

// ── 1 · lastLive: trailing shut-in months are NOT zero rate ───────────────────
{
  check('lastLive ignores trailing shut-in zeros', D.lastLive([5, 9, 7, 0, 0, 0]) === 2);
  check('lastLive on an all-zero series is -1', D.lastLive([0, 0]) === -1);
  check('lastLive on an empty series is -1', D.lastLive([]) === -1);
}

// ── 2 · depletion stage ───────────────────────────────────────────────────────
{
  const plateau = D.buildDepletion(mk({ oilRate: [100, 500, 900, 950, 980, 1000] }));
  check('depletion: still near peak → plateau', plateau.stage === 'plateau', `frac=${plateau.fractionOfPeak?.toFixed(2)}`);

  const decline = D.buildDepletion(mk({ oilRate: [1000, 900, 800, 600, 450, 400] }));
  check('depletion: 40% of peak → decline', decline.stage === 'decline', `frac=${decline.fractionOfPeak?.toFixed(2)}`);

  const tail = D.buildDepletion(mk({ oilRate: [1000, 800, 500, 200, 90, 60] }));
  check('depletion: 6% of peak → tail', tail.stage === 'tail', `frac=${tail.fractionOfPeak?.toFixed(2)}`);

  const ceased = D.buildDepletion(mk({ oilRate: [1000, 900, 700, 0, 0] }));
  check('depletion: trailing zeros → ceased + shutIn', ceased.stage === 'ceased' && ceased.shutIn === true);
  check('depletion: latest read is the last LIVE month, not the zero', ceased.latestRate === 700);

  const none = D.buildDepletion(mk({ oilRate: [0, 0, 0] }));
  check('depletion: no producing month → unknown (never fabricated)', none.stage === 'unknown' && none.latestRate === null);

  // a one-row annual catalogue record must NOT read as "start-up" (real Ekofisk bug)
  const thin = D.buildDepletion(mk({ ym: ['2020'], oilRate: [40000] }));
  check('depletion: single reported period → unknown, not start-up', thin.stage === 'unknown', thin.detail);
  const thin2 = D.buildDepletion(mk({ ym: ['2019', '2020'], oilRate: [40000, 38000] }));
  check('depletion: two periods still too thin to call a stage', thin2.stage === 'unknown');
  const enough = D.buildDepletion(mk({ ym: ['18', '19', '20'], oilRate: [100, 900, 880] }));
  check('depletion: three periods is enough to classify', enough.stage !== 'unknown', enough.stage);
  const thinLedger = D.buildLedger(mk({ ym: ['2020'], oilRate: [40000] }), thin, D.buildSupport(mk({ cumWinjMM: 0 })), D.buildDisplacement(mk({ oilRate: [40000] })), []);
  check('ledger: thin history raised as a GAP', thinLedger.some((g) => /too short/i.test(g.what)));

  const peak = D.buildDepletion(mk({ oilRate: [10, 999, 500, 300] }));
  check('depletion: peak rate + month identified', peak.peakRate === 999 && peak.peakYm === '2008-02');
}

// ── 3 · pressure support / VRR ────────────────────────────────────────────────
{
  const bal = D.buildSupport(mk({ cumWinjMM: 5, vrrFinal: 1.02, wells: [{ well: 'I-1', role: 'injector', cumOilMM: 0, wct: 0, uptime: 1, health: 80, worTrendPct: 0, oilTrendPct: 0 }] }));
  check('support: VRR 1.02 → balanced (good)', bal.klass === 'balanced' && bal.tone === 'good', bal.detail);
  check('support: injector counted', bal.injectors === 1);

  const under = D.buildSupport(mk({ cumWinjMM: 5, vrrFinal: 0.6 }));
  check('support: VRR 0.6 → under-injected', under.klass === 'under-injected' && under.tone === 'warn');

  const over = D.buildSupport(mk({ cumWinjMM: 5, vrrFinal: 1.6 }));
  check('support: VRR 1.6 → over-injected', over.klass === 'over-injected');

  const dep = D.buildSupport(mk({ cumWinjMM: 0 }));
  check('support: no injection → natural depletion scheme', dep.klass === 'depletion' && dep.scheme === 'Depletion');

  const g = D.buildSupport(mk({ bhp: [null, 3000, null, 2600, null] }));
  check('support: BHP drawdown from real gauges only (nulls skipped)', g.bhpFirst === 3000 && g.bhpLast === 2600 && g.bhpDrawdown === 400);
  const ng = D.buildSupport(mk({ bhp: [null, null] }));
  check('support: no gauge → drawdown stays null (never 0)', ng.bhpFirst === null && ng.bhpDrawdown === null);
}

// ── 4 · displacement / breakthrough ───────────────────────────────────────────
{
  const wct = [2, 5, 20, 45, 62, 80, 91];
  const d = D.buildDisplacement(mk({ wct, oilRate: Array(7).fill(500), mechanism: 'channeling', mechanismSlope: 0.99 }));
  check('displacement: breakthrough = first month WCT ≥ 50%', d.breakthroughMonth === 4, `ym=${d.breakthroughYm}`);
  check('displacement: mechanism label + action carried', d.label.includes('Channel') && d.action.length > 20);
  check('displacement: current WCT is the last live month', d.currentWct === 91);

  const dry = D.buildDisplacement(mk({ wct: [1, 2, 3], oilRate: [500, 500, 500] }));
  check('displacement: never watered up → no breakthrough (null, not 0)', dry.breakthroughMonth === null && dry.breakthroughYm === null);
  check('displacement: undetermined mechanism → unknown tone', dry.tone === 'unknown');
}

// ── 5 · efficiency + class band ───────────────────────────────────────────────
{
  const sup = D.buildSupport(mk({ cumWinjMM: 5, vrrFinal: 1.0 }));
  const e = D.buildEfficiency(mk({ cumOilMM: 63, ooipMMstb: 140, cumWinjMM: 5, vrrFinal: 1 }), sup);
  check('efficiency: recovery = cum / OOIP', approx(e.recoveryPct, 63 / 140, 1e-9), `${(e.recoveryPct * 100).toFixed(1)}%`);
  check('efficiency: waterflood scheme picks the waterflood class band', e.basis === 'class-prior' && /Waterflood/.test(e.className));
  check('efficiency: 45% recovery ≥ class mid → good', e.tone === 'good');

  const noOoip = D.buildEfficiency(mk({ cumOilMM: 63, ooipMMstb: null }), sup);
  check('efficiency: no OOIP → recovery null (never assumed)', noOoip.recoveryPct === null && noOoip.tone === 'unknown');

  const depSup = D.buildSupport(mk({ cumWinjMM: 0 }));
  const depEff = D.buildEfficiency(mk({ cumOilMM: 5, ooipMMstb: 100, cumWinjMM: 0 }), depSup);
  check('efficiency: depletion scheme picks the depletion band', /depletion/i.test(depEff.className));
  check('efficiency: 5% vs depletion band low 5% → warn not bad', depEff.tone === 'warn');
}

// ── 6 · events ────────────────────────────────────────────────────────────────
{
  const i = mk({
    oilRate: [0, 100, 900, 700, 400, 0, 0],
    injRate: [0, 0, 200, 300, 300, 0, 0],
    wct: [0, 5, 20, 55, 80, 0, 0],
  });
  const dep = D.buildDepletion(i), disp = D.buildDisplacement({ ...i, mechanism: 'coning' });
  const ev = D.buildEvents(i, dep, disp);
  const ids = ev.map((e) => e.id);
  check('events: first-oil / injection / peak / breakthrough / last-live all found',
    ['first-oil', 'first-injection', 'peak', 'breakthrough', 'last-live'].every((k) => ids.includes(k)), ids.join(','));
  check('events: sorted by month index', ev.every((e, k) => k === 0 || ev[k - 1].index <= e.index));
  check('events: first oil is the first PRODUCING month (index 1, not 0)', ev.find((e) => e.id === 'first-oil').index === 1);

  const quiet = D.buildEvents(mk({ oilRate: [0, 0] }), D.buildDepletion(mk({ oilRate: [0, 0] })), D.buildDisplacement(mk({ oilRate: [0, 0] })));
  check('events: nothing happened → empty list (no invented pips)', quiet.length === 0);
}

// ── 7 · watchlist ─────────────────────────────────────────────────────────────
{
  const wells = [
    { well: 'A', role: 'producer', cumOilMM: 5, wct: 95, uptime: 0.9, health: 30, worTrendPct: 10, oilTrendPct: -5 },
    { well: 'B', role: 'producer', cumOilMM: 8, wct: 20, uptime: 0.95, health: 88, worTrendPct: 5, oilTrendPct: -2 },
    { well: 'C', role: 'producer', cumOilMM: 3, wct: 40, uptime: 0.3, health: 55, worTrendPct: 8, oilTrendPct: -10 },
  ];
  const w = D.buildWatchlist(mk({ wells }));
  check('watchlist: sorted worst-health first', w[0].well === 'A' && w[2].well === 'B');
  check('watchlist: high water cut flagged', w[0].flag === 'Water cut ≥ 90%');
  check('watchlist: low uptime flagged', w.find((x) => x.well === 'C').flag === 'Low uptime');
  check('watchlist: healthy well carries no flag', w.find((x) => x.well === 'B').flag === null);
}

// ── 8 · ledger — every gap is a finding ───────────────────────────────────────
{
  const i = mk({ cumWinjMM: 5, vrrFinal: 0.6, mechanism: 'channeling', mechanismSlope: 1.0, wct: Array(24).fill(60) });
  const dep = D.buildDepletion(i), sup = D.buildSupport(i), disp = D.buildDisplacement(i);
  const led = D.buildLedger(i, dep, sup, disp, D.buildWatchlist(i));
  check('ledger: under-injection raised as an ACTION', led.some((g) => g.severity === 'act' && /deficit/i.test(g.what)));
  check('ledger: channelling raised as an ACTION with the remedy', led.some((g) => /water path/i.test(g.what) && /conformance/i.test(g.why)));
  check('ledger: missing BHP raised as a GAP', led.some((g) => g.severity === 'gap' && /pressure/i.test(g.what)));
  check('ledger: missing OOIP raised as a GAP', led.some((g) => /in-place/i.test(g.what)));

  const empty = D.buildLedger(mk({ ym: [] }), dep, sup, disp, []);
  check('ledger: no history → single honest finding, not an error', empty.length === 1 && /Production history/.test(empty[0].what));
}

// ── 9 · assembled dossier + formatters ────────────────────────────────────────
{
  const d = D.buildSurveillanceDossier(mk({ cumOilMM: 63, ooipMMstb: 140, cumWinjMM: 190, vrrFinal: 1.02, mechanism: 'coning', oilRate: [100, 900, 500, 300] }));
  check('dossier assembles all seven sections',
    !!(d.depletion && d.support && d.displacement && d.efficiency && d.events && d.watchlist && d.ledger));
  check('fmtPct rounds to whole percent', D.fmtPct(0.4567) === '46%');
  check('fmtPct on null → em dash (never 0%)', D.fmtPct(null) === '—');
  check('fmtNum on null → em dash', D.fmtNum(null) === '—');
  check('fmtNum ≥100 uses thousands separator', D.fmtNum(63123) === '63,123');
}

// ── 10 · REAL Volve series (when the wb build is present) ─────────────────────
{
  const fp = join(__dirname, '..', 'public', 'wb', 'prod-field.json');
  if (existsSync(fp)) {
    const months = JSON.parse(readFileSync(fp, 'utf8')).monthly;
    const SM3_TO_BBL = 6.2898;
    const dim = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
    const ym = months.map((m) => m.ym);
    const oilRate = months.map((m) => (m.oil * SM3_TO_BBL) / dim(m.ym));
    const injRate = months.map((m) => (m.wi * SM3_TO_BBL) / dim(m.ym));
    const wct = months.map((m) => (m.oil + m.water > 0 ? (m.water / (m.oil + m.water)) * 100 : 0));
    const cumOilMM = months.reduce((s, m) => s + m.oil, 0) * SM3_TO_BBL / 1e6;
    const cumWinjMM = months.reduce((s, m) => s + m.wi, 0) * SM3_TO_BBL / 1e6;
    const inp = mk({ ym, oilRate, injRate, wct, cumOilMM, cumWinjMM, vrrFinal: 1.023, ooipMMstb: 22 * SM3_TO_BBL, mechanism: 'coning', bhp: months.map(() => null) });
    const d = D.buildSurveillanceDossier(inp);

    check('REAL Volve: ceased (shut in Sep 2016, trailing zero months)', d.depletion.stage === 'ceased', `last live ${d.depletion.latestYm}`);
    check('REAL Volve: last live month is 2016-09, not a trailing zero', d.depletion.latestYm === '2016-09');
    check('REAL Volve: balanced voidage (VRR ≈ 1)', d.support.klass === 'balanced', `VRR ${d.support.vrr?.toFixed(3)}`);
    check('REAL Volve: water breakthrough detected', d.displacement.breakthroughMonth != null, `at ${d.displacement.breakthroughYm}`);
    check('REAL Volve: recovery ≈ 46% of model OOIP', approx(d.efficiency.recoveryPct, 63.1 / (22 * SM3_TO_BBL), 0.02), `${(d.efficiency.recoveryPct * 100).toFixed(1)}%`);
    check('REAL Volve: timeline carries first-oil, injection start, peak, breakthrough', d.events.length >= 4, d.events.map((e) => e.id).join(','));
    check('REAL Volve: shut-in raised in the ledger', d.ledger.some((g) => /shut in/i.test(g.what)));
  } else {
    console.log('SKIP  real Volve gate — public/wb/prod-field.json not built (npm run data:wb)');
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

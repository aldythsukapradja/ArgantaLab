// Well Review Register truth-lock — the per-well card derivation behind the Reservoir
// Management watchlist. Asserts the grounding rules (no per-well recovery factor, VRR is
// a pattern property, remaining always carries its error, implausible geometry drops the
// well out of the ranking) plus the metric maths and the root-cause rules.
// Run: node scripts/test-well-review.mjs   (exits nonzero on any failure)
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

const SRC = join(__dirname, '..', 'src', 'tabs', 'reservoir', 'well-review.ts');
if (!existsSync(SRC)) { console.log('SKIP  well-review.ts not built'); process.exit(0); }
const W = await import('../src/tabs/reservoir/well-review.ts');

function mk(over = {}) {
  const n = over.oilRate?.length ?? 30;
  const base = {
    well: 'A', role: 'oil-producer',
    ym: Array.from({ length: n }, (_, i) => `20${String(10 + Math.floor(i / 12)).padStart(2, '0')}-${String((i % 12) + 1).padStart(2, '0')}`),
    oilRate: Array(n).fill(1000), waterRate: Array(n).fill(200), gasRate: Array(n).fill(0),
    wct: Array(n).fill(17), wor: Array(n).fill(0.2),
    uptime: Array(n).fill(0.95), bhp: Array(n).fill(3000),
    cumOilMM: 10, tdMd: 3500, tdTvd: 3100, fieldCumMM: 63,
    patternName: 'F-5', patternVrr: 1.02, patternInjectors: ['F-5'],
    mechanism: 'undetermined', mechanismSlope: 0,
    remainingMMstb: 2.4, declineMapePct: 20,
  };
  return { ...base, ...over };
}
const one = (over) => W.buildWellReviews([mk(over)])[0];

// ── 1 · latest rate, the move on the prior month, YoY ─────────────────────────
{
  const r = one({ oilRate: [...Array(28).fill(1000), 900, 810] });
  check('latest rate is the last LIVE month', r.latestRate === 810);
  check('delta vs previous month', r.deltaPrev === -90, `${r.deltaPrev}`);
  check('delta % vs previous month', approx(r.deltaPrevPct, -10, 1e-9), `${r.deltaPrevPct?.toFixed(1)}%`);

  const shut = one({ oilRate: [...Array(20).fill(1000), 700, 0, 0] });
  check('trailing shut-in months ignored for "latest"', shut.latestRate === 700 && shut.latestYm === '2011-09', shut.latestYm);
}
{
  // 12 months at 1000 then 12 at 500 → YoY −50%
  const r = one({ oilRate: [...Array(12).fill(1000), ...Array(12).fill(500)] });
  check('YoY compares trailing 12 mo vs the prior 12', approx(r.yoyDeclinePct, -50, 1e-9), `${r.yoyDeclinePct?.toFixed(1)}%`);
  const thin = one({ oilRate: [900, 800, 700] });
  check('YoY null without a full prior year (never invented)', thin.yoyDeclinePct === null);
}

// ── 2 · trend maths ───────────────────────────────────────────────────────────
{
  const wor = Array.from({ length: 24 }, (_, i) => 0.2 * Math.exp(0.02 * i));
  const r = one({ wor });
  check('WOR trend annualises the log slope', approx(r.worTrendPct, (Math.exp(0.24) - 1) * 100, 0.5), `${r.worTrendPct.toFixed(1)}%/yr`);
}

// ── 2b · STABILIZED decline — the abandonment ramp-down must not be quoted ────
{
  const ym = (n) => Array.from({ length: n }, (_, i) => `20${String(10 + Math.floor(i / 12)).padStart(2, '0')}-${String((i % 12) + 1).padStart(2, '0')}`);
  // 24 months declining a gentle ~1%/mo, then 4 months of abandonment collapse
  const stable = Array.from({ length: 24 }, (_, i) => 1000 * Math.exp(-0.01 * i));
  const collapse = [400, 150, 60, 20];
  const series = [...stable, ...collapse];
  const d = W.stabilizedDecline(series, ym(series.length));
  check('stabilized: terminal collapse detected and excluded', d.excludedMonths === collapse.length, `excluded=${d.excludedMonths}`);
  check('stabilized: fit window ends before the collapse', d.toYm === ym(series.length)[23], `${d.fromYm}→${d.toYm}`);
  check('stabilized: recovers the true ~-11%/yr, not the collapse',
    approx(d.annualPct, (Math.exp(-0.01 * 12) - 1) * 100, 1.5), `${d.annualPct?.toFixed(1)}%/yr`);
  check('stabilized: terminal steepness reported separately, not hidden',
    d.terminalAnnualPct != null && d.terminalAnnualPct < -90, `${d.terminalAnnualPct?.toFixed(0)}%/yr`);
  check('stabilized: basis names the excluded months', /abandonment ramp-down/.test(d.basis), d.basis);

  // a clean decline with no collapse must NOT have months trimmed
  const clean = W.stabilizedDecline(stable, ym(stable.length));
  check('stabilized: no ramp-down → nothing excluded', clean.excludedMonths === 0 && /no terminal ramp-down/.test(clean.basis));
  check('stabilized: clean fit matches the input rate', approx(clean.annualPct, (Math.exp(-0.01 * 12) - 1) * 100, 0.5));

  const thin = W.stabilizedDecline([100, 90, 80], ym(3));
  check('stabilized: too little history → null, never a guessed rate', thin.annualPct === null);
  check('stabilized: no production → null', W.stabilizedDecline([0, 0], ym(2)).annualPct === null);
}
{
  // the card must lead with the stabilized rate and SAY the shutdown was excluded
  const oil = [...Array.from({ length: 24 }, (_, i) => 1000 * Math.exp(-0.01 * i)), 400, 150, 60];
  const r = one({ oilRate: oil, wct: Array(oil.length).fill(80), uptime: Array(oil.length).fill(0.9) });
  check('observation quotes the STABILIZED decline', /Stabilized decline/.test(r.observation), r.observation.slice(0, 130));
  check('observation states the abandonment months were excluded', /abandonment ramp-down/.test(r.observation));
  check('health scored on stabilized decline, not the collapse', r.health > 20, `health=${r.health}`);
}

// ── 2c · cumulative-oil ranking drives the card bar ───────────────────────────
{
  const rows = W.buildWellReviews([
    mk({ well: 'SMALL', cumOilMM: 1 }), mk({ well: 'BIG', cumOilMM: 28.8 }), mk({ well: 'MID', cumOilMM: 7.2 }),
  ]);
  const by = Object.fromEntries(rows.map((r) => [r.well, r]));
  check('cum rank 1 is the biggest cumulative producer', by.BIG.cumRank === 1 && by.MID.cumRank === 2 && by.SMALL.cumRank === 3);
  check('bar share is relative to the biggest producer', approx(by.BIG.cumShareOfMax, 1, 1e-9) && approx(by.MID.cumShareOfMax, 7.2 / 28.8, 1e-9));
  check('smallest producer still gets a positive share', by.SMALL.cumShareOfMax > 0);
}

// ── 3 · share of field — and NO per-well recovery factor ──────────────────────
{
  const r = one({ cumOilMM: 12.6, fieldCumMM: 63 });
  check('share of field = cum / field cum', approx(r.shareOfFieldPct, 20, 1e-9), `${r.shareOfFieldPct?.toFixed(1)}%`);
  check('card exposes NO per-well recovery factor', !('recoveryPct' in r) && !('recoveryFactor' in r));
}

// ── 4 · remaining always travels with its error ───────────────────────────────
{
  check('tight blind test → trusted remaining', one({ declineMapePct: 15 }).remainingTrust === 'good');
  check('loose blind test → warned remaining', one({ declineMapePct: 40 }).remainingTrust === 'warn');
  check('very loose blind test → distrusted remaining', one({ declineMapePct: 75 }).remainingTrust === 'bad');
  check('no blind test → unknown trust (never assumed good)', one({ declineMapePct: null }).remainingTrust === 'unknown');
  const r = one({ remainingMMstb: 2.4, declineMapePct: 61 });
  check('action states the remaining volume AND its error', /2\.4 MMSTB/.test(r.action) && /61%/.test(r.action), r.action.slice(-70));
  const none = one({ remainingMMstb: null });
  check('no remaining → says so, never 0', /not derivable/i.test(none.action));
}

// ── 5 · VRR is a PATTERN property ─────────────────────────────────────────────
{
  const r = one({ patternName: 'F-5', patternVrr: 0.72, patternInjectors: ['F-5'] });
  check('pattern VRR carried with its pattern name', r.patternVrr === 0.72 && r.patternName === 'F-5');
  check('under-support raised as a root cause naming the pattern',
    r.rootCauses.some((c) => /voidage deficit/i.test(c.cause) && c.evidence.join(' ').includes('F-5')));
  const noPat = one({ patternName: null, patternVrr: null, patternInjectors: [] });
  check('no pattern → flagged, VRR stays null (never 0)', noPat.patternVrr === null && noPat.flags.some((f) => /pattern/i.test(f)));
}

// ── 6 · geometry QC drops the well out of the ranking ─────────────────────────
{
  const bad = one({ well: 'F-11', tdMd: 347, tdTvd: 347 });
  check('implausible TD flagged', bad.flags.some((f) => /implausible/i.test(f)), bad.flags[0]);
  check('implausible TD makes the well unrankable', bad.rankable === false);
  check('action redirects to fixing the record', /geometry record/i.test(bad.action));
  check('plausible TD stays rankable', one({ tdMd: 3500 }).rankable === true);

  const rows = W.buildWellReviews([mk({ well: 'GOOD', tdMd: 3500, wct: Array(30).fill(95) }), mk({ well: 'BAD', tdMd: 347 })]);
  check('unrankable wells sort last, never hidden', rows.length === 2 && rows[rows.length - 1].well === 'BAD');
  check('benchmark percentile is null for unrankable wells', rows.find((r) => r.well === 'BAD').benchPercentile === null);
}

// ── 7 · root-cause rules ──────────────────────────────────────────────────────
{
  const chan = one({ mechanism: 'channeling', mechanismSlope: 1.0, wor: Array.from({ length: 24 }, (_, i) => 0.2 * Math.exp(0.05 * i)), patternVrr: 1.03 });
  check('channelling ranked first when Chan slope ≈1 and WOR rising', /channelling/i.test(chan.rootCauses[0].cause), chan.rootCauses[0].cause);
  check('channelling remedy is conformance / shut-off', /conformance|shut-off/i.test(chan.rootCauses[0].remedy));

  const cone = one({ mechanism: 'coning', mechanismSlope: 0.1 });
  check('coning recognised', cone.rootCauses.some((c) => /coning/i.test(c.cause)));
  check('coning remedy is rate control, not shut-off', /rate control/i.test(cone.rootCauses.find((c) => /coning/i.test(c.cause)).remedy));

  const mech = one({ uptime: Array(30).fill(0.5), oilRate: [...Array(28).fill(1000), 1000, 700] });
  check('low uptime + rate step → mechanical/deferment', mech.rootCauses.some((c) => /mechanical/i.test(c.cause)));

  const quiet = one({});
  check('nothing fires → natural decline (never a fabricated cause)', quiet.rootCauses[0].cause === 'Natural decline');
  check('every cause carries its evidence', quiet.rootCauses.every((c) => c.evidence.length > 0));
  check('causes are ranked by confidence', (() => { const c = chan.rootCauses; return c.every((x, i) => i === 0 || c[i - 1].confidence >= x.confidence); })());
}

// ── 8 · narrative ─────────────────────────────────────────────────────────────
{
  const r = one({ oilRate: [...Array(28).fill(1000), 900, 810], wct: Array(30).fill(97), uptime: Array(30).fill(0.62) });
  check('observation states rate, move, water cut and uptime',
    /810 bopd/.test(r.observation) && /-10%/.test(r.observation.replace('−', '-')) && /97%/.test(r.observation) && /62%/.test(r.observation), r.observation);
  check('insight is the top root cause with its evidence', r.insight.startsWith(r.rootCauses[0].cause));
  const dead = one({ oilRate: Array(30).fill(0) });
  check('no production → honest observation, no invented numbers', /no producing month/i.test(dead.observation) && dead.latestRate === null);
}

// ── 9 · ranking + health ──────────────────────────────────────────────────────
{
  const rows = W.buildWellReviews([
    mk({ well: 'HEALTHY', wct: Array(30).fill(10), uptime: Array(30).fill(0.98) }),
    mk({ well: 'SICK', wct: Array(30).fill(96), uptime: Array(30).fill(0.4) }),
  ]);
  check('worst health ranks first', rows[0].well === 'SICK', `${rows.map((r) => r.well).join(' → ')}`);
  check('healthy well scores above sick well', rows[1].health > rows[0].health);
  check('benchmark percentile is peer-relative (0..100)', rows.every((r) => r.benchPercentile >= 0 && r.benchPercentile <= 100));
  check('tone tracks health', rows[0].tone === 'bad' && rows[1].tone === 'good');
}

// ── 10 · formatters ───────────────────────────────────────────────────────────
{
  check('fmt1 on null → em dash', W.fmt1(null) === '—');
  check('fmtInt groups thousands', W.fmtInt(56129) === '56,129');
  check('fmtInt on null → em dash (never 0)', W.fmtInt(null) === '—');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

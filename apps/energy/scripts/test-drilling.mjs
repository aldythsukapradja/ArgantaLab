// Drilling + formation-pressure truth-lock. Verifies the END-TO-END chain for the two
// data types that were previously dropped on the floor:
//   RAW (mud log DLIS / FPWD LAS, decoded to data-energy/processed)
//     → BUILT   (public/wb/drill-*.json, press-*.json)
//     → SCREENED (physically impossible values nulled AND counted, never zeroed)
//     → INDEXED  (index.json has.drilling / has.pressure)
//     → TYPED    (curate.ts tracks them as completeness dimensions)
//
// It asserts against the REAL emitted bundle, not a fixture — so it fails if the
// build regresses. Skips cleanly when public/wb is absent (it is gitignored).
// Run: node scripts/test-drilling.mjs
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const WB = join(__dirname, '..', 'public', 'wb');
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));

if (!existsSync(join(WB, 'index.json'))) {
  console.log('SKIP — public/wb not built (gitignored; run npm run data:wb)');
  process.exit(0);
}

const index = j(join(WB, 'index.json'));
const drillFiles = readdirSync(WB).filter((f) => /^drill-.*\.json$/.test(f));
const pressFiles = readdirSync(WB).filter((f) => /^press-.*\.json$/.test(f));

// ── index wiring ────────────────────────────────────────────────────────────────
const idxDrill = index.wells.filter((w) => w.has?.drilling);
const idxPress = index.wells.filter((w) => w.has?.pressure);
check('index: has.drilling flag exists and is set', idxDrill.length > 0, `${idxDrill.length} wellbores`);
check('index: has.pressure flag exists and is set', idxPress.length > 0, `${idxPress.length} wellbores`);
check('index drilling count matches emitted files', idxDrill.length === drillFiles.length, `${idxDrill.length} flagged / ${drillFiles.length} files`);
check('index pressure count matches emitted files', idxPress.length === pressFiles.length, `${idxPress.length} flagged / ${pressFiles.length} files`);
check('every drilling-flagged wellbore has its file', idxDrill.every((w) => {
  const s = w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return existsSync(join(WB, `drill-${s}.json`));
}));
check('every pressure-flagged wellbore has its file', idxPress.every((w) => {
  const s = w.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return existsSync(join(WB, `press-${s}.json`));
}));

// ── drilling payloads ───────────────────────────────────────────────────────────
const REQUIRED_UNITS = { MWIN: 'sg', MWOUT: 'sg', ECD: 'sg', ROP: 'm/h', WOB: 't', SPP: 'bar' };
let anyMw = 0, totalScreened = 0;
for (const f of drillFiles) {
  const d = j(join(WB, f));
  const name = f.replace(/\.json$/, '');
  if (!d.curves.MWIN) continue;
  anyMw++;
  const mw = d.curves.MWIN.values.filter((v) => v != null);
  // mud weight is a DENSITY — physically it can never be <= 0 or above ~3 sg
  check(`${name}: mud weight physically valid`, mw.length > 0 && mw.every((v) => v > 0.5 && v < 3.0),
    `${mw.length} live, range ${Math.min(...mw).toFixed(2)}-${Math.max(...mw).toFixed(2)} sg`);
  for (const [k, u] of Object.entries(REQUIRED_UNITS)) {
    if (d.curves[k] && d.curves[k].unit) {
      check(`${name}: ${k} unit is ${u}`, d.curves[k].unit === u, `got "${d.curves[k].unit}"`);
    }
  }
  totalScreened += Object.values(d.qc?.screenedOutOfRange ?? {}).reduce((a, b) => a + b, 0);
}
check('drilling: at least one wellbore carries mud weight', anyMw > 0, `${anyMw} of ${drillFiles.length}`);

// GROUNDING: screening must NULL, never zero, and must be counted
{
  const withScreen = drillFiles.map((f) => j(join(WB, f))).find((d) => Object.keys(d.qc?.screenedOutOfRange ?? {}).length);
  check('GROUNDING: screened values are recorded as a COUNT (visible, not silent)',
    !!withScreen && totalScreened > 0, `${totalScreened} screened across the delivery`);
  if (withScreen) {
    const [chan, n] = Object.entries(withScreen.qc.screenedOutOfRange)[0];
    const nulls = withScreen.curves[chan].values.filter((v) => v === null).length;
    check(`GROUNDING: screened ${chan} samples became NULL (not 0)`, nulls >= n, `${nulls} nulls >= ${n} screened`);
    check('GROUNDING: qc note explains the screening', typeof withScreen.qc.note === 'string' && withScreen.qc.note.length > 20);
  }
}
// GROUNDING: no impossible physical value survives anywhere
{
  const BOUNDS = { MWIN: [0.5, 3], MWOUT: [0.5, 3], ECD: [0.5, 3.5], PPG: [0.2, 3.5], TEMPIN: [-20, 200], TEMPOUT: [-20, 200] };
  let bad = null;
  for (const f of drillFiles) {
    const d = j(join(WB, f));
    for (const [k, b] of Object.entries(BOUNDS)) {
      const c = d.curves[k]; if (!c) continue;
      const off = c.values.find((v) => v != null && (v < b[0] || v > b[1]));
      if (off !== undefined) { bad = `${f} ${k}=${off}`; break; }
    }
    if (bad) break;
  }
  check('GROUNDING: no physically impossible value survives screening', bad === null, bad ?? 'all channels within physical bounds');
}
// GROUNDING: a gap must break the trace, so a null must never be coerced to a number
{
  const d = j(join(WB, drillFiles[0]));
  const anyNull = Object.values(d.curves).some((c) => c.values.some((v) => v === null));
  const anyNaN = Object.values(d.curves).some((c) => c.values.some((v) => typeof v === 'number' && !Number.isFinite(v)));
  check('GROUNDING: gaps are null, never NaN/Infinity', !anyNaN, anyNull ? 'nulls present and clean' : 'no gaps in this file');
}
// provenance back to the RAW file
{
  const d = j(join(WB, drillFiles[0]));
  check('drilling: source_id points back at the RAW mud log',
    typeof d.source_id === 'string' && /MUD_LOG/i.test(d.source_id), d.source_id);
  check('drilling: dataNature declared', typeof d.dataNature === 'string' && d.dataNature.length > 0, d.dataNature);
}

// ── pressure payloads ───────────────────────────────────────────────────────────
let stationsTotal = 0, fullRuns = 0, previewRuns = 0;
for (const f of pressFiles) {
  const p = j(join(WB, f));
  stationsTotal += p.runs.length;
  for (const r of p.runs) { if (r.rows_source === 'full') fullRuns++; else previewRuns++; }
}
check('pressure: stations emitted', stationsTotal > 0, `${stationsTotal} stations across ${pressFiles.length} wellbores`);
check('pressure: full decode preferred over the decimated preview', fullRuns > previewRuns,
  `${fullRuns} full / ${previewRuns} preview`);
{
  const p = j(join(WB, pressFiles[0]));
  const r = p.runs[0];
  const pq = r.curves.PQUARTZ?.values.filter((v) => v != null) ?? [];
  check('pressure: quartz-gauge channel is populated (not the empty *_SF alias)',
    pq.length > 0, `${pq.length} live samples`);
  // a downhole gauge in a 3 km well reads hundreds of bar — never millions
  check('pressure: readings are physically plausible', pq.every((v) => v >= 0 && v <= 2000),
    pq.length ? `range ${Math.min(...pq).toFixed(1)}-${Math.max(...pq).toFixed(1)} bar` : '');
  check('pressure: source_id points back at the RAW LAS',
    typeof r.source_id === 'string' && /\.LAS$/i.test(r.source_id), r.source_id);
  check('pressure: declared row count is carried for audit', r.declared_n_rows != null);
}
// GROUNDING: the -999.25 declared null and the 2,961,276 undeclared sentinel are both gone
{
  let sentinel = null;
  for (const f of pressFiles) {
    const p = j(join(WB, f));
    for (const r of p.runs) {
      for (const [k, c] of Object.entries(r.curves)) {
        const hit = c.values.find((v) => v != null && (Math.abs(v - (-999.25)) < 1e-6 || v > 100000));
        if (hit !== undefined) { sentinel = `${f} ${k}=${hit}`; break; }
      }
      if (sentinel) break;
    }
    if (sentinel) break;
  }
  check('GROUNDING: no null sentinel (-999.25) or 2.9e6 garbage survives', sentinel === null, sentinel ?? 'clean');
}

// ── HOLE SECTIONS / CASING POINTS from bit-diameter steps ──────────────────────
// Bit diameter is a measured channel and every step-down in it is a real casing
// point. This is the ONLY casing information recoverable — CasingSeat / StressCheck /
// WellPlan are all _NOT_MIRRORED stubs.
{
  const withSections = drillFiles.map((f) => j(join(WB, f))).filter((d) => d.sections?.length);
  check('hole sections derived for the wellbores that have a mud log', withSections.length > 0,
    `${withSections.length} of ${drillFiles.length}`);

  for (const d of withSections) {
    const s = d.sections;
    check(`${d.well}: sections are ordered and contiguous`, s.every((x, i) =>
      x.topMd <= x.baseMd && (i === 0 || Math.abs(x.topMd - s[i - 1].baseMd) < 0.001)),
    s.map((x) => `${x.bitSizeIn}" ${x.topMd.toFixed(0)}-${x.baseMd.toFixed(0)}`).join(' '));
    check(`${d.well}: bit size decreases monotonically down-hole (a hole never widens)`,
      s.every((x, i) => i === 0 || x.bitSizeIn < s[i - 1].bitSizeIn),
      s.map((x) => `${x.bitSizeIn}"`).join(' > '));
  }

  // F-11's mother bore is the textbook top-hole: 36" then 26", nothing deeper
  const f11 = withSections.find((d) => d.well === 'F-11');
  check('F-11 mother bore: 36" then 26" top-hole only', f11 && f11.sections.length === 2
    && f11.sections[0].bitSizeIn === 36 && f11.sections[1].bitSizeIn === 26);
  // F-11 T2 is the full programme
  const t2 = withSections.find((d) => d.well === 'F-11 T2');
  check('F-11 T2: full 26 → 17.5 → 12.25 → 8.5 programme',
    t2 && t2.sections.map((x) => x.bitSizeIn).join(',') === '26,17.5,12.25,8.5');

  // GROUNDING: the casing SIZE is a convention, and must say so
  const anyCsg = withSections.flatMap((d) => d.sections).find((x) => x.casingIn);
  check('GROUNDING: paired casing size carries an explicit "not measured" basis',
    !!anyCsg && /not measured/i.test(String(anyCsg.casingBasis)), anyCsg?.casingBasis);
  check('GROUNDING: conventional pairings are the standard North Sea programme', (() => {
    const PAIR = { 36: 30, 26: 20, 17.5: 13.375, 12.25: 9.625, 8.5: 7 };
    return withSections.flatMap((d) => d.sections).every((x) => !x.casingIn || PAIR[x.bitSizeIn] === x.casingIn);
  })());
  check('casing point is the BASE of its section (where the string is set)',
    withSections.flatMap((d) => d.sections).every((x) => x.casingPointMd === x.baseMd));
  check('qc block reports the hole-section count', withSections.every((d) => d.qc?.holeSections === d.sections.length));
}

// ── well schematic: the drawing must be renderable from the emitted sections ────
{
  // casing.ts is deliberately pure (no JSX) so the schematic's vocabulary is testable
  const { fmtIn, sectionLabel, CASING_FOR_HOLE } = await import('../src/dataqc/viewers/casing.ts');
  check('schematic: casing sizes render as fractions, not decimals', (() => {
    return fmtIn(13.375) === '13 3/8' && fmtIn(9.625) === '9 5/8' && fmtIn(8.5) === '8 1/2'
      && fmtIn(20) === '20' && fmtIn(30) === '30' && fmtIn(7) === '7';
  })(), `13.375 → ${fmtIn(13.375)}, 9.625 → ${fmtIn(9.625)}`);

  // a schematic nests strings by size — that requires strictly decreasing widths,
  // which the monotonic-bit-size check above already guarantees. Verify the pairing
  // a schematic actually draws: every non-final section has a shoe to draw.
  const t2 = j(join(WB, 'drill-f-11-t2.json'));
  check('schematic: every cased section has a shoe depth to draw',
    t2.sections.slice(0, -1).every((s) => s.casingPointMd != null && s.casingIn != null));
  check('schematic: the final section is the open hole (no casing pairing needed to draw it)',
    t2.sections[t2.sections.length - 1].bitSizeIn === 8.5);
  check('schematic: final section labels as OPEN HOLE, never a phantom shoe',
    /open hole/.test(sectionLabel(t2.sections[t2.sections.length - 1], true)),
    sectionLabel(t2.sections[t2.sections.length - 1], true));
  check('schematic: a cased section labels with its shoe depth',
    sectionLabel(t2.sections[0], false) === `20" csg @ ${t2.sections[0].baseMd.toFixed(0)}`,
    sectionLabel(t2.sections[0], false));
  check('shared casing table matches what the build emitted (build and viewers cannot drift)',
    t2.sections.every((s) => !s.casingIn || CASING_FOR_HOLE[s.bitSizeIn] === s.casingIn));
  check('schematic: sections nest (each string strictly narrower than the one above)',
    t2.sections.every((s, i) => i === 0 || s.bitSizeIn < t2.sections[i - 1].bitSizeIn));
}

// ── formation tops: attribution against the RAW pick file ──────────────────────
// Regression lock for the bug where 300 of 409 picks were emitted with well:null
// (attribution gated on an upstream `well_id` that was only populated 109 times),
// making them invisible to the audit, the curated inventory and every viewer.
{
  const picks = j(join(WB, 'picks.json'));
  const rows = picks.picks ?? [];
  check('picks: every raw pick is emitted', rows.length === 409, `${rows.length} picks`);
  check('picks: the vast majority are attributed to a wellbore',
    picks.attributed >= 320, `${picks.attributed}/${rows.length} attributed`);
  check('picks: attributed count matches the rows that carry a well',
    picks.attributed === rows.filter((r) => r.well).length);

  // per-wellbore counts must equal the raw file exactly (spot-checked against
  // `grep '^Well ' Well_picks_Volve_v1.dat` counts)
  const by = new Map();
  for (const r of rows) if (r.well) by.set(r.well, (by.get(r.well) ?? 0) + 1);
  const RAW_COUNTS = { 'F-14': 22, 'F-11 B': 33, 'F-1 C': 16, '19 A': 16, 'F-11': 2, 'F-7': 4, 'F-9': 4, '19 B': 4, 'F-12 pilot': 3 };
  for (const [wname, n] of Object.entries(RAW_COUNTS)) {
    check(`picks: ${wname} has exactly ${n} tops (matches raw)`, by.get(wname) === n, `got ${by.get(wname) ?? 0}`);
  }

  // picks-only wellbores must exist in the index — a wellbore whose ONLY data is
  // formation tops used to be dropped entirely by the orphan union
  const idxNames = new Set(index.wells.map((w) => w.name));
  check('GROUNDING: a picks-ONLY wellbore still gets an index row (19 B)', idxNames.has('19 B'));
  check('GROUNDING: a picks-ONLY wellbore still gets an index row (F-12 pilot)', idxNames.has('F-12 pilot'));
  check('picks-only wellbores are flagged no_master_record, not silently promoted',
    index.wells.filter((w) => w.name === '19 B' || w.name === 'F-12 pilot').every((w) => w.no_master_record === true));
  check('index has.picks agrees with the attributed set', index.wells.every((w) => (w.has.picks === true) === by.has(w.name)));

  // GROUNDING: wells genuinely outside this delivery must NOT be force-matched
  const OUTSIDE = ['15/5-7 A', '15/9-A-15', '15/9-B-6', '15/9-C-2 AH', '15/9-C-2 AHT2', '15/9-C-2 H', '15/9-11', '15/9-17', '15/9-4', '15/9-8'];
  check('GROUNDING: foreign wells stay unattributed, never snapped to a lookalike',
    OUTSIDE.every((o) => picks.outsideDelivery.includes(o)), picks.outsideDelivery.join(', '));
  check('GROUNDING: no foreign well leaked into an attributed row',
    !rows.some((r) => r.well && OUTSIDE.includes(String(r.source_well))));
  check('picks: attributed + outside = the whole raw file',
    picks.attributed + rows.filter((r) => !r.well).length === rows.length);

  // enriched fields the fix added
  check('picks: qualifier (ER/FP/FO/NL/NR) carried through', rows.some((r) => r.qlf));
  check('picks: tvdss carried through', rows.some((r) => typeof r.tvdss === 'number'));
}

// ── WELLBORE ROLES vs the PUBLISHED Sodir inventory ────────────────────────────
// Roles must come from the regulator's purpose+content, not from "does a production
// file exist". The old rule got more than half the field wrong: F-1 B (a water
// INJECTOR) read as nothing, F-7/F-9/F-9 A (water SUPPLY wells) read as nothing,
// F-15 C (an oil producer) read as nothing, and F-11 — an OBSERVATION bore — read
// as a producer. These counts are the published Volve development inventory.
{
  const byRole = new Map();
  for (const w of index.wells) {
    if (!byRole.has(w.role)) byRole.set(w.role, []);
    byRole.get(w.role).push(w.name);
  }
  const names = (r) => (byRole.get(r) ?? []).slice().sort().join(', ');
  const EXPECT = {
    'oil-producer': ['F-1 C', 'F-11 B', 'F-12', 'F-14', 'F-15 C', 'F-15 D'],
    'water-injector': ['F-1 B', 'F-4', 'F-5'],
    'water-supply': ['F-7', 'F-9', 'F-9 A'],
    observation: ['F-1', 'F-1 A', 'F-10', 'F-11', 'F-11 A', 'F-15', 'F-15 A', 'F-15 B'],
  };
  for (const [role, expect] of Object.entries(EXPECT)) {
    check(`published inventory: ${expect.length} ${role}`, names(role) === expect.join(', '), names(role) || '(none)');
  }
  check('published inventory: 20 drilled development branches', (() => {
    const dev = index.wells.filter((w) => !/^19/.test(w.name) && w.role !== 'none' && w.role !== 'not-drilled');
    return dev.length === 20;
  })(), `${index.wells.filter((w) => !/^19/.test(w.name) && w.role !== 'none' && w.role !== 'not-drilled').length} branches`);

  // the specific corrections
  check('CORRECTION: F-1 B is a water injector (was missing entirely)',
    index.wells.find((w) => w.name === 'F-1 B')?.role === 'water-injector');
  check('CORRECTION: F-11 is OBSERVATION, not a producer',
    index.wells.find((w) => w.name === 'F-11')?.role === 'observation');
  check('CORRECTION: F-11 B is the oil producer of the F-11 slot',
    index.wells.find((w) => w.name === 'F-11 B')?.role === 'oil-producer');
  check('CORRECTION: F-15 C is an oil producer',
    index.wells.find((w) => w.name === 'F-15 C')?.role === 'oil-producer');
  for (const wn of ['F-7', 'F-9', 'F-9 A']) {
    const w = index.wells.find((x) => x.name === wn);
    check(`CORRECTION: ${wn} is WATER SUPPLY, not a producer (PRODUCTION purpose + WATER content, TD ~1085 m)`,
      w?.role === 'water-supply' && w?.purpose === 'PRODUCTION' && w?.content === 'WATER'
      && (w?.td_md ?? 0) < 1500, `TD ${w?.td_md} m`);
  }
  check('GROUNDING: no water-supply well is ranked among the oil producers',
    !(byRole.get('oil-producer') ?? []).some((n) => ['F-7', 'F-9', 'F-9 A'].includes(n)));
  check('GROUNDING: role carries the regulator purpose + content that produced it',
    index.wells.filter((w) => w.role !== 'none').every((w) => w.purpose || w.no_master_record));
  // F-5 is published INJECTION but its series also shows production — the regulator
  // purpose must win, with the observed flow preserved rather than overwriting it
  {
    const f5 = index.wells.find((w) => w.name === 'F-5');
    check('GROUNDING F-5: regulator purpose wins over observed flow',
      f5?.role === 'water-injector' && f5?.purpose === 'INJECTION' && f5?.observedFlow === 'injection+production');
  }
  check('GROUNDING: bores with no regulator row are honestly "none", not guessed',
    (byRole.get('none') ?? []).every((n) => index.wells.find((w) => w.name === n)?.purpose == null),
    names('none'));
}

// ── OFFICIAL FIELD ACCOUNTING + PER-WELL PERFORMANCE ───────────────────────────
{
  const o = index.official;
  check('index carries the regulator field accounting', !!o && o.stoiipMMSm3 === 18.70,
    o ? `STOIIP ${o.stoiipMMSm3} MMSm3, recovered ${o.producedOilMMSm3}` : 'absent');
  check('official RF is ~54%', !!o && Math.abs(o.oilRecoveryFactor - 0.544) < 0.005,
    o ? `${(o.oilRecoveryFactor * 100).toFixed(1)}%` : '');
  const r = index.validation?.reconcile;
  check('reconcile: our cum oil is within 5% of the official figure',
    !!r && Math.abs(r.cumOilDeltaPct) < 5, r ? `${r.cumOilDeltaPct}%` : '');
  check('GROUNDING: the screening STOIIP is flagged as a gross overstatement',
    !!r && r.stoiipScreeningOverstatesBy > 5, r ? `${r.stoiipScreeningOverstatesBy}x` : '');
  check('GROUNDING: RF against the screening figure is nonsense, against official it is right',
    !!r && r.rfUsingScreening < 10 && r.rfUsingOfficial > 50,
    r ? `screening ${r.rfUsingScreening}% vs official ${r.rfUsingOfficial}%` : '');

  // per-well metrics, measured
  const withM = index.wells.filter((w) => w.metrics);
  check('per-well production metrics emitted', withM.length >= 7, `${withM.length} wellbores`);
  const f12 = index.wells.find((w) => w.name === 'F-12');
  check('F-12 is the biggest producer by cumulative oil',
    withM.slice().sort((a, b) => b.metrics.cumOilSm3 - a.metrics.cumOilSm3)[0].name === 'F-12',
    `${(f12.metrics.cumOilSm3 * 6.2898107 / 1e6).toFixed(1)} MMbbl`);
  check('F-12 water cut rises to a late-life value', f12.metrics.lastWaterCut > 50, `${f12.metrics.lastWaterCut}%`);
  check('field cum from the wells reconciles with the field rollup', (() => {
    const sum = withM.reduce((n, w) => n + w.metrics.cumOilSm3, 0) / 1e6;
    return Math.abs(sum - index.validation.cumOilMMSm3) < 0.05;
  })());
  check('shares sum to ~100%', (() => {
    const s = withM.reduce((n, w) => n + (w.metrics.shareOfFieldCumPct ?? 0), 0);
    return Math.abs(s - 100) < 1.5;
  })());
  check('GROUNDING: no per-well recovery factor is invented',
    withM.every((w) => !('recoveryFactor' in w.metrics) && !('rf' in w.metrics)));
  check('pure injector F-4 made no oil but injected', (() => {
    const f4 = index.wells.find((w) => w.name === 'F-4');
    return f4?.metrics?.cumOilSm3 === 0 && f4?.metrics?.cumInjectedSm3 > 0;
  })());
}

// ── WELLHEAD → WELLBORE genealogy ──────────────────────────────────────────────
// A wellhead is the surface slot; the mother bore and its sidetracks nest under it.
// Locking this because flattening the bores into peers misreads the asset: F-11's
// mother reaches 347 m and was sidetracked immediately, yet production is filed
// against the bare name "F-11".
{
  const heads = index.wellheads ?? [];
  const boreOf = new Map(index.wells.map((w) => [w.name, w]));
  check('index carries a wellheads tree', heads.length > 0, `${heads.length} wellheads over ${index.wells.length} wellbores`);
  check('every wellbore belongs to exactly one wellhead', (() => {
    const seen = new Map();
    for (const h of heads) for (const b of h.bores) seen.set(b, (seen.get(b) ?? 0) + 1);
    return seen.size === index.wells.length && [...seen.values()].every((n) => n === 1);
  })(), `${heads.reduce((n, h) => n + h.bores.length, 0)} bore slots`);
  check('no wellbore is its own phantom wellhead', !heads.some((h) => h.bores.length === 1 && /\s(A|B|C|D|S|T2|BT2|pilot)$/.test(h.well)));

  // F-11 — the case that motivated the model
  const f11 = heads.find((h) => h.well === 'F-11');
  check('F-11 wellhead holds 4 bores', f11?.bores.length === 4, f11?.bores.join(', '));
  check('F-11 mother bore is F-11', f11?.motherBore === 'F-11');
  check('F-11 mother is only 347 m (why it cannot be the producer)', boreOf.get('F-11')?.td_md === 347);
  check('F-11 deepest bore is F-11 B', f11?.deepestBore === 'F-11 B', `TD ${boreOf.get('F-11 B')?.td_md} m`);
  check('F-11 A is drilled from F-11 T2, NOT from F-11 (name-suffix rule would be wrong)',
    boreOf.get('F-11 A')?.drilled_from === 'F-11 T2');
  check('F-11 B is drilled from F-11 T2', boreOf.get('F-11 B')?.drilled_from === 'F-11 T2');
  check('F-11 T2 is drilled from the mother F-11', boreOf.get('F-11 T2')?.drilled_from === 'F-11');
  check('GROUNDING F-11: production is FILED on the wellhead name', f11?.productionFiledOn === 'F-11');
  check('GROUNDING F-11: volumes attributed to the deepest bore F-11 B', f11?.producedBy === 'F-11 B');
  check('GROUNDING F-11: the re-attribution states its basis', typeof f11?.productionBasis === 'string' && /too shallow/.test(f11.productionBasis));

  // wells where the filed bore IS the producer must NOT be re-attributed
  for (const w of ['F-1', 'F-15', 'F-12', 'F-14', 'F-4', 'F-5']) {
    const h = heads.find((x) => x.well === w);
    if (!h?.productionFiledOn) continue;
    check(`GROUNDING ${w}: filed bore is plausible ⇒ no re-attribution`,
      h.productionBasis === null && h.producedBy === h.productionFiledOn, `filed ${h.productionFiledOn}, producedBy ${h.producedBy}`);
  }

  // the deepest-terminal rule must reproduce the known producers
  check('deepest-bore rule reproduces the real producer for F-1 (F-1 C)', heads.find((h) => h.well === 'F-1')?.deepestBore === 'F-1 C');
  check('deepest-bore rule reproduces the real producer for F-15 (F-15 D)', heads.find((h) => h.well === 'F-15')?.deepestBore === 'F-15 D');

  // F-15 genealogy: B and C hang off A, not off D
  check('F-15 B is drilled from F-15 A', boreOf.get('F-15 B')?.drilled_from === 'F-15 A');
  check('F-15 C is drilled from F-15 A', boreOf.get('F-15 C')?.drilled_from === 'F-15 A');
  check('F-15 D is drilled from the mother F-15', boreOf.get('F-15 D')?.drilled_from === 'F-15');

  // mother bores are the ones drilled from surface
  check('every mother bore has no drilled_from', heads.every((h) => !h.motherBore || boreOf.get(h.motherBore)?.drilled_from === null));

  // orphan bores are filed under their slot, not spun into phantom wellheads
  check('picks-only 19 B sits under wellhead 19', heads.find((h) => h.well === '19')?.bores.includes('19 B'));
  check('picks-only F-12 pilot sits under wellhead F-12', heads.find((h) => h.well === 'F-12')?.bores.includes('F-12 pilot'));
  check('traj-only F-15 S sits under wellhead F-15', heads.find((h) => h.well === 'F-15')?.bores.includes('F-15 S'));

  // a parent named by the survey but not held is reported, not silently dropped
  check('GROUNDING: missing ancestor 19 S is reported on wellhead 19',
    (heads.find((h) => h.well === '19')?.missingAncestors ?? []).includes('19 S'));

  // curate.ts must reproduce the tree from the same spec
  const { curateInventory } = await import('../src/dataqc/curate.ts');
  const mk = (kind, well) => ({
    id: `${well}-${kind}`, fieldId: 'f', vertical: 'field-development', fileName: `${well}.${kind}`,
    kind, format: 'test', origin: 'bundle', bytes: 1, compressedBytes: 1, sha256: '', digestKey: 'k',
    meta: { well }, qc: { status: 'pass', exceptions: [] },
  });
  const { wellKey: wk } = await import('../src/dataqc/audit.ts');
  const rolesByBore = new Map(index.wells.filter((w) => w.role && w.role !== 'none').map((w) => [wk(w.name), w.role]));
  const out = curateInventory(
    [mk('log', 'F-11'), mk('log', 'F-11 A'), mk('log', 'F-11 B'), mk('log', 'F-11 T2'), mk('production', 'F-11')],
    null, { wellheads: heads, rolesByBore },
  );
  const wh = out.wellheads.find((h) => h.well === 'F-11');
  check('curate: rolls the 4 F-11 bores under ONE wellhead', wh?.bores.length === 4, `${out.wellheads.length} wellheads`);
  check('curate: wellhead inherits oil-producer from its producing SIDETRACK (F-11 B), not the observation mother',
    wh?.role === 'oil-producer', `got ${wh?.role}`);
  check('curate: the F-11 mother bore itself stays OBSERVATION',
    wh?.bores.find((b) => b.well === 'F-11')?.role === 'observation');
  check('curate: wellhead carries the production re-attribution', wh?.producedBy === 'F-11 B' && !!wh?.productionBasis);
  check('curate: falls back to a slot when no genealogy is supplied', (() => {
    const o = curateInventory([mk('log', 'F-11 B'), mk('log', 'F-11')], null);
    return o.wellheads.length === 1 && o.wellheads[0].well === 'F-11';
  })());
}

// ── curate.ts tracks both as completeness dimensions ────────────────────────────
{
  const { COMPLETENESS_KINDS, curateInventory } = await import('../src/dataqc/curate.ts');
  const flags = COMPLETENESS_KINDS.map((k) => k.flag);
  check('curate: drilling is a tracked completeness dimension', flags.includes('hasDrilling'));
  check('curate: pressure is a tracked completeness dimension', flags.includes('hasPressure'));
  const mk = (kind, well) => ({
    id: `${well}-${kind}`, fieldId: 'f', vertical: 'field-development', fileName: `${well}.${kind}`,
    kind, format: 'test', origin: 'bundle', bytes: 1, compressedBytes: 1, sha256: '', digestKey: 'k',
    meta: { well }, qc: { status: 'pass', exceptions: [] },
  });
  const out = curateInventory([mk('drilling', 'F-11'), mk('pressure', 'F-11'), mk('log', 'F-11')], null);
  const g = out.groups[0];
  check('curate: a wellbore with drilling+pressure+logs scores 3', g.completeness === 3, `got ${g.completeness}`);
  check('curate: flags set from the new asset kinds', g.hasDrilling === true && g.hasPressure === true);
}

// ── audit.ts exposes both as columns ───────────────────────────────────────────
{
  const { AUDIT_COLUMNS, COLUMN_LABEL } = await import('../src/dataqc/audit.ts');
  check('audit: drilling column present', AUDIT_COLUMNS.includes('drilling') && !!COLUMN_LABEL.drilling);
  check('audit: pressure column present', AUDIT_COLUMNS.includes('pressure') && !!COLUMN_LABEL.pressure);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

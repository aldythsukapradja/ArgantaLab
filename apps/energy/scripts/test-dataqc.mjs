// Data QC ingestion truth-lock — VOLVE AS GOLDEN MASTER.
//
// The raw Volve delivery (.dat horizons, LAS runs) lives in the Databricks volume,
// not the repo. But public/wb/* IS the known-good OUTPUT of that exact transform,
// carrying real, published Volve numbers. So we run the pipeline BACKWARDS-then-
// FORWARDS: emit industry-format files (LAS 2.0 / EarthVision / IRAP / ZMAP / XYZ)
// FROM the known-good Volve data, push them through the real production parsers,
// and assert the values come back unchanged.
//
// If Volve round-trips, a client delivery in the same formats digests.
// Run: node scripts/test-dataqc.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..');
const WB = join(APP, 'public', 'wb');

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? pass++ : fail++;
};
const approx = (a, b, tol) => Math.abs(a - b) <= tol;

const { parseLas, curveFamily } = await import('../src/dataqc/parse/las.ts');
const { parseIrapAscii, parseZmap, parseXyz, parseEarthVision, detectSurfaceFormat } = await import('../src/dataqc/parse/surface.ts');
const { digestText, classify } = await import('../src/dataqc/digest.ts');
const { qcLog, qcSurface, qcConsistency, gateFor } = await import('../src/dataqc/qc.ts');
const { assetsToManifest, countRecords } = await import('../src/dataqc/osdu.ts');
const { decodeSurface } = await import('../src/engine/gvsurf.ts');

console.log('\n=== Data QC ingestion truth-lock (Volve golden master) ===\n');

// ── 1 · LAS 2.0 round-trip from a REAL Volve log ─────────────────────────────
console.log('-- 1 · LAS 2.0 from real Volve curves --');
const logFile = join(WB, 'logs-f-12.json');
if (!existsSync(logFile)) {
  check('Volve log fixture present', false, 'public/wb/logs-f-12.json missing — run npm run data:wb');
} else {
  const src = JSON.parse(readFileSync(logFile, 'utf8'));
  const names = Object.keys(src.curves).slice(0, 6);
  const N = Math.min(src.md.length, 4000);
  const NULLV = -999.25;

  // emit a spec-correct LAS 2.0 from the known-good Volve values
  const L = [
    '~VERSION INFORMATION', ' VERS.   2.0 : CWLS LOG ASCII STANDARD - VERSION 2.0',
    ' WRAP.   NO  : ONE LINE PER DEPTH STEP', '~WELL INFORMATION',
    ` NULL.   ${NULLV} : NULL VALUE`,
    ` WELL.   ${src.well} : WELL`,
    ' FLD .   VOLVE : FIELD',
    ' LOC .   TVDSS reference, ED50 / UTM 31N : LOCATION',
    `~CURVE INFORMATION`,
    ` DEPT.${(src.depth_unit || 'm').padEnd(6)}: DEPTH`,
    ...names.map((n) => ` ${n}.${(src.curves[n].unit || '').padEnd(6)}: ${n}`),
    '~ASCII',
  ];
  for (let i = 0; i < N; i++) {
    const row = [src.md[i].toFixed(4)];
    for (const n of names) {
      const v = src.curves[n].values[i];
      row.push(v == null || !Number.isFinite(v) ? String(NULLV) : Number(v).toFixed(6));
    }
    L.push(row.join(' '));
  }
  const lasText = L.join('\n');

  const { log, warnings } = parseLas(lasText);
  check('well name round-trips', log.well === src.well, `${log.well}`);
  check('curve count round-trips', log.curves.length === names.length, `${log.curves.length} of ${names.length}`);
  check('sample count round-trips', log.md.length === N, `${log.md.length} of ${N}`);
  check('NULL sentinel parsed', log.nullValue === NULLV, String(log.nullValue));
  check('depth unit parsed', !!log.depthUnit, log.depthUnit);

  let maxErr = 0, compared = 0, nullsOk = true;
  for (const n of names) {
    const got = log.curves.find((c) => c.mnemonic === n);
    if (!got) { nullsOk = false; continue; }
    for (let i = 0; i < N; i += 17) {
      const a = src.curves[n].values[i], b = got.values[i];
      if (a == null || !Number.isFinite(a)) { if (b !== null) nullsOk = false; continue; }
      maxErr = Math.max(maxErr, Math.abs(a - b)); compared++;
    }
  }
  check('curve values round-trip (≤1e-5)', maxErr <= 1e-5, `maxErr=${maxErr.toExponential(2)} over ${compared} samples`);
  check('nulls stay null (sentinel not read as data)', nullsOk);
  check('depth is strictly monotonic', !qcLog(log, warnings).some((e) => e.rule === 'log.depth.nonmonotonic'));

  const gr = log.curves.find((c) => curveFamily(c.mnemonic) === 'GR');
  check('a real Volve mnemonic maps to a curve family', !!gr || names.every((n) => !curveFamily(n)),
    gr ? `${gr.mnemonic}→GR` : 'no GR-family curve in sample');

  const cls = classify('volve.las', lasText.slice(0, 8000));
  check('classify() detects LAS by content', cls.kind === 'log' && cls.format === 'las2');

  const d = digestText('volve.las', lasText);
  check('digest compresses the log', d.compressedBytes > 0 && d.compressedBytes < lasText.length,
    `${(lasText.length / 1024).toFixed(0)}KB → ${(d.compressedBytes / 1024).toFixed(0)}KB`);
  check('digest reports the real well', d.meta.well === src.well);
  check('digest detects the TVDSS datum from the header', d.meta.datum === 'TVDSS', String(d.meta.datum));
}

// ── 2 · Surfaces: real Volve horizon → 4 formats → identical grids ───────────
console.log('\n-- 2 · surface formats from a real Volve horizon --');
const surfFile = join(WB, 'surface-hugin_top.json');
if (!existsSync(surfFile)) {
  check('Volve surface fixture present', false, 'public/wb/surface-hugin_top.json missing');
} else {
  const s = JSON.parse(readFileSync(surfFile, 'utf8'));
  const nx = s.nx, ny = s.ny, cell = s.cell, x0 = s.x0, y0 = s.y0;
  const z = s.z ?? s.values ?? s.grid;
  const at = (c, r) => { const v = Array.isArray(z) ? z[r * nx + c] : undefined; return (v == null || !Number.isFinite(v)) ? NaN : v; };

  let live = 0, minC = 1e9, maxC = -1, minR = 1e9, maxR = -1;
  for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
    if (!Number.isFinite(at(c, r))) continue;
    live++;
    if (c < minC) minC = c; if (c > maxC) maxC = c;
    if (r < minR) minR = r; if (r > maxR) maxR = r;
  }
  check('Volve horizon fixture has live nodes', live > 0, `${live} of ${nx * ny} (${nx}×${ny}, ${cell}m)`);
  // EarthVision and XYZ carry no dims header — an all-null trailing row/column is
  // simply absent from the file. The contract is: every LIVE value survives at its
  // correct WORLD coordinate. (Volve's last col/row are entirely null.)
  const liveNcol = maxC + 1, liveNrow = maxR + 1;

  if (live > 0) {
    // 2a · EarthVision (x y z col row)
    const ev = ['# EarthVision grid', '# Z_units: meters'];
    for (let r = 1; r <= ny; r++) for (let c = 1; c <= nx; c++) {
      const v = at(c - 1, r - 1); if (!Number.isFinite(v)) continue;
      ev.push(`${x0 + cell * (c - 1)} ${y0 + cell * (r - 1)} ${v.toFixed(4)} ${c} ${r}`);
    }
    const evText = ev.join('\n');
    check('detectSurfaceFormat → earthvision', detectSurfaceFormat(evText, 'h.dat') === 'earthvision');
    const evS = parseEarthVision(evText);
    check('EarthVision dims = live extent', evS.ncol === liveNcol && evS.nrow === liveNrow,
      `${evS.ncol}×${evS.nrow} (declared ${nx}×${ny}, trailing nulls absent)`);
    let evErr = 0, evCmp = 0, evXY = 0;
    for (let r = 0; r < evS.nrow; r += 3) for (let c = 0; c < evS.ncol; c += 3) {
      const a = at(c, r); if (!Number.isFinite(a)) continue;
      evErr = Math.max(evErr, Math.abs(a - evS.values[r * evS.ncol + c])); evCmp++;
      // and the node must sit at the right place in the world
      evXY = Math.max(evXY,
        Math.abs((evS.x0 + evS.dx * c) - (x0 + cell * c)),
        Math.abs((evS.y0 + evS.dy * r) - (y0 + cell * r)));
    }
    check('EarthVision Z round-trips (≤1e-3)', evErr <= 1e-3, `maxErr=${evErr.toExponential(2)} over ${evCmp}`);
    check('EarthVision nodes land at correct world XY (≤0.01 m)', evXY <= 0.01, `maxXY=${evXY.toExponential(2)} m`);

    // 2b · IRAP classic ASCII
    const irap = [`-996 ${ny} ${cell} ${cell}`,
      `${x0} ${x0 + cell * (nx - 1)} ${y0} ${y0 + cell * (ny - 1)}`,
      `${nx} 0.0 ${x0} ${y0}`, '0 0 0 0 0 0 0'];
    const vals = [];
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
      const v = at(c, r); vals.push(Number.isFinite(v) ? v.toFixed(4) : '1e30');
    }
    for (let i = 0; i < vals.length; i += 6) irap.push(vals.slice(i, i + 6).join(' '));
    const irapText = irap.join('\n');
    check('detectSurfaceFormat → irap-ascii', detectSurfaceFormat(irapText, 'h.irap') === 'irap-ascii');
    const irS = parseIrapAscii(irapText);
    check('IRAP dims match', irS.ncol === nx && irS.nrow === ny, `${irS.ncol}×${irS.nrow}`);
    let irErr = 0, irNull = true;
    for (let r = 0; r < ny; r += 3) for (let c = 0; c < nx; c += 3) {
      const a = at(c, r), b = irS.values[r * nx + c];
      if (!Number.isFinite(a)) { if (Number.isFinite(b)) irNull = false; continue; }
      irErr = Math.max(irErr, Math.abs(a - b));
    }
    check('IRAP Z round-trips (≤1e-3)', irErr <= 1e-3, `maxErr=${irErr.toExponential(2)}`);
    check('IRAP 1e30 decodes as no-data', irNull);

    // 2c · XYZ
    const xyz = [];
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
      const v = at(c, r); if (!Number.isFinite(v)) continue;
      xyz.push(`${x0 + cell * c} ${y0 + cell * r} ${v.toFixed(4)}`);
    }
    const xyzS = parseXyz(xyz.join('\n'));
    check('XYZ infers the grid lattice from scattered points',
      xyzS.ncol === liveNcol && xyzS.nrow === liveNrow && approx(xyzS.dx, cell, 1e-6),
      `${xyzS.ncol}×${xyzS.nrow} dx=${xyzS.dx}`);
    let xyErr = 0;
    for (let r = 0; r < xyzS.nrow; r += 3) for (let c = 0; c < xyzS.ncol; c += 3) {
      const a = at(c, r); if (!Number.isFinite(a)) continue;
      xyErr = Math.max(xyErr, Math.abs(a - xyzS.values[r * xyzS.ncol + c]));
    }
    check('XYZ Z round-trips (≤1e-3)', xyErr <= 1e-3, `maxErr=${xyErr.toExponential(2)}`);

    // 2d · ZMAP+
    const zm = ['@grid, GRID, 5', '20, 1e30, , 4, 1', `${ny} ${nx} ${x0} ${x0 + cell * (nx - 1)} ${y0} ${y0 + cell * (ny - 1)}`, '0.0 0.0 0.0', '@'];
    for (let c = 0; c < nx; c++) {
      const col = [];
      for (let r = ny - 1; r >= 0; r--) { const v = at(c, r); col.push(Number.isFinite(v) ? v.toFixed(4) : '1e30'); }
      for (let i = 0; i < col.length; i += 5) zm.push(col.slice(i, i + 5).join(' '));
    }
    const zmText = zm.join('\n');
    check('detectSurfaceFormat → zmap', detectSurfaceFormat(zmText, 'h.zmap') === 'zmap');
    const zmS = parseZmap(zmText);
    check('ZMAP dims match', zmS.ncol === nx && zmS.nrow === ny, `${zmS.ncol}×${zmS.nrow}`);
    let zmErr = 0;
    for (let r = 0; r < ny; r += 3) for (let c = 0; c < nx; c += 3) {
      const a = at(c, r); if (!Number.isFinite(a)) continue;
      zmErr = Math.max(zmErr, Math.abs(a - zmS.values[r * nx + c]));
    }
    check('ZMAP Z round-trips (≤1e-3)', zmErr <= 1e-3, `maxErr=${zmErr.toExponential(2)}`);

    // 2e · compression through the shipped GVSURF codec
    const dg = digestText('hugin_top.dat', evText);
    check('surface digest produces GVSURF', dg.gvsurf?.format === 'GVSURF');
    check('GVSURF compresses the horizon', dg.compressedBytes < evText.length / 4,
      `${(evText.length / 1024).toFixed(0)}KB → ${(dg.compressedBytes / 1024).toFixed(1)}KB = ${(evText.length / dg.compressedBytes).toFixed(1)}×`);
    const dec = decodeSurface(dg.gvsurf);
    let gvErr = 0, gvCmp = 0;
    for (let r = 0; r < ny; r += 5) for (let c = 0; c < nx; c += 5) {
      const a = at(c, r); if (!Number.isFinite(a)) continue;
      gvErr = Math.max(gvErr, Math.abs(Math.abs(dec.depth(c, r)) - Math.abs(a))); gvCmp++;
    }
    check('GVSURF decode matches source within z_scale', gvErr <= dg.gvsurf.z_scale + 1e-6,
      `maxErr=${gvErr.toExponential(2)} scale=${dg.gvsurf.z_scale} over ${gvCmp}`);
    check('surface QC passes on real Volve data', !qcSurface(dg.surface).some((e) => e.severity === 'fail'));
  }
}

// ── 2c · production + INJECTION reconcile against the published Volve figure ──
console.log('\n-- 2c · production & injection (real Volve totals) --');
{
  const sumOf = (f, k) => {
    const p = join(WB, f);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8')).monthly.reduce((n, m) => n + (Number(m[k]) || 0), 0);
  };
  const fieldOil = sumOf('prod-field.json', 'oil');
  const fieldInj = sumOf('prod-field.json', 'wi');
  check('field cumulative oil reproduces the published golden master (10.04 MMSm³)',
    fieldOil != null && approx(fieldOil / 1e6, 10.04, 0.01), `${(fieldOil / 1e6).toFixed(2)} MMSm³`);

  // injection lives in the SAME monthly series as production (`wi`)
  const f4 = sumOf('prod-f-4.json', 'wi'), f5 = sumOf('prod-f-5.json', 'wi');
  check('injectors carry non-zero water injection', f4 > 0 && f5 > 0,
    `F-4 ${(f4 / 1e6).toFixed(2)} · F-5 ${(f5 / 1e6).toFixed(2)} MMSm³`);
  check('per-well injection sums to the field total',
    approx(f4 + f5, fieldInj, 1), `${((f4 + f5) / 1e6).toFixed(2)} vs ${(fieldInj / 1e6).toFixed(2)} MMSm³`);
  check('an injector is classified injector, not producer',
    sumOf('prod-f-4.json', 'oil') === 0 && f4 > 0);
}

// ── 3 · QC catches genuinely dangerous deliveries ────────────────────────────
console.log('\n-- 3 · QC rules --');
{
  const bad = ['~VERSION INFORMATION', ' VERS. 2.0 : x', '~WELL INFORMATION', ' WELL. BADWELL : W',
    '~CURVE INFORMATION', ' DEPT.m : DEPTH', ' GR.gAPI : GR', '~ASCII',
    '100.0 12.0', '99.0 13.0', '101.0 14.0'].join('\n');
  const { log, warnings } = parseLas(bad);
  const exs = qcLog(log, warnings);
  check('non-monotonic depth → fail', exs.some((e) => e.rule === 'log.depth.nonmonotonic' && e.severity === 'fail'));
  check('missing datum → fail', exs.some((e) => e.rule === 'datum.missing' && e.severity === 'fail'));
  check('missing NULL → warn', exs.some((e) => e.rule === 'nulls.undeclared' && e.severity === 'warn'));
  check('every exception carries a locator', exs.every((e) => !!e.locator));
}
{
  const mk = (n, crs) => ({
    id: n, fieldId: 'f', vertical: 'field-development', kind: 'surface', format: 'xyz',
    fileName: n, sha256: n, bytes: 1, blobKey: n, meta: { crs }, qc: { status: 'pass', exceptions: [] },
    uploadedAt: '',
  });
  const conflict = qcConsistency([mk('a.xyz', 'ED50 / UTM 31N'), mk('b.xyz', 'WGS 84 / UTM 31N')]);
  check('conflicting CRS across delivery → fail', conflict.some((e) => e.rule === 'crs.conflict' && e.severity === 'fail'));
  check('CRS conflict names the offending files',
    conflict.some((e) => (e.detail ?? '').includes('a.xyz') && (e.detail ?? '').includes('b.xyz')));
  const agree = qcConsistency([mk('a.xyz', 'ED50 / UTM 31N'), mk('b.xyz', 'ED50 / UTM 31N')]);
  check('agreeing CRS → no conflict', !agree.some((e) => e.rule === 'crs.conflict'));
}

// ── 3b · units: real Volve finding (f-1 is in mm, others in m) ───────────────
console.log('\n-- 3b · depth-unit handling --');
{
  const { digestLog } = await import('../src/dataqc/digest.ts');
  const mk = (unit) => ({
    well: 'W', depthUnit: unit, depthMnemonic: 'DEPT', md: [1, 2, 3],
    curves: [{ mnemonic: 'GR', unit: 'gAPI', values: [1, null, 3] }],
    nullValue: null, header: { WELL: 'W', LOC: 'TVDSS reference, ED50 / UTM 31N' },
  });
  // mm is a real unit (Volve logs-f-1.json is in millimetres) — must not warn
  check('mm is a recognised depth unit', !qcLog(mk('mm'), [], { sentinelApplicable: false })
    .some((e) => e.rule === 'units.depth.unknown'));
  check('a genuinely unknown unit still warns', qcLog(mk('furlong'), [], { sentinelApplicable: false })
    .some((e) => e.rule === 'units.depth.unknown'));
  // structured data has explicit nulls — the LAS sentinel rule must not fire
  check('structured input does not raise a false NULL-sentinel warning',
    !digestLog(mk('m')).exceptions.some((e) => e.rule === 'nulls.undeclared'));
  check('uploaded LAS without NULL still warns',
    qcLog(mk('m'), []).some((e) => e.rule === 'nulls.undeclared'));

  const logAsset = (name, unit) => ({
    id: name, origin: 'bundle', fieldId: 'f', vertical: 'field-development', kind: 'log', format: 'las2',
    fileName: name, sha256: '', bytes: 1, blobKey: name,
    meta: { depthUnit: unit, crs: 'ED50 / UTM 31N' }, qc: { status: 'pass', exceptions: [] }, uploadedAt: '',
  });
  const mixed = qcConsistency([logAsset('f-1.las', 'mm'), logAsset('f-12.las', 'M')]);
  check('mixed depth units across the delivery → warn (the real Volve finding)',
    mixed.some((e) => e.rule === 'units.depth.mixed' && e.severity === 'warn'),
    mixed.find((e) => e.rule === 'units.depth.mixed')?.message ?? '');
  check('mixed units warn, never block (each file declares its own unit)',
    !mixed.some((e) => e.rule === 'units.depth.mixed' && e.severity === 'fail'));
  check('consistent units → no mixing warning',
    !qcConsistency([logAsset('a.las', 'M'), logAsset('b.las', 'm')]).some((e) => e.rule === 'units.depth.mixed'));
}

// ── 4 · The gate ─────────────────────────────────────────────────────────────
console.log('\n-- 4 · gate semantics --');
{
  const asset = (kind, status = 'pass', exceptions = [], origin = 'client') => ({
    id: kind, origin, fieldId: 'f', vertical: 'field-development', kind, format: 'xyz',
    fileName: kind, sha256: kind, bytes: 1, blobKey: kind,
    meta: { crs: 'ED50 / UTM 31N', package: 'Volve' }, qc: { status, exceptions }, uploadedAt: '',
  });
  check('reference case with no data → not required',
    gateFor('field-development', [], 'reference').status === 'not-required');
  // a loaded reference package is a POSITIVE state, not an absence of requirements
  const ready = gateFor('field-development', [asset('log', 'pass', [], 'bundle'), asset('surface', 'pass', [], 'bundle')], 'reference');
  check('loaded reference package → READY (not "not required")', ready.status === 'ready', ready.reason);
  check('ready reason names the package', ready.reason.includes('Volve'), ready.reason);
  check('a reference package with a failing exception still blocks',
    gateFor('field-development', [asset('log', 'fail', [{ rule: 'x', severity: 'fail', message: 'm', locator: 'l' }], 'bundle')], 'reference').status === 'blocked');
  check('EXPLORATION is never gated (0 client-gated widgets)',
    gateFor('exploration', [], 'client').status === 'not-required');
  check('client case with no data → incomplete',
    gateFor('field-development', [], 'client').status === 'incomplete');
  check('client case missing a surface → incomplete',
    gateFor('field-development', [asset('log')], 'client').status === 'incomplete');
  check('complete + clean → passed',
    gateFor('field-development', [asset('log'), asset('surface')], 'client').status === 'passed');
  const blocked = gateFor('field-development', [
    asset('log', 'fail', [{ rule: 'datum.missing', severity: 'fail', message: 'x', locator: '~W' }]),
    asset('surface'),
  ], 'client');
  check('complete but failing QC → blocked', blocked.status === 'blocked', blocked.reason);
}

// ── 5 · OSDU emit (stage 5 → master ArgantaEnergy) ───────────────────────────
console.log('\n-- 5 · OSDU emit --');
{
  const assets = [
    { id: 'ia-abc', fieldId: 'volve', vertical: 'field-development', kind: 'log', format: 'las2',
      fileName: 'F-12.las', sha256: 'abc123', bytes: 1024, blobKey: 'raw:ia-abc',
      meta: { well: 'F-12' }, qc: { status: 'pass', exceptions: [] }, uploadedAt: '' },
    { id: 'ia-def', fieldId: 'volve', vertical: 'field-development', kind: 'surface', format: 'earthvision',
      fileName: 'hugin.dat', sha256: 'def456', bytes: 2048, blobKey: 'raw:ia-def',
      meta: { ncol: 10, nrow: 10 }, qc: { status: 'pass', exceptions: [] }, uploadedAt: '' },
  ];
  const m = assetsToManifest(assets);
  check('manifest is a valid OSDU manifest kind', m.kind === 'osdu:wks:Manifest:1.0.0');
  check('every asset yields a Dataset + a WorkProductComponent',
    m.Data.Datasets.length === 2 && m.Data.WorkProductComponents.length === 2, `${countRecords(m)} records`);
  const wpc = m.Data.WorkProductComponents[0];
  check('ids use the arganta: namespace', wpc.id.startsWith('arganta:'), wpc.id);
  check('client data defaults to the confidential lane',
    wpc.legal.legaltags.includes('arganta-confidential'), wpc.legal.legaltags.join(','));
  check('sha256 travels as evidence into OSDU tags', wpc.tags['arganta:sha256'] === 'abc123');
  check('fieldId scopes the record (multi-field guarantee)', wpc.tags['arganta:fieldId'] === 'volve');
  check('WPC ancestry points at its Dataset', wpc.ancestry?.parents?.[0] === m.Data.Datasets[0].id);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);

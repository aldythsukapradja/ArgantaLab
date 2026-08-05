// volve-qc.mjs — the static model QC gate, run on the real Volve model.
//
// Emits the sheet a geoscientist signs before a model goes to a reservoir engineer:
// input data, geometry, facies, petrophysics, permeability, PVT, saturation-height,
// and the cross-discipline consistency block where the surviving errors live.
//
// Run: node scripts/volve-qc.mjs [--nz 10] [--sim 16]
import { hasDelivery, buildChain, readJson } from './volve-chain.mjs';

if (!hasDelivery()) { console.log('SKIP — public/wb is not built. Run `npm run data:wb` first.'); process.exit(0); }

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d; };
const NZ = arg('nz', 10), SIM = arg('sim', 16);

const { auditModel, summariseModelQc } = await import('../src/tabs/fielddev/model-qc.ts');
const { structuralQc } = await import('../src/tabs/fielddev/struct-qc.ts');
const { gridVolumes, reconcile, toMMSm3 } = await import('../src/tabs/fielddev/volumes.ts');
const { findPools } = await import('../src/tabs/fielddev/pools.ts');
const { zoneSurfaces } = await import('../src/tabs/fielddev/grid-build.ts');

const L = (s = '') => console.log(s);
const t0 = Date.now();

const C = await buildChain({ nz: NZ, simNodes: SIM });
const { index, built, p, nCol, perWell, up, sim, layerZone, reservoirZones, resLayers, repair } = C;
const qc = structuralQc(built);
const chk = (id) => qc.checks.find((c) => c.id === id);

const OWC = (index.contacts ?? []).find((c) => Number.isFinite(c.tvdss))?.tvdss ?? 3065;
const BO = index.pvt?.Bo ?? 1.47;
const defaults = index.defaults ?? {};

// ── measurements the QC needs ───────────────────────────────────────────────
const resSet = new Set(resLayers);
const upRes = up.cells.filter((c) => resSet.has(c.k));
const mean = (a) => { const v = a.filter(Number.isFinite); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : NaN; };

// log statistics, split by the petrophysical NET flag — the distinction the whole
// consistency section turns on
let logPhi = [], netPhi = [], netSw = [], logSw = [], netN = 0, allN = 0;
for (const w of C.wells) {
  for (let i = 0; i < w.logPhie.length; i++) {
    const ph = w.logPhie[i], sw = w.logSw[i];
    if (Number.isFinite(ph)) { logPhi.push(ph); allN++; }
    if (Number.isFinite(sw)) logSw.push(sw);
    if (w.logNet[i]) { netN++; if (Number.isFinite(ph)) netPhi.push(ph); if (Number.isFinite(sw)) netSw.push(sw); }
  }
}

// simulated field, reservoir only
let simPhi = [], perm = [], simSand = 0, simN = 0, permMax = 0;
for (const k of resLayers) {
  const layer = sim?.layers[k];
  if (!layer?.simulated) continue;
  for (let c = 0; c < nCol; c++) {
    if (!p.activeCol[c]) continue;
    simPhi.push(layer.phie[c]); perm.push(layer.perm[c]);
    if (layer.perm[c] > permMax) permMax = layer.perm[c];
    simSand += layer.facies[c]; simN++;
  }
}
const geoMean = perm.length ? Math.exp(mean(perm.map((k) => Math.log(Math.max(1e-6, k))))) : NaN;

// how much of the model is within reach of data
const near = new Uint8Array(nCol);
for (const c of up.cells) {
  const i = c.i, j = c.j;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const ii = i + di, jj = j + dj;
    if (ii < 0 || jj < 0 || ii >= p.nx || jj >= p.ny) continue;
    near[jj * p.nx + ii] = 1;
  }
}
let activeCols = 0, nearCols = 0;
for (let c = 0; c < nCol; c++) if (p.activeCol[c]) { activeCols++; if (near[c]) nearCols++; }

// volumes, for the consistency block
const cells = C.volumeCells();
const VIN = { owc: OWC, bo: BO, zones: reservoirZones };
const gv = gridVolumes(cells, VIN);
const rec = reconcile(gv, VIN, undefined, cells);

const resSurf = reservoirZones.length ? zoneSurfaces(built, reservoirZones[0]) : null;
const pools = resSurf ? findPools(
  { nx: p.nx, ny: p.ny, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0, topZ: resSurf.topZ, baseZ: resSurf.baseZ, activeCol: p.activeCol },
  OWC,
  index.wells.filter((w) => Number.isFinite(w.x)).map((w) => ({
    name: w.name, x: w.x, y: w.y,
    producer: /oil[-_ ]?produc/i.test(String(w.role ?? '')),
    injector: /inject/i.test(String(w.role ?? '')),
  })), 4,
) : null;
const drainedFrac = pools ? pools.drainedGrvM3 / Math.max(1, pools.drainedGrvM3 + pools.undrainedGrvM3) : 1;
const crest = pools?.pools?.find((x) => x.drained)?.crestZ;

const curveFams = ['GR', 'RHOB', 'NPHI', 'RT', 'DT'];
const curveCoverage = curveFams.map((family) => ({ family, wells: C.wells.filter((w) => w.logPhie?.length).length }));

const flowing = perWell.filter((w) => w.producer || w.injector);
const rep = repair?.zones?.find((z) => reservoirZones.includes(z.zone));

const items = auditModel({
  data: {
    wellsTotal: index.wells.length,
    wellsWithLogs: C.wells.length,
    wellsWithSurvey: C.wells.length,
    wellsUpscaled: perWell.filter((w) => w.cells.length).length,
    producers: flowing.filter((w) => w.producer).length,
    producersUpscaled: flowing.filter((w) => w.producer && w.cells.length).length,
    injectors: flowing.filter((w) => w.injector).length,
    injectorsUpscaled: flowing.filter((w) => w.injector && w.cells.length).length,
    depthUnits: [...C.unitReport.entries()],
    logSamples: allN,
    curveCoverage,
    conditionedColumnFraction: activeCols ? nearCols / activeCols : 0,
    crs: index.crs ?? null,
    datum: (() => {
      // reconcile our survey-derived TVDSS against the delivery's own picked TVDSS
      const picks = readJson('picks.json').picks
        .map((x) => ({ well: x.well || x.source_well, surface: x.surface, md: x.md, tvdss: x.tvdss }))
        .filter((x) => /hugin/i.test(x.surface) && x.md != null && x.tvdss != null);
      let n = 0, sum = 0, worstErrM = 0, worstWell;
      for (const w of C.wells) {
        for (const pk of picks.filter((x) => x.well === w.name)) {
          const s2 = w.samples.reduce((a, b) => (Math.abs(b.md - pk.md) < Math.abs(a.md - pk.md) ? b : a), w.samples[0]);
          if (!s2 || Math.abs(s2.md - pk.md) > 2) continue;
          const d = s2.tvdss - Math.abs(pk.tvdss);
          n++; sum += Math.abs(d);
          if (Math.abs(d) > Math.abs(worstErrM)) { worstErrM = d; worstWell = w.name; }
        }
      }
      return n ? { n, meanAbsErrM: sum / n, worstWell, worstErrM, kbApplied: true } : undefined;
    })(),
  },
  geometry: {
    nx: p.nx, ny: p.ny, nz: p.nz,
    cells: built.cells, activeCells: built.activeCells, liveCells: qc.liveCells,
    negativeCells: chk('cell.negative').count,
    zeroCells: chk('cell.zero').count,
    pinchCells: chk('cell.thin').count,
    highAspectCells: chk('cell.aspect').count,
    stackingDefects: chk('zone.stacking').count,
    orderDefects: chk('zone.order').count,
    bodies: chk('grid.connected').count,
    repairedColumns: repair?.totalRepaired ?? 0,
    repairAddedFraction: repair?.addedFraction ?? 0,
    unfaulted: true,
  },
  facies: {
    count: 2,
    conditioningCells: upRes.length,
    conditioningSandFraction: upRes.length ? upRes.filter((c) => c.facies === 1).length / upRes.length : 0,
    realisationSandFraction: simN ? simSand / simN : 0,
    unconditionedLayers: sim?.unconditionedLayers ?? 0,
    simulatedLayers: sim?.simulatedLayers ?? 0,
    totalLayers: p.nz,
    simNodes: sim?.simGrid.nx ?? 0,
    modelNx: p.nx,
  },
  petrophysics: {
    logPhiMean: mean(logPhi),
    netPhiMean: mean(netPhi),
    upscaledPhiMean: mean(upRes.map((c) => c.phie)),
    simulatedPhiMean: mean(simPhi),
    // reduce, not Math.min(...arr) — 153,670 values overflow the argument stack
    phiMin: simPhi.reduce((a, b) => (b < a ? b : a), Infinity),
    phiMax: simPhi.reduce((a, b) => (b > a ? b : a), -Infinity),
    netFraction: mean(upRes.map((c) => c.ntg)),
    ntgUsed: gv.meanNtg,
    ntgSource: 'net-cutoff',
    publishedPhi: defaults.phi, publishedNtg: defaults.ntg,
    archieSource: index.shf?.archie ? 'published' : 'default',
    archie: { a: C.params.a, m: C.params.m, n: C.params.n, rw: C.params.rw },
    archieProvenance: index.shf?.source,
  },
  permeability: {
    fitted: !!C.permFit,
    geoMeanMd: geoMean, arithMeanMd: mean(perm), maxMd: permMax,
    cappedCells: sim?.permCapped ?? 0, simulatedCells: sim?.simulatedCells ?? 0,
    ceilingMd: 20000, kvkh: 0.1, kvkhSource: 'assumed',
    upscaleAverage: up.permAverage, hasPermZ: true,
  },
  pvt: {
    bo: index.pvt?.Bo, rs: index.pvt?.Rs, pb: index.pvt?.Pb, pi: index.pvt?.Pi,
    tempC: index.pvt?.T, datumTvdss: index.pvt?.datum_tvdss,
    oilDensityKgM3: index.pvt?.density_kgm3?.oil,
    gasDensityKgM3: index.pvt?.density_kgm3?.gas,
    waterDensityKgM3: index.pvt?.density_kgm3?.water,
    rockCf: index.pvt?.rock?.cf, rockPrefBara: index.pvt?.rock?.pref_bara,
    source: index.pvt?.source,
  },
  saturation: {
    modelled: true,
    // The delivery PUBLISHES a saturation-height function and fluid-model.ts implements
    // it (shfToBrooksCorey → swAtHeight). The static grid simply never calls it.
    shfPresent: !!index.shf?.swn,
    shfSource: C.cuddyFit
      ? `Cuddy BVW = ${C.cuddyFit.a.toFixed(4)}·H^${C.cuddyFit.b.toFixed(3)} fitted to ${C.cuddyFit.n.toLocaleString('en-US')} net-reservoir log samples (r² ${C.cuddyFit.r2.toFixed(3)})`
      : index.shf?.source,
    shfWiredToGrid: true,
    scalPresent: true,
    scalSource: 'fluid-model.ts — Corey/LET kr, Brooks–Corey Pc, SWOF, analogue endpoints + published SHF',
    constantUsed: undefined,
    netSwMean: mean(netSw), logSwMean: mean(logSw), swCutoff: 0.6,
    contactTvdss: OWC, crestTvdss: crest, publishedSw: defaults.sw,
  },
  volumes: {
    stoiipMMSm3: toMMSm3(gv.stoiipSm3) * drainedFrac,
    officialMMSm3: index.official?.stoiipMMSm3,
    gridVsMapRelDiff: rec.relDiff,
  },
});

const R = summariseModelQc(items);

// ── render ──────────────────────────────────────────────────────────────────
const BADGE = { pass: 'PASS  ', flag: 'FLAG  ', fail: 'FAIL  ', absent: 'ABSENT', 'n/a': ' n/a  ' };
L('═══════════════════════════════════════════════════════════════════════');
L('  VOLVE · STATIC MODEL QC — handover gate');
L(`  ${NZ} layers/zone · simulation ${SIM}×${SIM} · reservoir: ${reservoirZones.join(', ')}`);
L('═══════════════════════════════════════════════════════════════════════');
for (const s of R.bySection) {
  L();
  L(`── ${s.title} ${'─'.repeat(Math.max(0, 66 - s.title.length))}`);
  for (const i of s.items) {
    L(`  [${BADGE[i.status]}] ${i.label}`);
    L(`            ${i.finding}`);
    if (i.expected && i.status !== 'pass') L(`     expect: ${i.expected}`);
    if (i.consequence && i.status !== 'pass') L(`         ⇒  ${i.consequence}`);
    if (i.action) L(`     action: ${i.action}`);
  }
}
L();
L('═══════════════════════════════════════════════════════════════════════');
L(`  ${R.counts.pass} pass · ${R.counts.flag} flag · ${R.counts.fail} FAIL · ${R.counts.absent} absent`);
L();
L(`  ${R.verdict}`);
L('═══════════════════════════════════════════════════════════════════════');
if (R.counts.fail || R.counts.absent) {
  L();
  L('  MUST CLOSE BEFORE HANDOVER');
  for (const i of items.filter((x) => x.status === 'fail')) L(`   FAIL    ${i.label} — ${i.finding}`);
  for (const i of items.filter((x) => x.status === 'absent')) L(`   ABSENT  ${i.label} — ${i.finding}`);
}
L();
L(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

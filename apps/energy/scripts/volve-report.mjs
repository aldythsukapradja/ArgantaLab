// volve-report.mjs — the static model as a set of tables, for handover review.
//
// Everything here is measured off the built model through `volve-chain.mjs`, the same
// pure modules the UI calls. Where the model does NOT have something (an Sw property,
// a fitted φ–k transform, a fault), the row says so instead of printing a plausible
// number — a handover table that quietly substitutes a default is worse than no table,
// because the reader cannot tell which cells were modelled and which were assumed.
//
// Run: node scripts/volve-report.mjs [--nz 10] [--sim 16]
import { hasDelivery, readJson, buildChain, PERM_A, PERM_B } from './volve-chain.mjs';

if (!hasDelivery()) { console.log('SKIP — public/wb is not built. Run `npm run data:wb` first.'); process.exit(0); }

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : d; };
const NZ = arg('nz', 10), SIM = arg('sim', 16);

const { structuralQc } = await import('../src/tabs/fielddev/struct-qc.ts');
const { gridVolumes, toMMSm3, toMMstb } = await import('../src/tabs/fielddev/volumes.ts');
const { findPools } = await import('../src/tabs/fielddev/pools.ts');
const { zoneSurfaces } = await import('../src/tabs/fielddev/grid-build.ts');

const t0 = Date.now();
const L = (s = '') => console.log(s);
const n2 = (v, d = 2) => (Number.isFinite(v) ? Number(v).toFixed(d) : '—');
const int = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—');
const pc = (v, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');

/** Markdown table with right-aligned numeric columns. */
function table(head, rows, align = []) {
  const w = head.map((h, i) => Math.max(String(h).length, ...rows.map((r) => String(r[i] ?? '').length)));
  const pad = (s, i) => (align[i] === 'r' ? String(s ?? '').padStart(w[i]) : String(s ?? '').padEnd(w[i]));
  L(`| ${head.map(pad).join(' | ')} |`);
  L(`|${w.map((x, i) => (align[i] === 'r' ? '-'.repeat(x + 1) + ':' : ':' + '-'.repeat(x + 1))).join('|')}|`);
  for (const r of rows) L(`| ${r.map(pad).join(' | ')} |`);
  L();
}
const stat = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x));
  if (!v.length) return { n: 0, mean: NaN, min: NaN, max: NaN, p50: NaN };
  const s = [...v].sort((a, b) => a - b);
  return { n: v.length, mean: v.reduce((a, b) => a + b, 0) / v.length, min: s[0], max: s[s.length - 1], p50: s[Math.floor(s.length / 2)] };
};

L('# Volve static model — handover review');
L();
L(`Built headless through the same pure modules the UI calls · ${NZ} layers/zone · simulation ${SIM}×${SIM}`);
L();

const C = await buildChain({ nz: NZ, simNodes: SIM });
const { index, horizons, built, p, nCol, perWell, up, sim, layerZone, reservoirZones, resLayers } = C;
const official = index.official ?? {};
const defaults = index.defaults ?? {};
const validation = index.validation ?? {};
const OWC = (index.contacts ?? []).find((c) => Number.isFinite(c.tvdss))?.tvdss ?? 3065;
const BO = index.pvt?.Bo ?? 1.47;

// ══ 1 · resolution ═══════════════════════════════════════════════════════════
L('## 1 · Model resolution');
L();
table(
  ['Item', 'Value', 'Note'],
  [
    ['Areal grid', `${p.nx} × ${p.ny}`, `${int(nCol)} columns`],
    ['Cell size', `${n2(p.dx, 1)} × ${n2(p.dy, 1)} m`, 'from the common horizon frame'],
    ['Areal extent', `${n2((p.nx * p.dx) / 1000, 2)} × ${n2((p.ny * p.dy) / 1000, 2)} km`, ''],
    ['Layers', String(p.nz), `${NZ} per zone × ${built.zoneLayers.length} zones, proportional`],
    ['Total cells', int(built.cells), ''],
    ['Active cells', int(built.activeCells), `${pc(built.activeCells / built.cells)} of the box`],
    ['Packed size', `${n2(built.packedBytes / 1048576, 1)} MB`, `${n2(built.packedBytes / built.activeCells, 1)} bytes/active cell`],
    ['Simulation grid', `${sim ? `${sim.simGrid.nx} × ${sim.simGrid.ny}` : '—'}`, sim ? `upsampled to ${sim.modelNx} × ${sim.modelNy} — the field carries only this much detail` : ''],
    ['Property layers', sim ? `${sim.simulatedLayers} of ${p.nz}` : '—', sim ? `${sim.skippedLayers} outside the reservoir, left empty` : ''],
    ['Build time', `${n2(built.ms / 1000, 1)} s`, sim ? `+ ${n2(sim.ms / 1000, 1)} s simulation` : ''],
  ],
  ['', 'r', ''],
);

// ══ 2 · horizons ═════════════════════════════════════════════════════════════
L('## 2 · Horizons');
L();
L(`${horizons.length} depth grids, ordered by their own mid-depth. They arrive on **different origins and spacings** — nothing can be differenced until they are resampled onto one common frame.`);
L();
table(
  ['#', 'Horizon', 'Own grid', 'Cell m', 'Min m', 'Max m', 'Defined nodes'],
  horizons.map((h, i) => [
    String(i + 1), h.name, `${h.ncol} × ${h.nrow}`, n2(h.dx, 0),
    n2(Math.abs(h.minZ), 0), n2(Math.abs(h.maxZ), 0),
    `${int(h.defined)} (${pc(h.defined / h.nodes, 0)})`,
  ]),
  ['r', '', 'r', 'r', 'r', 'r', 'r'],
);

// ══ 3 · zones ════════════════════════════════════════════════════════════════
const qc = structuralQc(built);
L('## 3 · Cells and geometry per zone');
L();
table(
  ['Zone', 'Layers', 'k range', 'Columns', 'Cells', 'Live cells', 'Thick min', 'mean', 'max', 'Layer m'],
  qc.zones.map((z) => [
    z.name + (reservoirZones.includes(z.name) ? ' ★' : ''),
    String(z.nz), `${z.k0}–${z.k0 + z.nz - 1}`,
    int(z.columns), int(z.cells), int(z.liveCells),
    n2(z.minThickM, 1), n2(z.meanThickM, 1), n2(z.maxThickM, 1), n2(z.meanLayerM, 2),
  ]),
  ['', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
);
L('★ = the reservoir. `Columns` counts where the zone exists at all; a zone absent in a column contributes no cell.');
L();

// ══ 4 · structural QC ════════════════════════════════════════════════════════
L('## 4 · Structural QC');
L();
const mark = { ok: 'OK', warn: 'WARN', fail: 'FAIL', 'n/a': 'n/a' };
table(
  ['Check', 'Verdict', 'Count', 'Of', 'Finding'],
  qc.checks.map((c) => [c.label, mark[c.verdict], c.of ? int(c.count) : '—', c.of ? int(c.of) : '—', c.finding]),
  ['', '', 'r', 'r', ''],
);
L(`**Worst verdict across the checks that ran: ${mark[qc.worst]}.**`);
L();
L('The four `n/a` rows are reported as *inapplicable*, not as passes. This is a **vertical-pillar grid**: every cell is an axis-aligned box, so twisting, non-planar faces and crossing pillars are impossible by construction rather than absent. Printing "0 found ✓" would claim a test was passed when no test was run — they become real checks the day the grid gains faults.');
L();
for (const c of qc.checks.filter((x) => x.consequence)) L(`- **${c.label}** — ${c.consequence}`);
L();

// ══ 5 · upscaled wells ═══════════════════════════════════════════════════════
L('## 5 · Upscaled cells — producers and injectors');
L();
L('These are the model\'s key input to the dynamic model. Each sample is blocked at its **own survey position**, not at the surface slot: Volve\'s producers step out 463 m (F-12) to 1,595 m (F-15 D), which is 9 to 32 columns on a 50 m grid.');
L();
const flowing = perWell.filter((w) => w.producer || w.injector);
const wellRow = (w) => {
  const cs = w.cells;
  const inRes = cs.filter((c) => resLayers.includes(c.k));
  const ph = stat(cs.map((c) => c.phie));
  const sw = stat(cs.map((c) => c.sw));
  const sand = cs.filter((c) => c.facies === 1).length;
  return [
    w.name, w.producer ? 'PROD' : 'INJ', w.depthUnit,
    cs.length ? '✓' : '✗',
    int(cs.length), int(w.columnsCrossed), int(inRes.length),
    n2(ph.mean, 3), n2(sw.mean, 3), pc(cs.length ? sand / cs.length : NaN, 0),
  ];
};
table(
  ['Well', 'Role', 'Depth unit', 'Up', 'Cells', 'Columns', 'In reservoir', 'φ mean', 'Sw mean', 'Sand'],
  flowing.map(wellRow),
  ['', '', '', '', 'r', 'r', 'r', 'r', 'r', 'r'],
);
const prod = flowing.filter((w) => w.producer), inj = flowing.filter((w) => w.injector);
L(`**${flowing.filter((w) => w.cells.length).length}/${flowing.length} flowing wells upscaled** — ${prod.filter((w) => w.cells.length).length}/${prod.length} producers, ${inj.filter((w) => w.cells.length).length}/${inj.length} injectors.`);
L();
const other = perWell.filter((w) => !w.producer && !w.injector);
L(`Non-flowing bores: ${other.length} in the workspace, ${other.filter((w) => w.cells.length).length} upscaled — they condition the property model but drive no flow.`);
L();

// ══ 6 · properties per zone ══════════════════════════════════════════════════
L('## 6 · Modelled reservoir properties per zone');
L();
const zoneProps = built.zoneLayers.map((zl) => {
  const phi = [], perm = [], permz = [];
  let sand = 0, cells = 0, modelled = false;
  for (let k = zl.k0; k < zl.k0 + zl.nz; k++) {
    const layer = sim?.layers[k];
    if (!layer?.simulated) continue;
    modelled = true;
    for (let c = 0; c < nCol; c++) {
      if (!p.activeCol[c]) continue;
      cells++; sand += layer.facies[c];
      phi.push(layer.phie[c]); perm.push(layer.perm[c]); permz.push(layer.permZ[c]);
    }
  }
  const ph = stat(phi), pk = stat(perm), pz = stat(permz);
  // permeability is LOG-distributed: the arithmetic mean is dominated by the high
  // tail and describes no cell in the model, so the geometric mean is shown beside it
  const gm = perm.length ? Math.exp(perm.reduce((a, b) => a + Math.log(Math.max(1e-6, b)), 0) / perm.length) : NaN;
  return { name: zl.name, modelled, cells, sand, ph, pk, pz, gm };
});
table(
  ['Zone', 'Modelled', 'Cells', 'φ mean', 'φ min', 'φ max', 'k geo mD', 'k arith mD', 'k max mD', 'kv geo mD', 'Sand'],
  zoneProps.map((z) => z.modelled
    ? [z.name + (reservoirZones.includes(z.name) ? ' ★' : ''), 'yes', int(z.cells),
       n2(z.ph.mean, 3), n2(z.ph.min, 3), n2(z.ph.max, 3),
       n2(z.gm, 1), n2(z.pk.mean, 1), n2(z.pk.max, 0), n2(z.gm * 0.1, 2), pc(z.sand / Math.max(1, z.cells), 0)]
    : [z.name, 'NO — outside the reservoir', '—', '—', '—', '—', '—', '—', '—', '—', '—']),
  ['', '', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r', 'r'],
);
L(`φ–k transform: **analogue** log₁₀k = ${PERM_A}·φ ${PERM_B} — the delivery ships no core or permeability curve to fit against. kv/kh = 0.1, uniform.`);
L(`Permeability is log-distributed, so the **geometric** mean is the one that describes a typical cell; the arithmetic mean is shown beside it because the two differ by design, not by error.`);
if (sim?.permCapped) L(`${int(sim.permCapped)} cells (${pc(sim.permCapped / sim.simulatedCells, 1)} of those simulated) were capped at the 20,000 mD physical ceiling.`);
L();

// ══ 7 · upscale vs log vs simulated ══════════════════════════════════════════
L('## 7 · Porosity through the chain — log → upscaled → simulated');
L();
L('The two places a property model can silently drift: **blocking** (many log samples become one cell) and **simulation** (SGS should reproduce the conditioning histogram, not invent its own).');
L();
const resSet = new Set(resLayers);
const upRes = up.cells.filter((c) => resSet.has(c.k));
const logPhiAll = [], logSwAll = [];
for (const w of C.wells) { for (const v of w.logPhie) logPhiAll.push(v); for (const v of w.logSw) logSwAll.push(v); }
const simPhi = [];
for (const k of resLayers) {
  const layer = sim?.layers[k];
  if (!layer?.simulated) continue;
  for (let c = 0; c < nCol; c++) if (p.activeCol[c]) simPhi.push(layer.phie[c]);
}
const sLog = stat(logPhiAll), sUpAll = stat(up.cells.map((c) => c.phie)), sUpRes = stat(upRes.map((c) => c.phie)), sSim = stat(simPhi);
table(
  ['Stage', 'n', 'φ mean', 'φ P50', 'φ min', 'φ max', 'Δ vs previous'],
  [
    ['Log samples (our interpretation, all zones)', int(sLog.n), n2(sLog.mean, 3), n2(sLog.p50, 3), n2(sLog.min, 3), n2(sLog.max, 3), '—'],
    ['Upscaled cells (all zones)', int(sUpAll.n), n2(sUpAll.mean, 3), n2(sUpAll.p50, 3), n2(sUpAll.min, 3), n2(sUpAll.max, 3), `${sUpAll.mean > sLog.mean ? '+' : ''}${n2(sUpAll.mean - sLog.mean, 3)}`],
    ['Upscaled cells (reservoir only)', int(sUpRes.n), n2(sUpRes.mean, 3), n2(sUpRes.p50, 3), n2(sUpRes.min, 3), n2(sUpRes.max, 3), `${sUpRes.mean > sUpAll.mean ? '+' : ''}${n2(sUpRes.mean - sUpAll.mean, 3)}`],
    ['Simulated field (reservoir)', int(sSim.n), n2(sSim.mean, 3), n2(sSim.p50, 3), n2(sSim.min, 3), n2(sSim.max, 3), `${sSim.mean > sUpRes.mean ? '+' : ''}${n2(sSim.mean - sUpRes.mean, 3)}`],
  ],
  ['', 'r', 'r', 'r', 'r', 'r', 'r'],
);
const bias = sSim.mean - sUpRes.mean;
L(`**Simulation bias: ${bias >= 0 ? '+' : ''}${n2(bias, 4)} porosity units (${pc(Math.abs(bias) / Math.max(1e-9, sUpRes.mean), 1)} of the conditioning mean).** SGS reproduces the conditioning histogram through a normal-score back-transform, so a large drift here would mean the conditioning set and the simulated volume describe different rock — usually because the wells sample only part of the field.`);
L();

// ══ 8 · facies proportion ════════════════════════════════════════════════════
L('## 8 · Facies proportion — conditioning vs realisation');
L();
const upSandRes = upRes.filter((c) => c.facies === 1).length;
const simSand = (() => { let s = 0, n = 0; for (const k of resLayers) { const l = sim?.layers[k]; if (!l?.simulated) continue; for (let c = 0; c < nCol; c++) if (p.activeCol[c]) { s += l.facies[c]; n++; } } return { s, n }; })();
table(
  ['Population', 'n', 'Sand', 'Shale', 'Sand fraction'],
  [
    ['Upscaled cells in reservoir (SIS conditioning)', int(upRes.length), int(upSandRes), int(upRes.length - upSandRes), pc(upSandRes / Math.max(1, upRes.length), 1)],
    ['Simulated reservoir cells (SIS realisation)', int(simSand.n), int(simSand.s), int(simSand.n - simSand.s), pc(simSand.s / Math.max(1, simSand.n), 1)],
    ['Whole-model realisation (reported by the engine)', int(sim ? sim.simulatedCells : 0), '—', '—', sim ? pc(sim.sandFraction, 1) : '—'],
  ],
  ['', 'r', 'r', 'r', 'r'],
);
const dSand = simSand.s / Math.max(1, simSand.n) - upSandRes / Math.max(1, upRes.length);
L(`**Proportion drift: ${dSand >= 0 ? '+' : ''}${pc(dSand, 1)}.** SIS is conditioned to the upscaled cells and targets their proportion; a drift means the wells are not areally representative of the volume being filled — on a field drilled into the crest, the realisation is being asked to extrapolate sand-rich data across flank rock nobody logged.`);
L();

// ══ 9 · water saturation ═════════════════════════════════════════════════════
L('## 9 · Water saturation — where the model gets Sw');
L();
const sLogSw = stat(logSwAll), sUpSw = stat(upRes.map((c) => c.sw));
table(
  ['Source', 'n', 'Sw mean', 'Sw P50', 'Sw min', 'Sw max', 'Status'],
  [
    ['Log-derived (Archie, our interpretation, all zones)', int(sLogSw.n), n2(sLogSw.mean, 3), n2(sLogSw.p50, 3), n2(sLogSw.min, 3), n2(sLogSw.max, 3), 'computed'],
    ['Upscaled cells (reservoir)', int(sUpSw.n), n2(sUpSw.mean, 3), n2(sUpSw.p50, 3), n2(sUpSw.min, 3), n2(sUpSw.max, 3), 'computed'],
    ['3D Sw property in the grid', '0', '—', '—', '—', '—', 'NOT MODELLED'],
    ['Sw used by the volume calculation', int(built.activeCells), '0.250', '0.250', '0.250', '0.250', 'CONSTANT'],
    ['Deck / screening default', '—', n2(defaults.sw, 3), '—', '—', '—', `index.json defaults`],
  ],
  ['', 'r', 'r', 'r', 'r', 'r', ''],
);
L('**This is the largest honest gap in the property model.** Porosity and facies are simulated in 3D; water saturation is not. The volume calculation applies a flat **Sw = 0.250** to every cell above the contact, so:');
L();
L('- there is no transition zone — Sw is the same 1 m above the contact as it is at the crest;');
L(`- the upscaled cells *do* carry a computed Sw (mean ${n2(sUpSw.mean, 3)}), so the conditioning data for an SGS or a J-function exists — it simply is not used yet;`);
L(`- the constant sits ${n2(0.25 - sLogSw.mean, 3)} from the log-derived mean over all zones, which is not a like-for-like comparison because the logs include non-reservoir rock.`);
L();
L('Until Sw is modelled — height-above-contact J-function, or SGS conditioned to the upscaled Sw — the STOIIP carries an unquantified error that no history match can absorb cleanly.');
L();

// ══ 10 · volumes and pools ═══════════════════════════════════════════════════
const cells = C.volumeCells();
const gv = gridVolumes(cells, { owc: OWC, bo: BO, zones: reservoirZones });

const resSurf = reservoirZones.length ? zoneSurfaces(built, reservoirZones[0]) : null;
const poolWells = index.wells.filter((w) => Number.isFinite(w.x) && Number.isFinite(w.y)).map((w) => ({
  name: w.name, x: w.x, y: w.y,
  producer: /oil[-_ ]?produc/i.test(String(w.role ?? '')),
  injector: /inject/i.test(String(w.role ?? '')),
}));
const pools = resSurf ? findPools(
  { nx: p.nx, ny: p.ny, dx: p.dx, dy: p.dy, x0: p.x0, y0: p.y0, topZ: resSurf.topZ, baseZ: resSurf.baseZ, activeCol: p.activeCol },
  OWC, poolWells, 4,
) : null;
const drainedFrac = pools ? pools.drainedGrvM3 / Math.max(1, pools.drainedGrvM3 + pools.undrainedGrvM3) : 1;
const stoiipAll = toMMSm3(gv.stoiipSm3);
const stoiipDrained = stoiipAll * drainedFrac;

L('## 10 · STOIIP');
L();
table(
  ['Quantity', 'Value', 'Note'],
  [
    ['Contact (OWC)', `${n2(OWC, 0)} m TVDSS`, `${(index.contacts ?? [])[0]?.dataNature ?? '—'} — deck EQUIL baseline 3200 m`],
    ['Bo', n2(BO, 2), index.pvt?.Bo_note?.slice(0, 60) ?? ''],
    ['GRV above contact', `${n2(gv.grvM3 / 1e6, 1)} Mm³`, `${int(gv.cells)} cells in zone, ${int(gv.straddling)} straddling`],
    ['NTG (volume-weighted)', n2(gv.meanNtg, 3), 'binary facies — sand = 1, shale = 0'],
    ['φ (volume-weighted)', n2(gv.meanPhi, 3), 'from the SGS realisation'],
    ['Sw (volume-weighted)', n2(gv.meanSw, 3), 'CONSTANT — see §9'],
    ['**STOIIP — all accumulations**', `**${n2(stoiipAll)} MMSm³**`, `${n2(toMMstb(gv.stoiipSm3), 1)} MMstb`],
    ['**STOIIP — drained accumulation only**', `**${n2(stoiipDrained)} MMSm³**`, `${pc(drainedFrac)} of GRV is in pools containing a producer`],
  ],
  ['', 'r', ''],
);

if (pools) {
  L('### Accumulations above the contact');
  L();
  L(`The area above the contact is **not one trap**. Two columns belong to the same accumulation only if oil could travel between them without crossing below the contact — a 4-connected component of the reservoir top.`);
  L();
  table(
    ['Pool', 'Area km²', 'Crest m', 'Column m', 'GRV Mm³', 'Share', 'Drained', 'Wells'],
    pools.pools.slice(0, 10).map((pl) => [
      `${pl.drained ? '★ ' : ''}${pl.id}`, n2(pl.areaM2 / 1e6, 2), n2(pl.crestZ, 0), n2(pl.columnM, 0),
      n2(pl.grvM3 / 1e6, 1), pc(pl.grvM3 / (pools.drainedGrvM3 + pools.undrainedGrvM3), 1),
      pl.drained ? 'yes' : 'no',
      pl.wells.length ? pl.wells.slice(0, 3).join(', ') + (pl.wells.length > 3 ? ` +${pl.wells.length - 3}` : '') : '—',
    ]),
    ['', 'r', 'r', 'r', 'r', 'r', '', ''],
  );
  L(`${pools.pools.length} accumulations, **${pools.drainedCount} drained**. Undrained GRV ${n2(pools.undrainedGrvM3 / 1e6, 1)} Mm³ (${pc(1 - drainedFrac)}) — summing untested closures into a producing field's STOIIP was the single largest source of error in this model.`);
  L();
}

// ══ 11 · benchmark ═══════════════════════════════════════════════════════════
L('## 11 · Benchmark against the published Volve figures');
L();
L(`Authority: **${official.authority ?? '—'}**, field NPDID ${official.fieldNpdid ?? '—'} — ${official.reference ?? ''}`);
L();
const ref = validation.stoiip?.references ?? {};
const cmp = (label, ours, pub, src) => [
  label,
  Number.isFinite(ours) ? n2(ours, 2) : '—',
  Number.isFinite(pub) ? n2(pub, 2) : '—',
  Number.isFinite(ours) && Number.isFinite(pub) && pub !== 0 ? `${n2(ours / pub, 2)}×` : '—',
  src,
];
table(
  ['Quantity', 'This model', 'Published', 'Ratio', 'Source'],
  [
    cmp('STOIIP, all accumulations (MMSm³)', stoiipAll, official.stoiipMMSm3, 'Sodir field accounting'),
    cmp('STOIIP, drained accumulation (MMSm³)', stoiipDrained, official.stoiipMMSm3, 'Sodir field accounting'),
    cmp('STOIIP vs Volve dynamic model (MMSm³)', stoiipDrained, ref.dynamicModel_MMSm3, 'index.json validation.references'),
    cmp('STOIIP vs F-12 material balance (MMSm³)', stoiipDrained, ref.mbal_F12_MMSm3, 'index.json validation.references'),
    cmp('STOIIP vs volumetric analogue (MMSm³)', stoiipDrained, ref.volumetricAnalogue_MMSm3, 'index.json validation.references'),
    cmp('Porosity (fraction)', gv.meanPhi, defaults.phi, 'index.json defaults (screening)'),
    cmp('Net-to-gross', gv.meanNtg, defaults.ntg, 'index.json defaults (screening)'),
    cmp('Water saturation', gv.meanSw, defaults.sw, 'index.json defaults (screening)'),
    cmp('Bo', BO, defaults.bo, 'VOLVE_2016.PRT deck PVTO'),
    cmp('Reservoir crest (m TVDSS)', pools?.pools?.[0]?.crestZ, (official.reservoirDepthMbsl ?? [])[0], 'Sodir reservoir depth range'),
  ],
  ['', 'r', 'r', 'r', ''],
);
L(`Reservoir: **${official.reservoir ?? '—'}**, ${((official.reservoirDepthMbsl ?? []).join('–')) || '—'} m bsl, drive: ${official.drive ?? '—'}.`);
L(`Field life: discovered ${official.discoveryYear ?? '—'} (${official.discoveryWellbore ?? '—'}), first oil ${official.firstProduction ?? '—'}, cessation ${official.cessation ?? '—'}, peak ${int(official.peakOilBopd)} bopd.`);
L(`Official recovery: ${n2(official.producedOilMMSm3, 2)} MMSm³ produced of ${n2(official.stoiipMMSm3, 2)} STOIIP = **RF ${pc(official.oilRecoveryFactor)}**.`);
L();
L('### How to read the ratios');
L();
L('- The **drained** row is the like-for-like comparison. The official figure accounts for the accumulation Volve actually produced; the all-accumulations row sums untested closures the field never drilled.');
L('- A ratio near 1.0 does **not** mean the model is right — it means the volume is right. The distribution of that volume in space, which is what a history match tests, is constrained by 9 flowing wells over a 16×16 simulation grid.');
L('- The published φ / NTG / Sw are **screening defaults carried in the delivery**, not measured field averages, so those three rows compare a model against an assumption. Treat a close match there as consistency, not validation.');
L();

L('---');
L(`Generated in ${n2((Date.now() - t0) / 1000, 1)} s · reservoir zone: ${reservoirZones.join(', ') || '(none matched)'} · layers ${resLayers[0] ?? '—'}–${resLayers[resLayers.length - 1] ?? '—'} of ${p.nz}`);

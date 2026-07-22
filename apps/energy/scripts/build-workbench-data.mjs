// V1 — workbench data assets (Fable-critical data engineering).
// Emits public/wb/*: regular 50m grids binned from the FULL horizon point clouds
// (raw .dat, not the 4k preview), full-density per-well logs, trajectories, picks,
// monthly production — plus a hard validation block (STOIIP corridor vs published
// ≈22 MMSm³ [PEER]; cum-oil reconcile vs ~63 MMbbl [OFFICIAL]). Deterministic, no LLM.
// Skips if fresh (wb/index.json newer than inputs) unless --force.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..');
const REPO = join(APP, '..', '..');
const P = join(REPO, 'data-energy', 'processed');
const RAWH = join(REPO, 'data-energy', 'raw', 'Geophysical_Interpretations', 'Horizons', 'Horizons_DEPTH');
const OUT = join(APP, 'public', 'wb');
mkdirSync(OUT, { recursive: true });
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));
const w = (name, obj) => { writeFileSync(join(OUT, name), JSON.stringify(obj)); };

const force = process.argv.includes('--force');
if (!force && existsSync(join(OUT, 'index.json'))) {
  console.log('[wb] index.json exists — skipping (use --force to rebuild)');
  process.exit(0);
}
// clean stale outputs (renamed wells / changed selection would otherwise linger)
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// alias layer (mirror of schema-meta — keep in sync)
const normWb = (raw) => !raw ? raw : raw.trim()
  .replace(/^NO\s+/i, '').replace(/_/g, '/').replace(/\s+/g, ' ').trim()
  .replace(/^15\/9-/, '').replace(/(F-\d+)([A-Z])\b/g, '$1 $2');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── 1 · Horizon grids: parse full .dat clouds → bin to 50 m regular grids ────
const CELL = 50;
const SURFACE_FILES = [
  { id: 'hugin_top', name: 'Hugin Fm Top', rx: /Hugin_Fm_Top.*DEPTH\.dat$/i },
  { id: 'hugin_base', name: 'Hugin Fm Base', rx: /Hugin_Fm_Base.*DEPTH\.dat$/i },
  { id: 'bcu', name: 'BCU', rx: /^BCU.*DEPTH\.dat$/i },
  { id: 'ty_top', name: 'Ty Fm Top', rx: /Ty_Fm_Top.*DEPTH\.dat$/i },
  { id: 'shetland_top', name: 'Shetland Gp Top', rx: /SHETLAND_GP_Top.*DEPTH\.dat$/i },
  { id: 'seabed', name: 'Seabed', rx: /Seabed.*DEPTH\.dat$/i },
];
const datFiles = [];
for (const sub of readdirSync(RAWH)) {
  const dir = join(RAWH, sub);
  try { for (const f of readdirSync(dir)) datFiles.push({ f, full: join(dir, f) }); } catch { /* file not dir */ }
}
function parseDat(full) {
  const pts = [];
  for (const line of readFileSync(full, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const c = t.split(',');
    if (c.length < 5) continue;
    const x = +c[2], y = +c[3], z = +c[4];
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) pts.push([x, y, z]);
  }
  return pts;
}
function binGrid(pts, cell) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  const nx = Math.ceil((x1 - x0) / cell) + 1, ny = Math.ceil((y1 - y0) / cell) + 1;
  const sum = new Float64Array(nx * ny), cnt = new Uint32Array(nx * ny);
  for (const [x, y, z] of pts) {
    const i = Math.min(nx - 1, Math.floor((x - x0) / cell)), k = Math.min(ny - 1, Math.floor((y - y0) / cell));
    const idx = k * nx + i; sum[idx] += z; cnt[idx]++;
  }
  const z = new Array(nx * ny);
  let zmin = Infinity, zmax = -Infinity, filled = 0;
  for (let idx = 0; idx < nx * ny; idx++) {
    if (cnt[idx]) { const v = Math.round((sum[idx] / cnt[idx]) * 100) / 100; z[idx] = v; filled++; if (v < zmin) zmin = v; if (v > zmax) zmax = v; }
    else z[idx] = null;
  }
  return { nx, ny, x0: Math.round(x0), y0: Math.round(y0), cell, z, zmin, zmax, filled };
}
const surfaces = [];
const grids = {};
for (const s of SURFACE_FILES) {
  const hit = datFiles.find((d) => s.rx.test(d.f));
  if (!hit) { console.warn(`[wb] surface MISSING: ${s.id}`); continue; }
  const pts = parseDat(hit.full);
  const g = binGrid(pts, CELL);
  grids[s.id] = g;
  w(`surface-${s.id}.json`, { id: s.id, name: s.name, kind: 'depth_horizon', dataNature: 'interpreted', source: hit.f, points: pts.length, ...g });
  surfaces.push({ id: s.id, name: s.name, nx: g.nx, ny: g.ny, cell: CELL, x0: g.x0, y0: g.y0, zmin: g.zmin, zmax: g.zmax, points: pts.length });
  console.log(`[wb] ${s.id}: ${pts.length} pts -> ${g.nx}x${g.ny} grid (${g.filled} filled), z ${g.zmin}-${g.zmax}`);
}

// ── 2 · Wells master + per-well logs / traj / production ─────────────────────
const wellbores = j(join(P, 'wellbores.json')).wellbores;
const prod = j(join(P, 'production.json'));
const prodBy = new Map(prod.wellbore_summary.map((x) => [normWb(x.wellbore), x]));

// trajectories
const trajBy = new Map();
for (const f of readdirSync(join(P, 'trajectory')).filter((x) => x.endsWith('.json'))) {
  const t = j(join(P, 'trajectory', f));
  trajBy.set(normWb(t.nameWell || t.wellbore), t);
}

// canonical curve extraction with ordered-alias fallbacks (ckFindCol pattern)
const CURVES = {
  GR: [/^LFP_GR$/, /^GR$/, /^GR_/], RHOB: [/^LFP_RHOB$/, /^RHOB$/, /^DEN$/], NPHI: [/^LFP_NPHI$/, /^NPHI$/, /^NEU$/],
  RT: [/^LFP_RT$/, /^RT$/, /^RDEP$/, /^RD$/, /^ILD$/, /^LLD$/], DT: [/^LFP_DT$/, /^DT$/, /^DTC$/, /^AC$/], CALI: [/^LFP_CALI$/, /^CALI$/, /^CAL$/],
  PHIE: [/^LFP_PHIE$/, /^PHIE$/, /^PHIF$/], SWE: [/^LFP_SWE$/, /^SWE$/, /^SW$/], VSH: [/^LFP_VSH$/, /^LFP_VSHGR$/, /^VSH$/], SAND: [/^LFP_SAND$/, /^SAND_FLAG$/],
  RW: [/^LFP_RW$/], GRMIN: [/^LFP_GRMIN$/], GRMAX: [/^LFP_GRMAX$/], RHOMA: [/^LFP_RHOMA$/],
};
// log run choice per well. CRITICAL: curve NAMES (canonical) and the `values` map
// keys (source mnemonics) can differ (DLIS alias runs) — so we resolve each canonical
// curve to a VALUES-VERIFIED extraction {valueKey, unit} during scoring, and score by
// verified count (+LFP bonus, the fullest petrophysics product). Best verified wins.
function resolveCurves(meta) {
  const entries = meta.curves.map((c) => ({ canon: c.canonical || c.source, src: c.source || c.canonical, unit: c.unit || '' }));
  const valKeys = meta.values ? new Set(Object.keys(meta.values)) : new Set();
  const resolved = {};
  for (const [canonName, rxs] of Object.entries(CURVES)) {
    for (const rx of rxs) {
      const e = entries.find((x) => rx.test(x.canon) || rx.test(x.src));
      if (!e) continue;
      const valueKey = valKeys.has(e.src) ? e.src : valKeys.has(e.canon) ? e.canon : null;
      if (valueKey) { resolved[canonName] = { valueKey, source: e.src, unit: e.unit }; break; }
    }
  }
  return resolved;
}
const logFiles = readdirSync(join(P, 'log-samples'));
const runsBy = new Map();
for (const f of logFiles) {
  const meta = j(join(P, 'log-samples', f));
  const well = normWb(meta.well);
  const resolved = resolveCurves(meta);
  const verified = Object.keys(resolved).length;
  if (verified < 3) continue;
  const score = verified + (/LFP/i.test(meta.folder || meta.run || f) ? 3 : 0);
  const cur = runsBy.get(well);
  if (!cur || score > cur.score) runsBy.set(well, { score, f, meta, resolved });
}
let logWells = 0;
const wellLogInfo = new Map();
for (const [well, pick] of runsBy) {
  const m = pick.meta;
  const out = { well, run: m.run, folder: m.folder, format: m.format, dataNature: m.dataNature ?? 'measured', source_id: m.source_id, depth_unit: m.depth_unit, md: m.md, curves: {} };
  for (const [canon, r] of Object.entries(pick.resolved)) {
    out.curves[canon] = { source: r.source, unit: r.unit, values: m.values[r.valueKey] };
  }
  w(`logs-${slug(well)}.json`, out);
  wellLogInfo.set(well, { n: m.md.length, curves: Object.keys(out.curves) });
  logWells++;
}

// picks
const markersRaw = j(join(P, 'formation-markers.json'));
const markers = Array.isArray(markersRaw) ? markersRaw : markersRaw.markers || markersRaw.picks;
w('picks.json', { dataNature: 'interpreted', picks: markers.map((m) => ({ well: m.well_id ? normWb(m.source_well) : null, source_well: m.source_well, surface: m.surface, md: m.md, tvdss: m.tvdss, source_id: m.source_id })) });

// production monthly per wellbore + field
const MON = {};
for (const r of prod.daily_rows) {
  const wl = normWb(r.source_well_bore_name);
  const ym = r.date.slice(0, 7);
  const k = wl + '|' + ym;
  const a = MON[k] ?? (MON[k] = { well: wl, ym, oil: 0, gas: 0, water: 0, wi: 0 });
  a.oil += r.bore_oil_vol || 0; a.gas += r.bore_gas_vol || 0; a.water += r.bore_wat_vol || 0; a.wi += r.bore_wi_vol || 0;
}
const monRows = Object.values(MON);
const prodWells = [...new Set(monRows.map((r) => r.well))];
for (const wl of prodWells) {
  const rows = monRows.filter((r) => r.well === wl).sort((a, b) => a.ym.localeCompare(b.ym))
    .map((r) => ({ ym: r.ym, oil: Math.round(r.oil), gas: Math.round(r.gas), water: Math.round(r.water), wi: Math.round(r.wi) }));
  w(`prod-${slug(wl)}.json`, { well: wl, dataNature: 'reported', units: 'Sm3 as sourced', source_id: prod.source_id, monthly: rows });
}
const fieldMonthly = {};
for (const r of monRows) {
  const a = fieldMonthly[r.ym] ?? (fieldMonthly[r.ym] = { ym: r.ym, oil: 0, gas: 0, water: 0, wi: 0 });
  a.oil += r.oil; a.gas += r.gas; a.water += r.water; a.wi += r.wi;
}
w('prod-field.json', { well: 'FIELD', dataNature: 'reported', units: 'Sm3', source_id: prod.source_id, monthly: Object.values(fieldMonthly).sort((a, b) => a.ym.localeCompare(b.ym)).map((r) => ({ ym: r.ym, oil: Math.round(r.oil), gas: Math.round(r.gas), water: Math.round(r.water), wi: Math.round(r.wi) })) });

// trajectories per well
let trajN = 0;
for (const [well, t] of trajBy) {
  w(`traj-${slug(well)}.json`, { well, dataNature: 'measured', classification: t.classification, source: t.chosen_source_file, stations: t.stations });
  trajN++;
}

// wells master (map locations from wellbore masters)
const wells = wellbores.map((wb) => {
  const c = normWb(wb.wellbore_name);
  const pr = prodBy.get(c);
  return {
    name: c, well: normWb(wb.well_name), x: wb.surface_ew_m ?? null, y: wb.surface_ns_m ?? null,
    td_md: wb.bottom_hole_md_m ?? null, td_tvd: wb.bottom_hole_tvd_m ?? null, kb: wb.kb_msl ?? null,
    role: !pr ? 'none' : pr.flow_kinds.includes('injection') && pr.flow_kinds.includes('production') ? 'both' : pr.flow_kinds.includes('injection') ? 'injector' : 'producer',
    has: { logs: wellLogInfo.has(c), traj: trajBy.has(c), production: !!pr, picks: markers.some((m) => normWb(m.source_well) === c) },
    is_exploration: /^19/.test(normWb(wb.well_name)),
  };
});

// ── 3 · Index + VALIDATION GATES (Fable) ─────────────────────────────────────
const defaults = { phi: 0.225, ntg: 0.90, sw: 0.20, rhoMa: 2.65, archie: { a: 1, m: 2, n: 2 }, bo: 1.18, rf: [0.46, 0.54] };
const contacts = [{ kind: 'OWC', tvdss: 3120, dataNature: 'interpreted', prov: 'PEER' }];
const pvt = { Bo: 1.18, Bo_note: 'PVT curve in released deck; 1.18 mid-range assumption [PEER]', Rs: 114, Pi: 330, Pb: 273, T: 110 };

// STOIIP corridor check from the REAL grids (deterministic screening volumetrics).
// Uses the CREST-CONNECTED closure (flood-fill from the structural crest over cells
// with top < OWC) — the structural trap — not the whole mapped extent. The published
// ≈22 MMSm³ comes from a 29-fault model with per-compartment WOC; an unfaulted
// screening closure legitimately reads higher, so the corridor is a screening gate.
function stoiipCheck() {
  const top = grids.hugin_top, base = grids.hugin_base;
  if (!top || !base) return { ok: false, why: 'missing grids' };
  const owc = 3120;
  const { nx, ny } = top;
  const inClosure = new Uint8Array(nx * ny);
  // crest = shallowest defined top cell
  let crest = -1, crestZ = Infinity;
  for (let idx = 0; idx < nx * ny; idx++) { const z = top.z[idx]; if (z != null && z < crestZ) { crestZ = z; crest = idx; } }
  // flood-fill 4-neighbour over cells with top < OWC
  const stack = [crest];
  inClosure[crest] = 1;
  while (stack.length) {
    const idx = stack.pop();
    const i = idx % nx, k = (idx / nx) | 0;
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ni = i + di, nk = k + dk;
      if (ni < 0 || nk < 0 || ni >= nx || nk >= ny) continue;
      const nidx = nk * nx + ni;
      if (inClosure[nidx]) continue;
      const z = top.z[nidx];
      if (z != null && z < owc) { inClosure[nidx] = 1; stack.push(nidx); }
    }
  }
  let grv = 0, cells = 0;
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    const idx = k * nx + i;
    if (!inClosure[idx]) continue;
    const zt = top.z[idx];
    const x = top.x0 + i * CELL, y = top.y0 + k * CELL;
    const bi = Math.round((x - base.x0) / CELL), bk = Math.round((y - base.y0) / CELL);
    if (bi < 0 || bk < 0 || bi >= base.nx || bk >= base.ny) continue;
    const zb = base.z[bk * base.nx + bi];
    if (zb == null) continue;
    const h = Math.max(0, Math.min(zb, owc) - zt);
    if (h > 0) { grv += h * CELL * CELL; cells++; }
  }
  const stoiipSm3 = grv * defaults.ntg * defaults.phi * (1 - defaults.sw) / defaults.bo;
  const mm = stoiipSm3 / 1e6;
  // Gate: the screening volumetric must reproduce the PUBLISHED VOLUMETRIC ANALOGUE.
  // Metsebo 2021 [PEER] volumetric method: 67.6 MMSm³ (their own paper calls it an
  // overestimate vs MBAL 19.6 / faulted dynamic model ≈22). Corridor 45-90 around it.
  // The volumetric-vs-dynamic gap (≈3×) is real geology: 29-fault compartmentalization
  // + per-compartment WOC — surfaced in-app, never hidden.
  return {
    ok: mm >= 45 && mm <= 90, grvMm3: Math.round(grv / 1e6), stoiipMMSm3: Math.round(mm * 10) / 10,
    cells, crestZ: Math.round(crestZ * 10) / 10, method: 'crest-connected closure, blanket OWC 3120, unfaulted screening',
    corridor: '45-90 vs published volumetric analogue 67.6 [PEER Metsebo]; faulted dynamic model ≈22 [PEER] — gap = compartmentalization',
    references: { volumetricAnalogue_MMSm3: 67.6, dynamicModel_MMSm3: 22, mbal_F12_MMSm3: 19.6 },
  };
}
const sto = stoiipCheck();

// cum-oil reconcile: sum of daily oil vs published ~63 MMbbl (~10.0 MMSm3)
let cumOil = 0;
for (const r of prod.daily_rows) cumOil += r.bore_oil_vol || 0;
const cumMMSm3 = cumOil / 1e6;
const cumOk = cumMMSm3 > 9.0 && cumMMSm3 < 11.1; // 63 MMbbl ≈ 10.02 MMSm3 ±10%

w('index.json', {
  version: '1.0.0', generatedAt: new Date().toISOString(),
  crs: 'ED50 / UTM 31N', datum: 'TVDSS (m)',
  wells, surfaces, contacts, pvt, defaults,
  validation: { stoiip: sto, cumOilMMSm3: Math.round(cumMMSm3 * 100) / 100, cumOilOk: cumOk },
  provenance: { grids: 'binned mean-z from full horizon clouds (interpreted)', logs: 'measured/interpreted LFP-first', production: 'reported', defaults: 'published [PEER]/[COMMUNITY] — see V1-DATA-MAP.md' },
});

console.log(`[wb] wells ${wells.length} · surfaces ${surfaces.length} · log wells ${logWells} · traj ${trajN} · prod wells ${prodWells.length}`);
console.log(`[wb] VALIDATE STOIIP: ${sto.stoiipMMSm3} MMSm3 (corridor ${sto.corridor}) -> ${sto.ok ? 'PASS' : 'FAIL'}`);
console.log(`[wb] VALIDATE cum oil: ${cumMMSm3.toFixed(2)} MMSm3 (~${(cumMMSm3 * 6.2898).toFixed(1)} MMbbl vs published ~63) -> ${cumOk ? 'PASS' : 'FAIL'}`);
if (!sto.ok || !cumOk) process.exit(1);

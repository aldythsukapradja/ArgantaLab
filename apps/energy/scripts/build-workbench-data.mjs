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
// clean stale outputs (renamed wells / changed selection would otherwise linger).
// EXCEPT docs/ — those are curated source PDFs that this script does not generate
// and public/wb is gitignored, so a blind rmSync would destroy them unrecoverably.
for (const entry of existsSync(OUT) ? readdirSync(OUT) : []) {
  if (entry === 'docs') continue;
  rmSync(join(OUT, entry), { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });

// alias layer (mirror of schema-meta — keep in sync)
const normWb = (raw) => !raw ? raw : raw.trim()
  .replace(/^NO\s+/i, '').replace(/_/g, '/').replace(/\s+/g, ' ').trim()
  .replace(/^15\/9-/, '').replace(/(F-\d+)([A-Z])\b/g, '$1 $2');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Volve packages some deliverables under a merged wellbore+sidetrack folder
// ("15_9-19 B&BT2"). Same split rule as scripts/schema-check.mjs — keep in sync.
const splitAmp = (raw) => {
  const s = normWb(raw);
  const m = s.match(/^(.*?\s)([A-Z0-9]+)&([A-Z0-9]+)$/);
  return m ? [m[1] + m[2], m[1] + m[3]] : [s];
};

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
const wbMaster = new Set(wellbores.map((x) => normWb(x.wellbore_name)));

/** Resolve a raw wellbore name to its canonical short form, collapsing a merged
 *  "B&BT2" folder onto whichever member the wellbore master actually carries
 *  (for Volve that is the terminal sidetrack — which is also what the LAS inside
 *  is named, e.g. 15_9-19 B&BT2/06.LFP/159-19BT2_LFP.las). Ambiguous or unknown
 *  merges keep the merged name so the orphan pass flags them instead of guessing. */
const resolveWb = (raw) => {
  const s = normWb(raw);
  if (!s || !s.includes('&')) return s;
  const inMaster = splitAmp(s).filter((c) => wbMaster.has(c));
  return inMaster.length === 1 ? inMaster[0] : s;
};
const prod = j(join(P, 'production.json'));
const prodBy = new Map(prod.wellbore_summary.map((x) => [normWb(x.wellbore), x]));

// trajectories
//
// KEY ON THE WELLBORE, NOT THE WELL. `nameWell` is the SLOT (all of F-11, F-11 A,
// F-11 B and F-11 T2 report nameWell "NO 15/9-F-11"), so keying on it collapsed four
// distinct directional surveys onto one entry and silently kept only the last —
// 29 decoded trajectories became 15 emitted files, and 7 wellbores that DO have a
// survey in the raw WITSML showed up in the app with no path at all.
// `wellbore` is the real identity; fall back to nameWell only when it is absent.
//
// The two WITSML source families ("15_9-F-12 - Main Wellbore" and "NO 15/9-F-12")
// can both carry the same wellbore. On collision keep the survey with MORE stations:
// these are definitive surveys, so the denser one is the more complete record.
const trajBy = new Map();
let trajFiles = 0, trajSupersededByDensity = 0;
for (const f of readdirSync(join(P, 'trajectory')).filter((x) => x.endsWith('.json'))) {
  const t = j(join(P, 'trajectory', f));
  // WITSML family A names the primary bore "<well> - Main Wellbore"; family B names
  // the same bore plainly ("NO 15/9-F-12"). Strip the descriptor so both resolve to
  // the SAME wellbore and the density rule below can pick the fuller survey — without
  // it the two families never collide and every bore is emitted twice under two names.
  const key = normWb((t.wellbore || t.nameWell || '').replace(/\s*-\s*Main\s+Wellbore\s*$/i, ''));
  if (!key) continue;
  trajFiles++;
  const prev = trajBy.get(key);
  const n = (t.stations || []).length;
  if (!prev) { trajBy.set(key, t); continue; }
  const pn = (prev.stations || []).length;
  if (n > pn) { trajBy.set(key, t); trajSupersededByDensity++; }
  else trajSupersededByDensity++;
}
console.log(`[wb] trajectories: ${trajFiles} decoded files -> ${trajBy.size} distinct wellbores (${trajSupersededByDensity} duplicate surveys resolved by station density)`);

// FALLBACK: NPD "Standard Survey" text reports. The 1993/2005 exploration wellbores
// (15/9-19 A · BT2 · SR) predate the WITSML realtime feed, so they have no decoded
// trajectory — but Equinor shipped their definitive directional surveys as text under
// Well_technical_data. Parsed here so those wellbores stop rendering with no path.
// Applied ONLY where a WITSML survey is absent: WITSML stays authoritative.
const SURVEY_ROOT = join(REPO, 'data-energy', 'raw', 'Well_technical_data', 'WellWellbore');
function parseNpdSurvey(text) {
  const lines = text.split(/\r?\n/);
  const head = {};
  for (const ln of lines.slice(0, 45)) {
    const m = ln.match(/^\s*([A-Za-z][A-Za-z \-]*?)\s*:\s*(.+?)\s*$/);
    if (m) head[m[1].trim().toUpperCase()] = m[2].trim();
  }
  const start = lines.findIndex((l) => /^\s*SURVEY LIST\s*$/i.test(l));
  if (start === -1) return null;
  const stations = [];
  // skip the two unit/label rows that follow "SURVEY LIST"
  for (let i = start + 3; i < lines.length; i++) {
    const c = lines[i].trim().split(/\s+/).filter(Boolean);
    if (c.length < 8) continue;
    const [md, incl, azi, tvd, dispEw, dispNs] = c.slice(0, 6).map(Number);
    if (![md, incl, azi, tvd].every(Number.isFinite)) continue;
    stations.push({
      i: stations.length, md, tvd, incl, azi,
      dispNs: Number.isFinite(dispNs) ? dispNs : null,
      dispEw: Number.isFinite(dispEw) ? dispEw : null,
      type: 'survey', incl_deg: incl, azi_deg: azi,
    });
  }
  if (stations.length < 2) return null;
  return { stations, wellbore: head['WELLBORE NAME'] || null, datum: head['DATUM NAME'] || null, method: head['CALCULATION METHOD'] || null, surveyDate: head['SURVEY DATE'] || null };
}
let npdAdded = 0;
if (existsSync(SURVEY_ROOT)) {
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, e.name);
      if (e.isDirectory()) { walk(full); continue; }
      if (!/_Standard_Survey_NPD\.txt$/i.test(e.name)) continue;
      let parsed = null;
      try { parsed = parseNpdSurvey(readFileSync(full, 'utf8')); } catch { parsed = null; }
      if (!parsed) continue;
      const key = normWb(parsed.wellbore || e.name.replace(/_Standard_Survey_NPD\.txt$/i, ''));
      if (!key || trajBy.has(key)) continue;   // WITSML wins where it exists
      trajBy.set(key, {
        wellbore: key, nameWell: key, stations: parsed.stations,
        classification: 'definitive',
        chosen_source_file: full.slice(full.indexOf('Well_technical_data')).replace(/\\/g, '/'),
        survey_method: parsed.method, survey_datum: parsed.datum, survey_date: parsed.surveyDate,
      });
      npdAdded++;
      console.log(`[wb] trajectory from NPD standard survey: ${key} (${parsed.stations.length} stations)`);
    }
  };
  walk(SURVEY_ROOT);
}
if (npdAdded) console.log(`[wb] trajectories after NPD fallback: ${trajBy.size} wellbores (+${npdAdded})`);

// canonical curve extraction with ordered-alias fallbacks (ckFindCol pattern)
// Aliases are ORDERED by preference: wireline/LFP petrophysics first, then the
// LWD/MWD equivalents. Five wellbores (F-7, F-9, F-9 A, F-11, and F-11's composite)
// were being emitted with NO log at all purely because their runs are LWD — the
// registry only knew wireline mnemonics, so they scored below the 3-curve gate and
// were dropped. The LWD aliases below are real tool channels, not guesses:
//   GRA/GRM1/GR_ARC/GRAFM/GRSIM/MWD_GR_BHC — gamma ray (ARC / MWD variants)
//   A40H/A34H/A28H — ARC attenuation resistivity, 40"/34"/28" spacing (deepest first)
//   P40H/P34H      — ARC phase-shift resistivity (shallower than attenuation)
//   RACEHM/RACELM  — array resistivity, high/low mode
// Deep resistivity prefers the 40" attenuation channel, which is the standard
// RT-equivalent for an ARC string.
const CURVES = {
  GR: [/^LFP_GR$/, /^GR$/, /^GR_ARC$/, /^MWD_GR_BHC$/, /^GRAFM$/, /^GRSIM$/, /^GRA$/, /^GRM1$/, /^GR_/],
  RHOB: [/^LFP_RHOB$/, /^RHOB$/, /^DEN$/], NPHI: [/^LFP_NPHI$/, /^NPHI$/, /^NEU$/],
  RT: [/^LFP_RT$/, /^RT$/, /^RDEP$/, /^RD$/, /^ILD$/, /^LLD$/, /^A40H$/, /^RACEHM$/, /^P40H$/, /^A34H$/],
  DT: [/^LFP_DT$/, /^DT$/, /^DTC$/, /^AC$/], CALI: [/^LFP_CALI$/, /^CALI$/, /^CAL$/],
  PHIE: [/^LFP_PHIE$/, /^PHIE$/, /^PHIF$/], SWE: [/^LFP_SWE$/, /^SWE$/, /^SW$/], VSH: [/^LFP_VSH$/, /^LFP_VSHGR$/, /^VSH$/], SAND: [/^LFP_SAND$/, /^SAND_FLAG$/],
  RW: [/^LFP_RW$/], GRMIN: [/^LFP_GRMIN$/], GRMAX: [/^LFP_GRMAX$/], RHOMA: [/^LFP_RHOMA$/],
  // Shallow/medium resistivity — with a deep channel this gives the invasion profile
  RMED: [/^P28H$/, /^A28H$/, /^RACELM$/, /^RM$/],
  // Drilling channels that ride along on an LWD composite. They are NOT petrophysics,
  // but they are real measurements at depth and are what makes an LWD-only wellbore
  // interpretable at all, so they count toward the run's usable-curve score.
  ROPLOG: [/^ROP5$/, /^ROP5_RM$/, /^ROPAVG$/, /^ROP$/],
  BITSIZE: [/^BS$/, /^BDIA$/],
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
  const well = resolveWb(meta.well);
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

// ── 2b · DRILLING PARAMETERS (mud logs) ──────────────────────────────────────
// The petrophysical pass above scores runs against CURVES (GR/RHOB/NPHI/…), so a
// MUD_LOG run — which carries none of those — always scored 0 and was silently
// dropped. Mud logs are where the DRILLING record lives: mud weight in/out, ECD,
// ROP, WOB, RPM, standpipe pressure, hookload, torque, flow, mud temperature,
// d-exponent and the gas chromatograph. This pass reads the same log-samples
// files with a drilling-specific registry so that record reaches the workspace.
//
// Units are as-recorded and carried through verbatim (sg for densities, m/h for
// ROP, t for WOB/hookload, bar for SPP) — never converted here.
const DRILL_CURVES = {
  MWIN: [/^MDIA$/],          // mud density in  (sg)  — "MW", the headline number
  MWOUT: [/^MDOA$/],         // mud density out (sg)
  ECD: [/^ECDT$/],           // equivalent circulating density (sg)
  PPG: [/^FPPG$/],           // formation pore-pressure gradient (sg)
  DXC: [/^DXC$/],            // corrected d-exponent — the classic overpressure flag
  ROP: [/^ROPA$/],           // rate of penetration (m/h)
  WOB: [/^WOBA$/],           // weight on bit (t)
  RPM: [/^RPMA$/, /^RPMB$/], // rotary speed (c/min)
  SPP: [/^SPPA$/],           // standpipe pressure (bar)
  HOOKLOAD: [/^HKLA$/, /^HKLX$/], // (t)
  TORQUE: [/^TQA$/, /^TQX$/],     // (kJ)
  FLOWIN: [/^MFIA$/],        // mud flow in  (L/min)
  FLOWOUT: [/^MFOA$/],       // mud flow out (L/min)
  TEMPIN: [/^MTIA$/],        // mud temp in  (degC)
  TEMPOUT: [/^MTOA$/],       // mud temp out (degC)
  PITVOL: [/^TVA$/],         // total active pit volume (m3) — kick/loss indicator
  GASTOT: [/^GASA$/, /^GASX$/],   // total gas
  BITDEPTH: [/^BDDI$/],      // bit depth (m)
  BITSIZE: [/^BDIA$/],       // bit diameter (in)
  TVD: [/^DVER$/],           // true vertical depth (m)
};
/** Same VALUES-VERIFIED resolution as resolveCurves, against an arbitrary registry. */
function resolveAgainst(meta, registry) {
  const entries = meta.curves.map((c) => ({ canon: c.canonical || c.source, src: c.source || c.canonical, unit: c.unit || '' }));
  const valKeys = meta.values ? new Set(Object.keys(meta.values)) : new Set();
  const resolved = {};
  for (const [canonName, rxs] of Object.entries(registry)) {
    for (const rx of rxs) {
      const e = entries.find((x) => rx.test(x.canon) || rx.test(x.src));
      if (!e) continue;
      const valueKey = valKeys.has(e.src) ? e.src : valKeys.has(e.canon) ? e.canon : null;
      if (valueKey) { resolved[canonName] = { valueKey, source: e.src, unit: e.unit }; break; }
    }
  }
  return resolved;
}
const drillBy = new Map();
for (const f of logFiles) {
  if (!/MUD_LOG/i.test(f)) continue;
  const meta = j(join(P, 'log-samples', f));
  const well = resolveWb(meta.well);
  const resolved = resolveAgainst(meta, DRILL_CURVES);
  // require at least a mud weight OR three drilling channels — anything less is not
  // a usable drilling record and is left out rather than shipped as a near-empty track
  const n = Object.keys(resolved).length;
  if (!resolved.MWIN && n < 3) continue;
  const cur = drillBy.get(well);
  if (!cur || n > cur.n) drillBy.set(well, { n, meta, resolved });
}
// PHYSICAL SCREENING. These mud logs declare no null sentinel, yet carry values that
// cannot be measurements: mud temperature of -273.15 °C (absolute zero) and densities
// of exactly 0 sg where the next real value is 0.84. Feeding those to a viewer would
// draw a physically impossible trace as if it were data. So values outside a physical
// range are set to NULL (never to zero, never dropped silently) and COUNTED — the
// count travels with the file so the workspace can show it as a QC finding.
//
// The bounds only reject the impossible. A legitimate operational zero — pumps off
// (SPP/FLOW = 0), off bottom (WOB/ROP/RPM = 0) — is preserved as real.
const DRILL_RANGE = {
  MWIN: [0.5, 3.0], MWOUT: [0.5, 3.0], ECD: [0.5, 3.5], PPG: [0.2, 3.5],  // sg
  DXC: [0.01, 5],                                                          // dimensionless
  TEMPIN: [-20, 200], TEMPOUT: [-20, 200],                                 // degC
  HOOKLOAD: [0.01, 1000], BITDEPTH: [0.01, 12000], BITSIZE: [1, 60], TVD: [0.01, 12000],
};
const wellDrillInfo = new Map();
let drillScreenedTotal = 0;
for (const [well, pick] of drillBy) {
  const m = pick.meta;
  const out = {
    well, run: m.run, folder: m.folder, format: m.format,
    dataNature: m.dataNature ?? 'measured', source_id: m.source_id,
    depth_unit: m.depth_unit, md: m.md, curves: {},
  };
  const screened = {};
  const allNull = [];
  for (const [canon, r] of Object.entries(pick.resolved)) {
    const raw = m.values[r.valueKey] || [];
    const range = DRILL_RANGE[canon];
    let nScreened = 0;
    const values = raw.map((v) => {
      if (v == null || !Number.isFinite(v)) return null;
      if (range && (v < range[0] || v > range[1])) { nScreened++; return null; }
      return v;
    });
    const live = values.filter((v) => v != null).length;
    if (nScreened) { screened[canon] = nScreened; drillScreenedTotal += nScreened; }
    // a channel with no live value at all is recorded as PRESENT-BUT-EMPTY rather than
    // quietly omitted — "the tool logged nothing" is itself a finding
    if (live === 0) allNull.push(canon);
    out.curves[canon] = { source: r.source, unit: r.unit, values, screened: nScreened || undefined, allNull: live === 0 || undefined };
  }
  // ── HOLE SECTIONS / CASING POINTS ──────────────────────────────────────────
  // Bit diameter is a MEASURED channel, and every step-down in it is a real hole-section
  // boundary: you drill a section, run and cement casing, then drill on with a smaller
  // bit. So the depth where BDIA changes IS the casing point. This is the only casing
  // information recoverable from what was mirrored — the CasingSeat / StressCheck /
  // WellPlan folders are all _NOT_MIRRORED stubs.
  //
  // The casing SIZE paired with each hole size is the standard North Sea program, and is
  // labelled `conventional` — it is an industry convention, not a measurement from this
  // well. The hole size and the depth are measured; the casing size is not.
  const CASING_FOR_HOLE = { 36: 30, 26: 20, 17.5: 13.375, 12.25: 9.625, 8.5: 7 };
  const sections = [];
  {
    const bs = out.curves.BITSIZE?.values ?? [];
    const md = m.md ?? [];
    let cur = null, top = null;
    for (let i = 0; i < bs.length; i++) {
      const v = bs[i];
      if (v == null || !Number.isFinite(v)) continue;
      const r = Math.round(v * 100) / 100;
      if (cur === null) { cur = r; top = md[i]; continue; }
      if (Math.abs(r - cur) > 0.01) {
        sections.push({ bitSizeIn: cur, topMd: top, baseMd: md[i] });
        cur = r; top = md[i];
      }
    }
    if (cur !== null) sections.push({ bitSizeIn: cur, topMd: top, baseMd: md.length ? md[md.length - 1] : null });
  }
  for (const s of sections) {
    const c = CASING_FOR_HOLE[s.bitSizeIn];
    s.casingIn = c ?? null;
    s.casingBasis = c ? `conventional casing for a ${s.bitSizeIn} in hole — not measured in this well` : null;
    // a step DOWN in hole size means casing was set at this depth
    s.casingPointMd = s.baseMd;
  }
  if (sections.length) out.sections = sections;

  out.qc = {
    screenedOutOfRange: screened,
    allNullCurves: allNull,
    holeSections: sections.length,
    note: Object.keys(screened).length || allNull.length
      ? 'Values physically impossible for the channel (e.g. mud temperature below -20 degC, density <= 0 sg) were set to null and counted; operational zeros are preserved.'
      : null,
  };
  w(`drill-${slug(well)}.json`, out);
  wellDrillInfo.set(well, { n: m.md.length, curves: Object.keys(out.curves), screened: Object.keys(screened).length, allNull: allNull.length });
}
console.log(`[wb] drilling parameters: ${wellDrillInfo.size} wellbores (mud logs), ${drillScreenedTotal} impossible values screened to null`);

// ── 2c · FORMATION PRESSURE (pressure-while-drilling / MDT stations) ─────────
// data-energy/processed/pressure/*.json are decoded FPWD runs — real measured
// formation-pressure tests. They were decoded but never reached the workspace.
// One emitted file per WELLBORE, merging that wellbore's runs, keeping only the
// engineering channels (quartz-gauge pressure/temperature, annular, flowline) —
// the raw motor/status telemetry is dropped as it has no interpretive value here.
// Channel aliases per canonical measurement. Order is preference, but a channel is
// only accepted if it actually CARRIES live values — in these Volve decodes the
// surface-corrected `*_SF` channels are declared in the header yet written entirely
// empty, while the raw gauge channels (AQAP/FSAP/ASAP) hold the real measurement.
// Picking by declaration order alone would have shipped 7 wells of all-null pressure.
const PRESS_CURVES = {
  DEPTH: [/^DEPTH$/], TIME: [/^TIME$/],
  PQUARTZ: [/^ACQ_SF$/, /^AQAP_F$/, /^AQAP$/],   // quartz gauge pressure (bar) — the measurement
  TQUARTZ: [/^ACQ_SF_TMP$/, /^AQAT$/],           // quartz gauge temperature (degC)
  PFLOW: [/^FLS_SF$/, /^FSAP_F$/, /^FSAP$/],     // flowline pressure (bar)
  TFLOW: [/^FLS_SF_TMP$/, /^FSAT$/],             // flowline temperature (degC)
  PANNULUS: [/^ANS_SF$/, /^ASAP_F$/, /^ASAP$/],  // annular pressure (bar)
  TANNULUS: [/^ANS_SF_TMP$/, /^ASAT$/],          // annular temperature (degC)
  PSMOOTH: [/^PRES_SMO$/],                       // smoothed pressure
  STATION: [/^STATION_NUMBER$/],
};
// Physical bounds — a downhole gauge cannot read 2,961,276 bar (a sentinel these
// files carry undeclared). Out-of-range values become null and are counted.
const PRESS_RANGE = {
  PQUARTZ: [0, 2000], PFLOW: [0, 2000], PANNULUS: [0, 2000], PSMOOTH: [0, 2000], // bar
  TQUARTZ: [-20, 250], TFLOW: [-20, 250], TANNULUS: [-20, 250],                  // degC
  DEPTH: [0, 12000],
};
let pressScreenedTotal = 0;
const pressDir = join(P, 'pressure');
const wellPressInfo = new Map();
if (existsSync(pressDir)) {
  const pressBy = new Map();
  for (const f of readdirSync(pressDir).filter((x) => x.endsWith('.json'))) {
    const meta = j(join(pressDir, f));
    const well = resolveWb(meta.source_well ?? meta.well);
    if (!well) continue;
    // pressure files use a flat `data` array-of-arrays keyed by `curves` order
    const idx = {};
    (meta.curves || []).forEach((c, i) => { idx[c.mnemonic] = i; });
    // rows are needed BEFORE resolution, so a channel can be tested for live values
    let probeRows = meta.preview || [];
    if (meta.full_ref) {
      const fp = join(P, meta.full_ref);
      if (existsSync(fp)) {
        const full = j(fp);
        const fr = Array.isArray(full) ? full : (full.rows || full.data || full.preview);
        if (Array.isArray(fr) && fr.length) probeRows = fr;
      }
    }
    const nullV0 = meta.null_value;
    const liveCount = (col, range) => {
      let n = 0;
      for (const row of probeRows) {
        const v = row[col];
        if (v == null || !Number.isFinite(v)) continue;
        if (nullV0 != null && Math.abs(v - nullV0) < 1e-6) continue;
        if (range && (v < range[0] || v > range[1])) continue;
        n++;
      }
      return n;
    };
    const resolved = {};
    for (const [canon, rxs] of Object.entries(PRESS_CURVES)) {
      for (const rx of rxs) {
        const hit = Object.keys(idx).find((m) => rx.test(m));
        if (!hit) continue;
        if (liveCount(idx[hit], PRESS_RANGE[canon]) === 0) continue; // declared but empty
        resolved[canon] = { col: idx[hit], source: hit, unit: (meta.curves[idx[hit]] || {}).unit || '' };
        break;
      }
    }
    if (!resolved.PQUARTZ) continue; // no actual pressure measurement — skip honestly
    // Rows live in `preview` (a decimated view) with `full_ref` pointing at the
    // complete decode. Prefer the FULL file — a pressure test read at 1/3 density
    // can miss the drawdown/buildup inflections the whole measurement exists for.
    let rows = meta.preview || [];
    let rowSource = 'preview';
    if (meta.full_ref) {
      const fullPath = join(P, meta.full_ref);
      if (existsSync(fullPath)) {
        const full = j(fullPath);
        const fr = Array.isArray(full) ? full : (full.rows || full.data || full.preview);
        if (Array.isArray(fr) && fr.length) { rows = fr; rowSource = 'full'; }
      }
    }
    const runs = pressBy.get(well) ?? [];
    runs.push({ meta, resolved, file: f, rows, rowSource });
    pressBy.set(well, runs);
  }
  for (const [well, runs] of pressBy) {
    const out = {
      well, dataNature: 'measured', kind: 'formation-pressure',
      source_id: runs[0].meta.source_id ?? null,
      runs: runs.map((r) => {
        const rows = r.rows || [];
        const nullV = r.meta.null_value;   // FPWD decodes declare -999.25
        const series = {};
        for (const [canon, spec] of Object.entries(r.resolved)) {
          const range = PRESS_RANGE[canon];
          let screened = 0;
          const values = rows.map((row) => {
            const v = row[spec.col];
            if (v == null || !Number.isFinite(v)) return null;
            if (nullV != null && Math.abs(v - nullV) < 1e-6) return null;   // declared null
            if (range && (v < range[0] || v > range[1])) { screened++; return null; } // impossible
            return v;
          });
          pressScreenedTotal += screened;
          series[canon] = { source: spec.source, unit: spec.unit, values, screened: screened || undefined };
        }
        return {
          run: r.meta.run ?? null, test: r.meta.test ?? null,
          index_kind: r.meta.index_kind ?? null,
          n_rows: rows.length,
          rows_source: r.rowSource,          // 'full' or 'preview' — provenance, not cosmetic
          declared_n_rows: r.meta.n_rows ?? null,
          source_id: r.meta.source_id ?? r.file,
          curves: series,
        };
      }),
    };
    w(`press-${slug(well)}.json`, out);
    wellPressInfo.set(well, { runs: out.runs.length, rows: out.runs.reduce((s, x) => s + (x.n_rows || 0), 0) });
  }
}
console.log(`[wb] formation pressure: ${wellPressInfo.size} wellbores`);

// ── picks (formation tops) ───────────────────────────────────────────────────
// ATTRIBUTION BUG: this used to gate on `m.well_id`, which the upstream decoder only
// populated for 109 of the 409 raw picks. The other 300 were emitted with well:null —
// present in the file but invisible to the app, because the audit, the curated
// inventory and the log/trajectory viewers all resolve picks BY WELL. F-14 alone lost
// 22 formation tops that were sitting in the raw .dat the whole time.
//
// `source_well` is present on EVERY row and normalises cleanly ("15/9-F-14" → "F-14"),
// so attribution now runs off that — but ONLY when it resolves to a wellbore this
// bundle actually carries. The raw pick file covers the wider Sleipner area (15/5-7 A,
// the 15/9-A/B/C platform wells, a 15/9-F-12 pilot hole, 15/9-19 B); those are real
// picks for wells outside this delivery and stay deliberately unattributed rather than
// being forced onto a lookalike wellbore.
const markersRaw = j(join(P, 'formation-markers.json'));
const markers = Array.isArray(markersRaw) ? markersRaw : markersRaw.markers || markersRaw.picks;
const knownWb = new Set([
  ...wbMaster,
  ...trajBy.keys(), ...wellLogInfo.keys(), ...prodBy.keys(),
  ...wellDrillInfo.keys(), ...wellPressInfo.keys(),
]);
// SLOT MATCH. Two real Volve wellbores carry formation tops but appear in NO other
// dataset — "19 B" (a sidetrack of the 19 discovery well) and "F-12 pilot" (F-12's
// pilot hole). Keying only on exact wellbore identity dropped them, and because the
// orphan pass below never looked at picks, they had no row in index.json at all: a
// wellbore whose ONLY data is formation tops was invisible end to end.
//
// A wellbore drilled from the same SLOT as a known bundle wellbore belongs to this
// delivery. That is derived from the data, not hardcoded — and it correctly leaves out
// the genuinely-foreign wells in the same pick file (15/5-7 A in another quadrant, the
// 15/9-A-15 / B-6 / C-2* Sleipner platform wells, and exploration wells 15/9-4/8/11/17),
// none of which share a slot with anything in this bundle.
const slotOf = (n) => (n ? (n.match(/^(F-\d+|\d+)(?=\s|$)/) || [])[1] ?? null : null);
const bundleSlots = new Set([...knownWb].map(slotOf).filter(Boolean));
let picksAttributed = 0;
const outsideDelivery = new Set();
const picksByWellbore = new Set();
const pickRows = markers.map((m) => {
  const c = resolveWb(m.source_well);
  const slot = slotOf(c);
  const inBundle = !!c && (knownWb.has(c) || (!!slot && bundleSlots.has(slot)));
  if (inBundle) { picksAttributed++; picksByWellbore.add(c); }
  else if (m.source_well) outsideDelivery.add(String(m.source_well));
  return {
    well: inBundle ? c : null,
    source_well: m.source_well, surface: m.surface,
    md: m.md, tvdss: m.tvdss, tvd: m.tvd ?? null,
    qlf: m.qlf ?? null,                       // ER/FP/FO/NL/NR — why a pick is qualified
    interpreter: m.interpreter ?? null,
    source_id: m.source_id,
  };
});
w('picks.json', {
  dataNature: 'interpreted',
  picks: pickRows,
  attributed: picksAttributed,
  outsideDelivery: [...outsideDelivery].sort(),
});
console.log(`[wb] formation tops: ${pickRows.length} picks, ${picksAttributed} attributed to bundle wellbores, ${pickRows.length - picksAttributed} for wells outside this delivery (${outsideDelivery.size} wells)`);

// production monthly per wellbore + field. Volume fields (oil/gas/water/wi) SUM;
// pressure fields (BHP/THP) are FLOWING averages (only rows with on_stream_hrs>0 and
// a valid gauge reading count — a shut-in day's reading is not representative); uptime
// is Σhrs / (calendar-days·24). BHP/THP/uptime are the Reservoir-Management surveillance
// signals (measured; 6,667 daily BHP + 8,768 THP readings in source).
const MON = {};
for (const r of prod.daily_rows) {
  const wl = normWb(r.source_well_bore_name);
  const ym = r.date.slice(0, 7);
  const k = wl + '|' + ym;
  const a = MON[k] ?? (MON[k] = { well: wl, ym, oil: 0, gas: 0, water: 0, wi: 0, bhpSum: 0, bhpN: 0, thpSum: 0, thpN: 0, hrs: 0, days: 0 });
  a.oil += r.bore_oil_vol || 0; a.gas += r.bore_gas_vol || 0; a.water += r.bore_wat_vol || 0; a.wi += r.bore_wi_vol || 0;
  const hrs = +r.on_stream_hrs || 0; a.hrs += hrs; a.days += 1;
  const bhp = +r.avg_downhole_pressure; if (Number.isFinite(bhp) && bhp > 1 && hrs > 0) { a.bhpSum += bhp; a.bhpN++; }
  const thp = +r.avg_whp_p; if (Number.isFinite(thp) && thp > 1 && hrs > 0) { a.thpSum += thp; a.thpN++; }
}
const monRows = Object.values(MON);
const shapeMon = (r) => ({
  ym: r.ym, oil: Math.round(r.oil), gas: Math.round(r.gas), water: Math.round(r.water), wi: Math.round(r.wi),
  bhp: r.bhpN ? Math.round((r.bhpSum / r.bhpN) * 10) / 10 : null,
  thp: r.thpN ? Math.round((r.thpSum / r.thpN) * 10) / 10 : null,
  hrs: Math.round(r.hrs),
  uptime: r.days ? Math.round((r.hrs / (r.days * 24)) * 1000) / 1000 : null,
});
const prodWells = [...new Set(monRows.map((r) => r.well))];
let bhpMonths = 0, thpMonths = 0;
for (const wl of prodWells) {
  const rows = monRows.filter((r) => r.well === wl).sort((a, b) => a.ym.localeCompare(b.ym)).map(shapeMon);
  bhpMonths += rows.filter((r) => r.bhp != null).length; thpMonths += rows.filter((r) => r.thp != null).length;
  w(`prod-${slug(wl)}.json`, { well: wl, dataNature: 'reported', units: 'Sm3 as sourced', source_id: prod.source_id, monthly: rows });
}
// field aggregate: volumes + uptime SUM; per-well pressures do not average across wells (left null).
const fieldMonthly = {};
for (const r of monRows) {
  const a = fieldMonthly[r.ym] ?? (fieldMonthly[r.ym] = { ym: r.ym, oil: 0, gas: 0, water: 0, wi: 0, hrs: 0, days: 0 });
  a.oil += r.oil; a.gas += r.gas; a.water += r.water; a.wi += r.wi; a.hrs += r.hrs;
}
w('prod-field.json', {
  well: 'FIELD', dataNature: 'reported', units: 'Sm3', source_id: prod.source_id,
  monthly: Object.values(fieldMonthly).sort((a, b) => a.ym.localeCompare(b.ym)).map((r) => ({
    ym: r.ym, oil: Math.round(r.oil), gas: Math.round(r.gas), water: Math.round(r.water), wi: Math.round(r.wi),
    bhp: null, thp: null, hrs: Math.round(r.hrs), uptime: null,
  })),
});

// trajectories per well
let trajN = 0;
for (const [well, t] of trajBy) {
  w(`traj-${slug(well)}.json`, { well, dataNature: 'measured', classification: t.classification, source: t.chosen_source_file, stations: t.stations });
  trajN++;
}

// wells master (map locations from wellbore masters)
const hasFor = (c) => ({
  logs: wellLogInfo.has(c), traj: trajBy.has(c), production: prodBy.has(c),
  // resolved the SAME way picks were attributed above (slot-aware), so a wellbore
  // whose only data is formation tops is flagged rather than reading as empty
  picks: picksByWellbore.has(c),
  drilling: wellDrillInfo.has(c), pressure: wellPressInfo.has(c),
});
// ── WELLBORE ROLE, from the REGULATOR — not from "does it have a production file" ──
// This used to be derived solely from production.json's flow_kinds, so any bore without
// a production time series fell to 'none'. That was wrong for more than half the field:
// F-1 B is a WATER INJECTOR, F-7 / F-9 / F-9 A are WATER PRODUCERS (the injection-water
// source wells), F-15 C is an OIL PRODUCER, and F-11 — which we labelled a producer —
// is an OBSERVATION bore whose producing sidetrack is F-11 B.
//
// Sodir publishes `purpose` + `content` per wellbore and we already ship it in
// public/nsr/nsr-wellbores.json. Purpose says what the bore is FOR; content says what it
// flows. PRODUCTION+WATER is a water-supply well, not an oil producer — the distinction
// the old rule could not make. Reproduces the published Volve inventory exactly:
// 6 oil producers · 3 water injectors · 3 water producers · 8 observation = 20 branches.
const NSR_WB = join(APP, 'public', 'nsr', 'nsr-wellbores.json');
const nsrPurpose = new Map();
if (existsSync(NSR_WB)) {
  for (const ft of (j(NSR_WB).features ?? [])) {
    const p = ft.properties;
    if (!p?.name || p.field !== 'VOLVE') continue;
    nsrPurpose.set(normWb(p.name), { purpose: p.purpose ?? null, content: p.content ?? null, status: p.status ?? null, npdid: p.npdid ?? null });
  }
}
const roleFromRegulator = (c) => {
  const r = nsrPurpose.get(c);
  if (!r) return null;
  if (String(r.status ?? '').toUpperCase().includes('NEVER')) return 'not-drilled';
  const water = String(r.content ?? '').toUpperCase() === 'WATER';
  switch (String(r.purpose ?? '').toUpperCase()) {
    case 'INJECTION': return 'water-injector';
    // A PRODUCTION well whose content is WATER is a shallow water-SUPPLY well feeding
    // the injectors (Volve's F-7/F-9/F-9 A bottom out near 1085 m — a mile above Hugin).
    // It is not a reservoir well at all, so it never sits with the producers.
    case 'PRODUCTION': return water ? 'water-supply' : 'oil-producer';
    case 'OBSERVATION': return 'observation';
    case 'APPRAISAL': return 'appraisal';
    case 'WILDCAT': return 'exploration';
    default: return null;
  }
};
/** What the ingested production series actually shows this bore doing — kept as a
 *  SECOND opinion beside the regulator purpose, never overwriting it. */
const observedFlow = (pr) => (!pr ? null
  : pr.flow_kinds.includes('injection') && pr.flow_kinds.includes('production') ? 'injection+production'
  : pr.flow_kinds.includes('injection') ? 'injection' : 'production');
const roleFor = (pr, c) => roleFromRegulator(c)
  // no regulator row (orphan bores like F-12 pilot): fall back to what it flowed
  ?? (!pr ? 'none'
    : pr.flow_kinds.includes('injection') && !pr.flow_kinds.includes('production') ? 'water-injector'
      : 'oil-producer');

// A wellbore drilled from the surface reports this as its parent — i.e. it IS the
// mother bore of its wellhead. Anything else names the bore it kicked off from.
const FROM_SURFACE = /^well\s*ref\.?\s*point$/i;
const kickoffM = (s) => {
  const m = String(s ?? '').match(/([\d.]+)/);
  return m ? Number(m[1]) : null;
};

const wells = wellbores.map((wb) => {
  const c = normWb(wb.wellbore_name);
  const from = wb.drilled_from && !FROM_SURFACE.test(String(wb.drilled_from).trim())
    ? normWb(wb.drilled_from) : null;
  return {
    name: c, well: normWb(wb.well_name), x: wb.surface_ew_m ?? null, y: wb.surface_ns_m ?? null,
    td_md: wb.bottom_hole_md_m ?? null, td_tvd: wb.bottom_hole_tvd_m ?? null, kb: wb.kb_msl ?? null,
    // WELLHEAD → WELLBORE GENEALOGY, from the NPD survey header's own `drilled_from`.
    // This is the real structure: one wellhead (surface slot) carries a mother bore
    // and a chain of sidetracks. Volve's F-11 is the clearest case — the mother bore
    // reaches only 347 m, was sidetracked immediately, and every later bore hangs off
    // F-11 T2. Treating these as 4 peer "wells" (as this file used to) misreads the
    // asset badly: it makes a 347 m stub look like a producer.
    drilled_from: from,
    is_mother: from === null,
    kickoff_md: kickoffM(wb.kick_off_depth),
    role: roleFor(prodBy.get(c), c),
    // the regulator's own words, carried so the UI can show WHY a bore has its role
    purpose: nsrPurpose.get(c)?.purpose ?? null,
    content: nsrPurpose.get(c)?.content ?? null,
    npdid: nsrPurpose.get(c)?.npdid ?? null,
    observedFlow: observedFlow(prodBy.get(c)),
    has: hasFor(c),
    is_exploration: /^19/.test(normWb(wb.well_name)),
  };
});

// Union in wellbores that HAVE data but carry no wellbore-master record. Without
// this a real sidetrack (Volve's F-15 S has a 101-station survey) is emitted to
// public/wb but never referenced by index.json, so the app silently never loads
// it. Flagged `no_master_record` so consumers can see the provenance gap rather
// than inherit a fabricated master row.
const known = new Set(wells.map((x) => x.name));
const orphans = new Set();
for (const c of trajBy.keys()) if (!known.has(c)) orphans.add(c);
for (const c of wellLogInfo.keys()) if (!known.has(c)) orphans.add(c);
for (const c of prodBy.keys()) if (!known.has(c)) orphans.add(c);
for (const c of wellDrillInfo.keys()) if (!known.has(c)) orphans.add(c);
for (const c of wellPressInfo.keys()) if (!known.has(c)) orphans.add(c);
// picks-only wellbores ("19 B", "F-12 pilot") — without this a wellbore carrying
// nothing but formation tops never gets a row and its picks vanish from the app
for (const c of picksByWellbore) if (!known.has(c)) orphans.add(c);
// An orphan bore still belongs to a WELLHEAD. Using its own name as the wellhead
// (as this did) spun "19 B", "F-12 pilot" and "F-15 S" out into phantom single-bore
// slots instead of filing them under 19, F-12 and F-15 where they were drilled.
const slotOfBore = (n) => (n.match(/^(F-\d+|\d+)(?=\s|$)/) || [])[1] ?? n;
for (const c of [...orphans].sort()) {
  wells.push({
    name: c, well: slotOfBore(c), x: null, y: null, td_md: null, td_tvd: null, kb: null,
    drilled_from: null, is_mother: false, kickoff_md: null,
    role: roleFor(prodBy.get(c), c),
    purpose: nsrPurpose.get(c)?.purpose ?? null,
    content: nsrPurpose.get(c)?.content ?? null,
    npdid: nsrPurpose.get(c)?.npdid ?? null,
    observedFlow: observedFlow(prodBy.get(c)),
    has: hasFor(c),
    is_exploration: /^19/.test(c), no_master_record: true,
  });
  console.log(`[wb] wellbore "${c}" has data but no wellbore-master record — included, flagged no_master_record`);
}

// ── 2a′ · WELLHEAD → WELLBORE tree ───────────────────────────────────────────
// A wellhead is the surface slot; under it sit the mother bore and its sidetracks.
// The chain comes from each bore's own `drilled_from` (NPD survey header), never
// from parsing the name — "F-11 A" is NOT necessarily drilled from "F-11" (it is
// actually drilled from F-11 T2), so a name-suffix rule would invent a wrong tree.
//
// WHY THIS MATTERS FOR PRODUCTION. Volve reports F-11's volumes against the bare
// name "15/9-F-11", which is both the wellhead AND the 347 m mother bore. The mother
// cannot be the source — Hugin is at ~3000 m. The producing bore is the deepest
// terminal sidetrack (F-11 B, 4770 m). So volumes are rolled up to the WELLHEAD and
// the physically-producing bore is named explicitly, with the basis recorded.
{
  const byName = new Map(wells.map((x) => [x.name, x]));
  // orphans (no master row) have no drilled_from; attach them to their slot only
  const slotOfName = (n) => (n.match(/^(F-\d+|\d+)(?=\s|$)/) || [])[1] ?? n;
  for (const x of wells) if (!x.well) x.well = slotOfName(x.name);

  const heads = new Map();
  for (const x of wells) {
    const h = heads.get(x.well) ?? { well: x.well, bores: [] };
    h.bores.push(x);
    heads.set(x.well, h);
  }

  const wellheads = [...heads.values()].map((h) => {
    // a bore is TERMINAL when nothing else was drilled from it
    const parents = new Set(h.bores.map((b) => b.drilled_from).filter(Boolean));
    for (const b of h.bores) b.is_terminal = !parents.has(b.name);

    // generation = how many kick-offs deep this bore sits (mother = 0)
    for (const b of h.bores) {
      let g = 0, cur = b, guard = 0;
      while (cur?.drilled_from && guard++ < 12) { cur = byName.get(cur.drilled_from); g++; }
      b.generation = g;
    }

    // A parent named by `drilled_from` that we hold NO record for is a real gap in the
    // genealogy, not an error — Volve's 19 SR was drilled from "19 S", which has no
    // master row and no data. Recorded so the chain reads as broken-with-a-reason
    // rather than silently rooting the child as if it came off the wellhead.
    const missingAncestors = [...new Set(
      h.bores.map((b) => b.drilled_from).filter((p) => p && !byName.has(p)),
    )];

    // The deepest TERMINAL bore is the one that reached the reservoir last and is
    // the completed producer wherever production exists — verified against Volve:
    // F-11→F-11 B, F-15→F-15 D, F-1→F-1 C, each of which is the reported producer.
    const terminals = h.bores.filter((b) => b.is_terminal && b.td_md != null);
    const deepest = terminals.sort((a, b) => (b.td_md ?? 0) - (a.td_md ?? 0))[0]
      ?? h.bores.slice().sort((a, b) => (b.td_md ?? 0) - (a.td_md ?? 0))[0] ?? null;
    for (const b of h.bores) b.is_deepest = !!deepest && b.name === deepest.name;

    // which bore the production series is filed against, and which bore it can
    // physically have come from
    const filedOn = h.bores.find((b) => b.has.production)?.name ?? null;
    let producedBy = filedOn, basis = null;
    if (filedOn && deepest && filedOn !== deepest.name) {
      const filed = byName.get(filedOn);
      // only re-attribute when the filed bore demonstrably cannot be the source
      if (filed && filed.td_md != null && deepest.td_md != null && deepest.td_md > filed.td_md * 1.5) {
        producedBy = deepest.name;
        basis = `filed against ${filedOn} (TD ${filed.td_md} m) — too shallow to be the source; attributed to the deepest terminal bore ${deepest.name} (TD ${deepest.td_md} m)`;
      }
    }

    const anyHas = (k) => h.bores.some((b) => b.has[k]);
    return {
      well: h.well,
      x: h.bores.find((b) => b.x != null)?.x ?? null,
      y: h.bores.find((b) => b.y != null)?.y ?? null,
      is_exploration: h.bores.every((b) => b.is_exploration),
      role: h.bores.map((b) => b.role).find((r) => r && r !== 'none') ?? 'none',
      bores: h.bores
        .sort((a, b) => a.generation - b.generation || a.name.localeCompare(b.name, 'en', { numeric: true }))
        .map((b) => b.name),
      motherBore: h.bores.find((b) => b.is_mother)?.name ?? null,
      missingAncestors,
      deepestBore: deepest?.name ?? null,
      productionFiledOn: filedOn,
      producedBy,
      productionBasis: basis,
      // wellhead-level rollup: what data EXISTS anywhere under this slot
      has: {
        logs: anyHas('logs'), traj: anyHas('traj'), picks: anyHas('picks'),
        production: anyHas('production'), drilling: anyHas('drilling'), pressure: anyHas('pressure'),
      },
    };
  }).sort((a, b) => a.well.localeCompare(b.well, 'en', { numeric: true }));

  // expose on the index alongside the flat wellbore list (which stays, so nothing
  // that reads `wells` breaks — the tree is additive)
  globalThis.__WELLHEADS__ = wellheads;
  const reattributed = wellheads.filter((h) => h.productionBasis);
  console.log(`[wb] wellheads: ${wellheads.length} slots over ${wells.length} wellbores; ${reattributed.length} production series re-attributed to a deeper terminal bore`);
  for (const h of reattributed) console.log(`[wb]   ${h.well}: ${h.productionBasis}`);
}

// ── 2b · Pattern definitions (Reservoir Management default) ──────────────────
// Deterministic, user-adjustable default: each injector is associated with its
// nearest producers by SURFACE distance. Physics-based injector→producer allocation
// comes later from the streamline engine (R4); this is the surveillance grouping seed.
// Match the role by MEANING, not by an exact literal: this file has emitted more than
// one role vocabulary ('injector'/'producer'/'both' and 'water-injector'/'oil-producer'/
// 'observation'), and an exact match silently produced an EMPTY patterns.json — which
// then blanked every pattern VRR downstream in Reservoir Management.
const isInj = (r) => /inject|both/i.test(r ?? '');
const isProd = (r) => /produc|both/i.test(r ?? '');
const injWells = wells.filter((x) => x.has.production && isInj(x.role) && x.x != null && x.y != null);
const prodOnly = wells.filter((x) => x.has.production && isProd(x.role) && x.x != null && x.y != null);
const patterns = injWells.map((iw) => ({
  injector: iw.name,
  producers: prodOnly.filter((p) => p.name !== iw.name)
    .map((p) => ({ well: p.name, distM: Math.round(Math.hypot(p.x - iw.x, p.y - iw.y)) }))
    .sort((a, b) => a.distM - b.distM).slice(0, 4),
}));
w('patterns.json', {
  dataNature: 'derived',
  method: 'nearest-producer by surface distance (default; user-adjustable in Reservoir Management)',
  injectors: injWells.map((x) => x.name), producers: prodOnly.map((x) => x.name), patterns,
});

// ── 3 · Index + VALIDATION GATES (Fable) ─────────────────────────────────────
// Fluid params sourced from the RELEASED VOLVE ECLIPSE DECK (f0nzie/volve_eclipse_reservoir
// VOLVE_2016.PRT — PVTO/DENSITY/EQUIL/RSVD, main-field PVT region 1) — supersedes literature
// estimates. Bo at datum ≈1.47 (live oil, undersaturated at Pi 337 bara, Rs~148 Sm3/Sm3);
// the earlier 1.18 was near dead-oil and overstated STOIIP ~25%. The released deck
// baseline is OWC 3200 m (EQUIL main structure); the active interpreted case revises
// that contact to 3065 m. Datum 3060 mTVDSS. Densities kg/m3. [DECK + USER REVISION]
const OWC = 3065;
const defaults = { phi: 0.225, ntg: 0.90, sw: 0.20, rhoMa: 2.65, archie: { a: 1, m: 2, n: 2 }, bo: 1.47, rf: [0.46, 0.54] };
const contacts = [{ kind: 'OWC', tvdss: OWC, dataNature: 'interpreted', prov: 'User-selected STOIIP-calibrated screening contact; deck EQUIL baseline 3200 m' }];
const pvt = {
  Bo: 1.47, Bo_note: 'live-oil Bo at datum 3060m, undersaturated at Pi 337 bara, Rs~148 [DECK PVTO region 1]',
  Rs: 148, Pi: 337, Pb: 256, T: 110, datum_tvdss: 3060,
  density_kgm3: { oil: 882.0, water: 1101.3, gas: 1.09956 }, rock: { pref_bara: 329, cf: 2.0e-5 },
  source: 'VOLVE_2016.PRT (Eclipse METRIC) — pvt_input_new_combined_PVDG…E100',
};

// STOIIP corridor check from the REAL grids (deterministic screening volumetrics).
// Uses the CREST-CONNECTED closure (flood-fill from the structural crest over cells
// with top < OWC) — the structural trap — not the whole mapped extent. The published
// dynamic-model ≈22 MMSm³ comes from a 29-fault model with per-compartment WOC; an
// unfaulted blanket-OWC screening closure legitimately reads higher.
function stoiipCheck() {
  const top = grids.hugin_top, base = grids.hugin_base;
  if (!top || !base) return { ok: false, why: 'missing grids' };
  const owc = OWC;
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
  // This is a GROSS SCREENING volumetric: a blanket interpreted OWC over the
  // UNFAULTED mapped closure. At the 3200 m deck baseline it is an upper bound; a
  // shallower interpreted scenario can fall below the official/dynamic estimates and
  // must be labelled as a scenario, not as truth. The contact-specific gate catches
  // gross grid/parameter errors without pretending every contact should reproduce the
  // field-accounting number. The TIGHT published-truth gate is cum-oil (below).
  const gate = OWC === 3065 ? { min: 15, max: 25, basis: 'STOIIP-calibrated 3065 m contact scenario' }
    : { min: 40, max: 220, basis: 'deck-range screening scenario' };
  return {
    ok: mm >= gate.min && mm <= gate.max, gateMMSm3: gate, grvMm3: Math.round(grv / 1e6), stoiipMMSm3: Math.round(mm * 10) / 10,
    cells, crestZ: Math.round(crestZ * 10) / 10, owc: OWC,
    method: `gross screening scenario: blanket interpreted OWC ${OWC}m (deck baseline 3200m) over unfaulted closure`,
    interpretation: OWC === 3065
      ? 'user-selected STOIIP-calibrated screening contact; close to the official field estimate but not an observed field-wide OWC'
      : 'screening upper bound; tighter/per-compartment contacts + faults reduce toward the dynamic ≈22 MMSm³ (shown in Volumetrics scope tools)',
    references: { screening_note: 'method-dependent', volumetricAnalogue_MMSm3: 67.6, dynamicModel_MMSm3: 22, mbal_F12_MMSm3: 19.6 },
  };
}
const sto = stoiipCheck();

// ── OFFICIAL FIELD ACCOUNTING (Norwegian Offshore Directorate / Sodir) ────────
// THE CANONICAL VOLUMES. Everything this repo computes about Volve volumes must be
// read against these, not instead of them.
//
// WHY THIS BLOCK EXISTS: `stoiipCheck()` above is a GROSS SCREENING calculation — a
// blanket interpreted OWC over an unfaulted closure — and it returns a screening
// upper bound that is materially above the official field volume. At the former
// 3200 m deck baseline it was ~142 MMSm³, which was
// **7.6× the official 18.70 MMSm³**. Dividing real cumulative oil by it yields a ~7%
// recovery factor, when Volve actually recovered ~54%. Any dashboard that quoted the
// screening number as "STOIIP" would be wrong by an order of magnitude and would make
// a strongly-performing waterflood look like a failure.
//
// The bundle's own alternative estimates bracket the truth far better: MBAL on F-12
// gave 19.6 and the history-matched dynamic model gave 22 MMSm³ — both within ~20% of
// official. The screening figure is kept ONLY as a labelled upper bound.
const OFFICIAL = {
  authority: 'Norwegian Offshore Directorate (Sodir)',
  fieldNpdid: 3420717,
  reference: 'https://factpages.sodir.no/en/field/PageView/All/3420717',
  basis: 'current official field-accounting estimates',
  stoiipMMSm3: 18.70,           // 117.6 MMbbl
  recoverableOilMMSm3: 10.17,   //  64.0 MMbbl
  producedOilMMSm3: 10.171934,  // saleable, field life
  oilRecoveryFactor: 10.17 / 18.70,   // 0.544
  giipBcm: 2.80,
  recoverableGasBcm: 0.81,
  producedGasBcm: 0.812558,
  recoverableCondensateMMSm3: 0.09,
  recoverableNglMt: 0.16,
  totalRecoverableMMSm3oe: 11.38,
  remainingReserves: 0,          // field shut down
  discoveryYear: 1993,
  discoveryWellbore: '15/9-19 SR',
  pdoApproved: '2005-04',
  firstProduction: '2008-02-12',
  cessation: '2016-09-21',
  peakOilBopd: 56000,
  reservoir: 'Hugin Fm (Middle Jurassic, Vestland Gp)',
  reservoirDepthMbsl: [2700, 3100],
  drive: 'water injection',
};
// ── PER-WELLBORE PRODUCTION METRICS ──────────────────────────────────────────
// What a reservoir engineer sorts the well stock by: how much did it actually make,
// what is it doing now, and how wet is it. All measured from the monthly series.
const DAYS = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
const wellMetrics = new Map();
for (const wl of prodWells) {
  const rows = monRows.filter((r) => r.well === wl).sort((a, b) => a.ym.localeCompare(b.ym)).map(shapeMon);
  const flowing = rows.filter((r) => (r.oil ?? 0) > 0 || (r.wi ?? 0) > 0);
  const cumOil = rows.reduce((n, r) => n + (r.oil || 0), 0);
  const cumGas = rows.reduce((n, r) => n + (r.gas || 0), 0);
  const cumWater = rows.reduce((n, r) => n + (r.water || 0), 0);
  const cumWi = rows.reduce((n, r) => n + (r.wi || 0), 0);
  // rate = monthly volume / days in that month (Sm3/d)
  const rateOf = (r) => (r.oil || 0) / DAYS(r.ym);
  const oilMonths = rows.filter((r) => (r.oil || 0) > 0);
  const peak = oilMonths.length ? oilMonths.reduce((a, b) => (rateOf(b) > rateOf(a) ? b : a)) : null;
  const last = oilMonths.length ? oilMonths[oilMonths.length - 1] : null;
  const wct = (r) => { const t = (r.oil || 0) + (r.water || 0); return t > 0 ? (r.water || 0) / t : null; };
  wellMetrics.set(wl, {
    cumOilSm3: Math.round(cumOil), cumGasSm3: Math.round(cumGas),
    cumWaterSm3: Math.round(cumWater), cumInjectedSm3: Math.round(cumWi),
    firstFlow: flowing[0]?.ym ?? null, lastFlow: flowing[flowing.length - 1]?.ym ?? null,
    months: flowing.length,
    peakOilRateSm3d: peak ? Math.round(rateOf(peak) * 10) / 10 : null,
    peakOilMonth: peak?.ym ?? null,
    lastOilRateSm3d: last ? Math.round(rateOf(last) * 10) / 10 : null,
    lastOilMonth: last?.ym ?? null,
    lastWaterCut: last ? (wct(last) == null ? null : Math.round(wct(last) * 1000) / 10) : null,
    // share of the FIELD's cumulative oil — an honest per-well number. A per-well
    // recovery factor is NOT emitted: it needs a per-well in-place volume, which no
    // source in this delivery provides, and inventing one would be a fabrication.
    shareOfFieldCumPct: null,
  });
}
{
  const fieldCum = [...wellMetrics.values()].reduce((n, m) => n + m.cumOilSm3, 0);
  for (const m of wellMetrics.values()) {
    m.shareOfFieldCumPct = fieldCum > 0 ? Math.round((m.cumOilSm3 / fieldCum) * 1000) / 10 : null;
  }
}
for (const wb of wells) {
  const m = wellMetrics.get(wb.name);
  if (m) wb.metrics = m;
}
// RE-ATTRIBUTE to the bore the volumes physically came from. Volve files F-11's
// production against the bare name "F-11" — a 347 m OBSERVATION stub — while the oil
// actually came from F-11 B. Without this the producer list shows F-11 B blank and
// hangs 7.2 MMbbl on an observation bore. `metricsFiledOn` keeps the audit trail.
for (const h of (globalThis.__WELLHEADS__ ?? [])) {
  if (!h.productionBasis || !h.producedBy || h.producedBy === h.productionFiledOn) continue;
  const from = wells.find((w) => w.name === h.productionFiledOn);
  const to = wells.find((w) => w.name === h.producedBy);
  if (!from?.metrics || !to) continue;
  to.metrics = { ...from.metrics, filedOn: h.productionFiledOn, attributionBasis: h.productionBasis };
  delete from.metrics;
  from.metricsFiledElsewhere = h.producedBy;
  console.log(`[wb] metrics re-attributed: ${h.productionFiledOn} -> ${h.producedBy}`);
}

// cum-oil reconcile: sum of daily oil vs published ~63 MMbbl (~10.0 MMSm3).
// THIS is the tight published-truth gate — validates the production decode exactly.
let cumOil = 0;
for (const r of prod.daily_rows) cumOil += r.bore_oil_vol || 0;
const cumMMSm3 = cumOil / 1e6;
const cumOk = cumMMSm3 > 9.0 && cumMMSm3 < 11.1; // 63 MMbbl ≈ 10.02 MMSm3 ±10%

// Reconcile what we computed against what the authority publishes, and SAY so.
const reconcile = {
  cumOilOursMMSm3: Math.round(cumMMSm3 * 100) / 100,
  cumOilOfficialMMSm3: OFFICIAL.producedOilMMSm3,
  cumOilDeltaPct: Math.round(((cumMMSm3 - OFFICIAL.producedOilMMSm3) / OFFICIAL.producedOilMMSm3) * 1000) / 10,
  stoiipScreeningMMSm3: sto.stoiipMMSm3,
  stoiipOfficialMMSm3: OFFICIAL.stoiipMMSm3,
  stoiipScreeningOverstatesBy: Math.round((sto.stoiipMMSm3 / OFFICIAL.stoiipMMSm3) * 10) / 10,
  rfUsingScreening: Math.round((cumMMSm3 / sto.stoiipMMSm3) * 1000) / 10,
  rfUsingOfficial: Math.round((cumMMSm3 / OFFICIAL.stoiipMMSm3) * 1000) / 10,
  note: 'Use OFFICIAL.stoiipMMSm3 (18.70) for any recovery-factor statement. The screening figure is a labelled upper bound only — it overstates in-place by ~7.6x and would imply a ~7% RF against a field that actually recovered ~54%.',
};
console.log(`[wb] official Sodir: STOIIP ${OFFICIAL.stoiipMMSm3} MMSm3, recovered ${OFFICIAL.producedOilMMSm3} MMSm3, RF ${(OFFICIAL.oilRecoveryFactor * 100).toFixed(1)}%`);
console.log(`[wb] reconcile: our cum oil ${reconcile.cumOilOursMMSm3} vs official ${reconcile.cumOilOfficialMMSm3} MMSm3 (${reconcile.cumOilDeltaPct}%); screening STOIIP overstates ${reconcile.stoiipScreeningOverstatesBy}x`);


w('index.json', {
  version: '1.0.0', generatedAt: new Date().toISOString(),
  crs: 'ED50 / UTM 31N', datum: 'TVDSS (m)',
  wells, wellheads: globalThis.__WELLHEADS__ ?? [], surfaces, contacts, pvt, defaults,
  official: OFFICIAL,
  validation: { stoiip: sto, cumOilMMSm3: Math.round(cumMMSm3 * 100) / 100, cumOilOk: cumOk, reconcile },
  provenance: { grids: 'binned mean-z from full horizon clouds (interpreted)', logs: 'measured/interpreted LFP-first', production: 'reported', defaults: 'published [PEER]/[COMMUNITY] — see V1-DATA-MAP.md' },
});

console.log(`[wb] wells ${wells.length} · surfaces ${surfaces.length} · log wells ${logWells} · traj ${trajN} · prod wells ${prodWells.length}`);
console.log(`[wb] surveillance: ${bhpMonths} well-months with BHP · ${thpMonths} with THP · ${patterns.length} injector patterns (${injWells.map((x) => x.name).join(', ') || 'none'})`);
console.log(`[wb] VALIDATE STOIIP screening: ${sto.stoiipMMSm3} MMSm3 (${sto.method}; gate ${sto.gateMMSm3.min}-${sto.gateMMSm3.max}) -> ${sto.ok ? 'PASS' : 'FAIL'}`);
console.log(`[wb] VALIDATE cum oil: ${cumMMSm3.toFixed(2)} MMSm3 (~${(cumMMSm3 * 6.2898).toFixed(1)} MMbbl vs published ~63) -> ${cumOk ? 'PASS' : 'FAIL'}`);
if (!sto.ok || !cumOk) process.exit(1);

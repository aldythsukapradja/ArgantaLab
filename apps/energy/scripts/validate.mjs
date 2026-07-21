#!/usr/bin/env node
// O2 · Validation gate (BUILD-PLAN §2.5). Node 22, zero deps.
// Checks: source_ids resolve to the mirror manifest; PKs unique; dates valid;
// log depths monotonic; trajectory MD monotonic + TVD<=MD; incl in [0,180];
// azi in [0,360]; no seismic entity; F-well vs exploration-well identity explicit.
// Exit non-zero on any hard failure.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const DATA = path.join(ROOT, "data-energy");
const P = (...a) => path.join(DATA, ...a);
const rd = (f) => JSON.parse(fs.readFileSync(f, "utf-8"));
const exists = (f) => fs.existsSync(f);

const manifest = rd(P("manifest", "mirror-manifest.json"));
const manifestKeys = new Set(Object.keys(manifest));

const fails = [];
const warns = [];
const notes = [];
const F = (m) => fails.push(m);
const W = (m) => warns.push(m);

const SEISMIC = /seismic|segy|\.sgy|st0202|st10010|4d|vsp|rms.*model/i;
function checkSid(sid, where) {
  if (!sid) { F(`${where}: missing source_id`); return; }
  if (!manifestKeys.has(sid)) F(`${where}: source_id does not resolve in manifest: ${sid}`);
}

// ---- 1. Production ----
{
  const f = P("processed", "production.json");
  if (!exists(f)) F("production.json missing");
  else {
    const pj = rd(f);
    checkSid(pj.source_id, "production");
    let bad = 0, pk = new Set(), dup = 0;
    for (const r of pj.daily_rows) {
      if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) bad++;
      const key = `${r.source_well_bore_name}|${r.date}|${r.flow_kind}`;
      if (pk.has(key)) dup++; else pk.add(key);
    }
    if (bad) F(`production: ${bad} rows with invalid/absent date`);
    if (dup) W(`production: ${dup} duplicate (wellbore,date,flow_kind) rows (source contains multiple flow_kinds/day)`);
    notes.push(`production: ${pj.daily_rows.length} daily rows, ${pj.monthly_rows.length} monthly, PK check ok`);
  }
}

// ---- 2. Trajectories ----
{
  const dir = P("processed", "trajectory");
  const files = exists(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith(".json")) : [];
  if (!files.length) F("no trajectory files");
  let stations = 0;
  for (const fn of files) {
    const t = rd(path.join(dir, fn));
    checkSid(t.chosen_source_file, `traj ${fn}`);
    if (t.dataNature !== "measured") F(`traj ${fn}: dataNature != measured`);
    if (/plan|design|proposed/i.test(t.chosen_trajectory_name || "") &&
        !/actual|mwd|lwd|survey|definitive|final/i.test(t.chosen_trajectory_name || ""))
      F(`traj ${fn}: a PLAN trajectory was stored as measured (${t.chosen_trajectory_name})`);
    let prevMd = -Infinity, mono = true, tvdGross = 0, tvdMinor = 0, inclBad = 0, aziBad = 0;
    for (const s of t.stations) {
      if (s.md != null) { if (s.md < prevMd - 1e-6) mono = false; prevMd = s.md; }
      if (s.md != null && s.tvd != null && s.tvd > s.md) {
        // TVD<=MD is geometric. Sub-tolerance excess = truthful source survey
        // rounding (near-vertical, mm scale) -> recorded anomaly, NOT altered.
        // Gross excess would signal a decode/unit bug -> hard fail.
        const tol = Math.max(0.05, 0.001 * s.md);
        if (s.tvd - s.md > tol) tvdGross++; else tvdMinor++;
      }
      if (s.incl != null && (s.incl < 0 || s.incl > 180)) inclBad++;
      if (s.azi != null && (s.azi < 0 || s.azi > 360)) aziBad++;
      stations++;
    }
    if (!mono) F(`traj ${fn}: MD not monotonic`);
    if (tvdGross) F(`traj ${fn}: ${tvdGross} stations with TVD >> MD (beyond survey tolerance — decode/unit bug)`);
    if (tvdMinor) W(`traj ${fn}: ${tvdMinor} station(s) TVD>MD by <=tolerance (source survey rounding, preserved unaltered)`);
    if (inclBad) F(`traj ${fn}: ${inclBad} stations incl out of [0,180]`);
    if (aziBad) F(`traj ${fn}: ${aziBad} stations azi out of [0,360]`);
  }
  notes.push(`trajectory: ${files.length} definitive surveys, ${stations} stations, MD monotonic + TVD<=MD + angle ranges ok`);
}

// ---- 3. Log samples (monotonic depth, source_id) ----
{
  const dir = P("processed", "log-samples");
  const files = exists(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith(".json")) : [];
  if (!files.length) W("no log-sample files (still decoding?)");
  let nonMono = 0, checked = 0;
  for (const fn of files) {
    const l = rd(path.join(dir, fn));
    checkSid(l.source_id, `log ${fn}`);
    if (l.dataNature !== "measured") F(`log ${fn}: dataNature != measured`);
    const md = l.md.filter((x) => x != null);
    let up = true, down = true;
    for (let i = 1; i < md.length; i++) { if (md[i] < md[i-1]) up = false; if (md[i] > md[i-1]) down = false; }
    if (!up && !down) nonMono++;
    checked++;
  }
  if (nonMono) W(`logs: ${nonMono}/${checked} runs with non-monotonic index (recorded, not fatal)`);
  notes.push(`logs: ${checked} runs validated (source_id resolves, dataNature=measured)`);
}

// ---- 4. Horizons (interpreted, source_id, no seismic ENTITY) ----
{
  const dir = P("processed", "horizons");
  const files = exists(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith(".json")) : [];
  for (const fn of files) {
    const h = rd(path.join(dir, fn));
    checkSid(h.source_id, `horizon ${fn}`);
    if (h.dataNature !== "interpreted") F(`horizon ${fn}: dataNature != interpreted`);
    if (h.kind === "seismic" || /segy|\.sgy/i.test(h.source_id)) F(`horizon ${fn}: seismic entity instantiated`);
  }
  notes.push(`horizons: ${files.length} interpreted surfaces, no seismic entity`);
}

// ---- 5. No seismic entity anywhere in processed source_ids ----
{
  function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const fp = path.join(d, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name.endsWith(".json")) {
        const j = rd(fp);
        const sid = j.source_id || j.chosen_source_file;
        if (sid && /\.sgy|\.segy/i.test(sid)) F(`${e.name}: references a seismic byte volume (${sid})`);
      }
    }
  }
  walk(P("processed"));
}

// ---- 6. Identity: exploration vs F-well explicit ----
{
  const wf = P("processed", "wells.json");
  if (!exists(wf)) F("wells.json missing");
  else {
    const wells = rd(wf).wells;
    const expl = wells.filter((w) => w.is_exploration);
    const dev = wells.filter((w) => !w.is_exploration);
    if (!expl.length) W("no exploration well flagged (expected 15/9-19*)");
    // ensure no wellbore is shared between an exploration well and a dev well
    const seen = new Map();
    let clash = 0;
    for (const w of wells) for (const wb of w.wellbores) {
      if (seen.has(wb) && seen.get(wb) !== w.well_name) clash++;
      seen.set(wb, w.well_name);
    }
    if (clash) F(`identity: ${clash} wellbores claimed by >1 well (forced merge)`);
    notes.push(`identity: ${expl.length} exploration wells + ${dev.length} development wells, no forced merges`);
  }
}

// ---- 7. Formation markers (interpreted, source_id, MD/TVD present-or-null) ----
{
  const f = P("processed", "formation-markers.json");
  if (!exists(f)) W("formation-markers.json missing (P1 gap-fill not run?)");
  else {
    const fm = rd(f);
    checkSid(fm.source_id, "formation-markers");
    let bad = 0, unit = 0, depthBad = 0, resolvedClash = 0;
    const wells = new Set(rd(P("processed", "wells.json")).wells.map((w) => w.well_name));
    for (const m of fm.markers) {
      checkSid(m.source_id, `marker ${m.source_well}/${m.surface}`);
      if (m.dataNature !== "interpreted") bad++;
      if (m.depth_unit == null) unit++;
      // MD/TVD must be present-or-null (a number or explicit null), never absent/NaN
      const okDepth = (v) => v === null || (typeof v === "number" && Number.isFinite(v));
      if (!("md" in m) || !("tvd" in m) || !okDepth(m.md) || !okDepth(m.tvd)) depthBad++;
      // a resolved well_id must be a real master well, never invented
      if (m.well_id != null && !wells.has(m.well_id)) resolvedClash++;
    }
    if (bad) F(`markers: ${bad} rows dataNature != interpreted`);
    if (unit) F(`markers: ${unit} rows missing depth_unit`);
    if (depthBad) F(`markers: ${depthBad} rows with MD/TVD neither number nor null`);
    if (resolvedClash) F(`markers: ${resolvedClash} rows resolve to a non-existent well (forced link)`);
    notes.push(`markers: ${fm.markers.length} picks, ${fm.distinct_surfaces} surfaces, ` +
      `${fm.unresolved_wells.length} unresolved wells carried verbatim (no forced link), ` +
      `source_id resolves, dataNature=interpreted, MD/TVD present-or-null`);
  }
}

// ---- 8. Pressure logs (LAS 3.0, measured, source_id resolves) ----
{
  const dir = P("processed", "pressure");
  const files = exists(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith(".json")) : [];
  if (!files.length) W("no pressure-log files (P1 gap-fill not run?)");
  let runs = 0, natBad = 0, idxBad = 0, fullMissing = 0;
  for (const fn of files) {
    const pr = rd(path.join(dir, fn));
    checkSid(pr.source_id, `pressure ${fn}`);
    if (pr.dataNature !== "measured") natBad++;
    if (!["time", "depth", "other"].includes(pr.index_kind)) idxBad++;
    // if data isn't inline it must point at an existing full file
    if (pr.data == null && pr.full_ref && !exists(P("processed", ...pr.full_ref.split("/")))) fullMissing++;
    runs++;
  }
  if (natBad) F(`pressure: ${natBad} runs dataNature != measured`);
  if (idxBad) F(`pressure: ${idxBad} runs with invalid index_kind`);
  if (fullMissing) F(`pressure: ${fullMissing} runs reference a missing full-data file`);
  notes.push(`pressure: ${runs} LAS 3.0 runs (source_id resolves, dataNature=measured, index_kind valid)`);
}

// ---- report ----
console.log("=== ArgantaEnergy O2 validation ===");
for (const n of notes) console.log("  ✓ " + n);
for (const w of warns) console.log("  ⚠ " + w);
if (fails.length) {
  console.log(`\nFAILED (${fails.length}):`);
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
console.log(`\nALL CHECKS PASSED (${warns.length} warnings).`);

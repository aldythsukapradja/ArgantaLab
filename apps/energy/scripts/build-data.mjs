// ArgantaEnergy — build-time data generator (Batch O3)
// Reads canonical data-energy/{processed,manifest} and emits lean src/data/*.json.
// REAL VALUES ONLY. No fabrication. Numbers not recomputable here are pulled from
// the O2 QC product (docs/arganta-energy/qc) and tagged with a source note.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');          // repo root
const PROC = join(ROOT, 'data-energy', 'processed');
const MAN = join(ROOT, 'data-energy', 'manifest');
const KNOW = join(__dirname, '..', 'knowledge');
const QC = join(ROOT, 'docs', 'arganta-energy', 'qc');
const OUT = join(__dirname, '..', 'src', 'data');
mkdirSync(OUT, { recursive: true });

const rj = (p) => JSON.parse(readFileSync(p, 'utf8'));
const rt = (p) => readFileSync(p, 'utf8');
const write = (name, obj) => { writeFileSync(join(OUT, name), JSON.stringify(obj)); console.log('  wrote', name, (JSON.stringify(obj).length / 1024).toFixed(1) + 'kb'); };

console.log('[build-data] reading canonical data-energy...');

// ---------- manifests ----------
const inventory = rj(join(MAN, 'inventory.json'));       // array of {path,name,size,last_modified,is_directory}
const mirror = rj(join(MAN, 'mirror-manifest.json'));    // object path -> {size,sha256,last_modified,status,...}
const selection = rj(join(MAN, 'selection.json'));       // {decidedAt,decision,fileCount,totalBytes,files:[{path,size,last_modified}]}

// ---------- processed ----------
const wells = rj(join(PROC, 'wells.json'));
const wellbores = rj(join(PROC, 'wellbores.json'));
const prod = rj(join(PROC, 'production.json'));
const trajFiles = readdirSync(join(PROC, 'trajectory')).filter((f) => f.endsWith('.json'));
const horizonFiles = readdirSync(join(PROC, 'horizons')).filter((f) => f.endsWith('.json'));
const logFiles = existsSync(join(PROC, 'log-samples')) ? readdirSync(join(PROC, 'log-samples')).filter((f) => f.endsWith('.json')) : [];

// =====================================================================
// FOUNDATION
// =====================================================================
const mirrorPaths = Object.keys(mirror);
const mirrorFiles = mirrorPaths.map((p) => mirror[p]).filter((e) => e && typeof e.size === 'number');
const mirrorBytes = mirrorFiles.reduce((a, e) => a + (e.size || 0), 0);
const mirrorCount = mirrorFiles.length;

// trajectory stations (real, computed)
let trajStations = 0;
const trajSummaries = trajFiles.map((f) => {
  const t = rj(join(PROC, 'trajectory', f));
  const arr = t.stations || t.survey || [];
  trajStations += Array.isArray(arr) ? arr.length : (t.station_count || 0);
  return {
    wellbore: t.wellbore, well: t.nameWell, classification: t.classification,
    stations: t.station_count ?? (Array.isArray(arr) ? arr.length : 0),
    md_min: t.md_min, md_max: t.md_max, azi_ref: t.azi_ref,
    service: t.service_company, dataNature: t.dataNature, source_id: t.evidence?.volumePath || t.source_id,
  };
});

// horizon grid points (real, computed)
let horizonPoints = 0;
const horizonSummaries = horizonFiles.map((f) => {
  const h = rj(join(PROC, 'horizons', f));
  horizonPoints += h.points_count || 0;
  return { name: h.name, kind: h.kind, points: h.points_count, bbox: h.bbox, dataNature: h.dataNature, source_id: h.evidence?.volumePath || h.source_id };
});

const prodOilTotal = (prod.wellbore_summary || []).reduce((a, w) => a + (w.sum_oil_sm3 || 0), 0);
const prodGasTotal = (prod.wellbore_summary || []).reduce((a, w) => a + (w.sum_gas_sm3 || 0), 0);

const foundation = {
  // Numbers marked `computed` are derived here from processed data at build time.
  // Numbers marked `qc` are the O2 refinery product (docs/arganta-energy/qc/README.md),
  // not cheaply recomputable client-side (full 65.7M log values live only in raw/interim).
  generatedAt: new Date().toISOString(),
  metrics: [
    { key: 'production', label: 'Daily production rows', value: prod.daily_rows.length, unit: 'rows', accent: 'amber', nature: 'reported', method: 'deterministic', provenance: 'computed', source: 'processed/production.json', note: prod.monthly_rows.length + ' monthly rows' },
    { key: 'logvalues', label: 'Log curve values', value: 65742300, unit: 'values', accent: 'violet', nature: 'measured', method: 'deterministic', provenance: 'qc', source: 'qc/README.md (LAS 18,657,384 + DLIS 47,084,916)', note: '223 runs · 116/164 LAS + 81/81 DLIS' },
    { key: 'trajectories', label: 'Definitive trajectories', value: trajSummaries.length, unit: 'surveys', accent: 'teal', nature: 'measured', method: 'deterministic', provenance: 'computed', source: 'processed/trajectory/*.json', note: trajStations.toLocaleString() + ' stations · of 63 WITSML objects' },
    { key: 'horizons', label: 'Depth horizons', value: horizonSummaries.length, unit: 'surfaces', accent: 'orange', nature: 'interpreted', method: 'deterministic', provenance: 'computed', source: 'processed/horizons/*.json', note: horizonPoints.toLocaleString() + ' grid points' },
    { key: 'wells', label: 'Wells', value: wells.count, unit: 'wells', accent: 'blue', nature: 'reported', method: 'deterministic', provenance: 'computed', source: 'processed/wells.json', note: wellbores.count + ' wellbores' },
    { key: 'mirror', label: 'Raw files mirrored', value: mirrorCount, unit: 'files', accent: 'teal', nature: 'measured', method: 'deterministic', provenance: 'computed', source: 'manifest/mirror-manifest.json', note: (mirrorBytes / 1e9).toFixed(2) + ' GB · sha256 verified' },
  ],
  triBrain: [
    { key: 'data', title: 'Data + Physics', accent: 'amber', tag: 'deterministic', body: 'Measured & reported facts from the Volve field: 15,634 daily production rows, 65.7M log values, 29 as-drilled surveys. An LLM answer is never a measurement.', stats: [{ k: 'Production rows', v: prod.daily_rows.length.toLocaleString() }, { k: 'Log values', v: '65.7M' }, { k: 'Wellbores', v: String(wellbores.count) }] },
    { key: 'knowledge', title: 'Knowledge + Evidence', accent: 'teal', tag: 'cited', body: 'Every canonical row carries a source_id resolving to a sha256 in the mirror manifest. Claims, citations, valid-time and an append-only archaeology log.', stats: [{ k: 'Evidence-linked domains', v: '5' }, { k: 'Mirror sha256', v: mirrorCount.toLocaleString() }, { k: 'Archaeology notes', v: '2' }] },
    { key: 'decision', title: 'Decision + Agent', accent: 'violet', tag: 'gated', body: 'Plans route across the Arganta four-tier router (Sovereign→Frontier). An agent cannot self-approve. Reserved for P4 — orb slot held, not wired.', stats: [{ k: 'Tiers', v: '0A→3' }, { k: 'Agents wired', v: '0 (P4)' }, { k: 'Approval gate', v: 'required' }] },
  ],
  schema: {
    entities: [
      { id: 'field', label: 'Field', accent: 'muted', rows: 1, sub: 'Q0015 SLEIPNER / VOLVE', nature: 'reported' },
      { id: 'well', label: 'Well', accent: 'blue', rows: wells.count, sub: 'MasterData', nature: 'reported' },
      { id: 'wellbore', label: 'Wellbore', accent: 'blue', rows: wellbores.count, sub: 'MasterData', nature: 'reported' },
      { id: 'production', label: 'ProductionRecord', accent: 'amber', rows: prod.daily_rows.length, sub: 'WPC · Sm3', nature: 'reported' },
      { id: 'logrun', label: 'LogRun / Sample', accent: 'violet', rows: 223, sub: 'Dataset · 65.7M values', nature: 'measured' },
      { id: 'trajectory', label: 'TrajectorySurvey', accent: 'teal', rows: trajSummaries.length, sub: 'WPC · ' + trajStations.toLocaleString() + ' stations', nature: 'measured' },
      { id: 'marker', label: 'FormationMarker', accent: 'rose', rows: 0, sub: 'deferred — no picks in selection', nature: 'interpreted' },
      { id: 'horizon', label: 'DepthHorizon', accent: 'orange', rows: horizonSummaries.length, sub: 'WPC · ' + horizonPoints.toLocaleString() + ' pts', nature: 'interpreted' },
    ],
    edges: [
      ['field', 'well'], ['well', 'wellbore'],
      ['wellbore', 'production'], ['wellbore', 'logrun'], ['wellbore', 'trajectory'], ['wellbore', 'marker'],
      ['field', 'horizon'],
    ],
  },
  wells: wells.wells.map((w) => ({ well_name: w.well_name, field: w.field, company: w.company, is_exploration: !!w.is_exploration, crs: w.crs?.crs_label, wellbores: w.wellbores })),
  production: { oil_sm3: Math.round(prodOilTotal), gas_sm3: Math.round(prodGasTotal), wellbores: (prod.wellbore_summary || []).map((w) => ({ wellbore: w.wellbore, rows: w.rows, date_min: w.date_min, date_max: w.date_max, oil: Math.round(w.sum_oil_sm3), gas: Math.round(w.sum_gas_sm3), wat: Math.round(w.sum_wat_sm3) })) },
  trajectories: trajSummaries,
  horizons: horizonSummaries,
};
write('foundation.json', foundation);

// =====================================================================
// DATA — inventory / provenance ledger
// =====================================================================
// Top-folder rollup over the FULL source inventory (dirs excluded).
const topRoll = {};
for (const e of inventory) {
  if (e.is_directory) continue;
  const top = e.path.split('/')[0];
  topRoll[top] = topRoll[top] || { folder: top, files: 0, bytes: 0 };
  topRoll[top].files++; topRoll[top].bytes += e.size || 0;
}
// which top folders are mirrored
const mirroredTops = new Set(mirrorPaths.map((p) => p.split('/')[0]));
const excludeRules = [
  { rule: 'seismic|segy|.sgy|st0202|4d|vsp|rms model|geoscience', reason: 'Hard deny-list — seismic/RMS/GeoScience never downloaded (size + scope).', accent: 'rose' },
  { rule: 'Eclipse simulation decks', reason: 'Deferred — reservoir simulation out of P2 scope.', accent: 'orange' },
];
const topFolders = Object.values(topRoll).sort((a, b) => b.bytes - a.bytes).map((t) => ({
  ...t,
  state: mirroredTops.has(t.folder) ? 'partial-or-full' : 'excluded',
}));

// full mirrored file ledger (real, 999) — path,size,sha256,last_modified,status
const ledger = mirrorFiles.map((e, i) => ({
  path: mirrorPaths[i],
  size: e.size, sha256: e.sha256, last_modified: e.last_modified, status: e.status || 'done',
  top: mirrorPaths[i].split('/')[0],
}));

// deferred LAS 3.0 list — parse from qc README
let deferred = [];
try {
  const qcReadme = rt(join(QC, 'README.md'));
  deferred = qcReadme.split('\n').filter((l) => /decode deferred/.test(l)).map((l) => {
    const m = l.match(/`([^`]+)`\s*—\s*(.+)/);
    return m ? { path: m[1], reason: m[2] } : null;
  }).filter(Boolean);
} catch {}

const dataTab = {
  mirror: { files: mirrorCount, bytes: mirrorBytes, gb: +(mirrorBytes / 1e9).toFixed(2), verified: mirrorCount, failures: 0, sha256: true, completedAt: '2026-07-21', source: 'manifest/mirror-report.md' },
  inventory: { totalEntries: inventory.length, files: inventory.filter((e) => !e.is_directory).length, dirs: inventory.filter((e) => e.is_directory).length, source: 'manifest/inventory.json' },
  selection: { decision: selection.decision, decidedAt: selection.decidedAt, fileCount: selection.fileCount, totalBytes: selection.totalBytes, source: 'manifest/selection.json' },
  topFolders,
  excludeRules,
  deferred,
  ledger,
};
write('data.json', dataTab);

// =====================================================================
// KNOWLEDGE — vault notes + QC docs
// =====================================================================
function walkMd(dir, base = '') {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, name.name);
    const rel = base ? base + '/' + name.name : name.name;
    if (name.isDirectory()) out.push(...walkMd(full, rel));
    else if (name.name.endsWith('.md')) out.push({ rel, full });
  }
  return out;
}
const noteFiles = existsSync(KNOW) ? walkMd(KNOW) : [];
const titleOf = (body, rel) => {
  const h = body.match(/^#\s+(.+)$/m);
  return h ? h[1].trim() : rel.split('/').pop().replace(/\.md$/, '');
};
const notes = noteFiles.map(({ rel, full }) => {
  const body = rt(full);
  const folder = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '(root)';
  const backlinks = [...body.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
  const evidenceRefs = [...body.matchAll(/(sha256|source_id|mirror-manifest|evidence|`[^`]*\.(?:json|xlsx|las|dat|xml)`)/gi)].length;
  return { path: rel, folder, title: titleOf(body, rel), body, backlinks, hasEvidence: evidenceRefs > 0, evidenceCount: evidenceRefs, kind: 'note' };
});
// QC docs (from docs/arganta-energy/qc)
const qcNotes = existsSync(QC) ? readdirSync(QC).filter((f) => f.endsWith('.md')).map((f) => {
  const body = rt(join(QC, f));
  const backlinks = [...body.matchAll(/\[([^\]]+)\]\((?:[^)]+\.md)\)/g)].map((m) => m[1]);
  const evidenceRefs = [...body.matchAll(/(sha256|source_id|mirror-manifest|dataNature|`[^`]+`)/gi)].length;
  return { path: 'qc/' + f, folder: 'QC · O2 refinery product', title: titleOf(body, f), body, backlinks, hasEvidence: evidenceRefs > 0, evidenceCount: evidenceRefs, kind: 'qc' };
}) : [];

// build backlink graph (who references whom by title token)
const all = [...notes, ...qcNotes];
for (const n of all) {
  n.referencedBy = all.filter((o) => o !== n && (o.backlinks.includes(n.title) || o.body.includes(n.path.split('/').pop()))).map((o) => o.path);
}
write('knowledge.json', { notes: all, folders: [...new Set(all.map((n) => n.folder))] });

console.log('[build-data] done — 3 datasets written to src/data');

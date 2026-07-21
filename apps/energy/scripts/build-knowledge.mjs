// M3 — deterministic knowledge generator (Fable-designed core).
// Reads canonical data (data-energy/processed) + seed markdown (knowledge/) and emits
// src/data/kb.json: entity notes auto-wikilinked into a graph ISOMORPHIC to the FK model.
// NO LLM anywhere. Full regeneration each run (idempotent by construction); every note
// carries a gen-stage flag + evidence source_ids. Truth rules: classification is
// rule-based; unresolvable identities stay orphans; nothing unsupported goes unflagged.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = join(__dirname, '..');
const REPO = join(APP, '..', '..');
const P = join(REPO, 'data-energy', 'processed');
const OUT = join(APP, 'src', 'data');
mkdirSync(OUT, { recursive: true });
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ── alias layer (mirror of src/model/schema-meta.ts — keep in sync) ──────────
const normWb = (raw) => !raw ? raw : raw.trim()
  .replace(/^NO\s+/i, '').replace(/_/g, '/').replace(/\s+/g, ' ').trim()
  .replace(/^15\/9-/, '').replace(/(F-\d+)([A-Z])\b/g, '$1 $2');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

// ── Surface bridge: Volve stratigraphy, youngest→oldest (interpreted reference) ──
const SURFACES = [
  { name: 'Seabed', order: 1 }, { name: 'NORDLAND GP. Top', order: 2 },
  { name: 'Utsira Fm. Top', order: 3 }, { name: 'HORDALAND GP. Top', order: 4 },
  { name: 'Ty Fm. Top', order: 5 }, { name: 'SHETLAND GP. Top', order: 6 },
  { name: 'Ekofisk Fm. Top', order: 7 }, { name: 'Hod Fm. Top', order: 8 },
  { name: 'Draupne Fm. Top', order: 9 }, { name: 'Heather Fm. Top', order: 10 },
  { name: 'Heather Fm. Sand VOLVE Top', order: 11 },
  { name: 'Hugin Fm. VOLVE Top', order: 12, reservoir: true },
  { name: 'Hugin Fm. VOLVE Base', order: 13, reservoir: true },
  { name: 'Sleipner Fm. Top', order: 14 },
  { name: 'Skagerrak Fm. Top', order: 15, reservoir: true },
  { name: 'Smith Bank Fm. Top', order: 16 },
];

const FOLDERS = [
  '00 Field', '01 Wells', '02 Wellbores', '03 Surfaces', '04 Data Tables',
  '05 Documents', '90 QC', '99 Archaeology',
];

// ── load canonical data ───────────────────────────────────────────────────────
const wells = j(join(P, 'wells.json')).wells;
const wellbores = j(join(P, 'wellbores.json')).wellbores;
const prod = j(join(P, 'production.json'));
const markersRaw = j(join(P, 'formation-markers.json'));
const markers = Array.isArray(markersRaw) ? markersRaw : markersRaw.markers || markersRaw.picks;
const horizonFiles = readdirSync(join(P, 'horizons')).filter((f) => f.endsWith('.json'));
const trajFiles = readdirSync(join(P, 'trajectory')).filter((f) => f.endsWith('.json'));
const logFiles = readdirSync(join(P, 'log-samples'));
const pressureFiles = existsSync(join(P, 'pressure')) ? readdirSync(join(P, 'pressure')).filter((f) => f.endsWith('.json')) : [];

// coverage indexes (all keyed by canonical wellbore name)
const prodBy = new Map(prod.wellbore_summary.map((w) => [normWb(w.wellbore), w]));
const logsBy = new Map();
for (const f of logFiles) { const w = normWb(j(join(P, 'log-samples', f)).well); logsBy.set(w, (logsBy.get(w) || 0) + 1); }
const trajBy = new Map();
for (const f of trajFiles) { const t = j(join(P, 'trajectory', f)); trajBy.set(normWb(t.nameWell || t.wellbore), t); }
const pressBy = new Map();
for (const f of pressureFiles) { const w = normWb(j(join(P, 'pressure', f)).well); pressBy.set(w, (pressBy.get(w) || 0) + 1); }
const marksBy = new Map();
for (const m of markers) { const w = normWb(m.source_well); if (!marksBy.has(w)) marksBy.set(w, []); marksBy.get(w).push(m); }

const notes = [];
const N = (n) => { notes.push({ tags: [], links: [], backlinks: [], evidence: [], version: 1, ...n }); };

// ── stage 1: field ────────────────────────────────────────────────────────────
N({
  id: 'kb-field-volve', title: 'Volve', type: 'field', folder: '00 Field', gen: 'field',
  dataNature: 'reported',
  body_md: `# Volve Field\n\nNorth Sea (licence block 15/9, ED50/UTM 31N). Reference asset of ArgantaEnergy.\n\n- Wells: **${wells.length}** (${wells.filter((w) => w.is_exploration).length} exploration, ${wells.filter((w) => !w.is_exploration).length} development) · Wellbores: **${wellbores.length}**\n- Production history: **${prod.daily_rows.length.toLocaleString()} daily rows** across ${prod.wellbore_summary.length} wellbores\n- Reservoir: [[Hugin Fm. VOLVE Top]] → [[Hugin Fm. VOLVE Base]] (Middle Jurassic), secondary [[Skagerrak Fm. Top]]\n- Wells: ${wells.map((w) => `[[Well ${w.well_name}|${w.well_name}]]`).join(' · ')}\n`,
  evidence: [prod.source_id].filter(Boolean),
});

// ── stage 2: surfaces (bridge rows + pick/horizon counts) ─────────────────────
const horizonNames = horizonFiles.map((f) => j(join(P, 'horizons', f)).name);
for (const s of SURFACES) {
  const picks = markers.filter((m) => m.surface === s.name);
  const grids = horizonNames.filter((h) => h.toLowerCase().includes(s.name.split(' ')[0].toLowerCase()));
  N({
    id: `kb-surface-${slug(s.name)}`, title: s.name, type: 'surface', folder: '03 Surfaces', gen: 'surfaces',
    dataNature: 'interpreted', tags: s.reservoir ? ['#reservoir'] : [],
    body_md: `# ${s.name}\n\nStratigraphic order (youngest→oldest): **${s.order}/16**${s.reservoir ? ' · **RESERVOIR interval**' : ''}\n\n- Formation picks: **${picks.length}** across ${new Set(picks.map((m) => normWb(m.source_well))).size} wells\n${grids.length ? `- Interpreted depth grid(s): ${grids.map((g) => `\`${g}\``).join(', ')}\n` : ''}- Field: [[Volve]]\n\n> Ordering is interpreted reference stratigraphy, not a measurement.\n`,
    evidence: [...new Set(picks.map((m) => m.source_id))].filter(Boolean),
  });
}

// ── stage 3: wells + wellbores (coverage + lineage + honest classification) ──
const wbByWell = new Map();
for (const wb of wellbores) { const k = wb.well_name; if (!wbByWell.has(k)) wbByWell.set(k, []); wbByWell.get(k).push(wb); }

for (const w of wells) {
  const kids = wbByWell.get(w.well_name) || [];
  // Title disambiguation: master uses the same short name for a well and its main
  // wellbore (e.g. F-12). Well notes are titled "Well F-12"; prose links use an alias.
  N({
    id: `kb-well-${slug(w.well_name)}`, title: `Well ${w.well_name}`, type: 'well', folder: '01 Wells', gen: 'wells',
    dataNature: 'reported', tags: [w.is_exploration ? '#exploration' : '#development'],
    body_md: `# Well ${w.well_name}\n\n${w.is_exploration ? '**Exploration well** (15/9-19 family — kept strictly separate from development identities).' : '**Development well** (Volve F-series).'}\n\n- Field: [[Volve]] · CRS: ${typeof w.crs === 'string' ? w.crs : w.crs?.crs_label ?? 'ED50 / UTM 31N'}\n- Wellbores: ${kids.map((k) => `[[${k.wellbore_name}]]`).join(' · ') || '—'}\n`,
    evidence: kids.map((k) => k.source_id).filter(Boolean).slice(0, 3),
  });
}

for (const wb of wellbores) {
  const c = normWb(wb.wellbore_name);
  const pr = prodBy.get(c); const tr = trajBy.get(c);
  const nLogs = logsBy.get(c) || 0; const nPress = pressBy.get(c) || 0;
  const picks = marksBy.get(c) || [];
  const kinds = pr ? pr.flow_kinds.join('/') : null;
  const types = pr ? pr.well_types.join(',') : null;
  const role = !pr ? 'No production history in scope.'
    : pr.flow_kinds.includes('injection') && pr.flow_kinds.includes('production')
      ? `**Injector + producer phases** (${types}).`
      : pr.flow_kinds.includes('injection') ? `**Water injector** (${types}).` : `**Producer** (${types}).`;
  const cov = [
    pr ? `production **${pr.rows.toLocaleString()} daily rows** (${pr.date_min} → ${pr.date_max}, ${kinds})` : null,
    nLogs ? `**${nLogs}** log runs` : null,
    tr ? `definitive trajectory **${tr.station_count} stations** (MD ${Math.round(tr.md_min)}–${Math.round(tr.md_max)} m)` : null,
    nPress ? `**${nPress}** pressure runs` : null,
    picks.length ? `**${picks.length}** formation picks (${[...new Set(picks.map((m) => m.surface))].slice(0, 4).map((s) => `[[${s}]]`).join(', ')}${new Set(picks.map((m) => m.surface)).size > 4 ? ', …' : ''})` : null,
  ].filter(Boolean);
  N({
    id: `kb-wellbore-${slug(wb.wellbore_name)}`, title: wb.wellbore_name, type: 'wellbore', folder: '02 Wellbores', gen: 'wellbores',
    dataNature: 'reported',
    tags: pr ? (pr.flow_kinds.includes('injection') ? ['#injector'] : ['#producer']) : [],
    explicitLinks: ['kb-field-volve', `kb-well-${slug(wb.well_name)}`],
    body_md: `# Wellbore ${wb.wellbore_name}\n\n${role}\n\n- Well: [[Well ${wb.well_name}|${wb.well_name}]]${wb.drilled_from && !/ref\.?\s*point/i.test(wb.drilled_from) ? ` · sidetrack of [[${wb.drilled_from}]]` : ''}\n- TD: ${wb.bottom_hole_md_m ?? '—'} m MD / ${wb.bottom_hole_tvd_m ?? '—'} m TVD\n- Coverage: ${cov.length ? cov.join('; ') : 'masters only'}\n${pr ? `- Cumulative (reported, Sm3): oil ${Math.round(pr.sum_oil_sm3).toLocaleString()} · water ${Math.round(pr.sum_wat_sm3).toLocaleString()} · WI ${Math.round(pr.sum_wi_sm3).toLocaleString()}\n` : ''}\n> Injector→producer support mapping requires an allocation/split table — not present in the mirrored scope; deliberately NOT inferred.\n`,
    evidence: [wb.source_id, pr ? prod.source_id : null].filter(Boolean),
    claims: pr ? [{
      subject: wb.wellbore_name, predicate: 'cumulative_oil_sm3', object: String(Math.round(pr.sum_oil_sm3)),
      evidence: [prod.source_id], confidence: 'derived',
    }] : [],
  });
}

// ── stage 4: data-table notes (from the locked M1 contract, FK → wikilinks) ──
const TABLE_SUMMARY = [
  ['well', 'Well', 11], ['wellbore', 'Wellbore', 24], ['production', 'ProductionRecord', 15634],
  ['log_sample', 'LogSample', 223], ['pressure', 'PressureSample', 48], ['trajectory', 'TrajectorySurvey', 29],
  ['marker', 'FormationMarker', 409], ['horizon', 'DepthHorizon', 6], ['surface', 'Surface', 16], ['evidence', 'EvidenceRecord', 1002],
];
for (const [id, name, rows] of TABLE_SUMMARY) {
  N({
    id: `kb-tbl-${id}`, title: `${name} table`, type: 'datatable', folder: '04 Data Tables', gen: 'tables',
    dataNature: 'reported', explicitLinks: ['kb-field-volve'],
    body_md: `# ${name}\n\nCanonical table \`${id}\` — **${rows.toLocaleString()} rows** (contract v1.0.0, see \`contracts/schema.md\`). Field: [[Volve]].\n`,
  });
}

// ── stage 5: documents (mirrored reports as WorkProducts) ─────────────────────
for (const doc of [
  { file: 'Reports/Discovery_report.pdf', title: 'Volve Discovery Report', note: 'Field discovery evaluation (PDF, 182 MB). Grounding document for exploration training.' },
  { file: 'Reports/Volve PUD .pdf', title: 'Volve Plan for Development (PUD)', note: 'Development plan document (PDF).' },
]) {
  N({
    id: `kb-doc-${slug(doc.title)}`, title: doc.title, type: 'document', folder: '05 Documents', gen: 'docs',
    dataNature: 'reported', explicitLinks: ['kb-field-volve'],
    body_md: `# ${doc.title}\n\n${doc.note}\n\n- Field: [[Volve]]\n- _Source: \`${doc.file}\` (mirrored 1:1, sha256 in evidence ledger)_\n\n> Content not yet extracted — run it through the Extraction Studio to propose knowledge candidates.\n`,
    evidence: [doc.file],
  });
}

// ── stage 6: absorb seed markdown notes (archaeology + QC) ────────────────────
const seedRoot = join(APP, 'knowledge');
if (existsSync(seedRoot)) {
  for (const folder of readdirSync(seedRoot)) {
    const dir = join(seedRoot, folder);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const body = readFileSync(join(dir, f), 'utf8');
      const title = f.replace(/\.md$/, '');
      N({
        id: `kb-md-${slug(folder + '-' + title)}`, title, type: folder.startsWith('99') ? 'archaeology' : 'qc',
        folder: folder.startsWith('99') ? '99 Archaeology' : '90 QC', gen: 'seed',
        dataNature: 'reported', body_md: body,
      });
    }
  }
}
// QC docs from docs/arganta-energy/qc
const qcDir = join(REPO, 'docs', 'arganta-energy', 'qc');
if (existsSync(qcDir)) {
  for (const f of readdirSync(qcDir).filter((x) => x.endsWith('.md'))) {
    N({
      id: `kb-qc-${slug(f)}`, title: `QC — ${f.replace(/\.md$/, '')}`, type: 'qc', folder: '90 QC', gen: 'seed',
      dataNature: 'reported', body_md: readFileSync(join(qcDir, f), 'utf8'),
    });
  }
}

// ── link machinery (mirror of src/knowledge/links.ts) ─────────────────────────
const WIKI = /\[\[([^\]]+)\]\]/g;
const idx = new Map();
for (const n of notes) { const k = n.title.toLowerCase(); if (!idx.has(k)) idx.set(k, n.id); }
let dead = 0;
for (const n of notes) {
  const out = new Set(n.explicitLinks ?? []);
  let m; WIKI.lastIndex = 0;
  while ((m = WIKI.exec(n.body_md))) {
    const t = idx.get(m[1].split('|')[0].split('#')[0].trim().toLowerCase());
    if (t && t !== n.id) out.add(t); else if (!t) dead++;
  }
  out.delete(n.id); n.links = [...out];
}
const back = new Map();
for (const n of notes) for (const t of n.links) { (back.get(t) ?? back.set(t, []).get(t)).push(n.id); }
for (const n of notes) n.backlinks = back.get(n.id) ?? [];

// duplicate-title QC (title collisions silently break prose wikilinks)
const dupes = [...notes.reduce((m, n) => m.set(n.title.toLowerCase(), (m.get(n.title.toLowerCase()) || 0) + 1), new Map())].filter(([, c]) => c > 1);
if (dupes.length) console.warn('[kb] DUPLICATE TITLES (fix — they break title wikilinks):', dupes.map(([t]) => t));

const kb = { version: '1.0.0', generatedAt: new Date().toISOString(), folders: FOLDERS, notes };
writeFileSync(join(OUT, 'kb.json'), JSON.stringify(kb));
const edges = notes.reduce((a, n) => a + n.links.length, 0);
console.log(`[kb] ${notes.length} notes, ${edges} edges, ${dead} dead wikilinks, ${dupes.length} dup titles -> src/data/kb.json`);

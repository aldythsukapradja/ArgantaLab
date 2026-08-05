// curate.ts truth-lock — well-grouping, completeness ranking, and role classification
// for the Data QC delivery inventory. Run: node scripts/test-curate.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };

if (!existsSync(join(__dirname, '..', 'src', 'dataqc', 'curate.ts'))) { console.log('SKIP'); process.exit(0); }
const { curateInventory, ROLE_LABEL } = await import('../src/dataqc/curate.ts');

let seq = 0;
const asset = (kind, well, meta = {}) => ({
  id: `ia-${well}-${kind}-${seq++}`, fieldId: 'f', vertical: 'field-development',
  fileName: `${well}.${kind}`, kind, format: 'test', origin: 'bundle',
  bytes: 100, compressedBytes: 40, sha256: '', digestKey: 'k',
  meta: { well, ...meta }, qc: { status: 'pass', exceptions: [] },
});
const doc = (matched) => ({
  id: `ia-doc-${seq++}`, fieldId: 'f', vertical: 'field-development',
  fileName: 'report.pdf', kind: 'document', format: 'pdf', origin: 'bundle',
  bytes: 100, compressedBytes: 40, sha256: '', digestKey: 'k',
  meta: {}, qc: { status: 'pass', exceptions: [] }, linked: { entities: matched.length, candidates: matched.length, matched },
});

// ── a small synthetic Volve-shaped delivery ─────────────────────────────────────
// F-11 A is a real Volve shape: a sidetrack with its OWN logs but no trajectory of
// its own, while the bare "F-11" wellbore (same slot) carries the trajectory.
const trajF11 = asset('trajectory', 'F-11');
const assets = [
  ...['log', 'traj', 'picks'].map((k) => asset(k === 'traj' ? 'trajectory' : k, 'F-12')),
  asset('production', 'F-12'),
  asset('log', 'F-4'), asset('trajectory', 'F-4'), asset('injection', 'F-4'), asset('picks', 'F-4'),
  asset('log', '19 A'),                                                  // exploration, no traj/prod/picks-asset
  asset('log', 'F-15 A'), asset('trajectory', 'F-15 A'),                 // appraisal, has its own trajectory
  asset('production', 'F-11', { cumInjectedSm3: 500 }),                  // producer that also injects
  asset('log', 'F-11 A'),                                                // sidetrack: logs only, no traj of its own
  trajF11,                                                                // the SLOT's trajectory lives on bare F-11
  asset('surface', 'FIELD'), asset('production', 'FIELD'),               // field-level rollups
  doc(['F-12', 'F-4']),                                                  // mentions two wells — duplicates intentional
];

const KB = {
  wells: [], reservoirs: [],
  wellbores: [
    { wellbore_id: 'atlas:wellbore:sodir:f-12', well_id: 'atlas:well:sodir:f-12', role: 'producer', is_exploration: 'N' },
    { wellbore_id: 'atlas:wellbore:sodir:f-4', well_id: 'atlas:well:sodir:f-4', role: 'injector', is_exploration: 'N' },
    { wellbore_id: 'atlas:wellbore:sodir:19-a', well_id: 'atlas:well:sodir:19', role: 'none', is_exploration: 'Y' },
    { wellbore_id: 'atlas:wellbore:sodir:f-15-a', well_id: 'atlas:well:sodir:f-15', role: 'none', is_exploration: 'N' },
    { wellbore_id: 'atlas:wellbore:sodir:f-11-a', well_id: 'atlas:well:sodir:f-11', role: 'none', is_exploration: 'N' },
    { wellbore_id: 'atlas:wellbore:sodir:f-11', well_id: 'atlas:well:sodir:f-11', role: 'producer', is_exploration: 'N' },
    // F-11 bare is ALSO absent-from-KB-role-wise in the earlier test intent, but here
    // it's given a real row since it needs a well_id for the slot-matching test above.
  ],
};

const picksByWell = new Map([['f12', 3], ['f4', 2], ['f15a', 5]]); // '19 A' deliberately has none
// Regulator-published roles (Sodir purpose+content), the way DataQc supplies them from
// index.json. These are the REAL Volve values: F-11 is an OBSERVATION bore, not a producer.
const rolesByBore = new Map([['f12', 'oil-producer'], ['f4', 'water-injector'], ['f11', 'observation']]);
const out = curateInventory(assets, KB, { picksByWell, picksAssetId: 'ia-picks-shared', rolesByBore });

check('groups: one per wellbore, field-level excluded', out.groups.length === 6, `${out.groups.length} groups`);
check('field-level: surface + field production + report', out.fieldLevel.length === 3, `${out.fieldLevel.length}`);
check('field-level: FIELD sentinel never becomes a well group', !out.groups.some((g) => /field/i.test(g.well)));
check('field-level: documents ALWAYS field-level (never grouped by a stray meta.well)',
  out.fieldLevel.some((a) => a.kind === 'document'));

const byWell = (name) => out.groups.find((g) => g.well === name);

// ── role classification ──────────────────────────────────────────────────────────
check('F-12: regulator oil-producer role', byWell('F-12').role === 'oil-producer' && byWell('F-12').roleFromKb);
check('F-4: regulator water-injector role', byWell('F-4').role === 'water-injector' && byWell('F-4').roleFromKb);
check('19 A: KB none + exploration ⇒ exploration', byWell('19 A').role === 'exploration' && byWell('19 A').roleFromKb);
check('F-15 A: KB none + not exploration ⇒ appraisal', byWell('F-15 A').role === 'appraisal' && byWell('F-15 A').roleFromKb);
// F-11 bare now DOES carry a KB row (needed to anchor the well_id slot for the
// trajectory-via test below), so its role legitimately comes from the KB here.
check('F-11: regulator says OBSERVATION even though a production series is filed on it',
  byWell('F-11').role === 'observation' && byWell('F-11').roleFromKb === true);
check('GROUNDING F-11 A: no regulator row, no flowing asset ⇒ appraisal from the KB spine',
  byWell('F-11 A').role === 'appraisal' && byWell('F-11 A').roleFromKb === true);
check('GROUNDING F-11: injected volume on the production asset ⇒ flags injection too',
  byWell('F-11').hasInjection === true);

// ── completeness score ────────────────────────────────────────────────────────────
check('F-12: logs+traj+picks(via map)+production = 4/5 (no injection)', byWell('F-12').completeness === 4);
check('F-4: logs+traj+injection+picks(via map) = 4/5 (no production)', byWell('F-4').completeness === 4);
check('19 A: logs only, no picks attributed = 1/5', byWell('19 A').completeness === 1);
check('F-15 A: logs+traj+picks(via map) = 3/5', byWell('F-15 A').completeness === 3);
check('F-11: production+injection flag+its own trajectory (trajF11) = 3/5', byWell('F-11').completeness === 3);
check('F-11 A: logs only = 1/5 (its OWN trajectory is absent, only via sibling)', byWell('F-11 A').completeness === 1);

// ── picks attribution (shared delivery-wide asset, not a per-well asset) ─────────
check('picks: F-12 count + shared asset id', byWell('F-12').picksCount === 3 && byWell('F-12').picksAssetId === 'ia-picks-shared');
check('picks: F-4 count', byWell('F-4').picksCount === 2);
check('picks: 19 A has none attributed ⇒ null, not 0', byWell('19 A').picksCount === null && byWell('19 A').hasPicks === false);

// ── trajectory-via-sibling: the slot-sharing cross-reference ──────────────────────
check('F-11 A has no trajectory of its own', byWell('F-11 A').hasTrajectory === false);
check('F-11 A: trajectoryVia points at the SLOT sibling (bare F-11) that has one',
  byWell('F-11 A').trajectoryVia && byWell('F-11 A').trajectoryVia.well === 'F-11' && byWell('F-11 A').trajectoryVia.assetId === trajF11.id);
check('F-11 (has its own trajectory): trajectoryVia stays null — never self-referential',
  byWell('F-11').trajectoryVia === null);
check('F-15 A (has its own trajectory): trajectoryVia null even though appraisal',
  byWell('F-15 A').trajectoryVia === null);
check('19 A (no KB well_id resolvable slot / no sibling): trajectoryVia stays null, not guessed',
  byWell('19 A').trajectoryVia === null);

// ── document linking: duplicated across every well the report mentions ───────────
check('F-12: linked document present (duplicate is intentional)', byWell('F-12').linkedDocuments.length === 1);
check('F-4: SAME document object linked too', byWell('F-4').linkedDocuments.length === 1 && byWell('F-4').linkedDocuments[0].id === byWell('F-12').linkedDocuments[0].id);
check('19 A: not mentioned by the report ⇒ no linked documents', byWell('19 A').linkedDocuments.length === 0);
check('linked documents do not affect the completeness score', byWell('F-12').completeness === 4);

// ── sort order: flowing wells first (by completeness desc), then appraisal/exploration,
//    then unclassified — never the reverse ──────────────────────────────────────────
const order = out.groups.map((g) => g.well);
// Producers now outrank injectors regardless of completeness: a subsurface team
// reads the oil producers first, then what supported them.
check('sort: the oil producer (F-12) precedes the water injector (F-4)',
  order.indexOf('F-12') < order.indexOf('F-4'));
check('sort: producers and injectors precede appraisal/exploration/observation', (() => {
  const flowing = ['F-12', 'F-4'].map((w) => order.indexOf(w));
  const rest = ['19 A', 'F-15 A', 'F-11 A'].map((w) => order.indexOf(w));
  return Math.max(...flowing) < Math.min(...rest);
})());
check('sort: F-15 A (3/5) before 19 A and F-11 A (1/5 each) — completeness within same rank',
  order.indexOf('F-15 A') < order.indexOf('19 A') && order.indexOf('F-15 A') < order.indexOf('F-11 A'));

// ── grounding: no KB, no flowing data ⇒ unclassified, never invented ──────────────
const noKb = curateInventory([asset('log', 'X-1')], null);
check('GROUNDING no KB + no flowing asset ⇒ unclassified (not appraisal, not exploration)',
  noKb.groups[0].role === 'unclassified' && noKb.groups[0].roleFromKb === false);

// ── GROUNDING: a producing well absent from the KB entirely is STILL correctly
// classified from what it actually produced — never left unclassified out of caution ──
const noKbProducer = curateInventory([asset('production', 'X-2')], null);
check('GROUNDING no regulator row + a real production asset ⇒ oil-producer from DATA, flagged inferred',
  noKbProducer.groups[0].role === 'oil-producer' && noKbProducer.groups[0].roleFromKb === false);

// ── ROLE_LABEL covers every role the classifier can produce ──────────────────────
check('ROLE_LABEL: every role has a label', ['oil-producer', 'water-injector', 'water-supply', 'observation', 'appraisal', 'exploration', 'not-drilled', 'unclassified']
  .every((r) => typeof ROLE_LABEL[r] === 'string' && ROLE_LABEL[r].length > 0));

// ── asset grouping is exhaustive: every non-field asset lands in exactly one group ──
const totalGrouped = out.groups.reduce((n, g) => n + g.assets.length, 0);
check('no asset lost or duplicated across groups', totalGrouped === assets.length - out.fieldLevel.length,
  `${totalGrouped} grouped + ${out.fieldLevel.length} field-level = ${totalGrouped + out.fieldLevel.length} / ${assets.length}`);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);

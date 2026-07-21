// M1 schema-contract self-consistency check: the FK ledger's orphan counts MUST match
// what the alias normalizer produces against the real processed data. A changed count is
// a real data event (surface it), never silent drift. Run via ArgantaEnergy-Validate or standalone.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..', '..');
const P = join(REPO, 'data-energy', 'processed');
const j = (p) => JSON.parse(readFileSync(p, 'utf8'));

// Mirror of normalizeWellbore in src/data/schema-meta.ts (kept in sync; canonical short form).
const normWb = (raw) => !raw ? raw : raw.trim()
  .replace(/^NO\s+/i, '').replace(/_/g, '/').replace(/\s+/g, ' ').trim()
  .replace(/^15\/9-/, '').replace(/(F-\d+)([A-Z])\b/g, '$1 $2');
const splitAmp = (raw) => { const s = normWb(raw); const m = s.match(/^(.*?\s)([A-Z0-9]+)&([A-Z0-9]+)$/); return m ? [m[1] + m[2], m[1] + m[3]] : [s]; };

const wbSet = new Set(j(join(P, 'wellbores.json')).wellbores.map((w) => normWb(w.wellbore_name)));
const orphN = (names) => [...new Set(names.map(normWb))].filter((w) => !wbSet.has(w)).length;
const markers = (() => { const fm = j(join(P, 'formation-markers.json')); const fa = Array.isArray(fm) ? fm : fm.markers || fm.picks; return fa.filter((m) => !wbSet.has(normWb(m.source_well))).length; })();

const LEDGER = { FK03_production: 0, FK04_logs: 2, FK06_trajectory: 1, FK07_markers: 92 };
const ACTUAL = {
  FK03_production: orphN(j(join(P, 'production.json')).wellbore_summary.map((w) => w.wellbore)),
  FK04_logs: orphN(readdirSync(join(P, 'log-samples')).flatMap((f) => splitAmp(j(join(P, 'log-samples', f)).well))),
  FK06_trajectory: orphN(readdirSync(join(P, 'trajectory')).filter((f) => f.endsWith('.json')).map((f) => { const t = j(join(P, 'trajectory', f)); return t.nameWell || t.wellbore; })),
  FK07_markers: markers,
};
let fail = 0;
for (const k of Object.keys(LEDGER)) { const ok = LEDGER[k] === ACTUAL[k]; if (!ok) fail++; console.log(`${ok ? 'PASS' : 'FAIL'} ${k}: ledger ${LEDGER[k]} vs actual ${ACTUAL[k]}`); }
console.log(fail ? `\n${fail} orphan-count drift(s) — update contracts/schema.md + schema-meta.ts (a changed count is a real data event).` : '\nM1 contract self-consistent — orphan ledger matches real data.');
if (fail) process.exit(1);

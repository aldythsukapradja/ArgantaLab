// ArgantaEnergy status snapshot — clickable via ArgantaEnergy-Status.bat.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..', '..');
const M = join(REPO, 'data-energy', 'manifest');
const P = join(REPO, 'data-energy', 'processed');
const j = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
const n = (x) => (x ?? 0).toLocaleString();
const line = '─'.repeat(58);

console.log('\n' + line);
console.log('  ARGANTA ENERGY — STATUS  ·  ' + new Date().toString().slice(0, 24));
console.log(line);

// Mirror
const man = j(join(M, 'mirror-manifest.json'));
if (man) {
  const v = Object.values(man);
  const bytes = v.reduce((a, b) => a + (b.size || 0), 0);
  const done = v.filter((x) => x.status === 'done').length;
  console.log(`\n  RAW MIRROR (1:1 from Databricks Volve volume)`);
  console.log(`    files mirrored : ${n(v.length)}   (done ${n(done)})`);
  console.log(`    total size     : ${(bytes / 1e9).toFixed(2)} GB`);
  console.log(`    integrity      : SHA-256 recorded per file`);
} else {
  console.log('\n  RAW MIRROR : not found — run data:download');
}

// Processed
console.log(`\n  CANONICAL DATA (processed/)`);
const prod = j(join(P, 'production.json'));
if (prod) {
  const daily = Array.isArray(prod.daily_rows) ? prod.daily_rows.length : (prod.daily_rows || prod.dailyRows || 0);
  const monthly = Array.isArray(prod.monthly_rows) ? prod.monthly_rows.length : (prod.monthly_rows || 0);
  console.log(`    production     : ${n(daily)} daily rows  (${n(monthly)} monthly)`);
}
const traj = existsSync(join(P, 'trajectory')) ? readdirSync(join(P, 'trajectory')).filter((f) => f.endsWith('.json')).length : 0;
console.log(`    trajectories   : ${traj} definitive surveys`);
const logs = existsSync(join(P, 'log-samples')) ? readdirSync(join(P, 'log-samples')).length : 0;
console.log(`    log runs       : ${logs}`);
const hor = existsSync(join(P, 'horizons')) ? readdirSync(join(P, 'horizons')).filter((f) => f.endsWith('.json')).length : 0;
console.log(`    depth horizons : ${hor}`);
const marks = j(join(P, 'formation-markers.json'));
if (marks) { const a = Array.isArray(marks) ? marks : marks.markers || marks.picks || []; console.log(`    formation picks: ${n(a.length)}`); }
const press = existsSync(join(P, 'pressure')) ? readdirSync(join(P, 'pressure')).filter((f) => f.endsWith('.json')).length : 0;
console.log(`    pressure runs  : ${press}`);

console.log(`\n  APP : localhost:5279  (launch with ArgantaEnergy-Launch.bat)`);
console.log('\n' + line);
console.log('  Run  ArgantaEnergy-Validate.bat  for full truth checks.');
console.log(line + '\n');

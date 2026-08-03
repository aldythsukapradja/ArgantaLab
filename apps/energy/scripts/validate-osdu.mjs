import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateManifest } from './osdu-core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'public', 'osdu');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
let total = 0;
for (const item of index.manifests.filter((x) => x.status === 'ready')) {
  // index.path is already app-relative ('data-energy/generated/osdu/…'), which is where
  // build-osdu.mjs writes. Prefixing 'public' pointed at a directory that never exists.
  const manifest = JSON.parse(fs.readFileSync(path.join(root, item.path), 'utf8'));
  const result = validateManifest(manifest, item.dataClass);
  if (!result.valid) throw new Error(`${item.source}:\n${result.errors.join('\n')}`);
  total += result.records;
}
if (!index.manifests.some((x) => x.source === 'Arganta internal' && x.dataClass === 'internal')) {
  throw new Error('Internal-data landing lane is not declared');
}
console.log(`OSDU preflight passed: ${index.manifests.length} lanes, ${total} records`);

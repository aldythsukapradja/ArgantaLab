// Live demo: generate media across maturity stages, deterministic & free first.
//   node demo.js
// Writes a real PNG to ./out/ and prints the routing + provenance for every
// modality and stage, including the premium approval gate.

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generate, MATURITY } from './src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'out');
mkdirSync(outDir, { recursive: true });

const show = (label, r) => {
  const p = r.provenance || {};
  const line = r.status === 'succeeded'
    ? `bytes=${r.output.bytes.length} checksum=${p.checksum?.slice(0, 12)}…`
    : r.status === 'deferred'
      ? `→ ${r.runtime}: ${r.descriptor.engine || r.descriptor.tool}`
      : `✗ ${r.error.code} (${r.error.source})`;
  console.log(`${label.padEnd(34)} ${String(r.status).padEnd(10)} stage=${p.maturityStage ?? '-'} cost=$${p.cost ?? '-'}  ${line}`);
};

console.log('\nArganta Media Core — maturity-staged generation\n' + '='.repeat(64));

// 1) Deterministic image — actually produced here in Node, written to disk.
const img = generate({ kind: 'image', spec: { prompt: 'Arganta — launch key art', width: 512, height: 512 } });
if (img.status === 'succeeded') {
  const file = join(outDir, 'launch.png');
  writeFileSync(file, img.output.bytes);
  show('image  (stage 0 deterministic)', img);
  console.log(`   ↳ wrote ${file}  (${img.output.width}×${img.output.height}, ${img.provenance.spec ? 'seeded' : ''} style=${img.output?.style || ''})`);
}

// 2) Free browser-engine modalities (deferred descriptors).
for (const kind of ['music', 'video', 'voice', 'sfx']) {
  show(`${kind}  (stage 0 deterministic)`, generate({ kind, spec: { prompt: 'hello' } }));
}

// 3) Cheapest-capable routing: ask for economical, get free (no silent upsell).
show('image  (asked stage 2 → routed)', generate({ kind: 'image', maturityStage: MATURITY.ECONOMICAL, spec: { width: 64, height: 64 } }));

// 4) Premium gate: blocked, then approved.
show('image  (stage 3, no approval)', generate({ kind: 'image', maturityStage: MATURITY.PREMIUM }));
show('image  (stage 3, approved)', generate({ kind: 'image', maturityStage: MATURITY.PREMIUM, approved: true }));

console.log('\nDone. Open packages/media-core/out/launch.png\n');

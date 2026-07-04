// Uploads the subset of data/ the deployed game needs into a Supabase
// Storage public bucket ("kingdom-data"), preserving the /data/... paths so
// VITE_DATA_BASE can point straight at the bucket's public URL.
//
// Needs a SERVICE ROLE key (storage writes):
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_KEY=... \
//     node scripts/upload-client-data.mjs
//
// Uploaded subset (~claude: char+mounts+effects+monsters sheets, core jsons,
// links, arena backdrop). Tiles/audio/ui excluded until needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KINGDOM = path.resolve(__dirname, '..');
const BUCKET = 'kingdom-data';

const INCLUDE = [
  'data/client/manifest.json',
  'data/client/extractor-manifest.json',
  'data/client/char',
  'data/client/mounts',
  'data/client/effects',
  'data/client/monsters',
  'data/client/items',
  'data/links',
  'data/core/monsters.json',
  'data/core/items.json',
  'data/assets/map-images/chonsa-arena-room.png',
];
const MIME = { '.json': 'application/json', '.png': 'image/png', '.gif': 'image/gif' };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function* walk(p) {
  const abs = path.join(KINGDOM, p);
  if (!fs.existsSync(abs)) return;
  if (fs.statSync(abs).isFile()) { yield p; return; }
  for (const e of fs.readdirSync(abs)) yield* walk(path.posix.join(p, e));
}

const { data: buckets } = await supabase.storage.listBuckets();
if (!buckets?.some((b) => b.name === BUCKET)) {
  await supabase.storage.createBucket(BUCKET, { public: true });
  console.log('created bucket', BUCKET);
}

let n = 0, bytes = 0;
for (const root of INCLUDE) {
  for await (const rel of walk(root)) {
    const body = fs.readFileSync(path.join(KINGDOM, rel));
    const { error } = await supabase.storage.from(BUCKET).upload(rel, body, {
      contentType: MIME[path.extname(rel)] || 'application/octet-stream',
      upsert: true,
    });
    if (error) { console.error('FAIL', rel, error.message); continue; }
    n++; bytes += body.length;
    if (n % 200 === 0) console.log(`${n} files, ${(bytes / 1e6).toFixed(0)} MB…`);
  }
}
console.log(`done: ${n} files, ${(bytes / 1e6).toFixed(0)} MB`);
console.log(`Set VITE_DATA_BASE=${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}`);

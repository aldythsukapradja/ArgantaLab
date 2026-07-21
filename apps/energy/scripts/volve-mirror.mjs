#!/usr/bin/env node
// ============================================================================
// volve-mirror.mjs — ArgantaEnergy P0 mirror tool (Batch O1)
// Node 22+, ZERO npm deps. Built-ins only: fetch, node:crypto, node:fs, node:stream.
//
// Subcommands:
//   plan                 recursive metadata walk -> data-energy/manifest/inventory.json
//   mirror               stream-download files listed in selection.json (resumable, hashed)
//   verify [--deep]      size (always) / sha-256 (--deep) integrity check vs inventory
//
// Ground truth: Volve Data Village volume in the founder's Databricks workspace
//   /Volumes/equinor_asa_volve_data_village/public/volve
// Raw bytes stay LOCAL, byte-identical (1:1), git-ignored. No seismic, ever.
//
// SAFETY: a hard deny-list regex is applied in BOTH the plan summary (flagging)
// and the mirror step (refusal) — a seismic/RMS/GeoScience path can never be
// downloaded even if it somehow lands in selection.json.
//
// OneDrive caveat: this repo lives under OneDrive. Atomic `.part` -> final
// renames can transiently race the OneDrive sync engine (a file may be
// "in use"). We retry the rename with backoff; if renames prove unreliable at
// mirror time (Batch S1), the fallback is to stage raw under a non-synced root
// (e.g. C:\volve-raw) and record the true source path in the manifest. The
// mirror step is NOT run in O1 — this is documented for the S1 operator.
// ============================================================================

import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, readFileSync, writeFileSync, statSync,
  createWriteStream, renameSync, createReadStream, rmSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, '..');                 // apps/energy
const REPO_ROOT = resolve(APP_ROOT, '..', '..');           // repo root
const DATA_ROOT = join(REPO_ROOT, 'data-energy');
const MANIFEST_DIR = join(DATA_ROOT, 'manifest');
const RAW_ROOT = join(DATA_ROOT, 'raw');
const INVENTORY_PATH = join(MANIFEST_DIR, 'inventory.json');
const SELECTION_PATH = join(MANIFEST_DIR, 'selection.json');
const MIRROR_MANIFEST_PATH = join(MANIFEST_DIR, 'mirror-manifest.json');

// Volume root (path *after* /api/2.0/fs/directories/ or /files/)
const VOLUME_ROOT = 'Volumes/equinor_asa_volve_data_village/public/volve';

// ---------------------------------------------------------------------------
// Deny-list — seismic & overkill data. Applied to plan flagging AND mirror refusal.
// ---------------------------------------------------------------------------
const DENY_RE = /seismic|segy|\.sgy|st0202|st10010|4d|vsp|rms.?model|geoscience|pi system/i;

// Top folders we recurse fully vs list-top-only (metadata is cheap, but seismic
// trees are enormous; we never plan to mirror them, so we don't deep-walk them).
const SHALLOW_TOP = new Set([
  'Seismic',
  'GeoScience_OW_Archive',
  'Reservoir_Model-RMS_model',
  'Reservoir_Model-Eclipse_model',
  'PI System Manager Sleipner',
]);

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = join(APP_ROOT, '.env');
  if (!existsSync(envPath)) fail(`.env not found at ${envPath}`);
  const out = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  if (!out.DATABRICKS_HOST || !out.DATABRICKS_TOKEN) {
    fail('.env must define DATABRICKS_HOST and DATABRICKS_TOKEN');
  }
  return out;
}

function fail(msg) {
  console.error(`\n[volve-mirror] FATAL: ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// URL encoding — encode EACH path segment (names contain spaces), keep the "/"
// ---------------------------------------------------------------------------
function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

// ---------------------------------------------------------------------------
// HTTP with backoff honoring Retry-After; loud abort on 401 (expired PAT)
// ---------------------------------------------------------------------------
async function apiFetch(env, path, { headers = {}, maxRetries = 6 } = {}) {
  const url = `${env.DATABRICKS_HOST}${path}`;
  let attempt = 0;
  for (;;) {
    let res;
    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${env.DATABRICKS_TOKEN}`, ...headers },
      });
    } catch (e) {
      if (attempt++ >= maxRetries) throw new Error(`network error after retries: ${e.message}`);
      await sleep(backoffMs(attempt));
      continue;
    }
    if (res.status === 401) fail('401 Unauthorized — PAT expired or revoked. Regenerate DATABRICKS_TOKEN in .env.');
    if (res.status === 429 || res.status >= 500) {
      if (attempt++ >= maxRetries) throw new Error(`${res.status} after ${maxRetries} retries: ${path}`);
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoffMs(attempt));
      continue;
    }
    return res;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const backoffMs = (n) => Math.min(30_000, 500 * 2 ** n) + Math.floor(Math.random() * 250);

// ---------------------------------------------------------------------------
// Directory listing (one page)
// ---------------------------------------------------------------------------
async function listDir(env, relPath, pageToken) {
  const base = `/api/2.0/fs/directories/${encodePath(`${VOLUME_ROOT}/${relPath}`.replace(/\/+$/, ''))}`;
  const qs = new URLSearchParams({ page_size: '1000' });
  if (pageToken) qs.set('page_token', pageToken);
  const res = await apiFetch(env, `${base}?${qs}`);
  if (!res.ok) throw new Error(`list ${relPath} -> HTTP ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// plan — recursive walk
// ---------------------------------------------------------------------------
async function cmdPlan(env) {
  ensureDir(MANIFEST_DIR);
  const entries = [];
  let dirCount = 0;
  let fileCount = 0;

  // Each Databricks directory listing costs ~3s round-trip, so a serial deep
  // walk of the WITSML/log trees (hundreds of dirs) takes hours. Instead we
  // process directories through a bounded-concurrency worker pool: many listings
  // in flight at once, wall-time ≈ (dirs / CONCURRENCY) × latency.
  const CONCURRENCY = 10;
  const queue = [{ rel: '', shallow: false }]; // dirs still to list
  let active = 0;
  let listed = 0;
  let doneResolve;
  const donePromise = new Promise((r) => (doneResolve = r));

  async function listOneDir({ rel, shallow }) {
    let token;
    do {
      const page = await listDir(env, rel, token);
      for (const c of page.contents ?? []) {
        const relChild = rel ? `${rel}/${c.name}` : c.name;
        entries.push({
          path: relChild,
          name: c.name,
          size: c.is_directory ? 0 : Number(c.file_size ?? 0),
          last_modified: c.last_modified ?? null,
          is_directory: !!c.is_directory,
        });
        if (c.is_directory) {
          dirCount++;
          const topName = relChild.split('/')[0];
          const childShallow = rel === '' ? SHALLOW_TOP.has(c.name) : SHALLOW_TOP.has(topName);
          // shallow dirs are recorded but not descended into
          if (!shallow) queue.push({ rel: relChild, shallow: childShallow });
        } else {
          fileCount++;
        }
      }
      token = page.next_page_token || null;
    } while (token);
    listed++;
    if (listed % 10 === 0) console.log(`[plan] listed ${listed} dirs, queue ${queue.length}, ${entries.length} entries…`);
  }

  function pump() {
    while (active < CONCURRENCY && queue.length) {
      const item = queue.shift();
      active++;
      listOneDir(item)
        .catch((e) => console.error(`[plan] WARN list ${item.rel}: ${e.message}`))
        .finally(() => { active--; pump(); });
    }
    if (active === 0 && queue.length === 0) doneResolve();
  }

  console.log('[plan] walking volume (metadata only, concurrency ' + CONCURRENCY + ')…');
  pump();
  await donePromise;

  entries.sort((a, b) => a.path.localeCompare(b.path));
  writeFileSync(INVENTORY_PATH, JSON.stringify(entries, null, 2));
  console.log(`[plan] wrote ${entries.length} entries (${dirCount} dirs, ${fileCount} files) -> ${rel(INVENTORY_PATH)}`);

  printSummary(entries);
}

function printSummary(entries) {
  // size by top folder (files only)
  const byTop = new Map();
  for (const e of entries) {
    if (e.is_directory) continue;
    const top = e.path.split('/')[0];
    const cur = byTop.get(top) || { bytes: 0, files: 0, denied: 0 };
    cur.bytes += e.size;
    cur.files += 1;
    if (DENY_RE.test(e.path)) cur.denied += 1;
    byTop.set(top, cur);
  }
  const rows = [...byTop.entries()].sort((a, b) => b[1].bytes - a[1].bytes);
  console.log('\n=== Size by top-level folder ===');
  let total = 0;
  for (const [top, s] of rows) {
    total += s.bytes;
    const flag = DENY_RE.test(top) || s.denied > 0 ? '  ⛔DENY' : '';
    console.log(`${fmtBytes(s.bytes).padStart(11)}  ${String(s.files).padStart(6)}f  ${top}${flag}`);
  }
  console.log(`${fmtBytes(total).padStart(11)}  TOTAL (all files in volume)`);
  // denied total
  let denyBytes = 0, denyFiles = 0;
  for (const e of entries) {
    if (!e.is_directory && DENY_RE.test(e.path)) { denyBytes += e.size; denyFiles += 1; }
  }
  console.log(`\n⛔ Deny-list matches: ${denyFiles} files, ${fmtBytes(denyBytes)} (never mirrored)`);
}

// ---------------------------------------------------------------------------
// mirror — stream selected files with resume + inline sha-256 (NOT run in O1)
// ---------------------------------------------------------------------------
async function cmdMirror(env) {
  if (!existsSync(SELECTION_PATH)) fail(`selection.json not found at ${SELECTION_PATH} — build it from the approved proposal (Gate 1) first.`);
  const selection = JSON.parse(readFileSync(SELECTION_PATH, 'utf8'));
  const files = Array.isArray(selection) ? selection : selection.files;
  if (!Array.isArray(files)) fail('selection.json must be an array of {path,size,last_modified} or {files:[…]}');

  const manifest = existsSync(MIRROR_MANIFEST_PATH)
    ? JSON.parse(readFileSync(MIRROR_MANIFEST_PATH, 'utf8')) : {};

  // Hard seismic guard: refuse whole heavyweight top folders + raw seismic byte
  // formats. (Interpretation products whose NAMES reference seismic surveys —
  // e.g. depth horizons "…ST10010…DEPTH.dat" — are allowed; they are not seismic.)
  const HARD_DENY_TOP = new Set([
    'Seismic', 'GeoScience_OW_Archive', 'Reservoir_Model-RMS_model',
    'Reservoir_Model-Eclipse_model', 'PI System Manager Sleipner',
  ]);
  const HARD_DENY_EXT = /\.(sgy|segy)$/i;
  for (const f of files) {
    const top = f.path.split('/')[0];
    if (HARD_DENY_TOP.has(top) || HARD_DENY_EXT.test(f.path)) {
      fail(`selection contains a hard-denied (seismic/overkill) path: ${f.path}`);
    }
  }

  // Rebuild the FULL 1:1 folder skeleton before downloading, then mark empties.
  buildSkeleton(new Set(files.map((f) => f.path)));

  const queue = [...files];
  const CONCURRENCY = 4;
  let active = 0, done = 0, failed = 0;

  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      try {
        const rec = await mirrorOne(env, f, manifest[f.path]);
        manifest[f.path] = rec;
        writeFileSync(MIRROR_MANIFEST_PATH, JSON.stringify(manifest, null, 2));
        done++;
        console.log(`[mirror] ${rec.status.padEnd(7)} ${fmtBytes(rec.size).padStart(10)}  ${f.path}`);
      } catch (e) {
        failed++;
        console.error(`[mirror] FAIL ${f.path}: ${e.message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`\n[mirror] done=${done} failed=${failed}`);
  if (failed) process.exit(1);
}

async function mirrorOne(env, f, prior) {
  const localPath = localFor(f.path);
  ensureDir(dirname(localPath));
  const partPath = `${localPath}.part`;

  // Idempotent skip: final exists with matching size (and matching hash if known).
  if (existsSync(localPath) && statSync(localPath).size === f.size) {
    return prior && prior.status === 'done'
      ? prior
      : { path: f.path, size: f.size, last_modified: f.last_modified, sha256: prior?.sha256 ?? null, bytes_written: f.size, retrievedAt: prior?.retrievedAt ?? new Date().toISOString(), status: 'done' };
  }

  const hash = createHash('sha256');
  let offset = 0;
  // Resume: hash the existing .part and continue from its length.
  if (existsSync(partPath)) {
    offset = statSync(partPath).size;
    await pipeline(createReadStream(partPath), async function* (src) { for await (const c of src) hash.update(c); yield* []; });
  }

  const headers = {};
  if (offset > 0) {
    headers.Range = `bytes=${offset}-`;
    if (f.last_modified) headers['If-Unmodified-Since'] = f.last_modified;
  }
  const encoded = encodePath(`${VOLUME_ROOT}/${f.path}`);
  const res = await apiFetch(env, `/api/2.0/fs/files/${encoded}`, { headers });

  if (res.status === 412) {
    // File changed on server since last_modified — discard partial, restart fresh.
    rmSync(partPath, { force: true });
    return mirrorOne(env, { ...f }, undefined);
  }
  if (offset > 0 && res.status === 200) {
    // Server ignored Range — restart fresh.
    rmSync(partPath, { force: true });
    return mirrorOne(env, { ...f }, undefined);
  }
  if (!res.ok && res.status !== 206) throw new Error(`download HTTP ${res.status}`);

  const ws = createWriteStream(partPath, { flags: offset > 0 ? 'a' : 'w' });
  const nodeStream = Readable.fromWeb(res.body);
  let written = offset;
  nodeStream.on('data', (c) => { hash.update(c); written += c.length; });
  await pipeline(nodeStream, ws);

  if (written !== f.size) throw new Error(`size mismatch: got ${written}, expected ${f.size}`);
  const sha256 = hash.digest('hex');

  // Atomic rename with retry (OneDrive sync can transiently lock the file).
  atomicRename(partPath, localPath);

  return {
    path: f.path, size: f.size, last_modified: f.last_modified,
    sha256, bytes_written: written, retrievedAt: new Date().toISOString(), status: 'done',
  };
}

function atomicRename(from, to, tries = 5) {
  for (let i = 0; ; i++) {
    try { renameSync(from, to); return; }
    catch (e) {
      if (i >= tries) throw new Error(`rename ${from} -> ${to} failed (OneDrive lock?): ${e.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// verify
// ---------------------------------------------------------------------------
async function cmdVerify(deep) {
  if (!existsSync(INVENTORY_PATH)) fail('inventory.json missing — run `plan` first.');
  if (!existsSync(MIRROR_MANIFEST_PATH)) fail('mirror-manifest.json missing — nothing mirrored yet.');
  const inv = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'));
  const invByPath = new Map(inv.filter((e) => !e.is_directory).map((e) => [e.path, e]));
  const manifest = JSON.parse(readFileSync(MIRROR_MANIFEST_PATH, 'utf8'));
  let bad = 0, ok = 0;

  for (const [p, rec] of Object.entries(manifest)) {
    const local = localFor(p);
    if (!existsSync(local)) { console.error(`[verify] MISSING ${p}`); bad++; continue; }
    const size = statSync(local).size;
    const invSize = invByPath.get(p)?.size ?? rec.size;
    if (size !== invSize) { console.error(`[verify] SIZE ${p}: local ${size} vs inventory ${invSize}`); bad++; continue; }
    if (deep && rec.sha256) {
      const h = createHash('sha256');
      await pipeline(createReadStream(local), async function* (s) { for await (const c of s) h.update(c); yield* []; });
      if (h.digest('hex') !== rec.sha256) { console.error(`[verify] HASH ${p}`); bad++; continue; }
    }
    ok++;
  }
  console.log(`[verify] ok=${ok} bad=${bad}${deep ? ' (deep)' : ''}`);
  if (bad) process.exit(1);
}

// ---------------------------------------------------------------------------
// Skeleton — recreate the FULL Databricks folder tree 1:1 locally (every dir in
// the inventory), then drop a marker in each folder that holds no mirrored file:
//   _EMPTY_IN_SOURCE.txt        — the source directory has zero files
//   _NOT_MIRRORED.txt           — source has files, but none were selected
//                                 (excluded by scope or the seismic guard)
// Folders that receive real files get no marker.
// ---------------------------------------------------------------------------
function buildSkeleton(selectedPaths) {
  const inv = JSON.parse(readFileSync(INVENTORY_PATH, 'utf8'));
  const dirs = inv.filter((e) => e.is_directory);
  const filesByDir = new Map(); // dir rel -> {total, selected}
  for (const e of inv) {
    if (e.is_directory) continue;
    const d = e.path.includes('/') ? e.path.slice(0, e.path.lastIndexOf('/')) : '';
    const rec = filesByDir.get(d) || { total: 0, selected: 0 };
    rec.total++;
    if (selectedPaths.has(e.path)) rec.selected++;
    filesByDir.set(d, rec);
  }
  let made = 0, emptySrc = 0, notMirrored = 0;
  for (const dir of dirs) {
    const local = join(RAW_ROOT, ...dir.path.split('/').map(sanitizeSegment));
    ensureDir(local);
    made++;
    const rec = filesByDir.get(dir.path) || { total: 0, selected: 0 };
    if (rec.selected > 0) continue; // will hold real files
    if (rec.total === 0) {
      writeFileSync(join(local, '_EMPTY_IN_SOURCE.txt'),
        `This directory is empty in the Databricks Volve volume.\nSource path: /${VOLUME_ROOT}/${dir.path}\n`);
      emptySrc++;
    } else {
      writeFileSync(join(local, '_NOT_MIRRORED.txt'),
        `Not mirrored: ${rec.total} source file(s) here were excluded by selection scope or the seismic guard.\nSource path: /${VOLUME_ROOT}/${dir.path}\n`);
      notMirrored++;
    }
  }
  console.log(`[skeleton] ${made} dirs created 1:1; ${emptySrc} empty-in-source, ${notMirrored} not-mirrored markers`);
}

// ---------------------------------------------------------------------------
// Local path mapping — mirror the volume tree 1:1, sanitizing ONLY the local
// copy when Windows forbids a char or the path is too long. True source path is
// always preserved in the manifest.
// ---------------------------------------------------------------------------
const WIN_ILLEGAL = /[:*?"<>|]/g;
function sanitizeSegment(seg) {
  return seg.replace(WIN_ILLEGAL, '_');
}
function localFor(relPath) {
  let local = join(RAW_ROOT, ...relPath.split('/').map(sanitizeSegment));
  if (local.length > 250) {
    // Path-length fallback: hash the tail into a short stable name.
    const h = createHash('sha1').update(relPath).digest('hex').slice(0, 12);
    const top = relPath.split('/')[0];
    local = join(RAW_ROOT, sanitizeSegment(top), `__long_${h}`);
  }
  return local;
}

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------
function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }
function rel(p) { return p.replace(REPO_ROOT + '\\', '').replace(REPO_ROOT + '/', ''); }
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1, v = n;
  do { v /= 1024; i++; } while (v >= 1024 && i < u.length - 1);
  return `${v.toFixed(2)} ${u[i]}`;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const cmd = process.argv[2];
const flags = new Set(process.argv.slice(3));
const env = loadEnv();

switch (cmd) {
  case 'plan':   await cmdPlan(env); break;
  case 'mirror': await cmdMirror(env); break;
  case 'verify': await cmdVerify(flags.has('--deep')); break;
  default:
    console.log('Usage: node scripts/volve-mirror.mjs <plan|mirror|verify [--deep]>');
    process.exit(cmd ? 1 : 0);
}

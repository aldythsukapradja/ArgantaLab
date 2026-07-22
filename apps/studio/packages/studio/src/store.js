"use client";

// ─── ArgantaStudio persistence store ─────────────────────────────────────────
//
// The durable run/asset ledger (kills gaps G1 localStorage-scatter + G3 no-job-
// model). One adapter, two backends chosen at runtime:
//
//   cloudReady === true   → Supabase (PostgREST over fetch, no SDK) + Storage
//   cloudReady === false  → localStorage (survives refresh; upgrades silently
//                           when creds land, same as the generation fabric)
//
// Env (Next public): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY.
// Bytes never go to Postgres — assets carry a public URL only.

const ENV = (typeof process !== 'undefined' && process.env) ? process.env : {};
const SB_URL = (ENV.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SB_KEY = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const cloudReady =
  !!SB_URL && !!SB_KEY && !SB_URL.includes('placeholder') && !SB_URL.includes('your-supabase');

const LS_KEY = 'arganta_studio_runs_v1';
const LS_LIMIT = 200; // keep localStorage bounded; cloud has no cap

// ─── change notification (so the Library refreshes live) ─────────────────────
const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emitChange() { for (const fn of listeners) { try { fn(); } catch { /* noop */ } } }

// ─── localStorage backend ────────────────────────────────────────────────────

function lsRead() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function lsWrite(runs) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(runs.slice(0, LS_LIMIT)));
  } catch {
    /* quota — drop oldest silently */
  }
  emitChange();
}

// ─── Supabase PostgREST backend ──────────────────────────────────────────────

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: options.prefer || 'return=representation',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`supabase ${res.status}: ${await res.text().catch(() => '')}`.slice(0, 200));
  return res.status === 204 ? null : res.json();
}

/** Upload bytes to the public Storage bucket, return the public URL. */
async function sbUploadAsset(id, mime, bytes) {
  const ext = (mime.split('/')[1] || 'bin').split('+')[0];
  const objectPath = `${id}.${ext}`;
  const res = await fetch(`${SB_URL}/storage/v1/object/studio-assets/${objectPath}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': mime, 'x-upsert': 'true' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage ${res.status}`);
  return `${SB_URL}/storage/v1/object/public/studio-assets/${objectPath}`;
}

// ─── Public API (backend-agnostic) ───────────────────────────────────────────

function newId() {
  // crypto.randomUUID everywhere modern; fallback keeps SSR/edge safe.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `run-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
}

/** Create a pending run. Returns the run object (with id). */
export async function createRun(fields) {
  const run = {
    id: newId(),
    kind: 'image',
    status: 'pending',
    cost: 0,
    cost_class: 0,
    created_at: new Date().toISOString(),
    ...fields,
  };
  if (cloudReady) {
    try {
      const [row] = await sbFetch('studio_runs', { method: 'POST', body: JSON.stringify(stripClientOnly(run)) });
      emitChange();
      return row || run;
    } catch (e) {
      console.warn('[studio-store] cloud createRun failed, using local:', e.message);
    }
  }
  const runs = lsRead();
  runs.unshift(run);
  lsWrite(runs);
  return run;
}

/** Patch a run (status/cost/engine/error/completed_at). */
export async function updateRun(id, patch) {
  if (cloudReady) {
    try {
      await sbFetch(`studio_runs?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch), prefer: 'return=minimal' });
      emitChange();
      return;
    } catch (e) {
      console.warn('[studio-store] cloud updateRun failed, using local:', e.message);
    }
  }
  const runs = lsRead();
  const i = runs.findIndex((r) => r.id === id);
  if (i >= 0) { runs[i] = { ...runs[i], ...patch }; lsWrite(runs); }
}

/**
 * Attach an asset to a run. `dataUrl` (data:mime;base64,...) is the fabric
 * result. In cloud mode the bytes upload to Storage and the row stores the
 * public URL; in local mode the data URL is kept inline.
 */
export async function attachAsset(runId, { dataUrl, width, height, palette }) {
  const isData = typeof dataUrl === 'string' && dataUrl.startsWith('data:');
  const mime = isData ? ((dataUrl.match(/^data:([^;]+)/) || [])[1] || 'image/png') : null;
  const orientation = orientationOf(width, height);
  if (cloudReady) {
    try {
      // Hosted URL (e.g. muapi output): store the reference, no byte upload.
      if (!isData) {
        const [row] = await sbFetch('studio_assets', {
          method: 'POST',
          body: JSON.stringify({ run_id: runId, kind: 'image', url: dataUrl, width, height, orientation, palette }),
        });
        emitChange();
        return row?.url || dataUrl;
      }
      const bytes = base64ToBytes(dataUrl.split(',')[1]);
      const url = await sbUploadAsset(runId, mime, bytes);
      const [row] = await sbFetch('studio_assets', {
        method: 'POST',
        body: JSON.stringify({ run_id: runId, kind: 'image', url, mime, width, height, bytes: bytes.length, orientation, palette }),
      });
      emitChange();
      return row?.url || url;
    } catch (e) {
      console.warn('[studio-store] cloud attachAsset failed, using local:', e.message);
    }
  }
  // Local: fold the data URL + derived metadata onto the run so the Library can render it.
  const runs = lsRead();
  const i = runs.findIndex((r) => r.id === runId);
  if (i >= 0) { runs[i] = { ...runs[i], asset_url: dataUrl, width, height, orientation, palette: palette || null }; lsWrite(runs); }
  return dataUrl;
}

function orientationOf(width, height) {
  if (!width || !height) return null;
  const r = width / height;
  return r > 1.15 ? 'landscape' : r < 0.87 ? 'portrait' : 'square';
}

/** List recent runs (newest first), each with its asset URL folded in. */
export async function listRuns(limit = 60) {
  if (cloudReady) {
    try {
      const runs = await sbFetch(`studio_runs?order=created_at.desc&limit=${limit}`);
      const assets = await sbFetch(`studio_assets?order=created_at.desc&limit=${limit * 2}`).catch(() => []);
      const byRun = {};
      for (const a of assets || []) if (!byRun[a.run_id]) byRun[a.run_id] = a.url;
      return (runs || []).map((r) => ({ ...r, asset_url: byRun[r.id] || null }));
    } catch (e) {
      console.warn('[studio-store] cloud listRuns failed, using local:', e.message);
    }
  }
  return lsRead().slice(0, limit);
}

export function storeBackend() {
  return cloudReady ? 'supabase' : 'local';
}

// ─── Posts: the publish side (studio_posts) ──────────────────────────────────
// Same backend split. Posts are the character→generation→post edge chain's leaf
// and feed the Knowledge Graph. Created as drafts; a Buffer token (C6) upgrades
// them to queued.

const LS_POSTS_KEY = 'arganta_studio_posts_v1';

function lsPostsRead() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(LS_POSTS_KEY) || '[]'); } catch { return []; }
}
function lsPostsWrite(posts) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_POSTS_KEY, JSON.stringify(posts.slice(0, 300))); } catch { /* quota */ }
  emitChange();
}

/** Create a post (draft) linked to a generation run. */
export async function createPost(fields) {
  const post = {
    id: newId(),
    run_id: fields.run_id || null,
    character_id: fields.character_id || null,
    brand: fields.brand || null,
    platform: fields.platform || 'instagram',
    format: fields.format || 'post',
    caption: fields.caption || '',
    status: fields.status || 'draft',
    external_id: fields.external_id || null,
    metrics: fields.metrics || {},
    scheduled_at: fields.scheduled_at || null,
    created_at: new Date().toISOString(),
  };
  if (cloudReady) {
    try {
      const [row] = await sbFetch('studio_posts', { method: 'POST', body: JSON.stringify(post) });
      emitChange();
      return row || post;
    } catch (e) { console.warn('[studio-store] cloud createPost failed, using local:', e.message); }
  }
  const posts = lsPostsRead(); posts.unshift(post); lsPostsWrite(posts); return post;
}

export async function updatePost(id, patch) {
  if (cloudReady) {
    try {
      await sbFetch(`studio_posts?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify(patch), prefer: 'return=minimal' });
      emitChange();
      return;
    } catch (e) { console.warn('[studio-store] cloud updatePost failed, using local:', e.message); }
  }
  const posts = lsPostsRead(); const i = posts.findIndex((p) => p.id === id);
  if (i >= 0) { posts[i] = { ...posts[i], ...patch }; lsPostsWrite(posts); }
}

export async function listPosts(limit = 100) {
  if (cloudReady) {
    try { return await sbFetch(`studio_posts?order=created_at.desc&limit=${limit}`); }
    catch (e) { console.warn('[studio-store] cloud listPosts failed, using local:', e.message); }
  }
  return lsPostsRead().slice(0, limit);
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function stripClientOnly(run) {
  // asset_url/width/height are local-only conveniences; the cloud schema keeps
  // them on studio_assets, so don't send them to the runs table.
  const { asset_url, width, height, ...rest } = run;
  return rest;
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

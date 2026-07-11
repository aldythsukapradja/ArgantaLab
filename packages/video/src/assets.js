// Supabase Storage transport for the Video Builder's media library. Client-
// agnostic (takes a supabase-js client). Never-throws on reads so an offline /
// pre-migration HQ still renders (returns [] instead of blowing up) — same
// contract as @arganta/audio's repo.js. Needs supabase/migration_video_assets.sql
// run once, and (for stock import) the import-stock Edge Function deployed.

export const ASSET_BUCKET = 'video-assets';
export const RENDER_BUCKET = 'video-renders';

// The fast, filterable index (not a raw bucket list). kind: image|video|audio|font.
export async function listAssets(client, { kind, search, limit = 60 } = {}) {
  try {
    if (!client?.from) return [];
    let q = client.from('hq_video_asset').select('*').order('created_at', { ascending: false }).limit(limit);
    if (kind) q = q.eq('kind', kind);
    if (search) q = q.ilike('name', `%${search}%`);
    const { data, error } = await q;
    if (error) return [];
    return (data || []).map((a) => ({ ...a, url: publicUrl(client, a.bucket || ASSET_BUCKET, a.path), thumb: thumbUrl(client, a) }));
  } catch { return []; }
}

export function publicUrl(client, bucket, path) {
  try { return client.storage.from(bucket).getPublicUrl(path).data.publicUrl; } catch { return ''; }
}

// On-the-fly image transform for a light thumbnail (webp, capped) — cheap egress.
export function thumbUrl(client, asset, { width = 320, height = 320, quality = 60 } = {}) {
  try {
    const bucket = asset.bucket || ASSET_BUCKET;
    const path = asset.thumb_path || asset.path;
    if (asset.kind !== 'image' && !asset.thumb_path) return null; // only transform images
    return client.storage.from(bucket).getPublicUrl(path, { transform: { width, height, resize: 'contain', quality } }).data.publicUrl;
  } catch { return null; }
}

// Upload a File/Blob + index it. meta: { kind, width, height, duration, tags }.
// Uses the standard upload (fine ≤ bucket limit); for >~50MB video prefer TUS
// (tus-js-client) against the same bucket — the row shape is identical.
export async function uploadAsset(client, file, meta = {}) {
  if (!client?.storage) throw new Error('no supabase client');
  const kind = meta.kind || guessKind(file.type);
  const ext = (file.name?.split('.').pop() || extForMime(file.type) || 'bin').toLowerCase();
  const base = slug(file.name?.replace(/\.[^.]+$/, '') || kind);
  const path = `upload/${kind}/${base}-${Date.now().toString(36)}.${ext}`;
  const up = await client.storage.from(ASSET_BUCKET).upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (up.error) throw up.error;
  const row = {
    kind, bucket: ASSET_BUCKET, path, name: base, mime: file.type || null,
    bytes: file.size ?? null, width: meta.width ?? null, height: meta.height ?? null,
    duration: meta.duration ?? null, tags: meta.tags || [], source: 'upload',
  };
  const ins = await client.from('hq_video_asset').insert(row).select().single();
  if (ins.error) throw ins.error;
  return { ...ins.data, url: publicUrl(client, ASSET_BUCKET, path), thumb: thumbUrl(client, ins.data) };
}

export async function deleteAsset(client, asset) {
  try {
    await client.storage.from(asset.bucket || ASSET_BUCKET).remove([asset.path]);
    await client.from('hq_video_asset').delete().eq('id', asset.id);
    return true;
  } catch { return false; }
}

// Save a rendered video to the renders bucket; returns a public URL (hand to Kinetik).
export async function saveRender(client, blob, meta = {}) {
  if (!client?.storage) throw new Error('no supabase client');
  const ext = meta.ext || (blob.type.includes('mp4') ? 'mp4' : 'webm');
  const path = `renders/${slug(meta.name || 'video')}-${Date.now().toString(36)}.${ext}`;
  const up = await client.storage.from(RENDER_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (up.error) throw up.error;
  const url = publicUrl(client, RENDER_BUCKET, path);
  // index it too (kind:video, source:render) so it shows in the library
  await client.from('hq_video_asset').insert({
    kind: 'video', bucket: RENDER_BUCKET, path, name: meta.name || 'render', mime: blob.type,
    bytes: blob.size, duration: meta.duration ?? null, source: 'render',
  }).select().single().catch?.(() => {});
  return { url, path };
}

// Bulk stock ingest — invokes the import-stock Edge Function (operator only).
// { provider:'pexels'|'pixabay', query, count, kind:'image'|'video', orientation }
export async function importStock(client, opts) {
  if (!client?.functions) throw new Error('no supabase client');
  const { data, error } = await client.functions.invoke('import-stock', { body: opts });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data; // { ok, imported, requested, assets:[…] }
}

// ── helpers ──
function slug(s) { return (s || 'asset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'asset'; }
function guessKind(mime = '') { if (mime.startsWith('image/')) return 'image'; if (mime.startsWith('video/')) return 'video'; if (mime.startsWith('audio/')) return 'audio'; if (mime.includes('font')) return 'font'; return 'image'; }
function extForMime(m = '') { return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'audio/mpeg': 'mp3', 'audio/wav': 'wav' })[m] || ''; }

// Load an image URL → HTMLImageElement (crossOrigin so canvas stays untainted
// and export still works). Resolves null on failure so callers don't crash.
export function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

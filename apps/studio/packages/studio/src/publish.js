"use client";

// ─── ArgantaStudio publish fabric ────────────────────────────────────────────
//
// Turns a generation into a platform post. Adapter-shaped (like the generation
// fabric) so the backbone can swap Buffer → Postiz → direct APIs without
// changing callers. Buffer is the first adapter.
//
// Research (docs/arganta-studio/master-plan.md): Buffer's public API is the new
// GraphQL API (api.buffer.com), open on all plans; media must be a PUBLIC URL
// (no direct upload); it publishes IG/FB/TikTok/LinkedIn + YouTube *Shorts*
// (full-length YouTube = the YouTube Data API, a later adapter). buffer_publish
// only QUEUES for review — it never posts immediately. We honor that: "publish"
// = queue to Buffer, and the copy never claims a post went live.
//
// Token gating mirrors the Polish ladder: no token → posts stay local drafts
// (still populate the graph); a token upgrades them to queued-in-Buffer. The
// token is the approval gate. We never hardcode or transmit it anywhere but to
// Buffer's own API.

import { createPost, updatePost } from './store.js';

const BUFFER_TOKEN_KEY = 'arganta_buffer_token_v1';

// Platforms Buffer can queue to, with the formats each supports (per research).
export const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: '📸', formats: ['post', 'reel', 'story', 'carousel'] },
  { id: 'facebook',  label: 'Facebook',  icon: '👍', formats: ['post', 'reel', 'story'] },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵', formats: ['reel'] },
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼', formats: ['post'] },
  { id: 'youtube',   label: 'YouTube',   icon: '▶️', formats: ['short'] }, // Shorts via Buffer; longform = YT Data API (later)
];

export function platformFormats(platformId) {
  return PLATFORMS.find((p) => p.id === platformId)?.formats || ['post'];
}

// ─── token management ────────────────────────────────────────────────────────

export function getBufferToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(BUFFER_TOKEN_KEY) || null;
}

export function setBufferToken(token) {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(BUFFER_TOKEN_KEY, token.trim());
  else window.localStorage.removeItem(BUFFER_TOKEN_KEY);
}

/** True when a Buffer token is connected — the approval gate for queueing. */
export function canQueueToBuffer() {
  return !!getBufferToken();
}

// ─── channels (Buffer GraphQL) ───────────────────────────────────────────────
// Lists the connected Buffer channels so a post can target a real channel id.
// Degraded (no token) → empty list; the UI falls back to platform-only drafts.

export async function listBufferChannels() {
  const token = getBufferToken();
  if (!token) return { connected: false, channels: [] };
  try {
    const res = await fetch('/api/publish/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || `channels HTTP ${res.status}`);
    return { connected: true, channels: data.channels || [] };
  } catch (e) {
    return { connected: true, channels: [], error: e.message };
  }
}

// ─── compose + queue ─────────────────────────────────────────────────────────

/**
 * Create a post from a generation. Always creates the local record (draft) so
 * it appears in the Library/Graph immediately; if a Buffer token is present and
 * a channel is chosen, it also queues to Buffer (status → 'queued').
 */
export async function composePost({ run, platform, format, caption, channelId, brand }) {
  const post = await createPost({
    run_id: run?.id || null,
    character_id: run?.character_id || null,
    brand: brand || run?.brand || null,
    platform,
    format,
    caption,
    status: 'draft',
  });

  if (!canQueueToBuffer() || !channelId) {
    return { post, queued: false };
  }

  // Queue to Buffer (research: this only ADDS TO QUEUE for operator review in
  // Buffer — never publishes live). Media must be a public URL.
  try {
    const res = await fetch('/api/publish/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: getBufferToken(),
        channelId,
        text: caption,
        mediaUrl: run?.asset_url && !run.asset_url.startsWith('data:') ? run.asset_url : null,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error || `queue HTTP ${res.status}`);
    await updatePost(post.id, { status: 'queued', external_id: data.updateId || null });
    return { post: { ...post, status: 'queued', external_id: data.updateId || null }, queued: true };
  } catch (e) {
    await updatePost(post.id, { status: 'failed', metrics: { error: e.message } });
    throw e;
  }
}

// Buffer publishing — pure GraphQL builders + request validation (BF1).
// Buffer's API is GraphQL: POST https://api.buffer.com, Authorization: Bearer
// <BUFFER_TOKEN>. Kept dependency-free + Node-testable, same discipline as
// router.js/schema.js. Network lives in src/index.js (bufferGraphql()).

export const BUFFER_API = 'https://api.buffer.com';

// ShareMode enum values, confirmed against the live Buffer schema (BF1):
//   addToQueue   → append to the channel's queue (the human review step; DEFAULT)
//   shareNext    → jump the queue (next slot)
//   shareNow     → publish immediately
// (customScheduled exists too but needs a dueAt; not exposed here.)
export const ALLOWED_MODES = Object.freeze(['addToQueue', 'shareNext', 'shareNow']);
export const DEFAULT_MODE = 'addToQueue';

// GraphQL string literal from an arbitrary JS string. GraphQL's string syntax
// matches JSON's for the escapes we care about (quotes, backslashes, newlines),
// so JSON.stringify yields a valid, injection-safe literal for captions/URLs.
export const gqlStr = (s) => JSON.stringify(String(s == null ? '' : s));

const HTTP_URL = /^https?:\/\/.+/i;

// Buffer's `channels` query REQUIRES an organizationId, which comes from the
// account query first (verified against the live schema — the nested
// account.organizations.channels path is FORBIDDEN for API tokens, so the two
// top-level queries are the supported route).
export function accountOrgsQuery() {
  return `query { account { organizations { id name } } }`;
}
export function extractOrgs(data) {
  const orgs = data && data.data && data.data.account && data.data.account.organizations;
  return Array.isArray(orgs) ? orgs.map((o) => ({ id: o.id, name: o.name })) : [];
}

/** Channels for one organization. */
export function channelsQuery(organizationId) {
  return `query { channels(input: { organizationId: ${gqlStr(organizationId)} }) {
    id name service type displayName isDisconnected
  } }`;
}

/** Normalise the channels response; drop disconnected channels (can't publish). */
export function extractChannels(data) {
  const chans = data && data.data && data.data.channels;
  if (!Array.isArray(chans)) return [];
  return chans
    .filter((c) => c && !c.isDisconnected)
    .map((c) => ({
      id: c.id,
      name: c.displayName || c.name || c.service || 'channel',
      service: c.service || 'unknown',
      type: c.type || null,
    }));
}

// Instagram REQUIRES metadata.instagram.{type, shouldShareToFeed} on every post
// — confirmed live: omitting it 400s with "Instagram posts require a type
// (post, story, or reel)". And although the PostType enum CONTAINS `carousel`,
// Instagram rejects it too ("Instagram does not support the 'carousel' post
// type. Valid types are post, story, or reel." — second live 400). A multi-
// image carousel IS just type `post` with multiple assets; the enum's other
// values belong to other platforms (short=YouTube, thread=Threads, etc.).
function instagramMetadata(kind) {
  const type = kind === 'video' ? 'reel' : 'post';
  return `{ instagram: { type: ${type}, shouldShareToFeed: true } }`;
}

/** Build the createPost mutation (inline input — text/urls are gqlStr-encoded,
 * mode is a bare enum from the allowlist, so nothing user-supplied is unescaped).
 * Either `imageUrls` (carousel, 1-10 images) or `videoUrl` (+ optional
 * `thumbnailUrl`) is provided — never both, enforced by parsePublishBody.
 * `channelService` gates the Instagram-only metadata block (harmless to omit
 * for non-Instagram channels, which don't require it). */
export function createPostMutation({ channelId, text, imageUrls, videoUrl, thumbnailUrl, mode, channelService }) {
  const assets = videoUrl
    ? `{ video: { url: ${gqlStr(videoUrl)}${thumbnailUrl ? `, thumbnailUrl: ${gqlStr(thumbnailUrl)}` : ''} } }`
    : (imageUrls || []).map((u) => `{ image: { url: ${gqlStr(u)} } }`).join(', ');
  const kind = videoUrl ? 'video' : (imageUrls || []).length > 1 ? 'carousel' : 'post';
  const metadata = (channelService || 'instagram') === 'instagram' ? `\n      metadata: ${instagramMetadata(kind)}` : '';
  return `mutation {
    createPost(input: {
      text: ${gqlStr(text)}
      channelId: ${gqlStr(channelId)}
      schedulingType: automatic
      mode: ${mode}
      assets: [${assets}]${metadata}
    }) {
      ... on PostActionSuccess { post { id } }
      ... on MutationError { message }
    }
  }`;
}

/** Pull the created post id (or a Buffer-side error) out of a createPost result. */
export function extractPostResult(data) {
  if (data && Array.isArray(data.errors) && data.errors.length) {
    return { ok: false, message: data.errors.map((e) => e.message).join('; ') };
  }
  const cp = data && data.data && data.data.createPost;
  if (!cp) return { ok: false, message: 'no createPost in response' };
  if (cp.message) return { ok: false, message: cp.message };       // MutationError
  const id = cp.post && cp.post.id;
  return id ? { ok: true, postId: id } : { ok: false, message: 'no post id returned' };
}

/**
 * Validate a /v1/buffer/publish body. Returns { ok, req } or { ok:false, code, message }.
 * Two mutually-exclusive shapes: `imageUrls` (carousel, 1-10 images, Instagram's
 * cap via any 3rd-party API) OR `videoUrl` (+ optional `thumbnailUrl`) for a
 * single video/reel post — never mixed media in one Instagram post.
 */
export function parsePublishBody(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, code: 'bad_request', message: 'body must be a JSON object' };
  const channelId = typeof raw.channelId === 'string' ? raw.channelId.trim() : '';
  if (!channelId) return { ok: false, code: 'no_channel', message: 'channelId is required' };

  const text = typeof raw.text === 'string' ? raw.text.slice(0, 2200) : '';
  const mode = ALLOWED_MODES.includes(raw.mode) ? raw.mode : DEFAULT_MODE;
  // Which platform-specific metadata block to attach (defaults to 'instagram'
  // since that's this integration's only channel today — see createPostMutation).
  const channelService = typeof raw.channelService === 'string' ? raw.channelService : 'instagram';

  if (typeof raw.videoUrl === 'string' && raw.videoUrl) {
    if (!HTTP_URL.test(raw.videoUrl)) return { ok: false, code: 'bad_video_url', message: 'videoUrl must be a public http(s) URL' };
    const thumbnailUrl = typeof raw.thumbnailUrl === 'string' && HTTP_URL.test(raw.thumbnailUrl) ? raw.thumbnailUrl : undefined;
    return { ok: true, req: { channelId, videoUrl: raw.videoUrl, thumbnailUrl, text, mode, channelService } };
  }

  const urls = Array.isArray(raw.imageUrls) ? raw.imageUrls.filter((u) => typeof u === 'string' && HTTP_URL.test(u)) : [];
  if (!urls.length) return { ok: false, code: 'no_images', message: 'imageUrls must contain at least one public http(s) URL' };
  if (urls.length > 10) return { ok: false, code: 'too_many_images', message: 'Instagram carousels allow at most 10 images' };

  return { ok: true, req: { channelId, imageUrls: urls, text, mode, channelService } };
}

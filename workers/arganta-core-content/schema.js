// Arganta Core Content Engine — shared contract (pure, dependency-free).
// This is the ONE place the Worker and the HQ client agree on: the template /
// palette / format vocabularies (mirrored from apps/hq/src/surfaces/broadcast/
// postEngine.ts + postTemplates.ts), the copy output shape, and the image
// aspect map. Kept plain-Node importable so router.test.js can exercise it with
// no Cloudflare runtime — same discipline as build-artifact-runtime's router.
//
// NOTE: these lists are duplicated from the TS source on purpose — the Worker
// can't import app TS. A test asserts the counts so drift is caught loudly.

export const TEMPLATE_IDS = Object.freeze([
  'hook', 'fact', 'tip', 'list', 'quote', 'number', 'versus', 'photo', 'cta',
]);

export const PALETTE_IDS = Object.freeze([
  'kinetik', 'dusk', 'grape', 'mint', 'ember', 'ocean', 'noir', 'paper', 'cloud', 'sunrise',
]);

// format id -> generation dimensions for the still image. Workers AI SDXL caps
// at 1024px on the long edge AND requires both dims divisible by 8 (confirmed
// against the live deploy — a 819px width 500-errored: "height and width have
// to be divisible by 8"). Every value below is rounded to the nearest /8
// while keeping the aspect visually indistinguishable from the true format;
// the canvas in Post Studio re-scales to the true export size (1080×1350 etc.)
// regardless, so this is generation-resolution only, never the final asset size.
export const FORMAT_ASPECT = Object.freeze({
  portrait: { w: 816, h: 1024 },   // 4:5  (819 → 816)
  square: { w: 1024, h: 1024 },    // 1:1
  story: { w: 576, h: 1024 },      // 9:16
  pin: { w: 680, h: 1024 },        // 2:3  (683 → 680)
  wide: { w: 1024, h: 576 },       // 16:9
  link: { w: 1024, h: 536 },       // 1.91:1
});

export const DEFAULT_FORMAT = 'portrait';
export const aspectFor = (format) => FORMAT_ASPECT[format] || FORMAT_ASPECT[DEFAULT_FORMAT];

// The strict copy shape the text model must return. Same fields Post Studio's
// coercePost() already knows how to stamp onto slides — so a Worker response
// drops straight into the existing pipeline with no new coercion.
export const COPY_SCHEMA = Object.freeze({
  type: 'object',
  required: ['slides', 'caption'],
  properties: {
    palette: { type: 'string', enum: [...PALETTE_IDS] },
    slides: {
      type: 'array',
      items: {
        type: 'object',
        required: ['template'],
        properties: {
          template: { type: 'string', enum: [...TEMPLATE_IDS] },
          headline: { type: 'string' },
          body: { type: 'string' },
          emoji: { type: 'string' },
          badge: { type: 'string' },
          source: { type: 'string' },
          // per-slide image brief — filled only when the surface asked for
          // generated backgrounds; the image pass reads this.
          imagePrompt: { type: 'string' },
        },
      },
    },
    caption: { type: 'string' },
    hashtags: { type: 'string' },
  },
});

const clip = (v, n) => (typeof v === 'string' && v.trim() ? v.slice(0, n) : undefined);

/**
 * Never-throws normaliser: whatever the model returned (or a hand-rolled draft)
 * → a valid copy object. Mirrors coercePost()'s clamping so the Worker and the
 * app agree on limits. Returns { slides:[], caption, hashtags, palette }.
 */
export function coerceCopy(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const templates = new Set(TEMPLATE_IDS);
  let slides = Array.isArray(o.slides) ? o.slides : [];
  slides = slides
    .filter((s) => s && templates.has(String(s.template)))
    .slice(0, 8)
    .map((s) => {
      const out = { template: String(s.template) };
      const h = clip(s.headline, 140); if (h) out.headline = h;
      const b = clip(s.body, 400); if (b) out.body = b;
      const e = clip(s.emoji, 4); if (e) out.emoji = e;
      const g = clip(s.badge, 24); if (g) out.badge = g;
      const c = clip(s.source, 60); if (c) out.source = c;
      const p = clip(s.imagePrompt, 400); if (p) out.imagePrompt = p;
      return out;
    });
  const out = { slides, caption: clip(o.caption, 2200) || '', hashtags: clip(o.hashtags, 300) || '' };
  if (PALETTE_IDS.includes(String(o.palette))) out.palette = String(o.palette);
  return out;
}

/** Pull the first {...} JSON object out of a model reply (they wrap in prose
 * or ```json fences often enough that this matters). Returns null on failure. */
export function extractJson(text) {
  if (typeof text !== 'string') return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(candidate.slice(start, end + 1)); } catch { return null; }
}

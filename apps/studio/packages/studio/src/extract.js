"use client";

// ─── ArgantaStudio deterministic metadata extractor ──────────────────────────
//
// Derives searchable/graphable metadata from a generation with ZERO LLM —
// mirroring the vault/cortex priority-cascade extractors (deriveLayer,
// deriveOntologyType: "never invents authority"). Pure functions, reproducible.
//
// The output shape IS the future AI-caption/auto-tag contract: an agent can
// later replace deriveTags/deriveCaption without changing callers, exactly like
// buildSuggestedEdges and the karaoke word-timing seam.

// ─── orientation (from dimensions) ───────────────────────────────────────────

export function deriveOrientation(width, height) {
  if (!width || !height) return 'square';
  const r = width / height;
  if (r > 1.15) return 'landscape';
  if (r < 0.87) return 'portrait';
  return 'square';
}

// ─── tags (priority cascade over the prompt + context) ───────────────────────
// Rule-based keyword buckets. Conservative: emits only what it can defend, and
// always includes the surface + provider so nothing is untagged.

const TAG_RULES = [
  [/\b(portrait|face|headshot|selfie|person|man|woman|character)\b/i, 'people'],
  [/\b(landscape|mountain|forest|ocean|sea|sky|sunset|dusk|nature)\b/i, 'nature'],
  [/\b(city|urban|street|building|architecture|skyline)\b/i, 'urban'],
  [/\b(product|bottle|packshot|mockup|device|gadget)\b/i, 'product'],
  [/\b(logo|icon|brand|poster|banner|typographic)\b/i, 'branding'],
  [/\b(cinematic|film|movie|dramatic|moody|noir)\b/i, 'cinematic'],
  [/\b(neon|cyberpunk|futuristic|sci-?fi)\b/i, 'futuristic'],
  [/\b(vintage|retro|1950s|1980s|analog|film grain)\b/i, 'vintage'],
  [/\b(anime|manga|cartoon|illustration|drawing)\b/i, 'illustration'],
  [/\b(3d|render|octane|blender|cgi)\b/i, '3d'],
  [/\b(watercolor|oil paint|sketch|painterly)\b/i, 'painterly'],
];

export function deriveTags(prompt, { surface, provider } = {}) {
  const tags = new Set();
  const text = prompt || '';
  for (const [re, tag] of TAG_RULES) if (re.test(text)) tags.add(tag);
  if (surface) tags.add(surface);
  if (provider) tags.add(provider);
  return [...tags];
}

// ─── palette (dominant colors sampled from PNG bytes) ────────────────────────
// Decodes the data URL onto an offscreen canvas and buckets pixels into a small
// color histogram. Deterministic for the same bytes. Browser-only (needs
// canvas); returns [] under SSR so callers stay safe.

export async function derivePalette(dataUrl, maxColors = 5) {
  if (typeof document === 'undefined' || !dataUrl?.startsWith('data:image')) return [];
  try {
    const img = await loadImage(dataUrl);
    const S = 48; // downsample — palette doesn't need full res
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, S, S);
    const { data } = ctx.getImageData(0, 0, S, S);

    const buckets = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue; // skip transparent
      // Quantize to 4 bits/channel so near-colors merge.
      const r = data[i] & 0xf0, g = data[i + 1] & 0xf0, b = data[i + 2] & 0xf0;
      const key = (r << 16) | (g << 8) | b;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    const total = [...buckets.values()].reduce((a, c) => a + c, 0) || 1;
    return [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)
      .map(([key, count]) => ({
        hex: '#' + ((key >>> 0).toString(16).padStart(6, '0')),
        weight: Math.round((count / total) * 100) / 100,
      }));
  } catch {
    return [];
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ─── checksum (FNV-1a — reproducibility proof, matches media-core) ───────────

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ─── one call: everything derivable without the bytes on screen ──────────────

export function deriveRunMetadata({ prompt, model, seed, surface, provider, width, height }) {
  return {
    tags: deriveTags(prompt, { surface, provider }),
    orientation: deriveOrientation(width, height),
    checksum: fnv1a(`${model || ''}|${prompt || ''}|${seed ?? ''}`),
  };
}

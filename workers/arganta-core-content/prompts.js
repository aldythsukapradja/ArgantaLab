// Arganta Core — prompt construction (pure). O1 ships a functional baseline;
// O2 (context protocol) expands how much of the live doc context is threaded
// in. Kept separate + dependency-free so it's unit-testable.

import { TEMPLATE_IDS, PALETTE_IDS } from './schema.js';

// A compact one-shot example keeps a small instruct model on-format. Mirrors
// the example in postTemplates.ts's postMessages() so Worker output matches
// what the app already renders well.
const EXAMPLE = {
  palette: 'dusk',
  slides: [
    { template: 'hook', headline: 'Animals with actual superpowers', body: 'no. 3 survives space', badge: 'WOW', imagePrompt: 'dramatic wildlife collage, deep space backdrop, cinematic' },
    { template: 'fact', headline: 'Octopuses have three hearts', body: 'Two pump to the gills, one to the body — and it stops when they swim.', emoji: '🐙', imagePrompt: 'a vivid octopus underwater, bioluminescent, dark water' },
    { template: 'number', headline: '3 years', body: 'how long a snail can sleep waiting for rain.', badge: 'BY THE NUMBERS' },
    { template: 'cta', headline: 'Want one of these daily?', body: 'Follow for a family wow-moment every day.' },
  ],
  caption: 'Your kids will not believe #2. 🐙 Three animal superpowers that sound fake but are 100% real — save this for the dinner table.',
  hashtags: '#animalfacts #funfactsforkids #familytime #didyouknow',
};

/**
 * Build the chat messages for the copy pass.
 * @param {string} brief  the user's request
 * @param {object} [ctx]  optional live-doc context (O2 fills this): { format, palette, platform, brand, wantImages }
 */
export function copyMessages(brief, ctx = {}) {
  const wantImages = ctx.wantImages !== false; // default: include image briefs
  const platform = ctx.platform || 'instagram';
  const brand = ctx.brand?.name ? ` The brand is "${ctx.brand.name}"${ctx.brand.handle ? ` (${ctx.brand.handle})` : ''}.` : '';
  const paletteHint = ctx.palette && PALETTE_IDS.includes(ctx.palette)
    ? ` Prefer the "${ctx.palette}" palette unless the topic clearly wants another.` : '';
  const formatHint = ctx.format ? ` The post is a ${ctx.format} format.` : '';
  // Honor an explicit slide count from the brief (the app also clamps as a
  // hard guarantee, but telling the model up front makes it comply far more).
  const n = Number(ctx.slideCount);
  const countRule = Number.isInteger(n) && n >= 1 && n <= 10
    ? ` IMPORTANT: output EXACTLY ${n} slide${n > 1 ? 's' : ''} — no more, no fewer.`
    : ' Rules: 3-6 slides.';

  // Revise mode: the surface can pass the slides already on the canvas so the
  // model edits/extends rather than starting cold. Kept short (headline+body
  // only) so it fits a small model's context.
  const existing = Array.isArray(ctx.existingSlides) && ctx.existingSlides.length
    ? `\nThe user is iterating on this current draft (revise/improve it, keep what works):\n${
        ctx.existingSlides.slice(0, 8).map((s, i) => `${i + 1}. [${s.template || 'fact'}] ${s.headline || ''}${s.body ? ' — ' + s.body : ''}`.slice(0, 160)).join('\n')
      }` : '';

  const sys = `You are Arganta Core, the content designer for a family app.${brand} Output ONLY a JSON object — no prose, no markdown fences:
{"palette":"${PALETTE_IDS.join('|')}",
 "slides":[{"template":"${TEMPLATE_IDS.join('|')}","headline":"short, punchy","body":"1-2 lines (list: numbered lines separated by \\n; versus: two options separated by \\n)","emoji":"one emoji (fact only)","badge":"short label (hook/tip/number only)","source":"attribution (fact/quote only)"${wantImages ? ',"imagePrompt":"a vivid photographic scene for this slide background, no text, no words"' : ''}}],
 "caption":"the ${platform} caption — hook in the first 125 chars, 1-3 short paragraphs, 1-2 emoji",
 "hashtags":"#three #to #five #relevant #hashtags"}
${countRule} Slide 1 = template "hook" with a curiosity gap. Last slide = template "cta". Headlines <= 9 words. Bodies <= 25 words. Concrete beats clever.${formatHint}${paletteHint}${wantImages ? ' Every imagePrompt must describe an IMAGE ONLY — never ask for text/letters in the picture.' : ''}`;

  return [
    { role: 'system', content: sys },
    { role: 'user', content: 'a carousel about animal superpowers for families' },
    { role: 'assistant', content: JSON.stringify(wantImages ? EXAMPLE : stripImagePrompts(EXAMPLE)) },
    { role: 'user', content: (String(brief || '').slice(0, 2000)) + existing },
  ];
}

function stripImagePrompts(ex) {
  return { ...ex, slides: ex.slides.map(({ imagePrompt, ...s }) => s) };
}

/** Turn a slide's brief into a clean image-model prompt. Guards against
 * baked-in text requests (models render garbled letters) and pins style. */
export function imagePrompt(brief, ctx = {}) {
  const base = String(brief || '').replace(/\b(text|words?|letters?|caption|title|logo)\b/gi, '').trim()
    || 'a warm, cinematic family lifestyle scene';
  const mood = ctx.palette ? `, ${ctx.palette} color mood` : '';
  return `${base}${mood}. Editorial photography, soft natural light, high detail, no text, no watermark, no letters.`;
}

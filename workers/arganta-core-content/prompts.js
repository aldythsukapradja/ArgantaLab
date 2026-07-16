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
 * The brand's voice, rendered for a system prompt.
 *
 * BF-5: `ctx.brand` used to be `{name, handle}` — enough to name-drop the brand,
 * nowhere near enough to sound like it. It now carries a voiceBlock from
 * @arganta/brand (persona, pillars, CTAs, hashtag banks, touchy rules), and this
 * turns it into instructions.
 *
 * Kept terse on purpose: this rides in front of every brief, and the model that
 * writes the copy is small. A persona essay would crowd out the actual request.
 * Anything falsy is skipped entirely rather than emitted as an empty heading —
 * a half-written brand should shrink this block, not fill it with noise.
 */
export function brandBlock(b) {
  if (!b || !b.name) return '';
  const L = [];
  const p = b.persona || {};
  const who = [p.title && `"${p.title}"`, b.handle].filter(Boolean).join(' ');
  L.push(`You are writing as ${b.name}${who ? ` — ${who}` : ''}.`);
  if (p.speaksAs) L.push(p.speaksAs);
  if (b.summary) L.push(`What it is: ${b.summary}`);
  if (b.tagline) L.push(`Tagline: ${b.tagline}`);
  if (p.adjectives?.length) L.push(`Voice: ${p.adjectives.join(', ')}.`);
  if (p.forbidden?.length) L.push(`NEVER: ${p.forbidden.join('; ')}.`);
  if (b.pillars?.length) L.push(`Content pillars: ${b.pillars.map(x => `${x.label}${x.description ? ` (${x.description})` : ''}`).join(' · ')}`);
  if (b.ctas?.length) L.push(`Preferred phrases: ${b.ctas.join(' / ')}.`);
  const tags = [b.hashtags?.branded, b.hashtags?.category, b.hashtags?.community].flat().filter(Boolean);
  if (tags.length) L.push(`Draw hashtags from: ${tags.join(' ')}`);
  // The rules that keep an automated post from reading like one.
  if (b.touchyRules?.length) L.push(`Make it personal: ${b.touchyRules.join('; ')}.`);
  if (b.lang && b.lang !== 'en') L.push(`Write ALL copy in ${b.lang === 'id' ? 'Bahasa Indonesia' : b.lang}.`);
  return '\n' + L.join('\n') + '\n';
}

/**
 * Build the chat messages for the copy pass.
 * @param {string} brief  the user's request
 * @param {object} [ctx]  optional live-doc context (O2 fills this): { format, palette, platform, brand, wantImages }
 */
export function copyMessages(brief, ctx = {}) {
  const wantImages = ctx.wantImages !== false; // default: include image briefs
  const platform = ctx.platform || 'instagram';
  const brand = brandBlock(ctx.brand);
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
 * baked-in text requests (models render garbled letters) and pins style.
 *
 * BF-5: when the brand ships art direction (its L0.5 knowledge base, distilled),
 * that replaces the generic house style — so a brand's slide backgrounds look
 * like the brand, not like everyone else's stock photography. */
export function imagePrompt(brief, ctx = {}) {
  const base = String(brief || '').replace(/\b(text|words?|letters?|caption|title|logo)\b/gi, '').trim()
    || 'a warm, cinematic family lifestyle scene';
  const mood = ctx.palette ? `, ${ctx.palette} color mood` : '';
  const style = ctx.artDirection
    ? ` ${String(ctx.artDirection).trim()}`
    : ' Editorial photography, soft natural light, high detail.';
  return `${base}${mood}.${style} No text, no watermark, no letters.`;
}

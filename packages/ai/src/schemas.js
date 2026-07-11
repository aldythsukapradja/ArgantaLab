// Data contracts + prompt builders shared by every provider. The storyboard is
// the ONE thing the Video Director LLM must emit; we validate + coerce it before
// it ever touches the engine, so a small/free model can't produce a broken project.

export const FORMATS = ['short', 'reel', 'square', 'long'];
export const PALETTES = ['dusk', 'mint', 'grape', 'ember', 'ocean'];
export const TEXT_ANIMS = ['cascade', 'cinematic', 'typewriter', 'pop', 'fade', 'slide', 'kinetic'];
export const VOICE_IDS = ['narrator', 'warm', 'bright', 'robot', 'kid'];
export const FORMAT_MAXSEC = { short: 60, reel: 90, square: 180, long: 600 };
export const FORMAT_SCENES = { short: [2, 4], reel: [3, 5], square: [4, 8], long: [6, 14] };

// JSON-schema (for providers that accept response_format json_schema, e.g. Gemini).
export const STORYBOARD_SCHEMA = {
  type: 'object',
  required: ['format', 'scenes', 'voiceScript'],
  properties: {
    format: { type: 'string', enum: FORMATS },
    palette: { type: 'string', enum: PALETTES },
    fx: {
      type: 'object',
      properties: { camera: { type: 'boolean' }, grain: { type: 'boolean' }, vignette: { type: 'boolean' }, sweep: { type: 'boolean' }, letterbox: { type: 'boolean' } },
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['text'],
        properties: {
          text: { type: 'string' },
          anim: { type: 'string', enum: TEXT_ANIMS },
          durationSec: { type: 'number' },
          imageQuery: { type: 'string' },
        },
      },
    },
    voiceScript: { type: 'string' },
    voiceId: { type: 'string', enum: VOICE_IDS },
    sfx: { type: 'array', items: { type: 'object', properties: { cue: { type: 'string' }, atSec: { type: 'number' } } } },
  },
};

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const oneOf = (v, list, def) => (list.includes(v) ? v : def);

// Never-throws: turns whatever the model returned into a guaranteed-valid storyboard.
export function coerceStoryboard(raw, hint = {}) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const format = oneOf(o.format, FORMATS, hint.format || 'short');
  const [minS, maxS] = FORMAT_SCENES[format];
  let scenes = Array.isArray(o.scenes) ? o.scenes : [];
  scenes = scenes.filter((s) => s && (s.text || '').trim()).slice(0, maxS).map((s, i) => ({
    text: String(s.text).slice(0, 160),
    anim: oneOf(s.anim, TEXT_ANIMS, i === 0 ? 'cascade' : 'cinematic'),
    durationSec: clamp(Number(s.durationSec) || 3, 1.2, 12),
    imageQuery: typeof s.imageQuery === 'string' ? s.imageQuery.slice(0, 60) : undefined,
  }));
  if (scenes.length === 0) scenes = [{ text: (hint.prompt || 'Your video').slice(0, 120), anim: 'cascade', durationSec: 3 }];
  while (scenes.length < minS) scenes.push({ text: '', anim: 'fade', durationSec: 2 });
  const fx = o.fx && typeof o.fx === 'object' ? o.fx : {};
  return {
    format,
    palette: oneOf(o.palette, PALETTES, hint.palette || 'dusk'),
    fx: {
      camera: fx.camera !== false, grain: fx.grain !== false, vignette: fx.vignette !== false,
      sweep: fx.sweep !== false, letterbox: !!fx.letterbox,
    },
    scenes,
    voiceScript: String(o.voiceScript || scenes.map((s) => s.text).filter(Boolean).join(' ')).slice(0, 1200),
    voiceId: oneOf(o.voiceId, VOICE_IDS, hint.voiceId || 'narrator'),
    sfx: Array.isArray(o.sfx) ? o.sfx.filter((x) => x && x.cue).slice(0, 12).map((x) => ({ cue: String(x.cue), atSec: Number(x.atSec) || 0 })) : [],
  };
}

// System + few-shot messages that make even a 1.5B model emit the schema.
export function storyboardMessages(prompt, opts = {}) {
  const fmt = opts.format || 'short';
  const [lo, hi] = FORMAT_SCENES[fmt];
  const sys = `You are a short-form video director. Output ONLY a JSON object matching this shape (no prose, no markdown):
{"format":"short|reel|square|long","palette":"dusk|mint|grape|ember|ocean",
 "fx":{"camera":true,"grain":true,"vignette":true,"sweep":true,"letterbox":false},
 "scenes":[{"text":"on-screen words (short, punchy)","anim":"cascade|cinematic|typewriter|pop|fade|slide|kinetic","durationSec":3,"imageQuery":"2-4 words of b-roll to search, optional"}],
 "voiceScript":"the full spoken narration, one flowing paragraph",
 "voiceId":"narrator|warm|bright|kid|robot",
 "sfx":[{"cue":"whoosh|pop|reward","atSec":0}]}
Rules: format "${fmt}" → ${lo}-${hi} scenes. Scene text = a few words, NOT the whole script. The voiceScript is what's spoken; scene text is what's shown. Keep it energetic and concrete.`;
  const example = {
    format: 'short', palette: 'dusk', fx: { camera: true, grain: true, vignette: true, sweep: true, letterbox: false },
    scenes: [
      { text: '3 things your\ncalendar hides', anim: 'cascade', durationSec: 3, imageQuery: 'family kitchen morning' },
      { text: 'and the third\nis huge', anim: 'cinematic', durationSec: 3 },
      { text: 'tap to see', anim: 'pop', durationSec: 2 },
    ],
    voiceScript: 'Your family calendar quietly does three things you never noticed. And the third one is huge.',
    voiceId: 'narrator', sfx: [{ cue: 'whoosh', atSec: 0 }, { cue: 'reward', atSec: 6 }],
  };
  return [
    { role: 'system', content: sys },
    { role: 'user', content: 'Make a short about a family calendar app, upbeat.' },
    { role: 'assistant', content: JSON.stringify(example) },
    { role: 'user', content: prompt },
  ];
}

// Grounded system+facts messages for a C-suite agent (facts are REAL, computed).
export function agentMessages(role, factsText, question) {
  return [
    { role: 'system', content: `You are the ${role} of a small edtech company (ArgantaLab + KinetikCircle). Answer as that executive: concise, decisive, specific. Use ONLY the facts provided — never invent numbers. Markdown-lite (**bold**) is fine. If a number is missing, say so plainly.` },
    { role: 'user', content: `LIVE FACTS:\n${factsText}\n\nQUESTION: ${question}` },
  ];
}

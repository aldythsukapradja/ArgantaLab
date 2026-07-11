// The video PROJECT model — pure data. A project is a format + an ordered stack
// of visual layers + a set of audio clips. Everything here is JSON-serializable
// except the decoded AudioBuffers held on audio clips during a session (voice is
// re-synthesized deterministically from text, so nothing needs to be saved).

let _id = 0;
export const uid = (p = 'l') => p + '_' + (Date.now().toString(36)) + '_' + (_id++).toString(36);

// Output formats. Kept at capture-friendly resolutions (real-time MediaRecorder).
export const FORMATS = {
  short:  { id: 'short',  label: 'Short',      w: 720,  h: 1280, fps: 30, maxDur: 60,  aspect: '9:16' },
  reel:   { id: 'reel',   label: 'Reel',       w: 720,  h: 1280, fps: 30, maxDur: 90,  aspect: '9:16' },
  square: { id: 'square', label: 'Short video', w: 900, h: 900,  fps: 30, maxDur: 180, aspect: '1:1' },
  long:   { id: 'long',   label: 'Long',       w: 1280, h: 720,  fps: 30, maxDur: 600, aspect: '16:9' },
};
export const formatList = () => Object.values(FORMATS);

export const PALETTES = [
  { id: 'dusk',    colors: ['#182a44', '#241028'], text: '#ffffff', accent: '#ff8a3d' },
  { id: 'mint',    colors: ['#0f3d34', '#08221d'], text: '#eafff6', accent: '#4fd98a' },
  { id: 'grape',   colors: ['#2a1550', '#120826'], text: '#f3ecff', accent: '#a68bff' },
  { id: 'ember',   colors: ['#3a0f12', '#1a0708'], text: '#fff0ec', accent: '#ff6ea9' },
  { id: 'ocean',   colors: ['#07293a', '#04141d'], text: '#e6f7ff', accent: '#33cfd6' },
];

// ---- layer factories --------------------------------------------------------
export const bgLayer = (pal = PALETTES[0]) => ({
  id: uid('bg'), type: 'background', name: 'Background',
  variant: 'aurora', colors: [...pal.colors], accent: pal.accent, angle: 155, anim: 'drift',
});
export const BG_VARIANTS = ['aurora', 'rays', 'gradient', 'solid'];
export const textLayer = (text, opts = {}) => ({
  id: uid('tx'), type: 'text', name: 'Text', text,
  xN: 0.5, yN: opts.yN ?? 0.42, size: opts.size ?? 84, weight: 800,
  color: opts.color ?? '#ffffff', align: 'center', font: 'system-ui, sans-serif',
  anim: opts.anim ?? 'pop', start: opts.start ?? 0, dur: opts.dur ?? 3, maxWidthN: 0.84,
});
export const captionLayer = (words, opts = {}) => ({
  id: uid('cap'), type: 'caption', name: 'Captions', words: words || [],
  yN: opts.yN ?? 0.8, size: opts.size ?? 52, color: '#ffffff', activeColor: opts.accent ?? '#ff8a3d',
  start: opts.start ?? 0, dur: opts.dur ?? 4, group: opts.group ?? 3,
});
export const waveLayer = (peaks, opts = {}) => ({
  id: uid('wave'), type: 'waveform', name: 'Voice wave', peaks: Array.from(peaks || []),
  yN: opts.yN ?? 0.62, heightN: 0.12, color: opts.color ?? '#33cfd6',
  start: opts.start ?? 0, dur: opts.dur ?? 4,
});

// A brand-new empty project in a given format.
export function blankProject(formatId = 'short') {
  const fmt = FORMATS[formatId] || FORMATS.short;
  const pal = PALETTES[0];
  return {
    format: { ...fmt },
    palette: pal.id,
    layers: [
      bgLayer(pal),
      textLayer('Paste a line,\nget a video.', { yN: 0.4, anim: 'cascade' }),
    ],
    audio: [],          // { id, kind:'voice'|'sfx', buffer, start, cue, text }
    // film-look post FX — all deterministic; letterbox off by default
    fx: { camera: true, grain: true, vignette: true, sweep: true, letterbox: false },
    meta: { voiceText: '', voiceId: 'narrator' },
    duration: 6,        // seconds — recomputed as content is added
  };
}

// Longest end across visual layers + audio clips = the project duration.
export function recomputeDuration(project) {
  let d = 2;
  for (const l of project.layers) if (l.type !== 'background') d = Math.max(d, (l.start || 0) + (l.dur || 0));
  for (const a of project.audio) d = Math.max(d, (a.start || 0) + (a.dur || 0));
  project.duration = Math.min(project.format.maxDur, Math.max(2, d + 0.4));
  return project.duration;
}

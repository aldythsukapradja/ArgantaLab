// @arganta/audio — GENERATIVE MUSIC engine. Professional, sample-free,
// studio-grade backsound composed live in WebAudio, the same zero-asset /
// CSP-safe philosophy as the SFX recipes. A "theme" is data (key, scale,
// tempo, chord loop, and an instrument assigned to each musical ROLE); the
// transport composes it live and never loops identically. Themes bind to a
// realm ("map") so publishing routes a theme straight to a map (scalable to
// any new zone — just add a theme with a new `realm`).
//
// Synthesis follows the classic orchestral toolkit (researched): ADDITIVE for
// strings/choir (summed harmonics), FM for brass/bells, SUBTRACTIVE for
// pads/leads (filtered saws), plucked-decay for harp/pizz, noise+pitch-drop
// for drums. Add an instrument = add one entry to INSTRUMENTS. Add a map =
// add one theme to MUSIC_THEMES.

export const MUSIC_VERSION = 1;

// ---------------------------------------------------------------- theory ----
export const NOTE_BASE = { C: 60, 'C#': 61, D: 62, 'D#': 63, E: 64, F: 65, 'F#': 66, G: 67, 'G#': 68, A: 69, 'A#': 70, B: 71 };
export const SCALES = {
  'Major pentatonic': [0, 2, 4, 7, 9],
  'Minor pentatonic': [0, 3, 5, 7, 10],
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],   // folk / pastoral
  Lydian: [0, 2, 4, 6, 7, 9, 11],       // bright / dreamy
  Dorian: [0, 2, 3, 5, 7, 9, 10],       // cozy-melancholy
  'Harmonic minor': [0, 2, 3, 5, 7, 8, 11],
};
export const CHORD_PROGS = {
  'I–V–vi–IV': [0, 4, 5, 3], 'I–vi–IV–V': [0, 5, 3, 4], 'vi–IV–I–V': [5, 3, 0, 4],
  'I–IV': [0, 3], 'ii–V–I': [1, 4, 0], 'I–iii–IV–V': [0, 2, 3, 4], 'i–VI–III–VII': [0, 5, 2, 6],
  // borrowed/mixed-mode progression (punk-rock I–IV–bIII–V): explicit
  // {semitones-from-root, quality} chords, since no diatonic scale yields
  // major I, IV, bIII and V together.
  'I–IV–♭III–V': [{ semi: 0, q: 'maj' }, { semi: 5, q: 'maj' }, { semi: 3, q: 'maj' }, { semi: 7, q: 'maj' }],
};
export const CHORD_QUALITIES = { maj: [0, 4, 7], min: [0, 3, 7] };
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export function degMidi(root, scale, deg, oct = 0) {
  const n = scale.length;
  const idx = ((deg % n) + n) % n;
  const o = oct + Math.floor(deg / n);
  return root + scale[idx] + 12 * o;
}
export const triad = (root, scale, deg, oct = 0) => [0, 2, 4].map((s) => degMidi(root, scale, deg + s, oct));
// A chord-prog entry is either a scale-degree number (diatonic triad) or an
// explicit { semi, q } chord (borrowed/non-diatonic, e.g. bIII in a major key).
function chordTones(root, scale, entry, oct = 0) {
  if (entry && typeof entry === 'object') return CHORD_QUALITIES[entry.q || 'maj'].map((iv) => root + entry.semi + iv + 12 * oct);
  return triad(root, scale, entry, oct);
}
function chordRootFifth(root, scale, entry, oct = 0) {
  if (entry && typeof entry === 'object') return { rootMidi: root + entry.semi + 12 * oct, fifthMidi: root + entry.semi + 7 + 12 * oct };
  return { rootMidi: degMidi(root, scale, entry, oct), fifthMidi: degMidi(root, scale, entry + 4, oct) };
}

// ---------------------------------------------------------- synth helpers ----
function route(ctx, out, revBus, g, revAmt) {
  g.connect(out);
  if (revAmt > 0 && revBus) { const s = ctx.createGain(); s.gain.value = revAmt; g.connect(s); s.connect(revBus); }
}
function panNode(ctx, pan) { const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (p) p.pan.value = pan || 0; return p; }
function distCurve(amount) {
  const n = 256, curve = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; curve[i] = ((3 + amount) * x * 20 * Math.PI / 180) / (Math.PI + amount * Math.abs(x)); }
  return curve;
}
function noiseBuf(ctx, dur) {
  const n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  return b;
}
// AD percussive envelope
function pluckEnv(ctx, t0, peak, a, d) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  return g;
}
// sustained (pad) envelope over dur
function sustEnv(ctx, t0, peak, a, dur, r) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.setValueAtTime(peak, t0 + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + r);
  return g;
}

// -------------------------------------------------------- INSTRUMENTS -------
// Each: (ctx, out, revBus, { midi, t, dur, gain, pan, rev }) => void.
// Self-scheduling, fire-and-forget. `dur` in seconds. Category is for the UI picker.
export const INSTRUMENTS = {
  // ---- MALLETS ----
  marimba: { cat: 'Mallets', label: 'Marimba', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = pluckEnv(ctx, t, gain * 0.8, 0.004, 0.3), p = panNode(ctx, pan);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.3;
    o.connect(g); o2.connect(g2); g2.connect(g); const tail = p ? (g.connect(p), p) : g;
    route(ctx, out, rev, tail, rv); o.start(t); o.stop(t + 0.4); o2.start(t); o2.stop(t + 0.2);
  } },
  glockenspiel: { cat: 'Mallets', label: 'Glockenspiel', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi + 12), g = pluckEnv(ctx, t, gain * 0.6, 0.003, 0.7), p = panNode(ctx, pan);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.76; const g2 = ctx.createGain(); g2.gain.value = 0.15;
    o.connect(g); o2.connect(g2); g2.connect(g); const tail = p ? (g.connect(p), p) : g;
    route(ctx, out, rev, tail, Math.max(rv, 0.3)); o.start(t); o.stop(t + 0.8); o2.start(t); o2.stop(t + 0.3);
  } },
  musicBox: { cat: 'Mallets', label: 'Music box', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi + 12), g = pluckEnv(ctx, t, gain * 0.5, 0.004, 0.9), p = panNode(ctx, pan);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    o.connect(g); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.35));
    o.start(t); o.stop(t + 1.0);
  } },
  celesta: { cat: 'Mallets', label: 'Celesta', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi + 12), g = pluckEnv(ctx, t, gain * 0.55, 0.005, 0.6), p = panNode(ctx, pan);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o3 = ctx.createOscillator(); o3.type = 'sine'; o3.frequency.value = f * 4; const g3 = ctx.createGain(); g3.gain.value = 0.08;
    o.connect(g); o3.connect(g3); g3.connect(g); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.3));
    o.start(t); o.stop(t + 0.7); o3.start(t); o3.stop(t + 0.2);
  } },
  // ---- KEYS ----
  piano: { cat: 'Keys', label: 'Piano', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = pluckEnv(ctx, t, gain * 0.7, 0.005, 0.6), p = panNode(ctx, pan);
    [1, 2, 3].forEach((h, i) => { const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f * h; o.detune.value = (i - 1) * 3; const vg = ctx.createGain(); vg.gain.value = [1, 0.4, 0.15][i]; o.connect(vg); vg.connect(g); o.start(t); o.stop(t + 0.7); });
    const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, rv);
  } },
  // ---- PLUCKED ----
  harp: { cat: 'Plucked', label: 'Harp', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = pluckEnv(ctx, t, gain * 0.55, 0.004, 0.5), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.connect(g);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(lp); const p = panNode(ctx, pan);
    const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.25)); o.start(t); o.stop(t + 0.6);
  } },
  guitar: { cat: 'Plucked', label: 'Nylon guitar', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = pluckEnv(ctx, t, gain * 0.6, 0.006, 0.4), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200; lp.connect(g);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); const p = panNode(ctx, pan);
    const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, rv); o.start(t); o.stop(t + 0.5);
  } },
  pizzStrings: { cat: 'Plucked', label: 'Pizzicato', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = pluckEnv(ctx, t, gain * 0.6, 0.004, 0.22), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; lp.connect(g);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); const p = panNode(ctx, pan);
    const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, rv); o.start(t); o.stop(t + 0.3);
  } },
  // ---- STRINGS (additive, slow) ----
  strings: { cat: 'Strings', label: 'String section', fn: (ctx, out, rev, { midi, t, dur, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = sustEnv(ctx, t, gain * 0.5, 0.35, Math.max(0.4, dur), 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(g);
    [0, -6, 6, 0.5].forEach((c, i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * (i === 3 ? 2 : 1); o.detune.value = c; const vg = ctx.createGain(); vg.gain.value = i === 3 ? 0.12 : 0.3; o.connect(vg); vg.connect(lp); o.start(t); o.stop(t + dur + 0.6); });
    // subtle vibrato
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5; const lg = ctx.createGain(); lg.gain.value = 4; lfo.connect(lg); lg.connect(lp.detune); lfo.start(t); lfo.stop(t + dur + 0.6);
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.3));
  } },
  choir: { cat: 'Strings', label: 'Choir', fn: (ctx, out, rev, { midi, t, dur, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = sustEnv(ctx, t, gain * 0.42, 0.5, Math.max(0.5, dur), 0.7);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 3; bp.connect(g);
    [0, 7, -5].forEach((c, i) => { const o = ctx.createOscillator(); o.type = i ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = c; const vg = ctx.createGain(); vg.gain.value = 0.25; o.connect(vg); vg.connect(bp); o.start(t); o.stop(t + dur + 0.8); });
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.45));
  } },
  // ---- BRASS (FM) ----
  brass: { cat: 'Brass', label: 'Brass section', fn: (ctx, out, rev, { midi, t, dur, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = sustEnv(ctx, t, gain * 0.42, 0.06, Math.max(0.25, dur), 0.2);
    const car = ctx.createOscillator(); car.type = 'sawtooth'; car.frequency.value = f;
    const mod = ctx.createOscillator(); mod.frequency.value = f; const mg = ctx.createGain(); mg.gain.value = f * 0.6; mod.connect(mg); mg.connect(car.frequency);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600; car.connect(lp); lp.connect(g);
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, rv);
    car.start(t); car.stop(t + dur + 0.3); mod.start(t); mod.stop(t + dur + 0.3);
  } },
  horn: { cat: 'Brass', label: 'French horn', fn: (ctx, out, rev, { midi, t, dur, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = sustEnv(ctx, t, gain * 0.4, 0.12, Math.max(0.3, dur), 0.35);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; lp.connect(g);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp);
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.3)); o.start(t); o.stop(t + dur + 0.5);
  } },
  // ---- WINDS ----
  flute: { cat: 'Winds', label: 'Flute', fn: (ctx, out, rev, { midi, t, dur, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = sustEnv(ctx, t, gain * 0.4, 0.08, Math.max(0.25, dur), 0.2);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g);
    const br = ctx.createBufferSource(); br.buffer = noiseBuf(ctx, dur + 0.2); const bg = ctx.createGain(); bg.gain.value = gain * 0.03; const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000; br.connect(hp); hp.connect(bg); bg.connect(g);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = 6; lfo.connect(lg); lg.connect(o.frequency); lfo.start(t); lfo.stop(t + dur + 0.3);
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.25)); o.start(t); o.stop(t + dur + 0.3); br.start(t); br.stop(t + dur + 0.2);
  } },
  clarinet: { cat: 'Winds', label: 'Clarinet', fn: (ctx, out, rev, { midi, t, dur, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = sustEnv(ctx, t, gain * 0.4, 0.06, Math.max(0.25, dur), 0.2);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; o.connect(lp); lp.connect(g);
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.25)); o.start(t); o.stop(t + dur + 0.3);
  } },
  // ---- PADS (subtractive) ----
  warmPad: { cat: 'Pads', label: 'Warm pad', fn: (ctx, out, rev, { midi, t, dur, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = sustEnv(ctx, t, gain * 0.5, 0.6, Math.max(0.6, dur), 0.8);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; lp.connect(g);
    [-7, 0, 7].forEach((c) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = c; const vg = ctx.createGain(); vg.gain.value = 0.28; o.connect(vg); vg.connect(lp); o.start(t); o.stop(t + dur + 1.0); });
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.3));
  } },
  glassPad: { cat: 'Pads', label: 'Glass pad', fn: (ctx, out, rev, { midi, t, dur, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = sustEnv(ctx, t, gain * 0.4, 0.5, Math.max(0.6, dur), 0.9);
    [1, 2, 3].forEach((h, i) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * h; const vg = ctx.createGain(); vg.gain.value = [0.3, 0.14, 0.06][i]; o.connect(vg); vg.connect(g); o.start(t); o.stop(t + dur + 1.1); });
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.4));
  } },
  // ---- BASS ----
  upright: { cat: 'Bass', label: 'Upright bass', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi - 12), g = pluckEnv(ctx, t, gain * 0.9, 0.01, 0.42);
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(g);
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, rv * 0.3); o.start(t); o.stop(t + 0.5);
  } },
  subBass: { cat: 'Bass', label: 'Sub bass', fn: (ctx, out, rev, { midi, t, gain }) => {
    const f = mtof(midi - 12), g = sustEnv(ctx, t, gain * 0.95, 0.02, 0.28, 0.12);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(g); route(ctx, out, rev, g, 0); o.start(t); o.stop(t + 0.5);
  } },
  sawBass: { cat: 'Bass', label: 'Saw bass', fn: (ctx, out, rev, { midi, t, gain, pan }) => {
    const f = mtof(midi - 12), g = pluckEnv(ctx, t, gain * 0.8, 0.008, 0.3), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.connect(g);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp);
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, 0); o.start(t); o.stop(t + 0.4);
  } },
  // ---- SYNTH LEADS (DJ) ----
  superSaw: { cat: 'Synth', label: 'Supersaw', fn: (ctx, out, rev, { midi, t, dur, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = pluckEnv(ctx, t, gain * 0.45, 0.02, Math.max(0.25, dur * 0.9)), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.connect(g);
    [-12, -6, 0, 6, 12].forEach((c) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = c; const vg = ctx.createGain(); vg.gain.value = 0.16; o.connect(vg); vg.connect(lp); o.start(t); o.stop(t + dur + 0.3); });
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, rv);
  } },
  squareLead: { cat: 'Synth', label: 'Square lead', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = pluckEnv(ctx, t, gain * 0.4, 0.006, 0.24), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.connect(g);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(lp);
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, rv); o.start(t); o.stop(t + 0.35);
  } },
  bells: { cat: 'Synth', label: 'Bells', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi + 12), g = pluckEnv(ctx, t, gain * 0.5, 0.005, 0.8);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 3.01; const g2 = ctx.createGain(); g2.gain.value = 0.2; o.connect(g); o2.connect(g2); g2.connect(g);
    const p = panNode(ctx, pan); const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.max(rv, 0.4)); o.start(t); o.stop(t + 0.9); o2.start(t); o2.stop(t + 0.4);
  } },
  // ---- ROCK BAND (distorted, dry — punk/garage stabs) ----
  powerChord: { cat: 'Rock', label: 'Power chord stab', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = pluckEnv(ctx, t, gain * 0.6, 0.002, 0.1), p = panNode(ctx, pan);
    const ws = ctx.createWaveShaper(); ws.curve = distCurve(28); ws.oversample = '2x';
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 150;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    ws.connect(hp); hp.connect(lp); lp.connect(g);
    [1, 2].forEach((h, i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * h; o.detune.value = i * 4; o.connect(ws); o.start(t); o.stop(t + 0.14); });
    const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.min(rv, 0.08));
  } },
  muteScratch: { cat: 'Rock', label: 'Muted scratch', fn: (ctx, out, rev, { midi, t, gain, pan, rev: rv }) => {
    const f = mtof(midi), g = pluckEnv(ctx, t, gain * 0.4, 0.001, 0.04), p = panNode(ctx, pan);
    const ws = ctx.createWaveShaper(); ws.curve = distCurve(18); ws.oversample = '2x';
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700; ws.connect(hp); hp.connect(g);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f; o.connect(ws); o.start(t); o.stop(t + 0.05);
    const tail = p ? (g.connect(p), p) : g; route(ctx, out, rev, tail, Math.min(rv, 0.05));
  } },
};

// Drum voices (kits are named bundles for the `drums` role).
const DRUMS = {
  kick: (ctx, out, { t, gain }) => { const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3); },
  snare: (ctx, out, { t, gain }) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, 0.2); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200; const g = ctx.createGain(); g.gain.setValueAtTime(gain * 0.7, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); s.connect(hp); hp.connect(g); g.connect(out); const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 180; const og = ctx.createGain(); og.gain.setValueAtTime(gain * 0.3, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1); o.connect(og); og.connect(out); s.start(t); s.stop(t + 0.2); o.start(t); o.stop(t + 0.1); },
  hat: (ctx, out, { t, gain }) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, 0.05); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000; const g = ctx.createGain(); g.gain.setValueAtTime(gain * 0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05); s.connect(hp); hp.connect(g); g.connect(out); s.start(t); s.stop(t + 0.06); },
  clap: (ctx, out, { t, gain }) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf(ctx, 0.15); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 1.5; const g = ctx.createGain(); g.gain.setValueAtTime(gain * 0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13); s.connect(bp); bp.connect(g); g.connect(out); s.start(t); s.stop(t + 0.15); },
};
// A kit = which drum voices fire on which 16th steps (16-step bar).
export const KITS = {
  none: {},
  soft: { hat: [2, 6, 10, 14], kick: [0], snare: [8] },
  folk: { kick: [0, 8], snare: [4, 12], hat: [2, 6, 10, 14] },
  dj: { kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], clap: [4, 12] },
  orchestral: { kick: [0], snare: [12] },
  rock: { kick: [0, 8], snare: [4, 12], hat: [0, 2, 4, 6, 8, 10, 12, 14] },
};

export const ROLES = ['pad', 'harmony', 'bass', 'lead', 'arp', 'drums', 'sparkle'];
export const ROLE_LABEL = { pad: 'Pad', harmony: 'Harmony', bass: 'Bass', lead: 'Melody', arp: 'Arpeggio', drums: 'Drums', sparkle: 'Sparkle' };

// -------------------------------------------------------- MUSIC THEMES ------
// One per map. `realm` binds the theme to a game map (publish routes it there).
const clone = (o) => JSON.parse(JSON.stringify(o));
function theme(o) {
  return {
    realm: o.realm, name: o.name, icon: o.icon, mood: o.mood,
    root: o.root, scale: o.scale, bpm: o.bpm, prog: o.prog,
    swing: o.swing ?? 0.1, density: o.density ?? 0.6, reverb: o.reverb ?? 0.3,
    // riffSteps: 16th-note steps (0-15) where a `lead.riff` theme stabs the
    // current chord instead of the generative euclidean melody.
    riffSteps: o.riffSteps || [0, 4, 8, 12],
    roles: {
      pad: { inst: 'warmPad', level: 0.5, on: true, ...o.roles?.pad },
      harmony: { inst: 'strings', level: 0.4, on: false, ...o.roles?.harmony },
      bass: { inst: 'upright', level: 0.7, on: true, ...o.roles?.bass },
      lead: { inst: 'marimba', level: 0.7, on: true, riff: false, ...o.roles?.lead },
      arp: { inst: 'harp', level: 0.4, on: true, ...o.roles?.arp },
      drums: { kit: 'soft', level: 0.5, on: false, ...o.roles?.drums },
      sparkle: { inst: 'glockenspiel', level: 0.25, on: true, ...o.roles?.sparkle },
    },
  };
}
export const MUSIC_THEMES = {
  farm: theme({ realm: 'farm', name: 'Farm', icon: '🌻', mood: 'Cozy', root: 'C', scale: 'Major pentatonic', bpm: 82, prog: 'I–V–vi–IV', swing: 0.12, density: 0.6, reverb: 0.3,
    roles: { pad: { inst: 'warmPad', level: 0.5 }, harmony: { inst: 'strings', level: 0.35, on: true }, bass: { inst: 'upright', level: 0.65 }, lead: { inst: 'marimba', level: 0.7 }, arp: { inst: 'harp', level: 0.4 }, drums: { kit: 'soft', level: 0.4, on: true }, sparkle: { inst: 'glockenspiel', level: 0.25 } } }),
  bloomwall_pass: theme({ realm: 'bloomwall_pass', name: 'Bloomwall Pass', icon: '🏹', mood: 'Adventurous', root: 'D', scale: 'Dorian', bpm: 106, prog: 'vi–IV–I–V', swing: 0.04, density: 0.78, reverb: 0.22,
    roles: { pad: { inst: 'glassPad', level: 0.45 }, harmony: { inst: 'horn', level: 0.4, on: true }, bass: { inst: 'upright', level: 0.75 }, lead: { inst: 'flute', level: 0.5 }, arp: { inst: 'pizzStrings', level: 0.55 }, drums: { kit: 'folk', level: 0.55, on: true }, sparkle: { inst: 'bells', level: 0.15 } } }),
  emberring_arena: theme({ realm: 'emberring_arena', name: 'Emberring Arena', icon: '🐗', mood: 'Defiant', root: 'D', scale: 'Mixolydian', bpm: 113, prog: 'I–IV–♭III–V', swing: 0.0, density: 0.75, reverb: 0.08,
    riffSteps: [0, 6, 8, 14],
    roles: { pad: { inst: 'glassPad', level: 0, on: false }, harmony: { inst: 'muteScratch', level: 0.45, on: true }, bass: { inst: 'sawBass', level: 0.85 }, lead: { inst: 'powerChord', level: 0.75, riff: true }, arp: { inst: 'squareLead', level: 0, on: false }, drums: { kit: 'rock', level: 0.75, on: true }, sparkle: { inst: 'bells', level: 0, on: false } } }),
  fountain_festival: theme({ realm: 'fountain_festival', name: 'Fountain Festival', icon: '🎪', mood: 'Festive', root: 'G', scale: 'Major', bpm: 112, prog: 'I–vi–IV–V', swing: 0.1, density: 0.82, reverb: 0.24,
    roles: { pad: { inst: 'warmPad', level: 0.4 }, harmony: { inst: 'strings', level: 0.4, on: true }, bass: { inst: 'upright', level: 0.6 }, lead: { inst: 'marimba', level: 0.8 }, arp: { inst: 'guitar', level: 0.5 }, drums: { kit: 'folk', level: 0.55, on: true }, sparkle: { inst: 'glockenspiel', level: 0.5 } } }),
  lashira_keep: theme({ realm: 'lashira_keep', name: 'Lashira Keep', icon: '🏰', mood: 'Regal', root: 'A', scale: 'Minor', bpm: 72, prog: 'i–VI–III–VII', swing: 0.06, density: 0.44, reverb: 0.46,
    roles: { pad: { inst: 'choir', level: 0.6, on: true }, harmony: { inst: 'strings', level: 0.45, on: true }, bass: { inst: 'upright', level: 0.55 }, lead: { inst: 'horn', level: 0.4 }, arp: { inst: 'harp', level: 0.35 }, drums: { kit: 'orchestral', level: 0.4, on: true }, sparkle: { inst: 'musicBox', level: 0.4 } } }),
  hearthrush_kitchen: theme({ realm: 'hearthrush_kitchen', name: 'Hearthrush Kitchen', icon: '🍳', mood: 'Playful', root: 'F', scale: 'Major pentatonic', bpm: 96, prog: 'I–IV', swing: 0.14, density: 0.7, reverb: 0.24,
    roles: { pad: { inst: 'warmPad', level: 0.4 }, harmony: { inst: 'clarinet', level: 0.35, on: true }, bass: { inst: 'upright', level: 0.6 }, lead: { inst: 'marimba', level: 0.75 }, arp: { inst: 'pizzStrings', level: 0.55 }, drums: { kit: 'soft', level: 0.5, on: true }, sparkle: { inst: 'celesta', level: 0.3 } } }),
};

// LIVE table (game + HQ preview read this; applyMusicThemes mutates in place).
export const ACTIVE_THEMES = clone(MUSIC_THEMES);

// -------------------------------------------------------- generators --------
export function euclid(hits, steps, rot = 0) {
  const p = []; let bucket = 0;
  for (let i = 0; i < steps; i++) { bucket += hits; if (bucket >= steps) { bucket -= steps; p.push(1); } else p.push(0); }
  if (rot) { const r = ((rot % steps) + steps) % steps; return p.slice(steps - r).concat(p.slice(0, steps - r)); }
  return p;
}

// ------------------------------------------------------- MusicTransport -----
// Lookahead scheduler. Compose the active/given theme live. `onEvent(role,midi)`
// fires per note for the visualizer. `energy` breathes over 16 bars (build/
// release) so it never feels static — the "alive"/DJ feel.
export class MusicTransport {
  constructor(ctx, { master, revBus, onEvent } = {}) {
    this.ctx = ctx;
    this.master = master || ctx.destination;
    this.revBus = revBus || null;
    this.onEvent = onEvent || (() => {});
    this.theme = null; this.playing = false;
    this._t = 0; this._step = 0; this._bar = 0; this._mel = 0; this._timer = null;
  }
  setTheme(theme) { this.theme = theme ? clone(theme) : null; }
  setThemeForRealm(realm) { this.setTheme(ACTIVE_THEMES[realm] || ACTIVE_THEMES.farm); }
  start() { if (this.playing || !this.theme) return; this.playing = true; this._t = this.ctx.currentTime + 0.08; this._step = 0; this._bar = 0; this._mel = 0; this._tick(); }
  stop() { this.playing = false; clearTimeout(this._timer); }
  energy() { return 0.55 + 0.45 * Math.sin((this._bar / 16) * Math.PI * 2); }

  _play(role, inst, midi, t, dur, level, pan) {
    const def = INSTRUMENTS[inst]; if (!def) return;
    def.fn(this.ctx, this.master, this.revBus, { midi, t, dur, gain: level, pan: pan || 0, rev: this.theme.reverb });
    this.onEvent(role, midi, t);
  }
  _tick() {
    if (!this.playing) return;
    const ctx = this.ctx;
    // BACKLOG CLAMP — if the scheduler was starved (a heavy world-load frame, or
    // a backgrounded tab throttling setTimeout) the audio clock races ahead of
    // _t. DON'T dump the missed steps as a burst of past-due notes — Web Audio
    // plays past start-times immediately, so that backlog is exactly the
    // "overlapping" cacophony on world change. Resync to just ahead of now.
    if (this._t < ctx.currentTime) this._t = ctx.currentTime + 0.05;
    // While the tab is hidden, keep the clock fresh but schedule nothing
    // (inaudible anyway, and avoids a catch-up pile on return).
    if (typeof document !== 'undefined' && document.hidden) {
      this._t = ctx.currentTime + 0.05;
      this._timer = setTimeout(() => this._tick(), 200);
      return;
    }
    const T = this.theme, spb = 60 / T.bpm, s16 = spb / 4;
    while (this._t < ctx.currentTime + 0.12) {
      let t = this._t;
      if (this._step % 2 === 1) t += T.swing * s16; // swing offbeats
      this._scheduleStep(t);
      this._t += s16; this._step++;
      if (this._step >= 16) { this._step = 0; this._bar++; }
    }
    this._timer = setTimeout(() => this._tick(), 25);
  }
  _scheduleStep(t) {
    const T = this.theme, scale = SCALES[T.scale] || SCALES.Major, root = NOTE_BASE[T.root] ?? 60;
    const prog = CHORD_PROGS[T.prog] || CHORD_PROGS['I–V–vi–IV'];
    const barsPerChord = prog.length <= 2 ? 2 : 1;
    const deg = prog[Math.floor(this._bar / barsPerChord) % prog.length];
    const chord = chordTones(root, scale, deg, 0);
    const step = this._step, e = this.energy(), dens = T.density * (0.6 + 0.4 * e);
    const R = T.roles, spb = 60 / T.bpm, beat = spb;
    const roleOn = (r) => R[r]?.on && (R[r]?.level ?? 0) > 0.02;

    // PAD — sustained chord across the bar
    if (step === 0 && roleOn('pad')) chord.forEach((m, i) => this._play('pad', R.pad.inst, m, t, beat * 4, R.pad.level, [-0.4, 0, 0.4][i] || 0));
    // HARMONY — sustained higher chord voicing (strings/brass/horn), every 2 beats
    if ((step === 0 || step === 8) && roleOn('harmony')) chord.forEach((m, i) => this._play('harmony', R.harmony.inst, m + 12, t, beat * 2, R.harmony.level * 0.8, [-0.5, 0.2, 0.5][i] || 0));
    // BASS — root on 1, fifth on 3
    if (roleOn('bass')) {
      const { rootMidi, fifthMidi } = chordRootFifth(root, scale, deg, -1);
      if (step === 0) this._play('bass', R.bass.inst, rootMidi, t, beat, R.bass.level, 0);
      else if (step === 8) this._play('bass', R.bass.inst, fifthMidi, t, beat, R.bass.level, 0);
    }
    // ARP — arpeggiate chord on off-8ths
    if (roleOn('arp') && step % 2 === 1) {
      const tone = chord[((step - 1) / 2) % chord.length] + 12;
      if (Math.random() < 0.5 + dens * 0.4) this._play('arp', R.arp.inst, tone, t, beat * 0.5, R.arp.level, ((step % 4) - 1.5) * 0.2);
    }
    // LEAD (riff mode) — clipped chord stabs on fixed steps with silence between,
    // instead of a generative melody (punk/garage rhythm-guitar riff feel).
    if (roleOn('lead') && R.lead.riff) {
      if (T.riffSteps.includes(step)) chord.forEach((m, i) => this._play('lead', R.lead.inst, m, t, beat * 0.3, R.lead.level * (i === 0 ? 1 : 0.7), 0));
    }
    // LEAD — euclidean melody, pentatonic walk landing on chord tones on strong beats
    if (roleOn('lead') && !R.lead.riff) {
      const pat = euclid(Math.round(4 + dens * 6), 16);
      if (pat[step] && Math.random() < 0.5 + dens * 0.45) {
        let midi;
        if (step % 4 === 0 && Math.random() < 0.7) midi = chord[Math.floor(Math.random() * chord.length)] + 12;
        else { const mv = (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2); this._mel = Math.max(-2, Math.min(9, this._mel + mv)); midi = degMidi(root, scale, this._mel, 1); }
        this._play('lead', R.lead.inst, midi, t, beat * 0.6, R.lead.level, 0.1);
      }
    }
    // SPARKLE — sparse high accents
    if (roleOn('sparkle') && (step === 0 || step === 10) && Math.random() < 0.2 + dens * 0.2) this._play('sparkle', R.sparkle.inst, chord[2] + 24, t, beat, R.sparkle.level, -0.3);
    // DRUMS — kit pattern (energy-gated so it drops out in low-energy bars)
    if (R.drums?.on && (R.drums.level ?? 0) > 0.02 && e > 0.3) {
      const kit = KITS[R.drums.kit] || {};
      for (const voice in kit) if (kit[voice].includes(step)) { DRUMS[voice]?.(this.ctx, this.master, { t, gain: R.drums.level }); if (voice === 'kick' || voice === 'snare') this.onEvent('drums', 0, t); }
    }
  }
}

// -------------------------------------------------- validate / merge / apply
export function validateMusicThemes(over) {
  const errors = [], warnings = [];
  if (over && typeof over === 'object') for (const [realm, th] of Object.entries(over)) {
    if (!th || typeof th !== 'object') { errors.push(`${realm}: theme must be an object`); continue; }
    if (th.scale && !SCALES[th.scale]) warnings.push(`${realm}: unknown scale ${th.scale}`);
    if (th.prog && !CHORD_PROGS[th.prog]) warnings.push(`${realm}: unknown progression ${th.prog}`);
  }
  return { ok: errors.length === 0, errors, warnings };
}
const NUM = (v, d) => (Number.isFinite(v) ? v : d);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function sanitizeTheme(base, over) {
  const t = clone(base);
  if (over.root && NOTE_BASE[over.root] != null) t.root = over.root;
  if (over.scale && SCALES[over.scale]) t.scale = over.scale;
  if (over.prog && CHORD_PROGS[over.prog]) t.prog = over.prog;
  if (over.mood) t.mood = String(over.mood).slice(0, 24);
  t.bpm = Math.max(40, Math.min(200, NUM(over.bpm, t.bpm)));
  t.swing = clamp01(NUM(over.swing, t.swing)) * 0.5;
  t.density = clamp01(NUM(over.density, t.density));
  t.reverb = clamp01(NUM(over.reverb, t.reverb));
  if (Array.isArray(over.riffSteps)) t.riffSteps = over.riffSteps.filter((n) => Number.isInteger(n) && n >= 0 && n < 16);
  if (over.roles) for (const r of ROLES) {
    const o = over.roles[r]; if (!o) continue;
    t.roles[r] = { ...t.roles[r] };
    if (typeof o.on === 'boolean') t.roles[r].on = o.on;
    if (Number.isFinite(o.level)) t.roles[r].level = clamp01(o.level);
    if (r === 'lead' && typeof o.riff === 'boolean') t.roles[r].riff = o.riff;
    if (r === 'drums') { if (o.kit && KITS[o.kit]) t.roles[r].kit = o.kit; }
    else if (o.inst && INSTRUMENTS[o.inst]) t.roles[r].inst = o.inst;
  }
  return t;
}
export function mergeMusicThemes(over = {}) {
  const out = clone(MUSIC_THEMES);
  for (const [realm, th] of Object.entries(over || {})) if (MUSIC_THEMES[realm]) out[realm] = sanitizeTheme(MUSIC_THEMES[realm], th);
  return out;
}
export function applyMusicThemes(over = {}) {
  const eff = mergeMusicThemes(over);
  for (const k of Object.keys(ACTIVE_THEMES)) delete ACTIVE_THEMES[k];
  Object.assign(ACTIVE_THEMES, eff);
  return ACTIVE_THEMES;
}

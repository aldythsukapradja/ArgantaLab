// Deterministic, zero-asset speech synthesis in WebAudio. Paste text -> voice.
//
// No neural model, no .wav, no server, no network: text is turned into phonemes
// by a compact English letter-to-sound ruleset, and each phoneme is synthesized
// as a classic FORMANT segment (a buzzing glottal source shaped by three
// band-pass "formant" filters) or filtered noise for fricatives/stops. This is
// the same philosophy as @arganta/audio's SFX: the voice IS a recipe. The only
// randomness (noise fills, micro-jitter) is driven by a PRNG seeded from the
// text + voice, so the SAME text + voice always renders byte-identical audio.
//
// A "voice" is DATA — pitch, speed, formant shift, timbre, gain. That table is
// the voice LIBRARY you build in HQ.

// --------------------------------------------------------------- library ----
// f0 = base pitch (Hz). speed = tempo multiplier. formant = vocal-tract scale
// (>1 = bigger/darker, <1 = smaller/brighter). breath = unvoiced noise mix.
export const VOICES = {
  narrator: { name: 'Narrator',  f0: 118, speed: 1.0,  formant: 1.0,  breath: 0.14, gain: 0.9, wave: 'sawtooth' },
  warm:     { name: 'Warm',      f0: 104, speed: 0.95, formant: 1.08, breath: 0.10, gain: 0.92, wave: 'sawtooth' },
  bright:   { name: 'Bright',    f0: 176, speed: 1.05, formant: 0.92, breath: 0.16, gain: 0.85, wave: 'sawtooth' },
  robot:    { name: 'Robot',     f0: 96,  speed: 1.0,  formant: 1.0,  breath: 0.05, gain: 0.9, wave: 'square', flat: true },
  kid:      { name: 'Kid',       f0: 232, speed: 1.06, formant: 0.82, breath: 0.18, gain: 0.82, wave: 'sawtooth' },
};
export const voiceList = () => Object.entries(VOICES).map(([id, v]) => ({ id, ...v }));

// ------------------------------------------------------------ phoneme bank ----
// manner: how it's synthesized. f = [F1,F2,F3] formant Hz (voiced). nf = noise
// {hp, lp} band for fricatives/bursts. voiced: has a glottal buzz.
const V = (f1, f2, f3) => ({ manner: 'vowel',  voiced: true,  f: [f1, f2, f3] });
const N = (f1, f2, f3) => ({ manner: 'nasal',  voiced: true,  f: [f1, f2, f3] });
const A = (f1, f2, f3) => ({ manner: 'approx', voiced: true,  f: [f1, f2, f3] });
const FR = (hp, lp, g = 0.5) => ({ manner: 'fric', voiced: false, nf: { hp, lp }, g });
const VFR = (hp, lp, f1, f2) => ({ manner: 'fric', voiced: true, nf: { hp, lp }, f: [f1, f2, 2500], g: 0.4 });
const ST = (hp, lp, voiced) => ({ manner: 'stop', voiced, nf: { hp, lp } });

const PH = {
  // vowels (classic formant centers)
  AA: V(700, 1100, 2600), AE: V(660, 1720, 2410), AH: V(600, 1200, 2540),
  AO: V(570, 840, 2410),  EH: V(560, 1800, 2530), IH: V(400, 1920, 2560),
  IY: V(290, 2300, 3000), OW: V(450, 900, 2400),  UH: V(440, 1020, 2240),
  UW: V(320, 800, 2250),  ER: V(490, 1350, 1690),
  // nasals / approximants
  M: N(280, 900, 2200), N: N(280, 1700, 2600), NG: N(280, 2300, 2750),
  L: A(360, 1300, 2600), R: A(420, 1300, 1600), W: A(300, 610, 2200), Y: A(300, 2200, 3000),
  // voiced fricatives
  V: VFR(600, 4500, 400, 1100), DH: VFR(300, 3500, 400, 1600), Z: VFR(3500, 8000, 400, 1700), ZH: VFR(1800, 6000, 400, 1900),
  // unvoiced fricatives
  F: FR(600, 6000, 0.42), TH: FR(400, 6000, 0.38), S: FR(3800, 9000, 0.6), SH: FR(1800, 6500, 0.55), HH: FR(300, 3000, 0.3),
  // stops (closure + burst)
  P: ST(600, 4000, false), T: ST(2500, 7000, false), K: ST(1200, 4500, false),
  B: ST(300, 1800, true),  D: ST(1500, 4500, true),  G: ST(900, 3000, true),
  // affricates -> stop + fric handled in g2p (CH -> T SH, JH -> D ZH)
};

// -------------------------------------------------------- letter -> sound ----
const isVowel = (c) => 'aeiou'.indexOf(c) >= 0;
const FUNC_TH = new Set(['the', 'this', 'that', 'then', 'them', 'they', 'there', 'their', 'these', 'those', 'than', 'though', 'thus']);

// Grapheme-to-phoneme for one lowercased word. Compact + irregular-English-aware
// enough to be recognizable; not a linguist's dictionary. Returns phoneme codes.
function g2p(word) {
  const w = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!w) return [];
  const out = [];
  const push = (...p) => p.forEach((x) => x && out.push(x));
  const n = w.length;
  // strip a trailing silent 'e' (make(e) -> keep vowel long is skipped)
  let end = n;
  if (n >= 3 && w[n - 1] === 'e' && !isVowel(w[n - 2])) end = n - 1;
  for (let i = 0; i < end; i++) {
    const c = w[i], c2 = w.slice(i, i + 2), c3 = w.slice(i, i + 3);
    const next = w[i + 1] || '';
    // digraphs / trigraphs first
    if (c3 === 'igh') { push('AY'); i += 2; continue; }
    if (c2 === 'th') { push(i === 0 && FUNC_TH.has(w) ? 'DH' : 'TH'); i++; continue; }
    if (c2 === 'sh') { push('SH'); i++; continue; }
    if (c2 === 'ch') { push('T', 'SH'); i++; continue; }
    if (c2 === 'ph') { push('F'); i++; continue; }
    if (c2 === 'ck') { push('K'); i++; continue; }
    if (c2 === 'ng') { push('NG'); i++; continue; }
    if (c2 === 'qu') { push('K', 'W'); i++; continue; }
    if (c2 === 'wh') { push('W'); i++; continue; }
    if (c2 === 'ee' || c2 === 'ea') { push('IY'); i++; continue; }
    if (c2 === 'oo') { push('UW'); i++; continue; }
    if (c2 === 'ou' || c2 === 'ow') { push('OW'); i++; continue; }
    if (c2 === 'oa' || c2 === 'oe') { push('OW'); i++; continue; }
    if (c2 === 'ai' || c2 === 'ay') { push('AY'); i++; continue; }
    if (c2 === 'oi' || c2 === 'oy') { push('OY'); i++; continue; }
    if (c2 === 'au' || c2 === 'aw') { push('AO'); i++; continue; }
    if (c2 === 'ir' || c2 === 'ur' || c2 === 'er' || c2 === 'or') { push(c[0] === 'o' ? 'AO' : 'ER'); i++; continue; }
    if (c2 === 'ar') { push('AA'); i++; continue; }
    // doubled consonant -> single
    if (c === next && !isVowel(c)) continue;
    // single letters
    switch (c) {
      case 'a': push('AE'); break;
      case 'e': push('EH'); break;
      case 'i': push('IH'); break;
      case 'o': push('AO'); break;
      case 'u': push('AH'); break;
      case 'y': push(i === 0 ? 'Y' : 'IY'); break;
      case 'b': push('B'); break;
      case 'c': push(/[eiy]/.test(next) ? 'S' : 'K'); break;
      case 'd': push('D'); break;
      case 'f': push('F'); break;
      case 'g': push(/[eiy]/.test(next) ? 'JH' : 'G'); break;
      case 'h': push('HH'); break;
      case 'j': push('JH'); break;
      case 'k': push('K'); break;
      case 'l': push('L'); break;
      case 'm': push('M'); break;
      case 'n': push('N'); break;
      case 'p': push('P'); break;
      case 'r': push('R'); break;
      case 's': push('S'); break;
      case 't': push('T'); break;
      case 'v': push('V'); break;
      case 'w': push('W'); break;
      case 'x': push('K', 'S'); break;
      case 'z': push('Z'); break;
      case "'": break;
      default: break;
    }
  }
  // expand affricates + diphthongs into known bank codes
  const expanded = [];
  for (const p of out) {
    if (p === 'JH') expanded.push('D', 'ZH');
    else if (p === 'AY') expanded.push('AA', 'IY');
    else if (p === 'OY') expanded.push('AO', 'IY');
    else expanded.push(p);
  }
  return expanded.filter((p) => PH[p]);
}

// --------------------------------------------------------------- PRNG --------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// duration (seconds) per manner, before speed scaling
const DUR = { vowel: 0.155, nasal: 0.105, approx: 0.09, fric: 0.11, stop: 0.075 };

// Build the segment plan + word timings for a whole utterance.
function planUtterance(text, voice) {
  const speed = voice.speed || 1;
  const tokens = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const segs = [];
  const words = [];
  let t = 0.06; // small lead-in
  for (let wi = 0; wi < tokens.length; wi++) {
    const raw = tokens[wi];
    const phs = g2p(raw);
    const wStart = t;
    if (phs.length === 0) { t += 0.12 / speed; }
    for (const code of phs) {
      const bank = PH[code];
      const d = (DUR[bank.manner] || 0.1) / speed;
      segs.push({ code, bank, t, d });
      t += d * 0.92; // slight overlap between segments for smoother joins
    }
    const trailing = /[.,!?;:]$/.test(raw);
    words.push({ word: raw.replace(/[^A-Za-z0-9']/g, ''), start: wStart, end: t });
    // gap: bigger at punctuation, normal between words
    t += (trailing ? 0.26 : 0.10) / speed;
  }
  return { segs, words, duration: t + 0.1 };
}

// Render an utterance to an AudioBuffer offline (deterministic). Returns
// { buffer, words:[{word,start,end}], duration } — words drive caption sync.
export async function renderVoice(text, voiceOrId = 'narrator', sampleRate = 44100) {
  const voice = typeof voiceOrId === 'string' ? (VOICES[voiceOrId] || VOICES.narrator) : voiceOrId;
  const plan = planUtterance(text || '', voice);
  const dur = Math.max(0.4, plan.duration);
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const ctx = new OAC(1, Math.ceil(dur * sampleRate), sampleRate);
  const rnd = mulberry32(hashStr((text || '') + '|' + (voice.name || '')));

  const master = ctx.createGain(); master.gain.value = voice.gain || 0.9;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.18;
  master.connect(comp); comp.connect(ctx.destination);

  const fscale = voice.formant || 1;
  const drift = 0.14; // pitch falls ~14% across the line (natural declination)

  // one deterministic noise buffer to draw fricative/burst grains from
  const nb = ctx.createBuffer(1, Math.ceil(0.4 * sampleRate), sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;

  const startNoise = (t0, d, hp, lp, gain) => {
    const src = ctx.createBufferSource(); src.buffer = nb; src.loop = true;
    src.playbackRate.value = 0.8 + rnd() * 0.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
    g.gain.setValueAtTime(gain, t0 + Math.max(0.02, d - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    let node = src;
    if (hp) { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node.connect(f); node = f; }
    if (lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp; node.connect(f); node = f; }
    node.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + d + 0.02);
  };

  const startVoiced = (t0, d, formants, prog, extraLp) => {
    const f0 = (voice.f0 || 120) * (1 - drift * prog) * (1 + (rnd() - 0.5) * 0.02);
    const osc = ctx.createOscillator();
    osc.type = voice.wave || 'sawtooth';
    osc.frequency.setValueAtTime(f0, t0);
    if (!voice.flat) osc.frequency.linearRampToValueAtTime(f0 * (0.985 + (rnd() - 0.5) * 0.03), t0 + d);
    const seg = ctx.createGain();
    seg.gain.setValueAtTime(0.0001, t0);
    seg.gain.exponentialRampToValueAtTime(1, t0 + 0.014);
    seg.gain.setValueAtTime(1, t0 + Math.max(0.03, d - 0.03));
    seg.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    const weights = [1.0, 0.55, 0.28];
    formants.forEach((freq, k) => {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = Math.max(120, freq * fscale); bp.Q.value = 9 - k * 2.5;
      const fg = ctx.createGain(); fg.gain.value = weights[k];
      osc.connect(bp); bp.connect(fg); fg.connect(seg);
    });
    let out = seg;
    if (extraLp) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = extraLp; seg.connect(lp); out = lp; }
    out.connect(master);
    osc.start(t0); osc.stop(t0 + d + 0.03);
    // breath: a whisper of noise mixed with voicing for realism
    if (voice.breath) startNoise(t0, d, 1200, 5000, 0.05 * voice.breath);
  };

  for (const s of plan.segs) {
    const prog = s.t / dur;
    const b = s.bank;
    if (b.manner === 'vowel' || b.manner === 'approx') startVoiced(s.t, s.d, b.f, prog);
    else if (b.manner === 'nasal') startVoiced(s.t, s.d, b.f, prog, 2400);
    else if (b.manner === 'fric') {
      if (b.voiced && b.f) startVoiced(s.t, s.d, b.f, prog, 2600);
      startNoise(s.t, s.d, b.nf.hp, b.nf.lp, (b.g || 0.5) * 0.5);
    } else if (b.manner === 'stop') {
      const burstAt = s.t + s.d * 0.55;
      if (b.voiced) startVoiced(s.t, s.d * 0.5, [280, 1000, 2400], prog, 1600); // voice bar
      startNoise(burstAt, s.d * 0.5, b.nf.hp, b.nf.lp, 0.42); // release burst
    }
  }

  const buffer = await ctx.startRendering();
  return { buffer, words: plan.words, duration: dur, phonemeCount: plan.segs.length };
}

// Peak envelope (for drawing a waveform layer) — downsample abs peaks to N bins.
export function bufferPeaks(buffer, bins = 240) {
  const d = buffer.getChannelData(0), step = Math.floor(d.length / bins) || 1, out = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    let max = 0; const s = i * step;
    for (let j = 0; j < step; j++) { const v = Math.abs(d[s + j] || 0); if (v > max) max = v; }
    out[i] = max;
  }
  return out;
}

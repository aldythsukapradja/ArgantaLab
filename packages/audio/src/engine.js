// Pure WebAudio DSP — no game state, no HQ state. Both LashiraBloom's sfx.js
// AND Circle HQ's Music Builder preview call these SAME functions against
// their own AudioContext, so what an operator hears while tuning in HQ is
// exactly what the game will play — one engine, two callers.

// A short decaying-noise stereo impulse response, synthesized once per context
// (no .wav shipped). Cache the buffer on whatever object the caller owns.
export function impulseBuffer(ctx, cache) {
  if (cache.ir) return cache.ir;
  const dur = 1.4, decay = 3.2, rate = ctx.sampleRate, n = Math.floor(rate * dur);
  const buf = ctx.createBuffer(2, n, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
  }
  cache.ir = buf;
  return buf;
}

// tanh soft-clip curve for the noise() `drive` param.
export function satCurve(amount) {
  const k = Math.max(0.0001, amount * 50 + 1);
  const n = 256, curve = new Float32Array(n), norm = Math.tanh(k);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / norm; }
  return curve;
}

// Builds the shared mastering chain: bus compressor → limiter → destination,
// plus a reverb send bus (synthesized IR, no asset). Returns the two nodes
// callers route their voices into. `gain` sets the master's starting level.
export function createMasterChain(ctx, gain = 0.7) {
  const master = ctx.createGain();
  master.gain.value = gain;

  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 3;
  comp.attack.value = 0.003; comp.release.value = 0.15;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.001; limiter.release.value = 0.05;
  master.connect(comp); comp.connect(limiter); limiter.connect(ctx.destination);

  const reverbBus = ctx.createGain(); reverbBus.gain.value = 1;
  const convolver = ctx.createConvolver();
  convolver.buffer = impulseBuffer(ctx, {});
  convolver.normalize = true;
  const reverbReturn = ctx.createGain(); reverbReturn.gain.value = 0.55;
  reverbBus.connect(convolver); convolver.connect(reverbReturn); reverbReturn.connect(master);

  return { master, reverbBus };
}

function route(ctx, master, reverbBus, envGain, reverbAmt = 0) {
  envGain.connect(master);
  if (reverbAmt > 0 && reverbBus) {
    const send = ctx.createGain(); send.gain.value = reverbAmt;
    envGain.connect(send); send.connect(reverbBus);
  }
}

// A shaped oscillator tone. f1 → glide target; short exponential AR envelope.
// layers: 1-3 detuned voices stacked for thickness. jitter: small random
// pitch/timing offset so repeated triggers don't sound identical. reverb:
// 0..1 send amount into the shared synthesized IR.
export function scheduleTone(ctx, master, reverbBus, {
  type = 'sine', f0 = 440, f1 = null, t = 0.12, gain = 0.3, delay = 0, layers = 1, jitter = false, reverb = 0,
}) {
  if (!ctx || !master) return;
  let _f0 = f0, _f1 = f1, _delay = delay;
  if (jitter) {
    const pj = 1 + (Math.random() * 2 - 1) * 0.015;
    _f0 = f0 * pj; if (_f1 != null) _f1 = f1 * pj;
    _delay = delay + (Math.random() * 2 - 1) * 0.006;
  }
  const t0 = ctx.currentTime + Math.max(0, _delay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  const n = Math.max(1, Math.min(3, layers));
  const spread = n === 3 ? [-9, 0, 9] : n === 2 ? [-6, 6] : [0];
  const voiceGain = 1 / Math.sqrt(n);
  for (const cents of spread) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.detune.value = cents;
    osc.frequency.setValueAtTime(_f0, t0);
    if (_f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, _f1), t0 + t);
    const vg = ctx.createGain(); vg.gain.value = voiceGain;
    osc.connect(vg); vg.connect(g);
    osc.start(t0); osc.stop(t0 + t + 0.03);
  }
  route(ctx, master, reverbBus, g, reverb);
}

// A filtered noise burst — thuds, swipes, whooshes, poofs. drive: 0..1
// soft-clip saturation for extra punch on transients.
export function scheduleNoise(ctx, master, reverbBus, {
  t = 0.15, gain = 0.2, delay = 0, lp = 2000, hp = 0, drive = 0, jitter = false, reverb = 0,
}) {
  if (!ctx || !master) return;
  const _delay = jitter ? delay + (Math.random() * 2 - 1) * 0.006 : delay;
  const t0 = ctx.currentTime + Math.max(0, _delay);
  const n = Math.max(1, Math.floor(ctx.sampleRate * t));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  let node = src;
  if (hp) { const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = hp; src.connect(hpf); node = hpf; }
  node.connect(f);
  let outNode = f;
  if (drive > 0) {
    const shaper = ctx.createWaveShaper();
    shaper.curve = satCurve(drive);
    shaper.oversample = '2x';
    f.connect(shaper);
    outNode = shaper;
  }
  outNode.connect(g);
  route(ctx, master, reverbBus, g, reverb);
  src.start(t0); src.stop(t0 + t + 0.02);
}

// Runs a full cue recipe (array of tone/noise layers) against a context.
export function playRecipe(ctx, master, reverbBus, recipe) {
  if (!Array.isArray(recipe)) return;
  for (const layer of recipe) {
    if (layer.kind === 'noise') scheduleNoise(ctx, master, reverbBus, layer);
    else scheduleTone(ctx, master, reverbBus, layer);
  }
}

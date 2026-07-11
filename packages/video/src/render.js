// Export a project to a REAL, playable video file — and help the editor play a
// live preview. Frames come from the deterministic drawFrame; audio comes from
// the synthesized voice buffers (+ any SFX buffers) mixed live. Capture is via
// canvas.captureStream + MediaRecorder, so it runs in the browser with zero
// server and zero extra dependency. The CONTENT is deterministic even though the
// container is a normal MP4/WebM.
import { drawFrame } from './layers.js';
import { recomputeDuration } from './project.js';

// Best container the browser can actually record. MP4 first (Chrome ships H.264
// recording on many builds); WebM/VP9 otherwise. '' = let the browser pick.
export function pickMime() {
  const cands = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const m of cands) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch { /* ignore */ } }
  return '';
}
export const extForMime = (m) => (m && m.indexOf('mp4') >= 0 ? 'mp4' : 'webm');

// Schedule the project's audio clips onto an output node, returning the sources
// so the caller can stop them. `offset` lets preview start partway through.
export function startClips(actx, outNode, clips, t0, offset = 0) {
  const srcs = [];
  for (const clip of clips || []) {
    if (!clip.buffer) continue;
    const s = (clip.start || 0) - offset;
    const when = t0 + Math.max(0, s);
    const inBufOffset = s < 0 ? -s : 0;
    if (inBufOffset >= clip.buffer.duration) continue;
    const src = actx.createBufferSource(); src.buffer = clip.buffer;
    const g = actx.createGain(); g.gain.value = clip.gain ?? 1;
    src.connect(g); g.connect(outNode);
    src.start(when, inBufOffset);
    srcs.push(src);
  }
  return srcs;
}

// Render the whole project to a Blob. Real-time (a 20s video takes ~20s).
export async function exportVideo(project, opts = {}) {
  const { onProgress, tail = 0.15 } = opts;
  const { w, h, fps } = project.format;
  const dur = recomputeDuration(project);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawFrame(ctx, project, 0, w, h); // prime first frame

  const AC = window.AudioContext || window.webkitAudioContext;
  const actx = new AC();
  await actx.resume();
  const dest = actx.createMediaStreamDestination();
  const master = actx.createGain(); master.gain.value = 1; master.connect(dest);

  const vstream = canvas.captureStream(fps);
  const stream = new MediaStream([...vstream.getVideoTracks(), ...dest.stream.getAudioTracks()]);

  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000, audioBitsPerSecond: 128_000 } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => { rec.onstop = () => res(new Blob(chunks, { type: mime || 'video/webm' })); });

  rec.start(100);
  const t0 = actx.currentTime + 0.08;
  const srcs = startClips(actx, master, project.audio, t0, 0);

  // Timer-driven (not requestAnimationFrame): rAF is paused in background tabs,
  // which would hang the render. captureStream(fps) samples the canvas on its
  // own clock, so we just keep the canvas current in real time until `dur`.
  const startPerf = performance.now();
  await new Promise((res) => {
    const iv = setInterval(() => {
      const t = (performance.now() - startPerf) / 1000;
      if (t >= dur) { clearInterval(iv); drawFrame(ctx, project, dur, w, h); onProgress && onProgress(1); res(); return; }
      drawFrame(ctx, project, t, w, h);
      onProgress && onProgress(t / dur);
    }, 1000 / fps);
  });

  await new Promise((r) => setTimeout(r, tail * 1000));
  rec.stop();
  const blob = await stopped;
  srcs.forEach((s) => { try { s.stop(); } catch { /* already stopped */ } });
  try { await actx.close(); } catch { /* ignore */ }
  return { blob, mime: mime || 'video/webm', ext: extForMime(mime), duration: dur };
}

// Trigger a browser download of a rendered blob.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

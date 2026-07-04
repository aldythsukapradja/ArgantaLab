// DyePicker — faithful, gradient-sorted palette picker.
//
// Faithful: swatches are computed from the palette entries the part's own
// pixels actually use (histogram of its idx-sheet frame), so the chip color
// matches the rendered result. Gradient: swatches are sorted by hue →
// lightness while remembering their real palette ids.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as data from '../engine/data.js';

async function samplePartIndices(cat, part) {
  if (!part?.idx_sheet) return null;
  const img = await data.loadImage(data.idxSheetUrl(cat, part));
  const fm = part.frames.find(Boolean);
  if (!fm) return null;
  const c = document.createElement('canvas');
  c.width = Math.min(part.cell_w, 96);
  c.height = Math.min(part.cell_h, 96);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, fm.x, fm.y, part.cell_w, part.cell_h, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const hist = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const idx = d[i];
    if (idx) hist.set(idx, (hist.get(idx) || 0) + 1);
  }
  return [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const dlt = max - min;
  const s = l > 0.5 ? dlt / (2 - max - min) : dlt / (max + min);
  let h;
  if (max === r) h = ((g - b) / dlt + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / dlt + 2) / 6;
  else h = ((r - g) / dlt + 4) / 6;
  return [h, s, l];
}

export default function DyePicker({ cat, part, value, anchorRect, onPick, onClose }) {
  const [palettes, setPalettes] = useState(null);
  const [sample, setSample] = useState(null);
  const boxRef = useRef(null);
  useEffect(() => { data.charPalettes(cat).then(setPalettes).catch(() => setPalettes([])); }, [cat]);
  useEffect(() => { samplePartIndices(cat, part).then(setSample).catch(() => setSample(null)); }, [cat, part?.id]);
  useEffect(() => {
    function close(e) { if (!boxRef.current?.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [onClose]);

  const swatches = useMemo(() => {
    if (!palettes) return null;
    const list = palettes.map((pal, i) => {
      // weighted average of the entries this part actually uses
      let r = 0, g = 0, b = 0, w = 0;
      for (const [idx, count] of sample || [[80, 1], [128, 1]]) {
        const c = pal[idx] || [0, 0, 0];
        r += c[0] * count; g += c[1] * count; b += c[2] * count; w += count;
      }
      const rgb = w ? [r / w, g / w, b / w] : [128, 128, 128];
      return { i, rgb, hsl: rgbToHsl(rgb) };
    });
    // gradient sort: grays first (low saturation), then hue, then lightness
    list.sort((a, b) => {
      const ga = a.hsl[1] < 0.12, gb = b.hsl[1] < 0.12;
      if (ga !== gb) return ga ? -1 : 1;
      if (ga) return a.hsl[2] - b.hsl[2];
      return a.hsl[0] - b.hsl[0] || a.hsl[2] - b.hsl[2];
    });
    return list;
  }, [palettes, sample]);

  // anchor the popup right beside the 🎨 button that opened it, clamped
  // inside the viewport so it never runs off-screen.
  const POP_W = 300;
  let style;
  if (anchorRect) {
    const spaceRight = window.innerWidth - anchorRect.right;
    const left = spaceRight >= POP_W + 12
      ? anchorRect.right + 8
      : Math.max(8, anchorRect.left - POP_W - 8);
    const top = Math.min(anchorRect.top, window.innerHeight - 340);
    style = { position: 'fixed', left, top: Math.max(8, top), right: 'auto' };
  }
  return (
    <div className="dye-pop" ref={boxRef} style={style}>
      <div className="dye-head">
        <b>{cat} colors</b> <small>{swatches?.length ?? '…'} palettes</small>
        <button className="closex" onClick={onClose}>✕</button>
      </div>
      <div className="dye-grid">
        <button className={`dsw none ${value == null ? 'on' : ''}`} title="default"
          onClick={() => onPick(null)}>∅</button>
        {(swatches || []).map((s) => (
          <button key={s.i} className={`dsw ${value === s.i ? 'on' : ''}`}
            style={{ background: `rgb(${s.rgb.map(Math.round).join(',')})` }}
            title={`palette ${s.i}`}
            onClick={() => onPick(s.i)} />
        ))}
      </div>
    </div>
  );
}

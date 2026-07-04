// SkillBrowser — grouped effect picker for composer skill slots.
// The right panel renders one autoplaying review: the explicitly selected
// effect only. Rows never animate by themselves.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as data from '../engine/data.js';

function effectLabel(e) {
  return `effect #${String(e?.id ?? 0).padStart(3, '0')}`;
}

function effectGroup(e) {
  const start = Math.floor((e?.id ?? 0) / 50) * 50;
  return `Effects ${String(start).padStart(3, '0')}-${String(start + 49).padStart(3, '0')}`;
}

function EffectLivePreview({ effect, size = 220 }) {
  const ref = useRef(null);

  useEffect(() => {
    let live = true;
    let raf = 0;

    async function start() {
      const canvas = ref.current;
      if (!canvas || !effect?.sheet || !effect?.animation?.length) return;
      const ctx = canvas.getContext('2d');
      const sheet = await data.loadImage(data.effectSheetUrl(effect));
      if (!live) return;

      const total = effect.animation.reduce((sum, s) => sum + Math.min(1500, Math.max(60, s.delay || 100)), 0);

      function draw(now) {
        if (!live || !ref.current) return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);
        ctx.fillStyle = '#0b1020';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#ffffff10';
        for (let y = 0; y < size; y += 16) {
          for (let x = (y / 16) % 2 ? 0 : 16; x < size; x += 32) ctx.fillRect(x, y, 16, 16);
        }

        let t = now % Math.max(1, total);
        let step = effect.animation[0];
        for (const s of effect.animation) {
          const d = Math.min(1500, Math.max(60, s.delay || 100));
          if (t < d) { step = s; break; }
          t -= d;
        }
        const fm = effect.frames?.[step.frame];
        if (fm) {
          const scale = Math.min(2, Math.max(0.75, Math.min((size - 30) / Math.max(1, fm.w), (size - 30) / Math.max(1, fm.h))));
          const dx = (size - fm.w * scale) / 2;
          const dy = (size - fm.h * scale) / 2;
          ctx.globalAlpha = step.alpha != null ? step.alpha : 1;
          ctx.drawImage(sheet, fm.x + fm.fx, fm.y + fm.fy, fm.w, fm.h, dx, dy, fm.w * scale, fm.h * scale);
          ctx.globalAlpha = 1;
        }
        raf = requestAnimationFrame(draw);
      }
      raf = requestAnimationFrame(draw);
    }

    start().catch(() => {});
    return () => {
      live = false;
      cancelAnimationFrame(raf);
    };
  }, [effect?.id, size]);

  return <canvas ref={ref} width={size} height={size} className="effect-live-canvas" />;
}

export default function SkillBrowser({ title, effects, value, onPick, onTest, onClose }) {
  const [q, setQ] = useState('');
  const [previewId, setPreviewId] = useState(value);

  const entries = useMemo(() => effects
    .filter((e) => e?.sheet && e?.animation?.length)
    .map((e) => ({
      key: `effect:${e.id}`,
      id: e.id,
      effect: e,
      label: effectLabel(e),
      group: effectGroup(e),
    })), [effects]);

  const groups = useMemo(() => {
    const map = new Map();
    const needle = q.trim().toLowerCase();
    for (const e of entries) {
      if (needle && !e.label.toLowerCase().includes(needle) && !String(e.id).includes(needle) && !e.group.toLowerCase().includes(needle)) continue;
      if (!map.has(e.group)) map.set(e.group, []);
      map.get(e.group).push(e);
    }
    return [...map.entries()];
  }, [entries, q]);

  const [openGroup, setOpenGroup] = useState(null);
  useEffect(() => {
    if (groups.length && (openGroup == null || !groups.some(([g]) => g === openGroup))) {
      const selected = groups.find(([, items]) => items.some((e) => e.id === value));
      setOpenGroup(selected?.[0] || groups[0][0]);
    }
  }, [groups, openGroup, value]);

  const current = groups.find(([g]) => g === openGroup)?.[1] || [];
  const preview = entries.find((e) => e.id === previewId) || entries.find((e) => e.id === value) || null;

  return (
    <div className="browser-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="browser skill-browser">
        <div className="browser-head">
          <b>{title}</b>
          <input placeholder="Search effect id or group..." value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <button className="closex" onClick={onClose}>x</button>
        </div>
        <div className="browser-body skill-browser-body">
          <div className="browser-groups">
            {groups.map(([g, items]) => (
              <button key={g} className={g === openGroup ? 'on' : ''} onClick={() => setOpenGroup(g)}>
                {g} <small>{items.length}</small>
              </button>
            ))}
          </div>
          <div className="skill-effect-list">
            {current.map((e) => (
              <button
                key={e.key}
                className={`effect-row ${e.id === value ? 'sel' : ''} ${e.id === preview?.id ? 'previewing' : ''}`}
                onFocus={() => setPreviewId(e.id)}
                onClick={() => setPreviewId(e.id)}
                onDoubleClick={() => { onPick(e); onClose(); }}
              >
                <span>{e.label}</span>
                <small>{e.effect.animation.length} frames</small>
              </button>
            ))}
            {!current.length && <div className="browser-empty">no matches</div>}
          </div>
          <aside className="skill-live-panel">
            <div className="skill-live-title">
              <b>Selected review</b>
              <span>{preview ? effectLabel(preview.effect) : 'No effect'}</span>
            </div>
            {preview && <EffectLivePreview effect={preview.effect} />}
            {preview && (
              <div className="skill-live-meta">
                <span>{preview.effect.frames?.length || 0} sprites</span>
                <span>{preview.effect.animation?.length || 0} animation steps</span>
                <span>{preview.effect.sheet}</span>
              </div>
            )}
            <div className="skill-live-actions">
              <button onClick={() => preview && onTest(preview)}>Test</button>
              <button className="primary" onClick={() => { if (preview) { onPick(preview); onClose(); } }}>Use this skill</button>
            </div>
            <small className="skill-live-hint">Click an effect to display it here. Use Test only when you want to play it in the practice ground.</small>
          </aside>
        </div>
      </div>
    </div>
  );
}

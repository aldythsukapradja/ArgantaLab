// PartBrowser — visual "browse collection" popup. Shows sprite previews in
// a grid, organized by group; ONLY the open group's thumbnails render (and
// each group's sheets load on first open), so browsing 800+ armors stays
// fast. Also used for weapons/hair/etc.
import { useEffect, useMemo, useRef, useState } from 'react';
import * as data from '../engine/data.js';

// Static (non-animated) thumbnail of a part's idle-south frame.
function PartThumb({ cat, part, size = 72 }) {
  const ref = useRef(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const sheet = await data.loadImage(data.sheetUrl(cat, part));
        if (!live || !ref.current) return;
        const anim = part.animations?.NormalStandBySouth || part.animations?.WeaponStandBySouth
          || Object.values(part.animations || {}).find((a) => a?.length);
        const fi = anim?.[0]?.frame ?? 0;
        const fm = part.frames[fi] || part.frames.find(Boolean);
        if (!fm) return;
        const ctx = ref.current.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, size, size);
        const s = Math.min(2, Math.min(size / Math.max(1, fm.w), size / Math.max(1, fm.h)));
        ctx.drawImage(
          sheet, fm.x + fm.fx, fm.y + fm.fy, fm.w, fm.h,
          (size - fm.w * s) / 2, (size - fm.h * s) / 2, fm.w * s, fm.h * s
        );
      } catch { /* sheet missing */ }
    })();
    return () => { live = false; };
  }, [cat, part.id]);
  return <canvas ref={ref} width={size} height={size} className="thumbc" />;
}

// entries: [{key, cat, part, label, group}]  (group order = insertion order)
export default function PartBrowser({ title, entries, value, onPick, onClose }) {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const map = new Map();
    const needle = q.trim().toLowerCase();
    for (const e of entries) {
      if (needle && !e.label.toLowerCase().includes(needle) && !e.group.toLowerCase().includes(needle)) continue;
      if (!map.has(e.group)) map.set(e.group, []);
      map.get(e.group).push(e);
    }
    return [...map.entries()];
  }, [entries, q]);
  const [openGroup, setOpenGroup] = useState(null);
  useEffect(() => {
    if (groups.length && (openGroup == null || !groups.some(([g]) => g === openGroup))) {
      setOpenGroup(groups[0][0]);
    }
  }, [groups]);

  const current = groups.find(([g]) => g === openGroup)?.[1] || [];
  return (
    <div className="browser-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="browser">
        <div className="browser-head">
          <b>{title}</b>
          <input placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <button className="closex" onClick={onClose}>✕</button>
        </div>
        <div className="browser-body">
          <div className="browser-groups">
            {groups.map(([g, items]) => (
              <button key={g} className={g === openGroup ? 'on' : ''} onClick={() => setOpenGroup(g)}>
                {g} <small>{items.length}</small>
              </button>
            ))}
          </div>
          <div className="browser-grid">
            {current.map((e) => (
              <button key={e.key} className={`bcell ${e.key === value ? 'sel' : ''}`}
                onClick={() => { onPick(e); onClose(); }}>
                <PartThumb cat={e.cat} part={e.part} />
                <small>{e.label}</small>
              </button>
            ))}
            {!current.length && <div className="browser-empty">no matches</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

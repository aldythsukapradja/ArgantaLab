import { useEffect, useRef, useState } from 'react';

// Full-bleed Google-Maps-style world for ArgantaLab. The canvas IS the map
// (fills the whole view); Maps-style chrome (search, zoom, place card) floats on
// top. LashiraBloom is HQ; every ArgantaLab RPG plugs in as a place and the world
// grows. Google Maps palette + control placement replicated. Placeholder tiles.
const WORLD = { w: 2400, h: 1600 };
const REGIONS = [
  { id: 'lashira', name: 'LashiraBloom', cat: 'Headquarters · farming', x: 1040, y: 760, r: 150, color: '#7cc35a', kind: 'hq' },
  { id: 'kinquest', name: 'KinQuest', cat: 'Creature battler', x: 1460, y: 560, r: 110, color: '#6f8bf6', kind: 'live' },
  { id: 'kingdom', name: 'Kingdom of Kin', cat: 'Realtime MMORPG', x: 1520, y: 940, r: 118, color: '#8b5cf6', kind: 'planned' },
  { id: 'mine', name: 'Emberdeep', cat: 'Mining · resources', x: 700, y: 560, r: 96, color: '#c98a3a', kind: 'planned' },
  { id: 'town', name: 'Bloomridge', cat: 'Town · social', x: 660, y: 980, r: 100, color: '#e879b9', kind: 'planned' },
  { id: 'open', name: 'Open Region', cat: 'Reserved · in build plan', x: 1120, y: 380, r: 104, color: '#3aa76d', kind: 'open' },
];
const KIND_LABEL = { hq: 'Headquarters', live: 'Live', planned: 'In build plan', open: 'Reserved · in build plan' };

export function WorldMap() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const cam = useRef({ x: 0, y: 0, scale: 0.6, _init: false });
  const drag = useRef(null);
  const drawRef = useRef(() => {});
  const [selected, setSelected] = useState(REGIONS[0]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    function fit() {
      const r = wrap.getBoundingClientRect();
      canvas.width = Math.floor(r.width * dpr); canvas.height = Math.floor(r.height * dpr);
      canvas.style.width = r.width + 'px'; canvas.style.height = r.height + 'px';
      if (!cam.current._init) { centerOn(REGIONS[0], r); cam.current._init = true; }
      draw();
    }
    function centerOn(region, rect) {
      const s = cam.current.scale;
      cam.current.x = region.x - (rect.width / 2) / s;
      cam.current.y = region.y - (rect.height / 2) / s;
    }
    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

    function pin(x, y, color, hq, open) {
      // classic Google teardrop pin, drawn in screen space (constant size)
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(0, 2, 7, 3, 0, 0, 7); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-11, -14, -9, -30, 0, -32);
      ctx.bezierCurveTo(9, -30, 11, -14, 0, 0);
      ctx.closePath();
      ctx.fillStyle = open ? '#3aa76d' : hq ? '#f0a83a' : '#ea4335';
      ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -21, 5.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
      if (hq) { ctx.fillStyle = '#f0a83a'; ctx.font = '700 9px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★', 0, -21); }
      if (open) { ctx.strokeStyle = '#3aa76d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-3, -21); ctx.lineTo(3, -21); ctx.moveTo(0, -24); ctx.lineTo(0, -18); ctx.stroke(); }
      ctx.restore();
    }

    function draw() {
      const c = cam.current, s = c.scale;
      const vw = canvas.width, vh = canvas.height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // water (Google Maps ocean)
      ctx.fillStyle = '#a3ccf2'; ctx.fillRect(0, 0, vw, vh);
      ctx.save();
      ctx.scale(s, s); ctx.translate(-c.x, -c.y);

      // landmass (Google land)
      ctx.fillStyle = '#eef0ec';
      roundRect(360, 200, 1720, 1220, 220); ctx.fill();
      // coastline casing
      ctx.strokeStyle = '#dfe3dc'; ctx.lineWidth = 8 / s; roundRect(360, 200, 1720, 1220, 220); ctx.stroke();

      // roads (white with light casing) from HQ to each place
      const hq = REGIONS[0];
      for (const r of REGIONS) {
        if (r.id === 'lashira') continue;
        ctx.strokeStyle = '#e3e3df'; ctx.lineWidth = 22 / s; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(hq.x, hq.y); ctx.lineTo(r.x, r.y); ctx.stroke();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 15 / s;
        ctx.beginPath(); ctx.moveTo(hq.x, hq.y); ctx.lineTo(r.x, r.y); ctx.stroke();
      }

      // place areas (park-green blobs), like Google POI/park fills
      for (const r of REGIONS) {
        ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 7);
        if (r.kind === 'open') { ctx.setLineDash([14 / s, 9 / s]); ctx.strokeStyle = '#3aa76d'; ctx.lineWidth = 4 / s; ctx.fillStyle = 'rgba(58,167,109,0.12)'; ctx.fill(); ctx.stroke(); ctx.setLineDash([]); }
        else { ctx.fillStyle = hexA(r.color, r.kind === 'hq' ? 0.32 : 0.22); ctx.fill(); ctx.strokeStyle = hexA(r.color, 0.6); ctx.lineWidth = (r.kind === 'hq' ? 5 : 3) / s; ctx.stroke(); }
      }
      ctx.restore();

      // markers + labels in SCREEN space (constant size, Maps-style)
      for (const r of REGIONS) {
        const sx = (r.x - c.x) * s, sy = (r.y - c.y) * s;
        pin(sx, sy, r.color, r.kind === 'hq', r.kind === 'open');
        // label with white halo
        ctx.font = '600 13px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.strokeText(r.name, sx, sy + 4);
        ctx.fillStyle = r.id === selected.id ? '#1a73e8' : '#3c4043'; ctx.fillText(r.name, sx, sy + 4);
      }
    }
    function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
    drawRef.current = draw;

    function toWorld(ev) { const rect = canvas.getBoundingClientRect(); const c = cam.current; return { x: c.x + (ev.clientX - rect.left) / c.scale, y: c.y + (ev.clientY - rect.top) / c.scale }; }
    function onDown(ev) { drag.current = { x: ev.clientX, y: ev.clientY, cx: cam.current.x, cy: cam.current.y, moved: false }; }
    function onMove(ev) {
      if (!drag.current) return;
      const dx = (ev.clientX - drag.current.x) / cam.current.scale, dy = (ev.clientY - drag.current.y) / cam.current.scale;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
      cam.current.x = drag.current.cx - dx; cam.current.y = drag.current.cy - dy; draw();
    }
    function onUp(ev) {
      if (drag.current && !drag.current.moved) {
        const w = toWorld(ev);
        const hit = REGIONS.find((r) => Math.hypot(w.x - r.x, w.y - r.y) <= r.r + 20);
        if (hit) setSelected(hit);
      }
      drag.current = null;
    }
    function onWheel(ev) { ev.preventDefault(); zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.12 : 0.89); }
    function zoomAt(clientX, clientY, factor) {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left, my = clientY - rect.top;
      const c = cam.current; const wx = c.x + mx / c.scale, wy = c.y + my / c.scale;
      c.scale = Math.max(0.3, Math.min(2, c.scale * factor));
      c.x = wx - mx / c.scale; c.y = wy - my / c.scale; draw();
    }
    wrap._zoomAt = zoomAt; wrap._recenter = () => { centerOn(REGIONS[0], wrap.getBoundingClientRect()); draw(); };

    fit();
    const ro = new ResizeObserver(fit); ro.observe(wrap);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => { ro.disconnect(); canvas.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); canvas.removeEventListener('wheel', onWheel); };
  }, [selected.id]);

  const results = query ? REGIONS.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())) : [];
  function goTo(r) { setSelected(r); setQuery(''); const wrap = wrapRef.current; if (wrap) { const rect = wrap.getBoundingClientRect(); cam.current.x = r.x - (rect.width / 2) / cam.current.scale; cam.current.y = r.y - (rect.height / 2) / cam.current.scale; drawRef.current(); } }
  const zoomBtn = (f) => { const wrap = wrapRef.current; const rect = wrap.getBoundingClientRect(); wrap._zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, f); };

  return (
    <div className="gmap" ref={wrapRef}>
      <canvas ref={canvasRef} />

      {/* search (top-left, Google style) */}
      <div className="gmap-search">
        <span className="gs-ico">🔍</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ArgantaLab worlds" />
        {query && <button className="gs-x" onClick={() => setQuery('')}>✕</button>}
        {results.length > 0 && (
          <div className="gs-results">
            {results.map((r) => <button key={r.id} className="gs-row" onClick={() => goTo(r)}><b>📍 {r.name}</b><small>{r.cat}</small></button>)}
          </div>
        )}
      </div>

      {/* zoom + recenter (bottom-right, Google style) */}
      <div className="gmap-zoom">
        <button onClick={() => zoomBtn(1.25)} aria-label="Zoom in">+</button>
        <div className="gz-div" />
        <button onClick={() => zoomBtn(0.8)} aria-label="Zoom out">−</button>
      </div>
      <button className="gmap-recenter" onClick={() => wrapRef.current?._recenter()} title="Recenter on HQ">◎</button>

      {/* place card (bottom-left, Google style) */}
      <div className="gmap-card">
        <div className="gc-strip" style={{ background: selected.color }} />
        <div className="gc-body">
          <div className="gc-title">{selected.name} {selected.kind === 'hq' && <span className="gc-hq">★ HQ</span>}</div>
          <div className="gc-cat">{selected.cat}</div>
          <div className="gc-meta">
            <span className={'gc-pill ' + (selected.kind === 'live' || selected.kind === 'hq' ? 'ok' : selected.kind === 'open' ? 'open' : 'plan')}>{KIND_LABEL[selected.kind]}</span>
          </div>
        </div>
      </div>

      <div className="gmap-attrib">ArgantaLab · world map</div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { KIND_LABEL, MATERIALS_BY_KEY, STARDEW_PROTOTYPE_MATERIALS, WORLD, WORLD_REGIONS } from '../../shared/world-materials.js';

// Full-bleed pixel overworld for Command. This is still a navigation surface,
// but it now uses the same region/material model that the playable web game can
// consume for real map loading.
const REGIONS = WORLD_REGIONS;
const TILE = WORLD.tile;

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
      canvas.width = Math.floor(r.width * dpr);
      canvas.height = Math.floor(r.height * dpr);
      canvas.style.width = r.width + 'px';
      canvas.style.height = r.height + 'px';
      if (!cam.current._init) {
        centerOn(REGIONS[0], r);
        cam.current._init = true;
      }
      draw();
    }

    function centerOn(region, rect) {
      const s = cam.current.scale;
      cam.current.x = region.x - (rect.width / 2) / s;
      cam.current.y = region.y - (rect.height / 2) / s;
    }

    function tileRect(x, y, fill, hi, lo) {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = fill;
      ctx.fillRect(px, py, TILE, TILE);
      if (hi) {
        ctx.fillStyle = hi;
        ctx.fillRect(px + 3, py + 4, 7, 3);
        ctx.fillRect(px + 20, py + 18, 5, 3);
      }
      if (lo) {
        ctx.fillStyle = lo;
        ctx.fillRect(px, py + TILE - 4, TILE, 4);
        ctx.fillRect(px + TILE - 4, py, 4, TILE);
      }
    }

    function materialTile(kind, x, y) {
      if (kind === 'water') return tileRect(x, y, '#6ea7cf', '#86bfdf', '#4d82a9');
      if (kind === 'shore') return tileRect(x, y, '#d7be74', '#ead68d', '#ae914d');
      if (kind === 'farm') return tileRect(x, y, '#78b954', '#92cf68', '#4f8a39');
      if (kind === 'town') return tileRect(x, y, '#bc8d55', '#d0aa72', '#8d6237');
      if (kind === 'city') return tileRect(x, y, '#b6c4cc', '#d3dde2', '#7f929d');
      if (kind === 'mine') return tileRect(x, y, '#72634e', '#93846b', '#4a4035');
      if (kind === 'gate') return tileRect(x, y, '#4f5564', '#767d8e', '#303541');
      if (kind === 'open') return tileRect(x, y, '#6fb36a', '#98d084', '#4a8649');
      if (kind === 'path') return tileRect(x, y, '#c4985d', '#d9b879', '#8e673a');
      return tileRect(x, y, '#83bf5a', '#9bd76c', '#5a963d');
    }

    function landAt(tx, ty) {
      const cx = 38, cy = 25;
      const dx = (tx - cx) / 29;
      const dy = (ty - cy) / 18;
      const n = Math.sin(tx * 0.9) * 0.08 + Math.cos(ty * 1.3) * 0.08 + Math.sin((tx + ty) * 0.4) * 0.06;
      return dx * dx + dy * dy < 1 + n;
    }

    function regionKindAt(wx, wy) {
      let best = null;
      for (const r of REGIONS) {
        const d = Math.hypot(wx - r.x, wy - r.y);
        if (d <= r.r * 1.05 && (!best || d < best.d)) best = { r, d };
      }
      if (!best) return null;
      if (best.r.id === 'lashira') return 'farm';
      if (best.r.id === 'town' || best.r.id === 'kingdom') return 'town';
      if (best.r.id === 'city') return 'city';
      if (best.r.id === 'mine') return 'mine';
      if (best.r.id === 'dungeon') return 'gate';
      if (best.r.id === 'open') return 'open';
      return 'farm';
    }

    function drawBaseWorld() {
      const cols = Math.ceil(WORLD.w / TILE);
      const rows = Math.ceil(WORLD.h / TILE);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const wx = x * TILE + TILE / 2, wy = y * TILE + TILE / 2;
          if (!landAt(x, y)) {
            materialTile('water', x, y);
            continue;
          }
          const shore = !landAt(x - 1, y) || !landAt(x + 1, y) || !landAt(x, y - 1) || !landAt(x, y + 1);
          materialTile(shore ? 'shore' : regionKindAt(wx, wy) || 'grass', x, y);
        }
      }
    }

    function drawPath(a, b) {
      const steps = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / (TILE * 0.6)));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const wobble = Math.sin(t * Math.PI * 2) * 26;
        const x = a.x + (b.x - a.x) * t + wobble * 0.2;
        const y = a.y + (b.y - a.y) * t + wobble * 0.35;
        const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (Math.abs(ox) + Math.abs(oy) < 2) materialTile('path', tx + ox, ty + oy);
      }
    }

    function pixelBuilding(x, y, kind) {
      ctx.save();
      ctx.translate(x, y);
      ctx.imageSmoothingEnabled = false;
      const R = (rx, ry, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(rx, ry, w, h); };
      if (kind === 'mine') {
        R(-44, -12, 88, 36, '#58483a'); R(-30, -32, 60, 26, '#40352e'); R(-18, -10, 36, 34, '#1d1b1a');
        R(-36, 24, 72, 8, '#c4985d'); R(20, -24, 8, 8, '#d3b05d');
      } else if (kind === 'gate') {
        R(-36, -52, 72, 78, '#3c4150'); R(-24, -40, 48, 58, '#1e2230'); R(-14, -30, 28, 44, '#8b5cf6');
        R(-44, 22, 88, 10, '#292d38'); R(-8, -62, 16, 10, '#d7be74');
      } else if (kind === 'city') {
        R(-50, -44, 34, 76, '#91a0a8'); R(-8, -62, 42, 94, '#b4c1c8'); R(32, -34, 24, 66, '#7f929d');
        for (let i = -36; i < 54; i += 20) R(i, -22, 8, 8, '#f6e6a9');
      } else if (kind === 'town') {
        R(-48, -18, 44, 48, '#d4b173'); R(8, -26, 48, 56, '#caa06a');
        R(-56, -30, 60, 18, '#9a4231'); R(0, -40, 64, 20, '#7f3f2e');
      } else {
        R(-54, -20, 64, 48, '#caa06a'); R(14, -10, 48, 38, '#c0533a');
        R(-64, -38, 84, 24, '#b0472e'); R(10, -30, 60, 18, '#7a2f20');
        R(-22, 4, 18, 24, '#6d4526'); R(34, 4, 16, 22, '#e6d2a8');
      }
      ctx.restore();
    }

    function drawProps() {
      for (const r of REGIONS) {
        const kind = r.id === 'mine' ? 'mine' : r.id === 'dungeon' ? 'gate' : r.id === 'city' ? 'city' : r.id === 'town' || r.id === 'kingdom' ? 'town' : 'farm';
        pixelBuilding(r.x, r.y, kind);
        if (r.kind === 'open') drawSign(r.x, r.y + 30, '?');
      }
    }

    function drawSign(x, y, label) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(-4, -4, 8, 34);
      ctx.fillStyle = '#d7be74'; ctx.fillRect(-28, -28, 56, 24);
      ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 4; ctx.strokeRect(-28, -28, 56, 24);
      ctx.fillStyle = '#3b2a1b'; ctx.font = '700 18px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, 0, -16);
      ctx.restore();
    }

    function marker(x, y, region) {
      ctx.save();
      ctx.translate(x, y);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(-12, 13, 24, 5);
      ctx.fillStyle = '#7a5230'; ctx.fillRect(-3, -24, 6, 38);
      ctx.fillStyle = region.kind === 'hq' ? '#f0a83a' : region.kind === 'open' ? '#3aa76d' : region.color;
      ctx.fillRect(1, -29, 26, 18);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(5, -25, 5, 5);
      if (region.kind === 'hq') {
        ctx.fillStyle = '#3b2a1b'; ctx.font = '700 14px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('*', 14, -20);
      }
      if (region.kind === 'open') {
        ctx.fillStyle = '#fff'; ctx.fillRect(12, -25, 4, 12); ctx.fillRect(8, -21, 12, 4);
      }
      ctx.restore();
    }

    function draw() {
      const c = cam.current, s = c.scale;
      const cssW = canvas.width / dpr, cssH = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#233f5d';
      ctx.fillRect(0, 0, cssW, cssH);

      ctx.save();
      ctx.scale(s, s);
      ctx.translate(-Math.round(c.x), -Math.round(c.y));
      drawBaseWorld();
      const hq = REGIONS[0];
      for (const r of REGIONS) if (r.id !== hq.id) drawPath(hq, r);
      drawProps();
      ctx.restore();

      for (const r of REGIONS) {
        const sx = (r.x - c.x) * s, sy = (r.y - c.y) * s;
        marker(sx, sy, r);
        ctx.font = '700 13px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#f8f4da';
        ctx.strokeText(r.name, sx, sy + 18);
        ctx.fillStyle = r.id === selected.id ? '#6b3f17' : '#26351f';
        ctx.fillText(r.name, sx, sy + 18);
      }
    }

    function toWorld(ev) {
      const rect = canvas.getBoundingClientRect();
      const c = cam.current;
      return { x: c.x + (ev.clientX - rect.left) / c.scale, y: c.y + (ev.clientY - rect.top) / c.scale };
    }
    function onDown(ev) { drag.current = { x: ev.clientX, y: ev.clientY, cx: cam.current.x, cy: cam.current.y, moved: false }; }
    function onMove(ev) {
      if (!drag.current) return;
      const dx = (ev.clientX - drag.current.x) / cam.current.scale, dy = (ev.clientY - drag.current.y) / cam.current.scale;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
      cam.current.x = drag.current.cx - dx;
      cam.current.y = drag.current.cy - dy;
      draw();
    }
    function onUp(ev) {
      if (drag.current && !drag.current.moved) {
        const w = toWorld(ev);
        const hit = REGIONS.find((r) => Math.hypot(w.x - r.x, w.y - r.y) <= r.r + 24);
        if (hit) setSelected(hit);
      }
      drag.current = null;
    }
    function onWheel(ev) {
      ev.preventDefault();
      zoomAt(ev.clientX, ev.clientY, ev.deltaY < 0 ? 1.12 : 0.89);
    }
    function zoomAt(clientX, clientY, factor) {
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - rect.left, my = clientY - rect.top;
      const c = cam.current;
      const wx = c.x + mx / c.scale, wy = c.y + my / c.scale;
      c.scale = Math.max(0.3, Math.min(2, c.scale * factor));
      c.x = wx - mx / c.scale;
      c.y = wy - my / c.scale;
      draw();
    }
    wrap._zoomAt = zoomAt;
    wrap._recenter = () => { centerOn(REGIONS[0], wrap.getBoundingClientRect()); draw(); };
    drawRef.current = draw;

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(wrap);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [selected.id]);

  const results = query ? REGIONS.filter((r) => r.name.toLowerCase().includes(query.toLowerCase())) : [];
  function goTo(r) {
    setSelected(r);
    setQuery('');
    const wrap = wrapRef.current;
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      cam.current.x = r.x - (rect.width / 2) / cam.current.scale;
      cam.current.y = r.y - (rect.height / 2) / cam.current.scale;
      drawRef.current();
    }
  }
  const zoomBtn = (f) => {
    const wrap = wrapRef.current;
    const rect = wrap.getBoundingClientRect();
    wrap._zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, f);
  };

  const selectedMaterials = selected.materials.map((key) => ({ key, material: MATERIALS_BY_KEY[key] })).filter((m) => m.material);

  return (
    <div className="gmap pixel-map" ref={wrapRef}>
      <canvas ref={canvasRef} />

      <div className="gmap-search">
        <span className="gs-ico">⌕</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search ArgantaLab worlds" />
        {query && <button className="gs-x" onClick={() => setQuery('')}>x</button>}
        {results.length > 0 && (
          <div className="gs-results">
            {results.map((r) => <button key={r.id} className="gs-row" onClick={() => goTo(r)}><b>{r.name}</b><small>{r.cat}</small></button>)}
          </div>
        )}
      </div>

      <div className="gmap-zoom">
        <button onClick={() => zoomBtn(1.25)} aria-label="Zoom in">+</button>
        <div className="gz-div" />
        <button onClick={() => zoomBtn(0.8)} aria-label="Zoom out">-</button>
      </div>
      <button className="gmap-recenter" onClick={() => wrapRef.current?._recenter()} title="Recenter on HQ">◎</button>

      <div className="gmap-card pixel-card">
        <div className="gc-strip" style={{ background: selected.color }} />
        <div className="gc-body">
          <div className="gc-title">{selected.name} {selected.kind === 'hq' && <span className="gc-hq">HQ</span>}</div>
          <div className="gc-cat">{selected.cat}</div>
          <div className="gc-meta">
            <span className={'gc-pill ' + (selected.kind === 'live' || selected.kind === 'hq' ? 'ok' : selected.kind === 'open' ? 'open' : 'plan')}>{KIND_LABEL[selected.kind]}</span>
            <span className="gc-pill mapid">{selected.mapId}</span>
          </div>
          <div className="gc-materials">
            {selectedMaterials.map(({ key, material }) => (
              <a key={key} className="mat-chip" href={material.pageUrl} target="_blank" rel="noreferrer" title={`${material.title} · ${material.dimensions}`}>
                <span className="mat-pix" />
                <span>{key}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="gmap-attrib">{STARDEW_PROTOTYPE_MATERIALS.length} Stardew prototype sheets cataloged · replace through PixelLab</div>
    </div>
  );
}

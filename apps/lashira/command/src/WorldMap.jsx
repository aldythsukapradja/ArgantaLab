import { useEffect, useRef, useState } from 'react';
import { KIND_LABEL, MATERIALS_BY_KEY, STARDEW_PROTOTYPE_MATERIALS, WORLD, WORLD_REGIONS } from '../../shared/world-materials.js';
import { STARDW_FRAMES, drawStardewFrame, drawStardewTile, loadStardewSheets } from '../../shared/stardew-atlas.js';

const REGIONS = WORLD_REGIONS;
const TILE = WORLD.tile;

export function WorldMap() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const artRef = useRef(null);
  const cam = useRef({ x: 0, y: 0, scale: 0.6, _init: false });
  const drag = useRef(null);
  const drawRef = useRef(() => {});
  const [selected, setSelected] = useState(REGIONS[0]);
  const [query, setQuery] = useState('');
  const [artReady, setArtReady] = useState(false);

  useEffect(() => {
    let live = true;
    loadStardewSheets().then((sheets) => {
      if (!live) return;
      artRef.current = sheets;
      setArtReady(true);
      drawRef.current?.();
    }).catch((err) => {
      console.error('Stardew atlas load failed', err);
    });
    return () => { live = false; };
  }, []);

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
      if (best.r.id === 'mine' || best.r.id === 'dungeon') return 'mineFloor';
      if (best.r.id === 'town' || best.r.id === 'kingdom') return 'cobble';
      if (best.r.id === 'city') return 'cobble';
      if (best.r.id === 'open') return 'meadow';
      return 'grass';
    }

    function materialFrame(kind) {
      return STARDW_FRAMES.terrain[kind] || STARDW_FRAMES.terrain.grass;
    }

    function materialTile(kind, x, y) {
      drawStardewTile(ctx, artRef.current, materialFrame(kind), x * TILE, y * TILE, TILE, x, y);
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
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          if (Math.abs(ox) + Math.abs(oy) < 2) materialTile('path', tx + ox, ty + oy);
        }
      }
    }

    function drawLabelSign(x, y, label) {
      drawStardewFrame(ctx, artRef.current, STARDW_FRAMES.props.sign, x - 23, y - 22, 46, 32);
      ctx.fillStyle = '#3b2a1b';
      ctx.font = '700 15px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y - 8);
    }

    function drawRegionArt(region) {
      const art = artRef.current;
      if (region.id === 'lashira') {
        drawStardewFrame(ctx, art, STARDW_FRAMES.buildings.farmhouseWide, region.x - 92, region.y - 118, 184, 164);
        drawStardewFrame(ctx, art, STARDW_FRAMES.buildings.barn, region.x + 68, region.y - 86, 126, 112);
        drawStardewFrame(ctx, art, STARDW_FRAMES.buildings.greenhouse, region.x - 210, region.y - 120, 112, 176);
        return;
      }
      if (region.id === 'mine') {
        drawStardewFrame(ctx, art, STARDW_FRAMES.buildings.mineEntrance, region.x - 64, region.y - 76, 128, 150);
        return;
      }
      if (region.id === 'dungeon') {
        drawStardewFrame(ctx, art, STARDW_FRAMES.props.obeliskPurple, region.x - 44, region.y - 90, 88, 138);
        drawStardewFrame(ctx, art, STARDW_FRAMES.props.obeliskBlue, region.x + 42, region.y - 84, 72, 124);
        return;
      }
      if (region.id === 'city') {
        drawStardewFrame(ctx, art, STARDW_FRAMES.buildings.blueHouse, region.x - 84, region.y - 116, 168, 188);
        drawStardewFrame(ctx, art, STARDW_FRAMES.props.bus, region.x - 192, region.y + 8, 120, 84);
        return;
      }
      if (region.id === 'town') {
        drawStardewFrame(ctx, art, STARDW_FRAMES.buildings.cabin, region.x - 82, region.y - 84, 164, 152);
        drawStardewFrame(ctx, art, STARDW_FRAMES.props.treeRed, region.x + 80, region.y - 112, 82, 110);
        return;
      }
      if (region.id === 'kingdom') {
        drawStardewFrame(ctx, art, STARDW_FRAMES.buildings.tower, region.x - 66, region.y - 130, 132, 206);
        return;
      }
      drawLabelSign(region.x, region.y + 26, '?');
      drawStardewFrame(ctx, art, STARDW_FRAMES.props.treeOrange, region.x - 78, region.y - 92, 64, 112);
      drawStardewFrame(ctx, art, STARDW_FRAMES.props.pine, region.x + 40, region.y - 94, 58, 108);
    }

    function drawProps() {
      for (const r of REGIONS) drawRegionArt(r);
    }

    function marker(x, y, region) {
      ctx.save();
      ctx.translate(x, y);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(-12, 13, 24, 5);
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(-3, -24, 6, 38);
      ctx.fillStyle = region.kind === 'hq' ? '#f0a83a' : region.kind === 'open' ? '#3aa76d' : region.color;
      ctx.fillRect(1, -29, 26, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, -25, 5, 5);
      if (region.kind === 'hq') {
        ctx.fillStyle = '#3b2a1b';
        ctx.font = '700 14px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('*', 14, -20);
      }
      if (region.kind === 'open') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(12, -25, 4, 12);
        ctx.fillRect(8, -21, 12, 4);
      }
      ctx.restore();
    }

    function drawLoading(cssW, cssH) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#233f5d';
      ctx.fillRect(0, 0, cssW, cssH);
      ctx.fillStyle = '#f8f4da';
      ctx.font = '700 13px Inter, system-ui, sans-serif';
      ctx.fillText('Loading Stardew pixel sheets...', 18, 28);
    }

    function draw() {
      const c = cam.current, s = c.scale;
      const cssW = canvas.width / dpr, cssH = canvas.height / dpr;
      if (!artRef.current) {
        drawLoading(cssW, cssH);
        return;
      }
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
  }, [selected.id, artReady]);

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

      <div className="gmap-attrib">{STARDEW_PROTOTYPE_MATERIALS.length} Stardew prototype sheets cataloged · local sheet renderer active</div>
    </div>
  );
}

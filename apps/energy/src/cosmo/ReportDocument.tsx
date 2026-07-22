// ReportDocument — the Word-like document canvas, ported 1:1 from COSMO_Final.html
// (function ReportDocument). Page rail with add/remove, ribbon (bold/italic/underline
// mocks, size/orientation/margin/columns), and a pannable/zoomable page-plane rendered
// at true inches-at-96dpi geometry (PAGE_SIZES/MARGINS), each page a skeleton report body.
import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, List, Table as TableIcon, Image as ImageIcon, Sparkles, Download, Maximize } from 'lucide-react';
import { PAGE_SIZES, MARGINS, PAGE_TITLES } from './report-types';

export function ReportDocument() {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState('A4');
  const [orient, setOrient] = useState<'portrait' | 'landscape'>('portrait');
  const [margin, setMargin] = useState('Normal');
  const [cols, setCols] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 40, y: 24 });
  const [pages, setPages] = useState([1, 2, 3]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const planeRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const PX = 96;
  const sz = PAGE_SIZES[size];
  const wIn = orient === 'portrait' ? sz.w : sz.h;
  const hIn = orient === 'portrait' ? sz.h : sz.w;
  const pad = MARGINS[margin] * PX;
  const pw = wIn * PX, ph = hIn * PX;
  const addPage = () => setPages((p) => [...p, p.length + 1]);
  const delPage = () => { if (pages.length > 1) { setPages((p) => p.slice(0, -1)); if (page > pages.length - 1) setPage(pages.length - 1); } };
  const dims = `${wIn}″ × ${hIn}″`;
  const clampZ = (z: number) => Math.max(0.25, Math.min(2.5, +z.toFixed(2)));
  const panRef = useRef(pan); panRef.current = pan;
  const pwRef = useRef(pw); pwRef.current = pw;
  const fit = () => {
    const el = canvasRef.current; if (!el) return;
    const cw = el.clientWidth; const z = clampZ(Math.min(1, (cw - 80) / pwRef.current));
    setZoom(z); setPan({ x: Math.max(20, (cw - pwRef.current * z) / 2), y: 24 });
  };
  useEffect(() => {
    const el = canvasRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => {
        const nz = clampZ(z * (e.deltaY < 0 ? 1.08 : 0.926));
        const r = el.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top; const k = nz / z;
        const p = panRef.current; setPan({ x: mx - (mx - p.x) * k, y: my - (my - p.y) * k });
        return nz;
      });
    };
    const onDown = (e: PointerEvent) => { if (e.button !== 0) return; dragRef.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y }; el.classList.add('grabbing'); };
    const onMove = (e: PointerEvent) => { const d = dragRef.current; if (!d) return; setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) }); };
    const onUp = () => { dragRef.current = null; el.classList.remove('grabbing'); };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { el.removeEventListener('wheel', onWheel); el.removeEventListener('pointerdown', onDown); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, []);
  useEffect(() => { fit(); }, [size, orient]);

  return (
    <div className="doc-wrap">
      <div className="doc-rail">
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '.12em', color: 'var(--ink3)', margin: '2px 2px 8px', fontWeight: 600 }}>PAGES · {pages.length}</div>
        {pages.map((p) => (
          <div className={'pthumb ' + (page === p ? 'on' : '')} key={p} onClick={() => setPage(p)} style={orient === 'landscape' ? { width: 150, height: 106 } : undefined}>
            <div className="tl t" /><div className="tl s80" /><div className="tl" /><div className="tl s90" /><div className="tl s60" />
            <div className="pn">{p}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 5, marginTop: 4 }}>
          <button className="wbtn" style={{ flex: 1 }} onClick={addPage}><Plus size={12} /> Page</button>
          <button className="wbtn" onClick={delPage} disabled={pages.length <= 1}><Trash2 size={13} /></button>
        </div>
      </div>
      <div className="doc-main" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="ribbon" style={{ margin: '0 0 0 0', borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}>
          <div className="rgrp"><button className="rbtn" style={{ fontWeight: 700 }}>B</button><button className="rbtn" style={{ fontStyle: 'italic' }}>I</button><button className="rbtn" style={{ textDecoration: 'underline' }}>U</button></div>
          <div className="rgrp"><button className="rbtn">H1</button><button className="rbtn">H2</button><button className="rbtn"><List size={13} /></button><button className="rbtn"><TableIcon size={13} /> Table</button><button className="rbtn"><ImageIcon size={13} /></button></div>
          <div className="rgrp">
            <label className="rselect"><span className="lab">SIZE</span>
              <select value={size} onChange={(e) => setSize(e.target.value)}>{Object.keys(PAGE_SIZES).map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </label>
            <div className="rseg" title="Orientation">
              <b className={orient === 'portrait' ? 'on' : ''} onClick={() => setOrient('portrait')}>▯ Portrait</b>
              <b className={orient === 'landscape' ? 'on' : ''} onClick={() => setOrient('landscape')}>▭ Landscape</b>
            </div>
            <label className="rselect"><span className="lab">MARGIN</span>
              <select value={margin} onChange={(e) => setMargin(e.target.value)}>{Object.keys(MARGINS).map((k) => <option key={k} value={k}>{k}</option>)}</select>
            </label>
            <div className="rseg" title="Columns">{[1, 2, 3].map((c) => <b key={c} className={cols === c ? 'on' : ''} onClick={() => setCols(c)}>{c}⁝</b>)}</div>
          </div>
          <div className="rgrp">
            <div className="rzoom">
              <button onClick={() => setZoom((z) => clampZ(z - 0.1))}>−</button>
              <span className="zv">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => clampZ(z + 0.1))}>＋</button>
              <button onClick={fit} title="Fit">⤢</button>
            </div>
            <button className="rbtn"><Sparkles size={13} /> Ask Cosmonaut</button>
            <button className="rbtn p"><Download size={13} /> Export</button>
          </div>
        </div>
        <div className="doc-canvas" ref={canvasRef}>
          <div className="doc-plane" ref={planeRef} style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})` }}>
            {pages.map((p) => (
              <div className="doc-page" key={p} id={'docpg' + p} style={{ width: pw, minHeight: ph, padding: pad, fontSize: 13 }}>
                {p === 1 && <div className="ban"><div className="co">RMO Cosmo · North Oil Company · C1-Controlled</div><div className="dt">DRAFT · v0 · {size} {orient}</div></div>}
                <h1 style={{ fontSize: 24 }}>{PAGE_TITLES[(p - 1) % PAGE_TITLES.length]}</h1>
                <div className="sub" style={{ fontSize: 11 }}>Al Shaheen field · GeaVision · page {p} of {pages.length} · {dims}</div>
                <div className={cols > 1 ? 'cols' : ''} style={cols > 1 ? { columnCount: cols } : undefined}>
                  <h2 style={{ fontSize: 15 }}>1 · Executive Summary</h2>
                  <div className="sk s90" /><div className="sk" /><div className="sk s80" /><div className="sk s45" />
                  <h2 style={{ fontSize: 15 }}>2 · Interpretation</h2>
                  <p style={{ fontStyle: 'italic', color: '#94a3b8', fontSize: 12.5 }}>Rich-text placeholder — Word-like editor is UI only.</p>
                  <div className="sk" /><div className="sk s90" /><div className="sk s80" /><div className="sk" /><div className="sk s60" />
                  <h2 style={{ fontSize: 15 }}>3 · Evidence &amp; Provenance</h2>
                  <div className="sk s80" /><div className="sk" /><div className="sk s45" /><div className="sk s90" />
                </div>
                <div className="pnum">{p}</div>
              </div>
            ))}
          </div>
          <div className="doc-hint">scroll = zoom · drag = pan · ⤢ = fit</div>
          <div className="doc-fit">
            <button onClick={() => setZoom((z) => clampZ(z - 0.1))}>−</button>
            <span className="dz">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => clampZ(z + 0.1))}>＋</button>
            <button onClick={fit} title="Fit"><Maximize size={14} /></button>
          </div>
        </div>
        <div className="statusbar">
          <span>Page {page} of {pages.length}</span><span>{size} · {orient}</span>
          <span>margins: {margin} ({MARGINS[margin]}″)</span><span>{cols} column{cols > 1 ? 's' : ''}</span>
          <span className="sp" /><span>~{pages.length * 320} words (mock)</span><span>{Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

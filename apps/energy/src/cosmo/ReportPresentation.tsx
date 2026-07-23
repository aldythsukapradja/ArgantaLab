// ReportPresentation — the PowerPoint-like slide deck editor + present mode, ported 1:1
// from COSMO_Final.html (function ReportPresentation + slideBody + LAYOUTS/THEMES/
// TRANSITIONS/SLIDE_SIZES). Slide rail with add/duplicate/delete/reorder, ribbon
// (size/orientation/insert/layout/theme/transition/notes/footer/zoom/present), fit-to-
// screen slide stage, speaker notes drawer, and a full-screen present overlay with
// left/right/Escape keyboard nav.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Plus, Copy, Trash2, ChevronUp, ChevronDown, Type, Image as ImageIcon, BarChart3,
  Table as TableIcon, Shapes, NotebookPen, Hash, Play, Download, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { SLIDE_SIZES, LAYOUTS, THEMES, TRANSITIONS } from './report-types';

type Slide = { k: string; t: string; p: string; layout: string; theme: string; trans: string; notes: string };
const INIT: Slide[] = [
  { k: 'Guardians of the reservoir', t: 'Every field needs a guardian', p: 'The human expert is the guardian — ArgantaEnergy gives back time.', layout: 'Title', theme: 'dark', trans: 'Fade', notes: 'Open with the guardian metaphor. Set the tone.' },
  { k: 'Lifecycle', t: 'Four stages, one shell', p: 'Exploration · Field Development · Well Delivery · Reservoir Management.', layout: 'Title + Content', theme: 'dark', trans: 'Push', notes: 'Walk the four lifecycle stages left to right.' },
  { k: 'Agents', t: 'Workstream agents', p: 'Each embedded as a digital employee; Arganta orchestrates across all.', layout: 'Two Content', theme: 'teal', trans: 'Morph', notes: 'Contrast the agents; Arganta in the middle.' },
  { k: 'Value', t: '~$3M potential per year', p: 'Evidence-first, confidential, grounded to the unified model.', layout: 'Chart', theme: 'violet', trans: 'Zoom', notes: 'Land the value case. Reference the ledger.' },
];

function slideBody(sl: Slide, H: number): ReactNode {
  const L = sl.layout;
  if (L === 'Section') return (
    <>
      <div className="kick">{sl.k}</div><h1 style={{ maxWidth: '90%' }}>{sl.t}</h1>
      <div style={{ width: '22%', height: 4, background: 'currentColor', opacity: .5, borderRadius: 3, marginTop: '2%' }} />
    </>
  );
  if (L === 'Title') return <><div className="kick">{sl.k}</div><h1>{sl.t}</h1><p>{sl.p}</p></>;
  if (L === 'Two Content' || L === 'Comparison') return (
    <>
      <div className="kick">{sl.k}</div><h1 style={{ fontSize: 'clamp(16px,2.4vw,26px)' }}>{sl.t}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4%', marginTop: '2%' }}>
        <div className="dl-ph" style={{ minHeight: H * 0.34 }}>{L === 'Comparison' ? 'Option A' : 'content A'}</div>
        <div className="dl-ph" style={{ minHeight: H * 0.34 }}>{L === 'Comparison' ? 'Option B' : 'content B'}</div>
      </div>
    </>
  );
  if (L === 'Chart') return (
    <>
      <div className="kick">{sl.k}</div><h1 style={{ fontSize: 'clamp(16px,2.4vw,26px)' }}>{sl.t}</h1>
      <div className="chartph">{[42, 66, 54, 80, 48, 72].map((v, x) => <i key={x} style={{ height: v + '%' }} />)}</div>
    </>
  );
  if (L === 'Table') return (
    <>
      <div className="kick">{sl.k}</div><h1 style={{ fontSize: 'clamp(16px,2.4vw,26px)' }}>{sl.t}</h1>
      <table className="tableph" style={{ marginTop: '3%' }}><tbody>{[0, 1, 2, 3].map((r) => <tr key={r}>{[0, 1, 2].map((c) => <td key={c}>{r === 0 ? 'Col ' + (c + 1) : '—'}</td>)}</tr>)}</tbody></table>
    </>
  );
  if (L === 'Picture') return (
    <>
      <div className="kick">{sl.k}</div><h1 style={{ fontSize: 'clamp(16px,2.4vw,26px)' }}>{sl.t}</h1>
      <div className="dl-ph" style={{ marginTop: '2%', minHeight: H * 0.42, fontSize: 'clamp(18px,3vw,34px)' }}><ImageIcon size={34} /></div>
    </>
  );
  if (L === 'Blank') return <div className="dl-ph" style={{ position: 'absolute', inset: '7%' }}>blank canvas</div>;
  return (
    <>
      <div className="kick">{sl.k}</div><h1 style={{ fontSize: 'clamp(16px,2.4vw,26px)' }}>{sl.t}</h1>
      <p>{sl.p}</p><div className="dl-ph" style={{ marginTop: '2%', minHeight: H * 0.3 }}>content placeholder</div>
    </>
  );
}

export function ReportPresentation() {
  const [slides, setSlides] = useState<Slide[]>(INIT);
  const [i, setI] = useState(0);
  const [size, setSize] = useState('16:9');
  const [orient, setOrient] = useState<'portrait' | 'landscape'>('landscape');
  const [zoom, setZoom] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [showFooter, setShowFooter] = useState(true);
  const [present, setPresent] = useState(false);
  const [box, setBox] = useState({ w: 900, h: 520 });
  const stageRef = useRef<HTMLDivElement>(null);
  const s = slides[i] || slides[0];
  const ratio = SLIDE_SIZES[size].r;
  const par = orient === 'portrait' ? 1 / ratio : ratio;

  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const availW = Math.max(240, box.w - 48), availH = Math.max(180, box.h - 72);
  let w = Math.min(availW, availH * par); let h = w / par; w *= zoom; h *= zoom;
  const setField = <K extends keyof Slide>(k: K, v: Slide[K]) => setSlides((arr) => arr.map((sl, idx) => (idx === i ? { ...sl, [k]: v } : sl)));
  const addSlide = () => { setSlides((a) => [...a, { k: 'New', t: 'New slide', p: 'Placeholder body.', layout: 'Title + Content', theme: s.theme, trans: 'Fade', notes: '' }]); setI(slides.length); };
  const dupSlide = () => { setSlides((a) => { const c = { ...a[i] }; return [...a.slice(0, i + 1), c, ...a.slice(i + 1)]; }); setI(i + 1); };
  const delSlide = () => { if (slides.length > 1) { setSlides((a) => a.filter((_, x) => x !== i)); setI(Math.max(0, i - 1)); } };
  const move = (dir: number) => { const j = i + dir; if (j < 0 || j >= slides.length) return; setSlides((a) => { const b = [...a]; const t = b[i]; b[i] = b[j]; b[j] = t; return b; }); setI(j); };
  const go = (d: number) => setI((x) => (x + d + slides.length) % slides.length);

  useEffect(() => {
    if (!present) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); } else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'Escape') setPresent(false); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [present, slides.length]);

  const pW = Math.min(window.innerWidth * 0.92, (window.innerHeight * 0.82) * par), pH = pW / par;

  return (
    <div className="deck-wrap">
      <div className="deck-rail">
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8.5, letterSpacing: '.12em', color: 'var(--ink3)', margin: '2px 2px 8px', fontWeight: 600 }}>SLIDES · {slides.length}</div>
        {slides.map((sl, idx) => (
          <div className={'sthumb ' + (i === idx ? 'on' : '')} key={idx} onClick={() => setI(idx)} style={{ aspectRatio: String(par), height: 'auto', width: 138 }}>
            <div className="stk">{sl.k}</div><div className="stt">{sl.t}</div><div className="sn">{idx + 1}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}>
          <button className="wbtn" style={{ flex: 1 }} onClick={addSlide}><Plus size={12} /> Slide</button>
          <button className="wbtn" onClick={dupSlide} title="Duplicate"><Copy size={13} /></button>
          <button className="wbtn" onClick={delSlide} disabled={slides.length <= 1} title="Delete"><Trash2 size={13} /></button>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
          <button className="wbtn" style={{ flex: 1 }} onClick={() => move(-1)} disabled={i <= 0} title="Move up"><ChevronUp size={12} /> Up</button>
          <button className="wbtn" style={{ flex: 1 }} onClick={() => move(1)} disabled={i >= slides.length - 1} title="Move down"><ChevronDown size={12} /> Down</button>
        </div>
      </div>

      <div className="deck-main" style={{ padding: 0 }}>
        <div className="ribbon" style={{ margin: 0, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none' }}>
          <div className="rgrp">
            <label className="rselect"><span className="lab">SIZE</span>
              <select value={size} onChange={(e) => setSize(e.target.value)}>{Object.entries(SLIDE_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
            </label>
            <div className="rseg" title="Orientation">
              <b className={orient === 'landscape' ? 'on' : ''} onClick={() => setOrient('landscape')}>▭</b>
              <b className={orient === 'portrait' ? 'on' : ''} onClick={() => setOrient('portrait')}>▯</b>
            </div>
          </div>
          <div className="rgrp insrow">
            <span className="ins" onClick={() => setField('layout', 'Title + Content')}><Type size={12} /> Text</span>
            <span className="ins" onClick={() => setField('layout', 'Picture')}><ImageIcon size={12} /> Image</span>
            <span className="ins" onClick={() => setField('layout', 'Chart')}><BarChart3 size={12} /> Chart</span>
            <span className="ins" onClick={() => setField('layout', 'Table')}><TableIcon size={12} /> Table</span>
            <span className="ins"><Shapes size={12} /> Shape</span>
          </div>
          <div className="rgrp">
            <label className="rselect"><span className="lab">LAYOUT</span>
              <select value={s.layout} onChange={(e) => setField('layout', e.target.value)}>{LAYOUTS.map((l) => <option key={l} value={l}>{l}</option>)}</select>
            </label>
            <label className="rselect"><span className="lab">THEME</span>
              <select value={s.theme} onChange={(e) => setField('theme', e.target.value)}>{THEMES.map((t) => <option key={t[0]} value={t[0]}>{t[1]}</option>)}</select>
            </label>
            <label className="rselect"><span className="lab">TRANSITION</span>
              <select value={s.trans} onChange={(e) => setField('trans', e.target.value)}>{TRANSITIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            </label>
          </div>
          <div className="rgrp">
            <button className={'rbtn ' + (showNotes ? 'p' : '')} onClick={() => setShowNotes(!showNotes)} title="Speaker notes"><NotebookPen size={13} /> Notes</button>
            <button className={'rbtn ' + (showFooter ? 'p' : '')} onClick={() => setShowFooter(!showFooter)} title="Slide footer & number"><Hash size={13} /> Footer</button>
            <div className="rzoom">
              <button onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}>−</button>
              <span className="zv">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>＋</button>
              <button onClick={() => setZoom(1)} title="Fit">⤢</button>
            </div>
            <button className="rbtn" onClick={() => setPresent(true)}><Play size={13} /> Present</button>
            <button className="rbtn p"><Download size={13} /> Export</button>
          </div>
        </div>

        <div className="deck-stage" ref={stageRef}>
          <div className={'deck-slide theme-' + s.theme + ' fadein'} key={i + s.layout + s.theme} style={{ width: w, height: h }}>
            <div className="sbadge">{i + 1} / {slides.length}</div>
            {s.theme !== 'light' && <div className="orbmini" />}
            <div className="deck-canvasarea">{slideBody(s, h)}</div>
            {showFooter && <div className="footerbar"><span>ArgantaEnergy · Volve · Confidential</span><span>{i + 1}</span></div>}
          </div>
          <div className="deck-nav">
            <button className="nb" onClick={() => go(-1)}><ChevronLeft size={16} /></button>
            <span className="nc">{i + 1} / {slides.length}</span>
            <button className="nb" onClick={() => go(1)}><ChevronRight size={16} /></button>
          </div>
        </div>

        {showNotes && (
          <div className="notes">
            <div className="nh">SPEAKER NOTES · slide {i + 1}</div>
            <textarea value={s.notes || ''} placeholder="Add speaker notes…" onChange={(e) => setField('notes', e.target.value)} />
          </div>
        )}
        <div className="statusbar">
          <span>Slide {i + 1} of {slides.length}</span><span>{SLIDE_SIZES[size].label}</span>
          <span>{orient}</span><span>layout: {s.layout}</span><span>transition: {s.trans}</span>
          <span>theme: {(THEMES.find((t) => t[0] === s.theme) || [])[1]}</span>
          <span className="sp" /><span>{Math.round(zoom * 100)}%</span>
        </div>
      </div>

      <div className={'present ' + (present ? 'on' : '')}>
        <button className="pexit" onClick={() => setPresent(false)}><X size={13} /> Exit (Esc)</button>
        <div className={'pslide theme-' + s.theme} style={{ width: pW, height: pH }}>
          <div className="pcanvasarea">{slideBody(s, pH)}</div>
          {showFooter && <div className="footerbar"><span>ArgantaEnergy · Volve · Confidential</span><span>{i + 1}</span></div>}
        </div>
        <div className="pbar"><button onClick={() => go(-1)}><ChevronLeft size={16} /></button><span>{i + 1} / {slides.length} · {s.trans}</span><button onClick={() => go(1)}><ChevronRight size={16} /></button></div>
      </div>
    </div>
  );
}

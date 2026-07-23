// DataView (Intelligence → Data) — the ArgantaEnergy data-model explorer for the Volve
// field. Two sub-tabs: "Model" (interactive ER diagram — draggable table cards, SVG FK
// curves, zoom/pan, star-schema layout, searchable table rail, legend) and "Quality &
// Coverage" (per-well completeness matrix computed from the REAL wb index). Adapted from
// the UC116/WellAion reference, restyled to our COSMO tokens, fully rebranded, and
// grounded 1:1 in public/wb (no fabricated data).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Database, Star, Maximize, RotateCcw, Boxes, TableProperties, ShieldCheck, Globe2, Link2 } from 'lucide-react';
import './data-cosmo.css';
import {
  TABLES, RELATIONSHIPS, GROUP_COLOR, GROUP_LABEL, CARD_W, cardHeight, starLayout,
  type ModelTable,
} from './volve-model';
import {
  ATLAS_VERSION, spineOrdered, axisTypes, AXIS_LABEL, AXIS_COLOR, PRMS_CLASS,
  lineage, parseId, RELATIONSHIPS as ATLAS_RELS, VOLVE_BUNDLE, VOLVE_FIELD_ID,
  type EntityType, type EntityInstance, type QuantityFact,
} from '../atlas';
import { loadIndex } from '../wb/load';
import type { WbIndex } from '../wb/types';

type Pos = Record<string, { x: number; y: number }>;
const tableById = (id: string) => TABLES.find((t) => t.id === id)!;
const colIndex = (t: ModelTable, col: string) => t.columns.findIndex((c) => c.name === col);
const nFmt = (n: number) => n.toLocaleString('en-US');

// ── ER diagram ───────────────────────────────────────────────────────────────
function ModelCanvas() {
  const [pos, setPos] = useState<Pos>(() => starLayout());
  const [view, setView] = useState({ x: 40, y: 20, k: 0.85 });
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<'all' | 'dir'>('all');
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string | null; sx: number; sy: number; ox: number; oy: number; pan: boolean } | null>(null);

  // related tables (for highlight/dim when a table is selected)
  const related = useMemo(() => {
    if (!sel) return null;
    const s = new Set<string>([sel]);
    RELATIONSHIPS.forEach((r) => {
      const ft = r.from.split('.')[0], tt = r.to.split('.')[0];
      if (mode === 'all') { if (ft === sel) s.add(tt); if (tt === sel) s.add(ft); }
      else { if (ft === sel) s.add(tt); } // direction: only outgoing
    });
    return s;
  }, [sel, mode]);

  const clampK = (k: number) => Math.max(0.35, Math.min(1.8, +k.toFixed(3)));
  const zoomBy = (f: number) => {
    const el = wrapRef.current; if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    setView((v) => { const nk = clampK(v.k * f); const r = nk / v.k; return { k: nk, x: w / 2 - (w / 2 - v.x) * r, y: h / 2 - (h / 2 - v.y) * r }; });
  };
  const fit = () => {
    const el = wrapRef.current; if (!el) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    TABLES.forEach((t) => { const p = pos[t.id]; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + CARD_W); maxY = Math.max(maxY, p.y + cardHeight(t)); });
    const gw = maxX - minX + 120, gh = maxY - minY + 120;
    const k = clampK(Math.min(el.clientWidth / gw, el.clientHeight / gh));
    setView({ k, x: (el.clientWidth - gw * k) / 2 - (minX - 60) * k, y: (el.clientHeight - gh * k) / 2 - (minY - 60) * k });
  };
  useEffect(() => { const t = setTimeout(fit, 40); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); const r = el.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
      setView((v) => { const nk = clampK(v.k * (e.deltaY < 0 ? 1.08 : 0.926)); const kr = nk / v.k; return { k: nk, x: mx - (mx - v.x) * kr, y: my - (my - v.y) * kr }; });
    };
    const onMove = (e: PointerEvent) => {
      const d = drag.current; if (!d) return;
      if (d.pan) { setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) })); return; }
      if (d.id) setPos((p) => ({ ...p, [d.id!]: { x: d.ox + (e.clientX - d.sx) / view.k, y: d.oy + (e.clientY - d.sy) / view.k } }));
    };
    const onUp = () => { if (drag.current) el.classList.remove('grabbing'); drag.current = null; };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { el.removeEventListener('wheel', onWheel); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [view.k]);

  const startPan = (e: React.PointerEvent) => {
    if (e.button !== 0) return; drag.current = { id: null, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, pan: true };
    wrapRef.current?.classList.add('grabbing');
  };
  const startCardDrag = (e: React.PointerEvent, id: string) => {
    e.stopPropagation(); drag.current = { id, sx: e.clientX, sy: e.clientY, ox: pos[id].x, oy: pos[id].y, pan: false };
  };

  // FK curve anchors — from the fk column of `from` to the pk column of `to`
  const paths = RELATIONSHIPS.map((r) => {
    const [fId, fCol] = r.from.split('.'); const [tId, tCol] = r.to.split('.');
    const ft = tableById(fId), tt = tableById(tId); const fp = pos[fId], tp = pos[tId];
    const fy = fp.y + 34 + colIndex(ft, fCol) * 20 + 10;
    const ty = tp.y + 34 + colIndex(tt, tCol) * 20 + 10;
    const fRight = fp.x + CARD_W / 2 < tp.x + CARD_W / 2;
    const fx = fRight ? fp.x + CARD_W : fp.x; const tx = fRight ? tp.x : tp.x + CARD_W;
    const dx = Math.max(40, Math.abs(tx - fx) * 0.5);
    const c1 = fRight ? fx + dx : fx - dx; const c2 = fRight ? tx - dx : tx + dx;
    const active = !related || (related.has(fId) && related.has(tId));
    return { id: r.id, d: `M ${fx} ${fy} C ${c1} ${fy}, ${c2} ${ty}, ${tx} ${ty}`, color: GROUP_COLOR[ft.group], active };
  });

  const list = TABLES.filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()) || t.id.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="dm-wrap">
      <div className="dm-side">
        <input className="dm-search" placeholder="Find a table…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="dm-sh">TABLES · {TABLES.length}</div>
        <div className="dm-list">
          {list.map((t) => (
            <div key={t.id} className={'dm-trow' + (sel === t.id ? ' on' : '')} onClick={() => setSel((s) => (s === t.id ? null : t.id))}>
              <span className="tdot" style={{ background: GROUP_COLOR[t.group] }} />
              <span className="tnm">{t.name}</span>
              <span className="trows">{nFmt(t.rows)}</span>
            </div>
          ))}
        </div>
        <div className="dm-actions">
          <div className="dm-abtn" onClick={() => setPos(starLayout())}><Star size={14} /> Star schema</div>
          <div className="dm-abtn" onClick={fit}><Maximize size={14} /> Fit to screen</div>
          <div className="dm-abtn" onClick={() => { setPos(starLayout()); setSel(null); setTimeout(fit, 20); }}><RotateCcw size={14} /> Reset layout</div>
        </div>
      </div>

      <div className="dm-canvas-wrap" ref={wrapRef} onPointerDown={startPan}>
        <div className="dm-toolbar">
          <div className="dm-seg">
            <div className={'sg' + (mode === 'all' ? ' on' : '')} onClick={() => setMode('all')}>All relations</div>
            <div className={'sg' + (mode === 'dir' ? ' on' : '')} onClick={() => setMode('dir')}>Filter direction</div>
          </div>
        </div>

        <div className="dm-surface" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})` }}>
          <svg className="dm-svg" width={2000} height={1400}>
            {paths.map((p) => (
              <path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth={1.6}
                strokeOpacity={p.active ? 0.7 : 0.12} strokeDasharray={p.active ? undefined : '3 4'} />
            ))}
          </svg>
          {TABLES.map((t) => {
            const p = pos[t.id]; const on = sel === t.id; const dim = !!related && !related.has(t.id);
            return (
              <div key={t.id} className={'er-card' + (on ? ' hot' : '') + (dim ? ' dim' : '')} style={{ left: p.x, top: p.y }}>
                <div className="er-hd" style={{ background: GROUP_COLOR[t.group] }}
                  onPointerDown={(e) => startCardDrag(e, t.id)} onClick={(e) => { e.stopPropagation(); setSel((s) => (s === t.id ? null : t.id)); }}>
                  <span className="en">{t.name}</span><span className="er-rows">{nFmt(t.rows)}</span>
                </div>
                {t.columns.map((c) => (
                  <div className="er-col" key={c.name}>
                    <span className="cn">{c.name}</span>
                    {c.pk && <span className="ck pk">PK</span>}
                    {c.fk_to && <span className="ck fk">FK</span>}
                    <span className="cd">{c.dtype}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="dm-zoom">
          <div className="dm-zbtn" onClick={() => zoomBy(1.15)}>+</div>
          <div className="dm-zval">{Math.round(view.k * 100)}%</div>
          <div className="dm-zbtn" onClick={() => zoomBy(0.87)}>−</div>
        </div>
        <div className="dm-legend">
          {(Object.keys(GROUP_LABEL) as Array<keyof typeof GROUP_LABEL>).map((g) => (
            <div className="lg" key={g}><span className="sw" style={{ background: GROUP_COLOR[g] }} />{GROUP_LABEL[g]}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Quality & Coverage ───────────────────────────────────────────────────────
function QualityCoverage() {
  const [idx, setIdx] = useState<WbIndex | null>(null);
  useEffect(() => { loadIndex().then(setIdx).catch(() => setIdx(null)); }, []);
  const wells = idx?.wells ?? [];
  const cell = (on: boolean) => <span className="qcell"><span className={'qdot ' + (on ? 'qy' : 'qn')} />{on ? 'Yes' : '—'}</span>;
  const withLogs = wells.filter((w) => w.has.logs).length;
  const withProd = wells.filter((w) => w.has.production).length;
  const withPicks = wells.filter((w) => w.has.picks).length;

  return (
    <div className="dq">
      <div className="dq-cards">
        {[
          { v: wells.length, l: 'wellbores · Volve (WB master)', b: 'MEASURED', bg: '#16a34a1e', c: '#15803d' },
          { v: withLogs, l: 'with wireline logs', b: 'MEASURED', bg: '#16a34a1e', c: '#15803d' },
          { v: withProd, l: 'with production history', b: 'MEASURED', bg: '#16a34a1e', c: '#15803d' },
          { v: withPicks, l: 'with formation-top picks', b: 'INTERPRETED', bg: '#7c3aed1e', c: '#6d28d9' },
        ].map((k) => (
          <div className="dq-card" key={k.l}>
            <div className="kv">{k.v}</div><div className="kl">{k.l}</div>
            <span className="kb" style={{ background: k.bg, color: k.c }}>{k.b}</span>
          </div>
        ))}
      </div>
      <div className="dq-panel">
        <div className="dq-phd"><ShieldCheck size={16} /> Per-well completeness matrix <span className="nat derived">DERIVED · wb index</span></div>
        <div style={{ maxHeight: 'calc(100% - 50px)', overflow: 'auto' }}>
          <table className="qmatrix">
            <thead><tr><th>Well</th><th>Logs</th><th>Trajectory</th><th>Production</th><th>Tops</th><th>Overall</th></tr></thead>
            <tbody>
              {wells.map((w) => {
                const score = [w.has.logs, w.has.traj, w.has.production, w.has.picks].filter(Boolean).length;
                const ov = score >= 4 ? 'qy' : score >= 2 ? 'qp' : 'qn';
                const ol = score >= 4 ? 'Complete' : score >= 2 ? 'Partial' : 'Minimal';
                return (
                  <tr key={w.name}>
                    <td className="qw">{w.name}</td>
                    <td>{cell(w.has.logs)}</td><td>{cell(w.has.traj)}</td><td>{cell(w.has.production)}</td><td>{cell(w.has.picks)}</td>
                    <td><span className={'qpill ' + ov}>{ol}</span></td>
                  </tr>
                );
              })}
              {!wells.length && <tr><td colSpan={6} style={{ color: 'var(--ink3)' }}>Loading Volve well index…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── ATLAS spine STAR SCHEMA — the 18 entity types, Field at the hub (v1) ──────────
// Explicit star layout (Field central; geologic ancestry left, well axis right,
// commercial below). Draggable + pan/zoom + Fit, reusing the ER-card styling.
const STAR_W = 172;
const starCardH = (e: EntityType) => 30 + Math.min(e.keyAttrs.length, 6) * 18 + 8;
const STAR_POS: Record<string, { x: number; y: number }> = {
  world: { x: 40, y: 60 }, region: { x: 40, y: 210 }, country: { x: 40, y: 372 },
  basin: { x: 268, y: 92 }, 'petroleum-system': { x: 268, y: 250 }, 'assessment-unit': { x: 268, y: 410 },
  play: { x: 496, y: 250 }, prospect: { x: 496, y: 70 },
  field: { x: 724, y: 250 }, reservoir: { x: 724, y: 452 },
  asset: { x: 724, y: 60 },
  well: { x: 960, y: 250 }, wellbore: { x: 960, y: 430 }, completion: { x: 960, y: 610 },
  'wellbore-segment': { x: 1196, y: 430 }, 'contact-interval': { x: 1196, y: 610 },
  company: { x: 268, y: 590 }, licence: { x: 268, y: 740 },
};
function SpineStar() {
  const ents = useMemo(() => spineOrdered(), []);
  const [pos, setPos] = useState<Pos>(() => ({ ...STAR_POS }));
  const [view, setView] = useState({ x: 20, y: 10, k: 0.82 });
  const [sel, setSel] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string | null; sx: number; sy: number; ox: number; oy: number; pan: boolean } | null>(null);
  const byId = useMemo(() => new Map(ents.map((e) => [e.id, e])), [ents]);

  const clampK = (k: number) => Math.max(0.35, Math.min(1.8, +k.toFixed(3)));
  const zoomBy = (f: number) => { const el = wrapRef.current; if (!el) return; const w = el.clientWidth, h = el.clientHeight;
    setView((v) => { const nk = clampK(v.k * f); const r = nk / v.k; return { k: nk, x: w / 2 - (w / 2 - v.x) * r, y: h / 2 - (h / 2 - v.y) * r }; }); };
  const fit = () => {
    const el = wrapRef.current; if (!el) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    ents.forEach((e) => { const p = pos[e.id]; if (!p) return; minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x + STAR_W); maxY = Math.max(maxY, p.y + starCardH(e)); });
    const gw = maxX - minX + 120, gh = maxY - minY + 120;
    const k = clampK(Math.min(el.clientWidth / gw, el.clientHeight / gh));
    setView({ k, x: (el.clientWidth - gw * k) / 2 - (minX - 60) * k, y: (el.clientHeight - gh * k) / 2 - (minY - 60) * k });
  };
  useEffect(() => { const t = setTimeout(fit, 40); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); const r = el.getBoundingClientRect(); const mx = e.clientX - r.left, my = e.clientY - r.top;
      setView((v) => { const nk = clampK(v.k * (e.deltaY < 0 ? 1.08 : 0.926)); const kr = nk / v.k; return { k: nk, x: mx - (mx - v.x) * kr, y: my - (my - v.y) * kr }; }); };
    const onMove = (e: PointerEvent) => { const d = drag.current; if (!d) return;
      if (d.pan) { setView((v) => ({ ...v, x: d.ox + (e.clientX - d.sx), y: d.oy + (e.clientY - d.sy) })); return; }
      if (d.id) setPos((p) => ({ ...p, [d.id!]: { x: d.ox + (e.clientX - d.sx) / view.k, y: d.oy + (e.clientY - d.sy) / view.k } })); };
    const onUp = () => { if (drag.current) el.classList.remove('grabbing'); drag.current = null; };
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    return () => { el.removeEventListener('wheel', onWheel); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [view.k]);
  const startPan = (e: React.PointerEvent) => { if (e.button !== 0) return; drag.current = { id: null, sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y, pan: true }; wrapRef.current?.classList.add('grabbing'); };
  const startCardDrag = (e: React.PointerEvent, id: string) => { e.stopPropagation(); drag.current = { id, sx: e.clientX, sy: e.clientY, ox: pos[id].x, oy: pos[id].y, pan: false }; };

  // related set for highlight
  const related = useMemo(() => {
    if (!sel) return null; const s = new Set<string>([sel]);
    ATLAS_RELS.forEach((r) => { if (r.from === sel) s.add(r.to); if (r.to === sel) s.add(r.from); });
    const e = byId.get(sel); if (e?.parent) s.add(e.parent); ents.forEach((x) => { if (x.parent === sel) s.add(x.id); });
    return s;
  }, [sel, byId, ents]);

  // edge anchors: exit the card border toward the target centre
  const anchor = (aId: string, bId: string) => {
    const a = pos[aId], b = pos[bId]; const ea = byId.get(aId)!, eb = byId.get(bId)!;
    const ac = { x: a.x + STAR_W / 2, y: a.y + starCardH(ea) / 2 }, bc = { x: b.x + STAR_W / 2, y: b.y + starCardH(eb) / 2 };
    const dx = bc.x - ac.x, dy = bc.y - ac.y;
    const horiz = Math.abs(dx) >= Math.abs(dy);
    const p1 = horiz ? { x: ac.x + Math.sign(dx) * STAR_W / 2, y: ac.y } : { x: ac.x, y: ac.y + Math.sign(dy) * starCardH(ea) / 2 };
    const p2 = horiz ? { x: bc.x - Math.sign(dx) * STAR_W / 2, y: bc.y } : { x: bc.x, y: bc.y - Math.sign(dy) * starCardH(eb) / 2 };
    return { p1, p2, horiz };
  };
  const relPaths = ATLAS_RELS.map((r) => {
    if (!pos[r.from] || !pos[r.to]) return null;
    const { p1, p2, horiz } = anchor(r.from, r.to);
    const d = horiz ? `M ${p1.x} ${p1.y} C ${(p1.x + p2.x) / 2} ${p1.y}, ${(p1.x + p2.x) / 2} ${p2.y}, ${p2.x} ${p2.y}`
      : `M ${p1.x} ${p1.y} C ${p1.x} ${(p1.y + p2.y) / 2}, ${p2.x} ${(p1.y + p2.y) / 2}, ${p2.x} ${p2.y}`;
    const active = !related || (related.has(r.from) && related.has(r.to));
    return { id: r.id, d, color: AXIS_COLOR[byId.get(r.from)!.axis], active, kind: r.kind };
  }).filter(Boolean) as Array<{ id: string; d: string; color: string; active: boolean; kind: string }>;

  return (
    <div className="dm-wrap">
      <div className="dm-side">
        <div className="dm-sh">SPINE · 18 ENTITY TYPES</div>
        <div className="dm-list">
          {ents.map((e) => (
            <div key={e.id} className={'dm-trow' + (sel === e.id ? ' on' : '')} onClick={() => setSel((s) => (s === e.id ? null : e.id))}>
              <span className="tdot" style={{ background: AXIS_COLOR[e.axis] }} />
              <span className="tnm">{e.tier}. {e.name}</span>
              <span className="trows">{e.ktype}</span>
            </div>
          ))}
        </div>
        <div className="dm-actions">
          <div className="dm-abtn" onClick={() => setPos({ ...STAR_POS })}><Star size={14} /> Star layout</div>
          <div className="dm-abtn" onClick={fit}><Maximize size={14} /> Fit to screen</div>
          <div className="dm-abtn" onClick={() => { setPos({ ...STAR_POS }); setSel(null); setTimeout(fit, 20); }}><RotateCcw size={14} /> Reset</div>
        </div>
      </div>

      <div className="dm-canvas-wrap" ref={wrapRef} onPointerDown={startPan}>
        <div className="dm-toolbar"><div className="dm-hint">Star schema · Field &amp; Well are the hub where the two axes converge</div></div>
        <div className="dm-surface" style={{ transform: `translate(${view.x}px,${view.y}px) scale(${view.k})` }}>
          <svg className="dm-svg" width={1500} height={1000}>
            {relPaths.map((p) => (
              <path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth={1.6}
                strokeOpacity={p.active ? 0.72 : 0.1} strokeDasharray={p.active ? undefined : '3 4'} />
            ))}
          </svg>
          {ents.map((e) => {
            const p = pos[e.id]; if (!p) return null;
            const on = sel === e.id; const dim = !!related && !related.has(e.id);
            const c = AXIS_COLOR[e.axis];
            return (
              <div key={e.id} className={'er-card' + (on ? ' hot' : '') + (dim ? ' dim' : '')} style={{ left: p.x, top: p.y, width: STAR_W }}>
                <div className="er-hd" style={{ background: c }} onPointerDown={(ev) => startCardDrag(ev, e.id)}
                  onClick={(ev) => { ev.stopPropagation(); setSel((s) => (s === e.id ? null : e.id)); }}>
                  <span className="er-tier">{e.tier}</span><span className="en">{e.name}</span><span className="er-rows">{e.ktype}</span>
                </div>
                {e.keyAttrs.slice(0, 6).map((a) => (
                  <div className="er-col" key={a.name}>
                    <span className="cn">{a.name}</span>
                    {a.name === 'name' && a.required && <span className="ck pk">PK</span>}
                    {a.dtype === 'ref' && <span className="ck fk">FK</span>}
                    <span className="cd">{a.unit || a.dtype}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="dm-zoom">
          <div className="dm-zbtn" onClick={() => zoomBy(1.15)}>+</div>
          <div className="dm-zval">{Math.round(view.k * 100)}%</div>
          <div className="dm-zbtn" onClick={() => zoomBy(0.87)}>−</div>
        </div>
        <div className="dm-legend">
          {(['geologic', 'well', 'commercial'] as const).map((ax) => (
            <div className="lg" key={ax}><span className="sw" style={{ background: AXIS_COLOR[ax] }} />{AXIS_LABEL[ax]}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ATLAS Catalogue — the master metadata spine + Volve as a real producing oil field ──
function AtlasCatalogue() {
  // instance-by-type lookup for the Volve bundle (the worked example values)
  const instByType = useMemo(() => {
    const m = new Map<string, EntityInstance>();
    for (const i of VOLVE_BUNDLE.instances) if (!m.has(i.type)) m.set(i.type, i);
    return m;
  }, []);
  const fieldFacts = useMemo(
    () => VOLVE_BUNDLE.facts.filter((f) => f.entityId === VOLVE_FIELD_ID || parseId(f.entityId)?.entity === 'reservoir'),
    [],
  );

  const exampleVal = (t: EntityType): string => {
    const inst = instByType.get(t.id);
    if (!inst) return '—';
    // prefer a defining attr, else the name
    const a = inst.attrs || {};
    if (t.id === 'field') return `${inst.name} · NPDID ${parseId(inst.id)?.nativeId}`;
    if (t.id === 'basin' || t.id === 'assessment-unit' || t.id === 'region') return `${inst.name} · ${a.code ?? ''}`.trim();
    if (t.id === 'licence') return String(inst.name);
    return inst.name;
  };

  const tierRow = (t: EntityType) => {
    const inst = instByType.get(t.id);
    const c = AXIS_COLOR[t.axis];
    return (
      <div className="at-tier" key={t.id} style={{ borderLeftColor: c }}>
        <span className="at-n">{t.tier}</span>
        <div className="at-ent">
          <b>{t.name}</b>
          <small>{t.osdu ? `OSDU ${t.osdu} · ` : ''}{t.aligned.join(' · ')}</small>
        </div>
        <span className="at-kt" style={{ color: c, background: c + '22' }}>{t.ktype}</span>
        <span className={'at-ex' + (inst ? '' : ' none')}>{exampleVal(t)}</span>
      </div>
    );
  };

  const axes: Array<EntityType['axis']> = ['geologic', 'well', 'commercial'];
  return (
    <div className="at-wrap">
      <div className="at-main">
        <div className="at-note">
          <Globe2 size={14} />
          <span><b>Two axes, one graph.</b> Drill by <i>geography</i> or by <i>geology</i> — both converge at
            <b> Field → Well</b>. The spine is callable + updateable (<span className="mono">atlas/spine.ts</span>); Volve is one real instance threaded through it.</span>
        </div>
        {axes.map((ax) => (
          <div className="at-axis" key={ax}>
            <div className="at-axhd" style={{ color: AXIS_COLOR[ax] }}>
              <span className="sw" style={{ background: AXIS_COLOR[ax] }} />{AXIS_LABEL[ax]}
              <span className="ln" />
            </div>
            {axisTypes(ax).map(tierRow)}
            {ax === 'geologic' && <div className="at-converge">▼ both axes converge on <b>Field → Reservoir → Well</b> ▼</div>}
          </div>
        ))}
      </div>

      <aside className="at-side">
        <div className="at-card">
          <div className="at-ch">Volve lineage · the real thread</div>
          <div className="at-lin">
            {lineage(VOLVE_BUNDLE.instances, VOLVE_FIELD_ID).map((i, k, arr) => (
              <span key={i.id}>
                <span className="lk" title={i.id}>{i.name}</span>{k < arr.length - 1 && <span className="sep">›</span>}
              </span>
            ))}
          </div>
        </div>
        <div className="at-card">
          <div className="at-ch"><Link2 size={12} /> Producing-field facts <span className="mono at-cnt">{fieldFacts.length}</span></div>
          <div className="at-facts">
            {fieldFacts.map((f: QuantityFact, k) => {
              const cls = f.dims?.prmsClass ? PRMS_CLASS.find((p) => p.id === f.dims!.prmsClass) : null;
              return (
                <div className="at-fact" key={k}>
                  <span className="fm">{f.metric}</span>
                  <span className="fv mono">{f.value.toLocaleString('en-US')} <small>{f.unit}</small></span>
                  {cls && <span className="fcls" style={{ color: cls.color, background: cls.color + '22' }}>{cls.label}</span>}
                  <span className={'fnat n-' + f.provenance.dataNature}>{f.provenance.dataNature}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="at-card">
          <div className="at-ch">Resource maturity · SPE-PRMS</div>
          <div className="at-prms">
            {PRMS_CLASS.filter((p) => p.id !== 'unrecoverable').map((p) => (
              <div className="pr" key={p.id}><span className="pd" style={{ background: p.color }} />{p.label}</div>
            ))}
            <div className="pr-cap">class × category (P90/P50/P10) — never merged; a field <b>matures</b> across classes over its life.</div>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function DataView() {
  const [sub, setSub] = useState<'catalogue' | 'model' | 'quality'>('catalogue');
  const [modelSrc, setModelSrc] = useState<'spine' | 'volve'>('spine');
  const totalFk = RELATIONSHIPS.length;
  const totalRows = useMemo(() => TABLES.reduce((s, t) => s + t.rows, 0), []);
  const spineCount = spineOrdered().length;
  const modelSpine = sub === 'model' && modelSrc === 'spine';
  return (
    <div className="dm">
      <div className="dm-bar">
        <div className="dm-title">
          <span className="di"><Database size={15} /></span>
          <b>Data Catalogue</b>
          <span className="dm-sub">
            {sub === 'catalogue' ? `ATLAS v${ATLAS_VERSION} · ${spineCount} entity types · world petroleum spine`
              : modelSpine ? `ATLAS spine · ${spineCount} entity types · ${ATLAS_RELS.length} relations · star schema`
              : `Volve · ${TABLES.length} tables · ${totalFk} FK · ${nFmt(totalRows)} rows`}
          </span>
        </div>
        {sub === 'model' && (
          <div className="dm-srcseg">
            <div className={'sg' + (modelSrc === 'spine' ? ' on' : '')} onClick={() => setModelSrc('spine')}>ATLAS spine (18)</div>
            <div className={'sg' + (modelSrc === 'volve' ? ' on' : '')} onClick={() => setModelSrc('volve')}>Volve tables (9)</div>
          </div>
        )}
        <div className="dm-prov"><span className="dot" /> {sub === 'catalogue' || modelSpine ? 'OSDU · USGS · PPDM · PRMS · evidence-native' : 'GROUNDED · ED50 / UTM 31N · evidence-native'}</div>
      </div>
      <div className="dm-subtabs">
        <div className={'dm-subtab' + (sub === 'catalogue' ? ' on' : '')} onClick={() => setSub('catalogue')}><Globe2 size={14} /> Catalogue</div>
        <div className={'dm-subtab' + (sub === 'model' ? ' on' : '')} onClick={() => setSub('model')}><Boxes size={14} /> Data Model</div>
        <div className={'dm-subtab' + (sub === 'quality' ? ' on' : '')} onClick={() => setSub('quality')}><TableProperties size={14} /> Quality &amp; Coverage</div>
      </div>
      {sub === 'catalogue' ? <AtlasCatalogue /> : sub === 'model' ? (modelSpine ? <SpineStar /> : <ModelCanvas />) : <QualityCoverage />}
    </div>
  );
}

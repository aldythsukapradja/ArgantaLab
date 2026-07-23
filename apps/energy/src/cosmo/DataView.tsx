// DataView (Intelligence → Data) — OSDU-first catalogue, ingestion, schema,
// governance and quality workspace. Volve is a physical projection, never the
// enterprise data contract.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Database, Star, Maximize, RotateCcw, Boxes, TableProperties, ShieldCheck,
  Globe2, Link2, Workflow, LockKeyhole, ArrowRight, Layers3, FileJson,
} from 'lucide-react';
import './data-cosmo.css';
import {
  TABLES, RELATIONSHIPS, GROUP_COLOR, GROUP_LABEL, CARD_W, cardHeight, starLayout,
  type ModelTable,
} from './volve-model';
import {
  spineOrdered, axisTypes, AXIS_LABEL, AXIS_COLOR, PRMS_CLASS,
  lineage, parseId, RELATIONSHIPS as ATLAS_RELS, VOLVE_BUNDLE, VOLVE_FIELD_ID,
  type EntityType, type EntityInstance, type QuantityFact,
} from '../atlas';
import { OSDU_DATA_DEFINITIONS, OSDU_KIND_BY_ENTITY } from '../osdu';
import type { OsduPipelineIndex } from '../osdu';
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
          { v: wells.length, l: 'OSDU Wellbore records · Volve', b: 'MASTER DATA', bg: '#0FB5A61e', c: '#0b887e' },
          { v: withLogs, l: 'with WellLog WPC', b: 'MEASURED', bg: '#16a34a1e', c: '#15803d' },
          { v: withProd, l: 'with ProductionValues WPC', b: 'REPORTED', bg: '#16a34a1e', c: '#15803d' },
          { v: withPicks, l: 'with WellboreMarkerSet WPC', b: 'INTERPRETED', bg: '#7c3aed1e', c: '#6d28d9' },
        ].map((k) => (
          <div className="dq-card" key={k.l}>
            <div className="kv">{k.v}</div><div className="kl">{k.l}</div>
            <span className="kb" style={{ background: k.bg, color: k.c }}>{k.b}</span>
          </div>
        ))}
      </div>
      <div className="dq-panel">
        <div className="dq-phd"><ShieldCheck size={16} /> OSDU WPC coverage by Wellbore <span className="nat derived">DERIVED READ MODEL</span></div>
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

// ── OSDU BACKBONE + ARGANTA PROJECTION ─────────────────────────────────────────
// OSDU kinds are canonical. The 18 entities are a navigational projection; only
// nodes marked EXTENSION add concepts not represented by the pinned OSDU release.
const STAR_W = 172;
const starCardH = (e: EntityType) => 30 + (Math.min(e.keyAttrs.length, 6) + 1) * 18 + 8;
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
function OsduBackbone() {
  const ents = useMemo(() => spineOrdered(), []);
  const standardCount = ents.filter((e) => OSDU_KIND_BY_ENTITY[e.id]?.alignment === 'standard').length;
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
        <div className="dm-sh">OSDU BACKBONE · {standardCount} STANDARD · {ents.length - standardCount} EXTENSIONS</div>
        <div className="dm-list">
          {ents.map((e) => {
            const mapping = OSDU_KIND_BY_ENTITY[e.id];
            const extension = mapping?.alignment === 'extension';
            return (
              <div key={e.id} className={'dm-trow' + (sel === e.id ? ' on' : '')} onClick={() => setSel((s) => (s === e.id ? null : e.id))}>
                <span className="tdot" style={{ background: extension ? '#f59e0b' : '#0FB5A6' }} />
                <span className="tnm">{e.tier}. {e.name}</span>
                <span className="trows">{extension ? 'EXT' : 'OSDU'}</span>
              </div>
            );
          })}
        </div>
        <div className="dm-actions">
          <div className="dm-abtn" onClick={() => setPos({ ...STAR_POS })}><Star size={14} /> Star layout</div>
          <div className="dm-abtn" onClick={fit}><Maximize size={14} /> Fit to screen</div>
          <div className="dm-abtn" onClick={() => { setPos({ ...STAR_POS }); setSel(null); setTimeout(fit, 20); }}><RotateCcw size={14} /> Reset</div>
        </div>
      </div>

      <div className="dm-canvas-wrap" ref={wrapRef} onPointerDown={startPan}>
        <div className="dm-toolbar"><div className="dm-hint">OSDU is canonical · Arganta nodes exist only for uncovered domain concepts · Field links the projections</div></div>
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
            const mapping = OSDU_KIND_BY_ENTITY[e.id];
            const extension = mapping?.alignment === 'extension';
            const c = extension ? '#f59e0b' : '#0FB5A6';
            const kindName = mapping?.kind.match(/--([^:]+):/)?.[1] ?? 'Unmapped';
            return (
              <div key={e.id} className={'er-card' + (on ? ' hot' : '') + (dim ? ' dim' : '')} style={{ left: p.x, top: p.y, width: STAR_W }}>
                <div className="er-hd" style={{ background: c }} onPointerDown={(ev) => startCardDrag(ev, e.id)}
                  onClick={(ev) => { ev.stopPropagation(); setSel((s) => (s === e.id ? null : e.id)); }}>
                  <span className="er-tier">{e.tier}</span><span className="en">{e.name}</span><span className="er-rows">{extension ? 'EXT' : 'OSDU'}</span>
                </div>
                <div className="er-col">
                  <span className="cn">{kindName}</span>
                  <span className="cd">{mapping?.recordCategory === 'WorkProductComponent' ? 'WPC' : 'MD'}</span>
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
          <div className="lg"><span className="sw" style={{ background: '#0FB5A6' }} />Official OSDU kind</div>
          <div className="lg"><span className="sw" style={{ background: '#f59e0b' }} />Arganta OSDU extension</div>
        </div>
      </div>
    </div>
  );
}

// ── OSDU catalogue — GOGET identity + field-specific WPC/dataset packages ──
function OsduCatalogue() {
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
    const mapping = OSDU_KIND_BY_ENTITY[t.id];
    const extension = mapping?.alignment === 'extension';
    const c = extension ? '#f59e0b' : '#0FB5A6';
    return (
      <div className="at-tier" key={t.id} style={{ borderLeftColor: c }}>
        <span className="at-n">{t.tier}</span>
        <div className="at-ent">
          <b>{t.name}</b>
          <small>{mapping?.kind ?? 'unmapped'} · {extension ? 'ARGANTA EXTENSION' : 'OSDU STANDARD'}</small>
        </div>
        <span className="at-kt" style={{ color: c, background: c + '22' }}>{extension ? 'EXT' : 'OSDU'}</span>
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
          <span><b>OSDU is the catalogue backbone.</b> GOGET and regulators populate OSDU master data; field-specific
            packages such as <b>Volve</b> attach through OSDU Work Product Components and Datasets. The numbered
            18-node view is only a navigation projection, with five explicit extensions for concepts OSDU does not cover.</span>
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
          <div className="at-ch">Volve · linked detail proof</div>
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

function OsduOverview({ index }: { index: OsduPipelineIndex | null }) {
  const ready = index?.manifests.filter((x) => x.status === 'ready') ?? [];
  const records = ready.reduce((sum, x) => sum + x.records, 0);
  const flow = [
    ['Source landing', 'immutable native evidence'],
    ['Normalize', 'identity · units · geometry'],
    ['Govern', 'ACL · LegalTag · countries'],
    ['Manifest', 'OSDU Manifest 1.0.0'],
    ['Ingest', 'Schema · Storage · Search'],
    ['Project', 'catalogue · Volve · analytics'],
  ];
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 14 }}>
      <div className="dq-cards" style={{ marginBottom: 12 }}>
        {[
          { v: index?.standard ?? 'OSDU R3', l: 'canonical backbone', b: OSDU_DATA_DEFINITIONS.release },
          { v: nFmt(records), l: 'manifest records', b: 'VALIDATED' },
          { v: `${ready.length}/${index?.manifests.length ?? 5}`, l: 'source lanes ready', b: 'INGESTION' },
          { v: '5', l: 'Arganta extensions', b: 'SCHEMA SERVICE' },
        ].map((card) => (
          <div className="dq-card" key={card.l}>
            <div className="kv" style={{ fontSize: typeof card.v === 'string' && card.v.length > 10 ? 19 : undefined }}>{card.v}</div>
            <div className="kl">{card.l}</div>
            <span className="kb" style={{ background: '#0FB5A61e', color: '#0b887e' }}>{card.b}</span>
          </div>
        ))}
      </div>

      <div className="dq-panel" style={{ marginBottom: 12, paddingBottom: 14 }}>
        <div className="dq-phd"><Workflow size={16} /> Canonical OSDU data flow <span className="nat derived">MANIFEST-DRIVEN</span></div>
        <div style={{ display: 'flex', gap: 8, padding: '14px 12px 4px', alignItems: 'stretch', overflowX: 'auto' }}>
          {flow.map(([title, detail], i) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 0 145px' }}>
              <div className="panel-2 hairline" style={{ padding: 10, borderRadius: 5, flex: 1, minHeight: 64 }}>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{title}</div>
                <div className="mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 5, lineHeight: 1.4 }}>{detail}</div>
              </div>
              {i < flow.length - 1 && <ArrowRight size={14} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      </div>

      <div className="dq-panel">
        <div className="dq-phd"><FileJson size={16} /> Source manifests <span className="nat measured">LIVE INDEX</span></div>
        <div style={{ padding: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
          {(index?.manifests ?? []).map((lane) => (
            <div key={lane.source} className="panel-2 hairline" style={{ padding: 11, borderRadius: 5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <b style={{ fontSize: 11.5 }}>{lane.source}</b>
                <span className={'kb'} style={{
                  color: lane.status === 'ready' ? '#0b887e' : '#b7791f',
                  background: lane.status === 'ready' ? '#0FB5A61e' : '#f59e0b1e',
                }}>{lane.status === 'ready' ? 'READY' : 'AWAITING SOURCE'}</span>
              </div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', marginTop: 9 }}>
                {lane.records.toLocaleString()} records · {lane.dataClass}
              </div>
              <div className="mono" style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>{lane.path}</div>
            </div>
          ))}
          {!index && <div className="mono" style={{ color: 'var(--muted)', padding: 12 }}>Loading OSDU manifest index…</div>}
        </div>
      </div>
    </div>
  );
}

function OsduGovernance() {
  const classes = [
    ['public', 'data.public.viewers@arganta', 'arganta-public', 'public manifest'],
    ['internal', 'data.internal.viewers@arganta', 'arganta-internal', 'protected manifest'],
    ['confidential', 'data.confidential.viewers@arganta', 'arganta-confidential', 'restricted workflow'],
    ['restricted', 'data.restricted.viewers@arganta', 'arganta-restricted', 'explicit entitlement'],
  ];
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 14, display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(280px, .75fr)', gap: 12 }}>
      <div className="dq-panel">
        <div className="dq-phd"><LockKeyhole size={16} /> OSDU governance matrix <span className="nat measured">ENFORCED BEFORE INGESTION</span></div>
        <div style={{ overflow: 'auto' }}>
          <table className="qmatrix">
            <thead><tr><th>Data class</th><th>Viewer entitlement</th><th>LegalTag</th><th>Manifest lane</th></tr></thead>
            <tbody>
              {classes.map(([dataClass, viewers, legalTag, lane]) => (
                <tr key={dataClass}>
                  <td><span className="qpill qy">{dataClass}</span></td>
                  <td className="mono">{viewers}</td>
                  <td className="mono">{legalTag}</td>
                  <td>{lane}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="at-card">
          <div className="at-ch"><Layers3 size={12} /> Required record envelope</div>
          {[
            ['id', 'partition:type:native-id'],
            ['kind', 'authority:source:entity:version'],
            ['acl', 'owners + viewers'],
            ['legal', 'LegalTags + relevant countries'],
            ['ancestry', 'parent record IDs'],
            ['data', 'schema-validated payload'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: 8, padding: '6px 0', borderTop: '1px solid var(--line)' }}>
              <b className="mono" style={{ fontSize: 10, color: 'var(--teal)' }}>{k}</b>
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>{v}</span>
            </div>
          ))}
        </div>
        <div className="at-card">
          <div className="at-ch"><ShieldCheck size={12} /> Non-negotiable controls</div>
          {[
            'Scientific dataNature is independent from access dataClass.',
            'Internal enrichment links to public masters; it never mutates them.',
            'Native identifiers, source release, licence and units remain traceable.',
            'Schema and Storage services are the final ingestion release gate.',
            'Arganta extensions must be registered and versioned like OSDU schemas.',
          ].map((text) => <div key={text} className="mono" style={{ fontSize: 9.5, lineHeight: 1.5, padding: '5px 0', color: 'var(--muted)' }}>✓ {text}</div>)}
        </div>
      </div>
    </div>
  );
}

export function DataView() {
  const [sub, setSub] = useState<'overview' | 'catalogue' | 'model' | 'governance' | 'quality'>('overview');
  const [modelSrc, setModelSrc] = useState<'backbone' | 'volve'>('backbone');
  const [osduIndex, setOsduIndex] = useState<OsduPipelineIndex | null>(null);
  useEffect(() => {
    fetch('/osdu/index.json').then((r) => {
      if (!r.ok) throw new Error(`OSDU index ${r.status}`);
      return r.json();
    }).then(setOsduIndex).catch(() => setOsduIndex(null));
  }, []);
  const totalFk = RELATIONSHIPS.length;
  const totalRows = useMemo(() => TABLES.reduce((s, t) => s + t.rows, 0), []);
  const spineCount = spineOrdered().length;
  const modelBackbone = sub === 'model' && modelSrc === 'backbone';
  const extensionCount = spineOrdered().filter((e) => OSDU_KIND_BY_ENTITY[e.id]?.alignment === 'extension').length;
  const readyRecords = osduIndex?.manifests.reduce((sum, lane) => sum + lane.records, 0) ?? 0;
  const subtitle = sub === 'overview'
    ? `OSDU R3 · ${nFmt(readyRecords)} records · manifest ingestion`
    : sub === 'catalogue'
      ? `OSDU ${OSDU_DATA_DEFINITIONS.release} · ${spineCount - extensionCount} standard projections · ${extensionCount} extensions`
      : modelBackbone
        ? `OSDU backbone · ${spineCount - extensionCount} standard projections · ${extensionCount} Arganta extensions`
        : sub === 'model'
          ? `Volve · ${TABLES.length} tables · ${totalFk} FK · ${nFmt(totalRows)} rows`
          : sub === 'governance'
            ? 'ACL · LegalTag · data class · lineage'
            : 'OSDU ingestion gates · physical-data coverage';
  return (
    <div className="dm">
      <div className="dm-bar">
        <div className="dm-title">
          <span className="di"><Database size={15} /></span>
          <b>OSDU Data Platform</b>
          <span className="dm-sub">{subtitle}</span>
        </div>
        {sub === 'model' && (
          <div className="dm-srcseg">
            <div className={'sg' + (modelSrc === 'backbone' ? ' on' : '')} onClick={() => setModelSrc('backbone')}>OSDU backbone</div>
            <div className={'sg' + (modelSrc === 'volve' ? ' on' : '')} onClick={() => setModelSrc('volve')}>Volve tables (9)</div>
          </div>
        )}
        <div className="dm-prov"><span className="dot" /> {sub === 'model' && !modelBackbone ? 'OSDU PHYSICAL PROJECTION · evidence-native' : 'OSDU CANONICAL · ACL · LEGALTAG · LINEAGE'}</div>
      </div>
      <div className="dm-subtabs">
        <div className={'dm-subtab' + (sub === 'overview' ? ' on' : '')} onClick={() => setSub('overview')}><Workflow size={14} /> Overview</div>
        <div className={'dm-subtab' + (sub === 'catalogue' ? ' on' : '')} onClick={() => setSub('catalogue')}><Globe2 size={14} /> Catalogue</div>
        <div className={'dm-subtab' + (sub === 'model' ? ' on' : '')} onClick={() => setSub('model')}><Boxes size={14} /> Data Model</div>
        <div className={'dm-subtab' + (sub === 'governance' ? ' on' : '')} onClick={() => setSub('governance')}><LockKeyhole size={14} /> Governance</div>
        <div className={'dm-subtab' + (sub === 'quality' ? ' on' : '')} onClick={() => setSub('quality')}><TableProperties size={14} /> Quality &amp; Coverage</div>
      </div>
      {sub === 'overview' ? <OsduOverview index={osduIndex} />
        : sub === 'catalogue' ? <OsduCatalogue />
          : sub === 'model' ? (modelBackbone ? <OsduBackbone /> : <ModelCanvas />)
            : sub === 'governance' ? <OsduGovernance />
              : <QualityCoverage />}
    </div>
  );
}

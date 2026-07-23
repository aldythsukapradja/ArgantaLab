// ReportHub — the report hierarchy + rendered A4 preview, ported 1:1 from
// COSMO_Final.html (function ReportHub). Left rail: NORTH STAR (flat) + per-lifecycle
// KPI-parent/report-children groups (REPORT_TREE). Main: ribbon (orientation/zoom/
// actions) + a fit-width "page" mock (KPI tiles, bar chart, table, skeleton body).
import { useEffect, useRef, useState } from 'react';
import {
  Star, Layers, Activity, Gem, Drill, Gauge, CalendarClock, Diamond, Waves,
  ClipboardCheck, FileText, PanelsTopLeft, FilePen, Crosshair, CheckCheck, SquareCheck,
  TrendingUp, Radar, Hexagon, LineChart, CircleDot, Target, Check, Sparkles, Download,
} from 'lucide-react';
import { REPORT_TREE, ALL_REPORTS, KIND_BADGE, VERTICAL_NAMES, type ReportNode, type ReportGroup } from './report-types';

function reportIcon(name: string, size = 15) {
  switch (name) {
    case 'star': return <Star size={size} />;
    case 'target': return <Target size={size} />;
    case 'layers': return <Layers size={size} />;
    case 'activity': return <Activity size={size} />;
    case 'gem': return <Gem size={size} />;
    case 'drill': return <Drill size={size} />;
    case 'gauge': return <Gauge size={size} />;
    case 'calendar-clock': return <CalendarClock size={size} />;
    case 'diamond': return <Diamond size={size} />;
    case 'waves': return <Waves size={size} />;
    case 'clipboard-check': return <ClipboardCheck size={size} />;
    case 'file-text': return <FileText size={size} />;
    case 'panels-top-left': return <PanelsTopLeft size={size} />;
    case 'file-pen': return <FilePen size={size} />;
    case 'crosshair': return <Crosshair size={size} />;
    case 'check-check': return <CheckCheck size={size} />;
    case 'square-check': return <SquareCheck size={size} />;
    case 'trending-up': return <TrendingUp size={size} />;
    case 'radar': return <Radar size={size} />;
    case 'hexagon': return <Hexagon size={size} />;
    case 'line-chart': return <LineChart size={size} />;
    case 'circle-dot': return <CircleDot size={size} />;
    case 'gem-alt': return <Gem size={size} />;
    default: return <FileText size={size} />;
  }
}

export function ReportHub() {
  const [sel, setSel] = useState('scorecard');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'FIELD DEVELOPMENT': true, 'WELL DELIVERY': true, 'RESERVOIR MANAGEMENT': true, EXPLORATION: true });
  const [orient, setOrient] = useState<'portrait' | 'landscape'>('portrait');
  const [zoom, setZoom] = useState(1);
  const [box, setBox] = useState({ w: 900, h: 560 });
  const stageRef = useRef<HTMLDivElement>(null);
  const t: ReportNode = ALL_REPORTS.find((r) => r.id === sel) || ALL_REPORTS[0];
  const grp: ReportGroup | undefined = REPORT_TREE.find((g) => (g.kpi && g.kpi.id === sel) || g.reports.some((r) => r.id === sel));

  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const par = orient === 'portrait' ? 8.27 / 11.69 : 11.69 / 8.27;
  const availW = Math.max(240, box.w - 40);
  const w = Math.min(availW, 820 * zoom); const h = w / par;
  const toggle = (g: string) => setExpanded((e) => ({ ...e, [g]: !e[g] }));
  const badge = KIND_BADGE[t.kind] || KIND_BADGE.doc;

  return (
    <div className="tpl-wrap">
      <aside className="tpl-rail" style={{ display: 'block' }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, letterSpacing: '.14em', color: 'var(--ink3)', margin: '2px 4px 8px', fontWeight: 600 }}>REPORT HIERARCHY</div>
        {REPORT_TREE.map((g) => {
          if (g.group === 'NORTH STAR') {
            return (
              <div key={g.group}>
                <div className="rt-grouphd"><span className="gi" style={{ background: g.c }}>{reportIcon(g.icon, 11)}</span>{g.group}</div>
                {g.reports.map((r) => (
                  <div className={'rt-kpi rt-star ' + (sel === r.id ? 'on' : '')} key={r.id} onClick={() => setSel(r.id)}>
                    <span className="ki" style={{ background: r.c }}>{reportIcon(r.icon, 15)}</span>
                    <div><div className="kn">{r.name}</div><div className="ks">{r.owner} · {r.freq}</div></div>
                  </div>
                ))}
              </div>
            );
          }
          const open = expanded[g.group];
          return (
            <div key={g.group}>
              <div className="rt-grouphd"><span className="gi" style={{ background: g.c }}>{reportIcon(g.icon, 11)}</span>{g.group}</div>
              <div className={'rt-kpi ' + (open ? 'exp ' : '') + (sel === g.kpi!.id ? 'on' : '')} onClick={() => { setSel(g.kpi!.id); toggle(g.group); }}>
                <span className="ki" style={{ background: g.kpi!.c }}>{reportIcon(g.kpi!.icon, 15)}</span>
                <div><div className="kn">{g.kpi!.name}</div><div className="ks">{g.kpi!.owner} · {g.kpi!.freq}</div></div>
                <span className="kchev">▸</span>
              </div>
              {open && g.reports.map((r) => (
                <div className={'rt-child ' + (sel === r.id ? 'on' : '')} key={r.id} onClick={() => setSel(r.id)}>
                  <span className="ci" style={{ background: r.c + '22', color: r.c }}>{reportIcon(r.icon, 11)}</span>{r.name}
                  <span className="cfreq">{r.freq}</span>
                </div>
              ))}
            </div>
          );
        })}
      </aside>

      <div className="tpl-main">
        <div className="ribbon" style={{ margin: 0, borderRadius: 0, border: 'none', borderBottom: '1px solid var(--line)' }}>
          <div className="rgrp">
            <div className="rt-crumb">{grp ? grp.group : ''}<span> / </span><b>{t.name}</b></div>
            <span className="tpl-badge" style={{ background: badge[1] }}>{badge[0]}</span>
          </div>
          <div className="rgrp">
            <div className="rseg" title="Orientation">
              <b className={orient === 'portrait' ? 'on' : ''} onClick={() => setOrient('portrait')}>▯ Portrait</b>
              <b className={orient === 'landscape' ? 'on' : ''} onClick={() => setOrient('landscape')}>▭ Landscape</b>
            </div>
            <div className="rzoom">
              <button onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}>−</button>
              <span className="zv">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>＋</button>
              <button onClick={() => setZoom(1)} title="Fit">⤢</button>
            </div>
          </div>
          <div className="rgrp"><button className="rbtn"><Sparkles size={13} /> Ask Arganta</button><button className="rbtn"><Check size={13} /> Approve</button><button className="rbtn p"><Download size={13} /> Export</button></div>
        </div>

        <div className="tpl-doc-scroll" ref={stageRef}>
          <div className="tpl-page fadein" key={t.id + orient} style={{ width: w, minHeight: h, fontSize: 13 * Math.min(1.2, w / 820) }}>
            <div className="tph">
              <div><div className="co">ArgantaEnergy · Volve · Confidential</div><div className="tt">{t.name}</div></div>
              <div className="dt">Volve field<br />22 Jul 2026 · {t.owner}<br />{t.freq} · {orient} · A4</div>
            </div>
            <div className="tpl-kpis">
              {t.kpis.map((k) => <div className="tpl-kpi" key={k[0]}><div className="k">{k[0]}</div><div className="v">{k[1]}</div><div className="s">{k[2]}</div></div>)}
            </div>
            <div className="tpl-sec">{t.kind === 'scorecard' ? 'Field scorecard' : t.kind === 'kpi' ? 'KPIs vs plan' : t.kind === 'daily' ? '24-hour trend' : 'Trend'}</div>
            <div className="tpl-bars">{[52, 68, 61, 74, 58, 80, 66, 72, 63].map((v, x) => <i key={x} style={{ height: v + '%' }} />)}</div>
            <div className="tpl-sec">{t.kind === 'scorecard' ? 'Lifecycle breakdown' : t.id === 'ddr' ? 'Operations log' : t.id === 'prod' || t.id === 'welltest' ? 'Well summary' : 'Summary'}</div>
            <table className="tpl-tbl">
              <thead><tr>{(t.kind === 'scorecard' ? ['Lifecycle', 'KPI', 'Actual', 'Plan', 'Status'] : t.id === 'ddr' ? ['Well', 'Depth', 'ROP', 'NPT', 'Status'] : ['Item', 'Value', 'Target', 'Δ', 'Status']).map((hh) => <th key={hh}>{hh}</th>)}</tr></thead>
              <tbody>
                {(t.kind === 'scorecard' ? VERTICAL_NAMES : [0, 1, 2, 3, 4]).map((r, ri) => (
                  <tr key={ri}>
                    <td>{t.kind === 'scorecard' ? r : '—'}</td>
                    {[1, 2, 3, 4].map((c) => <td key={c}>{c === 4 ? <Check size={12} style={{ color: '#16a34a' }} /> : '···'}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="tpl-sec">{t.desc}</div>
            <div className="tpl-sk s85" /><div className="tpl-sk" /><div className="tpl-sk s70" /><div className="tpl-sk s50" />
          </div>
        </div>
        <div className="statusbar">
          <span>{grp ? grp.group : ''} · {t.name}</span><span>owner: {t.owner}</span><span>{t.freq} · {orient} · A4</span>
          <span className="sp" /><span>{Math.round(zoom * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

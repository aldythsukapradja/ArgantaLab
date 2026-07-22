// ReportManager — the corporate document-controller / working-folder explorer, ported
// 1:1 from COSMO_Final.html (function ReportManager). Left rail: lifecycle departments +
// quick access. Main: search/grid/list toolbar, grouped-by-class file browser (or the
// pan/zoom DataMapOrgChart when viewing "All Documents" with no search), and a note
// preview modal (MdCanvas-equivalent).
import { useState } from 'react';
import {
  Database, Star, Compass, Layers, Drill, Gauge, CalendarClock, Clock, Flame, GitFork,
  Search, LayoutGrid, List, Plus, X, BookMarked, FileText, MonitorPlay, Sparkles,
} from 'lucide-react';
import { DEPARTMENTS, FILES, PR_META, CLS_META, fileIcon, type FileRow, type Department, MdBody } from './report-types';
import { DataMapOrgChart } from './DataMapOrgChart';

function deptIcon(d: Department, size = 15) {
  switch (d.icon) {
    case 'database': return <Database size={size} />;
    case 'star': return <Star size={size} />;
    case 'compass': return <Compass size={size} />;
    case 'layers': return <Layers size={size} />;
    case 'drill': return <Drill size={size} />;
    case 'gauge': return <Gauge size={size} />;
    case 'calendar-clock': return <CalendarClock size={size} />;
    default: return <Database size={size} />;
  }
}
function clsIcon(name: string, size = 13) {
  return name === 'book-marked' ? <BookMarked size={size} /> : <Sparkles size={size} />;
}
function typeIcon(name: string, size = 26) {
  switch (name) {
    case 'book-marked': return <BookMarked size={size} />;
    case 'file-text': return <FileText size={size} />;
    case 'monitor-play': return <MonitorPlay size={size} />;
    case 'database': return <Database size={size} />;
    default: return <Sparkles size={size} />;
  }
}
const QUICK = [['star', 'Starred'], ['clock', 'Recent'], ['flame', 'P1 · extract first'], ['git-fork', 'Data map']] as const;
function quickIcon(name: string) {
  switch (name) {
    case 'star': return <Star size={14} />;
    case 'clock': return <Clock size={14} />;
    case 'flame': return <Flame size={14} />;
    case 'git-fork': return <GitFork size={14} />;
    default: return <Star size={14} />;
  }
}

export function ReportManager({ goTab }: { goTab: (tab: string) => void }) {
  const [dept, setDept] = useState('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<FileRow | null>(null);
  const deptObj = DEPARTMENTS.find((d) => d.id === dept) || DEPARTMENTS[0];
  const files = FILES.filter((f) => (dept === 'all' || f.dept === dept) && (!q || (f.name + f.title).toLowerCase().includes(q.toLowerCase())));
  const deptCount = (id: string) => (id === 'all' ? FILES.length : FILES.filter((f) => f.dept === id).length);
  const prChip = (pr: string) => { const m = PR_META[pr]; return <span className="prpill" style={{ color: m[0], borderColor: m[0] }}>{pr}</span>; };
  const fileCard = (f: FileRow) => {
    const m = fileIcon(f);
    return (
      <div className="filecard" key={f.name} title={f.name} onClick={() => setOpen(f)}>
        <div className="thumb" style={{ background: m[1] + '12', color: m[1] }}><span className="tag" style={{ background: m[1] }}>{f.fmt}</span>{typeIcon(m[0], 26)}</div>
        <div className="meta"><div className="fnm">{f.title}</div><div className="fsub"><span>{f.by}</span>{prChip(f.pr)}</div></div>
      </div>
    );
  };

  const std = files.filter((f) => f.cls === 'standard');
  const gen = files.filter((f) => f.cls === 'generated');
  const groupBy = (arr: FileRow[], key: 'theme' | 'fmt') => { const g: Record<string, FileRow[]> = {}; arr.forEach((f) => { (g[f[key]] = g[f[key]] || []).push(f); }); return g; };
  const section = (cls: 'standard' | 'generated', label: string, arr: FileRow[], key: 'theme' | 'fmt') => {
    if (!arr.length) return null;
    const cm = CLS_META[cls]; const groups = groupBy(arr, key);
    return (
      <div key={cls}>
        <div className="dc-clshd"><span className="ci" style={{ background: cm[1] }}>{clsIcon(cm[0], 13)}</span>{label}<span className="dc-clsn">{arr.length}</span></div>
        {Object.entries(groups).map(([g, items]) => (
          <div key={g}>
            <div className="dc-sech">{g} · {items.length}</div>
            {view === 'grid' ? (
              <div className="dc-grid">{items.map(fileCard)}</div>
            ) : (
              <table className="dc-list"><tbody>
                {items.map((f) => { const m = fileIcon(f); return (
                  <tr key={f.name} onClick={() => setOpen(f)}>
                    <td><span className="nm"><span style={{ color: m[1] }}>{typeIcon(m[0], 15)}</span>{f.title} <span className="fmt-tag">{f.fmt}</span></span></td>
                    <td>{f.by}</td><td>{prChip(f.pr)}</td>
                  </tr>
                ); })}
              </tbody></table>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="dc fadein">
      <aside className="dc-side">
        <div className="dc-sh">LIFECYCLE DEPARTMENTS</div>
        {DEPARTMENTS.map((d) => (
          <div className={'dc-fold ' + (dept === d.id ? 'on' : '')} key={d.id} onClick={() => setDept(d.id)}>
            <span className="fi" style={{ background: d.c + '1e', color: d.c }}>{deptIcon(d, 15)}</span>{d.name}
            <span className="cnt">{deptCount(d.id)}</span>
          </div>
        ))}
        <div className="dc-sh">QUICK ACCESS</div>
        {QUICK.map((x) => (
          <div className="dc-fold" key={x[0]}><span className="fi" style={{ background: 'var(--line2)' }}>{quickIcon(x[0])}</span>{x[1]}</div>
        ))}
      </aside>
      <div className="dc-main">
        <div className="dc-bar">
          <div className="dc-crumb">Data Map<span className="sep">/</span><b style={{ color: deptObj.c }}>{deptObj.name}</b></div>
          <div className="dc-search"><Search size={14} style={{ color: 'var(--ink3)' }} /><input placeholder="Search the corporate data map…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="dc-view">
            <b className={view === 'grid' ? 'on' : ''} onClick={() => setView('grid')} title="Grid"><LayoutGrid size={14} /></b>
            <b className={view === 'list' ? 'on' : ''} onClick={() => setView('list')} title="List"><List size={14} /></b>
          </div>
          <button className="wbtn"><Plus size={13} /> New note</button>
          <button className="wbtn" onClick={() => goTab('Report')}>Hierarchy ▾</button>
        </div>

        {dept === 'all' && !q ? (
          <div className="dc-body" style={{ padding: 12, display: 'flex', minHeight: 0 }}>
            <DataMapOrgChart onOpen={setOpen} key="org" />
          </div>
        ) : (
          <div className="dc-body">
            {q ? (
              <><div className="dc-sech">Search results · {files.length}</div><div className="dc-grid">{files.map(fileCard)}</div></>
            ) : (
              <>{section('standard', 'Knowledge Base · standards (.md)', std, 'theme')}{section('generated', 'Cosmo Generated · by type', gen, 'fmt')}</>
            )}
            <div className="note"><Flame size={13} /><span>Standards are .md knowledge-base minimum-requirement docs; reports, presentations & datasets are Cosmo-generated outputs. Concept only.</span></div>
          </div>
        )}
      </div>

      <div className={'modal-scrim ' + (open ? 'on' : '')} onClick={() => setOpen(null)}>
        <div className="modal" style={{ width: 'min(760px,95vw)', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
          <div className="modal-hd">
            <div className="mi" style={open ? { background: fileIcon(open)[1] + '1e', color: fileIcon(open)[1] } : undefined}>{open && typeIcon(fileIcon(open)[0], 18)}</div>
            <div><h2>{open ? open.title : ''}</h2><div className="ms">{open ? open.name + ' · ' + (open.cls === 'standard' ? 'knowledge-base standard' : 'Cosmo-generated ' + open.fmt) : ''}</div></div>
            <button className="mx" onClick={() => setOpen(null)}><X size={15} /></button>
          </div>
          <div className="modal-body" style={{ padding: 0 }}>
            {open && <div className="obs-scroll" style={{ padding: 14 }}><div className="obs fadein"><MdBody md={open.md} /><div className="obs-tag"><FileText size={11} /> markdown canvas · rendered placeholder · no build</div></div></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

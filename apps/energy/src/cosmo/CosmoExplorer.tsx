// CosmoExplorer — the Petrel 11-folder data tree for Field Development, COSMO-skinned
// (cosmo-fd.css), from real Volve/wb data. Folders: Wells · Formation Tops · Markers ·
// Custom Tops · Points · Polylines · Polygons · Cross Sections · Maps · Contacts ·
// Volumetric Cases. Each: caret · icon · label · count · add; each node: eye · icon ·
// label · sub. Selection lifted to the workspace (canvas/inspector binding, later).
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, Plus, Eye, EyeOff, Database, Layers, MapPin, Spline, Hexagon,
  Columns3, Map as MapIcon, Waves, Box, Bookmark, PenLine, Gauge,
} from 'lucide-react';
import { loadIndex } from '../wb/load';
import type { WbIndex } from '../wb/types';

export type Sel = { folder: string; id: string } | null;

function Node({ icon: Ic, color, label, sub, on, vis, onVis, onClick }: {
  icon: typeof MapPin; color?: string; label: string; sub?: string; on: boolean; vis: boolean; onVis: () => void; onClick: () => void;
}) {
  return (
    <div className={'node' + (on ? ' sel' : '')} onClick={onClick}>
      <span className={'eye' + (vis ? ' on' : '')} onClick={(e) => { e.stopPropagation(); onVis(); }}>{vis ? <Eye size={13} /> : <EyeOff size={13} />}</span>
      <span className="nicon" style={{ color: color || 'var(--ink3)' }}><Ic size={13} /></span>
      <span className="nlbl">{label}{sub && <span className="nsub"> · {sub}</span>}</span>
    </div>
  );
}
function Folder({ icon: Ic, title, count, open, onToggle, onAdd, children }: {
  icon: typeof MapPin; title: string; count: number; open: boolean; onToggle: () => void; onAdd?: () => void; children?: React.ReactNode;
}) {
  const has = count > 0;
  return (
    <div className={'folder' + (has ? '' : ' empty-folder')}>
      <div className="fhead" onClick={has ? onToggle : undefined}>
        <span className="caret">{has ? <ChevronRight size={13} className={'chev' + (open ? ' open' : '')} /> : <span className="cdot" />}</span>
        <span className="ficon"><Ic size={15} /></span>
        <span className="ftitle">{title}</span>
        {onAdd && <span className="fadd" title="Add" onClick={(e) => { e.stopPropagation(); onAdd(); }}><Plus size={13} /></span>}
        <span className={'fcount' + (has ? ' has' : '')}>{count}</span>
      </div>
      {has && open && <div className="fchildren">{children}</div>}
    </div>
  );
}

export function CosmoExplorer({ sel, setSel }: { sel: Sel; setSel: (s: Sel) => void }) {
  const [idx, setIdx] = useState<WbIndex | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ wells: true, contacts: true, maps: true });
  const [vis, setVis] = useState<Record<string, boolean>>({});
  useEffect(() => { loadIndex().then(setIdx).catch(() => setIdx(null)); }, []);
  const tg = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const vok = (id: string) => vis[id] !== false;
  const flip = (id: string) => setVis((v) => ({ ...v, [id]: v[id] === false ? true : false }));
  const isSel = (f: string, id: string) => !!sel && sel.folder === f && sel.id === id;
  const wells = idx?.wells ?? [];
  const contacts = idx?.contacts ?? [];
  const surfaces = useMemo(() => (idx?.surfaces ?? []) as Array<{ id?: string; name?: string }>, [idx]);
  const roleCol = (r?: string) => (r === 'injector' ? 'var(--cblue)' : r === 'producer' ? 'var(--green)' : 'var(--ink3)');

  return (
    <div className="fd-explorer">
      <div className="exh"><Database size={14} /> Explorer</div>
      <div className="fdt">
        <Folder icon={Waves} title="Wells" count={wells.length} open={!!open.wells} onToggle={() => tg('wells')} onAdd={() => {}}>
          {wells.map((w) => <Node key={w.name} icon={Waves} color={roleCol(w.role)} label={w.name} sub={w.role} on={isSel('wells', w.name)} vis={vok('w:' + w.name)} onVis={() => flip('w:' + w.name)} onClick={() => setSel({ folder: 'wells', id: w.name })} />)}
          {!wells.length && <div className="empty">Loading…</div>}
        </Folder>
        <Folder icon={Layers} title="Formation Tops" count={0} open={!!open.ftops} onToggle={() => tg('ftops')} onAdd={() => {}} />
        <Folder icon={Bookmark} title="Marker Collections" count={0} open={!!open.markers} onToggle={() => tg('markers')} onAdd={() => {}} />
        <Folder icon={PenLine} title="Custom Tops" count={0} open={!!open.ctops} onToggle={() => tg('ctops')} />
        <Folder icon={MapPin} title="Points" count={0} open={!!open.pts} onToggle={() => tg('pts')} onAdd={() => {}} />
        <Folder icon={Spline} title="Polylines" count={0} open={!!open.plines} onToggle={() => tg('plines')} onAdd={() => {}} />
        <Folder icon={Hexagon} title="Polygons" count={0} open={!!open.polys} onToggle={() => tg('polys')} onAdd={() => {}} />
        <Folder icon={Columns3} title="Cross Sections" count={0} open={!!open.sections} onToggle={() => tg('sections')} onAdd={() => {}} />
        <Folder icon={MapIcon} title="Maps" count={surfaces.length} open={!!open.maps} onToggle={() => tg('maps')} onAdd={() => {}}>
          {surfaces.map((s, i) => <Node key={(s.id || s.name || i) as string} icon={MapIcon} color="var(--purple)" label={(s.name || s.id || 'surface') as string} sub="depth surface" on={isSel('maps', String(s.id || s.name || i))} vis={vok('s:' + i)} onVis={() => flip('s:' + i)} onClick={() => setSel({ folder: 'maps', id: String(s.id || s.name || i) })} />)}
        </Folder>
        <Folder icon={Box} title="Contacts" count={contacts.length} open={!!open.contacts} onToggle={() => tg('contacts')} onAdd={() => {}}>
          {contacts.map((c, i) => { const cid = (c.kind || 'contact') + ':' + i; const col = c.kind === 'GOC' ? 'var(--red)' : c.kind === 'GWC' ? 'var(--cblue)' : 'var(--green)'; return <Node key={cid} icon={Box} color={col} label={c.kind || 'OWC'} sub={c.tvdss != null ? c.tvdss + 'm' : ''} on={isSel('contacts', cid)} vis={vok('c:' + i)} onVis={() => flip('c:' + i)} onClick={() => setSel({ folder: 'contacts', id: cid })} />; })}
        </Folder>
        <Folder icon={Gauge} title="Volumetric Cases" count={0} open={!!open.vc} onToggle={() => tg('vc')} />
      </div>
    </div>
  );
}

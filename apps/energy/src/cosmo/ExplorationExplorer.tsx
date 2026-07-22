// ExplorationExplorer — the Exploration data tree (COSMO-skinned, cosmo-fd.css),
// the play-fairway analogue of CosmoExplorer's Petrel tree. Folders: Plays ·
// Prospects & Leads · Exploration Wells · Petroleum System · Stratigraphy · Depth
// Surfaces — over the real Volve wb data + the grounded explData. Selection is lifted
// to the shell so the active viewer can bind to a prospect / well / element.
import { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, Plus, Eye, EyeOff, Compass, Gem, Crosshair, Waves, Droplet,
  Layers, Map as MapIcon,
} from 'lucide-react';
import { loadIndex } from '../wb/load';
import type { WbIndex } from '../wb/types';
import { PROSPECTS, STRAT_COLUMN, PS_EVIDENCE } from '../tabs/exploration/explData';
import { GCOS_ELEMENTS } from '../engine/explore';

export type ExplSel = { folder: string; id: string } | null;

const roleColor: Record<string, string> = {
  source: 'var(--red)', reservoir: 'var(--green)', seal: 'var(--amber)',
  overburden: 'var(--ink3)', none: 'var(--ink3)',
};
const statusColor: Record<string, string> = {
  discovery: 'var(--green)', prospect: 'var(--cyan)', lead: 'var(--amber)',
};

function Node({ icon: Ic, color, label, sub, on, vis, onVis, onClick }: {
  icon: typeof Compass; color?: string; label: string; sub?: string; on: boolean; vis: boolean; onVis: () => void; onClick: () => void;
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
  icon: typeof Compass; title: string; count: number; open: boolean; onToggle: () => void; onAdd?: () => void; children?: React.ReactNode;
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

export function ExplorationExplorer({ sel, setSel }: { sel: ExplSel; setSel: (s: ExplSel) => void }) {
  const [idx, setIdx] = useState<WbIndex | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ prospects: true, wells: true, ps: true });
  const [vis, setVis] = useState<Record<string, boolean>>({});
  useEffect(() => { loadIndex().then(setIdx).catch(() => setIdx(null)); }, []);
  const tg = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const vok = (id: string) => vis[id] !== false;
  const flip = (id: string) => setVis((v) => ({ ...v, [id]: v[id] === false ? true : false }));
  const isSel = (f: string, id: string) => !!sel && sel.folder === f && sel.id === id;

  const explWells = useMemo(() => (idx?.wells ?? []).filter((w) => w.is_exploration), [idx]);
  const surfaces = useMemo(() => (idx?.surfaces ?? []) as Array<{ id?: string; name?: string }>, [idx]);
  const reservoirs = STRAT_COLUMN.filter((s) => s.role === 'reservoir').length;

  return (
    <div className="fd-explorer">
      <div className="exh"><Compass size={14} /> Exploration</div>
      <div className="fdt">
        <Folder icon={Gem} title="Plays" count={1} open={!!open.plays} onToggle={() => tg('plays')} onAdd={() => {}}>
          <Node icon={Gem} color="var(--cyan)" label="Middle Jurassic Hugin" sub="Sleipner Terrace"
            on={isSel('plays', 'hugin')} vis={vok('play:hugin')} onVis={() => flip('play:hugin')} onClick={() => setSel({ folder: 'plays', id: 'hugin' })} />
        </Folder>

        <Folder icon={Crosshair} title="Prospects & Leads" count={PROSPECTS.length} open={!!open.prospects} onToggle={() => tg('prospects')} onAdd={() => {}}>
          {PROSPECTS.map((p) => (
            <Node key={p.id} icon={Crosshair} color={statusColor[p.status]} label={p.name} sub={p.status}
              on={isSel('prospects', p.id)} vis={vok('p:' + p.id)} onVis={() => flip('p:' + p.id)} onClick={() => setSel({ folder: 'prospects', id: p.id })} />
          ))}
        </Folder>

        <Folder icon={Waves} title="Exploration Wells" count={explWells.length} open={!!open.wells} onToggle={() => tg('wells')} onAdd={() => {}}>
          {explWells.map((w) => (
            <Node key={w.name} icon={Waves} color="var(--green)" label={'15/9-' + w.name} sub="wildcat"
              on={isSel('wells', w.name)} vis={vok('w:' + w.name)} onVis={() => flip('w:' + w.name)} onClick={() => setSel({ folder: 'wells', id: w.name })} />
          ))}
          {!explWells.length && <div className="empty">Loading…</div>}
        </Folder>

        <Folder icon={Droplet} title="Petroleum System" count={GCOS_ELEMENTS.length} open={!!open.ps} onToggle={() => tg('ps')}>
          {GCOS_ELEMENTS.map((el) => (
            <Node key={el.key} icon={Droplet} color="var(--purple)" label={el.label} sub={PS_EVIDENCE[el.key].nature}
              on={isSel('ps', el.key)} vis={vok('ps:' + el.key)} onVis={() => flip('ps:' + el.key)} onClick={() => setSel({ folder: 'ps', id: el.key })} />
          ))}
        </Folder>

        <Folder icon={Layers} title="Stratigraphy" count={STRAT_COLUMN.length} open={!!open.strat} onToggle={() => tg('strat')}>
          {STRAT_COLUMN.map((s) => (
            <Node key={s.name} icon={Layers} color={roleColor[s.role]} label={s.name} sub={s.role === 'none' ? s.env : s.role}
              on={isSel('strat', s.name)} vis={vok('st:' + s.name)} onVis={() => flip('st:' + s.name)} onClick={() => setSel({ folder: 'strat', id: s.name })} />
          ))}
        </Folder>

        <Folder icon={MapIcon} title="Depth Surfaces" count={surfaces.length} open={!!open.maps} onToggle={() => tg('maps')} onAdd={() => {}}>
          {surfaces.map((s, i) => (
            <Node key={(s.id || s.name || i) as string} icon={MapIcon} color="var(--purple)" label={(s.name || s.id || 'surface') as string} sub="depth surface"
              on={isSel('maps', String(s.id || s.name || i))} vis={vok('s:' + i)} onVis={() => flip('s:' + i)} onClick={() => setSel({ folder: 'maps', id: String(s.id || s.name || i) })} />
          ))}
          {!surfaces.length && <div className="empty">Loading…</div>}
        </Folder>

        <div style={{ padding: '8px 10px', fontSize: 9.5, color: 'var(--ink3)', lineHeight: 1.5 }}>
          {reservoirs} reservoir units · real Volve wb data · pre-drill cases are <b style={{ color: 'var(--amber)' }}>scenario</b>.
        </div>
      </div>
    </div>
  );
}

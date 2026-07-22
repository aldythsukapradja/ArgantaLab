// ReservoirExplorer — the exception-first Reservoir-Management tree: Field → Patterns
// (each injector + its nearest producers) → Wells, plus a flat Producers / Injectors
// grouping. Each producer carries a health dot (green/amber/red from latest water cut +
// uptime). Selecting a well/pattern sets the shared focus (selection.ts) that the canvas
// tabs highlight. COSMO-skinned (reuses cosmo-fd.css .fd-explorer/.node/.folder).
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Gauge, Waves, Droplets, GitMerge, Database } from 'lucide-react';
import { loadRMData, type RMData, type RMWellSeries } from './data';
import { setSelection, useSelection } from './selection';

const roleCol = (r?: string) => (r === 'injector' ? 'var(--cblue)' : r === 'both' ? 'var(--purple)' : 'var(--green)');
function healthDot(w: RMWellSeries): string {
  const wct = w.wct.length ? w.wct[w.wct.length - 1] : 0;
  const up = w.uptime.filter((v): v is number => v != null);
  const uptime = up.length ? up[up.length - 1] : 1;
  if (wct > 90 || uptime < 0.5) return 'var(--red)';
  if (wct > 70 || uptime < 0.8) return 'var(--orange)';
  return 'var(--green)';
}

function Node({ color, label, sub, dot, on, onClick }: {
  color?: string; label: string; sub?: string; dot?: string; on: boolean; onClick: () => void;
}) {
  return (
    <div className={'node' + (on ? ' sel' : '')} onClick={onClick}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, flex: 'none', marginLeft: 2 }} />}
      <span className="nicon" style={{ color: color || 'var(--ink3)' }}><Waves size={13} /></span>
      <span className="nlbl">{label}{sub && <span className="nsub"> · {sub}</span>}</span>
    </div>
  );
}
function Folder({ icon: Ic, title, count, open, onToggle, children }: {
  icon: typeof Gauge; title: string; count: number; open: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  const has = count > 0;
  return (
    <div className={'folder' + (has ? '' : ' empty-folder')}>
      <div className="fhead" onClick={has ? onToggle : undefined}>
        <span className="caret">{has ? <ChevronRight size={13} className={'chev' + (open ? ' open' : '')} /> : <span className="cdot" />}</span>
        <span className="ficon"><Ic size={15} /></span>
        <span className="ftitle">{title}</span>
        <span className={'fcount' + (has ? ' has' : '')}>{count}</span>
      </div>
      {has && open && <div className="fchildren">{children}</div>}
    </div>
  );
}

export function ReservoirExplorer() {
  const [data, setData] = useState<RMData | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({ field: true, patterns: true, prod: true });
  const sel = useSelection();
  useEffect(() => { loadRMData().then(setData).catch(() => setData(null)); }, []);
  const tg = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const patterns = data?.patterns.patterns ?? [];
  const producers = useMemo(() => data?.producers ?? [], [data]);
  const injectors = useMemo(() => data?.injectors ?? [], [data]);

  return (
    <div className="fd-explorer">
      <div className="exh"><Database size={14} /> Reservoir</div>
      <div className="fdt">
        <Folder icon={Gauge} title="Field · VOLVE" count={1} open={!!open.field} onToggle={() => tg('field')}>
          <Node label="Hugin Fm" sub="reservoir" on={sel.pattern === 'field'} onClick={() => setSelection({ pattern: 'field', well: null })} />
        </Folder>
        <Folder icon={GitMerge} title="Patterns" count={patterns.length} open={!!open.patterns} onToggle={() => tg('patterns')}>
          {patterns.map((p) => (
            <div key={p.injector}>
              <Node color="var(--cblue)" label={p.injector} sub="injector" dot="var(--cblue)" on={sel.pattern === p.injector} onClick={() => setSelection({ pattern: p.injector, well: p.injector })} />
              {p.producers.map((pr) => <div key={pr.well} style={{ marginLeft: 14 }}><Node color="var(--green)" label={pr.well} sub={pr.distM + ' m'} on={sel.well === pr.well} onClick={() => setSelection({ well: pr.well, pattern: p.injector })} /></div>)}
            </div>
          ))}
        </Folder>
        <Folder icon={Waves} title="Producers" count={producers.length} open={!!open.prod} onToggle={() => tg('prod')}>
          {producers.map((w) => <Node key={w.well} color={roleCol(w.role)} label={w.well} sub={(w.wct.length ? w.wct[w.wct.length - 1].toFixed(0) : '0') + '% wct'} dot={healthDot(w)} on={sel.well === w.well} onClick={() => setSelection({ well: w.well, pattern: null })} />)}
        </Folder>
        <Folder icon={Droplets} title="Injectors" count={injectors.length} open={!!open.inj} onToggle={() => tg('inj')}>
          {injectors.map((w) => <Node key={w.well} color="var(--cblue)" label={w.well} sub="injector" dot="var(--cblue)" on={sel.well === w.well} onClick={() => setSelection({ well: w.well, pattern: null })} />)}
        </Folder>
        {!data && <div className="empty">Loading…</div>}
      </div>
    </div>
  );
}

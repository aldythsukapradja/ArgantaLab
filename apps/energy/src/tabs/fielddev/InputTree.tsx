// InputTree — Petrel's Input pane for Field Development.
//
// One tree, mounted once by the shell and shared by all nine workflow stages. It
// does not re-mount when you change stage; what changes is which folders are LIVE.
// Folders a stage cannot act on grey back rather than disappearing, so the data
// model you are working against stays constant while the task changes — which is
// exactly what Petrel does and why its tree is navigable.
//
// Structure follows Petrel's Input pane:
//
//   Global well logs     curve TYPES, shared across wells (not per-well instances)
//   Well tops            the pick sets
//   Wells                Producers · Injectors · Water supply · Observation ·
//                        Exploration · Appraisal · Abandoned · Unclassified
//                          └ each well: Trajectory · Local logs · Picks ·
//                            Production · Drilling · Pressure — only what it HAS
//   Surfaces             the ingested depth grids
//   Contacts             OWC/GOC/GWC
//   Points/Polylines/Polygons/Cross sections/Simulation cases
//
// Every count is real. Folders with nothing behind them show 0 and do not expand —
// they are containers waiting for a delivery, never a fabricated node.
import { useEffect, useMemo, useState } from 'react';
import {
  Box, ChevronRight, Columns3, Database, Eye, EyeOff, FolderTree, Gauge, Hexagon,
  Layers, Map as MapIcon, MapPin, Radio, Route, Spline, Waves,
} from 'lucide-react';
import { loadIndex } from '../../wb/load';
import type { WbIndex, WellRow } from '../../wb/types';
import { listAssets } from '../../dataqc/db';
import type { IngestedAsset } from '../../dataqc/types';
import { useScene, isVisible } from './scene';
import { useInterp, interpNodeId } from './interp-store';
import { featureMeasure, type FeatureKind } from './interpret';

/** The four Input folders the drawing tools write into. `point`, `obs` and
 *  `well` share the Points folder — one geometry, different intent, and each
 *  row already carries its own name. Mirrors FOLDER_OF in interp-store. */
const DRAWN_FOLDERS: Array<{ folder: string; label: string; icon: typeof MapPin; kinds: FeatureKind[] }> = [
  { folder: 'points', label: 'Points', icon: MapPin, kinds: ['point', 'obs', 'well'] },
  { folder: 'polylines', label: 'Polylines', icon: Spline, kinds: ['polyline'] },
  { folder: 'polygons', label: 'Polygons', icon: Hexagon, kinds: ['polygon'] },
  { folder: 'sections', label: 'Cross sections', icon: Columns3, kinds: ['section'] },
];

/** Which Input folders each workflow stage actually acts on. Everything else greys.
 *  Keyed by the stage ids in workflow.ts. */
const STAGE_FOLDERS: Record<string, string[]> = {
  'client-data-qc': ['logs', 'tops', 'wells', 'surfaces', 'contacts', 'points', 'polylines', 'polygons', 'sections', 'cases'],
  'petrophysics-lite': ['logs', 'tops', 'wells'],
  'static-model-lite': ['surfaces', 'contacts', 'wells', 'polygons', 'points'],
  'fluids-rock': ['contacts', 'wells'],
  'simulation-cases': ['cases', 'wells', 'surfaces'],
  'history-uncertainty': ['cases', 'wells'],
  'recovery-wells': ['wells', 'surfaces', 'polygons'],
  'forecast-phasing': ['wells', 'cases'],
  'value-fdp': ['cases'],
};

/** Petrel's Wells folder is user-organised; ours is derived from the NPD role and
 *  purpose the bundle already carries. `water-supply` is deliberately its own bucket:
 *  a water-supply well is not an injector into the reservoir. */
const WELL_BUCKETS: Array<{ id: string; label: string; match: (w: WellRow) => boolean }> = [
  { id: 'producers', label: 'Producers', match: (w) => /oil[-_ ]?produc/i.test(String(w.role)) },
  { id: 'injectors', label: 'Injectors', match: (w) => /^water-injector$/i.test(String(w.role)) },
  { id: 'supply', label: 'Water supply', match: (w) => /^water-supply$/i.test(String(w.role)) },
  { id: 'observation', label: 'Observation', match: (w) => /^observation$/i.test(String(w.role)) },
  { id: 'exploration', label: 'Exploration', match: (w) => /^exploration$/i.test(String(w.role)) },
  { id: 'appraisal', label: 'Appraisal', match: (w) => /^appraisal$/i.test(String(w.role)) },
  // No per-well status exists in this delivery. The folder is real and stays empty
  // rather than asserting P&A for 27 bores off a field-level "Shut down".
  { id: 'abandoned', label: 'Abandoned', match: () => false },
];

const ROLE_COLOR = (role: string) => (/oil[-_ ]?produc/i.test(role) ? 'var(--green)'
  : /inject/i.test(role) ? 'var(--cblue)'
  : /supply/i.test(role) ? 'var(--cyan,#22d3ee)'
  : /observation/i.test(role) ? 'var(--purple)' : 'var(--ink3)');

function Row({ depth, icon: Ic, color, label, sub, count, expandable, open, onToggle,
  nodeId, selectable = true, dim }: {
  depth: number; icon: typeof MapPin; color?: string; label: string; sub?: string;
  count?: number; expandable?: boolean; open?: boolean; onToggle?: () => void;
  nodeId?: string; selectable?: boolean; dim?: boolean;
}) {
  const vis = useScene((s) => s.vis);
  const sel = useScene((s) => s.sel);
  const toggleVis = useScene((s) => s.toggleVis);
  const setSel = useScene((s) => s.setSel);
  const shown = nodeId ? isVisible(vis, nodeId) : true;
  const on = !!nodeId && sel === nodeId;

  return (
    <div
      className={'fdt-row' + (on ? ' sel' : '') + (dim ? ' dim' : '')}
      style={{ paddingLeft: 6 + depth * 12 }}
      onClick={() => { if (dim) return; if (expandable) onToggle?.(); else if (nodeId && selectable) setSel(nodeId); }}
    >
      <span className="fdt-caret">
        {expandable ? <ChevronRight size={12} className={'chev' + (open ? ' open' : '')} /> : <span className="fdt-dot" />}
      </span>
      {nodeId && !dim ? (
        <span className={'fdt-eye' + (shown ? ' on' : '')} title={shown ? 'Hide' : 'Show'}
          onClick={(e) => { e.stopPropagation(); toggleVis(nodeId); }}>
          {shown ? <Eye size={11} /> : <EyeOff size={11} />}
        </span>
      ) : <span className="fdt-eye ghost" />}
      <span className="fdt-ic" style={{ color: color ?? 'var(--ink3)' }}><Ic size={12} /></span>
      <span className="fdt-lbl">{label}{sub && <i>· {sub}</i>}</span>
      {count !== undefined && <span className={'fdt-n' + (count ? ' has' : '')}>{count}</span>}
    </div>
  );
}

export function InputTree({ stageId }: { stageId: string }) {
  const [idx, setIdx] = useState<WbIndex | null>(null);
  const [assets, setAssets] = useState<IngestedAsset[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({ wells: true, producers: true, surfaces: true });
  const fieldId = useScene((s) => s.fieldId);
  const dataVersion = useScene((s) => s.dataVersion);
  // what the user has drawn on the Workspace canvas — authored, not delivered
  const drawn = useInterp((s) => s.features);

  useEffect(() => { loadIndex().then(setIdx).catch(() => setIdx(null)); }, []);
  useEffect(() => {
    if (!fieldId) return;
    let alive = true;
    listAssets(fieldId).then((a) => { if (alive) setAssets(a); }).catch(() => undefined);
    return () => { alive = false; };
  }, [fieldId, dataVersion]);

  const tg = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const live = STAGE_FOLDERS[stageId] ?? [];
  const dimmed = (folder: string) => live.length > 0 && !live.includes(folder);

  const wells = useMemo(() => idx?.wells ?? [], [idx]);
  const buckets = useMemo(() => WELL_BUCKETS.map((b) => {
    const rows = wells.filter(b.match);
    return { ...b, rows };
  }), [wells]);
  const unclassified = useMemo(
    () => wells.filter((w) => !WELL_BUCKETS.some((b) => b.match(w))),
    [wells],
  );

  const surfaces = useMemo(() => assets.filter((a) => a.kind === 'surface'), [assets]);
  const contacts = idx?.contacts ?? [];
  /** Petrel's "global well logs" are curve TYPES. Ours are the distinct curve
   *  families actually present across the delivery's logs. */
  const globalLogs = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets) {
      if (a.kind !== 'log') continue;
      for (const c of String(a.meta.curves ?? '').split(/[,·]/)) {
        const t = c.trim();
        if (t) set.add(t);
      }
    }
    return [...set].sort();
  }, [assets]);
  const pickCount = assets.filter((a) => a.kind === 'picks').length;

  const wellSub = (w: WellRow) => [
    w.has?.traj ? 'traj' : null, w.has?.logs ? 'logs' : null,
    w.has?.picks ? 'picks' : null, w.has?.production ? 'prod' : null,
  ].filter(Boolean).join(' ');

  return (
    <div className="fdt">
      <div className="fdt-head"><Database size={12} /> Input</div>
      <div className="fdt-scroll">
        <Row depth={0} icon={Radio} label="Global well logs" count={globalLogs.length}
          expandable={globalLogs.length > 0} open={!!open.logs} onToggle={() => tg('logs')} dim={dimmed('logs')} />
        {open.logs && globalLogs.map((c) => (
          <Row key={'gl:' + c} depth={1} icon={Radio} label={c} nodeId={'log:' + c} dim={dimmed('logs')} />
        ))}

        <Row depth={0} icon={Layers} label="Well tops" count={pickCount}
          expandable={false} nodeId="tops:all" dim={dimmed('tops')} />

        <Row depth={0} icon={FolderTree} label="Wells" count={wells.length}
          expandable={wells.length > 0} open={!!open.wells} onToggle={() => tg('wells')} dim={dimmed('wells')} />
        {open.wells && (
          <>
            {[...buckets, { id: 'unclassified', label: 'Unclassified', rows: unclassified }].map((b) => (
              <div key={b.id}>
                <Row depth={1} icon={FolderTree} label={b.label} count={b.rows.length}
                  expandable={b.rows.length > 0} open={!!open[b.id]} onToggle={() => tg(b.id)}
                  dim={dimmed('wells')} />
                {open[b.id] && b.rows.map((w) => (
                  <div key={w.name}>
                    <Row depth={2} icon={Waves} color={ROLE_COLOR(String(w.role))} label={w.name}
                      sub={wellSub(w)} nodeId={'well:' + w.name} expandable
                      open={!!open['w:' + w.name]} onToggle={() => tg('w:' + w.name)} dim={dimmed('wells')} />
                    {open['w:' + w.name] && (
                      <>
                        {w.has?.traj && <Row depth={3} icon={Route} label="Trajectory" nodeId={'traj:' + w.name} dim={dimmed('wells')} />}
                        {w.has?.logs && <Row depth={3} icon={Radio} label="Well logs" nodeId={'wlog:' + w.name} dim={dimmed('wells')} />}
                        {w.has?.picks && <Row depth={3} icon={Layers} label="Well tops" nodeId={'wtop:' + w.name} dim={dimmed('wells')} />}
                        {w.has?.production && <Row depth={3} icon={Gauge} label="Production" nodeId={'prod:' + w.name} dim={dimmed('wells')} />}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </>
        )}

        <Row depth={0} icon={MapIcon} label="Surfaces" count={surfaces.length}
          expandable={surfaces.length > 0} open={!!open.surfaces} onToggle={() => tg('surfaces')}
          dim={dimmed('surfaces')} />
        {open.surfaces && surfaces.map((s) => (
          <Row key={s.id} depth={1} icon={MapIcon} color="var(--purple)"
            label={String(s.meta.name ?? s.fileName)} nodeId={'surface:' + s.id} dim={dimmed('surfaces')} />
        ))}

        <Row depth={0} icon={Box} label="Contacts" count={contacts.length}
          expandable={contacts.length > 0} open={!!open.contacts} onToggle={() => tg('contacts')}
          dim={dimmed('contacts')} />
        {open.contacts && contacts.map((c, i) => (
          <Row key={'c' + i} depth={1} icon={Box} label={c.kind || 'OWC'}
            sub={c.tvdss != null ? `${c.tvdss} m` : undefined} nodeId={'contact:' + i} dim={dimmed('contacts')} />
        ))}

        {/* These four fill from the DRAWING TOOLS on the Workspace canvas — they
            are the one part of the tree the user authors rather than receives.
            Each row's eye reaches the canvas through scene.vis, exactly like a
            delivered layer, and the italic "drawn" tag keeps the provenance
            visible so an interpretation is never mistaken for a delivery. */}
        {DRAWN_FOLDERS.map(({ folder, label, icon, kinds }) => {
          const rows = drawn.filter((f) => kinds.includes(f.kind));
          return (
            <div key={folder}>
              <Row depth={0} icon={icon} label={label} count={rows.length}
                expandable={rows.length > 0} open={!!open[folder]} onToggle={() => tg(folder)}
                dim={dimmed(folder)} />
              {open[folder] && rows.map((f) => (
                <Row key={f.id} depth={1} icon={icon} label={f.name} sub={featureMeasure(f)}
                  nodeId={interpNodeId(f)} color="#a78bfa" dim={dimmed(folder)} />
              ))}
            </div>
          );
        })}
        <Row depth={0} icon={Gauge} label="Simulation cases" count={0} dim={dimmed('cases')} />
      </div>
    </div>
  );
}

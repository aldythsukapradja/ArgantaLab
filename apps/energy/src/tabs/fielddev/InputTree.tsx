// InputTree — Petrel's Input pane for Field Development.
//
// ONE SOURCE. Every count, every row and every child in this tree is read from the
// WORKSPACE (workspace.ts) — the ingested asset store the Data Explorer fills. The
// tree used to count wells out of public/wb/index.json while the map read the same
// wells out of IndexedDB; those were two pictures of one delivery with nothing making
// them agree. There is now a single query, and this component only renders it.
//
// One tree, mounted once by the shell and shared by all nine workflow stages. It does
// not re-mount when you change stage; what changes is which folders are LIVE. Folders
// a stage cannot act on grey back rather than disappearing, so the data model you are
// working against stays constant while the task changes — which is what Petrel does
// and why its tree is navigable.
//
// Structure follows Petrel's Input pane:
//
//   Global well logs     curve TYPES, shared across wells (not per-well instances)
//                          └ each type: the wells that carry it
//   Well tops            the pick SURFACES
//                          └ each surface: the wells picked on it
//   Wells                Producers · Injectors · Water supply · Observation ·
//                        Exploration · Appraisal · Abandoned · Unclassified
//                          └ each slot → each bore: Trajectory · Well logs ·
//                            Well tops · Production · Drilling · Pressure —
//                            only what it HAS, and each expands to its own contents
//   Surfaces             the ingested depth grids
//   Contacts             OWC/GOC/GWC, from the delivery's well master
//   Points/Polylines/Polygons/Cross sections/Simulation cases
//
// Every count is real. Folders with nothing behind them show 0 and do not expand —
// they are containers waiting for a delivery, never a fabricated node. While the
// package is still digesting the tree says so rather than showing zeros, because a
// zero drawn mid-load is a false statement about the delivery.
import { useEffect, useMemo, useState } from 'react';
import {
  Box, ChevronRight, Columns3, Database, Drill, Eye, EyeOff, FolderTree, Gauge,
  Hexagon, Layers, Map as MapIcon, MapPin, Radio, Route, Spline, Waves,
} from 'lucide-react';
import { useScene, isVisible } from './scene';
import { useInterp, interpNodeId } from './interp-store';
import { featureMeasure, type FeatureKind } from './interpret';
import { useWorkspace, type WorkspaceBore, type WorkspaceWellhead } from './workspace';
import type { WellRole } from '../../dataqc/curate';

/** The four Input folders the drawing tools write into. `point`, `obs` and `well`
 *  share the Points folder — one geometry, different intent, and each row already
 *  carries its own name. Mirrors FOLDER_OF in interp-store. */
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
  // PVT and the equilibration read the well master's contacts; the initialization is
  // checked against the formation-pressure records, which hang off the wells
  'fluids-rock': ['contacts', 'wells', 'cases'],
  'simulation-cases': ['cases', 'wells', 'surfaces'],
  'history-uncertainty': ['cases', 'wells'],
  'recovery-wells': ['wells', 'surfaces', 'polygons'],
  'forecast-phasing': ['wells', 'cases'],
  'value-fdp': ['cases'],
};

/** Petrel's Wells folder is user-organised; ours is derived from the role the
 *  workspace resolved — the regulator's published purpose where one exists. Water
 *  supply is deliberately its own bucket: a water-supply well is not an injector
 *  into the reservoir. */
const WELL_BUCKETS: Array<{ id: string; label: string; roles: WellRole[] }> = [
  { id: 'producers', label: 'Producers', roles: ['oil-producer'] },
  { id: 'injectors', label: 'Injectors', roles: ['water-injector'] },
  { id: 'supply', label: 'Water supply', roles: ['water-supply'] },
  { id: 'observation', label: 'Observation', roles: ['observation'] },
  { id: 'exploration', label: 'Exploration', roles: ['exploration'] },
  { id: 'appraisal', label: 'Appraisal', roles: ['appraisal'] },
  // 'not-drilled' is the only status the delivery actually publishes. A bore is
  // never called abandoned off a field-level "Shut down" — that would assert P&A
  // for wells no source says anything about.
  { id: 'abandoned', label: 'Never drilled', roles: ['not-drilled'] },
];

const ROLE_COLOR: Record<WellRole, string> = {
  'oil-producer': 'var(--green)',
  'water-injector': 'var(--cblue)',
  'water-supply': 'var(--cyan,#22d3ee)',
  observation: 'var(--purple)',
  exploration: 'var(--ink3)',
  appraisal: 'var(--ink3)',
  'not-drilled': 'var(--ink3)',
  unclassified: 'var(--ink3)',
};

function Row({ depth, icon: Ic, color, label, sub, count, expandable, open, onToggle,
  nodeId, selectable = true, dim, title, onActivate, active }: {
  depth: number; icon: typeof MapPin; color?: string; label: string; sub?: string;
  count?: number; expandable?: boolean; open?: boolean; onToggle?: () => void;
  nodeId?: string; selectable?: boolean; dim?: boolean; title?: string;
  /** Clicking the row ACTS on the canvas as well as selecting it — this is what
   *  makes the tree a control rather than an inventory. Surfaces use it to drape. */
  onActivate?: () => void;
  /** true when this row is what the canvas is currently showing */
  active?: boolean;
}) {
  const vis = useScene((s) => s.vis);
  const sel = useScene((s) => s.sel);
  const toggleVis = useScene((s) => s.toggleVis);
  const setSel = useScene((s) => s.setSel);
  const shown = nodeId ? isVisible(vis, nodeId) : true;
  const on = !!nodeId && sel === nodeId;

  return (
    <div
      className={'fdt-row' + (on ? ' sel' : '') + (active ? ' live' : '') + (dim ? ' dim' : '')}
      style={{ paddingLeft: 6 + depth * 12 }}
      title={title}
      onClick={() => {
        if (dim) return;
        // an expandable row that also names a thing does both: select it AND open it,
        // so a well is inspectable without having to hit a 12px caret
        if (nodeId && selectable) setSel(nodeId);
        if (expandable) onToggle?.();
        onActivate?.();
      }}
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

/** The six data types a bore can carry, each expanding to its own contents so the
 *  tree answers "what is IN this well's logs" without opening a viewer. */
function BoreChildren({ bore, dim, open, tg }: {
  bore: WorkspaceBore; dim: boolean;
  open: Record<string, boolean>; tg: (k: string) => void;
}) {
  const logKey = `bl:${bore.key}`;
  const topKey = `bt:${bore.key}`;
  return (
    <>
      {bore.hasTrajectory && (
        <Row depth={3} icon={Route} label="Trajectory" nodeId={'traj:' + bore.name} dim={dim} />
      )}
      {bore.hasLogs && (
        <>
          <Row depth={3} icon={Radio} label="Well logs" count={bore.curves.length}
            expandable={bore.curves.length > 0} open={!!open[logKey]} onToggle={() => tg(logKey)}
            nodeId={'wlog:' + bore.name} dim={dim} />
          {open[logKey] && bore.curves.map((c) => (
            <Row key={logKey + c} depth={4} icon={Radio} label={c}
              nodeId={`wcurve:${bore.name}:${c}`} dim={dim} />
          ))}
        </>
      )}
      {bore.hasPicks && (
        <>
          <Row depth={3} icon={Layers} label="Well tops" count={bore.tops.length}
            expandable={bore.tops.length > 0} open={!!open[topKey]} onToggle={() => tg(topKey)}
            nodeId={'wtop:' + bore.name} dim={dim} />
          {open[topKey] && bore.tops.map((t) => (
            <Row key={topKey + t} depth={4} icon={Layers} label={t}
              nodeId={`wpick:${bore.name}:${t}`} dim={dim} />
          ))}
        </>
      )}
      {bore.hasProduction && <Row depth={3} icon={Gauge} label="Production" nodeId={'prod:' + bore.name} dim={dim} />}
      {bore.hasInjection && <Row depth={3} icon={Gauge} label="Injection" nodeId={'inj:' + bore.name} dim={dim} />}
      {bore.hasDrilling && <Row depth={3} icon={Drill} label="Drilling" nodeId={'drill:' + bore.name} dim={dim} />}
      {bore.hasPressure && <Row depth={3} icon={Gauge} label="Formation pressure" nodeId={'press:' + bore.name} dim={dim} />}
    </>
  );
}

export function InputTree({ stageId }: { stageId: string }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ wells: true, producers: true, surfaces: true });
  const { ws, ready } = useWorkspace();
  const sceneFieldId = useScene((s) => s.fieldId);

  /** Watchdog: a read that has not returned in 30 s is stuck, not slow. */
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    setStalled(false);
    if (ready || !sceneFieldId) return;
    const t = setTimeout(() => setStalled(true), 30_000);
    return () => clearTimeout(t);
  }, [ready, sceneFieldId]);

  /**
   * Why the tree looks the way it does — reported, never left to be inferred from
   * a column of zeros. Four distinct states that a zero cannot tell apart:
   * nothing scoped, still reading, scoped but nothing ingested, and a real
   * delivery.
   */
  const state = useMemo(() => {
    if (!sceneFieldId) {
      return {
        label: 'no field', tone: 'warn' as const,
        hint: 'No field is scoped, so there is nothing to read.',
        banner: 'No field scoped — pick one in the scope bar above.',
      };
    }
    if (!ready) {
      // A spinner that never ends is the worst of both worlds: it looks like
      // progress and reports nothing. If the read has not returned in half a
      // minute it is not slow, it is stuck — almost always IndexedDB failing to
      // open, which no amount of waiting fixes.
      if (stalled) {
        return {
          label: 'stalled', tone: 'warn' as const,
          hint: 'The asset store did not respond. IndexedDB is usually the cause.',
          banner: 'The workspace store is not responding. Close any other tab running this app and reload; '
            + 'if it persists, the browser may be blocking storage for this site (private window, or site data disabled).',
        };
      }
      return {
        label: 'reading…', tone: '' as const,
        hint: 'Reading the ingested asset store for this field.',
        banner: 'Reading the workspace…',
      };
    }
    if (!ws.assets.length) {
      return {
        label: 'no data', tone: 'warn' as const,
        hint: 'This field has no ingested assets yet. Load a package on the Client data & QC stage.',
        banner: 'Nothing ingested for this field yet — load a package on the Client data & QC stage.',
      };
    }
    return { label: 'workspace', tone: '' as const, hint: `${ws.assets.length} ingested assets`, banner: null };
  }, [sceneFieldId, ready, stalled, ws.assets.length]);
  // what the user has drawn on the Workspace canvas — authored, not delivered
  const drawn = useInterp((s) => s.features);
  // the tree is the Workspace's horizon control, so it needs the scene selection
  const view = useScene((s) => s.view);
  const horizonId = useScene((s) => s.horizonId);
  const multiIds = useScene((s) => s.multiIds);
  const setHorizon = useScene((s) => s.setHorizon);
  const datum = useScene((s) => s.datum);
  const setDatum = useScene((s) => s.setDatum);
  const toggleMulti = useScene((s) => s.toggleMulti);

  const tg = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const live = STAGE_FOLDERS[stageId] ?? [];
  /**
   * Dimming says "this stage does not ACT on that data". It must never reach a
   * VIEW control.
   *
   * Every Workspace stage renders the same canvas, and since the canvas lost its
   * own horizon row this tree is the only way to drape a surface. Dimming does
   * not merely grey the row — `Row` returns early on `dim`, so the click is dead
   * — which meant that on the five stages that do not list `surfaces`
   * (petrophysics, fluids, history, forecast, value) the map could not be
   * re-draped at all, and the folder looked empty. Contacts are drawn on every
   * canvas for the same reason, so they are exempt too.
   */
  const VIEW_FOLDERS = ['surfaces', 'contacts'];
  const dimmed = (folder: string) => live.length > 0
    && !live.includes(folder)
    && !VIEW_FOLDERS.includes(folder);

  const buckets = useMemo(() => {
    const rest = new Set(ws.wellheads);
    const out = WELL_BUCKETS.map((b) => {
      const rows: WorkspaceWellhead[] = ws.wellheads.filter((h) => b.roles.includes(h.role));
      for (const r of rows) rest.delete(r);
      return { ...b, rows };
    });
    // anything the workspace could not classify is SHOWN, in its own bucket — a well
    // that vanished because no bucket matched it would be the worst kind of silence
    out.push({ id: 'unclassified', label: 'Unclassified', roles: [], rows: [...rest] });
    return out;
  }, [ws.wellheads]);

  const boreCount = ws.bores.length;

  return (
    <div className="fdt">
      <div className="fdt-head">
        <Database size={12} /> Input
        {/* provenance, permanently visible: this tree IS the workspace, not a
            second reading of it */}
        <i className={'fdt-head-src' + (state.tone ? ' ' + state.tone : '')} title={state.hint}>{state.label}</i>
      </div>
      <div className="fdt-scroll">
        {/* A zero beside every folder is a statement that the delivery is empty.
            While the workspace is still resolving, or when nothing has been
            ingested for this field yet, that statement is false — so the tree
            says which of the two it is instead of drawing a wall of zeros. */}
        {state.banner && <div className="fdt-banner">{state.banner}</div>}
        {/* ── Global well logs: curve TYPES, each expanding to the wells with it ── */}
        <Row depth={0} icon={Radio} label="Global well logs" count={ws.curveTypes.length}
          expandable={ws.curveTypes.length > 0} open={!!open.logs} onToggle={() => tg('logs')}
          dim={dimmed('logs')} title="Curve types present across the delivery, read from the log digests" />
        {open.logs && ws.curveTypes.map((c) => {
          const k = 'gl:' + c.key;
          return (
            <div key={k}>
              <Row depth={1} icon={Radio} label={c.key}
                sub={c.mnemonics.length > 1 ? c.mnemonics.join(' ') : (c.unit ?? undefined)}
                count={c.wells.length} expandable={c.wells.length > 0}
                open={!!open[k]} onToggle={() => tg(k)} nodeId={'log:' + c.key} dim={dimmed('logs')}
                title={`${c.mnemonics.join(', ')}${c.unit ? ` · ${c.unit}` : ''} — in ${c.wells.length} wellbore${c.wells.length === 1 ? '' : 's'}`} />
              {open[k] && c.wells.map((w) => (
                <Row key={k + w} depth={2} icon={Waves} label={w}
                  nodeId={`wcurve:${w}:${c.key}`} dim={dimmed('logs')} />
              ))}
            </div>
          );
        })}

        {/* ── Well tops: the pick SURFACES, each expanding to the wells picked ── */}
        <Row depth={0} icon={Layers} label="Well tops" count={ws.tops.length}
          expandable={ws.tops.length > 0} open={!!open.tops} onToggle={() => tg('tops')}
          nodeId="tops:all" dim={dimmed('tops')}
          title={`${ws.picks.length} picks across ${ws.tops.length} surfaces`} />
        {open.tops && ws.tops.map((t) => {
          const k = 'tp:' + t.surface;
          return (
            <div key={k}>
              {/* A well top IS the correlation datum — clicking one flattens the
                  panel on it. The tree is the control rather than a dropdown the
                  panel owns, because a datum is a thing in the delivery you point
                  at. Clicking the active one clears it back to measured depth. */}
              <Row depth={1} icon={Layers} label={t.surface} count={t.wells.length}
                expandable={t.wells.length > 0} open={!!open[k]} onToggle={() => tg(k)}
                nodeId={'top:' + t.surface} dim={dimmed('tops')}
                active={datum === t.surface}
                onActivate={() => setDatum(t.surface)}
                title={`${datum === t.surface ? 'Correlation datum — click to clear. ' : 'Click to flatten the correlation on this top. '}`
                  + (t.count !== t.wells.length
                    ? `${t.count} picks, ${t.wells.length} attributable to a wellbore`
                    : `picked in ${t.wells.length} wellbore${t.wells.length === 1 ? '' : 's'}`)} />
              {open[k] && t.wells.map((w) => (
                <Row key={k + w} depth={2} icon={Waves} label={w}
                  nodeId={`wpick:${w}:${t.surface}`} dim={dimmed('tops')} />
              ))}
            </div>
          );
        })}

        {/* ── Wells: slot → bore → the data that bore carries ── */}
        <Row depth={0} icon={FolderTree} label="Wells" count={boreCount}
          expandable={boreCount > 0} open={!!open.wells} onToggle={() => tg('wells')}
          dim={dimmed('wells')}
          title={`${ws.wellheads.length} slot${ws.wellheads.length === 1 ? '' : 's'} · ${boreCount} wellbore${boreCount === 1 ? '' : 's'}`} />
        {open.wells && buckets.map((b) => (
          <div key={b.id}>
            <Row depth={1} icon={FolderTree} label={b.label}
              count={b.rows.reduce((n, h) => n + h.bores.length, 0)}
              expandable={b.rows.length > 0} open={!!open[b.id]} onToggle={() => tg(b.id)}
              dim={dimmed('wells')} />
            {open[b.id] && b.rows.map((h) => {
              // A slot with exactly one bore is drawn as that bore. Interposing a
              // wellhead node above a single wellbore is a level of tree that carries
              // no information and costs a click.
              const single = h.bores.length === 1 ? h.bores[0] : null;
              if (single) {
                const wk = 'w:' + single.key;
                return (
                  <div key={h.well}>
                    <Row depth={2} icon={Waves} color={ROLE_COLOR[single.role]} label={single.name}
                      sub={`${single.completeness}/7`} nodeId={'well:' + single.name} expandable
                      open={!!open[wk]} onToggle={() => tg(wk)} dim={dimmed('wells')}
                      title={single.roleFromKb
                        ? 'Role published by the regulator'
                        : 'Role inferred from the ingested data — no regulator record for this bore'} />
                    {open[wk] && <BoreChildren bore={single} dim={dimmed('wells')} open={open} tg={tg} />}
                  </div>
                );
              }
              const hk = 'h:' + h.well;
              return (
                <div key={h.well}>
                  <Row depth={2} icon={FolderTree} color={ROLE_COLOR[h.role]} label={h.well}
                    sub={`${h.bores.length} bores`} count={h.bores.length} expandable
                    open={!!open[hk]} onToggle={() => tg(hk)} nodeId={'slot:' + h.well}
                    dim={dimmed('wells')} title="Surface slot — the bores below share it" />
                  {open[hk] && h.bores.map((bore) => {
                    const wk = 'w:' + bore.key;
                    return (
                      <div key={bore.key}>
                        <Row depth={3} icon={Waves} color={ROLE_COLOR[bore.role]} label={bore.name}
                          sub={`${bore.completeness}/7`} nodeId={'well:' + bore.name} expandable
                          open={!!open[wk]} onToggle={() => tg(wk)} dim={dimmed('wells')} />
                        {open[wk] && (
                          <div style={{ marginLeft: 12 }}>
                            <BoreChildren bore={bore} dim={dimmed('wells')} open={open} tg={tg} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ))}

        <Row depth={0} icon={MapIcon} label="Surfaces" count={ws.surfaces.length}
          expandable={ws.surfaces.length > 0} open={!!open.surfaces} onToggle={() => tg('surfaces')}
          dim={dimmed('surfaces')} />
        {/* Surfaces are SELECTED here — the Workspace canvas has no horizon row of
            its own, so this is the control that drapes them. Single-select in 2D
            (a map shows one surface), additive in 3D and the section (where the
            whole point is a stack). Clicking the row does it; the eye still just
            hides. Knowledge keeps its own horizon row above its 2D/3D switch,
            because a dossier is read without a tree beside it. */}
        {open.surfaces && ws.surfaces.map((s) => {
          const draped = view === '2d' ? horizonId === s.assetId : multiIds.includes(s.assetId);
          return (
            <Row key={s.id} depth={1} icon={MapIcon} color="var(--purple)" label={s.name}
              sub={s.zmin != null && s.zmax != null ? `${Math.round(s.zmin)}–${Math.round(s.zmax)} m` : undefined}
              nodeId={'surface:' + s.id} dim={dimmed('surfaces')} active={draped}
              title={view === '2d'
                ? (draped ? `${s.name} — draped on the map. Click to undrape.` : `Drape ${s.name} on the map`)
                : (draped ? `${s.name} — in the scene. Click to remove.` : `Add ${s.name} to the scene`)}
              onActivate={() => (view === '2d'
                ? setHorizon(horizonId === s.assetId ? null : s.assetId)
                : toggleMulti(s.assetId))} />
          );
        })}

        <Row depth={0} icon={Box} label="Contacts" count={ws.contacts.length}
          expandable={ws.contacts.length > 0} open={!!open.contacts} onToggle={() => tg('contacts')}
          dim={dimmed('contacts')} />
        {open.contacts && ws.contacts.map((c, i) => (
          <Row key={'c' + i} depth={1} icon={Box} label={c.kind || 'OWC'}
            sub={c.tvdss != null ? `${c.tvdss} m` : undefined} nodeId={'contact:' + i}
            dim={dimmed('contacts')} title={c.prov ?? undefined} />
        ))}

        {/* These four fill from the DRAWING TOOLS on the Workspace canvas — they are
            the one part of the tree the user authors rather than receives. Each row's
            eye reaches the canvas through scene.vis, exactly like a delivered layer,
            and the italic tag keeps the provenance visible so an interpretation is
            never mistaken for a delivery. */}
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

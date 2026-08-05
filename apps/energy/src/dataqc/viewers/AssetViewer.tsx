// viewers/AssetViewer.tsx — the pop-up viewer. Routes an ingested asset to the
// display its data type actually deserves, reading the stored digest (not the raw).
//
// Picks are resolved once here and injected into BOTH the log and the trajectory
// viewer, because a formation top is only meaningful when you can see it against a
// curve and against the well path.
import { useEffect, useMemo, useState } from 'react';
import { X, FileText, Layers3 } from 'lucide-react';
import type { IngestedAsset } from '../types.ts';
import type { KbContext } from '../masterkb.ts';
import { readLog, readRecord, readSurfaceGrid } from '../readDigest.ts';
import { listAssets } from '../db.ts';
import { LogViewer, type PickMarker } from './LogViewer.tsx';
import { SurfaceViewer } from './SurfaceViewer.tsx';
import { TrajectoryViewer, type TrajPayload, type HoleSection } from './TrajectoryViewer.tsx';
import { ProductionViewer, type ProdPayload } from './ProductionViewer.tsx';
import { DrillingViewer, type DrillPayload } from './DrillingViewer.tsx';
import { WellSchematic } from './WellSchematic.tsx';
import { PressureViewer, type PressPayload } from './PressureViewer.tsx';
import type { DigestedLog, DigestedSurface } from '../types.ts';
import { buildFluidProfile, type FluidProfile } from '../petro.ts';
import { surfaceContextFor } from '../surface-context.ts';
import './viewers.css';

interface PicksPayload { picks: Array<{ well: string | null; source_well?: string; surface: string; md: number; tvdss?: number | null }> }
interface DocPayload { doc: { blocks: Array<{ text?: string; locator: string }>; fileName: string }; candidates: unknown[] }

export function AssetViewer({ asset, onClose, kb = null }: { asset: IngestedAsset; onClose: () => void; kb?: KbContext | null }) {
  const [payload, setPayload] = useState<unknown>(null);
  const [picks, setPicks] = useState<PickMarker[]>([]);
  const [fluidProfile, setFluidProfile] = useState<FluidProfile | null>(null);
  const [sections, setSections] = useState<HoleSection[] | null>(null);
  const [drill, setDrill] = useState<DrillPayload | null>(null);
  // A wellbore is one object with three faces: where it went, what steel is in it,
  // and what happened while drilling. They belong in one window, not three.
  const [face, setFace] = useState<'path' | 'schematic' | 'drilling'>('path');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const data = asset.kind === 'surface' ? await readSurfaceGrid(asset)
          : asset.kind === 'log' ? await readLog(asset)
          : await readRecord<unknown>(asset);
        if (!dead) setPayload(data);
      } catch (e) { if (!dead) setErr(String((e as Error).message)); }
    })();
    return () => { dead = true; };
  }, [asset]);

  // picks live in their own asset — pull them for whichever well this asset is
  const wellName = String(asset.meta.well ?? '');
  useEffect(() => {
    if (!wellName || (asset.kind !== 'log' && asset.kind !== 'trajectory' && asset.kind !== 'drilling')) return;
    let dead = false;
    (async () => {
      const all = await listAssets(asset.fieldId);
      const pk = all.find((a) => a.kind === 'picks');
      if (!pk) return;
      const data = await readRecord<PicksPayload>(pk);
      if (dead || !data?.picks) return;
      const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const mine = data.picks
        .filter((p) => p.well && norm(p.well) === norm(wellName))
        .map((p) => ({ surface: p.surface, md: p.md }))
        .sort((a, b) => a.md - b.md);
      setPicks(mine);
    })();
    return () => { dead = true; };
  }, [asset, wellName]);

  // trajectory paths color by fluid status — pulled from this well's own log,
  // the same heuristic LogViewer annotates its tracks with (petro.ts)
  useEffect(() => {
    setFluidProfile(null);
    if (!wellName || asset.kind !== 'trajectory') return;
    let dead = false;
    (async () => {
      const all = await listAssets(asset.fieldId);
      const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const logAsset = all.find((a) => a.kind === 'log' && a.meta.well && norm(String(a.meta.well)) === norm(wellName));
      if (!logAsset) return;
      const log = await readLog(logAsset);
      if (dead || !log) return;
      setFluidProfile(buildFluidProfile(log));
    })();
    return () => { dead = true; };
  }, [asset, wellName]);

  // Hole sections / casing points for a trajectory come from THIS wellbore's own mud
  // log — every step-down in bit diameter is a casing point. Read the same way the
  // fluid profile is: find the sibling asset for this well, not a global lookup.
  useEffect(() => {
    setSections(null); setDrill(null); setFace('path');
    if (!wellName || asset.kind !== 'trajectory') return;
    let dead = false;
    (async () => {
      const all = await listAssets(asset.fieldId);
      const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
      const drillAsset = all.find((a) => a.kind === 'drilling' && a.meta.well && norm(String(a.meta.well)) === norm(wellName));
      if (!drillAsset) return;
      const d = await readRecord<DrillPayload>(drillAsset);
      if (dead || !d) return;
      if (d.sections?.length) setSections(d.sections);
      setDrill(d);
    })().catch(() => { /* a trajectory without a mud log simply shows no casing */ });
    return () => { dead = true; };
  }, [asset, wellName]);

  // Link this surface back to the SAME stratigraphic model the Exploration tab's
  // Basin Dossier reads — age, environment, and its real petroleum-system role
  // (source/reservoir/seal/overburden), not just "a grid of numbers".
  const surfCtx = useMemo(
    () => (asset.kind === 'surface' ? surfaceContextFor(String(asset.meta.name ?? ''), kb) : null),
    [asset, kb],
  );

  const body = useMemo(() => {
    if (err) return <div className="dqv-empty">Could not read digest: {err}</div>;
    if (payload == null) return <div className="dqv-empty">Reading digest…</div>;

    switch (asset.kind) {
      case 'log':
        return <LogViewer log={payload as DigestedLog} picks={picks} />;
      case 'surface':
        return <SurfaceViewer surface={payload as DigestedSurface} />;
      case 'trajectory': {
        const body = face === 'schematic' && sections?.length
          ? <WellSchematic well={asset.meta.well ? String(asset.meta.well) : (payload as TrajPayload).well}
              sections={sections} picks={picks}
              tdMd={(() => { const st = (payload as TrajPayload).stations ?? []; return st.length ? Math.max(...st.map((x) => x.md)) : null; })()} />
          : face === 'drilling' && drill
            ? <DrillingViewer drill={drill} picks={picks} />
            : <TrajectoryViewer traj={payload as TrajPayload} picks={picks} fluidProfile={fluidProfile} sections={sections} />;
        return (
          <>
            {(sections?.length || drill) && (
              <div className="dqv-facebar">
                <button className={face === 'path' ? 'on' : ''} onClick={() => setFace('path')}>Path</button>
                {sections?.length ? <button className={face === 'schematic' ? 'on' : ''} onClick={() => setFace('schematic')}>Schematic</button> : null}
                {drill ? <button className={face === 'drilling' ? 'on' : ''} onClick={() => setFace('drilling')}>Drilling log</button> : null}
                <span className="dqv-meta">same wellbore · {picks?.length ?? 0} tops carried across all three</span>
              </div>
            )}
            {body}
          </>
        );
      }
      case 'production':
      case 'injection':
        return <ProductionViewer prod={payload as ProdPayload} />;
      case 'drilling':
        return <DrillingViewer drill={payload as DrillPayload} picks={picks} />;
      case 'pressure':
        return <PressureViewer press={payload as PressPayload} />;
      case 'document': {
        const p = payload as DocPayload;
        const blocks = p?.doc?.blocks ?? [];
        return (
          <div className="dqv-doc">
            <div className="dqv-bar">
              <span className="dqv-chip on"><FileText size={11} /> {blocks.length} pages</span>
              <span className="dqv-chip">{p?.candidates?.length ?? 0} candidates</span>
              {asset.linked?.matched?.length ? (
                <span className="dqv-meta">links: {asset.linked.matched.slice(0, 10).join(' · ')}</span>
              ) : null}
            </div>
            <div className="dqv-doc-body">
              {blocks.map((b, i) => (
                <div key={i} className="dqv-block">
                  <div className="dqv-block-loc">{b.locator}</div>
                  <p>{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        );
      }
      case 'picks': {
        const p = payload as PicksPayload;
        const all = p?.picks ?? [];
        const rows = all.slice(0, 500);
        const attributed = all.filter((r) => r.well).length;
        return (
          <>
            <div className="dqv-bar">
              <span className="dqv-chip on">{all.length} formation tops</span>
              <span className="dqv-chip">{attributed} attributed</span>
              {all.length > attributed && (
                <span className="dqv-chip" title="Real picks for wells outside this field's delivery — kept, deliberately not forced onto a lookalike wellbore">
                  {all.length - attributed} other wells
                </span>
              )}
              <span className="dqv-meta">age · role from the Master KB stratigraphy</span>
            </div>
            <div className="dqv-table-wrap">
              <table className="dqv-table">
                <thead><tr><th>Well</th><th>Formation top</th><th>MD</th><th>TVDSS</th><th>Age (Ma)</th><th>PS role</th></tr></thead>
                <tbody>
                  {rows.map((r, i) => {
                    // Every top is resolved against the SAME stratigraphy + petroleum-system
                    // model the Exploration Basin Dossier reads, so a pick is not just a
                    // depth — it says which rock, how old, and what it does in the system.
                    const c = surfaceContextFor(r.surface, kb);
                    const role = c?.psElement?.role ?? c?.stratRole;
                    return (
                      <tr key={i} className={r.well ? undefined : 'muted'}>
                        <td>{r.well ?? <span title={`Outside this delivery: ${r.source_well}`}>{r.source_well}</span>}</td>
                        <td>{r.surface}</td>
                        <td className="num">{r.md?.toFixed(1)}</td>
                        <td className="num">{r.tvdss != null ? r.tvdss.toFixed(1) : '—'}</td>
                        <td className="num">{c?.ageTopMa != null ? `${c.ageTopMa}–${c.ageBaseMa}` : '—'}</td>
                        <td>{role ? <span className={'dqv-ps-role role-' + role}>{role}</span> : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {all.length > rows.length && (
              <div className="dqv-drill-foot"><span>Showing the first {rows.length} of {all.length} picks.</span></div>
            )}
          </>
        );
      }
      default:
        return (
          <div className="dqv-json">
            <pre>{JSON.stringify(payload, null, 1).slice(0, 20000)}</pre>
          </div>
        );
    }
  }, [payload, err, asset, picks, fluidProfile, kb, sections, drill, face]);

  return (
    <div className="dqv-scrim" onClick={onClose}>
      <div className="dqv-modal" onClick={(e) => e.stopPropagation()}>
        <header className="dqv-head">
          <div>
            <div className="dqv-kind">{asset.kind}{asset.meta.well ? ` · ${asset.meta.well}` : ''}</div>
            <h3>{String(asset.meta.name ?? asset.meta.title ?? asset.fileName)}</h3>
          </div>
          {picks.length > 0 && <span className="dqv-chip on">{picks.length} picks</span>}
          <button className="dqv-x" onClick={onClose} aria-label="Close viewer"><X size={16} /></button>
        </header>
        {asset.kind === 'surface' && (
          <div className="dqv-stratctx">
            <Layers3 size={12} />
            {surfCtx ? (
              <>
                <b>{surfCtx.unitName}{surfCtx.isTop ? ' (Top)' : surfCtx.isBase ? ' (Base)' : ''}</b>
                {surfCtx.ageTopMa != null && <span>{surfCtx.ageTopMa}–{surfCtx.ageBaseMa} Ma</span>}
                {surfCtx.environment && <span>{surfCtx.environment}</span>}
                {surfCtx.psElement ? (
                  <span className={'dqv-ps-role role-' + surfCtx.psElement.role}>
                    {surfCtx.psElement.role}{surfCtx.psElement.effectiveness && surfCtx.psElement.effectiveness !== 'not-assessed' ? ` · ${surfCtx.psElement.effectiveness}` : ''}
                  </span>
                ) : surfCtx.stratRole ? (
                  <span className={'dqv-ps-role role-' + surfCtx.stratRole}>{surfCtx.stratRole}</span>
                ) : null}
                {surfCtx.cycleTitle && <span className="dqv-muted">{surfCtx.cycleTitle}</span>}
              </>
            ) : (
              <span className="dqv-muted">
                {kb ? 'Not a named stratigraphic unit in the Master KB (e.g. the seafloor)' : 'Master KB not loaded for this field'}
              </span>
            )}
          </div>
        )}
        <div className="dqv-body">{body}</div>
      </div>
    </div>
  );
}

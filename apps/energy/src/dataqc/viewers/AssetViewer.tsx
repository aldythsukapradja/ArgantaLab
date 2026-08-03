// viewers/AssetViewer.tsx — the pop-up viewer. Routes an ingested asset to the
// display its data type actually deserves, reading the stored digest (not the raw).
//
// Picks are resolved once here and injected into BOTH the log and the trajectory
// viewer, because a formation top is only meaningful when you can see it against a
// curve and against the well path.
import { useEffect, useMemo, useState } from 'react';
import { X, FileText } from 'lucide-react';
import type { IngestedAsset } from '../types.ts';
import { readLog, readRecord, readSurfaceGrid } from '../readDigest.ts';
import { listAssets } from '../db.ts';
import { LogViewer, type PickMarker } from './LogViewer.tsx';
import { SurfaceViewer } from './SurfaceViewer.tsx';
import { TrajectoryViewer, type TrajPayload } from './TrajectoryViewer.tsx';
import { ProductionViewer, type ProdPayload } from './ProductionViewer.tsx';
import type { DigestedLog, DigestedSurface } from '../types.ts';
import './viewers.css';

interface PicksPayload { picks: Array<{ well: string | null; surface: string; md: number }> }
interface DocPayload { doc: { blocks: Array<{ text?: string; locator: string }>; fileName: string }; candidates: unknown[] }

export function AssetViewer({ asset, onClose }: { asset: IngestedAsset; onClose: () => void }) {
  const [payload, setPayload] = useState<unknown>(null);
  const [picks, setPicks] = useState<PickMarker[]>([]);
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
    if (!wellName || (asset.kind !== 'log' && asset.kind !== 'trajectory')) return;
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

  const body = useMemo(() => {
    if (err) return <div className="dqv-empty">Could not read digest: {err}</div>;
    if (payload == null) return <div className="dqv-empty">Reading digest…</div>;

    switch (asset.kind) {
      case 'log':
        return <LogViewer log={payload as DigestedLog} picks={picks} />;
      case 'surface':
        return <SurfaceViewer surface={payload as DigestedSurface} />;
      case 'trajectory':
        return <TrajectoryViewer traj={payload as TrajPayload} picks={picks} />;
      case 'production':
      case 'injection':
        return <ProductionViewer prod={payload as ProdPayload} />;
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
        const rows = (p?.picks ?? []).slice(0, 400);
        return (
          <div className="dqv-table-wrap">
            <table className="dqv-table">
              <thead><tr><th>Well</th><th>Surface</th><th>MD</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}><td>{r.well ?? '—'}</td><td>{r.surface}</td><td className="num">{r.md?.toFixed(1)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      default:
        return (
          <div className="dqv-json">
            <pre>{JSON.stringify(payload, null, 1).slice(0, 20000)}</pre>
          </div>
        );
    }
  }, [payload, err, asset, picks]);

  return (
    <div className="dqv-scrim" onClick={onClose}>
      <div className="dqv-modal" onClick={(e) => e.stopPropagation()}>
        <header className="dqv-head">
          <div>
            <div className="dqv-kind">{asset.kind}{asset.meta.well ? ` · ${asset.meta.well}` : ''}</div>
            <h3>{String(asset.meta.title ?? asset.fileName)}</h3>
          </div>
          {picks.length > 0 && <span className="dqv-chip on">{picks.length} picks</span>}
          <button className="dqv-x" onClick={onClose} aria-label="Close viewer"><X size={16} /></button>
        </header>
        <div className="dqv-body">{body}</div>
      </div>
    </div>
  );
}

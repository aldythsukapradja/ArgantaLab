// DataQc — the platform's client-data interface. One component, mounted by EVERY
// lifecycle vertical (Exploration · Field Development · Well Delivery · Reservoir
// Management · Drilling), scoped by fieldId + vertical.
//
// Shows the real pipeline: RAW → DIGESTED → COMPRESSED → LINKED → OSDU.
// Every number on screen is measured from the actual ingested asset — nothing is
// simulated, and no stage shows "done" unless it produced a real artefact.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  UploadCloud, FileText, Waves, Layers, Trash2, ShieldCheck, ShieldAlert,
  ShieldQuestion, Database, Image as ImageIcon, Activity, GitBranch, Link2,
  Droplets, Eye, Info,
} from 'lucide-react';
import { ExtractionGate } from './ExtractionGate.tsx';
import { AssetViewer } from './viewers/AssetViewer.tsx';
import { AuditView } from './AuditView.tsx';
import './dataqc.css';
import { ingestFile } from './ingest.ts';
import { bundleFor, digestBundleItem, planBundle } from './bundle.ts';
import { isAvailable, listAssets, putAsset, putBlob, removeAsset } from './db.ts';
import { gateFor, qcConsistency } from './qc.ts';
import { assetsToManifest, countRecords } from './osdu.ts';
import { PIPELINE_STAGES, type AssetKind, type DataMode, type IngestedAsset, type Vertical } from './types.ts';
import { resolveKbContext, resolveWellbore, type KbContext } from './masterkb.ts';
import { useUnits, oilVol, gasVol, waterVol, depth as depthQ, depthToMetres } from '../units';

const KB = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

const KIND_ICON = {
  log: Waves, surface: Layers, picks: Layers, trajectory: Waves,
  production: Activity, injection: Droplets, patterns: GitBranch,
  document: FileText, image: ImageIcon, unknown: FileText,
} as const;

/** Which kinds have a purpose-built viewer behind them. */
const VIEWABLE = new Set(['log', 'surface', 'trajectory', 'production', 'injection', 'document', 'picks']);

export function DataQc({ fieldId, fieldName, vertical, dataMode = 'reference' }: {
  fieldId: string;
  fieldName: string;
  vertical: Vertical;
  dataMode?: DataMode;
}) {
  const [assets, setAssets] = useState<IngestedAsset[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [view, setView] = useState<'qc' | 'audit' | 'osdu'>('qc');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ done: number; total: number; label: string } | null>(null);
  const [kind, setKind] = useState<AssetKind | 'all'>('all');
  const [viewing, setViewing] = useState<string | null>(null);
  const [showDeliveryQc, setShowDeliveryQc] = useState(false);
  const [kb, setKb] = useState<KbContext | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { system } = useUnits();

  // Master KB link — resolves this field into the authored spine
  // (field → basin → province → region, plus its wells/wellbores).
  useEffect(() => { resolveKbContext(fieldId).then(setKb).catch(() => setKb(null)); }, [fieldId]);

  const refresh = useCallback(() => {
    if (!isAvailable()) return;
    listAssets(fieldId).then(setAssets).catch(() => setAssets([]));
  }, [fieldId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Reference packages load themselves. Volve is the proof case: its delivery already
  // ships with the app, so the tab is never empty for a bundled field — and the
  // numbers on screen are produced by the real pipeline, not seeded.
  // Digests are cached in IndexedDB, so this cost is paid once per browser.
  useEffect(() => {
    const spec = bundleFor(fieldId);
    if (!spec || !isAvailable()) return;
    let cancelled = false;

    (async () => {
      const existing = await listAssets(fieldId);
      const have = new Set(existing.filter((a) => a.origin === 'bundle').map((a) => a.id));

      const { index, items } = await planBundle(spec);
      if (cancelled) return;

      // Resume, don't restart: only digest what's missing. A load interrupted by a
      // remount (or a closed tab) picks up exactly where it stopped, and a complete
      // package costs nothing on revisit.
      const todo = items.filter((it) => !have.has(`ia-${spec.slug}-${it.key}`));
      if (todo.length === 0) return;
      setLoading({ done: 0, total: todo.length, label: spec.label });

      for (let i = 0; i < todo.length; i++) {
        if (cancelled) return;
        setLoading({ done: i, total: todo.length, label: todo[i].label });
        try {
          const out = await digestBundleItem(todo[i], index, spec, fieldId, vertical);
          if (out) {
            const bytes = new Uint8Array(out.compressed.length);
            bytes.set(out.compressed);
            await putBlob(out.asset.digestKey!, new Blob([bytes.buffer], { type: 'application/gzip' }));
            await putAsset(out.asset);
            if (!cancelled && i % 4 === 0) refresh();
          }
        } catch { /* one bad file must not abort the package */ }
      }
      if (cancelled) return;
      setLoading(null);
      refresh();
    })().catch(() => { if (!cancelled) setLoading(null); });

    return () => { cancelled = true; };
  }, [fieldId, vertical, refresh]);

  // A CLIENT upload is what turns the gate on. A bundled reference package does not —
  // it is reference data by definition, however much of it there is.
  const hasClientData = assets.some((a) => a.origin === 'client');
  const effectiveMode: DataMode = hasClientData ? 'client' : dataMode;
  const gate = useMemo(() => gateFor(vertical, assets, effectiveMode), [vertical, assets, effectiveMode]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    for (const file of Array.from(files)) {
      setBusy((b) => [...b, file.name]);
      try {
        await ingestFile(file, { fieldId, vertical });
      } catch (e) {
        setErr(`${file.name}: ${(e as Error).message}`);
      } finally {
        setBusy((b) => b.filter((n) => n !== file.name));
      }
    }
    refresh();
  }, [fieldId, vertical, refresh]);

  const selected = assets.find((a) => a.id === sel) ?? null;
  const totals = useMemo(() => ({
    raw: assets.reduce((n, a) => n + a.bytes, 0),
    comp: assets.reduce((n, a) => n + (a.compressedBytes ?? 0), 0),
    digested: assets.filter((a) => !!a.digestKey).length,
    osdu: assets.length,
  }), [assets]);

  const manifest = useMemo(() => (assets.length ? assetsToManifest(assets) : null), [assets]);

  // group for QC: one chip per asset class, with counts and the worst status in it
  const groups = useMemo(() => {
    const m = new Map<AssetKind, { n: number; worst: 'pass' | 'warn' | 'fail' }>();
    for (const a of assets) {
      const g = m.get(a.kind) ?? { n: 0, worst: 'pass' as const };
      const rank = { pass: 0, warn: 1, fail: 2 };
      m.set(a.kind, {
        n: g.n + 1,
        worst: rank[a.qc.status] > rank[g.worst] ? a.qc.status : g.worst,
      });
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [assets]);

  const visible = useMemo(
    () => (kind === 'all' ? assets : assets.filter((a) => a.kind === kind)),
    [assets, kind],
  );
  // cross-asset findings belong to the DELIVERY, not to any one file — they must be
  // visible, or the gate would block with an unexplained reason
  const deliveryExceptions = useMemo(() => qcConsistency(assets), [assets]);

  if (!isAvailable()) {
    return <div className="dqc"><div className="dqc-empty">Local storage (IndexedDB) is unavailable in this browser context.</div></div>;
  }

  const GateIcon = gate.status === 'passed' || gate.status === 'ready' ? ShieldCheck
    : gate.status === 'blocked' ? ShieldAlert : ShieldQuestion;

  return (
    <div className="dqc">
      <div className="dqc-gate">
        <span className={`dqc-gate-badge ${gate.status}`}><GateIcon size={12} /> {gate.status.replace('-', ' ')}</span>
        <span className="dqc-gate-reason">{gate.reason}</span>
        <span className="dqc-spacer" />
        <span className="dqc-mode">
          <button className={view === 'qc' ? 'on' : ''} onClick={() => setView('qc')}>QC</button>
          <button className={view === 'audit' ? 'on' : ''} onClick={() => setView('audit')}>AUDIT</button>
          <button className={view === 'osdu' ? 'on' : ''} onClick={() => setView('osdu')}>OSDU</button>
        </span>
      </div>

      <div className="dqc-body">
        <div className="dqc-main">
          <div className="dqc-main-fixed">
            <div className="dqc-drop-wrap">
              <div
                className={'dqc-drop' + (over ? ' over' : '')}
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setOver(true); }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => { e.preventDefault(); setOver(false); void handleFiles(e.dataTransfer.files); }}
              >
                <div className="dqc-drop-ic"><UploadCloud size={15} /></div>
                <b>
                  {loading ? `Digesting ${loading.label} — ${loading.done}/${loading.total}`
                    : busy.length ? `Ingesting ${busy.length} file${busy.length === 1 ? '' : 's'}…`
                    : `Drop data for ${fieldName}`}
                </b>
                {deliveryExceptions.length > 0 && (
                  <button
                    className={'dqc-info-btn' + (showDeliveryQc ? ' on' : '')}
                    title={`${deliveryExceptions.length} delivery-level QC exception${deliveryExceptions.length === 1 ? '' : 's'}`}
                    onClick={(e) => { e.stopPropagation(); setShowDeliveryQc((v) => !v); }}
                  >
                    <Info size={12} /> {deliveryExceptions.length}
                  </button>
                )}
                <span>LAS · CSV · EarthVision · IRAP · ZMAP+ · XYZ · PDF · DOCX · XLSX</span>
                {loading && (
                  <span className="dqc-prog"><i style={{ width: `${(loading.done / Math.max(1, loading.total)) * 100}%` }} /></span>
                )}
                <input
                  ref={inputRef} type="file" multiple hidden
                  accept=".las,.dat,.xyz,.irap,.gri,.grd,.asc,.zmap,.csv,.txt,.pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg"
                  onChange={(e) => { void handleFiles(e.target.files); e.target.value = ''; }}
                />
              </div>
              {showDeliveryQc && deliveryExceptions.length > 0 && (
                <div className="dqc-info-pop" onClick={(e) => e.stopPropagation()}>
                  <div className="dqc-h" style={{ marginTop: 0 }}>Delivery-level QC · {deliveryExceptions.length}</div>
                  {deliveryExceptions.map((e, i) => (
                    <div key={i} className={`dqc-exc ${e.severity}`}>
                      <div className="dqc-exc-top">
                        <span className="dqc-exc-rule">{e.rule}</span>
                        <span className={`dqc-pill ${e.severity === 'info' ? 'warn' : e.severity}`}>{e.severity}</span>
                      </div>
                      <div className="dqc-exc-msg">{e.message}</div>
                      <div className="dqc-exc-loc">@ {e.locator}</div>
                      {e.detail && <div className="dqc-exc-msg" style={{ opacity: 0.75 }}>{e.detail}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {err && <div className="dqc-exc fail" style={{ marginTop: 10 }}><div className="dqc-exc-msg">{err}</div></div>}

            <div className="dqc-pipe">
              {PIPELINE_STAGES.map((s, i) => {
                const done =
                  s.id === 'raw' ? assets.length > 0
                  : s.id === 'digested' ? totals.digested > 0
                  : s.id === 'compressed' ? totals.comp > 0
                  : s.id === 'linked' ? assets.some((a) => (a.linked?.entities ?? 0) > 0)
                  : manifest != null;
                const value =
                  s.id === 'raw' ? `${assets.length} file${assets.length === 1 ? '' : 's'} · ${KB(totals.raw)}`
                  : s.id === 'digested' ? `${totals.digested} parsed`
                  : s.id === 'compressed' ? (totals.comp ? `${KB(totals.comp)} · ${(totals.raw / Math.max(1, totals.comp)).toFixed(1)}×` : '—')
                  : s.id === 'linked' ? (() => {
                      const docs = assets.filter((a) => a.kind === 'document');
                      const ents = docs.reduce((n, a) => n + (a.linked?.entities ?? 0), 0);
                      const cands = docs.reduce((n, a) => n + (a.linked?.candidates ?? 0), 0);
                      return docs.length ? `${docs.length} docs · ${ents} entities · ${cands} candidates` : '—';
                    })()
                  : manifest ? `${countRecords(manifest)} records` : '—';
                return (
                  <div key={s.id} className={'dqc-stage' + (done ? ' done' : '')}>
                    <div className="dqc-stage-n">{String(i + 1).padStart(2, '0')}</div>
                    <div className="dqc-stage-l">{s.label}</div>
                    <div className="dqc-stage-h">{s.hint}</div>
                    <div className="dqc-stage-v">{value}</div>
                  </div>
                );
              })}
            </div>

            {view === 'osdu' ? (
              <div className="dqc-h">OSDU manifest · client lane</div>
            ) : view === 'audit' ? (
              <div className="dqc-h">
                Data availability · which wellbore carries which data
              </div>
            ) : (
              <>
                <div className="dqc-h">
                  Delivery inventory · {assets.length}
                  {assets.some((a) => a.origin === 'bundle') && ` · ${assets.filter((a) => a.origin === 'bundle').length} from reference package`}
                </div>
                {groups.length > 1 && (
                  <div className="dqc-groups">
                    <button className={'dqc-grp' + (kind === 'all' ? ' on' : '')} onClick={() => setKind('all')}>
                      All <b>{assets.length}</b>
                    </button>
                    {groups.map(([k, g]) => (
                      <button key={k} className={'dqc-grp' + (kind === k ? ' on' : '') + ` s-${g.worst}`} onClick={() => setKind(k)}>
                        {k} <b>{g.n}</b>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="dqc-main-scroll">
          {view === 'osdu' ? (
            manifest
              ? <div className="dqc-osdu">{JSON.stringify(manifest, null, 1).slice(0, 6000)}</div>
              : <div className="dqc-empty">Ingest a file to emit governed OSDU records.</div>
          ) : view === 'audit' ? (
            <AuditView assets={assets} kb={kb} onOpen={setViewing} />
          ) : (
            <>
              {assets.length === 0 && !loading && (
                <div className="dqc-empty">No client data yet. This field runs on catalogue and analog data.</div>
              )}
              {assets.length === 0 && loading && (
                <div className="dqc-empty">Loading the {loading.label} reference package — {loading.done}/{loading.total}…</div>
              )}
              {visible.map((a) => {
                const Ic = KIND_ICON[a.kind] ?? FileText;
                return (
                  <div key={a.id} className={'dqc-row' + (sel === a.id ? ' sel' : '')} onClick={() => setSel(a.id)}>
                    <span className="dqc-row-ic"><Ic size={14} /></span>
                    <span className="dqc-row-main">
                      <span className="dqc-row-name">
                        {/* many Volve wells export the same source filename — lead with
                            the entity so rows are distinguishable, keep the file as provenance */}
                        {a.meta.well ? `${a.meta.well} · ${a.kind}` : a.fileName}
                      </span>
                      <span className="dqc-row-meta">
                        {a.meta.well ? `${a.fileName} · ` : `${a.kind} · `}{a.format} · {KB(a.bytes)}
                        {a.compressedBytes ? ` → ${KB(a.compressedBytes)}` : ''}
                      </span>
                    </span>
                    <span className={`dqc-pill ${a.qc.status}`}>{a.qc.status}</span>
                    {VIEWABLE.has(a.kind) && (
                      <button
                        className="dqc-view" title={`Open ${a.kind} viewer`}
                        onClick={(e) => { e.stopPropagation(); setViewing(a.id); }}
                      ><Eye size={13} /></button>
                    )}
                    {a.origin === 'client' && (
                      <button
                        className="dqc-del" title="Remove"
                        onClick={(e) => { e.stopPropagation(); void removeAsset(a.id).then(refresh); if (sel === a.id) setSel(null); }}
                      ><Trash2 size={13} /></button>
                    )}
                  </div>
                );
              })}
            </>
          )}
          </div>
        </div>

        <aside className="dqc-side">
          {selected ? (
            <>
              <div className="dqc-h" style={{ marginTop: 0 }}>{selected.fileName}</div>
              <div className="dqc-kv"><span>sha256</span><span>{selected.sha256.slice(0, 16)}…</span></div>
              <div className="dqc-kv"><span>kind · format</span><span>{selected.kind} · {selected.format}</span></div>
              <div className="dqc-kv"><span>raw</span><span>{KB(selected.bytes)}</span></div>
              {selected.compressedBytes != null && (
                <div className="dqc-kv"><span>compressed</span><span>{KB(selected.compressedBytes)} ({(selected.bytes / Math.max(1, selected.compressedBytes)).toFixed(1)}×)</span></div>
              )}
              {/* Volumes and depths are re-expressed in the PROJECT unit system.
                  Storage stays metric-native; only the display converts. Mixed source
                  units (Volve has one well in mm) normalise to metres first. */}
              {Object.entries(selected.meta).filter(([, v]) => v != null && v !== '').map(([k, v]) => {
                let shown = String(v);
                const n = Number(v);
                if (Number.isFinite(n)) {
                  if (k === 'cumOilSm3') shown = oilVol(n, system).text;
                  else if (k === 'cumGasSm3') shown = gasVol(n, system).text;
                  else if (k === 'cumWaterSm3' || k === 'cumInjectedSm3') shown = waterVol(n, system).text;
                  else if (k === 'mdMin' || k === 'mdMax') {
                    const m = depthToMetres(n, String(selected.meta.depthUnit ?? 'm'));
                    shown = m == null ? `${shown} (unit unrecognised)` : depthQ(m, system).text;
                  }
                }
                return <div key={k} className="dqc-kv"><span>{k}</span><span>{shown}</span></div>;
              })}

              {(() => {
                const wellName = String(selected.meta.well ?? '');
                if (!kb || !wellName) return null;
                const { wellbore, well } = resolveWellbore(kb, wellName);
                if (!wellbore && !well) return null;
                return (
                  <>
                    <div className="dqc-h"><Link2 size={11} /> Master KB</div>
                    {wellbore && <div className="dqc-kv"><span>wellbore</span><span>{wellbore.wellbore_id.split(':').pop()}</span></div>}
                    {wellbore?.role && <div className="dqc-kv"><span>role</span><span>{wellbore.role}</span></div>}
                    {wellbore?.td_md_m != null && <div className="dqc-kv"><span>TD (MD)</span><span>{depthQ(wellbore.td_md_m, system).text}</span></div>}
                    {wellbore?.td_tvd_m != null && <div className="dqc-kv"><span>TD (TVD)</span><span>{depthQ(wellbore.td_tvd_m, system).text}</span></div>}
                    {well?.crs && <div className="dqc-kv"><span>KB CRS</span><span>{well.crs}</span></div>}
                  </>
                );
              })()}

              {selected.linked && selected.linked.matched.length > 0 && (
                <>
                  <div className="dqc-h"><Link2 size={11} /> Knowledge links · {selected.linked.entities} entities · {selected.linked.candidates} candidates</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, padding: '2px 0 4px' }}>
                    {selected.linked.matched.map((m) => (
                      <span key={m} className="dqc-pill pass" style={{ fontWeight: 500 }}>{m}</span>
                    ))}
                  </div>
                </>
              )}

              <div className="dqc-h">QC · {selected.qc.exceptions.length} exception{selected.qc.exceptions.length === 1 ? '' : 's'}</div>
              {selected.qc.exceptions.length === 0 && <div className="dqc-empty">Clean — no exceptions raised.</div>}
              {selected.qc.exceptions.map((e, i) => (
                <div key={i} className={`dqc-exc ${e.severity}`}>
                  <div className="dqc-exc-top"><span className="dqc-exc-rule">{e.rule}</span><span className={`dqc-pill ${e.severity === 'info' ? 'warn' : e.severity}`}>{e.severity}</span></div>
                  <div className="dqc-exc-msg">{e.message}</div>
                  <div className="dqc-exc-loc">@ {e.locator}</div>
                  {e.detail && <div className="dqc-exc-msg" style={{ opacity: 0.75 }}>{e.detail}</div>}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="dqc-h" style={{ marginTop: 0 }}><Database size={11} /> Storage · {fieldName}</div>
              <div className="dqc-kv"><span>assets</span><span>{assets.length}</span></div>
              <div className="dqc-kv"><span>raw retained</span><span>{KB(totals.raw)}</span></div>
              <div className="dqc-kv"><span>compressed</span><span>{KB(totals.comp)}</span></div>
              <div className="dqc-kv"><span>mode</span><span>{effectiveMode}</span></div>
              <div className="dqc-kv"><span>vertical</span><span>{vertical}</span></div>
              <div className="dqc-kv"><span>units</span><span>{system}</span></div>

              <ExtractionGate assets={assets} />

              {kb?.field && (
                <>
                  <div className="dqc-h"><Link2 size={11} /> Master KB context</div>
                  <div className="dqc-kv"><span>field</span><span>{kb.field.name}</span></div>
                  {kb.basin && <div className="dqc-kv"><span>basin</span><span>{kb.basin.name}{kb.basin.setting ? ` · ${kb.basin.setting}` : ''}</span></div>}
                  {kb.province && <div className="dqc-kv"><span>province</span><span>{kb.province.name}</span></div>}
                  {kb.region && <div className="dqc-kv"><span>region</span><span>{kb.region.name}</span></div>}
                  {kb.country && <div className="dqc-kv"><span>country</span><span>{kb.country.name}</span></div>}
                  {kb.field.operator && <div className="dqc-kv"><span>operator</span><span>{kb.field.operator}</span></div>}
                  {kb.field.discovery_well && <div className="dqc-kv"><span>discovery well</span><span>{kb.field.discovery_well}</span></div>}
                  {kb.petroleumSystems.length > 0 && (
                    <div className="dqc-kv"><span>petroleum systems</span><span>{kb.petroleumSystems.length}</span></div>
                  )}
                  {kb.assessmentUnits.length > 0 && (
                    <div className="dqc-kv"><span>assessment units</span><span>{kb.assessmentUnits.length}</span></div>
                  )}
                  <div className="dqc-kv"><span>KB wells · wellbores</span><span>{kb.wells.length} · {kb.wellbores.length}</span></div>
                  {kb.province?.oilMean_mmbbl != null && (
                    <div className="dqc-kv"><span>province oil (USGS mean)</span><span>{Number(kb.province.oilMean_mmbbl).toLocaleString()} MMbbl</span></div>
                  )}
                  {kb.province?.gasMean_bcf != null && (
                    <div className="dqc-kv"><span>province gas (USGS mean)</span><span>{Number(kb.province.gasMean_bcf).toLocaleString()} Bscf</span></div>
                  )}
                </>
              )}

              <div className="dqc-empty">Select an asset to inspect its QC report and provenance.</div>
            </>
          )}
        </aside>
      </div>

      {viewing && (() => {
        const a = assets.find((x) => x.id === viewing);
        return a ? <AssetViewer asset={a} onClose={() => setViewing(null)} /> : null;
      })()}
    </div>
  );
}

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
  Droplets, Eye, Info, ChevronDown, ChevronRight, Drill, Gauge,
} from 'lucide-react';
import { ExtractionGate } from './ExtractionGate.tsx';
import { AssetViewer } from './viewers/AssetViewer.tsx';
import { AuditView } from './AuditView.tsx';
import './dataqc.css';
import { ingestFile } from './ingest.ts';
import { ensureReferenceBundle } from './ensureBundle.ts';
import { isAvailable, listAssets, removeAsset } from './db.ts';
import { gateFor, qcConsistency } from './qc.ts';
import { assetsToManifest, countRecords } from './osdu.ts';
import { PIPELINE_STAGES, type AssetKind, type DataMode, type IngestedAsset, type Vertical } from './types.ts';
import { resolveKbContext, resolveWellbore, type KbContext } from './masterkb.ts';
import { curateInventory, COMPLETENESS_KINDS, ROLE_LABEL, type WellRole, type WellGroup, type WellheadSpec, type WellMetrics } from './curate.ts';
import { assetDisplayName, assetInsight } from './insight.ts';
import { wellKey } from './audit.ts';
import { readRecord } from './readDigest.ts';
import { useUnits, oilVol, gasVol, waterVol, depth as depthQ, depthToMetres } from '../units';

interface PicksPayload { picks: Array<{ well: string | null; surface: string; md: number }> }
interface WbIndexHeads {
  wellheads?: WellheadSpec[];
  wells?: Array<{ name: string; role?: string; purpose?: string | null; content?: string | null; metrics?: WellMetrics }>;
  official?: { stoiipMMSm3?: number; producedOilMMSm3?: number; oilRecoveryFactor?: number; authority?: string };
}

const BBL = 6.2898107;
const MMbbl = (sm3: number) => (sm3 * BBL) / 1e6;
/** Sm³/d → bopd. Rates are quoted in bopd on every production report. */
const bopd = (sm3d: number) => sm3d * BBL;

const KB = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);

const KIND_ICON = {
  log: Waves, surface: Layers, picks: Layers, trajectory: Waves,
  production: Activity, injection: Droplets, patterns: GitBranch,
  drilling: Drill, pressure: Gauge, wellmaster: Database,
  document: FileText, image: ImageIcon, unknown: FileText,
} as const;

/** Which kinds have a purpose-built viewer behind them. */
const VIEWABLE = new Set(['log', 'surface', 'trajectory', 'production', 'injection', 'document', 'picks', 'drilling', 'pressure']);

const ROLE_BADGE_CLASS: Record<WellRole, string> = {
  'oil-producer': 'producer', 'water-injector': 'injector', 'water-supply': 'watersupply',
  observation: 'observation', appraisal: 'appraisal', exploration: 'exploration',
  'not-drilled': 'notdrilled', unclassified: 'unclassified',
};

/** Curated inventory's role capsule — the one honest word for what this wellbore is,
 *  with a tooltip disclosing whether that came from the Master KB or was read off the
 *  ingested data itself (a well can be classified correctly without a KB match). */
function RoleBadge({ role, fromKb }: { role: WellRole; fromKb: boolean }) {
  return (
    <span
      className={`dqc-role dqc-role-${ROLE_BADGE_CLASS[role]}`}
      title={fromKb ? 'Published by the regulator (Sodir purpose + content)' : role === 'unclassified'
        ? 'No regulator record and no flowing asset ingested — genuinely unknown'
        : 'Inferred from the ingested production/injection data — no regulator record for this bore'}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

/** Small "4/5" completeness capsule with a per-kind tick row on hover via title. */
function CompletenessBadge({ group }: { group: WellGroup }) {
  const have = COMPLETENESS_KINDS.filter(({ flag }) => group[flag]).map(({ label }) => label);
  const missing = COMPLETENESS_KINDS.filter(({ flag }) => !group[flag]).map(({ label }) => label);
  return (
    <span className="dqc-completeness" title={`Has: ${have.join(', ') || 'none'}${missing.length ? ` · Missing: ${missing.join(', ')}` : ''}`}>
      {group.completeness}/{COMPLETENESS_KINDS.length}
    </span>
  );
}

export function DataQc({ fieldId, fieldName, vertical, dataMode = 'reference', view: viewProp, onViewChange }: {
  fieldId: string;
  fieldName: string;
  vertical: Vertical;
  dataMode?: DataMode;
  /** Supply to CONTROL the view from a host that owns its own pill row (Field
   *  Development's Data Explorer). When supplied, the internal row is not drawn —
   *  two rows steering one state is how they end up disagreeing. */
  view?: 'qc' | 'audit' | 'osdu';
  onViewChange?: (view: 'qc' | 'audit' | 'osdu') => void;
}) {
  const [assets, setAssets] = useState<IngestedAsset[]>([]);
  const [busy, setBusy] = useState<string[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [viewLocal, setViewLocal] = useState<'qc' | 'audit' | 'osdu'>('qc');
  const view = viewProp ?? viewLocal;
  const setView = onViewChange ?? setViewLocal;
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState<{ done: number; total: number; label: string } | null>(null);
  const [kind, setKind] = useState<AssetKind | 'all'>('all');
  const [viewing, setViewing] = useState<string | null>(null);
  const [showDeliveryQc, setShowDeliveryQc] = useState(false);
  const [kb, setKb] = useState<KbContext | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [picksByWell, setPicksByWell] = useState<Map<string, number> | null>(null);
  const [picksAssetId, setPicksAssetId] = useState<string | null>(null);
  const [wellheads, setWellheads] = useState<WellheadSpec[] | null>(null);
  const [rolesByBore, setRolesByBore] = useState<Map<string, WellRole> | null>(null);
  const [metricsByBore, setMetricsByBore] = useState<Map<string, WellMetrics> | null>(null);
  const [official, setOfficial] = useState<WbIndexHeads['official'] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { system } = useUnits();

  // Master KB link — resolves this field into the authored spine
  // (field → basin → province → region, plus its wells/wellbores).
  useEffect(() => { resolveKbContext(fieldId).then(setKb).catch(() => setKb(null)); }, [fieldId]);

  // Picks arrive as ONE delivery-wide asset (picks.json) — attribute them per well
  // (same pattern as AuditView) so the curated inventory can show a well's tops
  // without inventing a per-well picks asset that doesn't exist.
  useEffect(() => {
    const pk = assets.find((a) => a.kind === 'picks');
    if (!pk) { setPicksByWell(null); setPicksAssetId(null); return; }
    let dead = false;
    (async () => {
      const data = await readRecord<PicksPayload>(pk);
      if (dead || !data?.picks) return;
      const m = new Map<string, number>();
      for (const p of data.picks) {
        if (!p.well) continue;
        m.set(wellKey(p.well), (m.get(wellKey(p.well)) ?? 0) + 1);
      }
      setPicksByWell(m);
      setPicksAssetId(pk.id);
    })().catch(() => { /* curated list degrades to "picks unattributed", never breaks */ });
    return () => { dead = true; };
  }, [assets]);

  const refresh = useCallback(() => {
    if (!isAvailable()) return;
    listAssets(fieldId).then(setAssets).catch(() => setAssets([]));
  }, [fieldId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Reference packages load themselves. Volve is the proof case: its delivery already
  // ships with the app, so the tab is never empty for a bundled field — and the
  // numbers on screen are produced by the real pipeline, not seeded.
  // Digests are cached in IndexedDB, so this cost is paid once per browser.
  useEffect(
    () => ensureReferenceBundle(fieldId, vertical, setLoading, refresh),
    [fieldId, vertical, refresh],
  );

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

  const renderAssetRow = (a: IngestedAsset) => {
    const Ic = KIND_ICON[a.kind] ?? FileText;
    return (
      <div key={a.id} className={'dqc-row' + (sel === a.id ? ' sel' : '')} onClick={() => setSel(a.id)}>
        <span className="dqc-row-ic"><Ic size={14} /></span>
        <span className="dqc-row-main">
          <span className="dqc-row-name">
            {/* many Volve wells export the same source filename, and horizons export a
                machine name — lead with the entity, keep the file as provenance */}
            {assetDisplayName(a)}
          </span>
          {/* what the data SAYS, measured from its own digest — curves present, depth
              reached, volumes produced. The filename is provenance, not information. */}
          {(() => {
            const chips = assetInsight(a, system);
            return chips.length ? (
              <span className="dqc-row-facts">
                {chips.map((c) => (
                  <span key={c.label} className="dqc-fact" title={c.title}>
                    <i>{c.label}</i>{c.value}
                  </span>
                ))}
              </span>
            ) : null;
          })()}
          <span className="dqc-row-meta">
            {a.fileName} · {a.format} · {KB(a.bytes)}
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
  };

  /** One WELLBORE under a wellhead: its own assets, plus the cross-references that
   *  belong to it but live in a shared delivery (formation tops, reports) or on a
   *  sibling bore (a sidetrack with no survey of its own). */
  const renderBore = (
    g: WellGroup,
    shown: IngestedAsset[],
    h: { motherBore: string | null; deepestBore: string | null; producedBy: string | null; productionFiledOn: string | null },
  ) => {
    const isCollapsed = collapsed.has(g.key);
    const isMother = h.motherBore === g.well;
    const isDeepest = h.deepestBore === g.well;
    // the bore the volumes physically came from, even when filed against another name
    const isProducer = h.producedBy === g.well;
    const filedHere = h.productionFiledOn === g.well;
    return (
      <div key={g.key} className="dqc-wellgrp">
        <button className="dqc-wellgrp-head" onClick={() => toggleCollapsed(g.key)}>
          {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
          <span className="dqc-wellgrp-name">{g.well}</span>
          {isMother && <span className="dqc-bore-tag mother" title="Drilled from the wellhead — the original bore">mother</span>}
          {isDeepest && <span className="dqc-bore-tag deepest" title="Deepest terminal bore — the last one to reach the reservoir">deepest</span>}
          {isProducer && !filedHere && (
            <span className="dqc-bore-tag produces" title={`Production is filed against ${h.productionFiledOn}, but this is the bore it can physically have come from`}>
              produces
            </span>
          )}
          <RoleBadge role={g.role} fromKb={g.roleFromKb} />
          <CompletenessBadge group={g} />
          <span className="dqc-wellgrp-count">{shown.length} asset{shown.length === 1 ? '' : 's'}</span>
        </button>
        {!isCollapsed && (
          <>
            {g.trajectoryVia && (kind === 'all' || kind === 'trajectory') && (
              <div className="dqc-xref" onClick={() => setViewing(g.trajectoryVia!.assetId)}>
                <GitBranch size={12} />
                <span>No survey of its own — path via slot sibling <b>{g.trajectoryVia.well}</b></span>
                <Eye size={12} />
              </div>
            )}
            {g.picksCount != null && g.picksAssetId && (kind === 'all' || kind === 'picks') && (
              <div className="dqc-xref" onClick={() => setViewing(g.picksAssetId!)}>
                <Layers size={12} />
                <span><b>{g.picksCount}</b> formation top{g.picksCount === 1 ? '' : 's'} · from the shared picks delivery</span>
                <Eye size={12} />
              </div>
            )}
            {g.linkedDocuments.length > 0 && (kind === 'all' || kind === 'document') && g.linkedDocuments.map((d) => (
              <div key={d.id} className="dqc-xref" onClick={() => setViewing(d.id)}>
                <FileText size={12} />
                <span>Report: <b>{String(d.meta.title ?? d.fileName)}</b></span>
                <Eye size={12} />
              </div>
            ))}
            {shown.map((a) => renderAssetRow(a))}
          </>
        )}
      </div>
    );
  };

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

  // Curated view: grouped by wellbore, ranked producer/injector-with-full-data first,
  // appraisal/exploration next, unclassified last — see curate.ts for the rules.
  // Curated from the FULL asset list (not `visible`) so completeness/role reflect the
  // whole wellbore even while a kind filter narrows which of its assets are SHOWN —
  // filtering to "logs" must not make a 4/5-complete well look 1/5-complete.
  // Wellhead→wellbore genealogy from the WELL MASTER — an ingested asset like every
  // other file, not a side-channel fetch of the raw index. Resolved by the build from
  // each bore's own `drilled_from`, so the app never guesses the tree from names.
  // Reading it from the store is what keeps this screen and the workspace's Input tree
  // on one source: both see the master only once it has actually been digested.
  useEffect(() => {
    const master = assets.find((a) => a.kind === 'wellmaster');
    if (!master) { setWellheads(null); return; }
    let dead = false;
    readRecord<WbIndexHeads>(master)
      .then((v) => {
        if (dead) return;
        setWellheads(v?.wellheads ?? null);
        // Sodir purpose+content, already resolved to a role by the build — the
        // authority for what each bore is FOR
        const m = new Map<string, WellRole>();
        for (const w of v?.wells ?? []) {
          if (w.role && w.role !== 'none') m.set(wellKey(w.name), w.role as WellRole);
        }
        setRolesByBore(m.size ? m : null);
        const mm = new Map<string, WellMetrics>();
        for (const w of v?.wells ?? []) if (w.metrics) mm.set(wellKey(w.name), w.metrics);
        setMetricsByBore(mm.size ? mm : null);
        setOfficial(v?.official ?? null);
      })
      .catch(() => { if (!dead) { setWellheads(null); setRolesByBore(null); } });
    return () => { dead = true; };
  }, [assets]);

  const curated = useMemo(
    () => curateInventory(assets, kb, {
      picksByWell: picksByWell ?? undefined, picksAssetId,
      wellheads: wellheads ?? undefined,
      rolesByBore: rolesByBore ?? undefined,
      metricsByBore: metricsByBore ?? undefined,
    }),
    [assets, kb, picksByWell, picksAssetId, wellheads, rolesByBore, metricsByBore],
  );
  const toggleCollapsed = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);
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
        {viewProp === undefined && (
          <span className="dqc-mode">
            <button className={view === 'qc' ? 'on' : ''} onClick={() => setView('qc')}>QC</button>
            <button className={view === 'audit' ? 'on' : ''} onClick={() => setView('audit')}>AUDIT</button>
            <button className={view === 'osdu' ? 'on' : ''} onClick={() => setView('osdu')}>OSDU</button>
          </span>
        )}
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
                  Delivery inventory · {assets.length} assets · {curated.groups.length} wellbores
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

              {/* FIELD ACCOUNTING — the regulator's own volumes. Shown here because a
                  per-well recovery factor is not derivable (no per-well in-place
                  volume exists in this delivery); the FIELD factor is, and it is the
                  number every well's share should be read against. */}
              {official?.stoiipMMSm3 != null && (
                <div className="dqc-official">
                  <Database size={12} />
                  <span>
                    Field <b>STOIIP {MMbbl(official.stoiipMMSm3 * 1e6).toFixed(0)} MMbbl</b> ·
                    recovered <b>{MMbbl((official.producedOilMMSm3 ?? 0) * 1e6).toFixed(0)} MMbbl</b> ·
                    <b> RF {((official.oilRecoveryFactor ?? 0) * 100).toFixed(1)}%</b>
                    <em> — {official.authority}. Per-well recovery factor is not shown: no per-well in-place volume exists in this delivery.</em>
                  </span>
                </div>
              )}

              {/* ── WELLHEAD → WELLBORE. A wellhead is the surface slot; under it sit
                  the mother bore and its sidetracks. Production is filed against one
                  bore but the volumes come from whichever bore actually reached the
                  reservoir — surfaced explicitly rather than silently reassigned. ── */}
              {curated.wellheads.map((h) => {
                const boreRows = h.bores
                  .map((g) => ({ g, shown: kind === 'all' ? g.assets : g.assets.filter((a) => a.kind === kind) }))
                  .filter(({ g, shown }) => shown.length || g.picksCount || g.linkedDocuments.length || g.trajectoryVia);
                if (!boreRows.length) return null;
                const headKey = `wh:${h.well}`;
                const headCollapsed = collapsed.has(headKey);
                return (
                  <div key={headKey} className="dqc-wellhead">
                    <button className="dqc-wellhead-head" onClick={() => toggleCollapsed(headKey)}>
                      {headCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                      <span className="dqc-wellhead-name">{h.well}</span>
                      <span className="dqc-wellhead-kind">wellhead</span>
                      <RoleBadge role={h.role} fromKb />
                      <span className="dqc-completeness" title="data types present anywhere under this slot">
                        {h.completeness}/{COMPLETENESS_KINDS.length}
                      </span>
                      {/* PERFORMANCE — what this well actually made. Producers are
                          sorted by cumulative oil, so the numbers explain the order. */}
                      {h.metrics && h.metrics.cumOilSm3 > 0 && (
                        <span className="dqc-perf">
                          <b>{MMbbl(h.metrics.cumOilSm3).toFixed(2)}</b> MMbbl
                          {h.metrics.shareOfFieldCumPct != null && <i>{h.metrics.shareOfFieldCumPct}% of field</i>}
                          {h.metrics.lastOilRateSm3d != null && (
                            <i title={`Final month on production: ${h.metrics.lastOilMonth}`}>
                              last {bopd(h.metrics.lastOilRateSm3d).toFixed(0)} bopd
                            </i>
                          )}
                          {h.metrics.lastWaterCut != null && (
                            <i className={h.metrics.lastWaterCut >= 90 ? 'wet' : ''} title="Water cut in the final producing month">
                              WCT {h.metrics.lastWaterCut}%
                            </i>
                          )}
                        </span>
                      )}
                      {h.metrics && h.metrics.cumOilSm3 === 0 && h.metrics.cumInjectedSm3 > 0 && (
                        <span className="dqc-perf inj">
                          <b>{MMbbl(h.metrics.cumInjectedSm3).toFixed(2)}</b> MMbbl injected
                          <i>{h.metrics.months} months</i>
                        </span>
                      )}
                      <span className="dqc-wellgrp-count">
                        {h.bores.length} wellbore{h.bores.length === 1 ? '' : 's'}
                      </span>
                    </button>
                    {!headCollapsed && (
                      <>
                        {/* the honest production statement: which bore it is FILED on,
                            and which bore it can physically have come from */}
                        {h.productionBasis && (
                          <div className="dqc-wellhead-note">
                            <Info size={12} />
                            <span>
                              Production filed on <b>{h.productionFiledOn}</b>, attributed to{' '}
                              <b>{h.producedBy}</b> — {h.productionBasis}
                            </span>
                          </div>
                        )}
                        {h.missingAncestors.length > 0 && (
                          <div className="dqc-wellhead-note warn">
                            <GitBranch size={12} />
                            <span>
                              Parent bore{h.missingAncestors.length > 1 ? 's' : ''} named by the survey but not held:{' '}
                              <b>{h.missingAncestors.join(', ')}</b>
                            </span>
                          </div>
                        )}
                        <div className="dqc-bores">{boreRows.map(({ g, shown }) => renderBore(g, shown, h))}</div>
                      </>
                    )}
                  </div>
                );
              })}

              {/* ── field-level: not attributable to one wellbore ── */}
              {(() => {
                const shown = kind === 'all' ? curated.fieldLevel : curated.fieldLevel.filter((a) => a.kind === kind);
                if (!shown.length) return null;
                return (
                  <div className="dqc-wellgrp">
                    <div className="dqc-wellgrp-head static">
                      <span className="dqc-wellgrp-name">Field-level</span>
                      <span className="dqc-wellgrp-count">{shown.length} asset{shown.length === 1 ? '' : 's'} · not attributed to a wellbore</span>
                    </div>
                    {shown.map((a) => renderAssetRow(a))}
                  </div>
                );
              })()}
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
        return a ? <AssetViewer asset={a} onClose={() => setViewing(null)} kb={kb} /> : null;
      })()}
    </div>
  );
}

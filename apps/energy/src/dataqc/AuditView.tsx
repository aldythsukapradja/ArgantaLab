// dataqc/AuditView.tsx — the data availability audit.
//
// One matrix: every wellbore this field is expected to have (Master KB spine)
// crossed with every data type the workspace tracks. A filled cell states what
// is there and how much; an empty cell is a real, visible gap rather than an
// omitted row. Clicking a filled cell opens that asset's viewer.
import { useEffect, useMemo, useState } from 'react';
import { Check, Minus, AlertTriangle, Database, FileWarning } from 'lucide-react';
import type { IngestedAsset } from './types.ts';
import type { KbContext } from './masterkb.ts';
import { readRecord } from './readDigest.ts';
import { AUDIT_COLUMNS, COLUMN_LABEL, wellKey, buildAudit, type AuditColumn } from './audit.ts';

interface PicksPayload { picks: Array<{ well: string | null; surface: string; md: number }> }

export function AuditView({ assets, kb, onOpen }: {
  assets: IngestedAsset[];
  kb: KbContext | null;
  onOpen: (assetId: string) => void;
}) {
  const [picksByWell, setPicksByWell] = useState<Map<string, number> | null>(null);
  const [picksAssetId, setPicksAssetId] = useState<string | null>(null);

  // picks arrive as one delivery-wide asset; attribute them per well so the
  // matrix can show which wellbores actually carry formation tops
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
        const k = wellKey(p.well);
        m.set(k, (m.get(k) ?? 0) + 1);
      }
      setPicksByWell(m);
      setPicksAssetId(pk.id);
    })().catch(() => { /* audit degrades to "picks unattributed", never breaks */ });
    return () => { dead = true; };
  }, [assets]);

  const audit = useMemo(() => buildAudit({
    assets,
    kbWellboreIds: kb?.wellbores.map((w) => w.wellbore_id) ?? [],
    picksByWell: picksByWell ?? undefined,
    picksAssetId,
  }), [assets, kb, picksByWell, picksAssetId]);

  if (!assets.length) {
    return <div className="dqc-empty">Nothing ingested yet — the audit reports on real assets only.</div>;
  }

  const pct = (n: number) => (audit.wellCount ? Math.round((n / audit.wellCount) * 100) : 0);

  return (
    <div className="dqa">
      <div className="dqa-cov">
        {AUDIT_COLUMNS.map((c) => (
          <div key={c} className="dqa-cov-cell">
            <span className="dqa-cov-l">{COLUMN_LABEL[c]}</span>
            <span className="dqa-cov-v">{audit.coverage[c]}<i>/{audit.wellCount}</i></span>
            <span className="dqa-cov-bar"><i style={{ width: `${pct(audit.coverage[c])}%` }} /></span>
          </div>
        ))}
      </div>

      <div className="dqa-tablewrap">
        <table className="dqa-table">
          <thead>
            <tr>
              <th className="dqa-wcol">Wellbore</th>
              {AUDIT_COLUMNS.map((c) => <th key={c}>{COLUMN_LABEL[c]}</th>)}
              <th className="dqa-score">Have</th>
            </tr>
          </thead>
          <tbody>
            {audit.wells.map((w) => (
              <tr key={w.key} className={w.have === 0 ? 'dqa-none' : undefined}>
                <td className="dqa-wcol">
                  <span className="dqa-wname">{w.well}</span>
                  {!w.inKb && <span className="dqa-tag" title="Has data but no Master KB wellbore record">no KB record</span>}
                </td>
                {AUDIT_COLUMNS.map((c) => {
                  const cell = w.cells[c as AuditColumn];
                  if (!cell.present) {
                    return <td key={c} className="dqa-cell absent"><Minus size={11} /></td>;
                  }
                  return (
                    <td key={c} className={`dqa-cell present s-${cell.status ?? 'pass'}`}>
                      <button
                        type="button"
                        disabled={!cell.assetId}
                        onClick={() => cell.assetId && onOpen(cell.assetId)}
                        title={cell.assetId ? 'Open viewer' : undefined}
                      >
                        <Check size={11} />
                        <span>{cell.detail ?? 'present'}</span>
                      </button>
                    </td>
                  );
                })}
                <td className="dqa-score">{w.have}<i>/{AUDIT_COLUMNS.length}</i></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {audit.emptyWells.length > 0 && (
        <div className="dqa-note warn">
          <FileWarning size={12} />
          <span>
            <b>{audit.emptyWells.length} wellbore{audit.emptyWells.length === 1 ? '' : 's'} with no ingested data</b> —
            {' '}{audit.emptyWells.join(', ')}. Known to the Master KB spine, but nothing in this delivery.
          </span>
        </div>
      )}

      {audit.notInKb.length > 0 && (
        <div className="dqa-note warn">
          <AlertTriangle size={12} />
          <span>
            <b>{audit.notInKb.length} wellbore{audit.notInKb.length === 1 ? '' : 's'} carry data but have no Master KB record</b> —
            {' '}{audit.notInKb.join(', ')}. Provenance gap: the data is real, the master-data row is missing.
          </span>
        </div>
      )}

      {audit.fieldLevel.length > 0 && (
        <>
          <div className="dqc-h"><Database size={11} /> Field-level assets · {audit.fieldLevel.length}</div>
          <div className="dqa-field">
            {audit.fieldLevel.map((f) => (
              <button key={f.id} type="button" className={`dqa-fitem s-${f.status}`} onClick={() => onOpen(f.id)}>
                <span className="dqa-fkind">{f.kind}</span>
                <span className="dqa-fname">{f.name}</span>
                {f.detail && <span className="dqa-fdetail">{f.detail}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

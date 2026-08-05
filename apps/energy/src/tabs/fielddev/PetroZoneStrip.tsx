// PetroZoneStrip — the zone summary (P8).
//
// Two scopes, one table:
//   THIS WELL   the bore on the bench, in depth order — you are reading a log
//   ALL WELLS   every logged bore in the field, ranked by NET METRES — you are
//               choosing a target
// Depth order and rank order answer different questions, so the sort follows the
// scope rather than being a separate control to remember.
//
// Every row names its WELL and its FORMATION. A table of numbers with neither is
// unreadable the moment it leaves the screen it was computed on.
//
// ── QC vs FORWARD — the distinction this file is built around ────────────────
//
// Where the delivery ships its own interpreted curves (Equinor's LFP on Volve) the
// row also carries `refStats`, and the Δ column shows how far our recompute sits
// from that known answer. That is QC, permanently available, and it is the whole
// reason the calibration bores matter.
//
// But the numbers that go FORWARD — into the static model, volumetrics, the FDP —
// are ArgantaEnergy's own, always. Never theirs, never a blend. The table says so in
// its footer and the Δ column is visibly a comparison rather than a value, because a
// field model assembled half from our interpretation and half from someone else's is
// a model nobody can defend.
import { useMemo, useState } from 'react';
import { AlertTriangle, Layers, Loader2 } from 'lucide-react';
import { useScene } from './scene';
import { useUnits, depth as depthQ } from '../../units';
import { useFieldZones, rankByNet, type FieldZoneRow } from './petro-field';
import type { PetroParams } from './petro-compute';
import type { PetroWell } from './petro-well';
import type { Workspace } from './workspace-model';

type Scope = 'well' | 'field';

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

/** A row, whichever scope produced it. The single-well scope maps its zones onto the
 *  same shape so the table body is written once. */
type Row = FieldZoneRow;

export function PetroZoneStrip({ ws, well, params }: {
  ws: Workspace;
  well: PetroWell;
  params: PetroParams;
}) {
  const sel = useScene((s) => s.sel);
  const setSel = useScene((s) => s.setSel);
  const { system } = useUnits();
  const [scope, setScope] = useState<Scope>('well');
  const { bore, zones, result } = well;

  // the field pass only runs once you ask for it — it reads every log digest
  const field = useFieldZones(ws, params, scope === 'field');

  const rows: Row[] = useMemo(() => {
    if (scope === 'field') return rankByNet(field.rows);
    if (!bore) return [];
    return zones.map((z) => ({
      id: `${bore.key}|${z.name}`,
      well: bore.name, boreKey: bore.key, role: bore.role,
      formation: z.name, top: z.top, base: z.base, tint: z.tint,
      stats: z.stats,
      // the single-well QC comparison lives on the bench header (RMS per curve);
      // per-zone reference averaging is the field pass's job
      refStats: null,
    }));
  }, [scope, field.rows, zones, bore]);

  const totals = useMemo(() => rows.reduce((acc, r) => ({
    net: acc.net + (r.stats?.netM ?? 0),
    gross: acc.gross + (r.stats?.grossM ?? 0),
  }), { net: 0, gross: 0 }), [rows]);

  const anyRef = rows.some((r) => r.refStats);

  const Header = (
    <div className="pzs-scope">
      <button className={scope === 'well' ? 'on' : ''} onClick={() => setScope('well')}
        title="The bore on the bench, in depth order">
        This well{bore ? ` · ${bore.name}` : ''}
      </button>
      <button className={scope === 'field' ? 'on' : ''} onClick={() => setScope('field')}
        title="Every logged bore in the field, ranked by net metres">
        All wells
      </button>
      {scope === 'field' && field.running && (
        <span className="pzs-progress"><Loader2 size={10} className="spin" /> {field.done}/{field.total}</span>
      )}
    </div>
  );

  if (scope === 'well' && !bore) {
    return <div className="pzs">{Header}<div className="pzs-empty"><Layers size={18} /><b>No bore selected</b></div></div>;
  }

  if (!rows.length) {
    return (
      <div className="pzs">
        {Header}
        <div className="pzs-empty">
          <Layers size={18} />
          {scope === 'field' && field.running ? (
            <><b>Interpreting {field.total} bores…</b><span>Reading each log digest and running the current parameter set over it.</span></>
          ) : (
            <>
              <b>No picks on {bore?.name}</b>
              <span>An interval needs a top and a base. Without a pick there is nothing to average over — so this bore reports no zone statistics rather than an interval invented from the log’s own extent.</span>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pzs">
      {Header}
      <div className={'pzs-head' + (anyRef ? ' with-ref' : '')}>
        <span className="pzs-h-zone">{scope === 'field' ? 'Well · formation' : 'Formation'}</span>
        <span>Gross</span><span>Net</span><span>N:G</span><span>φe</span><span>Sw</span>
        {anyRef && <span title="Our net metres minus the delivery’s own interpreted net — QC only, never carried forward">Δnet</span>}
      </div>
      <div className="pzs-rows">
        {rows.map((r, i) => {
          const s = r.stats;
          const empty = !s || s.nSamples === 0;
          const on = sel === `wpick:${r.well}:${r.formation}` || sel === 'top:' + r.formation;
          const dNet = r.refStats && s ? s.netM - r.refStats.netM : null;
          return (
            <div key={r.id}
              className={'pzs-row' + (on ? ' sel' : '') + (empty ? ' empty' : '') + (anyRef ? ' with-ref' : '')}
              title={empty
                ? 'The log carries no evaluable sample in this interval — no statistic is reported rather than a zero'
                : `${r.well} · ${r.formation}\n${s!.nSamples.toLocaleString('en-US')} samples · ${depthQ(r.top, system).text} – ${depthQ(r.base, system).text}`
                  + (r.refStats ? `\nQC: the delivery’s own interpretation gives ${r.refStats.netM.toFixed(1)} m net here` : '')}
              onClick={() => setSel(`wpick:${r.well}:${r.formation}`)}>
              <span className="pzs-zone">
                {scope === 'field' && <em className="pzs-rank">{i + 1}</em>}
                <i style={{ background: r.tint }} />
                <span className="pzs-names">
                  {scope === 'field' && <u>{r.well}</u>}
                  <b>{r.formation}</b>
                  <em>{Math.round(r.top)}–{Math.round(r.base)} m</em>
                </span>
              </span>
              {empty ? (
                <span className="pzs-hole" style={{ gridColumn: `span ${anyRef ? 6 : 5}` }}>no evaluable sample</span>
              ) : (
                <>
                  <span>{s!.grossM.toFixed(1)}</span>
                  <span className="pzs-net">{s!.netM.toFixed(1)}</span>
                  <span className="pzs-ng">
                    <i style={{ width: `${Math.min(100, s!.ntg * 100)}%` }} />
                    <u>{pct(s!.ntg)}</u>
                  </span>
                  <span>{s!.netM > 0 ? s!.phie.toFixed(3) : '—'}</span>
                  <span>{s!.netM > 0 ? s!.sw.toFixed(3) : '—'}</span>
                  {anyRef && (
                    <span className={'pzs-delta' + (dNet == null ? ' none' : Math.abs(dNet) <= 2 ? ' ok' : ' off')}>
                      {dNet == null ? '—' : `${dNet > 0 ? '+' : ''}${dNet.toFixed(1)}`}
                    </span>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="pzs-foot">
        <div className="pzs-foot-nums">
          <b>{rows.length}</b> {scope === 'field' ? 'intervals across ' : 'intervals'}
          {scope === 'field' && <><b>{new Set(rows.map((r) => r.boreKey)).size}</b> bores</>}
          {' · net '}<b>{totals.net.toFixed(1)} m</b> of <b>{totals.gross.toFixed(1)} m</b> gross
          {totals.gross > 0 && <> · <b>{pct(totals.net / totals.gross)}</b> N:G</>}
        </div>
        {/* the rule, stated where the numbers are read */}
        <div className="pzs-forward">
          <b>ArgantaEnergy interpretation</b> — these are the numbers that go forward to
          the static model. {anyRef
            ? 'Δnet compares them with the delivery’s own interpreted curves for QC; that comparison is never carried forward.'
            : 'Where a delivery ships its own interpreted curves, a Δ column appears for QC only.'}
        </div>
        {result?.missing.sw && scope === 'well' && <em className="pzs-warn">{result.missing.sw}</em>}
        {scope === 'field' && field.skipped.length > 0 && (
          <em className="pzs-warn">
            <AlertTriangle size={9} /> {field.skipped.length} bore{field.skipped.length === 1 ? '' : 's'} produced no interval:{' '}
            {field.skipped.slice(0, 4).map((s) => `${s.well} (${s.why})`).join(', ')}
            {field.skipped.length > 4 ? ` +${field.skipped.length - 4} more` : ''}
          </em>
        )}
      </div>
    </div>
  );
}

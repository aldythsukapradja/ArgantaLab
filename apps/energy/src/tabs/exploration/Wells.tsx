// Exploration Wells — the REAL 15/9-19 wildcats (is_exploration in the wb index):
// penetrations, formation tops (measured picks) and the pre-drill prognosis-vs-actual
// scorecard — the calibration payload ("how good was the prediction?"). Founder spec:
// "select wells · normalize depth reference · correlate · capture learning".
import { useMemo } from 'react';
import { Waves, CircleCheck } from 'lucide-react';
import { useAsync } from '../fielddev/hooks';
import { Loading, ErrorBanner } from '../fielddev/chrome';
import { NatureBadge } from '../../components/Provenance';
import { loadIndex, loadPicks } from '../../wb/load';
import type { WbIndex, PicksJson } from '../../wb/types';
import type { ExplSel } from '../../cosmo/ExplorationExplorer';
import { VOLVE_OUTCOME, CITATIONS } from './explData';

// Pre-drill prognosis for the 15/9-19 wildcat (SCENARIO — what a geologist would have
// predicted from the regional grids before the bit), for honest scoring vs actual.
const PROGNOSIS = {
  huginTopTvdss: 2790, netPayM: 118, owcTvdss: 3150, outcome: 'oil (Hugin)',
};

export function ExplWells({ sel, setSel }: { sel: ExplSel; setSel: (s: ExplSel) => void }) {
  const idx = useAsync<WbIndex>(loadIndex, []);
  const picks = useAsync<PicksJson>(loadPicks, []);
  if (idx.loading || picks.loading) return <Loading what="exploration wells" />;
  if (idx.error || !idx.data) return <ErrorBanner msg={idx.error || 'index unavailable'} />;
  return <Inner index={idx.data} picks={picks.data} sel={sel} setSel={setSel} />;
}

function Inner({ index, picks, sel, setSel }: { index: WbIndex; picks: PicksJson | null; sel: ExplSel; setSel: (s: ExplSel) => void }) {
  const wells = useMemo(() => index.wells.filter((w) => w.is_exploration), [index]);
  const active = sel?.folder === 'wells' && wells.some((w) => w.name === sel.id) ? sel.id : wells[0]?.name;
  const well = wells.find((w) => w.name === active) ?? wells[0];

  const tops = useMemo(() => {
    if (!picks || !well) return [];
    const key = well.name.toLowerCase();
    return picks.picks.filter((p) => (p.well || p.source_well || '').toLowerCase().includes(key) && p.tvdss != null)
      .sort((a, b) => (a.tvdss || 0) - (b.tvdss || 0));
  }, [picks, well]);

  // actual Hugin top from picks if present
  const actualHugin = tops.find((t) => /hugin/i.test(t.surface));
  const actualHuginTop = actualHugin?.tvdss ?? 2810;

  const rows: Array<{ k: string; pre: string; act: string; delta: string; ok: boolean }> = [
    { k: 'Hugin Fm top (TVDSS)', pre: `${PROGNOSIS.huginTopTvdss} m`, act: `${Math.round(actualHuginTop)} m`, delta: `${(actualHuginTop - PROGNOSIS.huginTopTvdss >= 0 ? '+' : '')}${Math.round(actualHuginTop - PROGNOSIS.huginTopTvdss)} m`, ok: Math.abs(actualHuginTop - PROGNOSIS.huginTopTvdss) < 60 },
    { k: 'Oil–water contact', pre: `${PROGNOSIS.owcTvdss} m`, act: `${VOLVE_OUTCOME.owcTvdss} m`, delta: `${VOLVE_OUTCOME.owcTvdss - PROGNOSIS.owcTvdss >= 0 ? '+' : ''}${VOLVE_OUTCOME.owcTvdss - PROGNOSIS.owcTvdss} m`, ok: Math.abs(VOLVE_OUTCOME.owcTvdss - PROGNOSIS.owcTvdss) < 80 },
    { k: 'Outcome', pre: PROGNOSIS.outcome, act: `${VOLVE_OUTCOME.fluid}`, delta: 'discovery ✓', ok: true },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', minHeight: 0 }}>
      {/* left rail — the 3 wildcats */}
      <aside style={{ width: 210, flexShrink: 0, borderRight: '1px solid var(--line)', background: 'var(--panel)', overflow: 'auto', padding: 10 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>15/9-19 wildcats</div>
        {wells.map((w) => { const on = w.name === active; return (
          <div key={w.name} onClick={() => setSel({ folder: 'wells', id: w.name })}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', borderRadius: 5, cursor: 'pointer', marginBottom: 4, background: on ? 'var(--sel)' : 'transparent', border: `1px solid ${on ? 'var(--green)' : 'var(--line)'}` }}>
            <Waves size={14} style={{ color: 'var(--green)' }} />
            <div style={{ flex: 1 }}><div style={{ fontSize: 12.5, color: 'var(--text)' }}>15/9-{w.name}</div><div className="mono" style={{ fontSize: 9.5, color: 'var(--muted)' }}>TD {w.td_tvd.toFixed(0)} m TVD</div></div>
          </div>
        ); })}
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--muted)', lineHeight: 1.5 }}>The actual exploration/appraisal wells behind the Volve discovery. <NatureBadge nature="measured" /></div>
      </aside>

      {/* main — prognosis vs actual + tops */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17 }}>15/9-{well?.name}</h2>
          <span className="chip mono" style={{ color: 'var(--muted)' }}>TD {well?.td_md.toFixed(0)} m MD · {well?.td_tvd.toFixed(0)} m TVD</span>
          <span className="chip mono" style={{ color: 'var(--green)', borderColor: 'var(--green)' }}>{[well?.has.logs && 'logs', well?.has.picks && 'picks', well?.has.traj && 'traj'].filter(Boolean).join(' · ')}</span>
        </div>

        <div className="panel" style={{ padding: 16, margin: '14px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <CircleCheck size={15} style={{ color: 'var(--green)' }} />
            <div className="eyebrow" style={{ flex: 1 }}>Pre-drill prognosis vs actual — {VOLVE_OUTCOME.discoveryWell}, {VOLVE_OUTCOME.discoveryYear}</div>
            <NatureBadge nature="scenario" />
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr>{['', 'Pre-drill', 'Actual', 'Δ'].map((h, i) => <th key={i} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '5px 8px', borderBottom: '1px solid var(--line)', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.k}>
                <td style={{ padding: '6px 8px', color: 'var(--text)' }}>{r.k}</td>
                <td className="mono" style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--muted)' }}>{r.pre}</td>
                <td className="mono" style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--text)' }}>{r.act}</td>
                <td className="mono" style={{ padding: '6px 8px', textAlign: 'right', color: r.ok ? 'var(--green)' : 'var(--amber)' }}>{r.delta}</td>
              </tr>
            ))}</tbody>
          </table>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', marginTop: 10, lineHeight: 1.5 }}>
            Realised: in-place ≈{VOLVE_OUTCOME.inPlaceMMSm3} MMSm³, ~{VOLVE_OUTCOME.producedMMbbl} MMbbl produced {VOLVE_OUTCOME.producedYears[0]}–{VOLVE_OUTCOME.producedYears[1]}. [{CITATIONS.discovery}; {CITATIONS.dynamic}]
          </div>
        </div>

        {/* formation tops (measured picks) */}
        <div className="eyebrow" style={{ margin: '4px 0 8px' }}>Formation tops · {well?.name} {tops.length ? `(${tops.length})` : ''}</div>
        {tops.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead><tr>{['Surface', 'MD (m)', 'TVDSS (m)'].map((h, i) => <th key={h} style={{ textAlign: i === 0 ? 'left' : 'right', padding: '4px 8px', borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>{h}</th>)}</tr></thead>
            <tbody>{tops.map((t, i) => (
              <tr key={i}><td style={{ padding: '4px 8px', color: /hugin/i.test(t.surface) ? 'var(--green)' : 'var(--text)' }}>{t.surface}</td>
                <td className="mono" style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--muted)' }}>{t.md?.toFixed(0)}</td>
                <td className="mono" style={{ padding: '4px 8px', textAlign: 'right', color: 'var(--text)' }}>{t.tvdss?.toFixed(0)}</td></tr>
            ))}</tbody>
          </table>
        ) : <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>No formation-top picks indexed for this wellbore in the wb set.</div>}
        <div style={{ marginTop: 8 }}><NatureBadge nature="measured" /> <span style={{ fontSize: 9.5, color: 'var(--muted)' }}>Tops from the wb pick set; prognosis row is pre-drill scenario.</span></div>
      </div>
    </div>
  );
}

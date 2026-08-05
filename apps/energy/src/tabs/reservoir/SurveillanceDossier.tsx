// SurveillanceDossier.tsx — the Reservoir Management Knowledge Bank.
//
// The third sibling of the Basin Dossier (Exploration) and the Asset Dossier (Field
// Development), one decision further down the chain:
//
//     "Is this reservoir being drained efficiently — what is it doing now, why is the
//      water arriving the way it is, and what must I act on next?"
//
// Same skeleton, surveillance semantics:
//   header    field identity + three numbers, each of which is the button to its detail
//   left      field locator map
//   middle    SURVEILLANCE TIMELINE — the signature chart, calendar months forwards,
//             oil rate + water cut + injection + dated events on one canvas
//   right     three verdict cards: Depletion · Water path (Chan) · Pressure support
//   bottom    well watchlist (ranked worst-first) + sweep benchmark
//   modals    performance · support · wells · ledger · sources
//
// Grounding is enforced in surveillance-dossier.ts, not here: this file renders nulls as
// "—" and never substitutes a zero. The surveillance ledger is treated as a RESULT — for
// the world catalogue (no monthly series) it is the honest output, not an error state.
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarClock, Database, Droplets, GaugeCircle, Info, Layers3,
  MapPinned, ShieldAlert, TrendingDown, Waves, X,
} from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { CockpitMap } from '../../cosmo/CockpitMap';
import { loadKnowledgeContext, type KnowledgeContext } from '../fielddev/field-knowledge';
import { lastLiveIdx, loadRMData, SM3_TO_BBL, type RMData } from './data';
import { annualPct, chanWor, cumulativeVrr, wellHealth, type MonthVols } from '../../engine/surveillance';
import { arps, blindTest, expCumToLimit, fitDecline } from '../../engine/review';
import { buildWellReviews, type WellReviewInput } from './well-review';
import { WellReviewCards } from './WellReviewCards';
import {
  buildSurveillanceDossier, fmtNum, fmtPct, MECHANISM_LABEL, STAGE_LABEL, STAGE_PROGRESS, SUPPORT_LABEL,
  type SurveillanceDossier as Dossier, type SurveillanceInput, type WaterMechanism,
} from './surveillance-dossier';
import { BenchmarkChartView, DonutChartView, StageChartView, VoidageChartView } from './SurveillanceChartViews';
import { MSCF_PER_BOE, type VoidageEvent, type VoidagePoint } from '../../engine/charts/SurveillanceCharts';
import './surveillance-dossier.css';

type Pop = 'performance' | 'support' | 'wells' | 'ledger' | 'sources' | null;

/** Volve's published dynamic-model in-place volume (MMSm³ → MMstb). Model OOIP, never
 *  a booked reserve — the label on screen says exactly that. */
const VOLVE_OOIP_MMSTB = 22 * SM3_TO_BBL;

function Modal({ title, sub, onClose, children, wide }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="rms-sd-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <div className={'rms-sd-lightbox-inner' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>
        <header><div><span>{sub}</span><b>{title}</b></div><button onClick={onClose} aria-label="Close"><X size={16} /></button></header>
        <div className="rms-sd-modal-body">{children}</div>
      </div>
    </div>
  );
}

export function SurveillanceDossierView({ field }: { field: SearchEntry }) {
  const [context, setContext] = useState<KnowledgeContext | null>(null);
  const [rm, setRm] = useState<RMData | null>(null);
  const [pop, setPop] = useState<Pop>(null);
  const isVolve = field.name.toUpperCase() === 'VOLVE';

  useEffect(() => {
    let alive = true;
    setContext(null); setRm(null); setPop(null);
    void loadKnowledgeContext(field).then((v) => { if (alive) setContext(v); });
    if (isVolve) void loadRMData().then((v) => { if (alive) setRm(v); }).catch(() => { if (alive) setRm(null); });
    return () => { alive = false; };
  }, [field, isVolve]);

  // ── the surveillance input: real monthly series when we have them, the catalogue's
  //    ANNUAL record when we don't. Which one we used is stated on screen. ──────────
  const input: SurveillanceInput | null = useMemo(() => {
    if (rm) {
      const f = rm.field;
      const chan = chanWor(f.t, f.oilRate, f.waterRate);
      // remaining reserves from the decline fit, to the economic limit
      const monthlyOil = f.raw.map((m) => m.oil);
      const s = monthlyOil.findIndex((v) => v > 0);
      const series = s < 0 ? [] : monthlyOil.slice(s);
      let remainingMMstb: number | null = null;
      if (series.length > 6) {
        const fit = fitDecline(series);
        const qEcon = Math.max(...series, 1) * 0.02;
        const lastRate = arps(fit.qi, fit.Di, fit.b, series.length - 1 - fit.peakIdx);
        remainingMMstb = (expCumToLimit(Math.max(lastRate, qEcon), fit.Di, qEcon) * SM3_TO_BBL) / 1e6;
      }
      return {
        ym: f.ym, oilRate: f.oilRate, waterRate: f.waterRate, gasRate: f.gasRate, injRate: f.injRate, wct: f.wct,
        vrrCum: f.vrr.cum, vrrFinal: f.vrr.final, bhp: f.bhp,
        cumOilMM: f.cumOilMM, cumWinjMM: f.cumWinjMM,
        ooipMMstb: VOLVE_OOIP_MMSTB, remainingMMstb,
        mechanism: chan.mechanism as WaterMechanism, mechanismSlope: chan.slope,
        wells: rm.producers.map((w) => {
          const wi = lastLiveIdx(w);
          const up = w.uptime.filter((v): v is number => v != null);
          const uptime = up.length ? up[up.length - 1] : null;
          return {
            well: w.well, role: w.role,
            cumOilMM: w.cumOilMM, wct: w.wct[wi] ?? 0, uptime,
            health: wellHealth({ wct: (w.wct[wi] ?? 0) / 100, uptime: uptime ?? 1, declineRate: Math.max(0, -annualPct(w.oilRate) / 100) }),
            worTrendPct: annualPct(w.wor), oilTrendPct: annualPct(w.oilRate),
          };
        }),
      };
    }
    // catalogue path — GOGET files ANNUAL production only; no injection, no water cut,
    // no gauge. Everything absent stays absent and surfaces in the ledger.
    if (!context?.detail) return null;
    const byYear = new Map<number, number>();
    for (const r of context.detail.production ?? []) {
      const u = (r.unitConverted ?? '').toLowerCase();
      if (r.year == null || r.valueConverted == null || !u.includes('million bbl')) continue;
      byYear.set(r.year, (byYear.get(r.year) ?? 0) + r.valueConverted);
    }
    const years = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
    if (!years.length) return null;
    const rate = years.map(([, v]) => (v * 1e6) / 365);   // MMstb/yr → bopd-equivalent
    return {
      ym: years.map(([y]) => String(y)),
      oilRate: rate, waterRate: years.map(() => 0), gasRate: years.map(() => 0), injRate: years.map(() => 0),
      wct: years.map(() => 0), vrrCum: [], vrrFinal: 0, bhp: years.map(() => null),
      cumOilMM: years.reduce((s2, [, v]) => s2 + v, 0), cumWinjMM: 0,
      ooipMMstb: null, remainingMMstb: null,
      mechanism: 'undetermined', mechanismSlope: 0, wells: [],
    };
  }, [rm, context]);

  const dossier: Dossier | null = useMemo(() => (input ? buildSurveillanceDossier(input) : null), [input]);
  const annualOnly = !rm && !!input;
  const dep = dossier?.depletion, sup = dossier?.support, disp = dossier?.displacement, eff = dossier?.efficiency;

  // ── D3 chart feeds ──────────────────────────────────────────────────────────
  const focus = useMemo(
    () => (field.fly ? { lon: field.fly.lon, lat: field.fly.lat, zoom: 8 } : null),
    [field.fly],
  );

  const voidage: VoidagePoint[] = useMemo(() => {
    if (!input || !dossier) return [];
    const liveEnd = dossier.depletion.latestYm ? input.ym.indexOf(dossier.depletion.latestYm) : input.ym.length - 1;
    return input.ym.map((label, i) => {
      const gasMscf = input.gasRate[i] ?? 0;
      return {
        label,
        oil: input.oilRate[i] ?? 0,
        water: input.waterRate[i] ?? 0,
        gas: gasMscf / MSCF_PER_BOE,   // Mscf/d → boe/d so the stack shares one axis
        gasMscf,
        inj: input.injRate[i] ?? 0,
        vrr: input.vrrCum.length ? input.vrrCum[i] ?? null : null,
        live: i <= liveEnd,
      };
    });
  }, [input, dossier]);

  const voidageEvents: VoidageEvent[] = useMemo(
    () => (dossier?.events ?? []).map((e) => ({ id: e.id, label: e.label, index: e.index, note: e.note })),
    [dossier],
  );

  const cutSlices = useMemo(() => {
    const w = disp?.currentWct;
    if (w == null) return [];
    return [
      { key: 'Oil', value: Math.max(0, 100 - w), color: 'var(--green,#10b981)' },
      { key: 'Water', value: w, color: 'var(--blue,#3b82f6)' },
    ];
  }, [disp]);

  const stageSteps = useMemo(() => (
    (['start-up', 'plateau', 'decline', 'tail', 'ceased'] as const).map((k) => ({ key: STAGE_LABEL[k], at: STAGE_PROGRESS[k] }))
  ), []);

  // ── the Well Review Register: every producer's card, fully derived ──────────
  const wellReviews = useMemo(() => {
    if (!rm) return [];
    const fieldCumMM = rm.field.cumOilMM;
    const inputs: WellReviewInput[] = rm.producers.map((w) => {
      const meta = rm.index.wells.find((x) => x.name === w.well);
      // EVERY pattern that supports this producer — a well fed by two injectors must be
      // balanced against both, not against whichever pattern happened to be listed first
      // (that understated support badly: one injector read 0.61 against a real ~1.0).
      const pats = rm.patterns.patterns.filter((p) => p.producers.some((q) => q.well === w.well));
      let patternVrr: number | null = null;
      if (pats.length) {
        const members = new Set<string>();
        for (const p of pats) { members.add(p.injector); for (const q of p.producers) members.add(q.well); }
        const rows: MonthVols[] = [];
        for (const m of rm.wells.filter((x) => members.has(x.well))) {
          m.raw.forEach((v, k) => {
            const acc = rows[k] ?? (rows[k] = { oil: 0, water: 0, wi: 0 });
            acc.oil += v.oil; acc.water += v.water; acc.wi += v.wi;
          });
        }
        const c = cumulativeVrr(rows);
        patternVrr = Number.isFinite(c.final) && c.final > 0 ? c.final : null;
      }
      // per-well decline → remaining volume, and the blind test that scores it
      const monthly = w.raw.map((m) => m.oil);
      const s = monthly.findIndex((v) => v > 0);
      const ser = s < 0 ? [] : monthly.slice(s);
      let remainingMMstb: number | null = null, declineMapePct: number | null = null;
      if (ser.length > 8) {
        const fit = fitDecline(ser);
        const qEcon = Math.max(...ser, 1) * 0.02;
        const last = arps(fit.qi, fit.Di, fit.b, ser.length - 1 - fit.peakIdx);
        remainingMMstb = (expCumToLimit(Math.max(last, qEcon), fit.Di, qEcon) * SM3_TO_BBL) / 1e6;
        declineMapePct = blindTest(ser, 0.6).mapePct;
      }
      const chan = chanWor(w.t, w.oilRate, w.waterRate);
      return {
        well: w.well, role: w.role, ym: w.ym,
        oilRate: w.oilRate, waterRate: w.waterRate, gasRate: w.gasRate,
        wct: w.wct, wor: w.wor, uptime: w.uptime, bhp: w.bhp,
        cumOilMM: w.cumOilMM,
        tdMd: meta?.td_md ?? null, tdTvd: meta?.td_tvd ?? null,
        fieldCumMM,
        patternName: pats.length ? pats.map((p) => p.injector).join(' + ') : null, patternVrr,
        patternInjectors: pats.map((p) => p.injector),
        mechanism: chan.mechanism as WaterMechanism, mechanismSlope: chan.slope,
        remainingMMstb, declineMapePct,
      };
    });
    return buildWellReviews(inputs);
  }, [rm]);

  const vrrSpec = useMemo(() => ({
    low: 0.9, mid: 1, high: 1.15, observed: sup?.vrr ?? null, scaleMax: 2,
  }), [sup]);

  const effSpec = useMemo(() => ({
    low: eff?.bandLow ?? 0.05, mid: eff?.bandMid ?? 0.3, high: eff?.bandHigh ?? 0.55,
    observed: eff?.recoveryPct ?? null, scaleMax: 0.7,
  }), [eff]);

  const kpi = (Icon: typeof Database, label: string, value: string, sub: string, onClick?: () => void, tone?: string) => (
    <button className={'rms-sd-kpi' + (onClick ? ' live' : '') + (tone ? ' tone-' + tone : '')} onClick={onClick} disabled={!onClick}>
      <span><Icon size={10} />{label}</span><b>{value}</b><small>{sub}</small>
    </button>
  );

  const acts = dossier?.ledger.filter((g) => g.severity === 'act').length ?? 0;

  return (
    <section className="rms-sd" aria-label={`${field.name} Surveillance Dossier`}>
      {/* ── header ───────────────────────────────────────────────────────────── */}
      <header className="rms-sd-head">
        <div className="rms-sd-id">
          <span className="rms-sd-eyebrow"><Waves size={11} /> Surveillance Dossier</span>
          <h2>{field.name}</h2>
          <p>{context?.hierarchy[0]?.value ?? 'Resolving province…'} · {sup?.scheme ?? '—'}{dep ? ` · ${STAGE_LABEL[dep.stage]}` : ''}</p>
        </div>
        <div className="rms-sd-kpis">
          {kpi(Droplets, 'Recovered', `${fmtNum(input?.cumOilMM ?? null)} MMSTB`,
            eff?.recoveryPct != null ? `${fmtPct(eff.recoveryPct)} of model OOIP` : 'no in-place volume on record',
            () => setPop('performance'), eff?.tone)}
          {kpi(GaugeCircle, 'Pressure support', sup?.vrr != null ? sup.vrr.toFixed(2) : '—',
            sup ? SUPPORT_LABEL[sup.klass] : '—', () => setPop('support'), sup?.tone)}
          {kpi(TrendingDown, 'Remaining', input?.remainingMMstb != null ? `${fmtNum(input.remainingMMstb)} MMSTB` : '—',
            input?.remainingMMstb != null ? 'decline forecast to economic limit' : 'not derivable from this record',
            () => setPop('performance'))}
          {kpi(ShieldAlert, 'Actions', String(dossier?.ledger.length ?? 0),
            acts ? `${acts} require intervention` : 'open surveillance ledger', () => setPop('ledger'),
            acts ? 'bad' : dossier?.ledger.length ? 'warn' : 'good')}
        </div>
      </header>

      {/* ── map ──────────────────────────────────────────────────────────────── */}
      <section className="rms-sd-panel rms-sd-map">
        <div className="rms-sd-panel-title"><MapPinned size={13} /><span>Field</span><em>{field.source}</em></div>
        {/* Cockpit-grade basemap: real satellite imagery with the single clean boundary
            line (overlay="minimal"), the same treatment the Basin Dossier uses. */}
        <div className="rms-sd-mapwrap">
          <CockpitMap dark mode="2d" theme="satellite" overlay="minimal" focus={focus} onSelect={() => {}} />
          <div className="rms-sd-maplabel"><b>{field.name}</b><span>{context?.hierarchy[0]?.value ?? field.parent}</span></div>
        </div>
        <div className="rms-sd-facts">
          <div><span>Province</span><b>{context?.hierarchy[0]?.value ?? '…'}</b></div>
          <div><span>Petroleum system</span><b>{context?.hierarchy[1]?.value ?? '…'}</b></div>
        </div>
      </section>

      {/* ── the signature chart ──────────────────────────────────────────────── */}
      <section className="rms-sd-panel rms-sd-tl">
        <div className="rms-sd-panel-title">
          <Activity size={13} /><span>Voidage &amp; production</span>
          <em>{annualOnly ? 'annual · catalogue record' : 'monthly · production ▲ injection ▼ · VRR overlay'}</em>
        </div>
        {voidage.length
          ? <VoidageChartView data={voidage} events={voidageEvents} onPickEvent={() => setPop('performance')}
              xUnit={annualOnly ? 'year' : 'year (monthly steps)'}
              yUnit="rate · boe/d ▲ produced ▼ injected" y2Unit="VRR · cumulative (—)" />
          : <div className="rms-sd-empty"><b>{context ? 'No production record' : 'Loading surveillance record…'}</b>
              <span>{context ? 'this field has no dated production in the catalogue — the ledger below is the finding' : ''}</span></div>}
      </section>

      {/* ── verdict rail ─────────────────────────────────────────────────────── */}
      <aside className="rms-sd-rail">
        <article className={'rms-sd-card tone-' + (dep?.tone ?? 'unknown')}>
          <div className="rms-sd-card-h"><CalendarClock size={12} /><span>Depletion</span></div>
          <b>{dep ? STAGE_LABEL[dep.stage] : '—'}</b>
          <StageChartView steps={stageSteps} at={dep ? STAGE_PROGRESS[dep.stage] : 0} ceased={dep?.stage === 'ceased'} />
          <small>{dep?.detail ?? 'no rate history'}</small>
        </article>

        <article className={'rms-sd-card tone-' + (disp?.tone ?? 'unknown')}>
          <div className="rms-sd-card-h"><Layers3 size={12} /><span>Water path</span>
            {disp && disp.mechanism !== 'undetermined' && <i className="rms-sd-chip">Chan · slope {disp.slope}</i>}</div>
          <b>{disp ? MECHANISM_LABEL[disp.mechanism] : '—'}</b>
          {cutSlices.length
            ? <DonutChartView slices={cutSlices} centre={`${Math.round(disp?.currentWct ?? 0)}%`} sub="water" />
            : <div className="rms-sd-nodata">no water-cut series</div>}
          <small>{disp?.breakthroughYm ? `Breakthrough ${disp.breakthroughYm} · ${disp.action}` : disp?.action ?? ''}</small>
        </article>

        <article className={'rms-sd-card tone-' + (sup?.tone ?? 'unknown')}>
          <div className="rms-sd-card-h"><GaugeCircle size={12} /><span>Pressure support</span></div>
          <b>{sup ? SUPPORT_LABEL[sup.klass] : '—'}</b>
          {sup?.vrr != null
            ? <><BenchmarkChartView spec={vrrSpec} /><em className="rms-sd-scalecap">balanced band 0.9–1.15</em></>
            : <div className="rms-sd-nodata">no injection record</div>}
          <small>{sup?.detail ?? ''}{sup?.bhpDrawdown != null ? ` · BHP −${Math.round(sup.bhpDrawdown)} psi` : ''}</small>
        </article>
      </aside>

      {/* ── well watchlist ───────────────────────────────────────────────────── */}
      <section className="rms-sd-panel rms-sd-wells">
        <div className="rms-sd-panel-title"><Activity size={13} /><span>Well review</span>
          <em>{wellReviews.length ? `${wellReviews.length} producers · worst first · click to expand` : 'field-level record'}</em>
        </div>
        <WellReviewCards rows={wellReviews} byWell={rm?.byWell ?? {}} />
      </section>

      {/* ── sweep benchmark ──────────────────────────────────────────────────── */}
      <section className="rms-sd-panel rms-sd-bench-panel">
        <div className="rms-sd-panel-title"><Info size={13} /><span>Recovery vs class</span><em>class prior</em></div>
        {eff ? (
          <div className="rms-sd-bench">
            <div className="rms-sd-bench-head"><b>{eff.className}</b><span>{eff.basis === 'class-prior' ? `class band · n=${eff.n}` : 'unmatched'}</span></div>
            <BenchmarkChartView spec={effSpec} />
            <div className="rms-sd-bench-legend">
              <span><i className="band" />class {fmtPct(eff.bandLow)}–{fmtPct(eff.bandHigh)}</span>
              {eff.recoveryPct != null
                ? <span><i className="obs" />recovered <b>{fmtPct(eff.recoveryPct)}</b></span>
                : <span className="muted">recovery not derivable — no in-place volume</span>}
            </div>
            <p className="rms-sd-note">{eff.note}</p>
            <p className="rms-sd-note">Measured against a <b>model OOIP</b>, not a booked reserve — Reservoir Management never re-derives volumes.</p>
          </div>
        ) : <div className="rms-sd-empty small"><b>No recovery read</b><span>needs an in-place volume</span></div>}
      </section>

      {/* ── modals ───────────────────────────────────────────────────────────── */}
      {pop === 'performance' && input && dossier && (
        <Modal title="Production performance" sub={field.name} onClose={() => setPop(null)} wide>
          <div className="rms-sd-mgrid">
            <Fact k="Cumulative oil" v={`${fmtNum(input.cumOilMM)} MMSTB`} m={`${input.ym[0]} – ${dossier.depletion.latestYm ?? '—'}`} />
            <Fact k="Peak rate" v={dossier.depletion.peakRate != null ? `${Math.round(dossier.depletion.peakRate).toLocaleString()} ${annualOnly ? 'bopd (annual avg)' : 'bopd'}` : '—'} m={dossier.depletion.peakYm ?? ''} />
            <Fact k="Latest rate" v={dossier.depletion.latestRate != null ? `${Math.round(dossier.depletion.latestRate).toLocaleString()} bopd` : '—'} m={dossier.depletion.latestYm ?? ''} />
            <Fact k="Fraction of peak" v={fmtPct(dossier.depletion.fractionOfPeak)} m={STAGE_LABEL[dossier.depletion.stage]} />
            <Fact k="Recovery" v={fmtPct(dossier.efficiency.recoveryPct)} m={dossier.efficiency.ooipMMstb ? `of ${fmtNum(dossier.efficiency.ooipMMstb)} MMSTB model OOIP` : 'no in-place volume'} />
            <Fact k="Remaining (DCA)" v={input.remainingMMstb != null ? `${fmtNum(input.remainingMMstb)} MMSTB` : '—'} m="decline to economic limit" />
          </div>
          <h4>Dated events</h4>
          <table className="rms-sd-table"><tbody>
            {dossier.events.map((e) => <tr key={e.id}><td>{e.ym}</td><td><b>{e.label}</b></td><td>{e.note}</td></tr>)}
            {!dossier.events.length && <tr><td colSpan={3}>no dated surveillance events</td></tr>}
          </tbody></table>
          {annualOnly && <p className="rms-sd-note">This field reports <b>annual</b> catalogue production only. Rates are year-averaged; no injection, water-cut or pressure series exists to diagnose against.</p>}
        </Modal>
      )}

      {pop === 'support' && sup && (
        <Modal title="Pressure support & voidage" sub={field.name} onClose={() => setPop(null)}>
          <div className="rms-sd-mgrid">
            <Fact k="Scheme" v={sup.scheme} m={`${sup.injectors} injector${sup.injectors === 1 ? '' : 's'} on record`} />
            <Fact k="Cumulative VRR" v={sup.vrr != null ? sup.vrr.toFixed(3) : '—'} m={SUPPORT_LABEL[sup.klass]} />
            <Fact k="Water injected" v={`${fmtNum(input?.cumWinjMM ?? null)} MMbbl`} m="cumulative" />
            <Fact k="Flowing BHP" v={sup.bhpFirst != null ? `${Math.round(sup.bhpFirst)} → ${Math.round(sup.bhpLast ?? 0)} psi` : '—'} m={sup.bhpDrawdown != null ? `drawdown ${Math.round(sup.bhpDrawdown)} psi` : 'no gauge on record'} />
          </div>
          <p className="rms-sd-note">VRR is a <b>reservoir-volume</b> balance (Bo·oil + Bw·water against injected water). A value near 1.0 means injection is replacing the voidage produced — the field is being pressure-maintained rather than depleted.</p>
        </Modal>
      )}

      {pop === 'wells' && dossier && (
        <Modal title="Well watchlist" sub={`${dossier.watchlist.length} producers · worst health first`} onClose={() => setPop(null)} wide>
          <table className="rms-sd-table">
            <thead><tr><th>Well</th><th>Health</th><th>Water cut</th><th>WOR trend</th><th>Finding</th></tr></thead>
            <tbody>
              {dossier.watchlist.map((w) => (
                <tr key={w.well}>
                  <td><b>{w.well}</b></td><td>{w.health.toFixed(0)}</td><td>{w.wct.toFixed(0)}%</td>
                  <td className={w.worTrendPct > 30 ? 'warn' : ''}>{w.worTrendPct > 0 ? '+' : ''}{w.worTrendPct.toFixed(0)}%/yr</td>
                  <td>{w.flag ?? <span className="muted">nominal</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Modal>
      )}

      {pop === 'ledger' && dossier && (
        <Modal title="Surveillance ledger" sub="what to act on, what is still unknown" onClose={() => setPop(null)}>
          <ul className="rms-sd-ledger">
            {dossier.ledger.map((g, i) => (
              <li key={i} className={'sev-' + g.severity}><span className="sev">{g.severity === 'act' ? 'ACT' : g.severity === 'watch' ? 'WATCH' : 'GAP'}</span>
                <div><b>{g.what}</b><small>{g.why}</small></div></li>
            ))}
            {!dossier.ledger.length && <li className="sev-gap"><div><b>No findings</b><small>every surveillance stream is present and within band</small></div></li>}
          </ul>
          <p className="rms-sd-note">The ledger is a <b>result</b>, not an error state — for most of the world catalogue a full gap list is the honest output of a field with no surveillance series.</p>
        </Modal>
      )}

      {pop === 'sources' && (
        <Modal title="Sources" sub={field.name} onClose={() => setPop(null)}>
          <ul className="rms-sd-ledger">
            <li className="sev-gap"><div><b>{rm ? 'Volve monthly production & injection' : 'GOGET field catalogue'}</b><small>{rm ? 'Equinor Volve open dataset — daily volumes aggregated to monthly means' : 'annual reported production and reserves'}</small></div></li>
            {context?.hierarchy.map((h) => <li key={h.label} className="sev-gap"><div><b>{h.label}</b><small>{h.value} · {h.source}</small></div></li>)}
          </ul>
        </Modal>
      )}
    </section>
  );
}

function Fact({ k, v, m }: { k: string; v: string; m: string }) {
  return <div className="rms-sd-fact"><span>{k}</span><b>{v}</b><small>{m}</small></div>;
}

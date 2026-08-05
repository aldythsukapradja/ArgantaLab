// PetroParamsRail — the live parameter rail (P1 · P2).
//
// A rail, not a tab: changing `m` while looking at a crossplot and changing it while
// looking at a log are the same act, so the controls stay put and the view changes
// around them. Every control here drives `petro-compute.runPetro` directly — move a
// cutoff and the net ribbon redraws, change the Vsh method and every downstream track
// follows, because there is one computation and this is its input.
//
// Three rules the rail keeps:
//
//  1. A control that the current model IGNORES is disabled and says so. Simandoux's
//     closed form fixes n at 2; leaving the n box editable would let you set a number
//     that is then silently discarded, which is worse than not offering it.
//  2. Every value shows its NATURE. An endpoint resolved from the well's own
//     distribution is `derived`; one read off the delivery's GRMIN/GRMAX curves is
//     `interpreted` — theirs, not ours; one you typed is `user`.
//  3. Rw is CHECKED where the delivery lets us check it. The salinity route computes
//     an Rw and, if an RW curve exists on this bore, reports the gap against it —
//     so a salinity that reproduces the measured curve can be told apart from one
//     that merely sounds plausible.
import { useMemo, useState } from 'react';
import { Activity, Beaker, Database, Gauge, Layers, RotateCcw, Ruler, Sigma, Waves } from 'lucide-react';
import {
  DEFAULT_PARAMS, rwFromSalinity, salinityFromRw, tempAtDepth,
  swModelHonoursN, swModelUsesRsh,
  type PetroParams, type SwModel, type PorosityModel, type VshMethod,
} from './petro-compute';
import type { PetroWell } from './petro-well';
import type { Workspace } from './workspace-model';

const VSH_METHODS: Array<{ id: VshMethod; label: string }> = [
  { id: 'linear', label: 'Linear (IGR)' },
  { id: 'larionov_tertiary', label: 'Larionov — tertiary' },
  { id: 'larionov_older', label: 'Larionov — older rocks' },
];
const POROSITY_MODELS: Array<{ id: PorosityModel; label: string; needs: string }> = [
  { id: 'density', label: 'Density', needs: 'RHOB' },
  { id: 'density-neutron', label: 'Density–neutron', needs: 'RHOB + NPHI' },
  { id: 'sonic', label: 'Sonic (Wyllie)', needs: 'DT' },
];
const SW_MODELS: Array<{ id: SwModel; label: string; note: string }> = [
  { id: 'archie', label: 'Archie', note: 'clean sand' },
  { id: 'simandoux', label: 'Simandoux', note: 'laminated shale · n fixed at 2' },
  { id: 'indonesia', label: 'Indonesia', note: 'dispersed shale — the North Sea workhorse' },
];
/** Common matrices, so ρma is a choice with a name rather than a number to remember. */
const MATRICES: Array<{ label: string; v: number }> = [
  { label: 'Sandstone', v: 2.65 }, { label: 'Limestone', v: 2.71 }, { label: 'Dolomite', v: 2.87 },
];

function Num({ label, value, step = 0.01, min, max, onChange, disabled, title }: {
  label: string; value: number; step?: number; min?: number; max?: number;
  onChange: (v: number) => void; disabled?: boolean; title?: string;
}) {
  return (
    <label className={'ppr-num' + (disabled ? ' off' : '')} title={title}>
      <span>{label}</span>
      <input type="number" value={value} step={step} min={min} max={max} disabled={disabled}
        onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) onChange(v); }} />
    </label>
  );
}

function Slider({ label, value, min, max, step, onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string;
}) {
  return (
    <label className="ppr-slider">
      <span>{label}<b>{value.toFixed(2)}</b></span>
      <input type="range" value={value} min={min} max={max} step={step}
        onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function PetroParamsRail({ ws, well, params, onChange }: {
  ws: Workspace;
  /** the current bore's interpretation — the rail reports against what it produced */
  well: PetroWell | null;
  params: PetroParams;
  onChange: (next: PetroParams) => void;
}) {
  const set = <K extends keyof PetroParams>(k: K, v: PetroParams[K]) => onChange({ ...params, [k]: v });
  const setCut = (k: keyof PetroParams['cutoffs'], v: number) =>
    onChange({ ...params, cutoffs: { ...params.cutoffs, [k]: v } });

  // ── the Rw / salinity panel's own local state ──
  const [ppm, setPpm] = useState(100000);
  const [surfaceC, setSurfaceC] = useState(4);       // seabed, North Sea
  const [gradC, setGradC] = useState(3.5);           // °C per 100 m
  const [tvd, setTvd] = useState(3100);              // reservoir depth

  const tempC = tempAtDepth(tvd, surfaceC, gradC);
  const rwFromPpm = rwFromSalinity(ppm, tempC);

  /** The delivery's own RW curve, if this bore ships one — the check on the route above. */
  const measuredRw = useMemo(() => {
    // look for the RW curve itself, not for a proxy — a bore could ship Rw without
    // shipping a full interpretation, and that Rw is still the better authority
    const c = well?.log?.curves.find((x) => x.mnemonic.toUpperCase() === 'RW');
    if (!c) return null;
    const v = c.values.filter((x): x is number => x != null && Number.isFinite(x)).sort((a, b) => a - b);
    return v.length ? v[v.length >> 1] : null;
  }, [well]);

  const endpoints = well?.result?.endpoints ?? null;
  const counts = well?.result?.counts;
  const missing = well?.result?.missing;

  const curveWells = (k: string) => ws.curveTypes.find((t) => t.key === k)?.wells.length ?? 0;

  return (
    <aside className="pps-rail">
      <div className="pps-rail-head">
        <Sigma size={12} /> Parameters
        <button className="ppr-reset" title="Back to the screening defaults"
          onClick={() => onChange(DEFAULT_PARAMS)}><RotateCcw size={10} /></button>
      </div>

      <div className="pps-rail-scope">
        <span>Scope</span>
        <div className="pps-scope-chain">
          {['Field', 'Zone', 'Well', 'Interval'].map((s, i) => (
            <span key={s} className={'pps-scope' + (i === 0 ? ' on' : '')}
              title={i === 0 ? 'Active — these values apply to every bore' : 'Not yet wired (P1)'}>{s}</span>
          ))}
        </div>
        <small>Most-specific wins. Field scope is live; zone/well/interval overrides land with P1.</small>
      </div>

      <div className="pps-rail-scroll">
        {/* ── Vsh ── */}
        <div className="pps-rail-sec">
          <div className="pps-rail-sec-head"><Ruler size={11} /><b>Vsh</b>
            {counts && <em>{counts.vsh.toLocaleString('en-US')} pts</em>}</div>
          <select value={params.vshMethod} onChange={(e) => set('vshMethod', e.target.value as VshMethod)}>
            {VSH_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <div className="ppr-row">
            <Num label="GR clean" value={params.grClean ?? Math.round(endpoints?.clean ?? 20)} step={1}
              onChange={(v) => set('grClean', v)} title="Leave blank-equivalent by resetting to use the auto endpoint" />
            <Num label="GR shale" value={params.grShale ?? Math.round(endpoints?.shale ?? 120)} step={1}
              onChange={(v) => set('grShale', v)} />
          </div>
          {endpoints && (
            <small className="ppr-nature">
              <Database size={9} /> active: {endpoints.clean.toFixed(1)} → {endpoints.shale.toFixed(1)} API
              <i className={'pps-nature n-' + endpoints.nature}>{endpoints.nature}</i>
            </small>
          )}
          {(params.grClean != null || params.grShale != null) && (
            <button className="ppr-link" onClick={() => onChange({ ...params, grClean: null, grShale: null })}>
              use this well’s own P5/P95 instead
            </button>
          )}
          {missing?.vsh && <small className="ppr-missing">{missing.vsh}</small>}
          <small><Database size={9} /> GR in {curveWells('GR')} bores across the delivery</small>
        </div>

        {/* ── porosity ── */}
        <div className="pps-rail-sec">
          <div className="pps-rail-sec-head"><Waves size={11} /><b>Porosity</b>
            {counts && <em>{counts.phie.toLocaleString('en-US')} pts</em>}</div>
          <select value={params.porosityModel} onChange={(e) => set('porosityModel', e.target.value as PorosityModel)}>
            {POROSITY_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} · needs {m.needs}</option>)}
          </select>
          <div className="ppr-chips">
            {MATRICES.map((m) => (
              <button key={m.label} className={params.rhoMa === m.v ? 'on' : ''}
                onClick={() => set('rhoMa', m.v)}>{m.label} {m.v}</button>
            ))}
          </div>
          <div className="ppr-row">
            <Num label="ρma" value={params.rhoMa} step={0.01} onChange={(v) => set('rhoMa', v)} />
            <Num label="ρfl" value={params.rhoFl} step={0.01} onChange={(v) => set('rhoFl', v)} />
            <Num label="φsh" value={params.phiSh} step={0.01} min={0} max={1} onChange={(v) => set('phiSh', v)} />
          </div>
          {params.porosityModel === 'sonic' && (
            <div className="ppr-row">
              <Num label="Δtma" value={params.dtMa} step={0.5} onChange={(v) => set('dtMa', v)} />
              <Num label="Δtfl" value={params.dtFl} step={1} onChange={(v) => set('dtFl', v)} />
            </div>
          )}
          {missing?.phie && <small className="ppr-missing">{missing.phie}</small>}
          <small><Database size={9} /> RHOB {curveWells('RHOB')} · NPHI {curveWells('NPHI')} · DT {curveWells('DT')} bores</small>
        </div>

        {/* ── saturation ── */}
        <div className="pps-rail-sec">
          <div className="pps-rail-sec-head"><Activity size={11} /><b>Saturation</b>
            {counts && <em>{counts.sw.toLocaleString('en-US')} pts</em>}</div>
          <select value={params.swModel} onChange={(e) => set('swModel', e.target.value as SwModel)}>
            {SW_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label} · {m.note}</option>)}
          </select>
          <div className="ppr-row">
            <Num label="a" value={params.a} step={0.05} onChange={(v) => set('a', v)} />
            <Num label="m" value={params.m} step={0.05} onChange={(v) => set('m', v)} />
            <Num label="n" value={params.n} step={0.05} onChange={(v) => set('n', v)}
              disabled={!swModelHonoursN(params.swModel)}
              title={swModelHonoursN(params.swModel) ? undefined : 'Simandoux’s closed form fixes n at 2 — it would ignore this'} />
          </div>
          <div className="ppr-row">
            <Num label="Rw Ω·m" value={params.rw} step={0.001} onChange={(v) => set('rw', v)} />
            <Num label="Rsh Ω·m" value={params.rsh} step={0.1} onChange={(v) => set('rsh', v)}
              disabled={!swModelUsesRsh(params.swModel)}
              title={swModelUsesRsh(params.swModel) ? undefined : 'Archie has no shale term — it would ignore this'} />
          </div>
          {missing?.sw && <small className="ppr-missing">{missing.sw}</small>}
        </div>

        {/* ── Rw & salinity ── */}
        <div className="pps-rail-sec">
          <div className="pps-rail-sec-head"><Beaker size={11} /><b>Rw &amp; salinity</b></div>
          <div className="ppr-row">
            <Num label="NaCl ppm" value={ppm} step={1000} onChange={setPpm} />
            <Num label="TVD m" value={tvd} step={50} onChange={setTvd} />
          </div>
          <div className="ppr-row">
            <Num label="Surf °C" value={surfaceC} step={0.5} onChange={setSurfaceC} />
            <Num label="°C/100m" value={gradC} step={0.1} onChange={setGradC} />
          </div>
          <small className="ppr-calc">
            T at {tvd} m = <b>{tempC.toFixed(1)} °C</b> → Rw = <b>{rwFromPpm ? rwFromPpm.toFixed(4) : '—'} Ω·m</b>
            <i className="pps-nature n-derived">derived</i>
          </small>
          {measuredRw != null && rwFromPpm != null && (
            <small className={'ppr-check' + (Math.abs(rwFromPpm - measuredRw) / measuredRw < 0.15 ? ' ok' : ' off')}>
              the delivery’s own RW curve reads <b>{measuredRw.toFixed(4)}</b> Ω·m — you are
              {' '}{((rwFromPpm / measuredRw - 1) * 100).toFixed(0)}% off
              {' · '}<button className="ppr-link" onClick={() => setPpm(Math.round(salinityFromRw(measuredRw, tempC) ?? ppm))}>
                match it
              </button>
            </small>
          )}
          {rwFromPpm != null && (
            <button className="ppr-apply" onClick={() => set('rw', Number(rwFromPpm.toFixed(4)))}>
              use this Rw
            </button>
          )}
        </div>

        {/* ── cutoffs ── */}
        <div className="pps-rail-sec">
          <div className="pps-rail-sec-head"><Gauge size={11} /><b>Cutoffs</b>
            {counts && <em>{counts.net.toLocaleString('en-US')} evaluable</em>}</div>
          <Slider label="Vsh ≤" value={params.cutoffs.vsh} min={0} max={1} step={0.01}
            onChange={(v) => setCut('vsh', v)} />
          <Slider label="PHIE ≥" value={params.cutoffs.phie} min={0} max={0.4} step={0.005}
            onChange={(v) => setCut('phie', v)} />
          <Slider label="Sw ≤" value={params.cutoffs.sw} min={0} max={1} step={0.01}
            onChange={(v) => setCut('sw', v)} />
          {well?.zones?.length ? (
            <small><Database size={9} /> net across {well.zones.length} intervals:{' '}
              <b>{well.zones.reduce((n, z) => n + (z.stats?.netM ?? 0), 0).toFixed(1)} m</b></small>
          ) : <small className="ppr-missing">no picks on this bore — no interval can be averaged</small>}
        </div>

        {/* ── provenance vocabulary ── */}
        <div className="pps-rail-sec nature">
          <div className="pps-rail-sec-head"><Layers size={11} /><b>Provenance</b></div>
          <div className="pps-natures">
            {[
              ['measured', 'read from a curve'],
              ['interpreted', 'the delivery’s own answer'],
              ['derived', 'our recompute'],
              ['calibrated', 'tuned against a known answer'],
              ['analog', 'a library prior'],
              ['user', 'typed in, no other backing'],
            ].map(([k, v]) => <span key={k} className={`pps-nature n-${k}`} title={v}>{k}</span>)}
          </div>
          <small>No number reaches a chart without one of these.</small>
        </div>
      </div>
    </aside>
  );
}

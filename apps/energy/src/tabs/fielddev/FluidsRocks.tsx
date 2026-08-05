// FluidsRocks — the Fluids & Rock stage (PVT · SCAL · Initialization).
//
// WHAT THIS TAB IS FOR. Everything downstream in the Dynamic Model workflow —
// simulation cases, history matching, recovery screening, the forecast — initialises
// from one artifact: the black-oil PVT tables, the rock-fluid functions, and the
// equilibrated initial state. This tab BUILDS that artifact, and it is the only place
// it is built. `toSimFluids()` is the seam; nothing downstream keeps its own copy of a
// viscosity or a Corey exponent.
//
// THE RULE THIS TAB ENFORCES. Every number on screen carries where it came from, and
// the four provenances are not interchangeable:
//
//   deck         the delivery's own Eclipse PVT block — read, never assumed
//   correlation  a published relation ANCHORED to a deck value, so the curve passes
//                exactly through the measurement and only supplies the shape around it
//   analogue     no measurement exists. Volve shipped no SCAL, so the kr endpoints are
//                a water-wet North Sea sand and every screen says so
//   measured     the real MDT/LWD gauge stations, used to CHECK the initialization
//
// The check at the bottom of the Initialization pane is the point of the whole stage:
// F-14's own fourteen gauge readings fit a gradient of 716 kg/m³, against 711 kg/m³
// for the live oil the deck's PVT implies. That agreement is not an assumption — it is
// two independent paths to the same number, and it is what makes the case trustworthy
// enough to hand to a simulator.
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Database, Download, Droplets, FileCode2, Gauge,
  Info, Layers, LineChart, RotateCcw, Ruler, Waves, XCircle,
} from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { useFluidBasis, assembleCase, type FluidBasis, type FluidOverrides } from './fluids-live';
import { useFluidCase } from './fluid-case-store';
import {
  toEclipseDeck, toSimFluids, isRunnable,
  type Basis, type DynamicInitialization, type ScalEndpoints,
} from './fluid-model';
import {
  PvtChart, ViscosityChart, KrChart, TransitionChart, PcChart, PressureDepthChart, InitSwChart,
} from './fluids-charts';
import './fluids-rocks.css';

type Pane = 'pvt' | 'scal' | 'init' | 'case';

const PANES: Array<{ id: Pane; label: string; icon: typeof Droplets; hint: string }> = [
  { id: 'pvt', label: 'PVT', icon: Droplets, hint: 'Bo · Rs · viscosity' },
  { id: 'scal', label: 'SCAL', icon: Waves, hint: 'kr · fw · Pc' },
  { id: 'init', label: 'Initialization', icon: Ruler, hint: 'equilibration · in place' },
  { id: 'case', label: 'Case', icon: FileCode2, hint: 'the deck this publishes' },
];

const BASIS_TITLE: Record<Basis, string> = {
  deck: 'Read from the delivery’s own Eclipse PVT block.',
  measured: 'A direct measurement from the delivery.',
  correlation: 'A published correlation, anchored to a deck value.',
  analogue: 'No measurement exists — an analogue stands in, and the case says so.',
  user: 'Moved off the delivery’s basis by hand on this tab.',
  regulator: 'The authority’s published figure.',
};

const Chip = ({ basis }: { basis: Basis }) => (
  <i className={`frx-basis-chip b-${basis}`} title={BASIS_TITLE[basis]}>{basis}</i>
);

function Row({ label, value, basis }: { label: string; value: string; basis?: Basis }) {
  return (
    <div className="frx-kv-row">
      <span>{label}</span>
      <b>{value}</b>
      {basis ? <Chip basis={basis} /> : <i />}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, fmt, moved, note }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; fmt?: (v: number) => string; moved?: boolean; note?: string;
}) {
  return (
    <label className="frx-sl">
      <span>{label}<b className={moved ? 'moved' : ''}>{fmt ? fmt(value) : value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.currentTarget.value))} />
      {note && <small style={{ fontSize: 8, color: 'var(--ink3)' }}>{note}</small>}
    </label>
  );
}

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export function FluidsRocks({ field }: { field: SearchEntry }) {
  const { basis, ready } = useFluidBasis();
  const [pane, setPane] = useState<Pane>('pvt');
  const [over, setOver] = useState<FluidOverrides>({});

  const init = useMemo(() => assembleCase(field.id, basis, over), [field.id, basis, over]);

  // PUBLISH. Everything downstream that initialises a flow calculation reads the case
  // from here, so moving an endpoint on this tab moves the simulation — there is no
  // second copy of a viscosity or a Corey exponent anywhere else.
  const publish = useFluidCase((s) => s.publish);
  useEffect(() => { publish(init); }, [init, publish]);

  if (!ready) {
    return (
      <div className="frx">
        <div className="frx-gate"><div className="frx-empty">
          <div className="ic"><Droplets size={20} /></div>
          <b>Reading the delivery’s fluid basis…</b>
          <span>The PVT block, the fluid contacts and the formation-pressure records come out of the ingested asset store — the same query the Input tree reads.</span>
        </div></div>
      </div>
    );
  }

  if (!init || !basis.anchors) {
    // "Still landing" and "will never land" are opposite states and must not share a
    // headline: one resolves itself by waiting, the other is a fact about the delivery.
    const digesting = /still digesting|not been digested/.test(basis.gap ?? '');
    return (
      <div className="frx">
        <div className="frx-gate"><div className="frx-empty">
          <div className="ic">{digesting ? <Droplets size={20} /> : <XCircle size={20} />}</div>
          <b>{digesting ? `Waiting on ${field.name}’s delivery` : `No fluid model can be built for ${field.name}`}</b>
          <span>{basis.gap ?? 'This delivery publishes no PVT block.'}</span>
          <span style={{ fontSize: 9 }}>
            A dynamic model needs, at minimum, an initial pressure, a bubble point, a solution GOR, an oil FVF,
            a reservoir temperature, a datum and the three surface densities. Nothing here is substituted with a
            default — a case built on defaults would look exactly like a case built on the deck, and it is not
            the same thing.
          </span>
        </div></div>
      </div>
    );
  }

  const scalMoved = Object.keys(over.scal ?? {}).length > 0;
  const rockMoved = Object.keys(over.rock ?? {}).length > 0;
  const fails = init.issues.filter((i) => i.severity === 'fail');
  const warns = init.issues.filter((i) => i.severity === 'warn');
  const buildups = init.pressurePoints.filter((p) => p.quality !== 'column');
  const confirmed = init.wellGradients.find((g) => g.phase === 'oil');

  return (
    <div className="frx">
      <header className="frx-bar">
        <span className="frx-ic"><Droplets size={14} /></span>
        <span className="frx-title">Fluids &amp; Rock</span>
        <span className="frx-sub">{init.anchors.source}</span>
        <span className="frx-spacer" />
        <div className="frx-panes">
          {PANES.map((p) => (
            <button key={p.id} className={pane === p.id ? 'on' : ''} onClick={() => setPane(p.id)} title={p.hint}>
              <p.icon size={11} />{p.label}
            </button>
          ))}
        </div>
      </header>

      <BasisStrip basis={basis} init={init} />

      {pane === 'pvt' && <PvtPane init={init} />}
      {pane === 'scal' && <ScalPane init={init} over={over} setOver={setOver} scalMoved={scalMoved} />}
      {pane === 'init' && <InitPane init={init} basis={basis} over={over} setOver={setOver} rockMoved={rockMoved} />}
      {pane === 'case' && <CasePane init={init} fails={fails} warns={warns} />}

      <div className="frx-legend">
        <span><Layers size={10} /> {init.pvt.pvto.length} saturated + {init.pvt.undersaturated.length} undersaturated PVTO nodes · {init.swof.length}-row SWOF</span>
        <span>{buildups.length} measured buildup{buildups.length === 1 ? '' : 's'} across {init.wellGradients.length} well{init.wellGradients.length === 1 ? '' : 's'}</span>
        {confirmed?.fit && (
          <span style={{ color: 'var(--green,#4ade80)' }}>
            <CheckCircle2 size={10} /> {confirmed.well} measures {confirmed.fit.density.toFixed(0)} kg/m³ · deck implies {init.pvt.rhoOilRes.toFixed(0)}
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: fails.length ? 'var(--red,#f87171)' : 'var(--green,#4ade80)' }}>
          {fails.length ? `${fails.length} blocking issue${fails.length === 1 ? '' : 's'}` : 'runnable'}
        </span>
      </div>
    </div>
  );
}

// ── the basis strip: what this case stands on, counted live ──────────────────

function BasisStrip({ basis, init }: { basis: FluidBasis; init: DynamicInitialization }) {
  const buildups = init.pressurePoints.filter((p) => p.quality !== 'column').length;
  const resolved = init.wellGradients.filter((g) => g.resolved).length;
  const rec = init.reconciliation;
  return (
    <div className="frx-basis">
      <div className="frx-cell deck">
        <b>11</b><i>deck anchors · PVT + rock</i>
      </div>
      <div className={`frx-cell ${init.scalBasis === 'analogue' ? 'warn' : ''}`}>
        <b>{init.scalBasis === 'analogue' ? '0' : '—'}</b><i>measured SCAL · {init.scalBasis}</i>
      </div>
      <div className={`frx-cell ${buildups ? 'good' : 'warn'}`}>
        <b>{buildups}</b><i>gauge buildups · {basis.pressureWells} well{basis.pressureWells === 1 ? '' : 's'}</i>
      </div>
      <div className={`frx-cell ${resolved ? 'good' : 'warn'}`}>
        <b>{resolved}</b><i>of {init.wellGradients.length} resolve a gradient</i>
      </div>
      {init.volumetrics && (
        <div className={`frx-cell ${rec?.verdict === 'agrees' ? 'good' : rec?.verdict === 'unchecked' ? '' : 'warn'}`}>
          <b>{init.volumetrics.stoiipMMSm3.toFixed(1)}</b>
          <i>MMSm³ STOIIP · {rec ? `${rec.verdict} vs official ${rec.officialMMSm3?.toFixed(1) ?? '—'}` : 'unchecked'}</i>
        </div>
      )}
      <div className={`frx-cell ${init.equil.saturationState === 'undersaturated' ? 'good' : 'warn'}`}>
        <b>{init.equil.undersaturationBar.toFixed(0)}</b><i>bar above Pb · {init.equil.saturationState}</i>
      </div>
      {(basis.unplaceable > 0 || basis.noKb > 0) && (
        <div className="frx-cell warn">
          <b>{basis.unplaceable + basis.noKb}</b><i>stations unplaceable · outside their survey</i>
        </div>
      )}
    </div>
  );
}

// ── PVT ──────────────────────────────────────────────────────────────────────

function PvtPane({ init }: { init: DynamicInitialization }) {
  const p = init.pvt, a = init.anchors;
  const cal = p.calibration;
  return (
    <div className="frx-body pane-pvt">
      <section className="frx-panel main">
        <header><span className="frx-ic"><LineChart size={12} /></span><b>Oil formation volume factor and solution gas</b></header>
        <div className="frx-plot"><PvtChart pvt={p} pb={a.pb} pi={a.pi} /></div>
        <div className="frx-legend">
          <span><i style={{ background: 'var(--teal)' }} />Bo</span>
          <span><i style={{ background: 'var(--amber,#fbbf24)' }} />Rs</span>
          <span><i className="dot" style={{ background: 'var(--teal)' }} />the deck anchors — every other point is correlation</span>
        </div>
        <footer>
          <Info size={11} style={{ color: 'var(--teal)' }} />
          The kink at Pb is the physics, not a plotting artefact: below it gas leaves solution so Rs and Bo both fall
          with pressure; above it Rs is frozen at {a.rsb} Sm³/Sm³ and Bo falls only by compression at
          {' '}{p.co.toExponential(2)} /bar. Volve never crossed it — Pi sits {init.equil.undersaturationBar.toFixed(0)} bar above.
        </footer>
      </section>

      <section className="frx-panel aside">
        <header><span className="frx-ic"><Gauge size={12} /></span><b>Viscosity</b></header>
        <div className="frx-plot"><ViscosityChart pvt={p} pb={a.pb} pi={a.pi} /></div>
        <div className="frx-legend">
          <span><i style={{ background: 'var(--teal)' }} />oil</span>
          <span><i style={{ background: 'var(--cblue,#60a5fa)' }} />water</span>
          <span><i style={{ background: 'var(--amber,#fbbf24)' }} />gas</span>
        </div>
        <footer>
          <Info size={11} style={{ color: 'var(--teal)' }} />
          At initial conditions the oil is {p.muoAtPi.toFixed(3)} cP against brine at {p.muw.toFixed(3)} cP — a
          viscosity ratio of {(p.muoAtPi / p.muw).toFixed(2)}. That is why this waterflood displaces well: the
          end-point mobility ratio is {init.mobilityRatio.toFixed(2)}, and anything under 1 is favourable.
        </footer>
      </section>

      <aside className="frx-rail">
        <div className="frx-rail-head"><Database size={11} />PVT basis<em>{a.source.split('—')[0].trim()}</em></div>
        <div className="frx-rail-scroll">
          <div className="frx-rail-sec">
            <h4><Droplets size={11} />Deck anchors</h4>
            <div className="frx-kv">
              <Row label="Initial pressure" value={`${a.pi} bara`} basis="deck" />
              <Row label="Bubble point" value={`${a.pb} bara`} basis="deck" />
              <Row label="Solution GOR at Pb" value={`${a.rsb} Sm³/Sm³`} basis="deck" />
              <Row label="Bo at Pi" value={`${a.boAtPi} rm³/Sm³`} basis="deck" />
              <Row label="Temperature" value={`${a.tC} °C`} basis="deck" />
              <Row label="Datum" value={`${a.datumTvdss} m TVDSS`} basis="deck" />
              <Row label="Surface oil" value={`${a.rhoOilSc} kg/m³`} basis="deck" />
              <Row label="Surface water" value={`${a.rhoWaterSc} kg/m³`} basis="deck" />
              <Row label="Surface gas" value={`${a.rhoGasSc} kg/m³`} basis="deck" />
              <Row label="Rock cf" value={`${a.rockCf.toExponential(1)} /bar`} basis="deck" />
              <Row label="Rock Pref" value={`${a.rockPref} bara`} basis="deck" />
            </div>
          </div>

          <div className="frx-rail-sec">
            <h4><Droplets size={11} />Fluid identity</h4>
            <div className="frx-kv">
              <Row label="Oil gravity" value={`${p.api.toFixed(1)} °API`} basis="correlation" />
              <Row label="Gas gravity" value={p.gammaG.toFixed(3)} basis="correlation" />
              <Row label="Brine salinity" value={`${p.salinityWtPct.toFixed(1)} wt% NaCl`} basis="correlation" />
              <Row label="Bo at Pb" value={`${p.bob.toFixed(4)} rm³/Sm³`} basis="correlation" />
              <Row label="co" value={`${p.co.toExponential(2)} /bar`} basis="correlation" />
              <Row label="μo at Pb" value={`${p.muob.toFixed(3)} cP`} basis="correlation" />
              <Row label="μo at Pi" value={`${p.muoAtPi.toFixed(3)} cP`} basis="correlation" />
              <Row label="μw" value={`${p.muw.toFixed(3)} cP`} basis="correlation" />
              <Row label="Bw" value={`${p.bw.toFixed(4)} rm³/Sm³`} basis="correlation" />
              <Row label="cw" value={`${p.cw.toExponential(2)} /bar`} basis="correlation" />
              <Row label="Reservoir oil ρ" value={`${p.rhoOilRes.toFixed(1)} kg/m³`} basis="correlation" />
              <Row label="Reservoir water ρ" value={`${p.rhoWaterRes.toFixed(1)} kg/m³`} basis="correlation" />
            </div>
            <p className="frx-note">
              Salinity is back-solved from the deck’s surface water density through McCain’s brine relation — it is
              an inference from a stated density, not a water analysis, and cw and μw both hang off it.
            </p>
          </div>

          <div className="frx-rail-sec">
            <h4><Ruler size={11} />Correlation anchoring</h4>
            <div className="frx-kv">
              <Row label="Standing Rs at Pb" value={`${cal.rsPredicted.toFixed(1)} Sm³/Sm³`} basis="correlation" />
              <Row label="Anchored by" value={`×${cal.rsFactor.toFixed(4)}`} basis="deck" />
              <Row label="Standing Bo at Rsb" value={`${cal.boPredicted.toFixed(4)}`} basis="correlation" />
              <Row label="Anchored by" value={`×${cal.boFactor.toFixed(4)}`} basis="deck" />
            </div>
            <p className="frx-note">
              Standing’s correlation is evaluated at the deck’s own bubble point and then scaled so it passes exactly
              through it. A factor near 1 means this fluid genuinely behaves like the correlation’s population —
              here Rs is within {Math.abs((cal.rsFactor - 1) * 100).toFixed(1)}% and Bo within
              {' '}{Math.abs((cal.boFactor - 1) * 100).toFixed(1)}%, so the shape between anchors can be trusted.
            </p>
          </div>

          <div className="frx-rail-sec">
            <h4><Layers size={11} />PVTO, as tabulated</h4>
            <table className="frx-tbl">
              <thead><tr><th>Rs</th><th>Pb</th><th>Bo</th><th>μo</th></tr></thead>
              <tbody>
                {init.pvt.pvto.filter((_, i) => i % 3 === 0 || i === init.pvt.pvto.length - 1).map((r, i) => (
                  <tr key={i} className={r.p === a.pb ? 'mark' : 'sat'}>
                    <td>{r.rs.toFixed(1)}</td><td>{r.p.toFixed(0)}</td>
                    <td>{r.bo.toFixed(4)}</td><td>{r.muo.toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── SCAL ─────────────────────────────────────────────────────────────────────

function ScalPane({ init, over, setOver, scalMoved }: {
  init: DynamicInitialization; over: FluidOverrides;
  setOver: (f: (o: FluidOverrides) => FluidOverrides) => void; scalMoved: boolean;
}) {
  const s = init.scal, w = init.welge;
  const set = (k: keyof ScalEndpoints) => (v: number) =>
    setOver((o) => ({ ...o, scal: { ...o.scal, [k]: v } }));
  const moved = (k: keyof ScalEndpoints) => over.scal?.[k] !== undefined;
  const dRho = init.pvt.rhoWaterRes - init.pvt.rhoOilRes;

  return (
    <div className="frx-body pane-scal">
      <section className="frx-panel main">
        <header>
          <span className="frx-ic"><Waves size={12} /></span>
          <b>Relative permeability and fractional flow</b>
          <Chip basis={init.scalBasis} />
        </header>
        <div className="frx-plot">
          <KrChart scal={s} muw={init.pvt.muw} muo={init.pvt.muoAtPi} welge={w} />
        </div>
        <div className="frx-legend">
          <span><i style={{ background: 'var(--cblue,#60a5fa)' }} />krw</span>
          <span><i style={{ background: 'var(--teal)' }} />kro</span>
          <span><i style={{ background: 'var(--purple,#a78bfa)' }} />fw</span>
          <span style={{ color: 'var(--purple,#a78bfa)' }}><i className="dash" />Welge tangent</span>
        </div>
        <footer>
          <AlertTriangle size={11} />
          <span>
            <b style={{ color: 'var(--amber,#fbbf24)' }}>No SCAL was delivered.</b> The core folders in this package
            are empty in source, so these endpoints are an analogue water-wet North Sea sand, not a measurement of
            this rock. The recovery numbers below are as uncertain as they are — this is the single largest
            uncertainty in any waterflood forecast built on this case, and it can only be closed by core.
          </span>
        </footer>
      </section>

      <section className="frx-panel aside">
        <header><span className="frx-ic"><Ruler size={12} /></span><b>Capillary transition zone</b></header>
        <div className="frx-plot">
          <TransitionChart scal={s} dRho={dRho} phi={init.rock.phi} kMd={init.rock.kMd}
            owc={init.equil.owc} fwl={init.equil.fwl} />
        </div>
        <div className="frx-scroll" style={{ flex: '0 0 auto', maxHeight: 168 }}>
          <div className="frx-kv">
            <Row label="Entry pressure" value={`${init.swof[init.swof.length - 1].pc.toFixed(4)} bar`} basis="analogue" />
            <Row label="OWC → FWL offset" value={init.equil.fwl != null && init.equil.owc != null ? `${(init.equil.fwl - init.equil.owc).toFixed(2)} m` : '—'} basis="correlation" />
            <Row label="Oil–water Δρ" value={`${dRho.toFixed(1)} kg/m³`} basis="correlation" />
          </div>
          <p className="frx-note">
            The height of this zone is set by permeability, which this delivery does not state — at
            {' '}{init.rock.kMd} mD the rock reaches connate water within tens of metres of the contact; at a
            tenth of that it would not, and the in-place volume would change with it.
          </p>
        </div>
        <footer>
          <Info size={11} style={{ color: 'var(--teal)' }} />
          Drawn from the same Brooks–Corey curve that fills the SWOF table’s Pc column, so the transition zone
          you see and the one the simulator initialises on cannot drift apart.
        </footer>
      </section>

      <aside className="frx-rail">
        <div className="frx-rail-head">
          <Waves size={11} />Rock–fluid endpoints
          {scalMoved && (
            <button className="frx-reset" style={{ marginLeft: 'auto' }}
              onClick={() => setOver((o) => ({ ...o, scal: undefined }))}>
              <RotateCcw size={9} />analogue
            </button>
          )}
        </div>
        <div className="frx-rail-scroll">
          <div className="frx-rail-sec">
            <h4><Droplets size={11} />Saturation end points</h4>
            <Slider label="Connate water Swc" value={s.swc} min={0.05} max={0.45} step={0.01}
              onChange={set('swc')} fmt={(v) => v.toFixed(2)} moved={moved('swc')} />
            <Slider label="Residual oil Sor" value={s.sor} min={0.05} max={0.45} step={0.01}
              onChange={set('sor')} fmt={(v) => v.toFixed(2)} moved={moved('sor')} />
            <Slider label="krw at Sor" value={s.krwMax} min={0.05} max={1} step={0.01}
              onChange={set('krwMax')} fmt={(v) => v.toFixed(2)} moved={moved('krwMax')} />
            <Slider label="kro at Swc" value={s.kroMax} min={0.2} max={1} step={0.01}
              onChange={set('kroMax')} fmt={(v) => v.toFixed(2)} moved={moved('kroMax')} />
          </div>
          <div className="frx-rail-sec">
            <h4><Waves size={11} />Corey exponents</h4>
            <Slider label="Water nw" value={s.nw} min={1.5} max={6} step={0.1}
              onChange={set('nw')} fmt={(v) => v.toFixed(1)} moved={moved('nw')}
              note="higher = more water-wet, later water breakthrough" />
            <Slider label="Oil no" value={s.no} min={1.5} max={5} step={0.1}
              onChange={set('no')} fmt={(v) => v.toFixed(1)} moved={moved('no')} />
            <Slider label="Pore-size λ" value={s.lambda} min={0.5} max={5} step={0.1}
              onChange={set('lambda')} fmt={(v) => v.toFixed(1)} moved={moved('lambda')}
              note="Brooks–Corey — sets how tall the transition zone is" />
          </div>
          <div className="frx-rail-sec">
            <h4><LineChart size={11} />What these endpoints imply</h4>
            <div className="frx-kv">
              <Row label="Mobility ratio M" value={init.mobilityRatio.toFixed(3)} basis="correlation" />
              <Row label="Displacement efficiency" value={pct(init.displacementEfficiency)} basis={init.scalBasis} />
              <Row label="Shock front Swf" value={w.swf.toFixed(3)} basis={init.scalBasis} />
              <Row label="fw at the front" value={pct(w.fwf)} basis={init.scalBasis} />
              <Row label="Avg Sw at breakthrough" value={w.swAvgBt.toFixed(3)} basis={init.scalBasis} />
              <Row label="PVI at breakthrough" value={w.pviBt.toFixed(3)} basis={init.scalBasis} />
              <Row label="Recovery at breakthrough" value={pct(w.recoveryBt)} basis={init.scalBasis} />
            </div>
            <p className="frx-note">
              {init.mobilityRatio < 1
                ? `M = ${init.mobilityRatio.toFixed(2)} is favourable: the water is less mobile than the oil it is pushing, so the front stays coherent rather than fingering through.`
                : `M = ${init.mobilityRatio.toFixed(2)} is unfavourable: water outruns the oil, so expect fingering, early breakthrough, and a coarse model to overstate sweep.`}
            </p>
          </div>
          <div className="frx-rail-sec">
            <h4><Ruler size={11} />Capillary pressure</h4>
            <div className="frx-plot" style={{ height: 150, padding: 0 }}><PcChart swof={init.swof} scal={s} /></div>
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── initialization ───────────────────────────────────────────────────────────

function InitPane({ init, basis, over, setOver, rockMoved }: {
  init: DynamicInitialization; basis: FluidBasis; over: FluidOverrides;
  setOver: (f: (o: FluidOverrides) => FluidOverrides) => void; rockMoved: boolean;
}) {
  const eq = init.equil;
  const rec = init.reconciliation;
  const setRock = (k: 'phi' | 'ntg' | 'sw' | 'kMd') => (v: number) =>
    setOver((o) => ({ ...o, rock: { ...o.rock, [k]: v } }));
  const movedRock = (k: 'phi' | 'ntg' | 'sw' | 'kMd') => over.rock?.[k] !== undefined;

  return (
    <div className="frx-body pane-init">
      <section className="frx-panel main">
        <header>
          <span className="frx-ic"><Gauge size={12} /></span>
          <b>Pressure against depth — the equilibration, checked against the gauges</b>
        </header>
        <div className="frx-plot">
          <PressureDepthChart init={init} points={init.pressurePoints} wells={init.wellGradients} />
        </div>
        <div className="frx-legend">
          <span><i style={{ background: 'var(--teal)' }} />modelled oil gradient {eq.oilGradient.toFixed(4)} bar/m</span>
          <span><i style={{ background: 'var(--cblue,#60a5fa)' }} />modelled water gradient {eq.waterGradient.toFixed(4)} bar/m</span>
          <span><i className="dot" style={{ background: 'var(--ink3)' }} />measured buildup</span>
          <span><i className="dot" style={{ background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--ink3)' }} />mud column — excluded</span>
        </div>
        <footer>
          <Info size={11} style={{ color: 'var(--teal)' }} />
          Each well is fitted on its OWN stations. A field-wide fit would be meaningless here: these gauges span
          years of depletion and injection support, so stacking them into one line would measure the production
          history, not a fluid.
        </footer>
      </section>

      <section className="frx-panel aside">
        <header><span className="frx-ic"><Ruler size={12} /></span><b>Initial saturation and in place</b></header>
        <div className="frx-plot" style={{ maxHeight: 250 }}><InitSwChart init={init} /></div>
        <div className="frx-scroll">
          <div className="frx-sec">Equilibration</div>
          <div className="frx-kv">
            <Row label="Datum" value={`${eq.datumTvdss} m · ${eq.datumPressure} bara`} basis="deck" />
            <Row label="Oil–water contact" value={eq.owc != null ? `${eq.owc} m TVDSS` : 'none in delivery'} basis="user" />
            <Row label="Free-water level" value={eq.fwl != null ? `${eq.fwl.toFixed(1)} m TVDSS` : '—'} basis="correlation" />
            <Row label="Pressure at the contact" value={eq.contactPressure != null ? `${eq.contactPressure.toFixed(1)} bara` : '—'} basis="correlation" />
            <Row label="State at initial" value={`${eq.saturationState} by ${eq.undersaturationBar.toFixed(0)} bar`} basis="deck" />
          </div>
          {eq.deckContactNote && <p className="frx-note">{eq.deckContactNote}</p>}

          {init.volumetrics && (
            <>
              <div className="frx-sec">Volume in place</div>
              <div className="frx-kv">
                <Row label="Pore volume" value={`${(init.volumetrics.poreVolumeM3 / 1e6).toFixed(1)} · 10⁶ m³`} basis="correlation" />
                <Row label="HC pore volume" value={`${(init.volumetrics.hcPoreVolumeM3 / 1e6).toFixed(1)} · 10⁶ m³`} basis="correlation" />
                <Row label="STOIIP" value={`${init.volumetrics.stoiipMMSm3.toFixed(2)} MMSm³`} basis="correlation" />
                {rec?.officialMMSm3 != null && (
                  <Row label="Regulator’s figure" value={`${rec.officialMMSm3.toFixed(2)} MMSm³`} basis="regulator" />
                )}
                {rec?.deltaPct != null && (
                  <Row label="Difference" value={`${rec.deltaPct > 0 ? '+' : ''}${rec.deltaPct.toFixed(1)}%`} basis="correlation" />
                )}
                {rec?.rfOfficial != null && (
                  <Row label="Recovery factor achieved" value={pct(rec.rfOfficial)} basis="regulator" />
                )}
                {init.volumetrics.giipBcm != null && (
                  <Row label="Solution gas in place" value={`${init.volumetrics.giipBcm.toFixed(3)} Bcm`} basis="correlation" />
                )}
                {rec?.gas && (
                  <>
                    <Row label="Regulator’s GIIP" value={`${rec.gas.officialBcm.toFixed(2)} Bcm`} basis="regulator" />
                    <Row label="Gas difference" value={`${rec.gas.deltaPct >= 0 ? '+' : ''}${rec.gas.deltaPct.toFixed(1)}%`} basis="correlation" />
                  </>
                )}
              </div>
              <p className="frx-note">
                STOIIP = GRV · N:G · φ · (1−Sw) / Bo, over the gross rock volume the delivery’s own screening
                volumetrics record. Any recovery factor is quoted against the REGULATOR’s in-place, never against
                this screening figure — a screening volume that overstates in place makes a good field look like a
                bad one.
              </p>
              {rec?.gas && (
                <p className="frx-note">
                  The gas row is a <b>second, independent check</b>, and it tests a different input. This field is
                  undersaturated, so it has no gas cap and every molecule of gas is dissolved in the oil:
                  GIIP is exactly STOIIP × Rs. Oil in place can only be right if the rock volume is right; gas can
                  only be right if the rock volume <i>and</i> the deck’s {init.anchors.rsb} Sm³/Sm³ solution GOR are
                  both right. Two volumes agreeing with the authority is a far stronger statement than one.
                </p>
              )}
            </>
          )}

          <div className="frx-sec">Gauge surveys, per well</div>
          <table className="frx-tbl">
            <thead><tr><th>Well</th><th>Stations</th><th>bar/m</th><th>kg/m³</th><th>R²</th><th>Reads</th></tr></thead>
            <tbody>
              {init.wellGradients.map((g) => (
                <tr key={g.well} className={g.phase === 'oil' ? 'mark' : ''}>
                  <td>{g.well}</td>
                  <td>{g.points.length}</td>
                  <td>{g.fit ? g.fit.slope.toFixed(4) : '—'}</td>
                  <td>{g.resolved && g.fit ? g.fit.density.toFixed(0) : '—'}</td>
                  <td>{g.fit ? g.fit.r2.toFixed(3) : '—'}</td>
                  <td>{g.resolved ? (g.phase ?? '—') : 'scatter'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="frx-note">
            {basis.unplaceable > 0 && `${basis.unplaceable} further station${basis.unplaceable === 1 ? '' : 's'} could not be placed: the gauge depth falls below the deepest station in that well’s own directional survey, so there is no TVD for it. `}
            A well reads “scatter” when its stations do not fit one straight line — those wells were tested at
            different times or never sealed against the formation, and no gradient is claimed for them.
          </p>
        </div>
      </section>

      <aside className="frx-rail">
        <div className="frx-rail-head">
          <Layers size={11} />Rock
          {rockMoved && (
            <button className="frx-reset" style={{ marginLeft: 'auto' }}
              onClick={() => setOver((o) => ({ ...o, rock: undefined }))}>
              <RotateCcw size={9} />delivery
            </button>
          )}
        </div>
        <div className="frx-rail-scroll">
          <div className="frx-rail-sec">
            <h4><Layers size={11} />Reservoir properties</h4>
            <Slider label="Porosity φ" value={init.rock.phi} min={0.05} max={0.4} step={0.005}
              onChange={setRock('phi')} fmt={(v) => v.toFixed(3)} moved={movedRock('phi')} />
            <Slider label="Net-to-gross" value={init.rock.ntg} min={0.2} max={1} step={0.01}
              onChange={setRock('ntg')} fmt={(v) => v.toFixed(2)} moved={movedRock('ntg')} />
            <Slider label="Initial Sw" value={init.rock.sw} min={0.05} max={0.6} step={0.01}
              onChange={setRock('sw')} fmt={(v) => v.toFixed(2)} moved={movedRock('sw')} />
            <Slider label="Permeability" value={init.rock.kMd} min={5} max={2000} step={5}
              onChange={setRock('kMd')} fmt={(v) => `${v} mD`} moved={movedRock('kMd')}
              note="not stated by this delivery — it sets the transition-zone height and the well indices" />
            <div className="frx-kv" style={{ marginTop: 8 }}>
              <Row label="Rock cf" value={`${init.rock.cf.toExponential(1)} /bar`} basis={init.rock.basis.cf} />
              <Row label="Reference pressure" value={`${init.rock.pref} bara`} basis={init.rock.basis.cf} />
            </div>
          </div>

          <div className="frx-rail-sec">
            <h4>
              {isRunnable(init)
                ? <CheckCircle2 size={11} style={{ color: 'var(--green,#4ade80)' }} />
                : <XCircle size={11} style={{ color: 'var(--red,#f87171)' }} />}
              Case review<em>{init.issues.length}</em>
            </h4>
            {init.issues.map((i, n) => (
              <div key={n} className={`frx-issue ${i.severity}`}>
                {i.severity === 'fail' ? <XCircle size={11} /> : i.severity === 'warn' ? <AlertTriangle size={11} /> : <Info size={11} />}
                <span><em>{i.rule}</em>{i.message}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

// ── the case ─────────────────────────────────────────────────────────────────

function CasePane({ init, fails, warns }: {
  init: DynamicInitialization;
  fails: DynamicInitialization['issues']; warns: DynamicInitialization['issues'];
}) {
  const deck = useMemo(() => toEclipseDeck(init), [init]);
  const sim = useMemo(() => toSimFluids(init), [init]);

  const download = () => {
    const blob = new Blob([deck], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${init.fieldId.replace(/[^a-z0-9]+/gi, '-')}-initialization.inc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="frx-body pane-case">
      <section className="frx-panel main">
        <header>
          <span className="frx-ic"><FileCode2 size={12} /></span>
          <b>DynamicInitialization — as ECLIPSE METRIC keywords</b>
          <button className="frx-act" onClick={download}><Download size={10} />Export .inc</button>
        </header>
        <pre className="frx-deck">{deck}</pre>
        <footer>
          <Info size={11} style={{ color: 'var(--teal)' }} />
          This is the case stating itself in the format the industry reads. It is generated from the same tables the
          charts draw and the simulator receives — so “this tab is the source for the simulation” is something you
          can check by hand rather than something you have to take on trust.
        </footer>
      </section>

      <section className="frx-panel aside">
        <header>
          {fails.length
            ? <span className="frx-ic" style={{ color: 'var(--red,#f87171)' }}><XCircle size={12} /></span>
            : <span className="frx-ic" style={{ color: 'var(--green,#4ade80)' }}><CheckCircle2 size={12} /></span>}
          <b>{fails.length ? 'Blocked' : 'Ready to simulate'}</b>
        </header>
        <div className="frx-scroll">
          <div className="frx-sec">What the simulator receives</div>
          <div className="frx-kv">
            <Row label="Swc / Sor" value={`${sim.swc.toFixed(2)} / ${sim.sor.toFixed(2)}`} basis={init.scalBasis} />
            <Row label="krw / kro end points" value={`${sim.krwMax.toFixed(2)} / ${sim.kroMax.toFixed(2)}`} basis={init.scalBasis} />
            <Row label="Corey nw / no" value={`${sim.nw} / ${sim.no}`} basis={init.scalBasis} />
            <Row label="μw / μo" value={`${sim.muw.toFixed(3)} / ${sim.muo.toFixed(3)} cP`} basis="correlation" />
            <Row label="Viscosity ratio" value={`${sim.muRatio.toFixed(2)}×`} basis="correlation" />
            <Row label="Bo / Bw" value={`${sim.bo.toFixed(3)} / ${sim.bw.toFixed(3)}`} basis="deck" />
            <Row label="φ / N:G" value={`${sim.phi.toFixed(3)} / ${sim.ntg.toFixed(2)}`} basis={init.rock.basis.phi} />
            <Row label="Permeability" value={`${sim.kMd} mD`} basis={init.rock.basis.kMd} />
            <Row label="Initial pressure" value={`${sim.pInit} bara at ${sim.datumTvdss} m`} basis="deck" />
            <Row label="Initial Sw" value={sim.swInit.toFixed(2)} basis={init.rock.basis.sw} />
            <Row label="Contact" value={sim.owc != null ? `${sim.owc} m TVDSS` : 'none'} basis="user" />
          </div>
          <p className="frx-note">
            These eleven rows are the whole seam. The FV/streamline engine, recovery screening and the forecast read
            them and keep no copy of their own — change an endpoint on the SCAL pane and every one of them moves.
          </p>

          <div className="frx-sec">Before you run this</div>
          {fails.length === 0 && warns.length === 0 && (
            <p className="frx-note">Nothing about this case blocks or qualifies a run.</p>
          )}
          {[...fails, ...warns].map((i, n) => (
            <div key={n} className={`frx-issue ${i.severity}`}>
              {i.severity === 'fail' ? <XCircle size={11} /> : <AlertTriangle size={11} />}
              <span><em>{i.rule}</em>{i.message}</span>
            </div>
          ))}

          <div className="frx-sec">Provenance of this case</div>
          <div className="frx-kv">
            <Row label="PVT" value="11 deck anchors + Standing / Beggs–Robinson / Vazquez–Beggs / DAK / McCain" basis="deck" />
            <Row label="SCAL" value={init.scalBasis === 'analogue' ? 'water-wet North Sea analogue — no core delivered' : 'edited on this tab'} basis={init.scalBasis} />
            <Row label="Rock" value={`φ, N:G, Sw from the delivery; k ${init.rock.basis.kMd}`} basis={init.rock.basis.phi} />
            <Row label="Initialization" value={`checked against ${init.pressurePoints.filter((p) => p.quality !== 'column').length} gauge buildups`} basis="measured" />
          </div>
        </div>
      </section>
    </div>
  );
}

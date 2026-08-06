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
import { splitUnit } from './fluids-format';
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
  interpreted: 'Read off the delivery’s interpreted logs — somebody’s petrophysical interpretation, not a core measurement.',
  correlation: 'A published correlation, anchored to a deck value.',
  analogue: 'No measurement exists — an analogue stands in, and the case says so.',
  user: 'Moved off the delivery’s basis by hand on this tab.',
  regulator: 'The authority’s published figure.',
};

/** Fixed-width code per basis. Spelling "correlation" out twelve times down a rail is
 *  noise that pushes every value out of alignment; a four-character code keeps the
 *  provenance column a column, and the full wording lives in the tooltip. */
const BASIS_CODE: Record<Basis, string> = {
  deck: 'DECK', measured: 'MEAS', interpreted: 'INTP',
  correlation: 'CORR', analogue: 'ANLG', user: 'USER', regulator: 'REG',
};

const Chip = ({ basis }: { basis: Basis }) => (
  <i className={`frx-basis-chip b-${basis}`} title={`${basis} — ${BASIS_TITLE[basis]}`}>{BASIS_CODE[basis]}</i>
);

/**
 * One parameter, one line: label · value · unit · provenance.
 *
 * `unit` is usually inferred from the value string so the 70-odd existing rows did not
 * each have to be rewritten, but an explicit `unit` always wins — needed wherever the
 * value is a composite the splitter correctly refuses to touch.
 */
function Row({ label, value, unit, basis }: { label: string; value: string; unit?: string; basis?: Basis }) {
  const split = unit === undefined ? splitUnit(value) : { value, unit };
  return (
    <div className="frx-kv-row">
      <span title={label}>{label}</span>
      <b>{split.value}</b>
      <u>{split.unit ?? ''}</u>
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

/** Position on a scale, clamped, as a 0–100 percentage. Non-finite input yields 0
 *  rather than NaN: `left: NaN%` is silently dropped by the browser, so a bad value
 *  would park a needle at the origin with nothing to say it had failed. */
const pos = (v: number, lo: number, hi: number) => {
  if (!Number.isFinite(v) || !Number.isFinite(lo) || !Number.isFinite(hi) || hi === lo) return 0;
  return Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
};

/**
 * What kind of fluid this is, at a glance.
 *
 * The rail opened with eleven identically-weighted rows, so the three facts that
 * actually characterise a reservoir fluid — how light the oil is, how rich the gas is,
 * how saline the brine is — were buried among the datum depth and the rock
 * compressibility. This puts them first and on scales, because "28.9 °API" only means
 * something if you know where that sits between tar and condensate.
 */
function FluidSignature({ pvt, anchors }: { pvt: DynamicInitialization['pvt']; anchors: DynamicInitialization['anchors'] }) {
  // industry bands, so the gradient is a classification and not decoration
  const API_LO = 10, API_HI = 50;
  const band = pvt.api < 22.3 ? 'heavy' : pvt.api < 31.1 ? 'medium' : 'light';
  return (
    <div className="frx-sig">
      <div className="frx-sig-hero">
        <b>{pvt.api.toFixed(1)}</b>
        <span>°API</span>
        <em className={`frx-sig-band ${band}`}>{band} crude</em>
      </div>
      <div className="frx-sig-scale" title={`${pvt.api.toFixed(1)} °API — heavy < 22.3 · medium 22.3–31.1 · light > 31.1`}>
        <i className="frx-sig-track" />
        <i className="frx-sig-needle" style={{ left: `${pos(pvt.api, API_LO, API_HI)}%` }} />
        <u style={{ left: '0%' }}>10</u>
        <u style={{ left: '100%', transform: 'translateX(-100%)' }}>50</u>
      </div>
      <div className="frx-sig-grid">
        {[
          { k: 'Gas gravity', v: pvt.gammaG.toFixed(3), u: 'air = 1', t: `${anchors.rhoGasSc} kg/m³ at surface` },
          { k: 'Brine', v: pvt.salinityWtPct.toFixed(1), u: 'wt% NaCl', t: `back-solved from ${anchors.rhoWaterSc} kg/m³ through McCain` },
          { k: 'Solution GOR', v: String(anchors.rsb), u: 'Sm³/Sm³', t: 'at the bubble point, from the deck' },
        ].map((c) => (
          <div key={c.k} title={c.t}>
            <b>{c.v}</b><i>{c.u}</i><span>{c.k}</span>
          </div>
        ))}
      </div>
      {/* the three surface densities, to scale against each other */}
      <div className="frx-sig-rho">
        {[
          { k: 'oil', v: anchors.rhoOilSc, c: 'var(--teal)' },
          { k: 'water', v: anchors.rhoWaterSc, c: 'var(--cblue,#60a5fa)' },
        ].map((r) => (
          <div key={r.k} title={`${r.k} ${r.v} kg/m³ at surface`}>
            <span>{r.k}</span>
            <i><em style={{ width: `${pos(r.v, 700, 1150)}%`, background: r.c }} /></i>
            <u>{r.v}</u>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * The reservoir's pressure state as a track rather than three numbers.
 *
 * Whether a fluid is under- or saturated is the single most consequential thing on
 * this tab — it decides whether an oil–water simulation is even the right physics —
 * and it was previously two adjacent rows the reader had to subtract in their head.
 */
function PressureState({ anchors, undersaturation }: { anchors: DynamicInitialization['anchors']; undersaturation: number }) {
  const hi = anchors.pi * 1.1;
  const pbPct = pos(anchors.pb, 0, hi), piPct = pos(anchors.pi, 0, hi);
  const saturated = undersaturation < 0;
  return (
    <div className="frx-state">
      <div className="frx-state-head">
        <span>Reservoir state</span>
        <em className={saturated ? 'bad' : 'good'}>
          {saturated ? 'saturated' : `${undersaturation.toFixed(0)} bar undersaturated`}
        </em>
      </div>
      <div className="frx-state-track">
        <i className="frx-state-sat" style={{ width: `${pbPct}%` }} title="below the bubble point — free gas would evolve" />
        <i className="frx-state-und" style={{ left: `${pbPct}%`, width: `${Math.max(0, piPct - pbPct)}%` }}
          title={`${undersaturation.toFixed(0)} bar of undersaturation — no free gas in the reservoir`} />
        <i className="frx-state-mark pb" style={{ left: `${pbPct}%` }} />
        <i className="frx-state-mark pi" style={{ left: `${piPct}%` }} />
      </div>
      <div className="frx-state-legend">
        <span className="pb"><b>Pb</b> {anchors.pb} bara</span>
        <span className="pi"><b>Pi</b> {anchors.pi} bara</span>
        <span className="t"><b>T</b> {anchors.tC} °C</span>
      </div>
    </div>
  );
}

/**
 * How far a correlation had to be moved to meet the deck.
 *
 * The raw factor (×0.9920) is precise and unreadable. What matters is whether it sits
 * near 1, so this draws it against a ±10% axis with the centre marked — a needle in
 * the middle means the correlation already described this fluid.
 */
function AnchorBar({ label, predicted, target, factor }: {
  label: string; predicted: string; target: string; factor: number;
}) {
  const devPct = (factor - 1) * 100;
  const SPAN = 10; // ±10% full scale
  const clamped = Math.max(-SPAN, Math.min(SPAN, devPct));
  const near = Math.abs(devPct) <= 5;
  return (
    <div className="frx-anchorbar">
      <div className="frx-anchorbar-head">
        <span>{label}</span>
        <b className={near ? 'good' : 'warn'}>{devPct >= 0 ? '+' : ''}{devPct.toFixed(1)}%</b>
      </div>
      <div className="frx-anchorbar-track" title={`predicted ${predicted} · deck ${target} · ×${factor.toFixed(4)}`}>
        <i className="frx-anchorbar-zero" />
        <i className={'frx-anchorbar-fill' + (near ? '' : ' warn')}
          style={clamped >= 0
            ? { left: '50%', width: `${(clamped / SPAN) * 50}%` }
            : { right: '50%', width: `${(-clamped / SPAN) * 50}%` }} />
      </div>
      <div className="frx-anchorbar-foot">
        <span>predicted <b>{predicted}</b></span>
        <span>deck <b>{target}</b></span>
      </div>
    </div>
  );
}

export function FluidsRocks({ field }: { field: SearchEntry }) {
  const { basis, ready } = useFluidBasis();
  const [pane, setPane] = useState<Pane>('pvt');
  const [over, setOver] = useState<FluidOverrides>({});

  const init = useMemo(() => assembleCase(field.id, basis, over), [field.id, basis, over]);

  // PUBLISH. Everything downstream that initialises a flow calculation reads the case
  // from here, so moving an endpoint on this tab moves the simulation — there is no
  // second copy of a viscosity or a Corey exponent anywhere else.
  //
  // Reached through `getState()` rather than the hook ON PURPOSE. This surface is a
  // WRITER, not a reader: subscribing it to the store as well means every publish
  // notifies the very component that published, and React warns that a component is
  // being updated while a different one renders. A writer that also subscribes is the
  // bug; not subscribing is the fix.
  useEffect(() => { useFluidCase.getState().publish(init); }, [init]);

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
      {pane === 'scal' && <ScalPane init={init} basis={basis} over={over} setOver={setOver} scalMoved={scalMoved} />}
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
        <PvtChart pvt={p} pb={a.pb} pi={a.pi} />
        <footer>
          <Info size={11} style={{ color: 'var(--teal)' }} />
          The kink at Pb is the physics, not a plotting artefact: below it gas leaves solution so Rs and Bo both fall
          with pressure; above it Rs is frozen at {a.rsb} Sm³/Sm³ and Bo falls only by compression at
          {' '}{p.co.toExponential(2)} /bar. Volve never crossed it — Pi sits {init.equil.undersaturationBar.toFixed(0)} bar above.
        </footer>
      </section>

      <section className="frx-panel aside">
        <header><span className="frx-ic"><Gauge size={12} /></span><b>Viscosity</b></header>
        <ViscosityChart pvt={p} pb={a.pb} pi={a.pi} />
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
          <FluidSignature pvt={p} anchors={a} />
          <PressureState anchors={a} undersaturation={init.equil.undersaturationBar} />

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
              <Row label="Gas gravity" value={p.gammaG.toFixed(3)} unit="air = 1" basis="correlation" />
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
            <AnchorBar label="Standing Rs at Pb" predicted={`${cal.rsPredicted.toFixed(1)} Sm³/Sm³`}
              target={`${a.rsb} Sm³/Sm³`} factor={cal.rsFactor} />
            <AnchorBar label="Standing Bo at Rsb" predicted={cal.boPredicted.toFixed(4)}
              target={p.bob.toFixed(4)} factor={cal.boFactor} />
            <p className="frx-note">
              Standing’s correlation is evaluated at the deck’s own bubble point, then scaled so it passes exactly
              through it. The bar is how far it had to move: a needle near the centre means this fluid genuinely
              behaves like the correlation’s population, so the curve shape <em>between</em> the anchors can be
              trusted. A needle out at the edge would mean the opposite.
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

function ScalPane({ init, basis, over, setOver, scalMoved }: {
  init: DynamicInitialization; basis: FluidBasis; over: FluidOverrides;
  setOver: (f: (o: FluidOverrides) => FluidOverrides) => void; scalMoved: boolean;
}) {
  const s = init.scal, w = init.welge, wet = init.wettability;
  const set = (k: keyof ScalEndpoints) => (v: number) =>
    setOver((o) => ({ ...o, scal: { ...o.scal, [k]: v } }));
  const moved = (k: keyof ScalEndpoints) => over.scal?.[k] !== undefined;
  const dRho = init.pvt.rhoWaterRes - init.pvt.rhoOilRes;
  const anchor = basis.swcAnchor;
  const isLet = s.model === 'let';

  return (
    <div className="frx-body pane-scal">
      <section className="frx-panel main">
        <header>
          <span className="frx-ic"><Waves size={12} /></span>
          <b>Relative permeability and fractional flow</b>
          <Chip basis={init.scalBasis} />
        </header>
        <KrChart scal={s} muw={init.pvt.muw} muo={init.pvt.muoAtPi} welge={w} />
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
        <TransitionChart scal={s} dRho={dRho} phi={init.rock.phi} kMd={init.rock.kMd}
          owc={init.equil.owc} fwl={init.equil.fwl} />
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
            <h4><Droplets size={11} />Curve model<em><Chip basis={init.scalBasis} /></em></h4>
            <div className="frx-panes" style={{ width: '100%' }}>
              {(['corey', 'let'] as const).map((m) => (
                <button key={m} style={{ flex: 1, justifyContent: 'center' }}
                  className={(s.model ?? 'corey') === m ? 'on' : ''}
                  onClick={() => setOver((o) => ({ ...o, scal: { ...o.scal, model: m } }))}>
                  {m === 'corey' ? 'Corey' : 'LET'}
                </button>
              ))}
            </div>
            <p className="frx-note">
              {isLet
                ? 'LET (Lomeland–Ebeltoft–Thomas): three parameters per phase — L is the slope leaving the end point, T the approach to the far end, E the height through the middle. That middle freedom is what a history match needs and Corey does not have.'
                : 'Corey: one exponent per phase, pinning the whole curve at once. Enough for screening; switch to LET when a match needs to move the mid-range without moving the end points.'}
            </p>
          </div>

          {anchor && (
            <div className="frx-rail-sec">
              <h4><Database size={11} />Swc from this field’s logs</h4>
              <div className="frx-kv">
                <Row label="Buckles number Sw·φ" value={anchor.buckles.toFixed(4)} basis="interpreted" />
                <Row label={`Swc at φ = ${anchor.phi.toFixed(3)}`} value={`${anchor.low.toFixed(2)} – ${anchor.high.toFixed(2)}`} basis="interpreted" />
                <Row label="Wells contributing" value={anchor.wells.map((f) => f.well).join(', ') || '—'} unit="" basis="interpreted" />
                {anchor.excluded.length > 0 && (
                  <Row label="Excluded (never reach Swirr)" value={anchor.excluded.join(', ')} unit="" basis="interpreted" />
                )}
              </div>
              <button className="frx-reset" style={{ marginTop: 8 }}
                onClick={() => setOver((o) => ({ ...o, scal: { ...o.scal, swc: Number(anchor.high.toFixed(3)) } }))}>
                <Database size={9} />Adopt Swc = {anchor.high.toFixed(2)}
              </button>
              <p className="frx-note">
                Buckles: in rock at irreducible saturation the product Sw·φ is roughly constant, so a low
                percentile of it over clean, porous samples bounds Swc. {anchor.wells.length} of{' '}
                {basis.satWells} well{basis.satWells === 1 ? '' : 's'} with interpreted saturation reach
                irreducible; the rest sit in the water leg and are excluded rather than averaged in.
                This is an interpretation of an interpretation — Equinor’s LFP curve, not a core plug —
                and adopting it moves the in-place volume, so it is offered rather than applied.
              </p>
            </div>
          )}

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
            <h4><Waves size={11} />{isLet ? 'LET parameters' : 'Corey exponents'}</h4>
            {isLet ? (
              <>
                <Slider label="Water Lw" value={s.lw ?? 3} min={0.5} max={8} step={0.1}
                  onChange={set('lw')} fmt={(v) => v.toFixed(1)} moved={moved('lw')}
                  note="slope leaving Swc" />
                <Slider label="Water Ew" value={s.ew ?? 1} min={0.05} max={20} step={0.05}
                  onChange={set('ew')} fmt={(v) => v.toFixed(2)} moved={moved('ew')}
                  note="height through the middle — the freedom Corey lacks" />
                <Slider label="Water Tw" value={s.tw ?? 2} min={0.3} max={6} step={0.1}
                  onChange={set('tw')} fmt={(v) => v.toFixed(1)} moved={moved('tw')} />
                <Slider label="Oil Lo" value={s.lo ?? 2} min={0.5} max={8} step={0.1}
                  onChange={set('lo')} fmt={(v) => v.toFixed(1)} moved={moved('lo')} />
                <Slider label="Oil Eo" value={s.eo ?? 1} min={0.05} max={20} step={0.05}
                  onChange={set('eo')} fmt={(v) => v.toFixed(2)} moved={moved('eo')} />
                <Slider label="Oil To" value={s.to ?? 2} min={0.3} max={6} step={0.1}
                  onChange={set('to')} fmt={(v) => v.toFixed(1)} moved={moved('to')} />
              </>
            ) : (
              <>
                <Slider label="Water nw" value={s.nw} min={1.5} max={6} step={0.1}
                  onChange={set('nw')} fmt={(v) => v.toFixed(1)} moved={moved('nw')}
                  note="higher = more water-wet, later water breakthrough" />
                <Slider label="Oil no" value={s.no} min={1.5} max={5} step={0.1}
                  onChange={set('no')} fmt={(v) => v.toFixed(1)} moved={moved('no')} />
              </>
            )}
            <Slider label="Pore-size λ" value={s.lambda} min={0.5} max={5} step={0.1}
              onChange={set('lambda')} fmt={(v) => v.toFixed(1)} moved={moved('lambda')}
              note="Brooks–Corey — sets how tall the transition zone is" />
          </div>

          <div className="frx-rail-sec">
            <h4>
              <Droplets size={11} />Wettability
              <em style={{ color: wet.agreeing === 3 ? 'var(--green,#4ade80)' : 'var(--amber,#fbbf24)' }}>
                {wet.verdict} · {wet.agreeing}/3
              </em>
            </h4>
            <div className="frx-kv">
              {wet.criteria.map((c) => (
                // four cells, like every other row, so the value and verdict columns
                // line up with the cards above rather than drifting by one track
                <div key={c.key} className="frx-kv-row">
                  <span title={c.rule}>{c.label}</span>
                  <b>{Number.isFinite(c.value) ? c.value.toFixed(3) : '—'}</b>
                  <u>{c.key === 'crossover' ? 'Sw' : 'fraction'}</u>
                  <i className={`frx-basis-chip ${c.reads === wet.verdict ? 'b-deck' : 'b-analogue'}`}
                    title={`${c.label}: reads ${c.reads} · ${c.rule}`}>
                    {c.reads === 'water-wet' ? 'W-WET' : c.reads === 'oil-wet' ? 'O-WET' : 'INTER'}
                  </i>
                </div>
              ))}
            </div>
            <p className="frx-note">
              Craig’s (1971) three indicators, run <b>on these curves</b>. Wettability is a core measurement —
              Amott–Harvey or USBM — and no core was delivered, so nothing here measures the rock. What it does
              is tell you what your assumed curve shape <i>implies</i>.
              {wet.agreeing < 3 && (
                <> The indicators disagree, which is a statement about the analogue rather than about Volve:
                  a curve introduced as water-wet whose end points read otherwise is worth sensitising before
                  any sweep number off it is believed.</>
              )}
            </p>
          </div>
          <div className="frx-rail-sec">
            <h4><LineChart size={11} />What these endpoints imply</h4>
            <div className="frx-kv">
              <Row label="Mobility ratio, M" value={init.mobilityRatio.toFixed(3)} unit="end-point" basis="correlation" />
              <Row label="Displacement efficiency, ED" value={(init.displacementEfficiency * 100).toFixed(1)} unit="%" basis={init.scalBasis} />
              <Row label="Shock front, Swf" value={w.swf.toFixed(3)} unit="fraction" basis={init.scalBasis} />
              <Row label="fw at the front" value={(w.fwf * 100).toFixed(1)} unit="%" basis={init.scalBasis} />
              <Row label="Avg Sw at breakthrough" value={w.swAvgBt.toFixed(3)} unit="fraction" basis={init.scalBasis} />
              <Row label="PVI at breakthrough" value={w.pviBt.toFixed(3)} unit="PV" basis={init.scalBasis} />
              <Row label="Recovery at breakthrough" value={(w.recoveryBt * 100).toFixed(1)} unit="% OOIP" basis={init.scalBasis} />
            </div>
            <p className="frx-note">
              {init.mobilityRatio < 1
                ? `M = ${init.mobilityRatio.toFixed(2)} is favourable: the water is less mobile than the oil it is pushing, so the front stays coherent rather than fingering through.`
                : `M = ${init.mobilityRatio.toFixed(2)} is unfavourable: water outruns the oil, so expect fingering, early breakthrough, and a coarse model to overstate sweep.`}
            </p>
          </div>
          <div className="frx-rail-sec">
            <h4><Ruler size={11} />Capillary pressure</h4>
            <div style={{ height: 148, display: 'flex', flexDirection: 'column' }}><PcChart swof={init.swof} scal={s} /></div>
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
        <PressureDepthChart init={init} points={init.pressurePoints} wells={init.wellGradients} />
        <footer>
          <Info size={11} style={{ color: 'var(--teal)' }} />
          Each well is fitted on its OWN stations. A field-wide fit would be meaningless here: these gauges span
          years of depletion and injection support, so stacking them into one line would measure the production
          history, not a fluid.
        </footer>
      </section>

      <section className="frx-panel aside">
        <header><span className="frx-ic"><Ruler size={12} /></span><b>Initial saturation and in place</b></header>
        <div style={{ flex: '0 0 auto', height: 232, display: 'flex', flexDirection: 'column' }}><InitSwChart init={init} /></div>
        <div className="frx-scroll">
          <div className="frx-sec">Equilibration</div>
          <div className="frx-kv">
            <Row label="Datum" value={`${eq.datumTvdss} m · ${eq.datumPressure} bara`} unit="" basis="deck" />
            <Row label="Oil–water contact" value={eq.owc != null ? `${eq.owc} m TVDSS` : 'none in delivery'} basis="user" />
            <Row label="Free-water level" value={eq.fwl != null ? `${eq.fwl.toFixed(1)} m TVDSS` : '—'} basis="correlation" />
            <Row label="Pressure at the contact" value={eq.contactPressure != null ? `${eq.contactPressure.toFixed(1)} bara` : '—'} basis="correlation" />
            <Row label="State at initial" value={eq.undersaturationBar.toFixed(0)} unit={`bar ${eq.saturationState}`} basis="deck" />
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
                  <Row label="Recovery factor achieved" value={(rec.rfOfficial * 100).toFixed(1)} unit="%" basis="regulator" />
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
            <Row label="Swc / Sor" value={`${sim.swc.toFixed(2)} / ${sim.sor.toFixed(2)}`} unit="fraction" basis={init.scalBasis} />
            <Row label="krw / kro end points" value={`${sim.krwMax.toFixed(2)} / ${sim.kroMax.toFixed(2)}`} unit="fraction" basis={init.scalBasis} />
            <Row label="Corey nw / no" value={`${sim.nw} / ${sim.no}`} unit="exponent" basis={init.scalBasis} />
            <Row label="μw / μo" value={`${sim.muw.toFixed(3)} / ${sim.muo.toFixed(3)}`} unit="cP" basis="correlation" />
            <Row label="Viscosity ratio" value={sim.muRatio.toFixed(2)} unit="μo/μw" basis="correlation" />
            <Row label="Bo / Bw" value={`${sim.bo.toFixed(3)} / ${sim.bw.toFixed(3)}`} unit="rm³/Sm³" basis="deck" />
            <Row label="φ / N:G" value={`${sim.phi.toFixed(3)} / ${sim.ntg.toFixed(2)}`} unit="fraction" basis={init.rock.basis.phi} />
            <Row label="Permeability" value={`${sim.kMd} mD`} basis={init.rock.basis.kMd} />
            <Row label="Initial pressure" value={`${sim.pInit} @ ${sim.datumTvdss} m`} unit="bara" basis="deck" />
            <Row label="Initial Sw" value={sim.swInit.toFixed(2)} unit="fraction" basis={init.rock.basis.sw} />
            <Row label="Contact" value={sim.owc != null ? String(sim.owc) : 'none'} unit={sim.owc != null ? 'm TVDSS' : ''} basis="user" />
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
            <Row label="PVT" value="11 deck anchors + Standing / Beggs–Robinson / Vazquez–Beggs / DAK / McCain" unit="" basis="deck" />
            <Row label="SCAL" value={init.scalBasis === 'analogue' ? 'water-wet North Sea analogue — no core delivered' : 'edited on this tab'} unit="" basis={init.scalBasis} />
            <Row label="Rock" value={`φ, N:G, Sw from the delivery; k ${init.rock.basis.kMd}`} basis={init.rock.basis.phi} />
            <Row label="Initialization" value={`checked against ${init.pressurePoints.filter((p) => p.quality !== 'column').length} gauge buildups`} basis="measured" />
          </div>
        </div>
      </section>
    </div>
  );
}

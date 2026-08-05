// Petrophysics — the SHELL CANVAS.
//
// This is the real layout, at real proportions, with every region annotated: what it
// is, what it will be drawn with, and — the part that matters — WHAT DATA IT HAS,
// counted live from the workspace rather than described in the abstract. A region
// that says "20 of 25 bores carry the Archie quartet" is reading that off
// `getWorkspace()` at render time. Change the delivery and the canvas changes.
//
// Nothing here computes petrophysics yet. That is deliberate: the layout is the thing
// being reviewed, and a half-real interpretation under a half-real layout would make
// both impossible to judge. Each region names the component that will replace it
// (P1–P9 in docs/arganta-energy/PETROPHYSICS-SUITE-CONCEPT.md), so the canvas is a
// build checklist you can look at.
//
// Four sub-tabs, one persistent rail:
//
//   Single Well   the interpretation bench — tracks, endpoints, cutoffs
//   Correlation   the multi-well panel — flatten on a top the wells SHARE
//   Analytics     2D / 3D crossplots over one shared sample table
//   Zonation      zone × well net/pay matrix — the deliverable
//
//   Parameters    a RAIL, not a tab: changing `m` while looking at a crossplot and
//                 changing it while looking at a log are the same act.
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, BarChart3, Box, Columns3, Database,
  Layers, Library, LineChart, Sigma, Sparkles, Table2,
} from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { useWorkspace, commonCurveTypes, commonTops, type Workspace } from './workspace';
import { PETRO_SCHEMATICS } from './petro-schematics';
import { PetroLogBench } from './PetroLogBench';
import { PetroZoneStrip } from './PetroZoneStrip';
import { PetroCrossplot2D, type Template } from './PetroCrossplot2D';
import { usePetroCloud } from './petro-cloud';
import { PetroZonationMatrix } from './PetroZonationMatrix';
import { PetroCorrelationPanel } from './PetroCorrelationPanel';
import { PetroParamsRail } from './PetroParamsRail';
import { usePetroWell } from './petro-well';
import { DEFAULT_PARAMS, resolvePublishedArchie, type PetroParams } from './petro-compute';
import { usePublishedArchie } from './fluids-live';
import './petrophysics.css';
import './petro-live.css';

type Pane = 'well' | 'correlation' | 'analytics' | 'zonation';

const PANES: Array<{ id: Pane; label: string; icon: typeof LineChart; hint: string }> = [
  { id: 'well', label: 'Single Well', icon: LineChart, hint: 'the interpretation bench' },
  { id: 'correlation', label: 'Correlation', icon: Columns3, hint: 'multi-well panel' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, hint: '2D · 3D crossplots' },
  { id: 'zonation', label: 'Zonation', icon: Table2, hint: 'net · pay · the deliverable' },
];

/** The four curves Archie needs. A bore missing any one of them cannot produce a
 *  saturation, and the canvas says so rather than quietly counting it in. */
const ARCHIE_QUARTET = ['GR', 'RT', 'RHOB', 'NPHI'];
/** Equinor's LFP interpretation curves. Their presence is what makes a bore a
 *  CALIBRATION well rather than a subject — see the concept doc §0.1. */
const LFP_CURVES = ['PHIE', 'SW', 'VSH', 'RW'];

/** Build number of the plan each region belongs to, so the canvas doubles as the
 *  build order. Mirrors PETROPHYSICS-SUITE-CONCEPT.md Part 5. */
type Step = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9';

interface RegionSpec {
  /** the grid area this region occupies — see petrophysics.css */
  area: string;
  step: Step;
  icon: typeof LineChart;
  title: string;
  /** what it is and what you do with it */
  blurb: string;
  /** what draws it */
  library: string;
  /** the component that will replace this placeholder */
  component: string;
  /** LIVE — read from the workspace at render */
  data: (ws: Workspace, ctx: Ctx) => string;
  /** a caveat the region must keep visible even in the finished build */
  caveat?: string;
  /** key into PETRO_SCHEMATICS for the inline preview drawing */
  schematic?: keyof typeof PETRO_SCHEMATICS;
}

interface Ctx {
  well: string | null;
  wells: string[];
  quartet: string[];
  lfp: string[];
  /** depth samples across every bore with logs — the size of the sample table */
  samples: number;
  /** depth samples on `well` alone. Kept separate on purpose: quoting the field
   *  total on a single-well row would overstate that well by ~25×. */
  wellSamples: number;
}

// ── the regions, per sub-tab ─────────────────────────────────────────────────

const WELL_REGIONS: RegionSpec[] = [
  {
    area: 'main', step: 'P4', icon: LineChart, schematic: 'tracks',
    title: 'Log tracks — the bench',
    blurb: 'Depth-synchronised multi-track: zones · GR with draggable clean/shale endpoints · resistivity on log scale · RHOB–NPHI with crossover fill · the computed Vsh/PHIT/PHIE/Sw · a net/pay ribbon. Drag an endpoint and every downstream track redraws.',
    library: 'Canvas 2D + d3-scale (adapt dataqc/viewers/LogViewer.tsx)',
    component: 'PetroLogBench',
    data: (ws, c) => {
      const bore = ws.bores.find((b) => b.name === c.well);
      return bore
        ? `${bore.name} · ${bore.curves.length} curve types · ${c.wellSamples.toLocaleString('en-US')} depth samples · ${bore.tops.length} picks`
        : 'no bore selected';
    },
    caveat: 'Equinor’s interpreted curves overlay ours dashed — never averaged, never merged.',
  },
  {
    area: 'aside', step: 'P8', icon: Sigma, schematic: 'zonestrip',
    title: 'Zone summary — this well',
    blurb: 'Gross · net · N:G · mean PHIE · mean Sw per picked interval, recomputed the moment a cutoff moves. The per-well slice of the Zonation deliverable.',
    library: 'engine/petro.zoneAverages (truth-locked) + CSS grid',
    component: 'PetroZoneStrip',
    data: (ws, c) => {
      const bore = ws.bores.find((b) => b.name === c.well);
      return bore?.tops.length
        ? `${Math.max(0, bore.tops.length - 1)} intervals from ${bore.tops.length} picks`
        : 'no picks on this bore — no interval can be averaged';
    },
    caveat: 'A bore with no pick for a zone reports no net pay for it. Never an interpolated one.',
  },
];

const CORRELATION_REGIONS: RegionSpec[] = [
  {
    area: 'main', step: 'P6', icon: Columns3, schematic: 'panel',
    title: 'Correlation panel',
    blurb: 'The wells you picked in the Input tree, side by side, hung on MD, on TVDSS, or flattened on a shared horizon. Correlation lines join the picks; zone fills carry across; a well missing a pick shows the gap.',
    library: 'Canvas 2D + d3-scale · geometry from xsection.ts when traced on the map',
    component: 'PetroCorrelationPanel',
    // With every log-bearing bore selected the intersection collapses — on Volve to
    // 2 curve types and 0 shared horizons. That is not a defect to hide, it is the
    // constraint the panel exists to enforce, so the canvas states it and then names
    // the largest cohort that CAN actually be correlated.
    data: (ws, c) => {
      const curves = commonCurveTypes(ws.curveTypes, c.wells).length;
      const horizons = commonTops(ws.tops, c.wells).length;
      // "widest cohort" must mean widest PANEL — a bore with the pick but no logs
      // contributes a datum and no tracks, so it is not a column you can draw.
      const logged = new Set(c.wells.map((w) => w.toLowerCase().replace(/[^a-z0-9]/g, '')));
      const best = ws.tops
        .map((t) => ({ t, n: t.wells.filter((w) => logged.has(w.toLowerCase().replace(/[^a-z0-9]/g, ''))).length }))
        .sort((a, b) => b.n - a.n)[0];
      return `all ${c.wells.length} bores → ${curves} curve types · ${horizons} horizons in common`
        + (horizons === 0 && best?.n
          ? `  ·  widest drawable cohort: ${best.n} logged bores on “${best.t.surface}”`
          : '');
    },
    caveat: 'The datum list is commonTops(selection) — you cannot flatten on a horizon one well lacks, so an unworkable panel is unreachable rather than merely discouraged.',
  },
  {
    area: 'aside', step: 'P6', icon: Layers, schematic: 'datum',
    title: 'Datum & track picker',
    blurb: 'Choose the flattening horizon and the tracks. Both lists are computed from the selection, so an impossible panel is unreachable rather than merely discouraged.',
    library: 'workspace-model.commonTops / commonCurveTypes (truth-locked)',
    component: 'PetroPanelControls',
    data: (ws) => `${ws.tops.length} pick surfaces · ${ws.curveTypes.length} curve types in the delivery`,
  },
];

const ANALYTICS_REGIONS: RegionSpec[] = [
  {
    area: 'main', step: 'P5', icon: BarChart3, schematic: 'xplot',
    title: '2D crossplot',
    blurb: 'Any curve vs any curve, coloured by a third. Templates that carry meaning: density–neutron (lithology + gas crossover), Pickett (m is the slope, Rw the intercept — you read the parameters off the plot), Hingle, Buckles, Vsh–PHIE.',
    library: 'Canvas 2D (point cloud) + d3-scale · SVG overlay for template lines',
    component: 'PetroCrossplot2D',
    data: (ws, c) => `${c.samples.toLocaleString('en-US')} samples across ${c.wells.length} bores · ${ws.curveTypes.length} axes available`,
    caveat: 'Pickett is log–log. A linear Pickett is not a Pickett.',
  },
  {
    area: 'aside', step: 'P7', icon: Box, schematic: 'xplot3d',
    title: '3D crossplot',
    blurb: 'Three curves as axes plus colour, orbit and box-select. Not decoration: GR × RHOB × RT coloured by zone separates facies that any two of the three overlap on.',
    library: 'deck.gl PointCloudLayer (already a dependency) · OrbitView',
    component: 'PetroCrossplot3D',
    data: (_ws, c) => `${c.samples.toLocaleString('en-US')} points · GPU-drawn`,
  },
];

const ZONATION_REGIONS: RegionSpec[] = [
  {
    area: 'main', step: 'P8', icon: Table2, schematic: 'matrix',
    title: 'Zone × well matrix',
    blurb: 'Gross · net · N:G · mean PHIE · mean Sw · net pay, per zone per bore. Rows a bore cannot fill are shown empty with the reason — the missing pick or the missing curve — rather than dropped.',
    library: 'engine/petro.zoneAverages + CSS grid',
    component: 'PetroZonationMatrix',
    data: (ws) => `${ws.tops.length} pick surfaces × ${ws.bores.length} bores`,
    caveat: 'This is the PetrophysicalModel artifact the static model consumes.',
  },
];

// ── the parameters rail ──────────────────────────────────────────────────────

// ── rendering ────────────────────────────────────────────────────────────────

/** A data line is a readout, not a load-bearing computation. If one throws — a
 *  partially-loaded workspace, a hot-reloaded module holding a stale context — the
 *  region says so and the rest of the canvas stays up. A layout you cannot see
 *  because one string failed is worse than a string that admits it failed. */
function safeData(spec: RegionSpec, ws: Workspace, ctx: Ctx): string {
  try {
    return spec.data(ws, ctx) || '—';
  } catch {
    return 'unavailable — the workspace is still resolving';
  }
}

function Region({ spec, ws, ctx }: { spec: RegionSpec; ws: Workspace; ctx: Ctx }) {
  const Icon = spec.icon;
  const Schematic = spec.schematic ? PETRO_SCHEMATICS[spec.schematic] : null;
  return (
    <section className="pps-region" style={{ gridArea: spec.area }}>
      <header>
        <span className="pps-region-ic"><Icon size={13} /></span>
        <b>{spec.title}</b>
        <em className="pps-step">{spec.step}</em>
      </header>
      {Schematic && <div className="pps-schematic">{<Schematic />}</div>}
      <p>{spec.blurb}</p>
      <dl>
        <div className="live">
          <dt><Database size={10} /> Data</dt>
          <dd>{safeData(spec, ws, ctx)}</dd>
        </div>
        <div>
          <dt><Library size={10} /> Library</dt>
          <dd>{spec.library}</dd>
        </div>
        <div>
          <dt><Sparkles size={10} /> Component</dt>
          <dd><code>{spec.component}</code></dd>
        </div>
      </dl>
      {spec.caveat && (
        <footer><AlertTriangle size={10} /> {spec.caveat}</footer>
      )}
    </section>
  );
}

export function Petrophysics({ field }: { field: SearchEntry }) {
  const [pane, setPane] = useState<Pane>('well');
  const { ws, ready } = useWorkspace();
  // The parameter set is the deliverable — it lives above every pane, so switching
  // from the bench to a crossplot never silently reverts an interpretation.
  const [params, setParams] = useState<PetroParams>(DEFAULT_PARAMS);
  const [template, setTemplate] = useState<Template>('denneu');
  // Decoded only while Analytics is showing: a 24-bore log decode is not
  // something to pay for on a pane that does not plot it.
  const cloud = usePetroCloud(ws, pane === 'analytics');
  /** the delivery's own free-water level, for the saturation-height template */
  const contactDepth = useMemo(() => {
    const c = ws.contacts.find((x) => /owc|gwc|goc/i.test(String(x.kind)));
    const d = Number(c?.tvdss);
    return Number.isFinite(d) ? Math.abs(d) : null;
  }, [ws.contacts]);
  const [boreName, setBoreName] = useState<string | null>(null);

  // START FROM WHAT THE DELIVERY PUBLISHES, not from the textbook.
  //
  // a=1, m=2, n=2, Rw=0.03 is a generic sandstone. Volve's own evaluation fits
  // m = 1.865·k^-0.0083 (≈1.79), n = 2.45, and measures the brine at 0.07 Ω·m at 20 °C
  // — every one different from the default, and all three feed Archie multiplicatively.
  // Applied ONCE, when the delivery's values arrive, and never again: an engineer who
  // has moved a parameter must not have it pulled back underneath them.
  const { archie, reservoirTempC, ready: archieReady } = usePublishedArchie();
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (seeded || !archieReady || !archie) return;
    setParams((p) => resolvePublishedArchie(p, archie, reservoirTempC));
    setSeeded(true);
  }, [seeded, archieReady, archie, reservoirTempC]);

  const ctx: Ctx = useMemo(() => {
    const withLogs = ws.bores.filter((b) => b.hasLogs);
    const quartet = withLogs.filter((b) => ARCHIE_QUARTET.every((k) => b.curves.includes(k)));
    const lfp = withLogs.filter((b) => LFP_CURVES.every((k) => b.curves.includes(k)));
    // depth samples come from the log assets' own digest meta — measured at ingest,
    // not counted here by decoding every curve
    const byId = new Map(ws.assets.map((a) => [a.id, a]));
    const samplesOf = (id?: string) => Number(byId.get(id ?? '')?.meta.samples) || 0;
    // the bench opens on the most complete bore — the one a petrophysicist would
    // reach for first — rather than whichever happens to sort earliest
    const lead = [...withLogs].sort((a, b) => b.curves.length - a.curves.length
      || b.tops.length - a.tops.length
      || a.name.localeCompare(b.name, 'en', { numeric: true }))[0] ?? null;
    return {
      well: lead?.name ?? null,
      wells: withLogs.map((b) => b.name),
      quartet: quartet.map((b) => b.name),
      lfp: lfp.map((b) => b.name),
      samples: withLogs.reduce((n, b) => n + samplesOf(b.assetIds.log), 0),
      wellSamples: lead ? samplesOf(lead.assetIds.log) : 0,
    };
  }, [ws]);

  // The bore the bench is on: whatever the user last chose (here or in the Input
  // tree), falling back to the most complete one. Resolved against the workspace so
  // a name that no longer exists after a re-scope cannot strand the pane.
  const bore = useMemo(() => {
    const withLogs = ws.bores.filter((b) => b.hasLogs);
    return withLogs.find((b) => b.name === boreName)
      ?? withLogs.find((b) => b.name === ctx.well)
      ?? null;
  }, [ws.bores, boreName, ctx.well]);

  // ONE interpretation per (bore × parameters), shared by the bench and the strip.
  const well = usePetroWell(ws, bore, params);

  const regions = pane === 'well' ? WELL_REGIONS
    : pane === 'correlation' ? CORRELATION_REGIONS
    : pane === 'analytics' ? ANALYTICS_REGIONS
    : ZONATION_REGIONS;

  return (
    <div className="pps">
      <div className="pps-bar">
        <span className="pps-title">Petrophysics</span>
        <span className="pps-sub">
          {ready
            ? `${field.name} · ${ws.bores.length} bores · ${ws.curveTypes.length} curve types · ${ws.tops.length} pick surfaces`
            : 'reading the workspace…'}
        </span>
        <span className="pps-spacer" />
        <span className="pps-panes">
          {PANES.map((p) => (
            <button key={p.id} className={pane === p.id ? 'on' : ''} onClick={() => setPane(p.id)} title={p.hint}>
              <p.icon size={12} /> {p.label}
            </button>
          ))}
        </span>
      </div>

      {/* The coverage strip. It is the first thing on screen because it is the
          finding the whole tab is shaped around: a small calibration set and a
          large subject set. Counted live — no delivery is assumed. */}
      <div className="pps-coverage">
        <span className="pps-cov-cell">
          <b>{ws.bores.length}</b><i>bores</i>
        </span>
        <span className="pps-cov-cell">
          <b>{ctx.wells.length}</b><i>with logs</i>
        </span>
        <span className="pps-cov-cell good">
          <b>{ctx.quartet.length}</b><i>full Archie quartet</i>
        </span>
        <span className="pps-cov-cell warn">
          <b>{ctx.wells.length - ctx.quartet.length}</b><i>cannot run Archie</i>
        </span>
        <span className="pps-cov-cell calib">
          <b>{ctx.lfp.length}</b><i>carry an interpretation → calibration set</i>
        </span>
        <span className="pps-cov-bar" title={`${ctx.lfp.length} calibration · ${ctx.quartet.length - ctx.lfp.length} to interpret · ${ws.bores.length - ctx.quartet.length} out of scope`}>
          <i className="calib" style={{ flex: ctx.lfp.length || 0.001 }} />
          <i className="subject" style={{ flex: Math.max(0, ctx.quartet.length - ctx.lfp.length) || 0.001 }} />
          <i className="out" style={{ flex: Math.max(0, ws.bores.length - ctx.quartet.length) || 0.001 }} />
        </span>
      </div>

      <div className={`pps-body pane-${pane}`}>
        {pane === 'well' ? (
          <>
            <section className="pps-live" style={{ gridArea: 'main' }}>
              <PetroLogBench well={well} params={params} onBore={setBoreName} />
            </section>
            <section className="pps-live" style={{ gridArea: 'aside' }}>
              <header className="pps-live-head">
                <Sigma size={12} /> <b>Zone summary</b>
                <em>{bore?.name ?? '—'}</em>
              </header>
              <PetroZoneStrip ws={ws} well={well} params={params} />
            </section>
          </>
        ) : (
          pane === 'analytics' ? (
            <>
              {/* The 2D plot is REAL — it reads the ingested logs through
                  petro-cloud and petro-xplot. The 3D card beside it is still the
                  blueprint region, and is left saying so rather than dressed up
                  to match. */}
              <section className="pps-region live" style={{ gridArea: 'main' }}>
                <PetroCrossplot2D
                  bores={cloud.bores}
                  contactDepth={contactDepth}
                  archie={{ a: params.a, m: params.m, n: params.n, rw: params.rw }}
                  template={template}
                  onTemplate={setTemplate}
                />
              </section>
              {regions.filter((r) => r.area === 'aside')
                .map((r) => <Region key={r.title} spec={r} ws={ws} ctx={ctx} />)}
            </>
          ) : pane === 'correlation' ? (
            <>
              {/* Real: every column is our interpretation under the rail's
                  parameters, which is why the rail stays on this pane. */}
              <PetroCorrelationPanel ws={ws} params={params} />
              {regions.filter((r) => r.area === 'aside')
                .map((r) => <Region key={r.title} spec={r} ws={ws} ctx={ctx} />)}
            </>
          ) : pane === 'zonation' ? (
            <>
              {/* The matrix is REAL — useFieldZones runs the current parameter set
                  over every logged bore. The calibration report beside it is still
                  the blueprint region and says so. */}
              <PetroZonationMatrix ws={ws} params={params} />
            </>
          ) : regions.map((r) => <Region key={r.title} spec={r} ws={ws} ctx={ctx} />)
        )}
        {/* The rail edits the INTERPRETATION parameters — Archie, endpoints,
            cutoffs. Only the panes that recompute an interpretation can act on
            them: Single Well runs it, Correlation displays the same curves across
            wells. Analytics reads finished curves and Zonation reads finished
            zones, so a rail there is a control that changes nothing you are
            looking at, which is worse than absent. */}
        {(pane === 'well' || pane === 'correlation')
          && <PetroParamsRail ws={ws} well={well} params={params} onChange={setParams} />}
      </div>

      <div className="pps-foot">
        <b>Shell canvas</b>
        <span>Layout and data contract only — no interpretation is computed yet. Every “Data” line above is read from the workspace at render.</span>
        <em>docs/arganta-energy/PETROPHYSICS-SUITE-CONCEPT.md</em>
      </div>
    </div>
  );
}

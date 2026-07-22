// Production.tsx — the 9-panel diagnostic grid (COSMO Production tab), a config-driven
// rebuild of the founder's WellNexus grid on the RMChart SVG core. Each panel is one
// DIAG_SPEC {title, x, y, scale, group}; a single component renders all nine. Cohort =
// every well in the group drawn faded; focus = the selected well (selection.ts)
// highlighted. Real Volve series from data.ts (field-unit converted). Formulas match the
// reference verbatim: Hall=ΣTHP·Δt, WOR=max(1e-3,w/o) log-Y, GOR=gas·... log-Y.
import { useMemo } from 'react';
import { useRM } from './ReservoirMgmt';
import { useSelection } from './selection';
import { RMChart, type RMSeries } from './chart/RMChart';
import { Panel, TabHeader } from './surface';
import type { RMWellSeries } from './data';

type Group = 'prod' | 'inj';
interface DiagSpec {
  title: string; xLabel: string; yLabel: string;
  x: (w: RMWellSeries) => number[];
  y: (w: RMWellSeries) => Array<number | null>;
  yLog?: boolean; group: Group;
}

const DIAG_SPECS: DiagSpec[] = [
  { title: 'Oil Rate vs Cum Oil', xLabel: 'Cum oil · MMbbl', yLabel: 'Oil rate · bopd', x: (w) => w.cumOil, y: (w) => w.oilRate, group: 'prod' },
  { title: 'WCT vs Cum Oil', xLabel: 'Cum oil · MMbbl', yLabel: 'WCT · %', x: (w) => w.cumOil, y: (w) => w.wct, group: 'prod' },
  { title: 'Hall Plot', xLabel: 'Cum winj · MMbbl', yLabel: 'Hall integral · psi·d', x: (w) => w.cumWinj, y: (w) => w.hall, group: 'inj' },
  { title: 'Liquid Rate vs Cum Oil', xLabel: 'Cum oil · MMbbl', yLabel: 'Liquid rate · bld', x: (w) => w.cumOil, y: (w) => w.liqRate, group: 'prod' },
  { title: 'Cum Liquid vs Cum Oil', xLabel: 'Cum oil · MMbbl', yLabel: 'Cum liquid · MMbbl', x: (w) => w.cumOil, y: (w) => w.cumLiquid, group: 'prod' },
  { title: 'Water Inj. Rate vs Cum Winj', xLabel: 'Cum winj · MMbbl', yLabel: 'Inj rate · bwpd', x: (w) => w.cumWinj, y: (w) => w.injRate, group: 'inj' },
  { title: 'WOR vs Cum Oil', xLabel: 'Cum oil · MMbbl', yLabel: 'WOR', x: (w) => w.cumOil, y: (w) => w.wor, yLog: true, group: 'prod' },
  { title: 'GOR vs Cum Oil', xLabel: 'Cum oil · MMbbl', yLabel: 'GOR · scf/stb', x: (w) => w.cumOil, y: (w) => w.gor, yLog: true, group: 'prod' },
  { title: 'BHP vs Cum Winj', xLabel: 'Cum winj · MMbbl', yLabel: 'BHP · psi', x: (w) => w.cumWinj, y: (w) => w.bhp, group: 'inj' },
];

function zip(xs: number[], ys: Array<number | null>): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) { const y = ys[i]; if (y != null && Number.isFinite(y) && Number.isFinite(xs[i])) out.push([xs[i], y]); }
  return out;
}

function DiagPanel({ spec, wells, focusWell }: { spec: DiagSpec; wells: RMWellSeries[]; focusWell: string | null }) {
  const series: RMSeries[] = useMemo(() => {
    const focusCol = spec.group === 'inj' ? 'var(--cblue)' : 'var(--green)';
    return wells.map((w) => {
      const pts = zip(spec.x(w), spec.y(w));
      const isFocus = w.well === focusWell;
      return { name: w.well, color: isFocus ? focusCol : 'var(--muted)', pts, faded: !isFocus && !!focusWell, width: isFocus ? 2 : 1.1 };
    }).filter((s) => s.pts.length > 0);
  }, [spec, wells, focusWell]);
  return (
    <Panel title={spec.title} minHeight={228}>
      <RMChart series={series} xLabel={spec.xLabel} yLabel={spec.yLabel} yLog={spec.yLog} />
    </Panel>
  );
}

export function Production() {
  const rm = useRM();
  const sel = useSelection();
  const groups = useMemo(() => ({ prod: rm.producers, inj: rm.injectors }), [rm]);
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TabHeader title="Production Performance" nature="reported"
        subtitle={`${rm.producers.length} producers · ${rm.injectors.length} injectors · Volve daily→monthly · diagnostic grid (WellNexus template)${sel.well ? ` · focus ${sel.well}` : ''}`} />
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {DIAG_SPECS.map((spec) => (
            <DiagPanel key={spec.title} spec={spec} wells={groups[spec.group]} focusWell={sel.well} />
          ))}
        </div>
      </div>
    </div>
  );
}

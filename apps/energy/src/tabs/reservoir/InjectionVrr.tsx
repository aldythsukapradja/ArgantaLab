// InjectionVrr.tsx — the Injection & VRR tab (COSMO). The GeaVision VRR template
// (VrrPanel: mirrored production/injection voidage bars + cumulative VRR% line + dashed
// 100% target), driven by real Volve injection/production. Scope selector: whole field
// or a single injector pattern (injector + its nearest producers). VRR is voidage-based
// (Bo·oil + Bw·water) — pressure maintenance read at a glance.
import { useMemo, useState } from 'react';
import { useRM } from './ReservoirMgmt';
import { VrrPanel } from './chart/VrrPanel';
import { Panel, Stat, TabHeader, Page } from './surface';
import { cumulativeVrr } from '../../engine/surveillance';
import type { ProdMonth } from '../../wb/types';
import type { RMWellSeries } from './data';

function combineMonths(wells: RMWellSeries[]): ProdMonth[] {
  const by = new Map<string, ProdMonth>();
  for (const w of wells) for (const m of w.raw) {
    const a = by.get(m.ym) ?? { ym: m.ym, oil: 0, gas: 0, water: 0, wi: 0 };
    a.oil += m.oil; a.gas += m.gas; a.water += m.water; a.wi += m.wi; by.set(m.ym, a);
  }
  return [...by.values()].sort((a, b) => a.ym.localeCompare(b.ym));
}

export function InjectionVrr() {
  const rm = useRM();
  const [scope, setScope] = useState<string>('field');
  const patterns = rm.patterns.patterns;

  const months = useMemo(() => {
    if (scope === 'field') return rm.field.raw;
    const p = patterns.find((x) => x.injector === scope);
    if (!p) return rm.field.raw;
    const names = new Set<string>([p.injector, ...p.producers.map((x) => x.well)]);
    return combineMonths(rm.wells.filter((w) => names.has(w.well)));
  }, [scope, rm, patterns]);

  const vrr = useMemo(() => cumulativeVrr(months.map((m) => ({ oil: m.oil, water: m.water, wi: m.wi }))), [months]);
  const totWi = months.reduce((s, m) => s + m.wi, 0), totOil = months.reduce((s, m) => s + m.oil, 0);

  return (
    <Page>
      <TabHeader title="Injection and VRR" nature="derived"
        subtitle="Voidage replacement (Bo·oil + Bw·water) — balance support and offtake by pattern"
        right={
          <select value={scope} onChange={(e) => setScope(e.target.value)}
            style={{ padding: '5px 8px', fontSize: 12, fontFamily: 'var(--mono)', background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 4, color: 'var(--text)' }}>
            <option value="field">Whole field</option>
            {patterns.map((p) => <option key={p.injector} value={p.injector}>Pattern · {p.injector}</option>)}
          </select>
        } />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {rm.patterns.injectors.map((inj) => (
          <span key={inj} onClick={() => setScope(inj)} style={{ cursor: 'pointer', fontSize: 11, fontFamily: 'var(--mono)', padding: '3px 9px', borderRadius: 20,
            border: '1px solid var(--cblue)', color: scope === inj ? 'var(--panel)' : 'var(--cblue)', background: scope === inj ? 'var(--cblue)' : 'transparent' }}>{inj} · injector</span>
        ))}
        <span style={{ fontSize: 11, fontFamily: 'var(--mono)', padding: '3px 9px', borderRadius: 20, border: '1px solid var(--orange)', color: 'var(--orange)', background: 'color-mix(in srgb, var(--orange) 12%, transparent)' }}>
          VRR {(vrr.final * 100).toFixed(0)}%
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12, marginTop: 12 }}>
        <Stat label="VRR (cum)" value={vrr.final.toFixed(2)} sub="voidage replacement" accent={Math.abs(vrr.final - 1) < 0.15 ? 'var(--green)' : 'var(--orange)'} />
        <Stat label="Water Injected" value={(totWi * 6.2898 / 1e6).toFixed(1)} sub="MMbbl" accent="var(--cblue)" />
        <Stat label="Oil Produced" value={(totOil * 6.2898 / 1e6).toFixed(1)} sub="MMbbl" accent="var(--green)" />
        <Stat label="VRR (latest)" value={vrr.inst.length ? vrr.inst[vrr.inst.length - 1].toFixed(2) : '—'} sub="instantaneous" />
      </div>

      <div style={{ marginTop: 12 }}>
        <Panel title={`Voidage replacement · ${scope === 'field' ? 'whole field' : 'pattern ' + scope}`} minHeight={320}>
          <VrrPanel months={months} />
        </Panel>
      </div>
    </Page>
  );
}
